// Fleet view — operations / mission control feel: dense, multi-pane, map-forward

const FleetOverview = ({ vehicles, onSelectVehicle }) => {
  const counts = React.useMemo(() => {
    const c = { active: 0, idle: 0, offline: 0 };
    vehicles.forEach(v => c[v.status]++);
    return c;
  }, [vehicles]);

  const trips = vehicles.length * 4 + 12;
  const incidents = vehicles.reduce((a, v) => a + v.incidents, 0);
  const fleetScore = Math.round(vehicles.reduce((a, v) => a + v.score, 0) / vehicles.length);
  const [focusId, setFocusId] = React.useState(null);

  const pins = vehicles.slice(0, 60).map(v => ({
    id: v.id,
    x: v.coords.x, y: v.coords.y,
    sev: v.status === "offline" ? "crit" : v.incidents > 1 ? "warn" : v.status === "idle" ? "idle" : "ok",
    label: `${v.id} · ${v.driver}`,
    raw: v,
  }));

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "var(--gap)" }}>
      {/* KPI strip */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="card" style={{ background: "var(--surface-2)" }}>
          <div className="stat-label">Fleet status</div>
          <div className="display tnum" style={{ fontSize: 44, lineHeight: 1 }}>{vehicles.length}</div>
          <div className="row" style={{ marginTop: 12, gap: 14, fontSize: 11 }}>
            <span className="row" style={{ gap: 6 }}><span className="sev-dot ok" /> <span className="mono">{counts.active} active</span></span>
            <span className="row" style={{ gap: 6 }}><span className="sev-dot idle" /> <span className="mono">{counts.idle} idle</span></span>
            <span className="row" style={{ gap: 6 }}><span className="sev-dot crit" /> <span className="mono">{counts.offline} offline</span></span>
          </div>
        </div>
        <StatCard label="Trips today" value={trips} icon="route" sub="vs 612 yesterday" trend={{ dir: "up", label: "+4.2%" }} />
        <StatCard label="ADAS incidents · today" value={incidents} icon="alert" sub="3 critical" />
        <StatCard label="Fleet safety score" value={fleetScore} icon="shield" trend={{ dir: fleetScore >= 85 ? "up" : "down", label: fleetScore >= 85 ? "Healthy" : "Watch" }} />
        <StatCard label="Open alerts" value={FLEET_ALERTS.length} icon="bell" sub={`${FLEET_ALERTS.filter(a=>a.sev==="crit").length} critical`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: "var(--gap)" }}>
        {/* Live map */}
        <div className="card card-flush">
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="label">Live fleet map</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>SHOWING {Math.min(60, vehicles.length)} OF {vehicles.length}</span>
            </div>
            <div className="row" style={{ gap: 6, fontSize: 11 }}>
              <span className="badge"><span className="sev-dot ok" />Active</span>
              <span className="badge"><span className="sev-dot warn" />Incident</span>
              <span className="badge"><span className="sev-dot crit" />Offline</span>
              <span className="badge"><span className="sev-dot idle" />Idle</span>
            </div>
          </div>
          <div style={{ padding: 0 }}>
            <MapPlaceholder
              height={460}
              pins={pins}
              focusId={focusId}
              onPinClick={(p) => setFocusId(p.id === focusId ? null : p.id)}
              label="bay area · live · simulated"
            />
          </div>
          {focusId && (
            <div className="row" style={{ padding: "12px 18px", borderTop: "1px solid var(--line)", justifyContent: "space-between", background: "var(--surface-2)" }}>
              {(() => {
                const v = vehicles.find(x => x.id === focusId);
                if (!v) return null;
                return (
                  <>
                    <div className="row" style={{ gap: 14 }}>
                      <span className={`sev-dot ${v.status === "offline" ? "crit" : v.status === "idle" ? "idle" : "ok"}`} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{v.id} · {v.make} {v.model}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.driver} · {v.location}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 14 }}>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Score <span style={{ color: "var(--text)" }}>{v.score}</span></span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.speed > 0 ? `${v.speed} km/h` : "stopped"}</span>
                      <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onSelectVehicle(v.id)}>
                        Open <Icon name="chevron-right" size={12} />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Live alerts feed */}
        <div className="card card-flush" style={{ display: "flex", flexDirection: "column" }}>
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
            <span className="label">Live alerts</span>
            <span className="row" style={{ gap: 6 }}>
              <span className="sev-dot crit" style={{ animation: "pulse 1.6s var(--easing) infinite" }} />
              <span className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Streaming</span>
            </span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 460 }}>
            {FLEET_ALERTS.map(a => <AlertRow key={a.id} alert={a} compact onClick={() => a.vehicle && onSelectVehicle(a.vehicle)} />)}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 3px var(--crit-soft); }
          50% { box-shadow: 0 0 0 6px color-mix(in oklch, var(--crit) 18%, transparent); }
        }
      `}</style>
    </div>
  );
};

// ─── FLEET · VEHICLE LIST ──────────────────────────────────────────
const FleetVehicles = ({ vehicles, onSelectVehicle }) => {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [scoreFilter, setScoreFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    return vehicles.filter(v => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (scoreFilter === "low" && v.score >= 80) return false;
      if (scoreFilter === "mid" && (v.score < 80 || v.score >= 90)) return false;
      if (scoreFilter === "high" && v.score < 90) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!v.id.toLowerCase().includes(q) &&
            !v.driver.toLowerCase().includes(q) &&
            !v.model.toLowerCase().includes(q) &&
            !v.location.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, query, statusFilter, scoreFilter]);

  const FilterChip = ({ value, setValue, options, label }) => (
    <div className="row" style={{ gap: 4, padding: 3, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 999 }}>
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => setValue(o.v)}
          style={{
            padding: "5px 12px", borderRadius: 999, fontSize: 11,
            background: value === o.v ? "var(--text)" : "transparent",
            color: value === o.v ? "var(--bg)" : "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            transition: "all 140ms var(--easing)",
          }}
        >{o.l}</button>
      ))}
    </div>
  );

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "var(--gap)" }}>
      <div className="card card-flush">
        <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", gap: 12, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, flex: 1, minWidth: 240, padding: "6px 12px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
            <Icon name="search" size={14} style={{ color: "var(--text-muted)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ID, driver, model, location…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 13 }}
            />
            {query && <button className="btn-ghost" onClick={() => setQuery("")}><Icon name="x" size={12} /></button>}
          </div>
          <FilterChip
            value={statusFilter}
            setValue={setStatusFilter}
            options={[{ v: "all", l: "All" }, { v: "active", l: "Active" }, { v: "idle", l: "Idle" }, { v: "offline", l: "Offline" }]}
          />
          <FilterChip
            value={scoreFilter}
            setValue={setScoreFilter}
            options={[{ v: "all", l: "Any score" }, { v: "low", l: "<80" }, { v: "mid", l: "80–89" }, { v: "high", l: "≥90" }]}
          />
          <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {filtered.length} <span style={{ color: "var(--text-dim)" }}>/ {vehicles.length}</span>
          </span>
        </div>

        <div style={{ maxHeight: "65vh", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
              <tr>
                {["Vehicle", "Driver", "Status", "Location", "Energy", "Safety", "Last activity", ""].map(h => (
                  <th key={h} className="mono" style={{
                    fontWeight: 400, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "var(--text-muted)",
                    textAlign: "left", padding: "12px 18px", borderBottom: "1px solid var(--line)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map((v, i) => (
                <tr key={v.id}
                  onClick={() => onSelectVehicle(v.id)}
                  style={{ borderBottom: "1px solid var(--line)", cursor: "pointer", transition: "background 140ms" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 18px" }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{v.id}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.make} {v.model} · {v.type.toUpperCase()}</div>
                  </td>
                  <td style={{ padding: "12px 18px" }}>{v.driver}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className={`sev-dot ${v.status === "offline" ? "crit" : v.status === "idle" ? "idle" : "ok"}`} />
                      <span style={{ textTransform: "capitalize", fontSize: 12 }}>{v.status}</span>
                    </span>
                  </td>
                  <td className="mono" style={{ padding: "12px 18px", fontSize: 12, color: "var(--text-muted)" }}>{v.location}</td>
                  <td style={{ padding: "12px 18px" }}>
                    {v.type === "ev" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="battery" size={12} style={{ color: "var(--text-muted)" }} />
                        <span className="mono tnum" style={{ fontSize: 12 }}>{v.battery}%</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="fuel" size={12} style={{ color: "var(--text-muted)" }} />
                        <span className="mono tnum" style={{ fontSize: 12 }}>{v.fuel}%</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="mono tnum" style={{ fontSize: 13, color: v.score < 75 ? "var(--warn)" : "var(--text)" }}>{v.score}</span>
                      <div style={{ width: 50 }}>
                        <HBar value={v.score} color={v.score >= 90 ? "var(--ok)" : v.score >= 80 ? "var(--accent)" : v.score >= 70 ? "var(--warn)" : "var(--crit)"} />
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ padding: "12px 18px", fontSize: 11, color: "var(--text-muted)" }}>{v.lastActivity}</td>
                  <td style={{ padding: "12px 18px", textAlign: "right" }}>
                    <Icon name="chevron-right" size={14} style={{ color: "var(--text-dim)" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
              <Icon name="search" size={20} />
              <div style={{ marginTop: 10, fontSize: 13 }}>No vehicles match these filters</div>
            </div>
          )}
          {filtered.length > 40 && (
            <div className="mono" style={{ padding: "14px 18px", fontSize: 11, color: "var(--text-dim)", textAlign: "center", borderTop: "1px solid var(--line)" }}>
              Showing 40 of {filtered.length} · scroll or refine filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── FLEET · ALERTS ────────────────────────────────────────────────
const FleetAlerts = ({ onSelectVehicle }) => {
  const [filter, setFilter] = React.useState("all");
  const filtered = filter === "all" ? FLEET_ALERTS : FLEET_ALERTS.filter(a => a.sev === filter);
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "var(--gap)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard label="Critical" value={FLEET_ALERTS.filter(a => a.sev === "crit").length} icon="alert" />
        <StatCard label="Warning" value={FLEET_ALERTS.filter(a => a.sev === "warn").length} icon="bell" />
        <StatCard label="Info" value={FLEET_ALERTS.filter(a => a.sev === "info").length} icon="broadcast" />
        <StatCard label="Avg response time" value="4.2" unit="min" sub="rolling 24h" />
      </div>
      <div className="card card-flush">
        <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", gap: 12 }}>
          <span className="label">Triage queue</span>
          <div className="row" style={{ gap: 4, marginLeft: "auto", padding: 3, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 999 }}>
            {[
              { v: "all", l: "All" }, { v: "crit", l: "Critical" },
              { v: "warn", l: "Warning" }, { v: "info", l: "Info" }
            ].map(o => (
              <button
                key={o.v}
                onClick={() => setFilter(o.v)}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 11,
                  background: filter === o.v ? "var(--text)" : "transparent",
                  color: filter === o.v ? "var(--bg)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}>{o.l}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(a => <AlertRow key={a.id} alert={a} onClick={() => a.vehicle && onSelectVehicle(a.vehicle)} />)}
        </div>
      </div>
    </div>
  );
};

// ─── FLEET · SINGLE VEHICLE DRILLDOWN ──────────────────────────────
const FleetVehicleDetail = ({ vehicle, onBack }) => {
  if (!vehicle) return null;
  const v = vehicle;
  const fakeTrips = TRIPS.map(t => ({ ...t, score: Math.max(60, t.score - 5 + Math.floor(Math.random() * 8)) }));
  const energy = v.type === "ev" ? v.battery : v.fuel;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "var(--gap)" }}>
      <div className="row" style={{ gap: 10, marginBottom: 4 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: "6px 10px", fontSize: 12 }}>
          <Icon name="chevron-left" size={12} /> Back to fleet
        </button>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>READ-ONLY · NO REMOTE CONTROL</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr" }}>
          <div style={{ padding: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{v.id} · {v.type.toUpperCase()}</div>
            <h2 className="display" style={{ fontSize: 36, lineHeight: 1, margin: 0, letterSpacing: "-0.02em" }}>
              {v.make} {v.model}
            </h2>
            <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              <span className={`sev-dot ${v.status === "offline" ? "crit" : v.status === "idle" ? "idle" : "ok"}`} style={{ marginRight: 8, verticalAlign: "middle" }} />
              {v.status.toUpperCase()} · {v.location.toUpperCase()} · UPDATED {v.lastActivity.toUpperCase()}
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 18 }}>
              <div>
                <div className="stat-label">Driver</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{v.driver}</div>
              </div>
              <div>
                <div className="stat-label">Safety score</div>
                <div className="display tnum" style={{ fontSize: 28 }}>{v.score}</div>
              </div>
              <div>
                <div className="stat-label">{v.type === "ev" ? "Battery" : "Fuel"}</div>
                <div className="display tnum" style={{ fontSize: 28 }}>{energy}<span className="unit" style={{ fontSize: 12, marginLeft: 4 }}>%</span></div>
              </div>
              <div>
                <div className="stat-label">Speed</div>
                <div className="display tnum" style={{ fontSize: 28 }}>{v.speed}<span className="unit" style={{ fontSize: 12, marginLeft: 4 }}>km/h</span></div>
              </div>
            </div>
          </div>
          <div style={{ background: "var(--surface-2)", borderLeft: "1px solid var(--line)", padding: 0 }}>
            <MapPlaceholder
              height="100%"
              pins={[{ id: v.id, x: v.coords.x, y: v.coords.y, sev: v.status === "offline" ? "crit" : "ok", label: v.id }]}
              focusId={v.id}
              label="live position"
            />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)" }}>
        <div className="card card-flush">
          <div className="label" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>Recent trips</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {fakeTrips.slice(0, 5).map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{t.from} → {t.to}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.date} {t.time} · {t.km} km · {t.dur}</div>
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "right" }}>
                    {t.events === 0 ? <span className="badge ok">Clean</span> : <span className="badge warn">{t.events} events</span>}
                  </td>
                  <td className="mono tnum" style={{ padding: "12px 18px", textAlign: "right" }}>{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>ADAS events · 7d</div>
          <div className="col" style={{ gap: 14 }}>
            {[
              { k: "Hard braking", v: 3 + (v.incidents % 3), max: 10, color: "warn" },
              { k: "Lane departure", v: 5 + (v.incidents % 4), max: 10, color: "warn" },
              { k: "Following too close", v: 2, max: 10, color: "ok" },
              { k: "Speeding", v: v.incidents, max: 10, color: v.incidents > 2 ? "crit" : "ok" },
              { k: "Forward-collision warning", v: v.incidents > 2 ? 1 : 0, max: 10, color: "crit" },
            ].map(b => (
              <div key={b.k}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>{b.k}</span>
                  <span className="mono tnum" style={{ fontSize: 12 }}>{b.v}</span>
                </div>
                <HBar value={b.v} max={b.max} color={`var(--${b.color})`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>Vehicle health · read-only</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[
            { s: "Drivetrain", ok: true },
            { s: "Battery pack", ok: v.score > 70 },
            { s: "Cooling", ok: true },
            { s: "Brakes", ok: v.incidents < 3 },
            { s: "ADAS sensors", ok: v.status !== "offline" },
            { s: "Connectivity", ok: v.status !== "offline" },
          ].map(item => (
            <div key={item.s} style={{ padding: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
              <div className="row" style={{ gap: 8 }}>
                <span className={`sev-dot ${item.ok ? "ok" : "warn"}`} />
                <span style={{ fontSize: 12 }}>{item.s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { FleetOverview, FleetVehicles, FleetAlerts, FleetVehicleDetail });
