(() => {
  if (window.__realPlayAdminAccessBootstrapInstalled) return;
  window.__realPlayAdminAccessBootstrapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HEAD_ADMIN_EMAILS = new Set([
    'jeromemirabuenos62@gmail.com',
  ]);
  const ADMIN_ASSET_VERSION = '20260908-game-entry-mode-v1';
  const ADMIN_CSS = [
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'admin-shot-breakdown.css',
    'admin-game-rules.css',
    'admin-player-ownership.css',
    'admin-recorded-scoring.css',
    'admin-recorded-scoring-draft.css',
    'admin-recorded-scoring-score-confirmation.css',
    'admin-recorded-scoring-youtube.css',
    'admin-recorded-scoring-desktop.css',
    'real-play-admin-brand-overrides.css',
  ];
  const ADMIN_SCRIPTS = [
    'admin-score-sync.js',
    'admin-game-control.js',
    'admin-session-start.js',
    'admin-game-control-simplify.js',
    'admin-player-search.js',
    'admin-player-ownership.js',
    'admin-courtside-live.js',
    'admin-game-rules.js',
    // Guard first so a scorer tap can never fall through to a retired
    // per-event backend write while the local draft is still booting.
    'admin-recorded-scoring-draft-guard.js',
    // Capture MAKE -> AST interaction authority before the draft scorer. When
    // the scorer records a legitimate AST immediately after the basket, this
    // layer gives AST that basket's exact video timestamp.
    'admin-recorded-scoring-assist-link.js',
    // Confirmation listens before the draft consumes scorer taps, then shows
    // a short in-video acknowledgement only for MADE baskets.
    'admin-recorded-scoring-score-confirmation.js',
    // Draft owns shot/stat/undo/finish taps before the legacy recorded scorer
    // registers its capture listener.
    'admin-recorded-scoring-draft.js',
    'admin-recorded-scoring-cancel.js',
    'admin-recorded-scoring.js',
    // YouTube is a hosting/player adapter layered over the same recorded
    // scoring workflow. The official event/timestamp model remains unchanged.
    'admin-recorded-scoring-youtube.js',
    // Desktop layout only rearranges the scoring workspace. Mobile stays on
    // the existing stacked workflow and all score/timestamp logic is shared.
    'admin-recorded-scoring-desktop.js',
    'admin-recorded-scoring-lock.js',
    // Game entry mode is loaded after both LIVE and VIDEO controls exist so it
    // can expose exactly one scoring workflow for the current game.
    'admin-game-entry-mode.js',
    'admin-session-picker.js',
    'admin-score-dom-sync.js',
    'admin-season-control.js',
    'admin-season-players.js',
  ];

  let verifiedAdmin = false;
  let loadingAdmin = false;
  let adminLoaded = false;
  let verifySequence = 0;

  window.__realPlayAdminVerified = false;
  window.__realPlayAdminAccessProbe = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function settingsEmail() {
    return String(
      document.querySelector('.rp-settings-overlay [data-rp-settings-email]')?.textContent ||
      document.querySelector('[data-auth-account-email]')?.textContent ||
      ''
    ).trim().toLowerCase();
  }

  function hasKnownHeadAdminIdentity() {
    return HEAD_ADMIN_EMAILS.has(settingsEmail());
  }

  async function verifyAdmin() {
    const sequence = ++verifySequence;
    const auth = token();
    if (!auth) {
      verifiedAdmin = false;
      window.__realPlayAdminVerified = false;
      syncSettingsRow();
      return false;
    }

    window.__realPlayAdminAccessProbe = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (sequence !== verifySequence) return verifiedAdmin;
      verifiedAdmin = Boolean(response.ok && data?.admin);
    } catch (_error) {
      if (sequence !== verifySequence) return verifiedAdmin;
      verifiedAdmin = false;
    } finally {
      if (sequence === verifySequence) {
        window.__realPlayAdminAccessProbe = false;
      }
    }

    window.__realPlayAdminVerified = verifiedAdmin;
    syncSettingsRow();
    return verifiedAdmin;
  }

  function settingsList() {
    return document.querySelector('.rp-settings-overlay .rp-settings-list');
  }

  function syncSettingsRow() {
    const list = settingsList();
    if (!list) return;
    let row = list.querySelector('[data-rp-settings-action="admin"]');

    const shouldShow = verifiedAdmin || hasKnownHeadAdminIdentity();
    if (!shouldShow) {
      row?.remove();
      return;
    }

    if (!row) {
      row = document.createElement('button');
      row.type = 'button';
      row.className = 'rp-settings-row rp-settings-admin-row';
      row.dataset.rpSettingsAction = 'admin';
      row.innerHTML = '<span><strong>ADMIN</strong><small>Season setup, players, game control and scoring</small></span><b>→</b>';
      list.appendChild(row);
      row.addEventListener('click', openAdmin);
    }
  }

  function loadCss(href) {
    return new Promise((resolve) => {
      const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((link) => String(link.href || '').includes(href));
      if (existing) return resolve(true);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${href}?v=${ADMIN_ASSET_VERSION}`;
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      const existing = [...document.scripts].find((script) => String(script.src || '').includes(src));
      if (existing) return resolve(true);
      const script = document.createElement('script');
      script.src = `${src}?v=${ADMIN_ASSET_VERSION}`;
      script.async = false;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function ensureAdminLoaded() {
    if (adminLoaded) return true;
    if (loadingAdmin) {
      while (loadingAdmin) await new Promise((resolve) => setTimeout(resolve, 40));
      return adminLoaded;
    }

    loadingAdmin = true;
    try {
      await Promise.all(ADMIN_CSS.map(loadCss));
      for (const src of ADMIN_SCRIPTS) {
        const ok = await loadScript(src);
        if (!ok) throw new Error(`Unable to load ${src}`);
      }
      adminLoaded = true;
      return true;
    } finally {
      loadingAdmin = false;
    }
  }

  async function openAdmin() {
    if (!verifiedAdmin && !(await verifyAdmin())) {
      window.alert('Real Play could not verify Head Admin access for this session. Please sign in again and retry.');
      return;
    }

    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();

    const settingsBack = document.querySelector('[data-rp-settings-back]');
    if (settingsBack) {
      settingsBack.click();
    } else {
      const overlay = document.querySelector('.rp-settings-overlay');
      if (document.body) {
        document.body.tabIndex = -1;
        document.body.focus({ preventScroll: true });
      }
      overlay?.classList.remove('open');
      overlay?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-settings-open');
    }

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 90));
      await ensureAdminLoaded();
      await window.__realPlayRefreshAdminGameControl?.();

      let opened = window.__realPlayOpenAdminGameControl?.();
      if (!opened) {
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        await window.__realPlayRefreshAdminGameControl?.();
        opened = window.__realPlayOpenAdminGameControl?.();
      }

      if (!opened) {
        throw new Error('Admin tools loaded but Game Control did not open.');
      }
    } catch (error) {
      console.error('[Real Play] Unable to open admin tools.', error);
      window.alert('Unable to open Real Play Admin right now. Please try again.');
    }
  }

  function boot() {
    const observer = new MutationObserver(() => {
      if (settingsList()) {
        syncSettingsRow();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    syncSettingsRow();
    verifyAdmin();
  }

  window.addEventListener('realplay:settings-open', () => {
    syncSettingsRow();
    verifyAdmin();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    verifySequence += 1;
    verifiedAdmin = false;
    window.__realPlayAdminVerified = false;
    syncSettingsRow();
    verifyAdmin();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();