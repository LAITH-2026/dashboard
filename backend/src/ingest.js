// Ingest seam — the second writer of vehicle_current (the first is the engine).
// A CARLA bridge POSTs telemetry frames + events here; we write the CARLA-real
// fields (position/speed/heading/status) and leave synth fields (battery/score)
// at their registration defaults. Unseen codes auto-register as vehicles.
const db = require("./db");

const ISO = () => new Date().toISOString();
const KM_PER_PCT = 5.47;

const findVehicle = db.prepare("SELECT id, driver_id FROM vehicles WHERE code = ?");
const insVehicle = db.prepare(
  "INSERT INTO vehicles (code, driver_id, make, model, powertrain, feed_mode, is_my_car) VALUES (?,?,?,?,?, 'carla', 0)"
);
const markCarla = db.prepare("UPDATE vehicles SET feed_mode='carla' WHERE id = ?");
const findDriver = db.prepare("SELECT id FROM drivers WHERE full_name = ?");
const insDriver = db.prepare("INSERT INTO drivers (full_name) VALUES (?)");

// On INSERT: seed the static synth defaults. On CONFLICT: only the CARLA-real
// fields + ts + source are updated — battery/score/incidents are preserved.
const upsertCurrent = db.prepare(`
  INSERT INTO vehicle_current
    (vehicle_id, ts, source, lat, lon, world_x, world_y, heading_deg, speed_kmh, status,
     safety_score, battery_pct, fuel_pct, range_km, location_label, incidents)
  VALUES (@vehicle_id,@ts,'carla',@lat,@lon,@world_x,@world_y,@heading_deg,@speed_kmh,@status,
     @safety_score,@battery_pct,@fuel_pct,@range_km,@location_label,@incidents)
  ON CONFLICT(vehicle_id) DO UPDATE SET
    ts=excluded.ts, source='carla', lat=excluded.lat, lon=excluded.lon,
    world_x=excluded.world_x, world_y=excluded.world_y, heading_deg=excluded.heading_deg,
    speed_kmh=excluded.speed_kmh, status=excluded.status, location_label=excluded.location_label
`);
const insEvent = db.prepare(`
  INSERT INTO events (vehicle_id, driver_id, ts, category, severity, icon, title, detail, audience)
  VALUES (?,?,?,?,?,?,?,?,'fleet')
`);

function driverId(name) {
  if (!name) return null;
  const d = findDriver.get(name);
  return d ? d.id : insDriver.run(name).lastInsertRowid;
}

function registerOrGet(f) {
  const v = findVehicle.get(f.code);
  if (v) { markCarla.run(v.id); return v; }
  const did = driverId(f.driver);
  const id = insVehicle.run(
    f.code, did, f.make || "CARLA", f.model || "Vehicle", f.type === "ice" ? "ice" : "ev"
  ).lastInsertRowid;
  return { id, driver_id: did };
}

// Validate enough to avoid bad writes; the bridge is trusted but defensive helps.
const ingest = db.transaction((payload) => {
  const frames = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  const events = Array.isArray(payload.events) ? payload.events : [];

  let wrote = 0;
  for (const f of frames) {
    if (!f || !f.code) continue;
    const v = registerOrGet(f);
    const isIce = f.type === "ice";
    const speed = Number(f.speed_kmh) || 0;
    const status = f.status || (speed > 3 ? "active" : "idle");
    upsertCurrent.run({
      vehicle_id: v.id, ts: f.ts || ISO(),
      lat: f.lat ?? null, lon: f.lon ?? null,
      world_x: f.world_x ?? null, world_y: f.world_y ?? null,
      heading_deg: f.heading_deg ?? null, speed_kmh: Math.round(speed), status,
      // INSERT-only defaults (ignored on conflict):
      safety_score: 90,
      battery_pct: isIce ? null : 80,
      fuel_pct: isIce ? 80 : null,
      range_km: isIce ? null : Math.round(80 * KM_PER_PCT),
      location_label: f.location_label || "CARLA",
      incidents: 0,
    });
    wrote++;
  }

  for (const e of events) {
    if (!e || !e.category) continue;
    const v = e.code ? findVehicle.get(e.code) : null;
    insEvent.run(
      v ? v.id : null, v ? v.driver_id : null, e.ts || ISO(),
      e.category, e.severity || "warn", e.icon || "alert",
      e.title || e.category, e.detail || ""
    );
  }

  return { vehicles: wrote, events: events.length };
});

module.exports = { ingest };
