// Road-network follower for the sim engine.
//
// Loads the CARLA road network (data/town_roads.json, produced by
// carla/08_dashboard_map/export_town_map.py) and makes synthetic vehicles FOLLOW it
// instead of free-roaming: place/snap a car onto the network, then advance it along
// the polylines, choosing a random outgoing road at each junction.
//
// Everything here is in 0..1 screen-space — the SAME frame engine.js uses for v.x/v.y
// and world.js toScreen()/fromScreen(). So a car that follows a road here renders on
// that road on the dashboard map. If the asset is missing, ready() is false and the
// engine falls back to its legacy walk.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data", "town_roads.json");
const JUNC_TOL = 0.012;          // screen units (~3 m on Town10HD): endpoints this close share a junction

let ROADS = [];                   // [[ [x,y], ... ], ...] in 0..1
let ENDPOINTS = [];               // { road, idx, x, y } — polyline ends, for junction matching
let isReady = false;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const vb = raw.viewBox || 100;
    ROADS = (raw.roads || [])
      .map((r) => r.map(([x, y]) => [x / vb, y / vb]))
      .filter((r) => r.length >= 2);
    ENDPOINTS = [];
    ROADS.forEach((r, i) => {
      ENDPOINTS.push({ road: i, idx: 0, x: r[0][0], y: r[0][1] });
      ENDPOINTS.push({ road: i, idx: r.length - 1, x: r[r.length - 1][0], y: r[r.length - 1][1] });
    });
    isReady = ROADS.length > 0;
  } catch (e) {
    isReady = false;
  }
  return isReady;
}
load();

const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function posOf(s) {
  const r = ROADS[s.road], a = r[s.seg], b = r[s.seg + 1];
  return { x: a[0] + (b[0] - a[0]) * s.t, y: a[1] + (b[1] - a[1]) * s.t };
}
function headingOf(s) {
  const r = ROADS[s.road], a = r[s.seg], b = r[s.seg + 1];
  return Math.atan2((b[1] - a[1]) * s.dir, (b[0] - a[0]) * s.dir);
}
function finalize(s) {
  const p = posOf(s);
  return { state: s, x: p.x, y: p.y, heading: headingOf(s) };
}

// random position somewhere on the network
function place() {
  const road = Math.floor(Math.random() * ROADS.length);
  const seg = Math.floor(Math.random() * (ROADS[road].length - 1));
  return finalize({ road, seg, t: Math.random(), dir: Math.random() < 0.5 ? 1 : -1 });
}

// nearest point on the whole network to (x,y) → a path state there
function snap(x, y) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < ROADS.length; i++) {
    const r = ROADS[i];
    for (let j = 0; j < r.length - 1; j++) {
      const ax = r[j][0], ay = r[j][1], dx = r[j + 1][0] - ax, dy = r[j + 1][1] - ay;
      const len2 = dx * dx + dy * dy || 1e-9;
      let t = ((x - ax) * dx + (y - ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = dist2(x, y, ax + dx * t, ay + dy * t);
      if (d < bestD) { bestD = d; best = { road: i, seg: j, t, dir: Math.random() < 0.5 ? 1 : -1 }; }
    }
  }
  return best ? finalize(best) : null;
}

// at a polyline end (vertex atIdx of `road`), pick a connected polyline to continue on
function junction(road, atIdx) {
  const px = ROADS[road][atIdx][0], py = ROADS[road][atIdx][1], tol2 = JUNC_TOL * JUNC_TOL;
  const cand = [];
  for (const e of ENDPOINTS) {
    if (e.road === road) continue;                 // leave via a different polyline
    if (dist2(px, py, e.x, e.y) <= tol2) cand.push(e);
  }
  if (cand.length === 0) return null;
  const e = cand[Math.floor(Math.random() * cand.length)];
  return e.idx === 0
    ? { road: e.road, seg: 0, t: 0, dir: 1 }                          // enter from its start
    : { road: e.road, seg: ROADS[e.road].length - 2, t: 1, dir: -1 }; // enter from its end
}

// advance a path state by ds (screen units), following the network
function advance(s, ds) {
  let guard = 0;
  while (ds > 1e-9 && guard++ < 64) {
    const r = ROADS[s.road], a = r[s.seg], b = r[s.seg + 1];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    const remDist = (s.dir > 0 ? 1 - s.t : s.t) * segLen;             // distance left in this segment
    if (ds < remDist) { s.t += s.dir * (ds / segLen); ds = 0; break; }
    ds -= remDist;
    if (s.dir > 0) {
      if (s.seg < r.length - 2) { s.seg++; s.t = 0; }
      else { const nx = junction(s.road, r.length - 1); if (nx) Object.assign(s, nx); else { s.dir = -1; s.t = 1; } }
    } else {
      if (s.seg > 0) { s.seg--; s.t = 1; }
      else { const nx = junction(s.road, 0); if (nx) Object.assign(s, nx); else { s.dir = 1; s.t = 0; } }
    }
  }
  return finalize(s);
}

module.exports = { ready: () => isReady, place, snap, advance, count: () => ROADS.length };
