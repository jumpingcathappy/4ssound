(function () {
  "use strict";

  // ── Config ──
  const BASE_PATH = window.BASE_PATH || "";

  // ── State ──
  let authToken = localStorage.getItem("4ss_token") || null;
  let settings = {
    systemLinkBaseUrl:
      "https://ssss.emsd.gov.hk/organizations/54125d20-37dc-46cb-a0cb-5abf841d033a/notification-centre",
    selectedSound: "pulse-alarm",
    customSoundUrl: null,
  };
  let activeAlerts = [];
  let historyAlerts = [];
  let audioContext = null;
  let currentSoundSource = null;
  let isPlaying = false;
  let customSoundBuffer = null;
  let tabFlashInterval = null;
  let originalTitle = "4S Sound — Alert Monitor";
  let pollInterval = null;
  let knownActiveIds = new Set();
  let previousActiveIds = new Set();

  // ── DOM refs ──
  const loginScreen = document.getElementById("login-screen");
  const dashboardScreen = document.getElementById("dashboard-screen");
  const loginForm = document.getElementById("login-form");
  const loginPassword = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const activeCountEl = document.getElementById("active-count");
  const btnClearAll = document.getElementById("btn-clear-all");
  const btnSettings = document.getElementById("btn-settings");
  const btnLogout = document.getElementById("btn-logout");
  const activeAlertsEl = document.getElementById("active-alerts");
  const historyAlertsEl = document.getElementById("history-alerts");
  const historyCountEl = document.getElementById("history-count");
  const btnToggleHistory = document.getElementById("btn-toggle-history");
  const settingsModal = document.getElementById("settings-modal");
  const settingSystemLink = document.getElementById("setting-system-link");
  const settingSound = document.getElementById("setting-sound");
  const customSoundGroup = document.getElementById("custom-sound-group");
  const settingCustomSound = document.getElementById("setting-custom-sound");
  const btnTestSound = document.getElementById("btn-test-sound");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");

  // ── API helpers ──
  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    if (opts.headers) Object.assign(headers, opts.headers);
    const res = await fetch(BASE_PATH + path, { ...opts, headers });
    if (res.status === 401) {
      logout();
      throw new Error("Unauthorized");
    }
    return res.json();
  }

  // ── Auth ──
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    try {
      const data = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword.value }),
      });
      if (data.token) {
        authToken = data.token;
        localStorage.setItem("4ss_token", authToken);
        showDashboard();
      } else {
        loginError.textContent = data.error || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch {
      loginError.textContent = "Login failed";
      loginError.classList.remove("hidden");
    }
  });

  btnLogout.addEventListener("click", logout);

  function logout() {
    authToken = null;
    localStorage.removeItem("4ss_token");
    stopSound();
    stopTabFlash();
    if (pollInterval) clearInterval(pollInterval);
    dashboardScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }

  // ── Dashboard ──
  async function showDashboard() {
    loginScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");
    await loadSettings();
    startPolling();
  }

  async function loadSettings() {
    try {
      const data = await api("/api/settings");
      Object.assign(settings, data);
    } catch {}
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollAlerts();
    pollInterval = setInterval(pollAlerts, 5000);
  }

  async function pollAlerts() {
    try {
      const data = await api("/api/alerts");
      previousActiveIds = new Set(activeAlerts.map((a) => a.id));
      activeAlerts = data.active || [];
      historyAlerts = data.history || [];
      renderAlerts();
      updateSoundState();
      updateTabFlash();

      // Track known active ids
      for (const alert of activeAlerts) {
        if (!knownActiveIds.has(alert.id)) {
          knownActiveIds.add(alert.id);
        }
      }
      for (const id of knownActiveIds) {
        if (!activeAlerts.find((a) => a.id === id)) {
          knownActiveIds.delete(id);
        }
      }
    } catch {}
  }

  // ── Render ──
  function renderAlerts() {
    // Active
    if (activeAlerts.length === 0) {
      activeAlertsEl.innerHTML = '<p class="empty-state">No active alerts — monitoring…</p>';
      activeCountEl.classList.add("hidden");
      btnClearAll.classList.add("hidden");
    } else {
      activeCountEl.classList.remove("hidden");
      activeCountEl.textContent = activeAlerts.length + " Active";
      btnClearAll.classList.remove("hidden");
      activeAlertsEl.innerHTML = activeAlerts
        .map((a) => {
          const isNew = !previousActiveIds.has(a.id);
          return renderAlertCard(a, false, isNew);
        })
        .join("");
    }

    // History
    historyCountEl.textContent = historyAlerts.length;
    if (historyAlerts.length === 0) {
      historyAlertsEl.innerHTML =
        '<p class="empty-state">No acknowledged alerts.</p>';
    } else {
      historyAlertsEl.innerHTML = historyAlerts
        .map((a) => renderAlertCard(a, true, false))
        .join("");
    }

    // Bind acknowledge buttons — use click with optimistic UI update
    document.querySelectorAll(".btn-ack").forEach((btn) => {
      btn.addEventListener("click", handleAcknowledge);
    });
  }

  async function handleAcknowledge(e) {
    const btn = e.currentTarget;
    const alertId = btn.dataset.id;
    // Optimistic: immediately disable button and move alert visually
    btn.disabled = true;
    btn.textContent = "Ack…";
    try {
      await api("/api/acknowledge", {
        method: "POST",
        body: JSON.stringify({ alertId }),
      });
    } catch {}
    pollAlerts();
  }

  function renderAlertCard(alert, isHistory, isNew) {
    const data = alert.decodedData
      ? typeof alert.decodedData === "string"
        ? JSON.parse(alert.decodedData)
        : alert.decodedData
      : {};
    const message = alert.alertMessageEN || "Alert";
    const time = new Date(alert.createdAt).toLocaleString();
    const ackTime = alert.acknowledgedAt
      ? new Date(alert.acknowledgedAt).toLocaleString()
      : null;
    const systemLink = settings.systemLinkBaseUrl
      ? `${settings.systemLinkBaseUrl}?issueAlertId=${encodeURIComponent(alert.id)}`
      : null;

    return `
      <div class="alert-card ${isHistory ? "history" : ""} ${isNew ? "flash-new" : ""}">
        <div class="alert-header">
          <span class="alert-message">${esc(message)}</span>
          <span class="count-badge">${esc(alert.id)}</span>
        </div>
        <dl class="alert-details">
          <dt>Time</dt><dd>${esc(time)}</dd>
          ${
            data.device_name
              ? `<dt>Device</dt><dd>${esc(data.device_name)}</dd>`
              : ""
          }
          ${
            data.project_code
              ? `<dt>Project</dt><dd>${esc(data.project_code)}</dd>`
              : ""
          }
          ${
            systemLink
              ? `<dt>System</dt><dd><a class="alert-link" href="${esc(systemLink)}" target="_blank">Open in EMSD-SSSS →</a></dd>`
              : ""
          }
          ${
            isHistory && ackTime
              ? `<dt>Acked</dt><dd>${esc(ackTime)}</dd>`
              : ""
          }
        </dl>
        ${
          !isHistory
            ? `<div class="alert-actions">
              <button class="btn btn-ack btn-sm" data-id="${esc(alert.id)}">Acknowledge</button>
            </div>`
            : ""
        }
      </div>
    `;
  }

  function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Sound ──
  function updateSoundState() {
    if (activeAlerts.length > 0 && !isPlaying) {
      startSound();
    } else if (activeAlerts.length === 0 && isPlaying) {
      stopSound();
    }
  }

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  function startSound() {
    if (isPlaying) return;
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    isPlaying = true;

    if (settings.selectedSound === "custom" && customSoundBuffer) {
      playCustomLoop(ctx, customSoundBuffer);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (settings.selectedSound) {
      case "continuous":
        osc.type = "sine";
        osc.frequency.value = 880;
        scheduleContinuous(gain, ctx);
        break;
      case "siren":
        osc.type = "sine";
        osc.frequency.value = 600;
        scheduleSiren(osc, gain, ctx);
        break;
      case "chime":
        osc.type = "sine";
        osc.frequency.value = 1047;
        scheduleChime(gain, ctx);
        break;
      default: // pulse-alarm
        osc.type = "square";
        osc.frequency.value = 880;
        schedulePulse(gain, ctx);
        break;
    }

    osc.start();
    currentSoundSource = { stop: () => { try { osc.stop(); } catch {} } };
  }

  function stopSound() {
    if (currentSoundSource) {
      try { currentSoundSource.stop(); } catch {}
      currentSoundSource = null;
    }
    isPlaying = false;
  }

  // Clear all button
  btnClearAll.addEventListener("click", async () => {
    await api("/api/acknowledge", {
      method: "POST",
      body: JSON.stringify({ acknowledgeAll: true }),
    });
    pollAlerts();
  });

  function scheduleContinuous(gain, ctx) {
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    // Hold for 60 seconds, re-schedule if still needed
    gain.gain.setValueAtTime(0.3, now + 60);
  }

  function schedulePulse(gain, ctx) {
    // Beep-beep-beep pattern, repeating every 1.5s
    const now = ctx.currentTime;
    for (let i = 0; i < 120; i++) {
      const t = now + i * 1.5;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.setValueAtTime(0, t + 0.15);
      gain.gain.setValueAtTime(0.35, t + 0.3);
      gain.gain.setValueAtTime(0, t + 0.45);
      gain.gain.setValueAtTime(0.35, t + 0.6);
      gain.gain.setValueAtTime(0, t + 0.75);
    }
  }

  function scheduleSiren(osc, gain, ctx) {
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.25, now);
    for (let i = 0; i < 60; i++) {
      const t = now + i * 2;
      osc.frequency.linearRampToValueAtTime(1200, t + 1);
      osc.frequency.linearRampToValueAtTime(600, t + 2);
    }
  }

  function scheduleChime(gain, ctx) {
    const now = ctx.currentTime;
    for (let i = 0; i < 120; i++) {
      const t = now + i * 2;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      gain.gain.setValueAtTime(0, t + 0.9);
    }
  }

  function playCustomLoop(ctx, buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    currentSoundSource = source;
  }

  // ── Custom sound upload ──
  settingCustomSound.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ctx = getAudioContext();
    const arrayBuf = await file.arrayBuffer();
    try {
      customSoundBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch {
      alert("Could not decode audio file.");
    }
  });

  btnTestSound.addEventListener("click", () => {
    if (isPlaying) {
      stopSound();
      btnTestSound.textContent = "Test Sound";
    } else {
      startSound();
      btnTestSound.textContent = "Stop Test";
      setTimeout(() => {
        if (btnTestSound.textContent === "Stop Test") {
          stopSound();
          btnTestSound.textContent = "Test Sound";
        }
      }, 3000);
    }
  });

  // ── Tab flash ──
  function updateTabFlash() {
    if (activeAlerts.length > 0 && document.hidden) {
      startTabFlash();
    } else {
      stopTabFlash();
    }
  }

  function startTabFlash() {
    if (tabFlashInterval) return;
    let toggle = false;
    tabFlashInterval = setInterval(() => {
      document.title = toggle
        ? "⚠️ SOS ALERT — 4S Sound"
        : originalTitle;
      toggle = !toggle;
    }, 800);
  }

  function stopTabFlash() {
    if (tabFlashInterval) {
      clearInterval(tabFlashInterval);
      tabFlashInterval = null;
    }
    document.title = originalTitle;
  }

  document.addEventListener("visibilitychange", updateTabFlash);

  // ── Settings modal ──
  btnSettings.addEventListener("click", () => {
    settingSystemLink.value = settings.systemLinkBaseUrl || "";
    settingSound.value = settings.selectedSound || "pulse-alarm";
    customSoundGroup.classList.toggle(
      "hidden",
      settingSound.value !== "custom"
    );
    settingsModal.classList.remove("hidden");
  });

  settingSound.addEventListener("change", () => {
    customSoundGroup.classList.toggle(
      "hidden",
      settingSound.value !== "custom"
    );
  });

  btnCloseSettings.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  btnSaveSettings.addEventListener("click", async () => {
    settings.systemLinkBaseUrl = settingSystemLink.value;
    settings.selectedSound = settingSound.value;
    if (settings.selectedSound === "custom" && customSoundBuffer) {
      // Store as base64 in KV for persistence (simplified: keep in memory for session)
      settings.customSoundUrl = "custom-loaded";
    }
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          systemLinkBaseUrl: settings.systemLinkBaseUrl,
          selectedSound: settings.selectedSound,
          customSoundUrl: settings.customSoundUrl,
        }),
      });
    } catch {}
    settingsModal.classList.add("hidden");
    renderAlerts();
  });

  // ── Toggle history ──
  let historyExpanded = false;
  btnToggleHistory.addEventListener("click", () => {
    historyExpanded = !historyExpanded;
    historyAlertsEl.classList.toggle("collapsed", !historyExpanded);
    historyAlertsEl.classList.toggle("expanded", historyExpanded);
    btnToggleHistory.textContent = historyExpanded
      ? "Hide History"
      : "Show History";
  });

  // ── Init ──
  if (authToken) {
    // Verify token is still valid
    api("/api/alerts")
      .then(() => showDashboard())
      .catch(() => logout());
  }
})();
