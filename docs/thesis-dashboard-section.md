# The SENTRY ADAS Dashboard

*Draft thesis section. Describes what the dashboard does, the two operating
views, and — in detail — which data originates in the CARLA simulator versus
which is synthesized by the backend. Numbering is provisional; adapt headings to
your thesis structure.*

---

## 1. Overview and Purpose

SENTRY is a web-based **Advanced Driver-Assistance System (ADAS) dashboard** that
visualises a connected vehicle fleet and a single driver's vehicle in real time.
It one of the human-facing layers of the project: where the perception and control
components (lane detection, the CARLA simulation) produce raw signals, the
dashboard turns those signals — together with vehicle state that the simulator
does not model — into the two interfaces a real deployment would actually expose:

- a **Fleet view**, for an operator or fleet manager supervising many vehicles
  at once; and
- a **Driver (Ego) view**, the in-car / companion-app experience for the owner
  of one specific vehicle.

The dashboard is deliberately built as a *thin presentation layer over a single
backend data model*. It does not itself run the physics of the world; instead it
reads a continuously-updated database that is fed from two cooperating sources —
the **CARLA simulator** (for vehicles that are actually being simulated with full
dynamics) and a lightweight **server-side simulation engine** (which animates the
remaining fleet so that the operations view is populated at realistic scale). A
core design goal, and the focus of Section 4, is that *every field on screen has
a well-defined provenance*: it is either measured in CARLA, derived from CARLA
signals, or synthesized because CARLA does not model it.

---

## 2. System Architecture and Data Flow

The system is organised as a pipeline with a single, well-defined integration
seam between the simulator and the dashboard.

```
   CARLA 0.9.15 (Town10HD / OSM world)
   ├─ N autopilot vehicles (Traffic Manager)
   └─ per-vehicle collision + lane sensors
              │
              │  carla_bridge.py  — reads each actor's kinematics,
              │  derives ADAS events, POSTs a JSON batch  ~4 Hz
              ▼
   POST /api/ingest  ──────────────┐
                                    │
   ┌───────────────── Backend (Node + Express + SQLite) ──────────────┐
   │                                                                   │
   │   Ingest seam ──────►  vehicle_current   ◄────── Simulation       │
   │   (source='carla')      events (table)            engine          │
   │                         + 9 other tables       (source='simulated'│
   │                                                  every 1.5 s)      │
   │                              │                                     │
   │            REST API:  /api/fleet/live, /api/vehicles,             │
   │                       /api/driver/{car,score,alerts,trips},       │
   │                       /api/driver/command (control)               │
   └───────────────────────────────┬──────────────────────────────────┘
                                    │  polled every 1.5 s
                                    ▼
        Frontend (React 18, no build step)
        ├─ Fleet view   (operations console)
        └─ Driver view  (single-vehicle companion app)
```

**Simulator side (CARLA).** The project runs CARLA 0.9.15 in synchronous mode at
20 FPS. A *field probe* (`probe_carla_fields.py`) was first used to establish
empirically what CARLA can and cannot provide; its output
(`carla_probe_output.json`) was then used to lock the data contract. The runtime
**bridge** (`carla_bridge.py`) spawns *N* autopilot vehicles through CARLA's
Traffic Manager, sets each vehicle's `role_name` to a stable dashboard code
(`CARLA-01`, `CARLA-02`, …), attaches a collision and a lane-invasion sensor to
each, and at roughly **4 Hz (one batch every ~250 ms)** sends a JSON message to
the backend containing each vehicle's kinematics plus any ADAS events that
occurred.

**Backend.** A Node.js / Express service backed by an embedded **SQLite**
database (via `better-sqlite3`) is the single source of truth. Two writers feed
the same `vehicle_current` table:

1. the **ingest seam** (`POST /api/ingest`), which writes rows tagged
   `source = 'carla'` from the bridge, auto-registering any previously unseen
   vehicle code; and
2. a **server-side simulation engine**, which on a fixed **1.5-second tick**
   advances every non-CARLA vehicle (position, speed, energy, status, events) and
   writes rows tagged `source = 'simulated'`.

The two writers coexist through a simple ownership rule: if a vehicle has a CARLA
frame newer than a 6-second time-to-live, the simulation engine leaves it alone;
otherwise the engine "reclaims" it. This is what lets a handful of genuinely
simulated CARLA vehicles appear inside a much larger synthesized fleet without
either side overwriting the other.

