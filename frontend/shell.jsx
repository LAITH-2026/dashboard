// Shared shell components: TopBar, Sidebar, MapPlaceholder, etc.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── TOP BAR ──────────────────────────────────────────────────────────
function TopBar({ view, setView, theme, accent }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark" />
        <span>Sentry · ADAS</span>
      </div>

      <div className="view-tabs" role="tablist" aria-label="Switch experience">
        <button
          role="tab"
          aria-pressed={view === "driver"}
          onClick={() => setView("driver")}
        >
          <Icon name="user" size={13} />
          Driver
        </button>
        <button
          role="tab"
          aria-pressed={view === "fleet"}
          onClick={() => setView("fleet")}
        >
          <Icon name="fleet" size={13} />
          Fleet
        </button>
      </div>

      <div className="topbar-end">
        <button className="btn btn-ghost btn-icon" title="Notifications">
          <Icon name="bell" size={16} />
        </button>
        <div className="avatar">{view === "driver" ? "MC" : "OP"}</div>
      </div>
    </header>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────
function Sidebar({ items, current, onSelect, footerLabel }) {
  return (
    <aside className="sidebar">
      <div className="side-section">{footerLabel}</div>
      {items.map((it) => (
        <button
          key={it.id}
          className="side-link"
          aria-current={current === it.id ? "page" : undefined}
          onClick={() => onSelect(it.id)}
        >
          <Icon name={it.icon} size={16} />
          <span>{it.label}</span>
          {it.badge && (
            <span style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              background: "var(--surface-2)",
              padding: "1px 6px",
              borderRadius: 4,
            }}>{it.badge}</span>
          )}
        </button>
      ))}
      <div style={{ marginTop: "auto" }}>
        <hr className="hairline" style={{ margin: "12px 0" }} />
        <button className="side-link">
          <Icon name="settings" size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

// ─── PAGE HEAD ───────────────────────────────────────────────────────
function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head fade-up">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────
function StatCard({ label, value, unit, sub, trend, icon }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="stat-label">{label}</div>
        {icon && <div style={{ color: "var(--text-dim)" }}><Icon name={icon} size={16} /></div>}
      </div>
      <div className="stat-value">
        <span className="display tnum">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {(sub || trend) && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          {trend && (
            <span className={`trend ${trend.dir}`}>
              <Icon name={trend.dir === "up" ? "trending" : "trending-down"} size={12} />
              {trend.label}
            </span>
          )}
          {sub && <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ─── MAP ─────────────────────────────────────────────────────────────
function MapPlaceholder({ pins = [], height = 320, focusId, onPinClick, label = "live map · simulated" }) {
  // CARLA road network (carla/08_dashboard_map/export_town_map.py → town10hd_map.js).
  // Roads are pre-projected into the 0..100 viewBox with the SAME bounds the backend's
  // world.js toScreen() uses, so they share one coordinate frame with the pins below.
  const townMap = (typeof window !== "undefined" && window.TOWN_MAP) || null;
  return (
    <div className="map" style={{ height, position: "relative" }}>
      {/* Roads: real CARLA road network when town10hd_map.js is loaded, else faux fallback.
          preserveAspectRatio="none" stretches the square map to fill the panel; pins use
          the same per-axis stretch (left/top %), so vehicles stay aligned to the roads. */}
      <svg className="map-roads" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {townMap && Array.isArray(townMap.roads) ? (
          townMap.roads.map((road, i) => (
            <polyline
              key={i}
              points={road.map((p) => `${p[0]},${p[1]}`).join(" ")}
              stroke="var(--line-strong)" strokeWidth="0.5" fill="none"
              strokeLinejoin="round" strokeLinecap="round"
            />
          ))
        ) : (
          <>
            <path d="M-5,20 C20,18 40,28 60,22 C80,16 95,22 105,20" stroke="var(--line-strong)" strokeWidth="0.6" fill="none" />
            <path d="M-5,55 C25,50 45,60 65,55 C85,50 95,55 105,55" stroke="var(--line-strong)" strokeWidth="0.5" fill="none" />
            <path d="M-5,80 C20,76 50,88 70,82 C85,78 95,82 105,80" stroke="var(--line-strong)" strokeWidth="0.5" fill="none" />
            <path d="M20,-5 C18,30 26,55 22,75 C20,95 22,105 22,105" stroke="var(--line-strong)" strokeWidth="0.5" fill="none" />
            <path d="M55,-5 C50,30 58,55 54,75 C52,95 55,105 55,105" stroke="var(--line-strong)" strokeWidth="0.5" fill="none" />
            <path d="M82,-5 C80,30 86,55 84,75 C82,95 84,105 84,105" stroke="var(--line-strong)" strokeWidth="0.5" fill="none" />
          </>
        )}
      </svg>

      {/* Pins */}
      {pins.map((p) => {
        const sevColor = p.sev === "crit" ? "var(--crit)" : p.sev === "warn" ? "var(--warn)" : p.sev === "idle" ? "var(--text-dim)" : "var(--accent)";
        const isFocus = focusId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onPinClick && onPinClick(p)}
            title={p.label}
            style={{
              position: "absolute",
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 1.4s linear, top 1.4s linear",
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: onPinClick ? "pointer" : "default",
              zIndex: isFocus ? 5 : 1,
            }}
          >
            <span style={{
              display: "block",
              width: isFocus ? 14 : 10,
              height: isFocus ? 14 : 10,
              borderRadius: "50%",
              background: sevColor,
              boxShadow: `0 0 0 ${isFocus ? 5 : 3}px color-mix(in oklch, ${sevColor} 25%, transparent), 0 0 0 1px var(--bg)`,
              transition: "all 200ms var(--easing)",
            }} />
            {isFocus && (
              <span className="mono" style={{
                position: "absolute",
                top: 18, left: "50%", transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                background: "var(--surface)",
                border: "1px solid var(--line-strong)",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10,
                color: "var(--text)",
              }}>{p.label}</span>
            )}
          </button>
        );
      })}

      {/* Compass / scale */}
      <div className="mono" style={{
        position: "absolute", bottom: 10, left: 12,
        fontSize: 10, color: "var(--text-dim)",
        letterSpacing: "0.1em", textTransform: "uppercase",
      }}>{label}</div>

      <div style={{
        position: "absolute", top: 10, right: 10,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <button className="btn btn-icon" style={{ padding: 4, minWidth: 26, height: 26 }}><Icon name="plus" size={12} /></button>
        <button className="btn btn-icon" style={{ padding: 4, minWidth: 26, height: 26 }}><Icon name="minus" size={12} /></button>
      </div>
    </div>
  );
}

// ─── SPARKLINE ───────────────────────────────────────────────────────
function Sparkline({ data, width = 200, height = 48, accent = "var(--accent)" }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 8) - 4}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill="url(#sparkfill)" stroke="none" />
      <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - ((v - min) / range) * (height - 8) - 4} r={i === data.length - 1 ? 3 : 0} fill={accent} stroke="var(--surface)" strokeWidth="2" />
      ))}
    </svg>
  );
}

