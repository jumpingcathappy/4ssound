const { handleOptions, verifyApiKey } = require("./_lib");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyApiKey(req)) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  try {
    const body = req.body || {};
    const { issue_alert_id, message_data, language_template_map } = body;

    if (!issue_alert_id) {
      return res.status(400).json({ error: "Missing issue_alert_id" });
    }

    // Decode base64 message_data
    let decodedData = {};
    try {
      const decoded = Buffer.from(message_data, "base64").toString("utf-8");
      decodedData = JSON.parse(decoded);
    } catch {
      decodedData = { raw: message_data };
    }

    // Render English alert message from template
    let alertMessageEN = "Alert";
    try {
      const templates = language_template_map || {};
      const enKeys = Object.keys(templates).filter(
        (k) => templates[k].language === "en-US" && templates[k].tag === "in-app"
      );
      if (enKeys.length > 0) {
        let template = templates[enKeys[0]].content || "";
        template = template.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, key) => {
          return decodedData[key] || "";
        });
        alertMessageEN = template;
      }
    } catch {
      alertMessageEN = decodedData.device_name
        ? `${decodedData.device_name}: Alert`
        : "Alert";
    }

    // Build alert object
    const alert = {
      id: issue_alert_id,
      status: "escalated",
      createdAt: Date.now(),
      acknowledgedAt: null,
      rawPayload: body,
      decodedData,
      alertMessageEN,
    };

    // Store in Vercel KV
    const { kv } = await import("@vercel/kv");
    await kv.set(`alert:${issue_alert_id}`, alert);
    await kv.lpush("active_alert_ids", issue_alert_id);

    // Fire-and-forget: forward to email API
    const emailEndpoint = process.env.EMAIL_FORWARD_URL;
    if (emailEndpoint) {
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    return res.status(201).json({ success: true, alert_id: issue_alert_id });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};
