// SQLite connection. Opens (and lazily initializes) sentry.db.
// One handle shared process-wide; the ingest/seed path is the only writer.
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.SENTRY_DB || path.join(__dirname, "..", "data", "sentry.db");
const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Apply the schema once (no-op if the core table already exists).
const initialized = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles'")
  .get();
if (!initialized) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

module.exports = db;
