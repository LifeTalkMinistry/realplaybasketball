(() => {
  if (window.__realPlayAdminAccessBootstrapInstalled) return;
  window.__realPlayAdminAccessBootstrapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HEAD_ADMIN_EMAILS = new Set([
    'jeromemirabuenos62@gmail.com',
  ]);
  const ADMIN_ASSET_VERSION = '20260904-session-manage-v2';
  const ADMIN_CSS = [
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'real-play-admin-brand-overrides.css',
  ];
  const ADMIN_SCRIPTS = [
    'admin-score-sync.js',
    'admin-game-control.js',
    'admin-session-start.js',
    'admin-game-control-simplify.js',
    'admin-courtside-live.js',
    'admin-session-picker.js',
    'admin-score-dom-sync.js',
    'admin-season-control.js',
    'admin-season-players.js',
  ];

  let verifiedAdmin = false;
  let loadingAdmin = false;
  let adminLoaded = false;
  let verifySequence = 0;

  // Single client-side admin authority. This is only a UI gate; every admin
  // API call is still authorized by the backend.
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

      // Ignore an older response if a newer verification started while this
      // request was in flight (for example after login/logout in the same tab).
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

    // The known Head Admin identity is allowed to see the entry immediately,
    // even before the network verification finishes. Opening/admin API actions
    // still require the backend-authorized token, so this never bypasses the
    // actual security boundary.
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

    // Close Settings through its own control first so focus/ARIA state is
    // released before the admin overlay mounts.
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

  // localStorage's native storage event does not fire in the same tab that
  // performed login. Settings emits this event whenever it opens, which gives
  // us a reliable point to refresh both the visible identity and backend role.
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
