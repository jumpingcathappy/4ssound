const { handleOptions, verifyToken } = require("./_lib");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { kv } = await import("@vercel/kv");
    const { alertId, acknowledgeAll } = req.body || {};

    if (acknowledgeAll) {
      const activeIds = (await kv.lrange("active_alert_ids", 0, -1)) || [];
      for (const id of activeIds) {
        const alert = await kv.get(`alert:${id}`);
        if (alert) {
          alert.status = "acknowledged";
          alert.acknowledgedAt = Date.now();
          await kv.set(`alert:${id}`, alert);
          await kv.lpush("history_alert_ids", id);
        }
      }
      if (activeIds.length > 0) {
        await kv.del("active_alert_ids");
      }
      return res.status(200).json({ success: true, acknowledged: activeIds.length });
    }

    if (!alertId) {
      return res.status(400).json({ error: "Missing alertId" });
    }

    const alert = await kv.get(`alert:${alertId}`);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    alert.status = "acknowledged";
    alert.acknowledgedAt = Date.now();
    await kv.set(`alert:${alertId}`, alert);
    await kv.lrem("active_alert_ids", 0, alertId);
    await kv.lpush("history_alert_ids", alertId);

    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};
