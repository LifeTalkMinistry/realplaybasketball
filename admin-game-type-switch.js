(() => {
  if (window.__realPlayGameTypeSwitchInstalled) return;
  window.__realPlayGameTypeSwitchInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let busy = false;
  let syncScheduled = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function modeFromBadge() {
    const badge = root()?.querySelector('[data-rp-entry-mode-badge]');
    if (!badge) return null;
    if (badge.classList.contains('replay')) return 'replay';
    return String(badge.textContent || '').toUpperCase().includes('REPLAY') ? 'replay' : 'live';
  }

  function enforceScoringTabs(mode) {
    const adminRoot = root();
    if (!adminRoot || !mode) return;
    const liveTab = adminRoot.querySelector('[data-admin-tab="live"]');
    const videoTab = adminRoot.querySelector('[data-rp-video-tab]');
    const replay = mode === 'replay';

    if (liveTab) {
      liveTab.hidden = replay;
      liveTab.setAttribute('aria-hidden', replay ? 'true' : 'false');
      liveTab.tabIndex = replay ? -1 : 0;
    }
    if (videoTab) {
      videoTab.hidden = !replay;
      videoTab.setAttribute('aria-hidden', replay ? 'false' : 'true');
      videoTab.tabIndex = replay ? 0 : -1;
    }

    if (replay && liveTab?.classList.contains('active')) {
      window.setTimeout(() => videoTab?.click(), 0);
    } else if (!replay && videoTab?.classList.contains('active')) {
      window.setTimeout(() => adminRoot.querySelector('[data-admin-tab="session"]')?.click(), 0);
    }
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
    const badge = card?.querySelector('[data-rp-entry-mode-badge]');
    if (!card || !badge) return;

    const mode = modeFromBadge();
    if (!mode) return;
    enforceScoringTabs(mode);

    let panel = card.querySelector('[data-rp-game-type-switch]');
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
    const currentLabel = mode === 'replay' ? 'REPLAY RECORDED · VIDEO' : 'FUTURE LIVE';
    if (current && current.textContent !== currentLabel) current.textContent = currentLabel;

    const button = panel.querySelector('[data-rp-game-type-change]');
    if (button) {
      const buttonLabel = busy ? 'CHANGING…' : (mode === 'replay' ? 'MAKE FUTURE LIVE' : 'MAKE REPLAY');
      if (button.disabled !== busy) button.disabled = busy;
      if (button.textContent !== buttonLabel) button.textContent = buttonLabel;
    }
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    window.requestAnimationFrame(() => {
      syncScheduled = false;
      syncPanel();
    });
  }

  async function changeType() {
    if (busy) return;
    const current = modeFromBadge();
    if (!current) return;
    const next = current === 'replay' ? 'live' : 'replay';
    const label = next === 'replay' ? 'REPLAY RECORDED' : 'FUTURE LIVE';
    if (!window.confirm(`Change this setup game to ${label}?`)) return;

    const auth = token();
    const panel = root()?.querySelector('[data-rp-game-type-switch]');
    const status = panel?.querySelector('[data-rp-game-type-status]');
    if (!auth) {
      if (status) status.textContent = 'Admin session is not available. Log in again.';
      return;
    }

    busy = true;
    if (status && status.textContent) status.textContent = '';
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

      const savedMode = String(data?.control?.session?.gameEntryMode || next).toLowerCase() === 'replay' ? 'replay' : 'live';
      const badge = root()?.querySelector('[data-rp-entry-mode-badge]');
      if (badge) {
        badge.classList.toggle('replay', savedMode === 'replay');
        const badgeLabel = savedMode === 'replay' ? 'REPLAY · VIDEO' : 'FUTURE · LIVE';
        if (badge.textContent !== badgeLabel) badge.textContent = badgeLabel;
      }
      enforceScoringTabs(savedMode);
      window.dispatchEvent(new CustomEvent('realplay:admin-render'));

      if (savedMode === 'replay') {
        window.setTimeout(() => root()?.querySelector('[data-rp-video-tab]')?.click(), 80);
      }
    } catch (error) {
      if (status) status.textContent = error.message || 'Unable to change the game type.';
    } finally {
      busy = false;
      syncPanel();
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-game-type-change]')) return;
    event.preventDefault();
    changeType();
  }, true);

  window.addEventListener('realplay:admin-render', scheduleSync);
  window.addEventListener('focus', scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncPanel();
})();
