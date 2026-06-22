// Ingest route — the CARLA bridge POSTs telemetry frames + events here.
const express = require("express");
const { ingest } = require("../ingest");

const router = express.Router();

// POST /api/ingest   { source, vehicles:[frames], events:[sensor events] }
router.post("/ingest", (req, res) => {
  try {
    const result = ingest(req.body || {});
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[ingest] error:", e.message);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
