// Tiny backend client. Loads after config.js, so window.API_BASE is set.
// This is the seam the views will read from as we wire each one to the API.
(function () {
  const BASE = window.API_BASE || "";

  async function get(path) {
    const res = await fetch(BASE + path, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function post(path, body) {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  window.SentryAPI = {
    base: BASE,
    health: () => get("/api/health"),
    getVehicles(q = {}) {
      const qs = new URLSearchParams(
        Object.entries(q).filter(([, v]) => v != null && v !== "")
      ).toString();
      return get("/api/vehicles" + (qs ? `?${qs}` : ""));
    },
    getVehicle: (code) => get("/api/vehicles/" + encodeURIComponent(code)),
    getFleetAlerts: () => get("/api/fleet/alerts"),
    getFleetLive: () => get("/api/fleet/live"),
    getDriverCar: () => get("/api/driver/car"),
    getDriverAlerts: () => get("/api/driver/alerts"),
    getDriverTrips: () => get("/api/driver/trips"),
    getDriverScore: () => get("/api/driver/score"),
    sendCommand: (payload) => post("/api/driver/command", payload),
  };
})();
