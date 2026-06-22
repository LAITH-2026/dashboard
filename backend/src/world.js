// Shared world↔screen projection. ONE coordinate frame (meters) for the whole
// fleet: CARLA streams real map meters (e.g. Town10HD), and the sim engine places
// its synthetic vehicles in the SAME bounds. The API projects to normalized 0-1
// for the map, so the frontend never has to know the bounds.
//
// Tune the bounds to your CARLA map via env (SENTRY_WORLD_MIN_X, _MAX_X, _MIN_Y,
// _MAX_Y). Defaults comfortably cover Town10HD; tighten them for a CARLA-only test
// to make a few cars fill the map.
const BOUNDS = {
  minX: Number(process.env.SENTRY_WORLD_MIN_X ?? -150),
  maxX: Number(process.env.SENTRY_WORLD_MAX_X ?? 150),
  minY: Number(process.env.SENTRY_WORLD_MIN_Y ?? -150),
  maxY: Number(process.env.SENTRY_WORLD_MAX_Y ?? 150),
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// world meters → normalized 0-1 screen coords
function toScreen(wx, wy) {
  if (wx == null || wy == null) return { x: 0.5, y: 0.5 };
  return {
    x: clamp01((wx - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)),
    y: clamp01((wy - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)),
  };
}

// 0-1 → world meters (the sim engine + seed lay synthetic vehicles into the frame)
function fromScreen(x, y) {
  return {
    wx: BOUNDS.minX + x * (BOUNDS.maxX - BOUNDS.minX),
    wy: BOUNDS.minY + y * (BOUNDS.maxY - BOUNDS.minY),
  };
}

module.exports = { BOUNDS, toScreen, fromScreen };
