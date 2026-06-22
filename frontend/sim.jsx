// Live data layer — backend feed adapter + store. (No local simulation anymore.)
//
// As of step 4 the ENTIRE dashboard reads from the backend:
//   FLEET  vehicles + alerts        ← poll /api/fleet/live
//   DRIVER car + driving score      ← poll /api/driver/car + /api/driver/score
//   driver alerts + trips           ← fetched once (static lists)
//   control toggles (lock/AC/…)     → POST /api/driver/command (debounced)
// The server-side engine owns all simulation. Components are unchanged; they read
// useFleet / useDriverCar / useFleetAlerts / useDrivingScore / useDriverAlerts /
// useTrips. Seed globals (data.jsx) provide an instant first paint until the
// first poll lands.

(function () {
  const FLEET_MS = 1500;
  const DRIVER_MS = 1500;

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
  // coords are reconstructed from world-meters until the map rework (step 6).
  function adaptVehicle(v) {
    return {
      id: v.code, make: v.make, model: v.model, type: v.type, driver: v.driver,
      status: v.status, score: v.safety_score,
      battery: v.battery_pct, fuel: v.fuel_pct, speed: v.speed_kmh,
      coords: { x: (v.world_x ?? 0) / 1000 + 0.5, y: (v.world_y ?? 0) / 1000 + 0.5 },
      lastActivity: relTime(v.ts),
      location: v.location_label,
      incidents: v.incidents,
      source: v.source,
    };
  }

  // ─── STORE ──────────────────────────────────────────────────────────────
  function buildInitialState() {
    const vehicles = (window.ALL_VEHICLES || []).map((v) => ({ ...v, coords: { ...v.coords } }));
    const car = { ...(window.MY_CAR || {}), tirePsi: { ...((window.MY_CAR || {}).tirePsi || {}) } };
    const alerts = (window.FLEET_ALERTS || []).map((a) => ({ ...a }));
    const score = window.DRIVING_SCORE
      ? { ...window.DRIVING_SCORE, weekTrend: [...window.DRIVING_SCORE.weekTrend] }
      : null;
    const driverAlerts = (window.ALERTS_DRIVER || []).map((a) => ({ ...a }));
    const trips = (window.TRIPS || []).map((t) => ({ ...t }));
    return { vehicles, car, alerts, score, driverAlerts, trips };
  }

  let state = buildInitialState();
  const listeners = new Set();
  const getState = () => state;
  const emit = () => listeners.forEach((l) => l());
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

  // ─── FEED: poll the backend ───────────────────────────────────────────────
  let warnedFleet = false, warnedDriver = false;

  async function pollFleet() {
    try {
      const live = await window.SentryAPI.getFleetLive();
      state = { ...state, vehicles: live.vehicles.map(adaptVehicle), alerts: live.alerts };
      emit();
      warnedFleet = false;
    } catch (e) {
      if (!warnedFleet) { console.warn("[feed] fleet poll failed; keeping last state:", e); warnedFleet = true; }
    }
  }

  async function pollDriver() {
    try {
      const [car, score] = await Promise.all([
        window.SentryAPI.getDriverCar(),
        window.SentryAPI.getDriverScore(),
      ]);
      state = { ...state, car, score };
      emit();
      warnedDriver = false;
    } catch (e) {
      if (!warnedDriver) { console.warn("[feed] driver poll failed; keeping last state:", e); warnedDriver = true; }
    }
  }

  async function loadStatics() {
    try {
      const [a, t] = await Promise.all([
        window.SentryAPI.getDriverAlerts(),
        window.SentryAPI.getDriverTrips(),
      ]);
      state = { ...state, driverAlerts: a.alerts, trips: t.trips };
      emit();
    } catch (e) {
      console.warn("[feed] driver statics failed; using seed:", e);
    }
  }

  let fleetTimer = null, driverTimer = null;
  function start() {
    stop();
    fleetTimer = setInterval(pollFleet, FLEET_MS);
    driverTimer = setInterval(pollDriver, DRIVER_MS);
    pollFleet(); pollDriver(); loadStatics();
  }
  function stop() {
    if (fleetTimer) clearInterval(fleetTimer);
    if (driverTimer) clearInterval(driverTimer);
    fleetTimer = driverTimer = null;
  }

  // ─── outbound control seam (page → car), debounced ────────────────────────
  let cmdPending = null, cmdTimer = null;
  function command(next) {
    cmdPending = { ...(cmdPending || {}), ...next };
    if (cmdTimer) return;
    cmdTimer = setTimeout(() => {
      const payload = cmdPending; cmdPending = null; cmdTimer = null;
      window.SentryAPI.sendCommand(payload).catch((e) => console.warn("[feed] command failed:", e));
    }, 250);
  }

  window.SENTRY = { command, pause: stop, resume: start, getState, subscribe };

  // ─── REACT HOOKS ──────────────────────────────────────────────────────────
  const { useSyncExternalStore } = React;
  function useFleet() { return useSyncExternalStore(subscribe, () => getState().vehicles); }
  function useDriverCar() { return useSyncExternalStore(subscribe, () => getState().car); }
  function useFleetAlerts() { return useSyncExternalStore(subscribe, () => getState().alerts); }
  function useDrivingScore() { return useSyncExternalStore(subscribe, () => getState().score); }
  function useDriverAlerts() { return useSyncExternalStore(subscribe, () => getState().driverAlerts); }
  function useTrips() { return useSyncExternalStore(subscribe, () => getState().trips); }

  Object.assign(window, {
    useFleet, useDriverCar, useFleetAlerts, useDrivingScore, useDriverAlerts, useTrips,
  });

  start();
})();
