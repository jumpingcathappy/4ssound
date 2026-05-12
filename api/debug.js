module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const envCheck = {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? "SET (" + process.env.TURSO_DATABASE_URL.substring(0, 30) + "...)" : "UNDEFINED",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "SET" : "UNDEFINED",
    WEBHOOK_API_KEY: process.env.WEBHOOK_API_KEY ? "SET" : "UNDEFINED",
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD ? "SET" : "UNDEFINED",
    EMAIL_FORWARD_URL: process.env.EMAIL_FORWARD_URL ? "SET" : "UNDEFINED",
    SESSION_SECRET: process.env.SESSION_SECRET ? "SET" : "UNDEFINED",
    ALL_ENV_KEYS: Object.keys(process.env).filter(k => !k.startsWith("VERCEL") && !k.startsWith("AWS") && !k.startsWith("NODE_")).sort(),
  };
  res.status(200).json(envCheck);
};
