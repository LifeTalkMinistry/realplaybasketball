(() => {
  if (window.__realPlayAdminAccessBootstrapInstalled) return;
  window.__realPlayAdminAccessBootstrapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const ADMIN_CSS = [
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'admin-membership-review.css',
    'admin-three-v-three.css',
    'real-play-admin-brand-overrides.css',
  ];
  const ADMIN_SCRIPTS = [
    'admin-score-sync.js',
    'admin-game-control.js',
    'admin-session-start.js',
    'admin-game-control-simplify.js',
    'admin-courtside-live.js',
    'admin-manual-open.js',
    'admin-session-picker.js',
    'admin-score-dom-sync.js',
    'admin-membership-review.js',
    'admin-three-v-three.js',
    'admin-season-control.js',
  ];

  let verifiedAdmin = false;
  let loadingAdmin = false;
  let adminLoaded = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function verifyAdmin() {
    const auth = token();
    if (!auth) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      verifiedAdmin = Boolean(response.ok && data?.admin);
    } catch (_error) {
      verifiedAdmin = false;
    }
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

    if (!verifiedAdmin) {
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
      link.href = `${href}?v=20260904-admin-settings-v1`;
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
      script.src = `${src}?v=20260904-admin-settings-v1`;
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
    if (!verifiedAdmin && !(await verifyAdmin())) return;

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

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    verifiedAdmin = false;
    syncSettingsRow();
    verifyAdmin();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();