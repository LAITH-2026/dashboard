// Driver routes: the companion-app view (primary vehicle, alerts, trips, score).
const express = require("express");
const { MY_CAR, ALERTS_DRIVER, TRIPS, DRIVING_SCORE } = require("../data/seed");

const router = express.Router();

// GET /api/driver/car
router.get("/car", (_req, res) => res.json(MY_CAR));

// GET /api/driver/alerts
router.get("/alerts", (_req, res) =>
  res.json({ count: ALERTS_DRIVER.length, alerts: ALERTS_DRIVER })
);

// GET /api/driver/trips
router.get("/trips", (_req, res) =>
  res.json({ count: TRIPS.length, trips: TRIPS })
);

// GET /api/driver/score
router.get("/score", (_req, res) => res.json(DRIVING_SCORE));

module.exports = router;
