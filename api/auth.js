const { handleOptions, verifyDashboardPassword, createToken } = require("./_lib");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password } = req.body || {};
    if (!password || !verifyDashboardPassword(password)) {
      return res.status(401).json({ error: "Invalid password" });
    }
    const token = createToken();
    return res.status(200).json({ token });
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }
};
