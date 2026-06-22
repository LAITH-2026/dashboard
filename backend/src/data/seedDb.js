// Seed sentry.db from the existing mock data (./seed.js) into the new schema.
// Idempotent: clears every table, then inserts. Run:  npm run seed
const db = require("../db");
const {
  DRIVER_NAMES, MY_CAR, ALERTS_DRIVER, TRIPS, DRIVING_SCORE, ALL_VEHICLES, FLEET_ALERTS,
} = require("./seed");

const KM_PER_PCT = 5.47;
const MYCAR_DRIVER = "Hussien";
const ts = new Date().toISOString();

const seed = db.transaction(() => {
  // clear (children first, FK-safe)
  for (const t of [
    "driver_commands", "vehicle_desired_state", "driving_scores", "trips", "events",
    "vehicle_telemetry", "vehicle_current", "vehicle_health", "vehicle_specs", "vehicles", "drivers",
  ]) db.prepare(`DELETE FROM ${t}`).run();

  // drivers
  const insDriver = db.prepare("INSERT INTO drivers (full_name) VALUES (?)");
  const driverId = {};
  for (const name of [...new Set([...DRIVER_NAMES, MYCAR_DRIVER])]) {
    driverId[name] = insDriver.run(name).lastInsertRowid;
  }

  // vehicles + current
  const insVehicle = db.prepare(
    "INSERT INTO vehicles (code, driver_id, make, model, powertrain, feed_mode, is_my_car) VALUES (?,?,?,?,?,?,?)"
  );
  const insCurrent = db.prepare(`
    INSERT INTO vehicle_current
      (vehicle_id, ts, source, lat, lon, world_x, world_y, heading_deg, speed_kmh, status,
       safety_score, battery_pct, fuel_pct, range_km, cabin_temp_c, odometer_km, locked, ac_on, charging,
       location_label, incidents)
    VALUES (@vehicle_id,@ts,@source,@lat,@lon,@world_x,@world_y,@heading_deg,@speed_kmh,@status,
       @safety_score,@battery_pct,@fuel_pct,@range_km,@cabin_temp_c,@odometer_km,@locked,@ac_on,@charging,
       @location_label,@incidents)
  `);
  const codeId = {};

  for (const v of ALL_VEHICLES) {
    const id = insVehicle.run(v.id, driverId[v.driver] ?? null, v.make, v.model, v.type, "simulated", 0).lastInsertRowid;
    codeId[v.id] = id;
    insCurrent.run({
      vehicle_id: id, ts, source: "simulated", lat: null, lon: null,
      // mock coords are 0..1 render-space → store as synthetic world-meters until CARLA feeds real lat/long
      world_x: Math.round((v.coords.x - 0.5) * 1000), world_y: Math.round((v.coords.y - 0.5) * 1000),
      heading_deg: null, speed_kmh: v.speed, status: v.status, safety_score: v.score,
      battery_pct: v.battery, fuel_pct: v.fuel,
      range_km: v.battery != null ? Math.round(v.battery * KM_PER_PCT) : null,
      cabin_temp_c: null, odometer_km: null, locked: null, ac_on: null, charging: null,
      location_label: v.location, incidents: v.incidents,
    });
  }

  // driver-companion car
  const myId = insVehicle.run("MY-CAR", driverId[MYCAR_DRIVER], "Aero", "GT-7", MY_CAR.type, "simulated", 1).lastInsertRowid;
  codeId["MY-CAR"] = myId;
  insCurrent.run({
    vehicle_id: myId, ts, source: "simulated", lat: null, lon: null,
    world_x: Math.round((MY_CAR.coords.x - 0.5) * 1000), world_y: Math.round((MY_CAR.coords.y - 0.5) * 1000),
    heading_deg: null, speed_kmh: 0, status: "idle", safety_score: DRIVING_SCORE.current,
    battery_pct: MY_CAR.battery, fuel_pct: null, range_km: MY_CAR.range,
    cabin_temp_c: MY_CAR.cabinTemp, odometer_km: MY_CAR.odometer,
    locked: MY_CAR.locked ? 1 : 0, ac_on: MY_CAR.acOn ? 1 : 0, charging: MY_CAR.charging ? 1 : 0,
    location_label: MY_CAR.lastLocation, incidents: 0,
  });

  db.prepare(`INSERT INTO vehicle_specs
    (vehicle_id, vin, plate, display_name, battery_capacity_kwh, fuel_capacity_l, km_per_pct, charge_target_pct, oil_life_pct)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(myId, MY_CAR.vin, MY_CAR.plate, MY_CAR.name, null, null, KM_PER_PCT, MY_CAR.chargeTo, MY_CAR.oilLifePct);

  db.prepare(`INSERT INTO vehicle_health
    (vehicle_id, tire_fl_kpa, tire_fr_kpa, tire_rl_kpa, tire_rr_kpa, tire_recommended_kpa, systems_nominal, maintenance)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(myId, MY_CAR.tirePsi.fl, MY_CAR.tirePsi.fr, MY_CAR.tirePsi.rl, MY_CAR.tirePsi.rr, 242, 1,
      JSON.stringify([
        { item: "Tire rotation", due_km: 1958, status: "soon" },
        { item: "Cabin air filter", due_km: 8000, status: "ok" },
        { item: "Brake pads", due_km: 19955, status: "ok" },
      ]));

  db.prepare(`INSERT INTO vehicle_desired_state
    (vehicle_id, locked, ac_on, target_temp_c, charging) VALUES (?,?,?,?,?)`)
    .run(myId, MY_CAR.locked ? 1 : 0, MY_CAR.acOn ? 1 : 0, MY_CAR.targetTemp, MY_CAR.charging ? 1 : 0);

  // events (fleet feed + driver feed)
  const insEvent = db.prepare(`INSERT INTO events
    (vehicle_id, driver_id, ts, category, severity, icon, title, detail, audience)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const a of FLEET_ALERTS)
    insEvent.run(codeId[a.vehicle] ?? null, driverId[a.driver] ?? null, ts, a.icon, a.sev, a.icon, a.title, a.detail, "fleet");
  for (const a of ALERTS_DRIVER)
    insEvent.run(myId, driverId[MYCAR_DRIVER], ts, a.icon, a.sev, a.icon, a.title, a.detail, "driver");

  // trips
  const insTrip = db.prepare(`INSERT INTO trips
    (vehicle_id, driver_id, started_at, ended_at, from_label, to_label, distance_km, score, event_count)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const t of TRIPS)
    insTrip.run(myId, driverId[MYCAR_DRIVER], ts, null, t.from, t.to, t.km, t.score, t.events);

  // driving score
  db.prepare(`INSERT INTO driving_scores
    (driver_id, current_score, delta, week_trend, breakdown, week_events) VALUES (?,?,?,?,?,?)`)
    .run(driverId[MYCAR_DRIVER], DRIVING_SCORE.current, DRIVING_SCORE.delta,
      JSON.stringify(DRIVING_SCORE.weekTrend), JSON.stringify(DRIVING_SCORE.breakdown), JSON.stringify(DRIVING_SCORE.weekEvents));
});

seed();

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(
  `Seeded sentry.db → ${count("vehicles")} vehicles (incl. my-car), ` +
  `${count("drivers")} drivers, ${count("events")} events, ${count("trips")} trips.`
);
