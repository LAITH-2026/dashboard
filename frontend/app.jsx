// Main app — wires everything together

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#3b82f6",
  "density": "balanced",
  "fleetSize": 50
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  "#3b82f6", // blue (default)
  "#10b981", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
];

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme + density + accent to root
  React.useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.style.setProperty("--accent-soft", `color-mix(in oklch, ${tweaks.accent} 12%, transparent)`);
    document.documentElement.style.setProperty("--accent-line", `color-mix(in oklch, ${tweaks.accent} 32%, transparent)`);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  const fleetSlice = React.useMemo(() => ALL_VEHICLES.slice(0, tweaks.fleetSize), [tweaks.fleetSize]);

  // ─── view + section state ───────────────────────────────────────
  const [view, setView] = React.useState("driver");

  // Driver section
  const [driverSection, setDriverSection] = React.useState("home");

  // Fleet section + drilldown
  const [fleetSection, setFleetSection] = React.useState("overview");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState(null);

  // ─── driver vehicle state ───────────────────────────────────────
  const [locked, setLocked] = React.useState(MY_CAR.locked);
  const [acOn, setAcOn] = React.useState(MY_CAR.acOn);
  const [targetTemp, setTargetTemp] = React.useState(MY_CAR.targetTemp);
  const [charging, setCharging] = React.useState(MY_CAR.charging);

  const driverNav = [
    { id: "home", label: "Home", icon: "gauge" },
    { id: "controls", label: "Controls", icon: "broadcast", badge: "5" },
    { id: "trips", label: "Trips", icon: "route" },
    { id: "score", label: "Driving score", icon: "shield" },
    { id: "health", label: "Vehicle health", icon: "wrench", badge: "1" },
  ];

  const fleetNav = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "vehicles", label: "Vehicles", icon: "fleet", badge: String(tweaks.fleetSize) },
    { id: "alerts", label: "Alerts", icon: "bell", badge: String(FLEET_ALERTS.filter(a => a.sev === "crit").length) },
  ];

  const onSelectVehicle = (id) => {
    setSelectedVehicleId(id);
    setFleetSection("detail");
  };
  const onBackFromDetail = () => {
    setSelectedVehicleId(null);
    setFleetSection("overview");
  };

  // ─── render ──────────────────────────────────────────────────────
  const renderDriver = () => {
    if (driverSection === "home") return <DriverHome car={MY_CAR} locked={locked} setLocked={setLocked} acOn={acOn} setAcOn={setAcOn} targetTemp={targetTemp} setTargetTemp={setTargetTemp} charging={charging} setCharging={setCharging} goTo={setDriverSection} />;
    if (driverSection === "controls") return <DriverControls car={MY_CAR} locked={locked} setLocked={setLocked} acOn={acOn} setAcOn={setAcOn} targetTemp={targetTemp} setTargetTemp={setTargetTemp} charging={charging} setCharging={setCharging} />;
    if (driverSection === "trips") return <DriverTrips />;
    if (driverSection === "score") return <DriverScore />;
    if (driverSection === "health") return <DriverHealth car={MY_CAR} />;
  };

  const renderFleet = () => {
    if (fleetSection === "overview") return <FleetOverview vehicles={fleetSlice} onSelectVehicle={onSelectVehicle} />;
    if (fleetSection === "vehicles") return <FleetVehicles vehicles={fleetSlice} onSelectVehicle={onSelectVehicle} />;
    if (fleetSection === "alerts") return <FleetAlerts onSelectVehicle={onSelectVehicle} />;
    if (fleetSection === "detail") {
      const v = fleetSlice.find(x => x.id === selectedVehicleId) || ALL_VEHICLES.find(x => x.id === selectedVehicleId);
      return <FleetVehicleDetail vehicle={v} onBack={onBackFromDetail} />;
    }
  };

  const driverHeads = {
    home: { eyebrow: "Companion", title: "Hi, Hussien", sub: "Tuesday · May 6 · 9:14 AM" },
    controls: { eyebrow: "Remote", title: "Controls", sub: "Aero GT-7 · 8DLR-294" },
    trips: { eyebrow: "History", title: "Trips", sub: "Last 30 days · 14 trips · 143.9 km" },
    score: { eyebrow: "Telemetry", title: "Driving score", sub: "Rolling 7 days · top 18%" },
    health: { eyebrow: "Diagnostics", title: "Vehicle health", sub: "1 attention · 0 critical" },
  };
  const fleetHeads = {
    overview: { eyebrow: "Operations", title: "Fleet overview", sub: `${tweaks.fleetSize} vehicles · live · Bay Area dispatch` },
    vehicles: { eyebrow: "Inventory", title: "Vehicles", sub: `${tweaks.fleetSize} total · drill in for read-only details` },
    alerts: { eyebrow: "Safety", title: "Alerts triage", sub: "Streaming · acknowledge or dispatch" },
    detail: { eyebrow: "Drilldown · read-only", title: "Vehicle detail", sub: "Driver-mirror without controls" },
  };

  const head = view === "driver" ? driverHeads[driverSection] : fleetHeads[fleetSection];

  return (
    <div className="app">
      <TopBar view={view} setView={setView} theme={tweaks.theme} accent={tweaks.accent} />
      <div className="shell">
        {view === "driver" ? (
          <Sidebar
            items={driverNav}
            current={driverSection}
            onSelect={setDriverSection}
            footerLabel="Driver"
          />
        ) : (
          <Sidebar
            items={fleetNav}
            current={fleetSection === "detail" ? "vehicles" : fleetSection}
            onSelect={(id) => { setFleetSection(id); setSelectedVehicleId(null); }}
            footerLabel="Fleet ops"
          />
        )}
        <main className="main" key={view + "-" + (view === "driver" ? driverSection : fleetSection + "-" + (selectedVehicleId || ""))}>
          <PageHead {...head} actions={
            view === "fleet" && fleetSection !== "detail" ? (
              <>
                <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }}><Icon name="download" size={12} /> Export</button>
                <button className="btn" style={{ padding: "8px 12px", fontSize: 12 }}><Icon name="filter" size={12} /> Filters</button>
              </>
            ) : view === "driver" && driverSection === "home" ? (
              <span className="badge"><span className="sev-dot ok" />Connected · 5G</span>
            ) : null
          } />
          <div className="fade-up">
            {view === "driver" ? renderDriver() : renderFleet()}
          </div>
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
          />
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={ACCENT_OPTIONS}
          />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "dense", label: "Dense" },
              { value: "balanced", label: "Balanced" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
        </TweakSection>
        <TweakSection title="Fleet">
          <TweakRadio
            label="Fleet size"
            value={tweaks.fleetSize}
            onChange={(v) => setTweak("fleetSize", v)}
            options={[
              { value: 10, label: "10" },
              { value: 50, label: "50" },
              { value: 200, label: "200" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
