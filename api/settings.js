const { handleOptions, verifyToken } = require("./_lib");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (!verifyToken(req.headers["authorization"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { kv } = await import("@vercel/kv");

    if (req.method === "GET") {
      const settings = (await kv.get("settings")) || {
        systemLinkBaseUrl: "https://ssss.emsd.gov.hk/organizations/54125d20-37dc-46cb-a0cb-5abf841d033a/notification-centre",
        selectedSound: "pulse-alarm",
        customSoundUrl: null,
      };
      return res.status(200).json(settings);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const current = (await kv.get("settings")) || {};
      const updated = { ...current, ...body };
      await kv.set("settings", updated);
      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};
