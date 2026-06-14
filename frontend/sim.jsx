// Live simulation layer — makes the dashboard feel alive.
//
// Three layers, one file (no build step, so we keep them together and share
// state via closures instead of cross-file globals):
//
//   ENGINE  — advances each vehicle's physics/telemetry per tick, emits events
//   STORE   — canonical state + React glue (useSyncExternalStore hooks)
//   FEED    — the SimFeed timer that drives the engine; plus window.SENTRY,
//             the transport-agnostic seam where a REAL car (or backend) later
//             pushes frames via SENTRY.ingest(frame) — same shape, no UI change.
//
// Initial state is read from the seed globals in data.jsx (window.ALL_VEHICLES,
// window.MY_CAR, window.FLEET_ALERTS, window.DRIVING_SCORE), so data.jsx stays
// the single source of seed data and this file just brings it to life.

(function () {
  const TICK_MS = 1500;        // logic tick; map dots CSS-glide between ticks
  const KM_PER_PCT = 5.47;     // driver-car range model (399km @ 73%)
  const ALERT_CAP = 24;        // max items kept in the live alerts feed
  const ALERT_GATE = 0.45;     // chance per tick that a pending event becomes an alert

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const rand = (a, b) => a + Math.random() * (b - a);

  function relTime(sec) {
    if (sec < 5) return "now";
    if (sec < 60) return `${Math.round(sec)}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    return `${Math.round(sec / 3600)}h ago`;
  }

  // ─── STORE ──────────────────────────────────────────────────────────────
  // State is updated immutably: each tick produces a new top-level object, and
  // new refs only for the slices that changed. Hooks select a slice, so a
  // component re-renders only when its slice's ref changes.
  function buildInitialState() {
    const vehicles = (window.ALL_VEHICLES || []).map((v) => ({ ...v, coords: { ...v.coords } }));
    const car = { ...(window.MY_CAR || {}), tirePsi: { ...((window.MY_CAR || {}).tirePsi || {}) } };
    const alerts = (window.FLEET_ALERTS || []).map((a) => ({ ...a })); // seed alerts keep their static `time`
    const score = window.DRIVING_SCORE
      ? { ...window.DRIVING_SCORE, weekTrend: [...window.DRIVING_SCORE.weekTrend] }
      : null;
    return { vehicles, car, alerts, score, t: 0 };
  }

  let state = buildInitialState();
  const listeners = new Set();
  const getState = () => state;
  const emit = () => listeners.forEach((l) => l());
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // ─── ENGINE ─────────────────────────────────────────────────────────────
  // Per-vehicle physics is kept here (not in display state) so external/real
  // frames can merge into display state without needing a physics model.
  const kin = new Map(); // id -> { heading, speed, battery, fuel }
  state.vehicles.forEach((v) => {
    kin.set(v.id, {
      heading: rand(0, Math.PI * 2),
      speed: v.speed || 0,
      battery: v.battery,
      fuel: v.fuel,
    });
  });

  const external = new Set();  // vehicle ids now fed by a real source → engine stops simulating them
  let externalCar = false;     // true once the driver car is fed externally
  let alertSeq = 1000;         // unique, stable React keys for generated alerts

  // Driver commands (the outbound seam): the UI pushes lock/AC/charging here,
  // and the simulated car responds — demonstrating the command→telemetry loop.
  let cmd = {
    locked: !!state.car.locked,
    acOn: !!state.car.acOn,
    targetTemp: state.car.targetTemp || 21,
    charging: !!state.car.charging,
  };

  function stepVehicle(v) {
    if (external.has(v.id)) return v; // real-fed: leave to ingest()
    const k = kin.get(v.id);
    let { status, score } = v;

    // status transitions (Markov-ish; fleet stays mostly active)
    const r = Math.random();
    const wasOffline = status === "offline";
    if (status === "active") {
      if (r < 0.004) status = "offline";
      else if (r < 0.02) status = "idle";
    } else if (status === "idle") {
      if (r < 0.08) status = "active";
    } else if (status === "offline") {
      if (r < 0.05) status = "active";
    }

    const events = [];
    if (status === "active") {
      // wander + speed toward a target band
      k.heading += rand(-0.4, 0.4);
      const target = rand(40, 110);
      const prev = k.speed;
      k.speed += (target - k.speed) * 0.25;

      // occasional harsh brake → collision/hard-braking event
      if (Math.random() < 0.012 && k.speed > 60) {
        k.speed *= 0.45;
        events.push({ sev: "crit", icon: "alert", title: "Collision warning triggered",
          detail: `Hard braking · ${Math.round(prev)} → ${Math.round(k.speed)} km/h` });
      }

      // move + reflect off map edges
      const dist = (k.speed / 100) * 0.018;
      let x = v.coords.x + Math.cos(k.heading) * dist;
      let y = v.coords.y + Math.sin(k.heading) * dist;
      if (x < 0.04 || x > 0.96) { k.heading = Math.PI - k.heading; x = clamp(x, 0.04, 0.96); }
      if (y < 0.04 || y > 0.96) { k.heading = -k.heading; y = clamp(y, 0.04, 0.96); }
      v = { ...v, coords: { x, y } };

      // energy drain
      if (v.type === "ev" && k.battery != null) k.battery = clamp(k.battery - 0.15, 0, 100);
      if (v.type === "ice" && k.fuel != null) k.fuel = clamp(k.fuel - 0.12, 0, 100);

      // event: sustained speeding
      if (k.speed > 115 && Math.random() < 0.05) {
        events.push({ sev: "warn", icon: "alert", title: "Speeding sustained",
          detail: `${Math.round(k.speed)} km/h · over limit` });
      }
      // event: low EV battery (edge-triggered at 15%)
      if (v.type === "ev" && k.battery != null && k.battery < 15 && v.battery >= 15) {
        events.push({ sev: "info", icon: "battery", title: "Charge level under 15%",
          detail: `Range ${Math.round(k.battery * KM_PER_PCT)} km remaining` });
      }
    } else {
      k.speed = 0;
    }

    // event: just went offline
    if (status === "offline" && !wasOffline) {
      events.push({ sev: "crit", icon: "wifi-off", title: "Vehicle offline",
        detail: "Lost connection · last seen now" });
    }

    // gentle score jitter
    if (Math.random() < 0.05) score = clamp(score + (Math.random() < 0.5 ? -1 : 1), 60, 99);

    const lastActivity = status === "offline"
      ? `${Math.floor(rand(2, 42))}h ago`
      : status === "idle" ? `${Math.floor(rand(3, 43))} min ago` : "now";

    const next = {
      ...v,
      status,
      score,
      speed: Math.round(k.speed),
      battery: k.battery == null ? null : Math.round(k.battery),
      fuel: k.fuel == null ? null : Math.round(k.fuel),
      lastActivity,
    };
    next.__events = events; // transient; stripped before it reaches state
    return next;
  }

  function stepCar(prev, t) {
    if (externalCar) return prev;
    const c = { ...prev };
    let battery = kin.get("__car").battery;

    if (cmd.charging) {
      c.charging = true;
      battery = Math.min(c.chargeTo, battery + 0.6);
    } else {
      c.charging = false;
      battery = clamp(battery - 0.04, 0, 100); // slow self-discharge
    }
    kin.get("__car").battery = battery;
    c.battery = Math.round(battery);
    c.range = Math.round(battery * KM_PER_PCT);

    // cabin temp eases toward the target when AC is on, else toward ambient
    const goal = cmd.acOn ? cmd.targetTemp : 24;
    c.cabinTemp = Math.round(c.cabinTemp + (goal - c.cabinTemp) * 0.25);
    c.acOn = cmd.acOn;
    c.targetTemp = cmd.targetTemp;
    c.locked = cmd.locked;
    c.lastUpdated = "just now";
    return c;
  }
  kin.set("__car", { battery: state.car.battery });

  function pickAlert(events, t) {
    if (!events.length || Math.random() > ALERT_GATE) return null;
    const rank = { crit: 3, warn: 2, info: 1, ok: 0 };
    const e = events.slice().sort((a, b) => rank[b.sev] - rank[a.sev])[0];
    return { ...e, id: `sim-${alertSeq++}`, time: "now", ts: t };
  }

  function tick() {
    const t = state.t + TICK_MS / 1000;

    const events = [];
    const vehicles = state.vehicles.map((v) => {
      const n = stepVehicle(v);
      if (n.__events && n.__events.length) {
        n.__events.forEach((e) => events.push({ ...e, vehicle: v.id, driver: v.driver }));
        delete n.__events;
      }
      return n;
    });

    const car = stepCar(state.car, t);

    let score = state.score;
    if (score && Math.random() < 0.1) {
      const cur = clamp(score.current + (Math.random() < 0.5 ? -1 : 1), 70, 99);
      score = { ...score, current: cur, weekTrend: [...score.weekTrend.slice(1), cur] };
    }

    let alerts = state.alerts;
    const newAlert = pickAlert(events, t);
    if (newAlert) {
      // re-age generated alerts (those with a ts); seed alerts keep their label
      alerts = [newAlert, ...state.alerts]
        .slice(0, ALERT_CAP)
        .map((a) => (a.ts != null ? { ...a, time: relTime(t - a.ts) } : a));
    }

    state = { vehicles, car, alerts, score, t };
    emit();
  }

  // ─── FEED (SimFeed timer + the ingest/command seam) ─────────────────────
  let timer = null;
  let rate = 1;
  function start() { stop(); timer = setInterval(tick, TICK_MS / rate); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // The real car (or a backend LiveFeed) later calls this with the SAME frame
  // shape the sim produces. id "car"/"MY_CAR" targets the driver car; any other
  // id targets a fleet vehicle. Once ingested, the engine stops simulating it.
  function ingest(frame) {
    if (!frame || frame.id == null) return;
    if (frame.id === "car" || frame.id === "MY_CAR") {
      externalCar = true;
      const { id, ...rest } = frame;
      state = { ...state, car: { ...state.car, ...rest, source: "external", lastUpdated: "just now" } };
    } else {
      external.add(frame.id);
      const { id, ...rest } = frame;
      const vehicles = state.vehicles.map((v) =>
        v.id === frame.id ? { ...v, ...rest, source: "external" } : v
      );
      state = { ...state, vehicles };
    }
    emit();
  }

  // The driver UI pushes control changes here (outbound command seam).
  function command(next) { cmd = { ...cmd, ...next }; }

  window.SENTRY = {
    ingest,                       // real-car / backend → page
    command,                      // page → car (lock, AC, charging…)
    pause: stop,
    resume: start,
    setRate(m) { rate = m || 1; if (timer) start(); },
    getState,
    subscribe,
  };

  // ─── REACT HOOKS ────────────────────────────────────────────────────────
  const { useSyncExternalStore } = React;
  function useFleet() { return useSyncExternalStore(subscribe, () => getState().vehicles); }
  function useDriverCar() { return useSyncExternalStore(subscribe, () => getState().car); }
  function useFleetAlerts() { return useSyncExternalStore(subscribe, () => getState().alerts); }
  function useDrivingScore() { return useSyncExternalStore(subscribe, () => getState().score); }

  Object.assign(window, { useFleet, useDriverCar, useFleetAlerts, useDrivingScore });

  start(); // bring it to life
})();
