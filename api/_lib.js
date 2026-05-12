const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET || "4ssound-secret-change-me";
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin123";

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCORS(res);
    res.status(204).end();
    return true;
  }
  setCORS(res);
  return false;
}

function verifyApiKey(req) {
  const apiKey = req.headers["x-api-key"];
  const validKey = process.env.WEBHOOK_API_KEY;
  if (!validKey) return true;
  return apiKey === validKey;
}

function createToken() {
  const payload = JSON.stringify({
    ts: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  });
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  const sig = hmac.digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64");
}

function verifyToken(authHeader) {
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const { payload, sig } = decoded;
    const hmac = crypto.createHmac("sha256", SESSION_SECRET);
    hmac.update(payload);
    if (hmac.digest("hex") !== sig) return false;
    const data = JSON.parse(payload);
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

function verifyDashboardPassword(password) {
  return password === DASHBOARD_PASSWORD;
}

module.exports = { handleOptions, verifyApiKey, createToken, verifyToken, verifyDashboardPassword };