// ─── BARS ────────────────────────────────────────────────────────────
function HBar({ value, max = 100, color = "var(--accent)", height = 4, bg }) {
  return (
    <div style={{
      height, borderRadius: height,
      background: bg || "var(--line)",
      overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.min(100, (value / max) * 100)}%`,
        height: "100%",
        background: color,
        transition: "width 400ms var(--easing)",
      }} />
    </div>
  );
}

// ─── ALERT ROW ──────────────────────────────────────────────────────
function AlertRow({ alert, compact, onClick }) {
  const sev = alert.sev;
  return (
    <button
      className="row"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: compact ? "10px 12px" : "14px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--line)",
        background: "var(--surface-2)",
        gap: 12,
        transition: "all 140ms var(--easing)",
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--line-strong)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: sev === "crit" ? "var(--crit)" : sev === "warn" ? "var(--warn)" : sev === "ok" ? "var(--ok)" : "var(--accent)",
        background: sev === "crit" ? "var(--crit-soft)" : sev === "warn" ? "var(--warn-soft)" : sev === "ok" ? "var(--ok-soft)" : "var(--accent-soft)",
        flexShrink: 0,
      }}>
        <Icon name={alert.icon} size={16} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{alert.title}</span>
          <span className={`badge ${sev}`} style={{ marginLeft: "auto" }}>{sev === "crit" ? "Critical" : sev === "warn" ? "Warning" : sev === "ok" ? "OK" : "Info"}</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {alert.detail}
          {alert.vehicle && <span> · {alert.vehicle} · {alert.driver}</span>}
          <span style={{ color: "var(--text-dim)" }}> · {alert.time}</span>
        </div>
      </div>
    </button>
  );
}

Object.assign(window, {
  TopBar, Sidebar, PageHead, StatCard, MapPlaceholder,
  Sparkline, HBar, AlertRow,
});
