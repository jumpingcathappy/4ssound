const express = require("express");
const fs = require("fs");
const path = require("path");
const { ensureSchema } = require("./api/_db");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || "";

// Parse JSON bodies
app.use(express.json());

// ── CORS for API routes ──
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
}

// ── API Routes ──
const apiRouter = express.Router();

const auth = require("./api/auth");
apiRouter.post("/auth", (req, res) => auth(req, res));

const alerts = require("./api/alerts");
apiRouter.get("/alerts", (req, res) => alerts(req, res));

const acknowledge = require("./api/acknowledge");
apiRouter.post("/acknowledge", (req, res) => acknowledge(req, res));

const webhook = require("./api/webhook");
apiRouter.post("/webhook", (req, res) => webhook(req, res));

const settings = require("./api/settings");
apiRouter.get("/settings", (req, res) => settings(req, res));
apiRouter.post("/settings", (req, res) => settings(req, res));

const debug = require("./api/debug");
apiRouter.get("/debug", (req, res) => debug(req, res));

// OPTIONS preflight for all API routes
apiRouter.options("/{*path}", (req, res) => {
  setCORS(res);
  res.status(204).end();
});

// Apply CORS to all API responses
apiRouter.use((req, res, next) => {
  setCORS(res);
  next();
});

// Mount API router at BASE_PATH/api
app.use(`${BASE_PATH}/api`, apiRouter);

// ── Static Files (CSS, JS, images, etc.) ──
// index: false prevents express.static from serving index.html automatically
app.use(`${BASE_PATH}`, express.static(path.join(__dirname, "public"), { index: false }));

// ── Serve index.html with BASE_PATH injection ──
const indexHtml = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf-8");

function serveIndex(req, res) {
  const rendered = indexHtml.replace("{{BASE_PATH}}", BASE_PATH);
  res.setHeader("Content-Type", "text/html");
  res.send(rendered);
}

// Root and SPA fallback
if (BASE_PATH) {
  app.get(`${BASE_PATH}`, serveIndex);
  app.get(`${BASE_PATH}/`, serveIndex);
  app.get(`${BASE_PATH}/{*path}`, serveIndex);
} else {
  app.get("/", serveIndex);
  app.get("/{*path}", serveIndex);
}

// ── Start ──
async function start() {
  try {
    await ensureSchema();
    console.log("Database schema ensured");
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`4S Sound server running on port ${PORT}`);
    if (BASE_PATH) {
      console.log(`Base path: ${BASE_PATH}`);
    }
  });
}

start();
