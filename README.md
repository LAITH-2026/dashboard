# Sentry · ADAS Dashboard

A clickable prototype of an ADAS fleet-management dashboard with two views:

- **Driver** — companion app: vehicle status, remote controls (lock, A/C dial, hold-to-start), trips, driving score, vehicle health.
- **Fleet** — operations view: KPI strip, live map, alerts feed, filterable vehicle table, single-vehicle drilldown.

A floating Tweaks panel lets you switch theme (light/dark), accent color, density, and fleet size (10 / 50 / 200).

## Layout

```
dashboard/
├── frontend/   # static site (React + Babel via CDN, no build step) → GitHub Pages
└── backend/    # Node + Express API
```

## Frontend

Plain HTML + CSS + React 18 (loaded via CDN), JSX transpiled in-browser by Babel Standalone. No build step.

```bash
cd frontend
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Files:

- `index.html` — entry; loads React, Babel, fonts, `config.js`, then the JSX modules in order
- `config.js` — sets `window.API_BASE` (localhost in dev; deployed API URL in prod)
- `styles.css` — design tokens (light/dark, density), components, layout shell
- `icons.jsx` — inline-SVG icon set
- `data.jsx` — mock fleet, trips, alerts, driving score (units: km, °C, kPa)
- `shell.jsx` — `TopBar`, `Sidebar`, `PageHead`, `StatCard`, `MapPlaceholder`, `Sparkline`, `HBar`, `AlertRow`
- `driver.jsx` — Driver views (Home, Controls, Trips, Score, Health)
- `fleet.jsx` — Fleet views (Overview, Vehicles, Alerts, Drilldown)
- `tweaks-panel.jsx` — floating tweaks panel
- `app.jsx` — wires it all together

> The frontend still renders from the mock data in `data.jsx`. The backend below serves the
> same shapes — wiring `fetch()` calls is the next step, so the live site keeps working until then.

## Backend

Node + Express API that serves the same data shapes the frontend uses.

```bash
cd backend
npm install
npm run dev      # node --watch, restarts on change (or: npm start)
```

Listens on `http://localhost:4000`. Config via env (see `.env.example`): `PORT`, `CORS_ORIGIN`.

### Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Liveness check |
| GET | `/api/vehicles` | Fleet list; filters: `?status=active\|idle\|offline`, `?type=ev\|ice`, `?search=` |
| GET | `/api/vehicles/:id` | Single vehicle (e.g. `V-1042`) |
| GET | `/api/fleet/alerts` | Fleet-wide alerts |
| GET | `/api/driver/car` | Driver's primary vehicle |
| GET | `/api/driver/alerts` | Driver alerts |
| GET | `/api/driver/trips` | Recent trips |
| GET | `/api/driver/score` | Driving score breakdown |

## Deploy

- **Frontend → GitHub Pages**, published from `frontend/` by `.github/workflows/pages.yml` on push to `master`.
  **One-time setup:** in **Settings → Pages → Source**, select **GitHub Actions** (not "Deploy from a branch").
- **Backend → any host that runs a server** (Render, Railway, Fly.io, a VPS). GitHub Pages is
  static-only and cannot run the API. After deploying, set the frontend's `config.js` `API_BASE`
  to the backend URL and the backend's `CORS_ORIGIN` to your Pages origin.
