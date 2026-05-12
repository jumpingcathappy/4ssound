const { createClient } = require("@libsql/client");

async function ensureSchema(url, authToken) {
  const db = createClient({ url, authToken });
  try {
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
  } finally {
    db.close();
  }
}

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set. Please add it in Vercel environment variables and redeploy.");
  }
  return createClient({ url, authToken });
}

module.exports = { getDb, ensureSchema };
