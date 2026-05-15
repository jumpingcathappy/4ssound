const { createClient } = require("@libsql/client");

const DB_PATH = process.env.DATABASE_PATH || "file:data/ssss-sound.db";

async function ensureSchema() {
  const db = getDb();
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
    console.log(`Database ready at ${DB_PATH}`);
  } finally {
    db.close();
  }
}

function getDb() {
  return createClient({ url: DB_PATH });
}

module.exports = { getDb, ensureSchema };
