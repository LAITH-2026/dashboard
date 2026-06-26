// Server-side simulation engine — the "synth layer".
// Ported from the original client sim (frontend/sim.jsx). It advances an
// in-memory fleet each tick and writes vehicle_current + events. This is the
// FIRST writer of vehicle_current; the CARLA bridge becomes a second writer in
// step 5 using the same table, so the API read path never changes.
const db = require("./db");
const { fromScreen, toScreen, BOUNDS } = require("./world");
const roadnet = require("./roadnet");

const TICK_MS = 1500;
const KM_PER_PCT = 5.47;
const ALERT_GATE = 0.45;       // chance a generated event reaches the feed
const FLEET_EVENT_CAP = 60;    // keep the fleet feed bounded
const CARLA_TTL_MS = 6000;     // a vehicle with a CARLA frame newer than this is owned by ingest
// meters per 1.0 of screen-space, averaged over both axes — converts km/h to map travel
const METERS_PER_SCREEN = ((BOUNDS.maxX - BOUNDS.minX) + (BOUNDS.maxY - BOUNDS.minY)) / 2;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const rand = (a, b) => a + Math.random() * (b - a);

const upsert = db.prepare(`
  INSERT INTO vehicle_current
    (vehicle_id, ts, source, world_x, world_y, heading_deg, speed_kmh, status,
     safety_score, battery_pct, fuel_pct, range_km, location_label, incidents)
  VALUES (@vehicle_id,@ts,'simulated',@world_x,@world_y,@heading_deg,@speed_kmh,@status,
     @safety_score,@battery_pct,@fuel_pct,@range_km,@location_label,@incidents)
  ON CONFLICT(vehicle_id) DO UPDATE SET
    ts=excluded.ts, source=excluded.source, world_x=excluded.world_x, world_y=excluded.world_y,
    heading_deg=excluded.heading_deg, speed_kmh=excluded.speed_kmh, status=excluded.status,
    safety_score=excluded.safety_score, battery_pct=excluded.battery_pct, fuel_pct=excluded.fuel_pct,
    range_km=excluded.range_km, location_label=excluded.location_label, incidents=excluded.incidents
`);
const insEvent = db.prepare(`
  INSERT INTO events (vehicle_id, driver_id, ts, category, severity, icon, title, detail, audience)
  VALUES (@vehicle_id,@driver_id,@ts,@category,@severity,@icon,@title,@detail,'fleet')
`);
const pruneEvents = db.prepare(`
  DELETE FROM events WHERE audience='fleet' AND id NOT IN (
    SELECT id FROM events WHERE audience='fleet' ORDER BY ts DESC, id DESC LIMIT ?
  )
`);
const getDesired = db.prepare(
  "SELECT locked, ac_on, target_temp_c, charging FROM vehicle_desired_state WHERE vehicle_id = ?"
);
const updMyCar = db.prepare(`
  UPDATE vehicle_current SET
    ts=@ts, source='simulated', battery_pct=@battery, range_km=@range,
    cabin_temp_c=@cabin, locked=@locked, ac_on=@ac_on, charging=@charging
  WHERE vehicle_id=@id
`);

const carlaFedStmt = db.prepare("SELECT vehicle_id FROM vehicle_current WHERE source='carla' AND ts > ?");

let fleet = [];
let myCar = null;

// Load the working set from vehicle_current (seeded, or whatever's current).
function load() {
  const rows = db.prepare(`
    SELECT v.id, v.code, v.driver_id, v.powertrain AS type,
           c.world_x, c.world_y, c.speed_kmh, c.status, c.safety_score,
           c.battery_pct, c.fuel_pct, c.location_label, c.incidents
    FROM vehicles v JOIN vehicle_current c ON c.vehicle_id = v.id
    WHERE v.is_my_car = 0
  `).all();
  const now = Date.now();
  fleet = rows.map((r) => ({
    id: r.id, code: r.code, driver_id: r.driver_id, type: r.type,
    x: toScreen(r.world_x, r.world_y).x, y: toScreen(r.world_x, r.world_y).y,
    heading: rand(0, Math.PI * 2),
    speed: r.speed_kmh || 0, status: r.status, score: r.safety_score,
    battery: r.battery_pct, fuel: r.fuel_pct,
    location_label: r.location_label, incidents: r.incidents || 0,
    // seed staleness so idle/offline don't all read "now" via ts
    lastActiveAt: r.status === "active" ? now
      : r.status === "idle" ? now - rand(3, 45) * 60000
      : now - rand(2, 42) * 3600000,
  }));

  // Put each synthetic vehicle ONTO the CARLA road network so it drives on real roads.
  // (Seeded coords are random 0..1; snap to the nearest road and give it a path to walk.)
  if (roadnet.ready()) {
    for (const v of fleet) {
      const p = roadnet.snap(v.x, v.y);
      if (p) { v.path = p.state; v.x = p.x; v.y = p.y; v.heading = p.heading; }
    }
  }

  const mc = db.prepare(`
    SELECT c.vehicle_id AS id, c.battery_pct, c.cabin_temp_c, s.charge_target_pct, s.km_per_pct
    FROM vehicle_current c
    JOIN vehicles v ON v.id = c.vehicle_id
    LEFT JOIN vehicle_specs s ON s.vehicle_id = c.vehicle_id
    WHERE v.is_my_car = 1
  `).get();
  myCar = mc ? {
    id: mc.id, battery: mc.battery_pct ?? 73, cabin: mc.cabin_temp_c ?? 22,
    chargeTo: mc.charge_target_pct ?? 80, kmPerPct: mc.km_per_pct ?? KM_PER_PCT,
  } : null;
}

