const { handleOptions, verifyToken } = require("./_lib");
const { getClient, ensureSchema } = require("./_db");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await ensureSchema();
    const db = getClient();

    const { alertId, acknowledgeAll } = req.body || {};
    const now = Date.now();

    if (acknowledgeAll) {
      const result = await db.execute({
        sql: "UPDATE alerts SET status = 'acknowledged', acknowledged_at = ? WHERE status = 'escalated'",
        args: [now],
      });
      return res.status(200).json({
        success: true,
        acknowledged: result.rowsAffected || 0,
      });
    }

    if (!alertId) {
      return res.status(400).json({ error: "Missing alertId" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM alerts WHERE id = ?",
      args: [alertId],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }

    await db.execute({
      sql: "UPDATE alerts SET status = 'acknowledged', acknowledged_at = ? WHERE id = ? AND status = 'escalated'",
      args: [now, alertId],
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Acknowledge error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
