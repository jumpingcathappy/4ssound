const { handleOptions, verifyToken } = require("./_lib");
const { getClient, ensureSchema } = require("./_db");

const DEFAULTS = {
  systemLinkBaseUrl: "https://ssss.emsd.gov.hk/organizations/54125d20-37dc-46cb-a0cb-5abf841d033a/notification-centre",
  selectedSound: "pulse-alarm",
  customSoundUrl: null,
};

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await ensureSchema();
    const db = getClient();

    if (req.method === "GET") {
      const result = await db.execute({
        sql: "SELECT key, value FROM settings",
        args: [],
      });
      const settings = { ...DEFAULTS };
      for (const row of result.rows) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
      return res.status(200).json(settings);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      for (const [key, value] of Object.entries(body)) {
        await db.execute({
          sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          args: [key, JSON.stringify(value)],
        });
      }
      // Return merged settings
      const result = await db.execute({
        sql: "SELECT key, value FROM settings",
        args: [],
      });
      const settings = { ...DEFAULTS };
      for (const row of result.rows) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
      return res.status(200).json(settings);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Settings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
