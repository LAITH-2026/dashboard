# SENTRY — Ingest & Serving Contract (v0.1 draft)

The single seam everything keys off. Grounded in the real CARLA 0.9.15 probe
(`../../carla/05_dashboard_integration/carla_probe_output.json`, Town10HD).

> **Status: DRAFT for review.** No DDL is committed yet — sanity-check the seam
> here first. Provenance tags: `carla-native` (read straight from the actor),
> `carla-sensor` (from an attached sensor), `carla-derived` (computed backend-side
> from CARLA signals), `synth` (no CARLA source — backend invents), `static`
> (authored config), `control` (driver command reflected back).

---

## 0. Identity & scaling

- Every vehicle has a stable **`code`** (e.g. `V-1042`) = the CARLA `role_name`
  we set at spawn. **This is the join key**, NOT CARLA's ephemeral actor id.
- The bridge puts `code` in every message. Backend maps `code → vehicles` row,
  auto-registering an unseen `code` on first frame.
- **N actors = N rows.** Start with 3, scale to N: no schema change, no contract
  change. CARLA-backed and synthetic vehicles coexist; `source` tells them apart.
- `carla_actor_id` (the ephemeral int) may ride along for this-session debugging
  only; it is never persisted as identity.

---

## 1. The seam — message types

Three kinds of messages cross the seam. All share the `code` vocabulary.

| Direction | Message | Frequency | Who emits |
|---|---|---|---|
| CARLA bridge → backend | **Telemetry frame** (kinematics) | every tick, per vehicle | bridge |
| CARLA bridge → backend | **Sensor event** (collision / lane / obstacle) | on occurrence | bridge |
| frontend → backend | **Control command** (lock/AC/charge) | on user action | UI |

Kinematic events (harsh-brake, speeding, FCW, following-too-close) are **derived
backend-side** from the telemetry stream — the bridge does NOT send them. The
backend's **synth layer** fills all non-CARLA fields (battery, HVAC, tires, …)
and produces the same shapes for synthetic (non-CARLA) vehicles.

---

## 2. Telemetry frame  (CARLA bridge → backend)

One tick can carry a batch. The bridge sends **only what CARLA knows**:

```json
{
  "source": "carla",
  "sim_time": 1234.56,
  "vehicles": [
    {
      "code": "V-1042",
      "carla_actor_id": 245,
      "lat": 0.000342, "lon": -0.000378, "alt": 0.0018,
      "world_x": -42.03, "world_y": -38.05, "world_z": 0.0,
      "heading_deg": 275.0,
      "speed_kmh": 17.75,
      "accel_long_mps2": -0.78,
      "speed_limit_kmh": 30,
      "throttle": 0.0, "brake": 1.0, "steer": -0.018, "gear": 1,
      "at_traffic_light": true, "traffic_light_state": "Red"
    }
  ]
}
```

| Field | Type | Unit | Provenance | Source / note |
|---|---|---|---|---|
| `code` | string | — | static | role_name; the join key |
| `carla_actor_id` | int | — | carla-native | ephemeral; debug only |
| `lat` / `lon` / `alt` | float | deg / deg / m | carla-native | `map.transform_to_geolocation(transform)` — **no GNSS sensor needed** (== GNSS exactly when noise=0) |
| `world_x/y/z` | float | m | carla-native | `get_transform().location`; powers the minimap projection |
| `heading_deg` | float | deg 0–360 | carla-native | `rotation.yaw` normalized; CARLA yaw 0 = +X(east) |
| `speed_kmh` | float | km/h | carla-native | `3.6 * |get_velocity()|` |
| `accel_long_mps2` | float | m/s² | carla-native | longitudinal accel (negative = braking); from `get_acceleration()` projected on forward vector, or IMU `accel.x` on the instrumented subset |
| `speed_limit_kmh` | float | km/h | carla-native | `get_speed_limit()`; may be stale until a sign is passed |
| `throttle`/`brake`/`steer`/`gear` | float/int | 0–1 / 0–1 / −1..1 / int | carla-native | `get_control()`; pedal-level ground truth |
| `at_traffic_light` / `traffic_light_state` | bool / enum | — | carla-native | enables a *red-light-running* event |

**Backend fills (synth/derived) — NOT sent by the bridge:**

| Field | Provenance | How |
|---|---|---|
| `status` (active/idle/offline) | carla-derived | speed + time-since-last-frame |
| `battery_pct` / `fuel_pct` / `range_km` | synth | server energy model; null by powertrain |
| `cabin_temp_c` | synth | HVAC model eases toward desired `target_temp_c` |
| `odometer_km` | synth | integrate distance from successive positions |
| `locked` / `ac_on` / `charging` (actual) | control | reflect `vehicle_desired_state` |

