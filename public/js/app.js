(function () {
  "use strict";

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
    const res = await fetch(path, { ...opts, headers });
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
    pollInterval = setInterval(pollAlerts, 3000);
  }

  async function pollAlerts() {
    try {
      const data = await api("/api/alerts");
      const prevActiveIds = new Set(activeAlerts.map((a) => a.id));
      activeAlerts = data.active || [];
      historyAlerts = data.history || [];
      renderAlerts();
      updateSoundState();
      updateTabFlash();

      // Check for new alerts (ids not in previous set)
      for (const alert of activeAlerts) {
        if (!knownActiveIds.has(alert.id)) {
          knownActiveIds.add(alert.id);
        }
      }
      // Clean known ids for acked alerts
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
      activeCountEl.textContent = activeAlerts.length + " Active";
      activeCountEl.classList.remove("hidden");
      btnClearAll.classList.remove("hidden");
      activeAlertsEl.innerHTML = activeAlerts.map(renderAlertCard).join("");
    }

    // History
    historyCountEl.textContent = historyAlerts.length;
    if (historyAlerts.length === 0) {
      historyAlertsEl.innerHTML = '<p class="empty-state">No acknowledged alerts.</p>';
    } else {
      historyAlertsEl.innerHTML = historyAlerts
        .map((a) => renderAlertCard(a, true))
        .join("");
    }

    // Wire ack buttons
    document.querySelectorAll(".btn-ack-single").forEach((btn) => {
      btn.addEventListener("click", () => acknowledgeAlert(btn.dataset.id));
    });
  }

  function renderAlertCard(alert, isHistory) {
    const d = alert.decodedData || {};
    const time = formatHKT(alert.decodedData?.input_created_date || alert.createdAt);
    const msg = alert.alertMessageEN || "Alert";
    const projectCode = d.project_code || "—";
    const deviceName = d.device_name || "—";
    const link = settings.systemLinkBaseUrl
      ? settings.systemLinkBaseUrl + "?issueAlertId=" + alert.id
      : "#";

    return `
      <div class="alert-card ${isHistory ? "history" : ""}">
        <div class="alert-header">
          <div class="alert-message">${escapeHtml(msg)}</div>
        </div>
        <dl class="alert-details">
          <dt>Time (HKT)</dt><dd>${escapeHtml(time)}</dd>
          <dt>Project</dt><dd>${escapeHtml(projectCode)}</dd>
          <dt>Device</dt><dd>${escapeHtml(deviceName)}</dd>
        </dl>
        <a class="alert-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">
          View in System →
        </a>
        ${
          !isHistory
            ? `<div class="alert-actions" style="margin-top:0.5rem">
                <button class="btn btn-sm btn-ack btn-ack-single" data-id="${alert.id}">Acknowledge</button>
              </div>`
            : ""
        }
      </div>`;
  }

  function formatHKT(dateStr) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-HK", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Acknowledge ──
  btnClearAll.addEventListener("click", async () => {
    try {
      await api("/api/acknowledge", {
        method: "POST",
        body: JSON.stringify({ acknowledgeAll: true }),
      });
      await pollAlerts();
    } catch {}
  });

  async function acknowledgeAlert(id) {
    try {
      await api("/api/acknowledge", {
        method: "POST",
        body: JSON.stringify({ alertId: id }),
      });
      await pollAlerts();
    } catch {}
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
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    stopSoundSource();

    const soundType = settings.selectedSound;

    if (soundType === "custom" && customSoundBuffer) {
      playCustomLoop(ctx, customSoundBuffer);
    } else {
      playSynthesized(ctx, soundType);
    }
    isPlaying = true;
  }

  function stopSound() {
    stopSoundSource();
    isPlaying = false;
  }

  function stopSoundSource() {
    if (currentSoundSource) {
      try {
        currentSoundSource.stop();
      } catch {}
      currentSoundSource = null;
    }
  }

  function playSynthesized(ctx, type) {
    // Create a loop of alarm patterns using oscillator + gain scheduling
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = 0;

    const osc = ctx.createOscillator();
    osc.connect(gainNode);

    switch (type) {
      case "continuous":
        osc.type = "square";
        osc.frequency.value = 880;
        scheduleContinuous(gainNode, ctx);
        break;
      case "pulse-alarm":
        osc.type = "square";
        osc.frequency.value = 1000;
        schedulePulse(gainNode, ctx);
        break;
      case "siren":
        osc.type = "sawtooth";
        osc.frequency.value = 600;
        scheduleSiren(osc, gainNode, ctx);
        break;
      case "chime":
        osc.type = "sine";
        osc.frequency.value = 1200;
        scheduleChime(gainNode, ctx);
        break;
      default:
        osc.type = "square";
        osc.frequency.value = 1000;
        schedulePulse(gainNode, ctx);
    }

    osc.start();
    currentSoundSource = { stop: () => { try { osc.stop(); } catch {} } };
  }

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
