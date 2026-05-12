const { handleOptions, verifyToken } = require("./_lib");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { kv } = await import("@vercel/kv");

    const activeIds = (await kv.lrange("active_alert_ids", 0, -1)) || [];
    const historyIds = (await kv.lrange("history_alert_ids", 0, -1)) || [];

    const activeAlerts = [];
    for (const id of activeIds) {
      const alert = await kv.get(`alert:${id}`);
      if (alert) activeAlerts.push(alert);
    }

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const historyAlerts = [];
    const expiredIds = [];
    for (const id of historyIds) {
      const alert = await kv.get(`alert:${id}`);
      if (alert) {
        if (alert.acknowledgedAt && alert.acknowledgedAt < cutoff) {
          expiredIds.push(id);
        } else {
          historyAlerts.push(alert);
        }
      }
    }

    for (const id of expiredIds) {
      await kv.del(`alert:${id}`);
      await kv.lrem("history_alert_ids", 0, id);
    }

    activeAlerts.sort((a, b) => b.createdAt - a.createdAt);
    historyAlerts.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      active: activeAlerts,
      history: historyAlerts,
      activeCount: activeAlerts.length,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};