// Advance one vehicle in place; return any events it emitted.
function stepVehicle(v) {
  const events = [];
  const r = Math.random();
  const wasOffline = v.status === "offline";
  if (v.status === "active") {
    if (r < 0.004) v.status = "offline";
    else if (r < 0.02) v.status = "idle";
  } else if (v.status === "idle") {
    if (r < 0.08) v.status = "active";
  } else if (v.status === "offline") {
    if (r < 0.05) v.status = "active";
  }

  if (v.status === "active") {
    v.lastActiveAt = Date.now();
    const target = rand(40, 110);
    const prev = v.speed;
    v.speed += (target - v.speed) * 0.25;

    if (Math.random() < 0.012 && v.speed > 60) {
      v.speed *= 0.45;
      events.push({ sev: "crit", icon: "alert", category: "collision",
        title: "Collision warning triggered",
        detail: `Hard braking · ${Math.round(prev)} → ${Math.round(v.speed)} km/h` });
    }

    // follow the CARLA road network when loaded; else legacy free-roam walk
    if (v.path && roadnet.ready()) {
      const ds = (v.speed / 3.6) * (TICK_MS / 1000) / METERS_PER_SCREEN; // screen units this tick
      const p = roadnet.advance(v.path, ds);
      v.x = p.x; v.y = p.y; v.heading = p.heading;
    } else {
      v.heading += rand(-0.4, 0.4);
      const dist = (v.speed / 100) * 0.018;
      let x = v.x + Math.cos(v.heading) * dist;
      let y = v.y + Math.sin(v.heading) * dist;
      if (x < 0.04 || x > 0.96) { v.heading = Math.PI - v.heading; x = clamp(x, 0.04, 0.96); }
      if (y < 0.04 || y > 0.96) { v.heading = -v.heading; y = clamp(y, 0.04, 0.96); }
      v.x = x; v.y = y;
    }

    if (v.type === "ev" && v.battery != null) {
      const b = clamp(v.battery - 0.15, 0, 100);
      if (b < 15 && v.battery >= 15) events.push({ sev: "info", icon: "battery", category: "low_charge",
        title: "Charge level under 15%", detail: `Range ${Math.round(b * KM_PER_PCT)} km remaining` });
      v.battery = b;
    }
    if (v.type === "ice" && v.fuel != null) v.fuel = clamp(v.fuel - 0.12, 0, 100);

    if (v.speed > 115 && Math.random() < 0.05)
      events.push({ sev: "warn", icon: "alert", category: "speeding",
        title: "Speeding sustained", detail: `${Math.round(v.speed)} km/h · over limit` });
  } else {
    v.speed = 0;
  }

  if (v.status === "offline" && !wasOffline)
    events.push({ sev: "crit", icon: "wifi-off", category: "offline",
      title: "Vehicle offline", detail: "Lost connection · last seen now" });

  if (Math.random() < 0.05) v.score = clamp(v.score + (Math.random() < 0.5 ? -1 : 1), 60, 99);
  return events;
}

const runTick = db.transaction(() => {
  let generated = 0;
  const cutoff = new Date(Date.now() - CARLA_TTL_MS).toISOString();
  const carlaFed = new Set(carlaFedStmt.all(cutoff).map((r) => r.vehicle_id));
  for (const v of fleet) {
    if (carlaFed.has(v.id)) continue; // CARLA owns this one — don't overwrite its frames
    const events = stepVehicle(v);
    upsert.run({
      vehicle_id: v.id,
      ts: new Date(v.lastActiveAt).toISOString(),
      world_x: Math.round(fromScreen(v.x, v.y).wx),
      world_y: Math.round(fromScreen(v.x, v.y).wy),
      heading_deg: Math.round((((v.heading * 180) / Math.PI) % 360 + 360) % 360),
      speed_kmh: Math.round(v.speed),
      status: v.status,
      safety_score: v.score,
      battery_pct: v.battery == null ? null : Math.round(v.battery),
      fuel_pct: v.fuel == null ? null : Math.round(v.fuel),
      range_km: v.battery == null ? null : Math.round(v.battery * KM_PER_PCT),
      location_label: v.location_label,
      incidents: v.incidents,
    });
    const ts = new Date().toISOString();
    for (const e of events) {
      if (Math.random() > ALERT_GATE) continue;
      insEvent.run({ vehicle_id: v.id, driver_id: v.driver_id, ts,
        category: e.category, severity: e.sev, icon: e.icon, title: e.title, detail: e.detail });
      generated++;
    }
  }

  // driver car: reflect remote commands (charging fills battery, A/C eases cabin temp)
  if (myCar) {
    const d = getDesired.get(myCar.id) || { locked: 1, ac_on: 0, target_temp_c: 21, charging: 0 };
    if (d.charging) myCar.battery = Math.min(myCar.chargeTo, myCar.battery + 0.6);
    else myCar.battery = clamp(myCar.battery - 0.04, 0, 100);
    const goal = d.ac_on ? d.target_temp_c : 24;
    myCar.cabin = myCar.cabin + (goal - myCar.cabin) * 0.25;
    updMyCar.run({
      id: myCar.id, ts: new Date().toISOString(),
      battery: Math.round(myCar.battery), range: Math.round(myCar.battery * myCar.kmPerPct),
      cabin: Math.round(myCar.cabin), locked: d.locked, ac_on: d.ac_on, charging: d.charging,
    });
  }

  if (generated) pruneEvents.run(FLEET_EVENT_CAP);
});

let timer = null;
function start() { stop(); load(); timer = setInterval(runTick, TICK_MS); }
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { start, stop, load, tick: runTick };
