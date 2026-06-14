// Seed data for the Sentry ADAS dashboard API.
// Ported from the original frontend data.jsx so the API serves identical shapes.
// Units: km, °C, kPa.

const VEHICLE_MAKES = [
  { make: "Aero", model: "GT-7", type: "ev" },
  { make: "Aero", model: "Saber", type: "ev" },
  { make: "Vantage", model: "X3", type: "ice" },
  { make: "Vantage", model: "M1", type: "ice" },
  { make: "Northwind", model: "Cargo 250", type: "ice" },
  { make: "Lumen", model: "Volt", type: "ev" },
  { make: "Lumen", model: "Spark", type: "ev" },
  { make: "Helio", model: "RX", type: "ev" },
];

const DRIVER_NAMES = [
  "Maya Chen", "Theo Park", "Jordan Reyes", "Priya Shah", "Marcus Webb",
  "Lina Okafor", "Sam Bauer", "Ana Ruiz", "Wes Hartley", "Noor Aziz",
  "Devon Cole", "Iris Tanaka", "Khalil Brooks", "Rosa Vega", "Elliot Mensah",
  "Mira Solberg", "Jonas Reid", "Tess Iverson", "Luca Bianchi", "Cleo Anand",
];

const LOCATIONS = [
  "Mission District, SF", "SOMA, SF", "Oakland Hills", "Berkeley", "San Mateo",
  "Daly City", "Hayward", "Richmond", "Alameda", "Walnut Creek",
  "Fremont", "Palo Alto", "Sunnyvale", "Mountain View", "San Jose",
];

// Driver's primary vehicle
const MY_CAR = {
  name: "Aero GT-7",
  vin: "AGT74XB922HM1",
  plate: "8DLR-294",
  type: "ev",
  locked: true,
  battery: 73,
  range: 399,
  odometer: 22_984,
  tirePsi: { fl: 241, fr: 241, rl: 234, rr: 221 }, // kPa
  oilLifePct: 100, // EV — we'll show as N/A
  cabinTemp: 20,
  targetTemp: 21,
  acOn: false,
  charging: false,
  chargeTo: 80,
  lastUpdated: "2 min ago",
  lastLocation: "Mission Bay Garage",
  coords: { x: 0.32, y: 0.55 },
};

const ALERTS_DRIVER = [
  { id: 1, sev: "warn", icon: "tire", title: "Right rear tire pressure low", detail: "221 kPa · 21 below recommended", time: "8h ago" },
  { id: 2, sev: "info", icon: "wrench", title: "Software update 3.4.1 available", detail: "Improves lane-keep on rain · 18 min", time: "1d ago" },
  { id: 3, sev: "ok", icon: "check", title: "Annual inspection complete", detail: "All systems nominal", time: "5d ago" },
];

const TRIPS = [
  { id: 1, date: "Today", time: "8:42 AM", from: "Home", to: "Pier 28 Office", km: 10.3, dur: "22 min", score: 94, events: 1 },
  { id: 2, date: "Yesterday", time: "6:15 PM", from: "Pier 28 Office", to: "Trader Joe's, Bay St", km: 6.6, dur: "14 min", score: 88, events: 2 },
  { id: 3, date: "Yesterday", time: "8:30 AM", from: "Home", to: "Pier 28 Office", km: 10.5, dur: "19 min", score: 96, events: 0 },
  { id: 4, date: "May 4", time: "11:20 AM", from: "Home", to: "SFO Terminal 2", km: 29.3, dur: "31 min", score: 82, events: 4 },
  { id: 5, date: "May 3", time: "7:00 PM", from: "Mission Bowling", to: "Home", km: 4.8, dur: "12 min", score: 91, events: 1 },
  { id: 6, date: "May 3", time: "10:15 AM", from: "Home", to: "Lake Merritt", km: 20.6, dur: "27 min", score: 89, events: 2 },
];

