// Entry point: boot the Express app.
const { createApp } = require("./src/app");

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`dashboard-backend listening on http://localhost:${PORT}`);
});
