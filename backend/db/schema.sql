-- SENTRY dashboard — SQLite schema (v0.1 draft)
-- Engine: SQLite (better-sqlite3). Set per connection BEFORE use:
--   PRAGMA foreign_keys = ON;
--   PRAGMA journal_mode = WAL;
--
-- Conventions:
--   * timestamps  : TEXT, ISO-8601 UTC  (UI "x min ago" = now - ts, never stored)
--   * booleans    : INTEGER 0/1         (SQLite has no bool)
--   * JSON        : TEXT (json1 funcs)  (used only for non-queried blobs)
-- Provenance tags in comments:
--   [carla]   read straight from CARLA      [synth]   server-synthesized (no CARLA source)
--   [derived] computed from CARLA/telemetry  [static]  authored config
--   [control] driver command reflected back

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- TIER 1 — static identity & spec
-- ===========================================================================

CREATE TABLE drivers (
  id          INTEGER PRIMARY KEY,
  full_name   TEXT NOT NULL,                     -- [static] UI vehicle.driver
  email       TEXT UNIQUE,                       -- [static]
  phone       TEXT,                              -- [static]
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE vehicles (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,              -- [static] stable id = CARLA role_name = UI vehicle.id ("V-1042")
  driver_id   INTEGER REFERENCES drivers(id),    -- [static] current driver (1 per vehicle; history dropped for now)
  make        TEXT NOT NULL,                     -- [static]
  model       TEXT NOT NULL,                     -- [static]
  powertrain  TEXT NOT NULL CHECK (powertrain IN ('ev','ice')),          -- [static] (NOT reliable from CARLA)
  feed_mode   TEXT NOT NULL DEFAULT 'simulated'
                CHECK (feed_mode IN ('carla','simulated')),              -- which source drives this vehicle
  is_my_car   INTEGER NOT NULL DEFAULT 0 CHECK (is_my_car IN (0,1)),     -- [static] the driver-companion car
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX ux_vehicles_mycar  ON vehicles(is_my_car) WHERE is_my_car = 1; -- at most one my-car
CREATE INDEX        ix_vehicles_driver ON vehicles(driver_id);

CREATE TABLE vehicle_specs (             -- 1:1, mostly my-car / EV capacities
  vehicle_id           INTEGER PRIMARY KEY REFERENCES vehicles(id),
  vin                  TEXT UNIQUE,             -- [static]
  plate                TEXT,                    -- [static]
  display_name         TEXT,                    -- [static] "Aero GT-7"
  battery_capacity_kwh REAL,                    -- [static] EV; feeds range
  fuel_capacity_l      REAL,                    -- [static] ICE
  km_per_pct           REAL,                    -- [static] range = energy% * km_per_pct
  charge_target_pct    INTEGER DEFAULT 80 CHECK (charge_target_pct BETWEEN 0 AND 100), -- [static] preference (NOT the live toggle)
  oil_life_pct         INTEGER                  -- [synth] N/A for EV
);

CREATE TABLE vehicle_health (            -- 1:1, my-car-centric, synthesized
  vehicle_id           INTEGER PRIMARY KEY REFERENCES vehicles(id),
  tire_fl_kpa          INTEGER,                 -- [synth]
  tire_fr_kpa          INTEGER,                 -- [synth]
  tire_rl_kpa          INTEGER,                 -- [synth]
  tire_rr_kpa          INTEGER,                 -- [synth] the value that fires "rear right low"
  tire_recommended_kpa INTEGER,                 -- [static]
  systems_nominal      INTEGER NOT NULL DEFAULT 1 CHECK (systems_nominal IN (0,1)), -- [derived] folds the OBD-II grid
  maintenance          TEXT,                    -- [synth/static] JSON [{item,due_km,status}]
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ===========================================================================
-- TIER 2 — live telemetry
-- ===========================================================================

-- HOT read: exactly one row per vehicle, UPSERTed every frame.
-- Fleet list + map + driver hero all read from here. (UPSERT: see note at bottom.)
CREATE TABLE vehicle_current (
  vehicle_id    INTEGER PRIMARY KEY REFERENCES vehicles(id),
  ts            TEXT NOT NULL,                   -- [carla] frame time
  source        TEXT NOT NULL DEFAULT 'simulated' CHECK (source IN ('carla','simulated')),
  -- position
  lat           REAL,                            -- [carla] real geo latitude
  lon           REAL,                            -- [carla] real geo longitude
  world_x       REAL,                            -- [carla] CARLA meters (minimap projection)
  world_y       REAL,                            -- [carla]
  heading_deg   REAL,                            -- [carla] yaw normalized 0-360
  -- motion
  speed_kmh     REAL NOT NULL DEFAULT 0,         -- [carla]
  status        TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active','idle','offline')), -- [derived]
  safety_score  INTEGER,                         -- [synth] per-vehicle fleet score (UI vehicle.score)
  -- energy (synth; exactly one populated per powertrain)
  battery_pct   INTEGER,                         -- [synth] EV
  fuel_pct      INTEGER,                         -- [synth] ICE
  range_km      INTEGER,                         -- [derived] energy% * km_per_pct
  -- driver-car only (null for plain fleet vehicles)
  cabin_temp_c  REAL,                            -- [synth]
  odometer_km   INTEGER,                         -- [synth] integrated distance
  locked        INTEGER,                         -- [control] reflected actual
  ac_on         INTEGER,                         -- [control]
  charging      INTEGER,                         -- [control]
  location_label TEXT,                           -- [synth] human area label (until reverse-geocode)
  incidents     INTEGER NOT NULL DEFAULT 0       -- [synth] per-vehicle incident count
);
CREATE INDEX ix_current_status ON vehicle_current(status);

-- OPTIONAL history (append-only). Skip entirely for an ephemeral demo, or
-- downsample + prune:  DELETE FROM vehicle_telemetry WHERE ts < :cutoff;
CREATE TABLE vehicle_telemetry (
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id),
  ts          TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'simulated',
  lat REAL, lon REAL, world_x REAL, world_y REAL, heading_deg REAL,
  speed_kmh REAL, status TEXT, battery_pct INTEGER, fuel_pct INTEGER,
  PRIMARY KEY (vehicle_id, ts)
);

-- ===========================================================================
-- TIER 3 — events & analytics
-- ===========================================================================

CREATE TABLE events (
  id              INTEGER PRIMARY KEY,
  vehicle_id      INTEGER REFERENCES vehicles(id),   -- null = fleet-wide
  driver_id       INTEGER REFERENCES drivers(id),    -- [static] denormalized for alert.driver
  ts              TEXT NOT NULL,                      -- [carla/derived] occurrence
  category        TEXT NOT NULL,                      -- collision/lane_departure/harsh_brake/speeding/fcw/following_too_close/red_light_running/low_charge/offline/service_due/tire_low
  severity        TEXT NOT NULL CHECK (severity IN ('crit','warn','info','ok')), -- [derived]
  icon            TEXT,                               -- [static] presentation token
  title           TEXT NOT NULL,                      -- [derived] templated from category
  detail          TEXT,                               -- [derived] e.g. "Hard braking 69 -> 19 km/h"
  audience        TEXT NOT NULL DEFAULT 'fleet' CHECK (audience IN ('fleet','driver')),
  acknowledged_at TEXT                                -- null = open
);
CREATE INDEX ix_events_feed    ON events(audience, ts DESC);
CREATE INDEX ix_events_open    ON events(audience, severity) WHERE acknowledged_at IS NULL;
CREATE INDEX ix_events_vehicle ON events(vehicle_id, ts DESC);

CREATE TABLE trips (
  id           INTEGER PRIMARY KEY,
  vehicle_id   INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id    INTEGER REFERENCES drivers(id),
  started_at   TEXT NOT NULL,                    -- [carla]
  ended_at     TEXT,                             -- [carla]  dur = ended - started
  from_label   TEXT,                             -- [synth] reverse-geocoded
  to_label     TEXT,                             -- [synth]
  distance_km  REAL,                             -- [derived] integrated from positions
  score        INTEGER,                          -- [derived]
  event_count  INTEGER NOT NULL DEFAULT 0        -- [derived] events in the trip window
);
CREATE INDEX ix_trips_vehicle ON trips(vehicle_id, started_at DESC);

-- Driver-companion score header. breakdown / week_events / week_trend are JSON
-- (json1) instead of child tables — fine for synthesized demo data.
CREATE TABLE driving_scores (
  driver_id     INTEGER PRIMARY KEY REFERENCES drivers(id),
  current_score INTEGER NOT NULL CHECK (current_score BETWEEN 0 AND 100), -- [derived]
  delta         INTEGER,                         -- [derived]
  week_trend    TEXT,                            -- [derived] JSON array  [86,88,84,...]
  breakdown     TEXT,                            -- [derived] JSON [{key,value,weight}]
  week_events   TEXT,                            -- [derived] JSON {harshBrake,harshAccel,speeding,laneDepart}
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ===========================================================================
-- TIER 4 — control seam (page -> car)
-- ===========================================================================

CREATE TABLE vehicle_desired_state (     -- 1:1 current desired state
  vehicle_id    INTEGER PRIMARY KEY REFERENCES vehicles(id),
  locked        INTEGER NOT NULL DEFAULT 1 CHECK (locked   IN (0,1)),  -- [control]
  ac_on         INTEGER NOT NULL DEFAULT 0 CHECK (ac_on    IN (0,1)),  -- [control]
  target_temp_c INTEGER DEFAULT 21,                                    -- [control]
  charging      INTEGER NOT NULL DEFAULT 0 CHECK (charging IN (0,1)),  -- [control]
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE driver_commands (           -- OPTIONAL append-only audit/queue
  id          INTEGER PRIMARY KEY,
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id   INTEGER REFERENCES drivers(id),
  command     TEXT NOT NULL,                     -- set_lock/set_ac/set_target_temp/set_charging
  payload     TEXT,                              -- JSON args, e.g. {"targetTemp":21}
  issued_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','failed'))
);
CREATE INDEX ix_commands_pending ON driver_commands(vehicle_id) WHERE status = 'pending';

-- ===========================================================================
-- Notes
-- ===========================================================================
-- UPSERT latest frame into vehicle_current (one writer = the ingest process):
--   INSERT INTO vehicle_current (vehicle_id, ts, source, lat, lon, ...)
--   VALUES (?, ?, ?, ?, ?, ...)
--   ON CONFLICT(vehicle_id) DO UPDATE SET
--     ts=excluded.ts, source=excluded.source, lat=excluded.lat, ... ;
--
-- "current state" read is just  SELECT ... FROM vehicle_current  (no DISTINCT ON
-- needed — that's the whole point of this table vs. the history table).
--
-- N actors scale freely: more CARLA actors = more `vehicles` rows (auto-registered
-- by `code`) + their current rows. No DDL change.