The backend exposes a small REST API. The two most important read endpoints are
`GET /api/fleet/live` (the whole fleet plus fleet-wide alerts, for the Fleet
view) and `GET /api/driver/car` / `…/score` / `…/alerts` / `…/trips` (the single
ego vehicle, for the Driver view). A single write endpoint,
`POST /api/driver/command`, carries the driver's control actions back to the car
(Section 3.3).

**Frontend.** The interface is a static React 18 application that requires no
build step (JSX is transpiled in the browser). It holds no simulation logic of
its own; it simply **polls the backend every 1.5 seconds** and renders the
result. A small status indicator — the *"Live · N CARLA"* pill — appears whenever
one or more vehicles in the feed carry `source = 'carla'`, giving an at-a-glance
signal that real simulator data is currently flowing.

---

## 3. The Two Views

The dashboard presents the same underlying data through two role-specific lenses.
They are **not two separate systems**: both are served by the same backend reading
the same SQLite database and the same `vehicle_current` table. The distinction is
one of *scope and audience*, enforced by two fields in the data model — an
`is_my_car` flag on each vehicle and an `audience` ('fleet' / 'driver') tag on
each alert. The ego vehicle is simply the one row flagged `is_my_car = 1`; the
fleet endpoints return every other vehicle (`is_my_car = 0`).

### 3.1 Fleet View — the operations console

The Fleet view answers the operator's question, *"what is the state of my whole
fleet right now?"* It comprises three primary screens plus a drill-down:

- **Overview** — a strip of key-performance-indicator (KPI) cards (fleet size
  with an active / idle / offline breakdown, trips today, ADAS incidents today,
  mean fleet safety score, open alerts), a **live map** plotting every vehicle as
  a colour-coded pin (green = active, amber = incident, grey = idle/offline), and
  a live alerts feed.
- **Vehicles** — a searchable, filterable table of the fleet (filter by status
  and by safety-score band; free-text search over vehicle id, driver, model and
  location), with energy level, safety score and "last activity" per row.
- **Alerts** — a triage queue of fleet-wide alerts grouped by severity
  (critical / warning / info).
- **Vehicle drill-down** — a read-only single-vehicle page reached by clicking a
  vehicle, showing its status, position, a recent-trip list, a 7-day ADAS-event
  breakdown and a vehicle-health summary. It is explicitly marked *read-only / no
  remote control*, reflecting that a fleet operator monitors but does not drive.

The fleet can be scaled in the interface (10 / 50 / 200 vehicles) to demonstrate
behaviour at different fleet sizes.

### 3.2 Driver (Ego) View — the in-car companion app

The Driver view answers the owner's question, *"what is the state of **my** car,
and what can I do with it?"* It is the single-vehicle, consumer-facing
counterpart to the Fleet view and comprises five screens:

- **Home** — a hero panel with the vehicle's identity (name, plate), energy and
  range, odometer, lock state, last known location and a climate/charging summary.
- **Controls** — the interactive screen: door lock, an air-conditioning dial with
  a target temperature, a charging toggle, and a hold-to-confirm remote-start
  control.
- **Trips** — a trip log (date, route, distance, duration, events, score).
- **Driving score** — the driver's score with a weekly trend, a weighted
  breakdown, and a tally of the week's events (harsh braking, harsh acceleration,
  speeding, lane departures).
- **Vehicle health** — battery health, per-corner tyre pressures, a maintenance
  schedule and a diagnostics (OBD-II) summary.

Whereas the Fleet drill-down is read-only, the Driver view is **interactive**,
which motivates the control loop below.

### 3.3 The control loop (Driver view → vehicle)

Four controls in the Driver view are genuine round-trip operations rather than
local UI state: **door lock, A/C on/off, A/C target temperature, and charging.**
When the driver changes one of these, the frontend POSTs the new desired state to
`/api/driver/command`. The backend records it in a `vehicle_desired_state` table,
and on its next tick the simulation engine *reflects* that intent back into the
vehicle's live state: enabling charging makes the battery percentage climb toward
the charge target, and changing the A/C target makes the cabin temperature ease
toward the new set-point. The updated state then flows back to the UI on the next
poll. This `command → desired state → engine → telemetry → UI` cycle is what
makes the companion app feel like it is actually commanding a vehicle.

(The ego vehicle is, by construction, always one of the *simulated* vehicles —
the CARLA ingest path always registers vehicles as fleet members, never as the
ego car — so its controllable comfort/energy state is exactly the kind of thing
the synthesis layer in Section 4 is responsible for.)

---

## 4. Data Provenance: CARLA versus Simulated

