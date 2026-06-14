// Driver view — companion app feel: at-a-glance, friendly density, large numbers

const DriverHome = ({ car, locked, setLocked, acOn, setAcOn, targetTemp, setTargetTemp, charging, setCharging, goTo }) => {
  const [animating, setAnimating] = React.useState(false);
  const [acDial, setAcDial] = React.useState(targetTemp);

  React.useEffect(() => setAcDial(targetTemp), [targetTemp]);

  const toggleLock = () => {
    setAnimating(true);
    setLocked(!locked);
    setTimeout(() => setAnimating(false), 600);
  };

  const fuelOrBattery = car.type === "ev" ? car.battery : 64;
  const fuelLabel = car.type === "ev" ? "Battery" : "Fuel";

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)" }}>
      {/* Hero card — vehicle status */}
      <div className="card" style={{ gridColumn: "1 / -1", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr" }}>
          {/* Left: copy */}
          <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>My vehicle · {car.plate}</div>
              <h2 className="display" style={{ fontSize: 40, lineHeight: 1, margin: 0, letterSpacing: "-0.02em" }}>
                {car.name}
              </h2>
              <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                <span className="sev-dot ok" style={{ marginRight: 8, verticalAlign: "middle" }} />
                ALL SYSTEMS NOMINAL · UPDATED {car.lastUpdated.toUpperCase()}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div>
                <div className="stat-label">{fuelLabel}</div>
                <div className="stat-value">
                  <span className="display tnum">{fuelOrBattery}</span>
                  <span className="unit">%</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <HBar value={fuelOrBattery} color="var(--ok)" />
                </div>
              </div>
              <div>
                <div className="stat-label">Range</div>
                <div className="stat-value">
                  <span className="display tnum">{car.range}</span>
                  <span className="unit">km</span>
                </div>
                <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  ~5.5 km/kWh
                </div>
              </div>
              <div>
                <div className="stat-label">Odometer</div>
                <div className="stat-value">
                  <span className="display tnum">{car.odometer.toLocaleString()}</span>
                  <span className="unit">km</span>
                </div>
                <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  Next service · 1,958 km
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn"
                onClick={toggleLock}
                style={{
                  padding: "10px 18px",
                  background: locked ? "var(--accent-soft)" : "var(--surface-2)",
                  borderColor: locked ? "var(--accent-line)" : "var(--line)",
                  color: locked ? "var(--accent)" : "var(--text)",
                  transition: "all 240ms var(--easing)",
                }}
              >
                <span style={{
                  display: "inline-flex",
                  transition: "transform 320ms var(--easing)",
                  transform: animating ? "rotate(20deg)" : "none",
                }}>
                  <Icon name={locked ? "lock" : "unlock"} size={14} />
                </span>
                {locked ? "Locked" : "Unlocked"}
              </button>
              <button className="btn" onClick={() => goTo && goTo("controls")}><Icon name="map-pin" size={14} />Find my car</button>
              <button className="btn btn-primary" onClick={() => goTo && goTo("controls")}><Icon name="play" size={14} />Remote start</button>
            </div>
          </div>

          {/* Right: car placeholder + location */}
          <div style={{ padding: 24, background: "var(--surface-2)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="placeholder" style={{ height: 180 }}>
              [ vehicle render ]
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Last known location</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{car.lastLocation}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                37.7706° N · 122.3893° W
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick remote controls */}
      <div className="card">
        <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
          <div className="label">Climate</div>
          <button
            onClick={() => setAcOn(!acOn)}
            className="badge"
            style={{
              cursor: "pointer",
              color: acOn ? "var(--accent)" : "var(--text-muted)",
              borderColor: acOn ? "var(--accent-line)" : "var(--line)",
            }}
          >
            <span className="sev-dot" style={{ background: acOn ? "var(--accent)" : "var(--text-dim)" }} /> {acOn ? "ON" : "OFF"}
          </button>
        </div>

        <ACDial
          value={acDial}
          onChange={(v) => { setAcDial(v); setTargetTemp(v); }}
          active={acOn}
        />

        <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            CABIN <span style={{ color: "var(--text)" }}>{car.cabinTemp}°C</span>
          </div>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }}>
            <Icon name="snow" size={12} /> Defrost
          </button>
        </div>
      </div>

      {/* Charging (EV) */}
      <div className="card">
        <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
          <div className="label">Charging</div>
          <button
            onClick={() => setCharging(!charging)}
            className="badge"
            style={{
              cursor: "pointer",
              color: charging ? "var(--ok)" : "var(--text-muted)",
              borderColor: charging ? "color-mix(in oklch, var(--ok) 32%, transparent)" : "var(--line)",
            }}
          >
            <span className="sev-dot" style={{ background: charging ? "var(--ok)" : "var(--text-dim)" }} /> {charging ? "Charging" : "Idle"}
          </button>
        </div>

        <div className="stat-value" style={{ fontSize: 56 }}>
          <span className="display tnum">{car.battery}</span>
          <span className="unit">% / {car.chargeTo}%</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <HBar value={car.battery} max={100} color="var(--ok)" height={6} />
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {charging ? "+18 km/hr · ~2h 14m to 80%" : "Plug in to start charging"}
          </div>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }}>Limit</button>
        </div>
      </div>

      {/* Active alerts strip */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="row" style={{ marginBottom: 14, justifyContent: "space-between" }}>
          <div className="label">Active alerts · {ALERTS_DRIVER.length}</div>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }}>View all <Icon name="chevron-right" size={12} /></button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {ALERTS_DRIVER.map((a) => <AlertRow key={a.id} alert={a} compact />)}
        </div>
      </div>
    </div>
  );
};

