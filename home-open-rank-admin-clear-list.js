(() => {
  if (window.__realPlayHomeOpenRankAdminClearListInstalled) return;
  window.__realPlayHomeOpenRankAdminClearListInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const ADMIN_API_URL = `${API_BASE_URL}/api/real-play/admin/player`;
  const ROSTER_API_URL = `${API_BASE_URL}/api/real-play/career/session-roster`;

  let clearing = false;
  let mountedBackdrop = null;
  let currentRoster = null;

  function token() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (_error) { return ''; }
  }

  async function fetchRoster() {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(ROSTER_API_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Could not load the current player list (${response.status}).`);
    currentRoster = data || {};
    return currentRoster;
  }

  async function adminCall(action) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function editorStatus(message = '', isError = false) {
    const node = document.querySelector('[data-rp-home-open-rank-edit-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-home-open-rank-clear-list-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeOpenRankClearListStyle = '1';
    style.textContent = `
      .rp-home-open-rank-edit-clear-list{height:34px;min-width:88px;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid rgba(65,210,255,.34);border-radius:999px;background:rgba(7,62,88,.32);color:#55dcff;font:950 .53rem/1 system-ui,sans-serif;letter-spacing:.07em;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .rp-home-open-rank-edit-clear-list:disabled{opacity:.45;cursor:wait}
      .rp-home-open-rank-edit-clear-list svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .rp-home-open-rank-edit-clear-list:active{transform:scale(.96)}
      .rp-home-open-rank-edit-clear-list + .rp-home-open-rank-edit-delete{margin-left:0}
      .rp-home-open-rank-clear-confirm{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,2,5,.8);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);pointer-events:auto;touch-action:manipulation}
      .rp-home-open-rank-clear-confirm[hidden]{display:none!important}
      .rp-home-open-rank-clear-confirm-card{width:min(100%,430px);box-sizing:border-box;padding:18px;border:1px solid rgba(73,216,255,.24);border-radius:18px;background:linear-gradient(180deg,#0c151d,#07090e);box-shadow:0 24px 70px rgba(0,0,0,.62);pointer-events:auto}
      .rp-home-open-rank-clear-confirm-card small{display:block;margin-bottom:7px;color:#55dcff;font:950 .5rem/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      .rp-home-open-rank-clear-confirm-card strong{display:block;color:#f7f9fb;font:950 1rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-style:italic;letter-spacing:.025em}
      .rp-home-open-rank-clear-confirm-card p{margin:10px 0 15px;color:#91a2b1;font:700 .66rem/1.5 system-ui,sans-serif}
      .rp-home-open-rank-clear-confirm-actions{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1.2fr;gap:8px}
      .rp-home-open-rank-clear-confirm-actions button{min-height:44px;border-radius:11px;font:950 .58rem/1 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.075em;text-transform:uppercase;cursor:pointer;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .rp-home-open-rank-clear-keep{border:1px solid rgba(255,255,255,.09);background:#0b1119;color:#9dafbe}
      .rp-home-open-rank-clear-confirm-button{border:1px solid rgba(65,210,255,.4);background:linear-gradient(180deg,#117ca5,#095a7d);color:#fff}
      .rp-home-open-rank-clear-confirm-button:disabled{opacity:.5;cursor:wait}
      @media(max-width:420px){.rp-home-open-rank-edit-clear-list{min-width:34px;width:34px;padding:0}.rp-home-open-rank-edit-clear-list span{display:none}.rp-home-open-rank-edit-head{gap:8px}}
    `;
    document.head.appendChild(style);
  }

  function ensureClearUi(backdrop) {
    if (!backdrop) return false;
    const header = backdrop.querySelector('.rp-home-open-rank-edit-head');
    const close = header?.querySelector('[data-rp-home-open-rank-edit-close]');
    if (!header || !close) return false;

    let button = header.querySelector('[data-rp-home-open-rank-clear-list]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-home-open-rank-edit-clear-list';
      button.dataset.rpHomeOpenRankClearList = '1';
      button.setAttribute('aria-label', 'Clear all players from the current Ranking Game list');
      button.setAttribute('title', 'Clear current player list');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10"/><path d="M4 12h7"/><path d="M4 18h6"/><path d="m15 14 5 5"/><path d="m20 14-5 5"/></svg><span>CLEAR LIST</span>';
      const deleteButton = header.querySelector('[data-rp-home-open-rank-delete]');
      header.insertBefore(button, deleteButton || close);
      button.addEventListener('click', openClearConfirm);
    }

    let confirm = backdrop.querySelector('[data-rp-home-open-rank-clear-confirm]');
    if (!confirm) {
      confirm = document.createElement('div');
      confirm.className = 'rp-home-open-rank-clear-confirm';
      confirm.dataset.rpHomeOpenRankClearConfirm = '1';
      confirm.hidden = true;
      confirm.innerHTML = `
        <section class="rp-home-open-rank-clear-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="rp-home-open-rank-clear-title">
          <small>CLEAR CURRENT PLAYER LIST</small>
          <strong id="rp-home-open-rank-clear-title">CLEAR ALL PLAYERS?</strong>
          <p>Removes everyone from Secured, Standby, and Overflow for the current Ranking Game only. The schedule stays. Completed games, stats, OVR, and player history stay untouched. Eligible committed Play Tokens are returned.</p>
          <div class="rp-home-open-rank-clear-confirm-actions">
            <button type="button" class="rp-home-open-rank-clear-keep" data-rp-home-open-rank-clear-keep>KEEP LIST</button>
            <button type="button" class="rp-home-open-rank-clear-confirm-button" data-rp-home-open-rank-clear-confirm-button>CLEAR LIST</button>
          </div>
        </section>`;
      backdrop.appendChild(confirm);
    }

    mountedBackdrop = backdrop;
    return true;
  }

  async function openClearConfirm() {
    if (clearing) return;
    editorStatus('Checking current player list…');
    try {
      const roster = await fetchRoster();
      const secured = Math.max(0, Number(roster?.confirmedCount || 0));
      const standby = Math.max(0, Number(roster?.standbyCount || 0));
      const total = secured + standby;
      if (!Number(roster?.sessionId)) {
        editorStatus('There is no open Ranking Game to clear.', true);
        return;
      }
      if (total <= 0) {
        editorStatus('The current Ranking Game player list is already empty.');
        return;
      }

      const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-clear-confirm]');
      if (!confirm) return;
      const title = confirm.querySelector('#rp-home-open-rank-clear-title');
      if (title) title.textContent = `CLEAR ${total} PLAYER${total === 1 ? '' : 'S'}?`;
      confirm.hidden = false;
      editorStatus('');
      window.setTimeout(() => confirm.querySelector('[data-rp-home-open-rank-clear-keep]')?.focus({ preventScroll: true }), 0);
    } catch (error) {
      editorStatus(error?.message || 'Could not verify the current player list.', true);
    }
  }

  function closeClearConfirm() {
    if (clearing) return;
    const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-clear-confirm]');
    if (confirm) confirm.hidden = true;
  }

  function setClearing(next) {
    clearing = Boolean(next);
    const backdrop = mountedBackdrop || document.querySelector('[data-rp-home-open-rank-editor]');
    const clearButton = backdrop?.querySelector('[data-rp-home-open-rank-clear-list]');
    const confirmButton = backdrop?.querySelector('[data-rp-home-open-rank-clear-confirm-button]');
    const keepButton = backdrop?.querySelector('[data-rp-home-open-rank-clear-keep]');
    const saveButton = backdrop?.querySelector('[data-rp-home-open-rank-edit-save]');
    const deleteButton = backdrop?.querySelector('[data-rp-home-open-rank-delete]');
    if (clearButton) clearButton.disabled = clearing;
    if (keepButton) keepButton.disabled = clearing;
    if (saveButton) saveButton.disabled = clearing;
    if (deleteButton) deleteButton.disabled = clearing;
    if (confirmButton) {
      confirmButton.disabled = clearing;
      confirmButton.textContent = clearing ? 'CLEARING…' : 'CLEAR LIST';
    }
  }

  async function clearCurrentList() {
    if (clearing) return;
    setClearing(true);
    editorStatus('Clearing current Ranking Game player list…');

    try {
      const result = await adminCall('clear_schedule');
      currentRoster = null;
      const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-clear-confirm]');
      if (confirm) confirm.hidden = true;
      editorStatus(result?.message || 'Current Ranking Game player list cleared.');

      const detail = {
        source: 'home-open-rank-admin-clear-list',
        sessionId: result?.session?.id || null,
        removedPlayers: Number(result?.removedPlayers || 0),
        releasedTokens: Number(result?.releasedTokens || 0),
      };
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed', { detail }));
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail }));
    } catch (error) {
      editorStatus(error?.message || 'Unable to clear the current player list.', true);
    } finally {
      setClearing(false);
    }
  }

  function handleConfirmClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const keep = target.closest('[data-rp-home-open-rank-clear-keep]');
    if (keep) {
      event.preventDefault();
      event.stopPropagation();
      closeClearConfirm();
      return;
    }

    const clear = target.closest('[data-rp-home-open-rank-clear-confirm-button]');
    if (clear) {
      event.preventDefault();
      event.stopPropagation();
      clearCurrentList();
      return;
    }

    const confirm = target.closest('[data-rp-home-open-rank-clear-confirm]');
    if (confirm && event.target === confirm && !clearing) {
      event.preventDefault();
      event.stopPropagation();
      closeClearConfirm();
    }
  }

  function mount() {
    ensureStyles();
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop) return false;
    if (!ensureClearUi(backdrop)) return false;
    return true;
  }

  let backdropObserver = null;
  const mountObserver = new MutationObserver(() => {
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop || backdrop === mountedBackdrop) return;
    if (!mount()) return;
    mountObserver.disconnect();
    backdropObserver?.disconnect();
    backdropObserver = new MutationObserver(() => {
      if (mountedBackdrop?.hidden) closeClearConfirm();
    });
    backdropObserver.observe(backdrop, { attributes: true, attributeFilter: ['hidden'] });
  });
  mountObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', handleConfirmClick, true);
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(mount, 0);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-clear-confirm]');
    if (confirm && !confirm.hidden && !clearing) closeClearConfirm();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
