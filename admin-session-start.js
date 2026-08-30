(() => {
  if (window.__realPlayAdminSessionStartInstalled) return;
  window.__realPlayAdminSessionStartInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const POLL_MS = 2000;

  let session = null;
  let loading = false;
  let actionBusy = false;
  let lastError = '';

  function ensureStyles() {
    if (document.querySelector('[data-rp-session-start-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpSessionStartStyles = '1';
    style.textContent = `
      .rp-admin-session-start-panel{margin-top:12px;padding:13px;border:1px solid rgba(32,218,255,.25);border-radius:14px;background:rgba(5,22,33,.72);display:grid;gap:9px}
      .rp-admin-session-start-panel strong{font:900 11px/1.2 system-ui,sans-serif;letter-spacing:.11em;color:#eafcff}
      .rp-admin-session-start-panel p{margin:0;color:#88a9bd;font:600 11px/1.45 system-ui,sans-serif}
      .rp-admin-session-start-button{min-height:48px;border:1px solid rgba(32,218,255,.52);border-radius:12px;background:#16d9f4;color:#011017;font:950 11px/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-admin-session-start-button:disabled{opacity:.55}
      .rp-admin-session-active{border-color:rgba(72,240,185,.3);background:rgba(8,35,30,.62)}
      .rp-admin-session-active strong{color:#75f2c6}
      .rp-admin-session-start-error{color:#ff9b9b!important}
      .rp-admin-session-gate{margin:0 0 12px;padding:12px 13px;border:1px solid rgba(32,218,255,.22);border-radius:13px;background:rgba(7,20,31,.8)}
      .rp-admin-session-gate strong{display:block;color:#eafcff;font:900 10px/1.2 system-ui,sans-serif;letter-spacing:.1em}
      .rp-admin-session-gate p{margin:6px 0 0;color:#8caabd;font:600 11px/1.45 system-ui,sans-serif}
    `;
    document.head.appendChild(style);
  }

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function isOpen() {
    return root()?.classList.contains('open');
  }

  function restoreBlockedControl(node) {
    if (!node?.dataset?.sessionBlocked) return;
    const wasDisabled = node.dataset.sessionWasDisabled === '1';
    node.disabled = wasDisabled;
    delete node.dataset.sessionBlocked;
    delete node.dataset.sessionWasDisabled;
  }

  function blockControl(node) {
    if (!node || node.dataset.sessionBlocked) return;
    node.dataset.sessionBlocked = '1';
    node.dataset.sessionWasDisabled = node.disabled ? '1' : '0';
    node.disabled = true;
  }

  function applySetup(adminRoot) {
    if (adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'session') return;
    const body = adminRoot.querySelector('[data-admin-body]');
    if (!body) return;

    body.querySelectorAll('[data-rp-session-start-panel]').forEach((node) => node.remove());
    if (!session || session.gameStatus !== 'setup') return;

    const formCard = body.querySelector('[data-new-session-form]')?.closest('.rp-admin-card');
    const sessionCard = [...body.querySelectorAll('.rp-admin-card')]
      .find((card) => card !== formCard && !card.classList.contains('soft'));
    if (!sessionCard) return;

    const panel = document.createElement('div');
    panel.dataset.rpSessionStartPanel = '1';
    panel.className = `rp-admin-session-start-panel${session.sessionStarted ? ' rp-admin-session-active' : ''}`;

    if (session.sessionStarted) {
      panel.innerHTML = `
        <strong>SESSION ACTIVE · CHECK-IN OPEN</strong>
        <p>The scheduled session has started. Add/check in players and prepare West and East. The actual game still starts separately from LIVE.</p>`;
    } else {
      panel.innerHTML = `
        <strong>SCHEDULED · NOT STARTED</strong>
        <p>Start the physical session when players begin arriving. This opens admin check-in only — it does not start the basketball game.</p>
        <button type="button" class="rp-admin-session-start-button" data-rp-start-session ${actionBusy ? 'disabled' : ''}>${actionBusy ? 'STARTING…' : 'START SESSION'}</button>
        ${lastError ? `<p class="rp-admin-session-start-error">${String(lastError).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>` : ''}`;
    }
    sessionCard.appendChild(panel);
  }

  function applyPlayers(adminRoot) {
    if (adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'players') return;
    const body = adminRoot.querySelector('[data-admin-body]');
    if (!body || !session || session.gameStatus !== 'setup') return;

    let gate = body.querySelector('[data-rp-session-gate]');
    if (!session.sessionStarted) {
      if (!gate) {
        gate = document.createElement('div');
        gate.dataset.rpSessionGate = '1';
        gate.className = 'rp-admin-session-gate';
        gate.innerHTML = '<strong>SESSION HAS NOT STARTED</strong><p>Go to SETUP and tap START SESSION before checking in or manually adding arriving players.</p>';
        const list = body.querySelector('.rp-admin-player-list');
        const manual = body.querySelector('[data-admin-manual-player-wrap]');
        (manual || list)?.before(gate);
      }

      body.querySelectorAll('[data-control-action="checkin"],[data-control-action="team"], [data-admin-manual-player-toggle], [data-admin-manual-player-form] input, [data-admin-manual-player-form] button')
        .forEach(blockControl);
    } else {
      gate?.remove();
      body.querySelectorAll('[data-session-blocked]').forEach(restoreBlockedControl);
    }
  }

  function apply() {
    ensureStyles();
    const adminRoot = root();
    if (!adminRoot || !adminRoot.classList.contains('open')) return;
    applySetup(adminRoot);
    applyPlayers(adminRoot);
  }

  async function refresh() {
    if (loading || actionBusy || !isOpen() || !token()) return;
    loading = true;
    try {
      const data = await api('/api/real-play/admin/career/control');
      session = data?.control?.session || null;
      lastError = '';
    } catch (_error) {
      // Base Game Control already owns global API error handling.
    } finally {
      loading = false;
      apply();
    }
  }

  async function startSession() {
    if (actionBusy) return;
    if (!window.confirm('Start this scheduled Real Play session? This opens check-in, but does NOT start the game.')) return;
    actionBusy = true;
    lastError = '';
    apply();
    try {
      const data = await api('/api/real-play/admin/career/control', {
        method: 'POST',
        body: { action: 'start-session' },
      });
      session = data?.control?.session || session;
    } catch (error) {
      lastError = error.message || 'Unable to start the session.';
    } finally {
      actionBusy = false;
      apply();
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-start-session]')) {
      event.preventDefault();
      startSession();
    }
  }, true);

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.setInterval(refresh, POLL_MS);
  window.addEventListener('focus', refresh);
  refresh();
})();