// ─── A/C dial ─────────────────────────────────────────────────────
const ACDial = ({ value, onChange, active }) => {
  const min = 16, max = 28;
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270; // -135° to +135°

  const startDrag = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const move = (ev) => {
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - cx;
      const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - cy;
      let a = Math.atan2(y, x) * 180 / Math.PI + 90; // 0° at top
      if (a > 180) a -= 360;
      // clamp to -135..+135
      const clamped = Math.max(-135, Math.min(135, a));
      const newPct = (clamped + 135) / 270;
      const newVal = Math.round(min + newPct * (max - min));
      onChange(newVal);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
  };

  const r = 76;
  const cx = 90, cy = 90;
  const arcStart = polarToXY(cx, cy, r, -135);
  const arcEnd = polarToXY(cx, cy, r, 135);
  const valueEnd = polarToXY(cx, cy, r, angle);
  const handle = polarToXY(cx, cy, r, angle);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ position: "relative", width: 180, height: 180, cursor: "grab", userSelect: "none" }}
      >
        <svg width="180" height="180" style={{ display: "block" }}>
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round"
          />
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${pct > 2 / 3 ? 1 : 0} 1 ${valueEnd.x} ${valueEnd.y}`}
            fill="none"
            stroke={active ? "var(--accent)" : "var(--text-muted)"}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ transition: "stroke 200ms" }}
          />
          {/* Tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const ta = -135 + (i / 10) * 270;
            const inner = polarToXY(cx, cy, r - 10, ta);
            const outer = polarToXY(cx, cy, r - 4, ta);
            return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--text-dim)" strokeWidth="1" />;
          })}
          {/* Handle */}
          <circle cx={handle.x} cy={handle.y} r="8" fill="var(--surface)" stroke={active ? "var(--accent)" : "var(--text-muted)"} strokeWidth="2.5" />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div className="display tnum" style={{ fontSize: 48, lineHeight: 1, color: active ? "var(--text)" : "var(--text-muted)" }}>
            {value}°
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)", marginTop: 4 }}>
            TARGET · C
          </div>
        </div>
      </div>
    </div>
  );
};

function polarToXY(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// ─── DRIVER · TRIPS ────────────────────────────────────────────────
const DriverTrips = () => (
  <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "var(--gap)" }}>
    <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      <StatCard label="This week" value="14" unit="trips" sub="vs 12 last week" trend={{ dir: "up", label: "+17%" }} />
      <StatCard label="Distance" value="143.9" unit="km" sub="10.3 km avg" />
      <StatCard label="Drive time" value="3h 12m" sub="14 min avg" />
      <StatCard label="Avg score" value="91" sub="+3 vs last week" trend={{ dir: "up", label: "Improving" }} />
    </div>

    <div className="card card-flush">
      <div className="row" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
        <div className="label">Trip log · 30 days</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}><Icon name="filter" size={12} /> Filter</button>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}><Icon name="download" size={12} /> Export</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }}>
            {["Date", "Route", "Distance", "Duration", "Events", "Score"].map(h => (
              <th key={h} className="mono" style={{
                fontWeight: 400, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                textAlign: "left", padding: "10px 20px", borderBottom: "1px solid var(--line)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TRIPS.map((t, i) => (
            <tr key={t.id} style={{ borderBottom: i < TRIPS.length - 1 ? "1px solid var(--line)" : "none", transition: "background 140ms" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ fontWeight: 500 }}>{t.date}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.time}</div>
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="sev-dot ok" />
                  <span>{t.from}</span>
                  <Icon name="chevron-right" size={12} style={{ color: "var(--text-dim)" }} />
                  <span>{t.to}</span>
                </div>
              </td>
              <td className="mono tnum" style={{ padding: "14px 20px" }}>{t.km} km</td>
              <td className="mono" style={{ padding: "14px 20px", color: "var(--text-muted)" }}>{t.dur}</td>
              <td style={{ padding: "14px 20px" }}>
                {t.events === 0 ? (
                  <span className="badge ok"><Icon name="check" size={10} /> Clean</span>
                ) : (
                  <span className="badge warn">{t.events} events</span>
                )}
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="display tnum" style={{ fontSize: 22 }}>{t.score}</span>
                  <div style={{ width: 60 }}>
                    <HBar value={t.score} color={t.score >= 90 ? "var(--ok)" : t.score >= 80 ? "var(--accent)" : "var(--warn)"} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─── DRIVER · DRIVING SCORE ───────────────────────────────────────
const DriverScore = () => {
  const s = useDrivingScore();
  return (
    <div className="grid" style={{ gridTemplateColumns: "1.1fr 1fr", gap: "var(--gap)" }}>
      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>Overall driving score</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <span className="display tnum" style={{ fontSize: 96, lineHeight: 1 }}>{s.current}</span>
          <div style={{ paddingBottom: 12 }}>
            <span className="badge ok"><Icon name="trending" size={10} /> +{s.delta} this week</span>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Top 18% of drivers</div>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>7-day trend</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Mon — Sun</div>
          </div>
          <Sparkline data={s.weekTrend} width={420} height={56} accent="var(--accent)" />
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Score breakdown</div>
        <div className="col" style={{ gap: 14 }}>
          {s.breakdown.map((b) => (
            <div key={b.key}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{b.key}</span>
                <span className="mono tnum" style={{ fontSize: 12 }}>
                  <span style={{ color: b.value >= 90 ? "var(--ok)" : "var(--text)" }}>{b.value}</span>
                  <span style={{ color: "var(--text-dim)" }}> · {b.weight}</span>
                </span>
              </div>
              <HBar value={b.value} color={b.value >= 90 ? "var(--ok)" : b.value >= 80 ? "var(--accent)" : "var(--warn)"} />
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="label" style={{ marginBottom: 16 }}>Events this week</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { k: "Harsh braking", v: s.weekEvents.harshBrake, icon: "alert", color: "warn" },
            { k: "Harsh acceleration", v: s.weekEvents.harshAccel, icon: "trending", color: "warn" },
            { k: "Speeding (>10 over)", v: s.weekEvents.speeding, icon: "speed", color: "crit" },
            { k: "Lane departures", v: s.weekEvents.laneDepart, icon: "route", color: "warn" },
          ].map((e) => (
            <div key={e.k} style={{ padding: 16, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `var(--${e.color}-soft)`, color: `var(--${e.color})`,
                }}>
                  <Icon name={e.icon} size={14} />
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {e.k}
                </span>
              </div>
              <div className="display tnum" style={{ fontSize: 36, lineHeight: 1 }}>{e.v}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>events</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── DRIVER · HEALTH ───────────────────────────────────────────────
const DriverHealth = ({ car }) => {
  const tireRows = [
    { k: "Front Left", v: car.tirePsi.fl, ok: true },
    { k: "Front Right", v: car.tirePsi.fr, ok: true },
    { k: "Rear Left", v: car.tirePsi.rl, ok: true },
    { k: "Rear Right", v: car.tirePsi.rr, ok: false },
  ];
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--gap)" }}>
      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>Battery health</div>
        <div className="stat-value"><span className="display tnum">96</span><span className="unit">% capacity</span></div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>vs new · degraded 4%</div>
        <hr className="hairline" style={{ margin: "16px 0" }} />
        <div className="col" style={{ gap: 8, fontSize: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Cycles</span><span className="mono">412</span></div>
          <div className="row" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Pack temp</span><span className="mono">22°C · nominal</span></div>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Tire pressure</div>
        <div className="col" style={{ gap: 10 }}>
          {tireRows.map(t => (
            <div key={t.k} className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13 }}>{t.k}</span>
              <div className="row" style={{ gap: 10 }}>
                <span className="mono tnum" style={{ fontSize: 13 }}>{t.v} kPa</span>
                <span className={`sev-dot ${t.ok ? "ok" : "warn"}`} />
              </div>
            </div>
          ))}
        </div>
        <hr className="hairline" style={{ margin: "16px 0 12px" }} />
        <div className="mono" style={{ fontSize: 11, color: "var(--warn)" }}>Rear right · 21 kPa below recommended</div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Maintenance</div>
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13 }}>Tire rotation</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>in 1,958 km</div>
            </div>
            <span className="badge">Soon</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13 }}>Cabin air filter</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>in 7,725 km</div>
            </div>
            <span className="badge ok">OK</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13 }}>Brake pads</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>in 19,955 km</div>
            </div>
            <span className="badge ok">OK</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="label" style={{ marginBottom: 14 }}>Diagnostics · OBD-II</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {["Drivetrain", "Battery pack", "Cooling", "Brakes", "ADAS sensors", "Cameras"].map(s => (
            <div key={s} style={{ padding: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="sev-dot ok" />
                <span style={{ fontSize: 12 }}>{s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── DRIVER · CONTROLS ─────────────────────────────────────────────
const DriverControls = ({ locked, setLocked, acOn, setAcOn, targetTemp, setTargetTemp, charging, setCharging, car }) => {
  const [animating, setAnimating] = React.useState(false);
  const toggleLock = () => {
    setAnimating(true); setLocked(!locked);
    setTimeout(() => setAnimating(false), 600);
  };

  // Remote start: hold-to-confirm
  const HOLD_MS = 900;
  const [started, setStarted] = React.useState(false);
  const [holdPct, setHoldPct] = React.useState(0);
  const holdRef = React.useRef({ raf: 0, start: 0 });
  const cancelHold = React.useCallback(() => {
    cancelAnimationFrame(holdRef.current.raf);
    holdRef.current.raf = 0;
  }, []);
  const beginHold = () => {
    if (started) { setStarted(false); return; }
    cancelHold();
    holdRef.current.start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - holdRef.current.start) / HOLD_MS);
      setHoldPct(p);
      if (p >= 1) { setStarted(true); setHoldPct(0); holdRef.current.raf = 0; return; }
      holdRef.current.raf = requestAnimationFrame(tick);
    };
    holdRef.current.raf = requestAnimationFrame(tick);
  };
  const endHold = () => { cancelHold(); setHoldPct(0); };
  React.useEffect(() => () => cancelHold(), [cancelHold]);
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--gap)" }}>
      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Locks & doors</div>
        <button
          onClick={toggleLock}
          style={{
            width: "100%", aspectRatio: "1.4 / 1",
            border: "1px solid", borderColor: locked ? "var(--accent-line)" : "var(--line)",
            background: locked ? "var(--accent-soft)" : "var(--surface-2)",
            color: locked ? "var(--accent)" : "var(--text)",
            borderRadius: "var(--r-lg)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            cursor: "pointer", transition: "all 240ms var(--easing)",
          }}
        >
          <span style={{ transform: animating ? "scale(1.15) rotate(-10deg)" : "none", transition: "transform 320ms var(--easing)" }}>
            <Icon name={locked ? "lock" : "unlock"} size={36} />
          </span>
          <span className="display" style={{ fontSize: 22 }}>{locked ? "Locked" : "Unlocked"}</span>
        </button>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>Tap to {locked ? "unlock" : "lock"} · all doors</div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Climate</div>
        <ACDial value={targetTemp} onChange={setTargetTemp} active={acOn} />
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button
            onClick={() => setAcOn(!acOn)}
            className="btn"
            style={{
              flex: 1,
              background: acOn ? "var(--accent)" : "var(--surface-2)",
              borderColor: acOn ? "var(--accent)" : "var(--line)",
              color: acOn ? "white" : "var(--text)",
            }}
          >{acOn ? "Climate ON" : "Start climate"}</button>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Remote start</div>
        <button
          onMouseDown={beginHold}
          onMouseUp={endHold}
          onMouseLeave={endHold}
          onTouchStart={(e) => { e.preventDefault(); beginHold(); }}
          onTouchEnd={endHold}
          onTouchCancel={endHold}
          style={{
            position: "relative",
            width: "100%", aspectRatio: "1.4 / 1",
            background: started ? "var(--ok-soft)" : "var(--surface-2)",
            borderRadius: "var(--r-lg)",
            border: "1px solid",
            borderColor: started ? "color-mix(in oklch, var(--ok) 32%, transparent)" : "var(--line)",
            color: started ? "var(--ok)" : "var(--text)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            cursor: "pointer", overflow: "hidden",
            transition: "background 240ms var(--easing), border-color 240ms var(--easing), color 240ms var(--easing)",
          }}
        >
          <span style={{
            position: "absolute", left: 0, bottom: 0, width: "100%",
            height: `${holdPct * 100}%`,
            background: "var(--accent-soft)",
            transition: holdPct === 0 ? "height 200ms var(--easing)" : "none",
            pointerEvents: "none",
          }} />
          <span style={{ position: "relative", color: started ? "var(--ok)" : "var(--text-muted)" }}>
            <Icon name={started ? "stop" : "play"} size={36} />
          </span>
          <span className="display" style={{ position: "relative", fontSize: 22 }}>
            {started ? "Engine running" : "Start engine"}
          </span>
          <span className="mono" style={{ position: "relative", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {started ? "Tap to stop" : "Hold to confirm"}
          </span>
        </button>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="label" style={{ marginBottom: 14 }}>Find my car</div>
        <MapPlaceholder
          height={260}
          pins={[{ id: "me", x: car.coords.x, y: car.coords.y, sev: "info", label: car.lastLocation }]}
          focusId="me"
          label={"last seen · " + car.lastUpdated}
        />
      </div>
    </div>
  );
};

Object.assign(window, { DriverHome, DriverTrips, DriverScore, DriverHealth, DriverControls });
