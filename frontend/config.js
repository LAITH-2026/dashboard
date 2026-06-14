// API base URL for backend calls (plain JS — loads before the JSX modules).
// Dev: the Express server runs on :4000. Prod: point this at your deployed API.
// Not consumed yet — data.jsx still ships mock data — but ready as `window.API_BASE`.
window.API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:4000"
    : ""; // TODO: set to your deployed backend URL once it's hosted
