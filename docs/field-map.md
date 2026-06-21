# SENTRY — Field Map (v0.1 draft)

Every frontend display field → its `table.column` → the API endpoint that serves
it. Closes the loop from the [frontend audit] → [ingest contract](ingest-contract.md)
→ [SQLite schema](../backend/db/schema.sql). `P` = provenance
(`carla` / `synth` / `derived` / `static` / `control`).

## Serving endpoints

| Endpoint | Backed by |
|---|---|
| `GET /api/vehicles` (`?status&type&search`) | `vehicle_current` ⋈ `vehicles` ⋈ `drivers` |
| `GET /api/vehicles/:code` | same, single row + `vehicle_specs`/`vehicle_health` |
| `GET /api/fleet/alerts` | `events WHERE audience='fleet'` |
| `GET /api/driver/car` | `vehicles`(my) ⋈ `vehicle_specs` ⋈ `vehicle_current` ⋈ `vehicle_desired_state` ⋈ `vehicle_health` |
| `GET /api/driver/alerts` | `events WHERE audience='driver'` |
| `GET /api/driver/trips` | `trips` |
| `GET /api/driver/score` | `driving_scores` |
| `POST /api/driver/command` | → `vehicle_desired_state` + `driver_commands` |

---

## Fleet — list, map, KPIs  (`GET /api/vehicles`)

| UI field | Column | P |
|---|---|---|
| Vehicle id (`V-1042`) | `vehicles.code` | static |
| Make / model / type | `vehicles.make` / `.model` / `.powertrain` | static |
| Driver name | `drivers.full_name` (via `vehicles.driver_id`) | static |
| Status (active/idle/offline) | `vehicle_current.status` | derived |
| Map dot position | `vehicle_current.lat,lon` + `world_x,world_y` | carla |
| Heading | `vehicle_current.heading_deg` | carla |
| Speed | `vehicle_current.speed_kmh` | carla |
| Energy (battery/fuel %) | `vehicle_current.battery_pct` / `fuel_pct` | synth |
| Safety score | `vehicle_current.safety_score` | synth |
| Last activity ("now"/"3 min ago") | rendered from `vehicle_current.ts` | derived |
| Fleet counts / trips-today / fleet score / incident sum | aggregates over `vehicle_current` + `events` | derived |
| Search / status / score filters | query params over the same | — |

## Fleet — alerts feed  (`GET /api/fleet/alerts`)

| UI field | Column | P |
|---|---|---|
| Title / severity / detail / icon | `events.title` / `.severity` / `.detail` / `.icon` | derived/static |
| Associated vehicle + driver | `events.vehicle_id`→`code`, `events.driver_id`→`full_name` | carla/static |
| Time | from `events.ts` | derived |
| Critical/Warning/Info counts, avg response | aggregates over `events` (`avg response` = ⚠ literal) | derived |

## Fleet — vehicle detail  (`GET /api/vehicles/:code`)

| UI field | Column | P |
|---|---|---|
| Specs / energy / status / position | as fleet list above | carla/synth |
| Recent trips | `trips` for that vehicle | derived |
| ADAS 7-day event bars | aggregate `events` by `category` for that vehicle | derived |
| Health pills | `vehicle_health.systems_nominal` + rules | derived |

---

## Driver — hero + climate + charging  (`GET /api/driver/car`)

| UI field | Column | P |
|---|---|---|
| Vehicle name / plate / VIN | `vehicle_specs.display_name` / `.plate` / `.vin` | static |
| Powertrain | `vehicles.powertrain` | static |
| Battery / range | `vehicle_current.battery_pct` / `range_km` | synth/derived |
| Odometer | `vehicle_current.odometer_km` | synth |
| Lock status | `vehicle_current.locked` (← `vehicle_desired_state.locked`) | control |
| Last location label / coords | `vehicle_current.lat,lon` (+ reverse-geocode label) | carla |
| AC on/off, target temp | `vehicle_current.ac_on`, `vehicle_desired_state.target_temp_c` | control |
| Cabin temp (actual) | `vehicle_current.cabin_temp_c` | synth |
| Charging status / charge level | `vehicle_current.charging` / `battery_pct` | control/synth |
| Charge target (80%) | `vehicle_specs.charge_target_pct` | static |
| Tire pressures (4) + warning | `vehicle_health.tire_*_kpa` / `tire_recommended_kpa` | synth/static |
| Maintenance items | `vehicle_health.maintenance` (JSON) | synth/static |
| Diagnostics "all nominal" | `vehicle_health.systems_nominal` | derived |

## Driver — alerts / trips / score

| UI field | Column | P |
|---|---|---|
| Active alerts (tire low, SW update, …) | `events WHERE audience='driver'` | derived/synth |
| Trip log (date/route/km/dur/events/score) | `trips.*` | carla/derived/synth |
| Driving score current / delta | `driving_scores.current_score` / `.delta` | derived |
| 7-day sparkline | `driving_scores.week_trend` (JSON) | derived |
| Score breakdown rows | `driving_scores.breakdown` (JSON) | derived |
| Weekly event tallies | `driving_scores.week_events` (JSON) | derived |

## Driver — controls  (`POST /api/driver/command`)

| Action | Writes | P |
|---|---|---|
| Lock / AC / target temp / charging toggles | `vehicle_desired_state.*` + `driver_commands` row | control |
| Remote start (hold) | local UI only (no CARLA/DB) — or add a `desired_state` col if wanted | — |

---

## Stays a frontend constant (NO backend source)

These are literals in the JSX today and have no CARLA/synth column — leave them as
frontend constants unless you decide to model them later:

efficiency (km/kWh) · "next service in X km" hero line · driver percentile ("top 18%") ·
battery health / cycles / pack temp · charging rate/ETA string · avg alert response time ·
connectivity "5G" badge · trips weekly-summary stat cards · app chrome (brand, nav labels,
greetings, theme/density). Plus the **map basemap** itself (town minimap vs real tiles)
is a render choice, not data — deferred per the contract.
