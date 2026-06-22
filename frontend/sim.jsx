// Live data layer.
//
// As of step 3 the FLEET (vehicles + fleet alerts) is driven by the BACKEND:
// the server runs the simulation engine, writes vehicle_current + events, and
// this file POLLS /api/fleet/live and pushes the result into the store. The
// driver CAR + driving SCORE are still simulated locally here (they move to the
// backend in step 4, together with the control seam).
//
//   STORE  — canonical state + React glue (useSyncExternalStore hooks)
//   LOCAL  — stepCar + score jitter (driver-side, temporary)
//   FEED   — pollFleet() (backend → page) + window.SENTRY (command/ingest seams)
//
// Components are unchanged: they still read useFleet / useDriverCar /
// useFleetAlerts / useDrivingScore.

(function () {
  const TICK_MS = 1500;   // local car/score tick
  const POLL_MS = 1500;   // backend fleet poll
  const KM_PER_PCT = 5.47;

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function relTime(iso) {
    if (!iso) return "";
    const sec = (Date.now() - Date.parse(iso)) / 1000;
    if (sec < 5) return "now";
    if (sec < 60) return `${Math.round(sec)}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
    return `${Math.round(sec / 86400)}h ago`;
  }

  // Backend canonical vehicle → the shape the components consume. The 0-1 map
  // coords are reconstructed from world-meters until the map is reworked for
  // real tiles / a town minimap (step 6).
  function adapt(v) {
    return {
      id: v.code, make: v.make, model: v.model, type: v.type, driver: v.driver,
      status: v.status, score: v.safety_score,
      battery: v.battery_pct, fuel: v.fuel_pct, speed: v.speed_kmh,
      coords: { x: (v.world_x ?? 0) / 1000 + 0.5, y: (v.world_y ?? 0) / 1000 + 0.5 },
      lastActivity: relTime(v.ts),
      location: v.location_label,
      incidents: v.incidents,
    };
  }

  // ─── STORE ──────────────────────────────────────────────────────────────
  // Seeded from data.jsx for an instant first paint; the fleet is replaced by
  // the first backend poll a moment later.
  function buildInitialState() {
    const vehicles = (window.ALL_VEHICLES || []).map((v) => ({ ...v, coords: { ...v.coords } }));
    const car = { ...(window.MY_CAR || {}), tirePsi: { ...((window.MY_CAR || {}).tirePsi || {}) } };
    const alerts = (window.FLEET_ALERTS || []).map((a) => ({ ...a }));
    const score = window.DRIVING_SCORE
      ? { ...window.DRIVING_SCORE, weekTrend: [...window.DRIVING_SCORE.weekTrend] }
      : null;
    return { vehicles, car, alerts, score, t: 0 };
  }

  let state = buildInitialState();
  const listeners = new Set();
  const getState = () => state;
  const emit = () => listeners.forEach((l) => l());
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

  // ─── LOCAL ENGINE (driver car + score only — backend owns the fleet) ──────
  const kin = { car: { battery: state.car.battery } };
  let externalCar = false;
  let cmd = {
    locked: !!state.car.locked,
    acOn: !!state.car.acOn,
    targetTemp: state.car.targetTemp || 21,
    charging: !!state.car.charging,
  };

  function stepCar(prev) {
    if (externalCar) return prev;
    const c = { ...prev };
    let battery = kin.car.battery;
    if (cmd.charging) { c.charging = true; battery = Math.min(c.chargeTo, battery + 0.6); }
    else { c.charging = false; battery = clamp(battery - 0.04, 0, 100); }
    kin.car.battery = battery;
    c.battery = Math.round(battery);
    c.range = Math.round(battery * KM_PER_PCT);
    const goal = cmd.acOn ? cmd.targetTemp : 24;
    c.cabinTemp = Math.round(c.cabinTemp + (goal - c.cabinTemp) * 0.25);
    c.acOn = cmd.acOn;
    c.targetTemp = cmd.targetTemp;
    c.locked = cmd.locked;
    c.lastUpdated = "just now";
    return c;
  }

  function tick() {
    const t = state.t + TICK_MS / 1000;
    const car = stepCar(state.car);
    let score = state.score;
    if (score && Math.random() < 0.1) {
      const cur = clamp(score.current + (Math.random() < 0.5 ? -1 : 1), 70, 99);
      score = { ...score, current: cur, weekTrend: [...score.weekTrend.slice(1), cur] };
    }
    state = { ...state, car, score, t };
    emit();
  }

  // ─── FEED: poll the backend for the live fleet ────────────────────────────
  let warnedOffline = false;
  async function pollFleet() {
    try {
      const live = await window.SentryAPI.getFleetLive();
      state = { ...state, vehicles: live.vehicles.map(adapt), alerts: live.alerts };
      emit();
      warnedOffline = false;
    } catch (e) {
      if (!warnedOffline) { console.warn("[sim] fleet poll failed; keeping last state:", e); warnedOffline = true; }
    }
  }

  let tickTimer = null, pollTimer = null, rate = 1;
  function start() {
    stop();
    tickTimer = setInterval(tick, TICK_MS / rate);
    pollTimer = setInterval(pollFleet, POLL_MS);
    pollFleet(); // first backend paint asap
  }
  function stop() {
    if (tickTimer) clearInterval(tickTimer);
    if (pollTimer) clearInterval(pollTimer);
    tickTimer = pollTimer = null;
  }

  // The driver car may still be fed by a real source via ingest() (step 4+).
  function ingest(frame) {
    if (!frame || frame.id == null) return;
    if (frame.id === "car" || frame.id === "MY_CAR") {
      externalCar = true;
      const { id, ...rest } = frame;
      state = { ...state, car: { ...state.car, ...rest, source: "external", lastUpdated: "just now" } };
      emit();
    }
  }

  // The driver UI pushes control changes here (outbound command seam).
  function command(next) { cmd = { ...cmd, ...next }; }

  window.SENTRY = {
    ingest,
    command,
    pause: stop,
    resume: start,
    setRate(m) { rate = m || 1; if (tickTimer) start(); },
    getState,
    subscribe,
  };

  // ─── REACT HOOKS ──────────────────────────────────────────────────────────
  const { useSyncExternalStore } = React;
  function useFleet() { return useSyncExternalStore(subscribe, () => getState().vehicles); }
  function useDriverCar() { return useSyncExternalStore(subscribe, () => getState().car); }
  function useFleetAlerts() { return useSyncExternalStore(subscribe, () => getState().alerts); }
  function useDrivingScore() { return useSyncExternalStore(subscribe, () => getState().score); }

  Object.assign(window, { useFleet, useDriverCar, useFleetAlerts, useDrivingScore });

  start();
})();
