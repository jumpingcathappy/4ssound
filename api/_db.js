const { createClient } = require("@libsql/client");

let client = null;
let initPromise = null;

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function ensureSchema() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = getClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'escalated',
        created_at INTEGER NOT NULL,
        acknowledged_at INTEGER,
        raw_payload TEXT,
        decoded_data TEXT,
        alert_message_en TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)
    `);
  })();
  return initPromise;
}

module.exports = { getClient, ensureSchema };
