// Server-side simulation engine — the "synth layer".
// Ported from the original client sim (frontend/sim.jsx). It advances an
// in-memory fleet each tick and writes vehicle_current + events. This is the
// FIRST writer of vehicle_current; the CARLA bridge becomes a second writer in
// step 5 using the same table, so the API read path never changes.
const db = require("./db");

const TICK_MS = 1500;
const KM_PER_PCT = 5.47;
const ALERT_GATE = 0.45;       // chance a generated event reaches the feed
const FLEET_EVENT_CAP = 60;    // keep the fleet feed bounded

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

let fleet = [];

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
    x: (r.world_x ?? 0) / 1000 + 0.5, y: (r.world_y ?? 0) / 1000 + 0.5,
    heading: rand(0, Math.PI * 2),
    speed: r.speed_kmh || 0, status: r.status, score: r.safety_score,
    battery: r.battery_pct, fuel: r.fuel_pct,
    location_label: r.location_label, incidents: r.incidents || 0,
    // seed staleness so idle/offline don't all read "now" via ts
    lastActiveAt: r.status === "active" ? now
      : r.status === "idle" ? now - rand(3, 45) * 60000
      : now - rand(2, 42) * 3600000,
  }));
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
    v.heading += rand(-0.4, 0.4);
    const target = rand(40, 110);
    const prev = v.speed;
    v.speed += (target - v.speed) * 0.25;

    if (Math.random() < 0.012 && v.speed > 60) {
      v.speed *= 0.45;
      events.push({ sev: "crit", icon: "alert", category: "collision",
        title: "Collision warning triggered",
        detail: `Hard braking · ${Math.round(prev)} → ${Math.round(v.speed)} km/h` });
    }

    const dist = (v.speed / 100) * 0.018;
    let x = v.x + Math.cos(v.heading) * dist;
    let y = v.y + Math.sin(v.heading) * dist;
    if (x < 0.04 || x > 0.96) { v.heading = Math.PI - v.heading; x = clamp(x, 0.04, 0.96); }
    if (y < 0.04 || y > 0.96) { v.heading = -v.heading; y = clamp(y, 0.04, 0.96); }
    v.x = x; v.y = y;

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
  for (const v of fleet) {
    const events = stepVehicle(v);
    upsert.run({
      vehicle_id: v.id,
      ts: new Date(v.lastActiveAt).toISOString(),
      world_x: Math.round((v.x - 0.5) * 1000),
      world_y: Math.round((v.y - 0.5) * 1000),
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
  if (generated) pruneEvents.run(FLEET_EVENT_CAP);
});

let timer = null;
function start() { stop(); load(); timer = setInterval(runTick, TICK_MS); }
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { start, stop, load, tick: runTick };
