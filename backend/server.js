// Entry point: boot the Express app + the server-side simulation engine.
const { createApp } = require("./src/app");
const engine = require("./src/engine");

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`dashboard-backend listening on http://localhost:${PORT}`);
  engine.start();
  console.log("sim engine started — fleet is server-driven");
});
