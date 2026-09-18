(() => {
  if (window.__realPlayAdminPlayerScheduleInstalled) return;
  window.__realPlayAdminPlayerScheduleInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';

  let selectedPlayerId = null;
  let sheetBody = null;
  let bodyObserver = null;
  let mainMarkup = '';
  let identityMarkup = '';
  let actionBusy = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_error) { return ''; }
  }

  async function adminCall(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) throw new Error('Please log in to Real Play first.');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Could not update the player schedule.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-admin-player-schedule-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpAdminPlayerScheduleStyles = '1';
    style.textContent = `
      .rp-player-admin-action.schedule{color:#66ddff;border-color:rgba(72,215,255,.2);background:rgba(20,112,153,.07)}
      .rp-admin-schedule-option{min-height:60px!important;padding-block:9px!important}
      .rp-admin-schedule-option>div{display:grid;gap:3px;min-width:0}
      .rp-admin-schedule-option strong{color:inherit;font-family:var(--rp-display,Arial,sans-serif);font-size:.6rem;font-weight:950;letter-spacing:.055em}
      .rp-admin-schedule-option small{color:#75869a;font-family:var(--rp-body,Arial,sans-serif);font-size:.48rem;font-weight:800;letter-spacing:.025em;line-height:1.3}
      .rp-admin-schedule-option.token{color:#64ddff;border-color:rgba(72,215,255,.2);background:rgba(18,104,139,.08)}
      .rp-admin-schedule-option.standby{color:#dbe5ef}
      .rp-admin-schedule-meta{display:grid;gap:4px;margin-top:11px;padding:12px 13px;border:1px solid rgba(72,215,255,.14);border-radius:13px;background:rgba(15,94,128,.06)}
      .rp-admin-schedule-meta span{color:#65dfff;font-size:.46rem;font-weight:950;letter-spacing:.09em}
      .rp-admin-schedule-meta strong{color:#dfeaf4;font-family:var(--rp-display,Arial,sans-serif);font-size:.65rem;font-weight:950;letter-spacing:.03em;text-transform:uppercase}
      .rp-admin-schedule-meta small{color:#8091a5;font-size:.5rem;font-weight:800;line-height:1.4}
    `;
    document.head.appendChild(style);
  }

  function capturePlayer(event) {
    const row = event.target instanceof Element
      ? event.target.closest('.rp-world-player-row[data-world-player-id]')
      : null;
    if (!row) return;
    const id = Number(row.dataset.worldPlayerId);
    if (Number.isSafeInteger(id) && id > 0) selectedPlayerId = id;
  }

  function formatStart(value) {
    if (!value) return 'UPCOMING SESSION';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'UPCOMING SESSION';
    try {
      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch (_error) {
      return date.toLocaleString();
    }
  }

  function setStatus(message = '', type = '') {
    const status = sheetBody?.querySelector('[data-rp-admin-schedule-status]');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function enhanceMain() {
    if (!sheetBody) return;
    const changeJersey = sheetBody.querySelector('[data-admin-menu-action="change_jersey"]');
    if (!changeJersey || sheetBody.querySelector('[data-admin-schedule-open]')) return;

    const unclaimed = Boolean(sheetBody.querySelector('[data-admin-menu-action="attach_account"]'));
    const view = sheetBody.querySelector('[data-admin-menu-action="view"]');
    const unavailable = Boolean(view?.disabled);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-player-admin-action schedule';
    button.dataset.adminScheduleOpen = '1';
    button.disabled = unavailable;
    button.innerHTML = `ADD TO UPCOMING SCHEDULE <span>›</span>`;
    if (unclaimed) button.title = 'Add this unclaimed basketball identity as admin Priority or Standby.';
    else if (unavailable) button.title = 'Reactivate this player before scheduling.';
    changeJersey.insertAdjacentElement('afterend', button);
  }

  function restoreMain() {
    if (!sheetBody || !mainMarkup) return;
    sheetBody.innerHTML = mainMarkup;
    mainMarkup = '';
    identityMarkup = '';
    actionBusy = false;
    enhanceMain();
  }

  function renderLoading() {
    if (!sheetBody) return;
    sheetBody.innerHTML = `
      ${identityMarkup}
      <p class="rp-player-admin-status" data-rp-admin-schedule-status>LOADING UPCOMING SCHEDULE…</p>
      <div class="rp-player-admin-form-actions"><button type="button" data-admin-schedule-back>BACK</button><button type="button" disabled>LOADING…</button></div>`;
  }

  function renderSchedule(state, message = '', messageType = '') {
    if (!sheetBody) return;
    const session = state?.session || null;
    const entry = state?.entry || null;
    const availableTokens = Math.max(0, Number(state?.tokens?.available || 0));
    const playerActive = String(state?.player?.status || 'active').toLowerCase() === 'active';
    const unclaimed = Boolean(state?.player?.unclaimed);
    const currentToken = entry?.entryType === 'token' && entry?.paymentStatus === 'token_committed';
    const currentAdminPriority = entry?.entryType === 'admin_priority';
    const currentStandby = entry?.entryType === 'standby';
    const tokenLocked = Boolean(state?.tokenCancellation?.locked);
    const canUseToken = Boolean(session && playerActive);
    const canStandby = Boolean(session && playerActive && !tokenLocked);

    let current = 'NOT SCHEDULED';
    if (currentAdminPriority) current = 'CURRENT · PRIORITY — ADMIN';
    else if (currentToken) current = 'CURRENT · PRIORITY — PLAY TOKEN';
    else if (currentStandby) current = 'CURRENT · FREE STANDBY';
    else if (entry?.entryType === 'pay_to_play') current = 'CURRENT · PAY TO PLAY';
    else if (entry) current = `CURRENT · ${String(entry.status || 'SCHEDULED').toUpperCase()}`;

    const tokenNote = currentAdminPriority
      ? 'Already secured by Admin Priority · no player Play Token is required'
      : currentToken
        ? 'Already secured with the player’s Play Token · admin action will not deduct another token'
        : unclaimed
          ? 'Admin Priority · secures this unclaimed player without requiring an account token'
          : 'Admin Priority · secures this player without using a Play Token';
    const standbyNote = tokenLocked
      ? 'Current token booking is locked and can no longer be changed to Standby'
      : 'No token used · player can enter only if a secured spot opens';

    const sessionMeta = session
      ? `<div class="rp-admin-schedule-meta">
          <span>UPCOMING RANKING GAME</span>
          <strong>${esc(session.title || 'OPEN RANKING')}</strong>
          <small>${esc(formatStart(session.startsAt))}${session.locationName ? ` · ${esc(session.locationName)}` : ''}</small>
          <small>${esc(current)}</small>
        </div>`
      : `<p class="rp-player-admin-warning">There is no open upcoming Ranking Game available right now.</p>`;

    sheetBody.innerHTML = `
      ${identityMarkup}
      <p class="rp-player-admin-status ${messageType === 'error' ? 'error' : messageType === 'success' ? 'success' : ''}" data-rp-admin-schedule-status>${esc(message)}</p>
      ${sessionMeta}
      <div class="rp-player-admin-actions">
        <button type="button" class="rp-player-admin-action rp-admin-schedule-option token" data-admin-schedule-choice="token" ${canUseToken ? '' : 'disabled'}>
          <div><strong>PRIORITY — ADMIN SECURE</strong><small>${esc(tokenNote)}</small></div><span>›</span>
        </button>
        <button type="button" class="rp-player-admin-action rp-admin-schedule-option standby" data-admin-schedule-choice="standby" ${canStandby ? '' : 'disabled'}>
          <div><strong>ADD AS STANDBY</strong><small>${esc(standbyNote)}</small></div><span>›</span>
        </button>
      </div>
      <div class="rp-player-admin-form-actions" style="margin-top:10px"><button type="button" data-admin-schedule-back>BACK</button><button type="button" disabled>${unclaimed ? 'ADMIN SCHEDULING' : `${availableTokens} TOKEN${availableTokens === 1 ? '' : 'S'} LEFT`}</button></div>`;
  }

  async function openSchedule() {
    if (!sheetBody || !selectedPlayerId) {
      const status = sheetBody?.querySelector('[data-rp-player-admin-status]');
      if (status) {
        status.textContent = 'Could not identify this player. Close Player Actions and open it again.';
        status.classList.add('error');
      }
      return;
    }

    mainMarkup = sheetBody.innerHTML;
    identityMarkup = sheetBody.querySelector('.rp-player-admin-identity')?.outerHTML || '';
    renderLoading();

    try {
      const state = await adminCall('schedule_access', { playerId: selectedPlayerId });
      renderSchedule(state);
    } catch (error) {
      renderSchedule(null, error.message || 'Could not load the upcoming schedule.', 'error');
    }
  }

  async function chooseSchedule(entryType) {
    if (actionBusy || !selectedPlayerId) return;
    actionBusy = true;
    const buttons = sheetBody?.querySelectorAll('[data-admin-schedule-choice]') || [];
    buttons.forEach((button) => { button.disabled = true; });
    setStatus(entryType === 'token' ? 'ADDING PRIORITY SPOT…' : 'ADDING TO STANDBY…');

    try {
      const result = await adminCall('add_to_schedule', {
        playerId: selectedPlayerId,
        entryType,
      });
      renderSchedule(result, result?.message || 'Player schedule updated.', 'success');
      try { window.RealPlayRankingGames?.refresh?.(); } catch (_error) {}
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed', {
        detail: { source: 'admin-player-schedule', playerId: selectedPlayerId },
      }));
    } catch (error) {
      try {
        const state = await adminCall('schedule_access', { playerId: selectedPlayerId });
        renderSchedule(state, error.message || 'Could not update the player schedule.', 'error');
      } catch (_stateError) {
        renderSchedule(null, error.message || 'Could not update the player schedule.', 'error');
      }
    } finally {
      actionBusy = false;
    }
  }

  function attachToSheet() {
    const nextBody = document.querySelector('[data-rp-player-admin-sheet] [data-rp-player-admin-body]');
    if (!nextBody) return false;
    if (sheetBody === nextBody) {
      enhanceMain();
      return true;
    }

    bodyObserver?.disconnect();
    sheetBody = nextBody;
    bodyObserver = new MutationObserver(() => enhanceMain());
    bodyObserver.observe(sheetBody, { childList: true, subtree: false });
    enhanceMain();
    return true;
  }

  installStyles();

  document.addEventListener('pointerdown', capturePlayer, true);
  document.addEventListener('contextmenu', capturePlayer, true);
  document.addEventListener('click', (event) => {
    capturePlayer(event);
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-admin-schedule-open]')) {
      event.preventDefault();
      openSchedule();
      return;
    }
    if (target.closest('[data-admin-schedule-back]')) {
      event.preventDefault();
      restoreMain();
      return;
    }
    const choice = target.closest('[data-admin-schedule-choice]');
    if (choice && !choice.disabled) {
      event.preventDefault();
      chooseSchedule(choice.dataset.adminScheduleChoice);
    }
  });

  if (!attachToSheet()) {
    const observer = new MutationObserver(() => {
      if (attachToSheet()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
