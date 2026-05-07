# Sentry · ADAS Dashboard

A clickable prototype of an ADAS fleet-management dashboard with two views:

- **Driver** — companion app: vehicle status, remote controls (lock, A/C dial, hold-to-start), trips, driving score, vehicle health.
- **Fleet** — operations view: KPI strip, live map, alerts feed, filterable vehicle table, single-vehicle drilldown.

A floating Tweaks panel lets you switch theme (light/dark), accent color, density, and fleet size (10 / 50 / 200).

## Stack

Plain HTML + CSS + React 18 (loaded via CDN), JSX transpiled in-browser by Babel Standalone. No build step.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Files

- `index.html` — entry; loads React, Babel, fonts, then the JSX modules in order
- `styles.css` — design tokens (light/dark, density), components, layout shell
- `icons.jsx` — inline-SVG icon set
- `data.jsx` — mock fleet, trips, alerts, driving score (units: km, °C, kPa)
- `shell.jsx` — `TopBar`, `Sidebar`, `PageHead`, `StatCard`, `MapPlaceholder`, `Sparkline`, `HBar`, `AlertRow`
- `driver.jsx` — Driver views (Home, Controls, Trips, Score, Health)
- `fleet.jsx` — Fleet views (Overview, Vehicles, Alerts, Drilldown)
- `tweaks-panel.jsx` — floating tweaks panel
- `app.jsx` — wires it all together

## Deploy

The site is fully static — host the directory on any static host (GitHub Pages, Netlify, Vercel, etc.).
