(() => {
  if (window.__realPlayOverlayFocusReleaseInstalled) return;
  window.__realPlayOverlayFocusReleaseInstalled = true;

  function safeFallback() {
    return document.querySelector('[data-rp-main-action].slot-active')
      || document.querySelector('[data-rp-main-menu-list]')
      || document.querySelector('[data-rp-app]');
  }

  function releaseFocus(container) {
    const active = document.activeElement;
    if (!container || !active || !container.contains(active)) return;

    try { active.blur?.(); } catch (_) {}

    if (container.contains(document.activeElement)) {
      const target = safeFallback();
      if (!target || typeof target.focus !== 'function') return;
      if (!target.hasAttribute('tabindex') && target === document.querySelector('[data-rp-app]')) {
        target.setAttribute('tabindex', '-1');
      }
      try { target.focus({ preventScroll: true }); }
      catch (_) { try { target.focus(); } catch (_) {} }
    }
  }

  function surfaceFromCloseTarget(target) {
    if (target.closest?.('[data-rp-main-notice-close]')) return document.querySelector('[data-rp-main-notice]');
    if (target.closest?.('[data-rp-career-replay-close]')) return document.querySelector('[data-rp-career-replay]');
    if (target.closest?.('[data-updates-close]')) return document.querySelector('[data-rp-updates]');
    if (target.closest?.('[data-rp-profile-close]')) return target.closest('[data-rp-profile], .rp-public-player-profile, [data-rp-public-profile]');
    if (target.closest?.('[data-rp-public-profile-close], [data-rp-player-profile-close]')) return target.closest('.rp-public-player-profile, [data-rp-public-profile]');
    if (target.closest?.('[data-admin-exit]')) return document.querySelector('.rp-admin-control');
    return null;
  }

  document.addEventListener('click', (event) => {
    const notice = document.querySelector('[data-rp-main-notice]');
    if (event.target === notice && notice?.classList.contains('open')) {
      releaseFocus(notice);
      return;
    }

    const updates = document.querySelector('[data-rp-updates]');
    if (event.target === updates && updates?.classList.contains('open')) {
      releaseFocus(updates);
      return;
    }

    const surface = surfaceFromCloseTarget(event.target);
    if (surface) releaseFocus(surface);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const surfaces = [
      document.querySelector('[data-rp-main-notice].open'),
      document.querySelector('[data-rp-career-replay].open'),
      document.querySelector('[data-rp-updates].open'),
      document.querySelector('[data-rp-profile].open'),
      document.querySelector('.rp-public-player-profile.open'),
      document.querySelector('.rp-admin-control.open'),
    ].filter(Boolean);
    const activeSurface = surfaces.find((surface) => surface.contains(document.activeElement)) || surfaces[0];
    if (activeSurface) releaseFocus(activeSurface);
  }, true);
})();

/*
 * Backend resilience layer.
 * Real Play is a static frontend whose live sections depend on api.clarapmc.com.
 * A tunnel/server outage must never look like frozen navigation. Network calls
 * receive a bounded timeout, the user sees a clear retry surface, and the
 * permanent bottom navigation remains usable while the backend is unavailable.
 */
(() => {
  if (window.__realPlayBackendResilienceInstalled) return;
  window.__realPlayBackendResilienceInstalled = true;

  const API_ORIGIN = 'https://api.clarapmc.com';
  const REQUEST_TIMEOUT_MS = 8000;
  const originalFetch = window.fetch.bind(window);
  let backendUnavailable = false;
  let retrying = false;

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

  function markAvailable() {
    if (!backendUnavailable) return;
    backendUnavailable = false;
    ensureBanner().hidden = true;
    document.body.classList.remove('rp-backend-unavailable');
  }

  function friendlyNetworkError(cause) {
    const error = new Error('REAL PLAY SERVER UNAVAILABLE. TAP RETRY.');
    error.name = 'RealPlayBackendUnavailableError';
    error.code = 'REAL_PLAY_BACKEND_UNAVAILABLE';
    error.cause = cause;
    return error;
  }

  window.fetch = async function realPlayResilientFetch(input, init = {}) {
    if (!isBackendUrl(input)) return originalFetch(input, init);

    let timer = 0;
    let controller = null;
    let options = init;

    if (!init.signal && typeof AbortController === 'function') {
      controller = new AbortController();
      options = { ...init, signal: controller.signal };
      timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    }

    try {
      const response = await originalFetch(input, options);
      markAvailable();
      return response;
    } catch (error) {
      markUnavailable();
      throw friendlyNetworkError(error);
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
      const response = await originalFetch(`${API_ORIGIN}/api/health`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Backend health returned ${response.status}`);
      markAvailable();
      document.querySelectorAll('[data-rp-backend-empty]').forEach((node) => node.remove());

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
