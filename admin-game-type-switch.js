(() => {
  if (window.__realPlayGameTypeSwitchInstalled) return;
  window.__realPlayGameTypeSwitchInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let busy = false;
  let currentMode = null;
  let currentSessionId = 0;
  let currentGameStatus = null;
  let lastError = '';

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function normalizeMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return mode === 'replay' ? 'replay' : mode === 'live' ? 'live' : null;
  }

  function rememberControl(control) {
    const session = control?.session || null;
    currentSessionId = Number(session?.id || 0);
    currentMode = session ? normalizeMode(session.gameEntryMode || session.game_entry_mode) : null;
    currentGameStatus = session?.gameStatus || null;
    syncPanel();
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-game-type-switch-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpGameTypeSwitchStyles = '1';
    style.textContent = `
      .rp-game-type-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 12px;border:1px solid rgba(88,151,190,.20);border-radius:12px;background:rgba(4,14,23,.60)}
      .rp-game-type-switch-copy{display:grid;gap:3px;min-width:0}
      .rp-game-type-switch-copy small{color:#6f96ad;font:800 8px/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-game-type-switch-copy strong{color:#dff8ff;font:900 10px/1.2 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase}
      .rp-game-type-switch button{flex:0 0 auto;min-height:34px;padding:0 10px;border:1px solid rgba(32,218,255,.32);border-radius:9px;background:#081724;color:#65e9ff;font:900 8px/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}
      .rp-game-type-switch button:disabled{opacity:.5;cursor:default}
      .rp-game-type-switch-status{grid-column:1/-1;margin:0;color:#ff9b9b;font:700 9px/1.35 system-ui,sans-serif}
      .rp-game-type-switch-status:empty{display:none}
    `;
    document.head.appendChild(style);
  }

  function syncPanel() {
    ensureStyles();
    const adminRoot = root();
    if (!adminRoot) return;

    const card = adminRoot.querySelector('.rp-admin-session-summary');
    let panel = card?.querySelector('[data-rp-game-type-switch]');

    if (!card || !currentSessionId || !currentMode || currentGameStatus !== 'setup') {
      panel?.remove();
      return;
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'rp-game-type-switch';
      panel.dataset.rpGameTypeSwitch = '1';
      panel.innerHTML = `
        <div class="rp-game-type-switch-copy"><small>GAME TYPE</small><strong data-rp-game-type-current></strong></div>
        <button type="button" data-rp-game-type-change>CHANGE TYPE</button>
        <p class="rp-game-type-switch-status" data-rp-game-type-status></p>`;
      const startPanel = card.querySelector('[data-rp-session-start-panel]');
      if (startPanel) startPanel.before(panel);
      else card.appendChild(panel);
    }

    const current = panel.querySelector('[data-rp-game-type-current]');
    const currentText = currentMode === 'replay' ? 'REPLAY RECORDED · VIDEO' : 'FUTURE LIVE';
    if (current && current.textContent !== currentText) current.textContent = currentText;

    const button = panel.querySelector('[data-rp-game-type-change]');
    if (button) {
      button.disabled = busy;
      const text = busy ? 'CHANGING…' : (currentMode === 'replay' ? 'MAKE FUTURE LIVE' : 'MAKE REPLAY');
      if (button.textContent !== text) button.textContent = text;
    }

    const status = panel.querySelector('[data-rp-game-type-status]');
    if (status && status.textContent !== lastError) status.textContent = lastError;
  }

  async function changeType() {
    if (busy || !currentSessionId || !currentMode || currentGameStatus !== 'setup') return;
    const next = currentMode === 'replay' ? 'live' : 'replay';
    const label = next === 'replay' ? 'REPLAY RECORDED' : 'FUTURE LIVE';
    if (!window.confirm(`Change this setup game to ${label}?`)) return;

    const auth = token();
    if (!auth) {
      lastError = 'Admin session is not available. Log in again.';
      syncPanel();
      return;
    }

    busy = true;
    lastError = '';
    syncPanel();

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ action: 'set-entry-mode', mode: next }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);

      const control = data?.control || null;
      if (control) {
        rememberControl(control);
        window.__realPlayGameEntryModeApplyControl?.(control);
      }

      // Synchronize the base admin's own control object, then let its normal
      // render path rebuild the card. This keeps one backend state authority.
      await window.__realPlayRefreshAdminGameControl?.();
      root()?.querySelector('[data-admin-tab="session"]')?.click();

      if (next === 'replay') {
        window.setTimeout(() => root()?.querySelector('[data-rp-video-tab]')?.click(), 120);
      }
    } catch (error) {
      lastError = error.message || 'Unable to change the game type.';
    } finally {
      busy = false;
      syncPanel();
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-game-type-change]')) return;
    event.preventDefault();
    event.stopPropagation();
    changeType();
  }, true);

  window.addEventListener('realplay:entry-mode-state', (event) => {
    if (event.detail?.control) rememberControl(event.detail.control);
  });

  window.addEventListener('realplay:admin-render', () => {
    const mode = window.__realPlayGameEntryModeCurrentMode?.();
    if (mode && !currentMode) currentMode = mode;
    window.requestAnimationFrame(syncPanel);
  });

  syncPanel();
})();
