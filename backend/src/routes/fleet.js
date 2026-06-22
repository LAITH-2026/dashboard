// Fleet routes: vehicles list + drilldown, fleet-wide alerts, combined live feed.
// Reads from SQLite (written by the server-side engine, later by the CARLA bridge).
const express = require("express");
const db = require("../db");

const router = express.Router();

function relTime(iso) {
  if (!iso) return "";
  const sec = (Date.now() - Date.parse(iso)) / 1000;
  if (sec < 5) return "now";
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

// Canonical vehicle shape (vehicle_current ⋈ vehicles ⋈ drivers).
const VEHICLE_COLS = `
  v.code, v.make, v.model, v.powertrain AS type, d.full_name AS driver,
  c.status, c.speed_kmh, c.battery_pct, c.fuel_pct, c.range_km, c.safety_score,
  c.lat, c.lon, c.world_x, c.world_y, c.heading_deg, c.location_label, c.incidents,
  c.source, c.ts`;

function listVehicles({ status, type, search } = {}) {
  const where = ["v.is_my_car = 0"];
  const params = [];
  if (status) { where.push("c.status = ?"); params.push(status); }
  if (type) { where.push("v.powertrain = ?"); params.push(type); }
  if (search) {
    where.push("lower(v.code || ' ' || coalesce(d.full_name,'') || ' ' || v.make || ' ' || v.model || ' ' || coalesce(c.location_label,'')) LIKE ?");
    params.push(`%${String(search).toLowerCase()}%`);
  }
  return db.prepare(
    `SELECT ${VEHICLE_COLS}
     FROM vehicles v
     JOIN vehicle_current c ON c.vehicle_id = v.id
     LEFT JOIN drivers d ON d.id = v.driver_id
     WHERE ${where.join(" AND ")}
     ORDER BY v.code`
  ).all(...params);
}

function listFleetAlerts() {
  return db.prepare(
    `SELECT e.id, e.severity AS sev, e.icon, e.title, e.detail, e.ts,
            v.code AS vehicle, d.full_name AS driver
     FROM events e
     LEFT JOIN vehicles v ON v.id = e.vehicle_id
     LEFT JOIN drivers d ON d.id = e.driver_id
     WHERE e.audience = 'fleet'
     ORDER BY e.ts DESC`
  ).all().map((a) => ({ ...a, time: relTime(a.ts) }));
}

// GET /api/vehicles?status=active|idle|offline&type=ev|ice&search=<text>
router.get("/vehicles", (req, res) => {
  const rows = listVehicles(req.query);
  res.json({ count: rows.length, vehicles: rows, source: "sqlite" });
});

// GET /api/vehicles/:code  (case-insensitive)
router.get("/vehicles/:code", (req, res) => {
  const row = db.prepare(
    `SELECT ${VEHICLE_COLS}
     FROM vehicles v
     JOIN vehicle_current c ON c.vehicle_id = v.id
     LEFT JOIN drivers d ON d.id = v.driver_id
     WHERE lower(v.code) = lower(?)`
  ).get(req.params.code);
  if (!row) return res.status(404).json({ error: `Vehicle ${req.params.code} not found` });
  res.json(row);
});

// GET /api/fleet/alerts
router.get("/fleet/alerts", (_req, res) => {
  const alerts = listFleetAlerts();
  res.json({ count: alerts.length, alerts });
});

// GET /api/fleet/live  — combined snapshot the frontend polls each tick.
router.get("/fleet/live", (_req, res) => {
  res.json({
    ts: new Date().toISOString(),
    vehicles: listVehicles({}),
    alerts: listFleetAlerts(),
  });
});

module.exports = router;