This is the central clarification of the chapter: **the dashboard mixes data of
several different origins, and being explicit about which is which is part of the
contribution.** The guiding principle, established from the CARLA field probe, is
that *CARLA is authoritative for the physics of motion and for road-interaction
events, and nothing else.* CARLA does not model a vehicle's energy system,
climate, locks, odometer, tyres, identity, maintenance or driver score; those are
synthesized by the backend so that the dashboard can present a complete vehicle.

We classify every field into one of the following **provenance tiers**:

| Tier | Meaning |
|---|---|
| **CARLA-native** | Read directly from the CARLA actor (e.g. position, speed). |
| **CARLA-sensor** | Produced by a sensor attached to the CARLA actor (collision, lane invasion). |
| **CARLA-derived** | Computed by the bridge/backend from CARLA signals (heading, harsh-braking events). |
| **Synthesized** | No CARLA source exists; the backend invents a plausible value. |
| **Static** | Authored configuration (identity, specifications). |
| **Control** | A driver command reflected back as live state. |
| **Computed** | Derived arithmetically on the server or client (range from battery, fleet averages). |

### 4.1 What CARLA actually provides

The field probe confirmed empirically that CARLA exposes, **at the actor level
(no sensor required)**: world position and orientation (x, y, z, yaw),
velocity (converted to km/h), acceleration, the control inputs
(throttle / brake / steer / gear), the current speed limit, and traffic-light
state. **Via attached sensors** it additionally provides GNSS latitude/longitude,
IMU acceleration (the longitudinal axis being the harsh-braking signal), an
obstacle/forward detector and radar, plus the event-based collision and
lane-invasion sensors.

Importantly, the **runtime bridge streams a deliberately narrow subset** of this.
Per vehicle it sends only:

