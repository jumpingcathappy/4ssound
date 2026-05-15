module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const envCheck = {
    DATABASE_PATH: process.env.DATABASE_PATH || "UNDEFINED",
    BASE_PATH: process.env.BASE_PATH || "UNDEFINED",
    WEBHOOK_API_KEY: process.env.WEBHOOK_API_KEY ? "SET" : "UNDEFINED",
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD ? "SET" : "UNDEFINED",
    EMAIL_FORWARD_URL: process.env.EMAIL_FORWARD_URL ? "SET" : "UNDEFINED",
    SESSION_SECRET: process.env.SESSION_SECRET ? "SET" : "UNDEFINED",
    PORT: process.env.PORT || "3000 (default)",
  };
  res.status(200).json(envCheck);
};
