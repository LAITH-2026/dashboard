// Driver routes: the companion-app view (primary vehicle, alerts, trips, score)
// + the remote-control seam. Reads/writes SQLite; the engine reflects commands.
const express = require("express");
const db = require("../db");
const { toScreen } = require("../world");

const router = express.Router();

function relTime(iso) {
  if (!iso) return "";
  const sec = (Date.now() - Date.parse(iso)) / 1000;
  if (sec < 5) return "just now";
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}h ago`;
}
function fmtDate(iso) {
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const myCar = () => db.prepare("SELECT id, driver_id FROM vehicles WHERE is_my_car = 1").get();

// GET /api/driver/car
router.get("/car", (_req, res) => {
  const row = db.prepare(`
    SELECT v.powertrain AS type,
           s.vin, s.plate, s.display_name AS name, s.charge_target_pct AS chargeTo, s.oil_life_pct AS oilLifePct,
           c.battery_pct, c.range_km, c.odometer_km, c.cabin_temp_c, c.world_x, c.world_y, c.location_label, c.ts,
           ds.locked, ds.ac_on, ds.target_temp_c, ds.charging,
           h.tire_fl_kpa, h.tire_fr_kpa, h.tire_rl_kpa, h.tire_rr_kpa
    FROM vehicles v
    JOIN vehicle_current c ON c.vehicle_id = v.id
    LEFT JOIN vehicle_specs s ON s.vehicle_id = v.id
    LEFT JOIN vehicle_desired_state ds ON ds.vehicle_id = v.id
    LEFT JOIN vehicle_health h ON h.vehicle_id = v.id
    WHERE v.is_my_car = 1
  `).get();
  if (!row) return res.status(404).json({ error: "No driver car" });
  res.json({
    name: row.name, vin: row.vin, plate: row.plate, type: row.type,
    locked: !!row.locked, acOn: !!row.ac_on, targetTemp: row.target_temp_c, charging: !!row.charging,
    battery: row.battery_pct, range: row.range_km, odometer: row.odometer_km,
    cabinTemp: row.cabin_temp_c, chargeTo: row.chargeTo, oilLifePct: row.oilLifePct,
    tirePsi: { fl: row.tire_fl_kpa, fr: row.tire_fr_kpa, rl: row.tire_rl_kpa, rr: row.tire_rr_kpa },
    lastLocation: row.location_label,
    lastUpdated: relTime(row.ts),
    coords: toScreen(row.world_x, row.world_y),
  });
});

// GET /api/driver/alerts
router.get("/alerts", (_req, res) => {
  const alerts = db.prepare(
    "SELECT id, severity AS sev, icon, title, detail, ts FROM events WHERE audience='driver' ORDER BY ts DESC"
  ).all().map((a) => ({ ...a, time: relTime(a.ts) }));
  res.json({ count: alerts.length, alerts });
});

// GET /api/driver/trips
router.get("/trips", (_req, res) => {
  const trips = db.prepare(
    "SELECT id, from_label, to_label, distance_km, score, event_count, started_at, ended_at FROM trips ORDER BY started_at DESC, id DESC"
  ).all().map((r) => ({
    id: r.id, date: fmtDate(r.started_at), time: fmtTime(r.started_at),
    from: r.from_label, to: r.to_label, km: r.distance_km, score: r.score, events: r.event_count,
    dur: `${Math.max(1, Math.round((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 60000))} min`,
  }));
  res.json({ count: trips.length, trips });
});

// GET /api/driver/score
router.get("/score", (_req, res) => {
  const row = db.prepare(
    "SELECT current_score, delta, week_trend, breakdown, week_events FROM driving_scores ORDER BY updated_at DESC LIMIT 1"
  ).get();
  if (!row) return res.status(404).json({ error: "No score" });
  res.json({
    current: row.current_score, delta: row.delta,
    weekTrend: JSON.parse(row.week_trend || "[]"),
    breakdown: JSON.parse(row.breakdown || "[]"),
    weekEvents: JSON.parse(row.week_events || "{}"),
  });
});

// POST /api/driver/command   { locked?, acOn?, targetTemp?, charging? }
router.post("/command", (req, res) => {
  const mc = myCar();
  if (!mc) return res.status(404).json({ error: "No driver car" });
  const { locked, acOn, targetTemp, charging } = req.body || {};
  const cur = db.prepare(
    "SELECT locked, ac_on, target_temp_c, charging FROM vehicle_desired_state WHERE vehicle_id = ?"
  ).get(mc.id) || { locked: 1, ac_on: 0, target_temp_c: 21, charging: 0 };
  const next = {
    vehicle_id: mc.id,
    locked: locked == null ? cur.locked : (locked ? 1 : 0),
    ac_on: acOn == null ? cur.ac_on : (acOn ? 1 : 0),
    target_temp_c: targetTemp == null ? cur.target_temp_c : targetTemp,
    charging: charging == null ? cur.charging : (charging ? 1 : 0),
  };
  db.prepare(`
    INSERT INTO vehicle_desired_state (vehicle_id, locked, ac_on, target_temp_c, charging, updated_at)
    VALUES (@vehicle_id,@locked,@ac_on,@target_temp_c,@charging, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(vehicle_id) DO UPDATE SET
      locked=excluded.locked, ac_on=excluded.ac_on, target_temp_c=excluded.target_temp_c,
      charging=excluded.charging, updated_at=excluded.updated_at
  `).run(next);

  const insCmd = db.prepare(
    "INSERT INTO driver_commands (vehicle_id, driver_id, command, payload, status) VALUES (?,?,?,?,'applied')"
  );
  for (const [k, v] of Object.entries({ locked, acOn, targetTemp, charging })) {
    if (v != null) insCmd.run(mc.id, mc.driver_id, "set_" + k, JSON.stringify({ [k]: v }));
  }
  res.json({ ok: true, desired: next });
});

module.exports = router;