- **Position** — latitude/longitude (from CARLA's geolocation transform) and the
  raw world x/y coordinates in metres;
- **Heading** — the actor yaw, normalised to 0–360°;
- **Speed** — in km/h;

and, as discrete **ADAS events**, *collision* and *lane departure* (from the
attached sensors), and *harsh braking* and *speeding* (derived on the bridge from
acceleration and the speed limit). The richer signals the probe catalogued
(throttle/brake/steer, traffic-light state, radar, IMU streams) are confirmed to
be *available* but are **not currently forwarded** to the dashboard; they
represent headroom for future work rather than data presently on screen.

### 4.2 What the backend synthesizes

Everything CARLA does not model is generated by the backend so that each vehicle
appears complete. The probe explicitly enumerated the fields that *must* be
synthesized: **battery state-of-charge and EV range, fuel level, charging state,
cabin temperature / A/C, door-lock state, odometer, tyre pressure, oil life,
OBD-II diagnostics, VIN and licence plate, driver identity, maintenance schedule,
driving score, and the offline status.**

For purely-simulated (non-CARLA) vehicles, the simulation engine animates the
synthesized fields on every 1.5-second tick: it random-walks position within a
bounded world, eases speed toward changing targets, drains battery or fuel,
drifts the safety score, and probabilistically emits incident events
(hard-braking, speeding, low-charge, offline). For **CARLA-backed vehicles**, the
split is sharper: the bridge supplies the kinematics, while the non-physical
fields are **set once to sensible defaults at registration and then held
constant** (the simulation engine yields the vehicle to CARLA and therefore does
not animate them). In other words, a CARLA vehicle on the dashboard shows *real
simulated motion* but *static placeholder* energy/score values — a limitation
discussed in Section 6.

### 4.3 Provenance summary by field

| Field shown on the dashboard | Provenance (CARLA vehicle) | Notes |
|---|---|---|
| Map position (lat/lon, world x/y) | **CARLA-native** | From the actor transform / geolocation. |
| Heading | **CARLA-derived** | Actor yaw normalised 0–360°. |
| Speed | **CARLA-native** | `3.6 × |velocity|`. |
| Status (active/idle/offline) | **CARLA-derived / synth** | Derived from speed for CARLA cars; a state machine for simulated cars. |
| Collision, lane-departure events | **CARLA-sensor** | From attached sensors. |
| Harsh-braking, speeding events | **CARLA-derived** | Thresholded from acceleration / speed limit. |
| Battery / fuel / range | **Synthesized** | Not modelled by CARLA. |
| Cabin temperature, A/C | **Synthesized / Control** | Eased toward the driver's set-point. |
| Door lock, charging | **Control** | Driver command reflected back. |
| Odometer, tyre pressure, oil life | **Synthesized / Static** | Not modelled by CARLA. |
| Safety / driving score | **Synthesized / Computed** | Per-vehicle and aggregate. |
| Identity (make, model, plate, VIN, driver) | **Static** | Authored configuration. |

### 4.4 Why a server-side simulation engine exists alongside CARLA

Instrumenting hundreds of CARLA vehicles with the full sensor suite is
computationally expensive, and a fleet operations view is only meaningful at
scale. The server-side simulation engine therefore exists to **populate the fleet
to a realistic size (up to 200 vehicles)** with plausible, continuously-changing
state, while CARLA contributes a smaller number of vehicles with genuine
dynamics. The provenance model and the `source` tag make this hybrid honest: at
any moment the dashboard can distinguish, per vehicle, whether it is showing real
CARLA simulation output or synthesized fleet data, and surfaces that distinction
through the *"Live · N CARLA"* indicator.

---

## 5. World Representation and the Map

Simulated and CARLA vehicles share **one world coordinate frame**, expressed in
metres and projected to normalised screen coordinates at render time, so that both
kinds of vehicle can be plotted on the same map without either side knowing the
display geometry.

The map itself is currently a **schematic representation** rather than a
georeferenced basemap: vehicles are drawn as pins over a stylised road graphic,
positioned by their projected coordinates. This is a deliberate staging choice.
The default CARLA town (Town10HD) reports a synthetic geo-reference
(origin at 0°, 0°), so its GNSS coordinates are not real-world coordinates. To
obtain genuine coordinates suitable for a real map-tile overlay, a separate
pipeline was prepared that imports an **OpenStreetMap extract into an OpenDRIVE
world with a real geo-reference** (a ~1 km area of Giza / Cairo University). That
real-world map exists as a standalone artifact; wiring it into the live bridge and
swapping the schematic map for real tiles is identified as future work
(Section 6).

---

## 6. Scope and Current Limitations

For academic completeness, the boundaries of the present implementation are stated
explicitly:

1. **Live CARLA operation is an on-demand demonstration, not a standing feed.**
   The full pipeline (CARLA → bridge → ingest → database → API → UI) is
   implemented and has been demonstrated end-to-end — the database retains traces
   of a captured live run: auto-registered `CARLA-01…03` vehicles, real-world
   coordinates, and bridge-only ADAS events such as harsh braking and collisions.
   However, it requires the CARLA server, the bridge script and the backend to be
   run together manually; when the bridge stops, the simulation engine reclaims
   those vehicles after the 6-second time-out, and the dashboard returns to a
   fully synthesized fleet.

2. **CARLA vehicles show real motion but static auxiliary state.** Energy, score
   and similar non-physical fields are frozen at registration defaults for
   CARLA-backed vehicles rather than being animated, because CARLA does not model
   them and the synthesis layer presently animates only the simulated fleet.

3. **The map is schematic.** Positions are real (projected world coordinates), but
   the basemap is a stylised graphic, not georeferenced tiles. The OSM/OpenDRIVE
   real-world map is prepared but not yet connected to the live feed.

4. **Some detail panels use representative data.** A subset of the deeper UI
   panels — for example certain drill-down trip histories, the multi-day ADAS
   breakdown bars, parts of the vehicle-health and diagnostics displays, and a few
   summary statistics — are populated with seeded or illustrative values to
   demonstrate the intended interface, rather than being computed from live
   telemetry. They show *what the production view would present*; the live
   plumbing for them is future work.

5. **The bridge streams a subset of available signals.** Throttle/brake/steer,
   traffic-light state, radar and IMU streams are confirmed available from CARLA
   but are not yet forwarded; they are natural extensions of the existing
   contract.

These limitations do not affect the architecture's validity: the data model, the
provenance tiers, the CARLA integration seam and the two-view presentation are all
implemented and operate against real CARLA output. What remains is breadth
(streaming more signals, animating CARLA vehicles' auxiliary state) and polish
(real map tiles, live detail panels) rather than any change to the design.

---

## 7. Summary

The SENTRY dashboard is the operator- and driver-facing layer of the project. It
presents one shared backend data model through two role-specific views — a Fleet
operations console and a single-vehicle Driver companion app — and it integrates
the CARLA simulator through a clearly-defined ingest seam. Its distinguishing
characteristic is an explicit **provenance model**: motion and road-interaction
events come from CARLA, while the many vehicle attributes CARLA does not simulate
are synthesized by the backend, with every field traceable to its origin and the
two sources visibly distinguished at runtime. This makes the dashboard both a
realistic demonstration of a connected-fleet ADAS interface and an honest account
of exactly what, in that interface, is real simulator output versus generated
supporting data.
