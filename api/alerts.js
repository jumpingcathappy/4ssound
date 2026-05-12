const { handleOptions, verifyToken } = require("./_lib");
const { getDb } = require("./_db");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getDb();

    // Clean up acknowledged alerts older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await db.execute({
      sql: "DELETE FROM alerts WHERE status = 'acknowledged' AND acknowledged_at < ?",
      args: [cutoff],
    });

    // Fetch active (escalated) alerts
    const activeResult = await db.execute({
      sql: "SELECT * FROM alerts WHERE status = 'escalated' ORDER BY created_at DESC",
      args: [],
    });

    // Fetch recent acknowledged alerts
    const historyResult = await db.execute({
      sql: "SELECT * FROM alerts WHERE status = 'acknowledged' ORDER BY acknowledged_at DESC",
      args: [],
    });

    const formatAlert = (row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      rawPayload: JSON.parse(row.raw_payload || "{}"),
      decodedData: JSON.parse(row.decoded_data || "{}"),
      alertMessageEN: row.alert_message_en,
    });

    const activeAlerts = activeResult.rows.map(formatAlert);
    const historyAlerts = historyResult.rows.map(formatAlert);

    return res.status(200).json({
      active: activeAlerts,
      history: historyAlerts,
      activeCount: activeAlerts.length,
    });
  } catch (err) {
    console.error("Alerts error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
