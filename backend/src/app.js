// Express app factory. Kept separate from server.js so it can be imported in tests.
const express = require("express");
const cors = require("cors");

const fleetRoutes = require("./routes/fleet");
const driverRoutes = require("./routes/driver");
const ingestRoutes = require("./routes/ingest");

function createApp() {
  const app = express();

  // CORS: set CORS_ORIGIN (comma-separated) to restrict; omit to allow all (dev default).
  const allowed = process.env.CORS_ORIGIN;
  app.use(cors(allowed ? { origin: allowed.split(",").map((s) => s.trim()) } : {}));

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "dashboard-backend", time: new Date().toISOString() });
  });

  app.use("/api", fleetRoutes);
  app.use("/api", ingestRoutes);
  app.use("/api/driver", driverRoutes);

  // Unknown /api/* paths → JSON 404 (instead of HTML).
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  return app;
}

module.exports = { createApp };
