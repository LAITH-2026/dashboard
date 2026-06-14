// Fleet routes: vehicles list + drilldown, fleet-wide alerts.
const express = require("express");
const { ALL_VEHICLES, FLEET_ALERTS } = require("../data/seed");

const router = express.Router();

// GET /api/vehicles?status=active|idle|offline&type=ev|ice&search=<text>
router.get("/vehicles", (req, res) => {
  const { status, type, search } = req.query;
  let rows = ALL_VEHICLES;

  if (status) rows = rows.filter((v) => v.status === status);
  if (type) rows = rows.filter((v) => v.type === type);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((v) =>
      [v.id, v.driver, v.make, v.model, v.location].join(" ").toLowerCase().includes(q)
    );
  }

  res.json({ count: rows.length, vehicles: rows });
});

// GET /api/vehicles/:id  (e.g. V-1042)
router.get("/vehicles/:id", (req, res) => {
  const id = req.params.id.toLowerCase();
  const vehicle = ALL_VEHICLES.find((v) => v.id.toLowerCase() === id);
  if (!vehicle) {
    return res.status(404).json({ error: `Vehicle ${req.params.id} not found` });
  }
  res.json(vehicle);
});

// GET /api/fleet/alerts
router.get("/fleet/alerts", (_req, res) => {
  res.json({ count: FLEET_ALERTS.length, alerts: FLEET_ALERTS });
});

module.exports = router;
