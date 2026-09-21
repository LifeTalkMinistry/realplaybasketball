(() => {
  if (window.__realPlayHomeOpenRankAdminClearListInstalled) return;
  window.__realPlayHomeOpenRankAdminClearListInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const ADMIN_API_URL = `${API_BASE_URL}/api/real-play/admin/player`;
  const ROSTER_API_URL = `${API_BASE_URL}/api/real-play/career/session-roster`;

  let clearing = false;
  let mountedBackdrop = null;

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
    return data || {};
  }

  async function clearSchedule() {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action: 'clear_schedule' }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Could not clear the player list (${response.status}).`);
    return data;
  }

  function editorStatus(message = '', isError = false) {
    const node = document.querySelector('[data-rp-home-open-rank-edit-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
  }

  function installStyles() {
    if (document.querySelector('[data-rp-home-open-rank-clear-list-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeOpenRankClearListStyle = '1';
    style.textContent = `
      .rp-home-open-rank-edit-clear-list{height:34px;min-width:88px;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid rgba(65,210,255,.34);border-radius:999px;background:rgba(7,62,88,.32);color:#55dcff;font:950 .53rem/1 system-ui,sans-serif;letter-spacing:.07em;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
      .rp-home-open-rank-edit-clear-list:disabled{opacity:.45;cursor:wait}
      .rp-home-open-rank-edit-clear-list svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .rp-home-open-rank-edit-clear-list:active{transform:scale(.96)}
      .rp-home-open-rank-edit-clear-list + .rp-home-open-rank-edit-delete{margin-left:0}
      .rp-home-open-rank-clear-confirm{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,2,5,.82);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);pointer-events:auto;touch-action:manipulation}
      .rp-home-open-rank-clear-confirm[hidden]{display:none!important}
      .rp-home-open-rank-clear-confirm-card{position:relative;width:min(100%,430px);box-sizing:border-box;padding:18px;border:1px solid rgba(73,216,255,.24);border-radius:18px;background:linear-gradient(180deg,#0c151d,#07090e);box-shadow:0 24px 70px rgba(0,0,0,.62)}
      .rp-home-open-rank-clear-confirm-card small{display:block;margin:0 38px 7px 0;color:#55dcff;font:950 .5rem/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      .rp-home-open-rank-clear-confirm-card strong{display:block;margin-right:38px;color:#f7f9fb;font:950 1rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-style:italic;letter-spacing:.025em}
      .rp-home-open-rank-clear-confirm-card p{margin:10px 0 15px;color:#91a2b1;font:700 .66rem/1.5 system-ui,sans-serif}
      .rp-home-open-rank-clear-close{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.09);border-radius:50%;background:#0b1119;color:#a9bbc9;font:800 1rem/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
      .rp-home-open-rank-clear-confirm-button{width:100%;min-height:46px;border:1px solid rgba(65,210,255,.44);border-radius:11px;background:linear-gradient(180deg,#117ca5,#095a7d);color:#fff;font:950 .61rem/1 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;pointer-events:auto;touch-action:manipulation}
      .rp-home-open-rank-clear-confirm-button:disabled{opacity:.5;cursor:wait}
      @media(max-width:420px){.rp-home-open-rank-edit-clear-list{min-width:34px;width:34px;padding:0}.rp-home-open-rank-edit-clear-list span{display:none}.rp-home-open-rank-edit-head{gap:8px}}
    `;
    document.head.appendChild(style);
  }

  function getConfirm() {
    return mountedBackdrop?.querySelector('[data-rp-home-open-rank-clear-confirm]') || null;
  }

  function hideConfirm() {
    const confirm = getConfirm();
    if (confirm) confirm.hidden = true;
  }

  function closeEditor() {
    hideConfirm();
    const backdrop = mountedBackdrop || document.querySelector('[data-rp-home-open-rank-editor]');
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('rp-home-open-rank-editing');
  }

  function setClearing(next) {
    clearing = Boolean(next);
    const backdrop = mountedBackdrop || document.querySelector('[data-rp-home-open-rank-editor]');
    const openButton = backdrop?.querySelector('[data-rp-home-open-rank-clear-list]');
    const confirmButton = backdrop?.querySelector('[data-rp-home-open-rank-clear-confirm-button]');
    const saveButton = backdrop?.querySelector('[data-rp-home-open-rank-edit-save]');
    const deleteButton = backdrop?.querySelector('[data-rp-home-open-rank-delete]');
    if (openButton) openButton.disabled = clearing;
    if (saveButton) saveButton.disabled = clearing;
    if (deleteButton) deleteButton.disabled = clearing;
    if (confirmButton) {
      confirmButton.disabled = clearing;
      confirmButton.textContent = clearing ? 'CLEARING…' : 'CLEAR PLAYER LIST';
    }
  }

  async function performClear(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (clearing) return;

    // Close the confirmation immediately so the tap always has visible feedback.
    hideConfirm();
    setClearing(true);
    editorStatus('Clearing current Ranking Game player list…');

    try {
      const result = await clearSchedule();
      editorStatus(result?.message || 'Current Ranking Game player list cleared.');

      const detail = {
        source: 'home-open-rank-admin-clear-list',
        sessionId: result?.session?.id || null,
        removedPlayers: Number(result?.removedPlayers || 0),
        releasedTokens: Number(result?.releasedTokens || 0),
      };
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed', { detail }));
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail }));
      try { window.RealPlayRankingGames?.refresh?.(); } catch (_error) {}

      // Return the admin to Home after the successful destructive action.
      window.setTimeout(closeEditor, 180);
    } catch (error) {
      editorStatus(error?.message || 'Unable to clear the current player list.', true);
    } finally {
      setClearing(false);
    }
  }

  async function openConfirm(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
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

      const confirm = getConfirm();
      if (!confirm) return;
      const title = confirm.querySelector('#rp-home-open-rank-clear-title');
      const action = confirm.querySelector('[data-rp-home-open-rank-clear-confirm-button]');
      if (title) title.textContent = `CLEAR ${total} PLAYER${total === 1 ? '' : 'S'}?`;
      if (action) action.textContent = `CLEAR ${total} PLAYER${total === 1 ? '' : 'S'}`;
      confirm.hidden = false;
      editorStatus('');
      window.setTimeout(() => action?.focus({ preventScroll: true }), 0);
    } catch (error) {
      editorStatus(error?.message || 'Could not verify the current player list.', true);
    }
  }

  function ensureUi(backdrop) {
    if (!backdrop) return false;
    const header = backdrop.querySelector('.rp-home-open-rank-edit-head');
    const editorClose = header?.querySelector('[data-rp-home-open-rank-edit-close]');
    if (!header || !editorClose) return false;

    let openButton = header.querySelector('[data-rp-home-open-rank-clear-list]');
    if (!openButton) {
      openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'rp-home-open-rank-edit-clear-list';
      openButton.dataset.rpHomeOpenRankClearList = '1';
      openButton.setAttribute('aria-label', 'Clear all players from the current Ranking Game list');
      openButton.setAttribute('title', 'Clear current player list');
      openButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10"/><path d="M4 12h7"/><path d="M4 18h6"/><path d="m15 14 5 5"/><path d="m20 14-5 5"/></svg><span>CLEAR LIST</span>';
      const deleteButton = header.querySelector('[data-rp-home-open-rank-delete]');
      header.insertBefore(openButton, deleteButton || editorClose);
      openButton.addEventListener('click', openConfirm);
    }

    let confirm = backdrop.querySelector('[data-rp-home-open-rank-clear-confirm]');
    if (!confirm) {
      confirm = document.createElement('div');
      confirm.className = 'rp-home-open-rank-clear-confirm';
      confirm.dataset.rpHomeOpenRankClearConfirm = '1';
      confirm.hidden = true;
      confirm.innerHTML = `
        <section class="rp-home-open-rank-clear-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="rp-home-open-rank-clear-title">
          <button type="button" class="rp-home-open-rank-clear-close" data-rp-home-open-rank-clear-close aria-label="Close confirmation">×</button>
          <small>CLEAR CURRENT PLAYER LIST</small>
          <strong id="rp-home-open-rank-clear-title">CLEAR ALL PLAYERS?</strong>
          <p>Removes everyone from Secured, Standby, and Overflow for the current Ranking Game only. The schedule, completed games, stats, OVR, and player history stay untouched. Eligible committed Play Tokens are returned.</p>
          <button type="button" class="rp-home-open-rank-clear-confirm-button" data-rp-home-open-rank-clear-confirm-button>CLEAR PLAYER LIST</button>
        </section>`;
      backdrop.appendChild(confirm);

      confirm.querySelector('[data-rp-home-open-rank-clear-confirm-button]')?.addEventListener('click', performClear);
      confirm.querySelector('[data-rp-home-open-rank-clear-close]')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!clearing) hideConfirm();
      });
      confirm.addEventListener('click', (event) => {
        if (event.target === confirm && !clearing) hideConfirm();
      });
    }

    mountedBackdrop = backdrop;
    return true;
  }

  function mount() {
    installStyles();
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop) return false;
    return ensureUi(backdrop);
  }

  const observer = new MutationObserver(() => {
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop) return;
    if (backdrop !== mountedBackdrop) mount();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(mount, 0);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !clearing) hideConfirm();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
