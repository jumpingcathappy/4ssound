const { handleOptions } = require("./_lib");
const { getDb, ensureSchema } = require("./_db");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // API key check disabled for now — will re-enable later
  // const { verifyApiKey } = require("./_lib");
  // if (!verifyApiKey(req)) {
  //   return res.status(401).json({ error: "Invalid API key" });
  // }

  try {
    const db = getDb();

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

    // Insert alert into database
    await db.execute({
      sql: `INSERT OR REPLACE INTO alerts (id, status, created_at, acknowledged_at, raw_payload, decoded_data, alert_message_en)
            VALUES (?, 'escalated', ?, NULL, ?, ?, ?)`,
      args: [
        issue_alert_id,
        Date.now(),
        JSON.stringify(body),
        JSON.stringify(decodedData),
        alertMessageEN,
      ],
    });

    // Forward to email API — log result
    const emailEndpoint = process.env.EMAIL_FORWARD_URL;
    if (emailEndpoint) {
      try {
        const emailRes = await fetch(emailEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        console.log(`Email forward: status=${emailRes.status} url=${emailRes.url}`);
        const emailBody = await emailRes.text();
        console.log(`Email forward response: ${emailBody.substring(0, 500)}`);
      } catch (err) {
        console.error(`Email forward failed: ${err.message}`);
      }
    } else {
      console.log("Email forward skipped: EMAIL_FORWARD_URL not set");
    }

    return res.status(201).json({ success: true, alert_id: issue_alert_id });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
