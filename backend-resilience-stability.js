(() => {
  if (window.__realPlayBackendResilienceInstalled) return;
  window.__realPlayBackendResilienceInstalled = true;

  const API_ORIGIN = 'https://api.clarapmc.com';
  const REQUEST_TIMEOUT_MS = 15000;
  const HEALTH_TIMEOUT_MS = 3500;
  const OUTAGE_CONFIRMATION_DELAY_MS = 350;
  const originalFetch = window.fetch.bind(window);

  let backendUnavailable = false;
  let retrying = false;
  let healthProbePromise = null;
  let outageConfirmationPromise = null;

  function isBackendUrl(input) {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return false;
    try {
      return new URL(raw, window.location.href).origin === API_ORIGIN;
    } catch (_) {
      return false;
    }
  }

  function installStyles() {
    if (document.getElementById('rp-backend-resilience-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-backend-resilience-style';
    style.textContent = `
      .rp-backend-banner{position:fixed;z-index:2147483000;top:max(10px,env(safe-area-inset-top));left:50%;width:min(calc(100% - 24px),430px);transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid rgba(255,91,111,.32);border-radius:12px;background:rgba(18,6,10,.94);box-shadow:0 12px 32px rgba(0,0,0,.42);color:#ff9aaa;font:800 .64rem/1.25 Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;backdrop-filter:blur(10px)}
      .rp-backend-banner button,.rp-backend-empty button{appearance:none;border:1px solid rgba(86,220,255,.34);border-radius:9px;background:rgba(14,57,76,.58);color:#dff9ff;font:900 .58rem/1 Arial,sans-serif;letter-spacing:.08em;padding:8px 10px;cursor:pointer;text-transform:uppercase}
      .rp-backend-banner[hidden]{display:none!important}
      .rp-backend-empty{margin:18px auto;max-width:420px;padding:28px 20px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(5,10,16,.88);text-align:center}
      .rp-backend-empty strong{display:block;color:#f3f7fb;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.12rem;font-style:italic;letter-spacing:.03em}
      .rp-backend-empty p{margin:8px auto 16px;color:#7f91a5;font:700 .66rem/1.5 Arial,sans-serif;max-width:320px}
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    installStyles();
    let banner = document.querySelector('[data-rp-backend-banner]');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'rp-backend-banner';
    banner.dataset.rpBackendBanner = 'true';
    banner.hidden = true;
    banner.innerHTML = '<span>REAL PLAY SERVER UNAVAILABLE</span><button type="button" data-rp-backend-retry>RETRY</button>';
    document.body.appendChild(banner);
    return banner;
  }

  function offlineCard() {
    return '<div class="rp-backend-empty" data-rp-backend-empty><strong>SERVER TEMPORARILY UNAVAILABLE.</strong><p>Your navigation still works. Live Real Play data will return as soon as the server connection is restored.</p><button type="button" data-rp-backend-retry>RETRY</button></div>';
  }

  function revealFallbacks() {
    const profile = document.querySelector('[data-rp-profile].open [data-rp-profile-content]');
    if (profile && !profile.children.length) profile.innerHTML = offlineCard();

    const world = document.querySelector('[data-rp-world].open');
    const players = world?.querySelector('[data-world-view="players"]:not([hidden]) [data-world-player-list]');
    if (players && !players.children.length) players.innerHTML = offlineCard();

    const feed = world?.querySelector('[data-world-view="world"]:not([hidden]) [data-world-feed]');
    if (feed && !feed.children.length) feed.innerHTML = offlineCard();

    const chat = world?.querySelector('[data-world-view="chats"]:not([hidden]) [data-chat-thread]');
    if (chat && !chat.children.length) chat.innerHTML = offlineCard();
  }

  function markUnavailable() {
    backendUnavailable = true;
    ensureBanner().hidden = false;
    document.body.classList.add('rp-backend-unavailable');
    queueMicrotask(revealFallbacks);
  }

  function clearFallbacks() {
    document.querySelectorAll('[data-rp-backend-empty]').forEach((node) => node.remove());
  }

  function markAvailable() {
    backendUnavailable = false;
    const banner = document.querySelector('[data-rp-backend-banner]');
    if (banner) banner.hidden = true;
    document.body.classList.remove('rp-backend-unavailable');
    clearFallbacks();
  }

  function friendlyNetworkError(cause) {
    const error = new Error('REAL PLAY SERVER UNAVAILABLE. TAP RETRY.');
    error.name = 'RealPlayBackendUnavailableError';
    error.code = 'REAL_PLAY_BACKEND_UNAVAILABLE';
    error.cause = cause;
    return error;
  }

  function requestTimeoutError(cause) {
    const error = new Error('REAL PLAY REQUEST TIMED OUT. TAP RETRY.');
    error.name = 'RealPlayRequestTimeoutError';
    error.code = 'REAL_PLAY_REQUEST_TIMEOUT';
    error.cause = cause;
    return error;
  }

  async function probeBackendHealth() {
    if (healthProbePromise) return healthProbePromise;

    healthProbePromise = (async () => {
      let timer = 0;
      let controller = null;
      const options = {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      };

      if (typeof AbortController === 'function') {
        controller = new AbortController();
        options.signal = controller.signal;
        timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      }

      try {
        const response = await originalFetch(`${API_ORIGIN}/api/health`, options);
        return Boolean(response?.ok);
      } catch (_) {
        return false;
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    })().finally(() => {
      healthProbePromise = null;
    });

    return healthProbePromise;
  }

  async function confirmBackendUnavailable() {
    if (outageConfirmationPromise) return outageConfirmationPromise;

    outageConfirmationPromise = (async () => {
      if (await probeBackendHealth()) return false;
      await new Promise((resolve) => window.setTimeout(resolve, OUTAGE_CONFIRMATION_DELAY_MS));
      return !(await probeBackendHealth());
    })().finally(() => {
      outageConfirmationPromise = null;
    });

    return outageConfirmationPromise;
  }

  window.fetch = async function realPlayResilientFetch(input, init = {}) {
    if (!isBackendUrl(input)) return originalFetch(input, init);

    let timer = 0;
    let controller = null;
    let timedOut = false;
    let options = init;

    if (!init.signal && typeof AbortController === 'function') {
      controller = new AbortController();
      options = { ...init, signal: controller.signal };
      timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    try {
      const response = await originalFetch(input, options);
      // Any HTTP response proves the server path is reachable. Individual 4xx/5xx
      // responses remain the calling feature's responsibility.
      markAvailable();
      return response;
    } catch (error) {
      // A caller-owned AbortSignal is navigation/lifecycle control, not evidence
      // that the backend is down. Preserve the original abort for that caller.
      if (init.signal?.aborted && !timedOut) {
        throw error;
      }

      const unavailable = await confirmBackendUnavailable();
      if (unavailable) {
        markUnavailable();
        throw friendlyNetworkError(error);
      }

      // The backend answered its independent health probe, so one slow/failed
      // feature request must never paint the whole Real Play app as offline.
      markAvailable();
      if (timedOut) throw requestTimeoutError(error);
      throw error;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  async function retryBackend() {
    if (retrying) return;
    retrying = true;
    document.querySelectorAll('[data-rp-backend-retry]').forEach((button) => {
      button.disabled = true;
      button.textContent = 'CHECKING…';
    });

    try {
      const healthy = await probeBackendHealth();
      if (!healthy) throw new Error('Backend health check failed.');

      markAvailable();

      const active = document.querySelector('[data-rp-simple-nav-item].active, [data-rp-simple-nav-item][aria-current="page"]');
      const route = active?.dataset?.rpSimpleNavItem;
      if (route === 'me') window.RealPlayProfile?.refresh?.();
      else if (route) active?.click();
    } catch (_) {
      markUnavailable();
    } finally {
      retrying = false;
      document.querySelectorAll('[data-rp-backend-retry]').forEach((button) => {
        button.disabled = false;
        button.textContent = 'RETRY';
      });
    }
  }

  document.addEventListener('click', (event) => {
    const retry = event.target.closest?.('[data-rp-backend-retry]');
    if (!retry) return;
    event.preventDefault();
    event.stopPropagation();
    retryBackend();
  });

  window.RealPlayBackend = {
    retry: retryBackend,
    isUnavailable: () => backendUnavailable,
  };
})();