// Driving score breakdown
const DRIVING_SCORE = {
  current: 91,
  delta: +3,
  weekTrend: [86, 88, 84, 90, 92, 89, 91],
  breakdown: [
    { key: "Smooth braking", value: 94, weight: "25%" },
    { key: "Smooth acceleration", value: 89, weight: "20%" },
    { key: "Speed compliance", value: 92, weight: "20%" },
    { key: "Lane discipline", value: 88, weight: "20%" },
    { key: "Following distance", value: 95, weight: "15%" },
  ],
  weekEvents: { harshBrake: 4, harshAccel: 2, speeding: 1, laneDepart: 3 },
};

// Fleet: synthesize 200 vehicles deterministically (seeded RNG → stable ids/values).
function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seedRandom(7);
const ALL_VEHICLES = Array.from({ length: 200 }, (_, i) => {
  const make = VEHICLE_MAKES[Math.floor(rng() * VEHICLE_MAKES.length)];
  const driver = DRIVER_NAMES[i % DRIVER_NAMES.length];
  const r = rng();
  let status = "active";
  if (r > 0.92) status = "offline";
  else if (r > 0.65) status = "idle";
  const score = Math.floor(60 + rng() * 40);
  const battery = make.type === "ev" ? Math.floor(15 + rng() * 85) : null;
  const fuel = make.type === "ice" ? Math.floor(15 + rng() * 85) : null;
  return {
    id: `V-${String(1042 + i).padStart(4, "0")}`,
    make: make.make, model: make.model, type: make.type,
    driver, status, score,
    battery, fuel,
    location: LOCATIONS[Math.floor(rng() * LOCATIONS.length)],
    lastActivity: status === "offline" ? `${Math.floor(rng() * 48 + 2)}h ago` : status === "idle" ? `${Math.floor(rng() * 45 + 5)} min ago` : "now",
    coords: { x: 0.1 + rng() * 0.8, y: 0.1 + rng() * 0.8 },
    speed: status === "active" ? Math.floor(30 + rng() * 80) : 0,
    incidents: Math.floor(rng() * 4),
  };
});

const FLEET_ALERTS = [
  { id: 1, sev: "crit", icon: "alert", title: "Collision warning triggered", vehicle: "V-1156", driver: "Marcus Webb", time: "3 min ago", detail: "Hard braking · 69 km/h → 19 km/h in 2.1s" },
  { id: 2, sev: "crit", icon: "wifi-off", title: "Vehicle offline > 24h", vehicle: "V-1089", driver: "Tess Iverson", time: "26h ago", detail: "Last seen Hayward depot" },
  { id: 3, sev: "warn", icon: "wrench", title: "Service due in 320 km", vehicle: "V-1102", driver: "Priya Shah", time: "1h ago", detail: "50k km inspection" },
  { id: 4, sev: "warn", icon: "tire", title: "Tire pressure low", vehicle: "V-1208", driver: "Ana Ruiz", time: "2h ago", detail: "RR · 193 kPa" },
  { id: 5, sev: "warn", icon: "alert", title: "Lane departure cluster", vehicle: "V-1067", driver: "Wes Hartley", time: "today", detail: "5 events on I-880 N" },
  { id: 6, sev: "info", icon: "battery", title: "Charge level under 20%", vehicle: "V-1144", driver: "Devon Cole", time: "44 min ago", detail: "Range 61 km remaining" },
  { id: 7, sev: "warn", icon: "alert", title: "Speeding sustained", vehicle: "V-1175", driver: "Khalil Brooks", time: "today", detail: "19 km/h over limit · 4 min" },
];

module.exports = {
  VEHICLE_MAKES,
  DRIVER_NAMES,
  LOCATIONS,
  MY_CAR,
  ALERTS_DRIVER,
  TRIPS,
  DRIVING_SCORE,
  ALL_VEHICLES,
  FLEET_ALERTS,
};