---

## 3. Sensor event  (CARLA bridge → backend)

Raw sensor occurrences. Backend maps `category` + `payload` → severity / title /
detail / audience (presentation lives server-side).

```json
{
  "source": "carla",
  "events": [
    { "code": "V-1042", "sim_time": 1234.5, "category": "collision",
      "payload": { "other_actor": "vehicle.nissan.patrol_2021", "impulse": 4210.5 } },
    { "code": "V-1042", "sim_time": 1235.0, "category": "lane_departure",
      "payload": { "marking_type": "Solid", "marking_color": "Yellow" } }
  ]
}
```

| category | Provenance | Source signal | Backend severity (default) |
|---|---|---|---|
| `collision` | carla-sensor | `sensor.other.collision` (`other_actor`, `impulse`) | crit |
| `lane_departure` | carla-sensor | `sensor.other.lane_invasion`, **only** when marking is Solid/Yellow (suppress Broken/White legal changes) | warn |
| `following_too_close` / `fcw` | carla-sensor + derived | `sensor.other.obstacle` (typed `other_actor` + `distance`) → headway / TTC | warn / crit |
| `harsh_brake` / `harsh_accel` | carla-derived | telemetry `accel_long_mps2` past ±threshold (low-pass) | warn / info |
| `speeding` | carla-derived | telemetry `speed_kmh` vs `speed_limit_kmh`, sustained | warn |
| `red_light_running` | carla-derived | `traffic_light_state=Red` + `speed_kmh` over threshold | crit |
| `low_charge` / `offline` / `service_due` / `tire_low` | synth/rule | server rules over synth state | info–crit |

> Radar note: radar `velocity` is **ego-relative radial range-rate** — true closing
> speed = `radar_velocity + ego_speed`. The `obstacle` sensor (typed actor) is the
> primary FCW source; radar is supplementary.

---

## 4. Canonical telemetry record  (backend → frontend)

What the API serves and what `vehicle_telemetry` / `vehicle_current` stores — the
**union** of §2 + the backend-filled fields, uniform across CARLA and synthetic
vehicles. (Maps 1:1 to schema columns in the next artifact.)

```json
{
  "code": "V-1042", "source": "carla", "ts": "2026-06-21T22:45:23Z",
  "lat": 0.000342, "lon": -0.000378, "world_x": -42.03, "world_y": -38.05,
  "heading_deg": 275.0, "speed_kmh": 17.75, "status": "active",
  "battery_pct": 73, "fuel_pct": null, "range_km": 399,
  "cabin_temp_c": 20, "odometer_km": 22984,
  "locked": true, "ac_on": false, "charging": false
}
```

- Relative-time strings (`"3 min ago"`, `"now"`) are **rendered by the frontend
  from `now() − ts`** — never stored.
- The legacy 0–1 `{x,y}` coords are gone. The frontend projects `world_x/y`
  (minimap) or `lat/lon` (real tiles) at render time.

---

## 5. Control command  (frontend → backend)

The outbound seam (today's `window.SENTRY.command`). Driver-car only.

```json
{ "code": "V-1042", "locked": true, "ac_on": false,
  "target_temp_c": 21, "charging": false }
```

Backend upserts `vehicle_desired_state` + appends to `driver_commands`; the synth
layer eases `cabin_temp_c` toward `target_temp_c` and fills/holds `battery_pct`,
and the actuals come back through §4. `charge_target_pct` (the 80% ceiling) is a
stable preference in `vehicle_specs`, not part of this command.

---

## 6. Conventions & open questions

- **Units:** km/h, °C, m, kPa (tire), decimal degrees. Timestamps ISO-8601 UTC.
- **`source`:** `"carla"` | `"simulated"` — per frame, mirrors the existing
  `source:'external'` marker in `sim.jsx`.
- **Transport (later):** start with the bridge POSTing batches to an ingest
  endpoint; SSE/WebSocket is an optimization, not part of this contract.
- **Open Q1:** heading — keep raw CARLA yaw (0=east) or convert to true-north
  compass? (Cosmetic; pick one and document.)
- **Open Q2:** do we want `world_z`/`alt` at all for a 2-D dashboard? (Lean: keep
  for free, ignore in UI.)
- **Open Q3:** event identity/debounce — collisions can fire repeatedly during
  one impact; backend coalesces within a short window into one incident.
```
