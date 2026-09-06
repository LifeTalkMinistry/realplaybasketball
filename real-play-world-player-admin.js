(() => {
  if (window.__realPlayWorldPlayerAdminInstalled) return;
  window.__realPlayWorldPlayerAdminInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  const HOLD_MS = 650;

  let panel = null;
  let list = null;
  let sheet = null;
  let isAdmin = false;
  let adminChecked = false;
  let syncBusy = false;
  let adminPlayers = new Map();
  let selectedPlayer = null;
  let holdTimer = null;
  let holdRow = null;
  let holdStartX = 0;
  let holdStartY = 0;
  let suppressClickUntil = 0;
  let suppressPlayerId = null;
  let listObserver = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function adminCall(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }
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
      const error = new Error(data?.message || data?.error || 'Player admin action failed.');
      error.status = response.status;
      error.code = data?.code || '';
      error.details = data?.details || null;
      throw error;
    }
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-player-admin-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpPlayerAdminStyles = '1';
    style.textContent = `
      .rp-world-player-row.rp-admin-holding{position:relative;overflow:hidden;border-color:rgba(66,214,255,.24)!important;background:#07111b!important}
      .rp-world-player-row.rp-admin-holding::after{content:'';position:absolute;left:0;bottom:0;height:2px;width:0;background:#45d8ff;animation:rpAdminHold ${HOLD_MS}ms linear forwards}
      @keyframes rpAdminHold{to{width:100%}}
      .rp-world-player-row.rp-admin-suspended{opacity:.72;border-style:dashed}
      .rp-world-player-admin-right{display:flex;align-items:center;gap:7px;justify-content:flex-end}
      .rp-world-player-admin-right>em{padding:4px 6px;border:1px solid rgba(255,95,111,.16);border-radius:999px;color:#ff8390;background:rgba(255,47,72,.06);font-size:.38rem;font-style:normal;font-weight:950;letter-spacing:.08em}
      .rp-world-player-admin-right>em.inactive{color:#8795a6;border-color:rgba(255,255,255,.08);background:#090d13}
      .rp-player-admin-sheet{position:fixed;z-index:590;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.66);backdrop-filter:blur(8px);padding:18px 12px max(12px,env(safe-area-inset-bottom))}
      .rp-player-admin-sheet.open{display:flex}
      .rp-player-admin-card{width:min(100%,520px);max-height:min(82vh,720px);overflow-y:auto;border:1px solid rgba(255,255,255,.11);border-radius:22px;background:linear-gradient(180deg,#0a0f17,#04070c);box-shadow:0 -24px 70px rgba(0,0,0,.5);color:#f5f9ff;font-family:var(--rp-body,Arial,sans-serif)}
      .rp-player-admin-head{position:sticky;top:0;z-index:2;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(7,11,17,.96);backdrop-filter:blur(14px)}
      .rp-player-admin-head small{display:block;color:#45d8ff;font-size:.46rem;font-weight:950;letter-spacing:.13em}
      .rp-player-admin-head strong{display:block;margin-top:3px;font-family:var(--rp-display,Arial,sans-serif);font-size:.94rem;font-style:italic;font-weight:950;letter-spacing:.025em;text-transform:uppercase}
      .rp-player-admin-head button{width:36px;height:36px;border:1px solid rgba(255,255,255,.09);border-radius:11px;color:#aab5c3;background:#080d14;font-size:1.05rem}
      .rp-player-admin-body{padding:15px}
      .rp-player-admin-identity{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:#060b12}
      .rp-player-admin-identity strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.82rem;font-style:italic;font-weight:950;text-transform:uppercase}
      .rp-player-admin-identity span{display:block;margin-top:3px;color:#627287;font-size:.48rem;font-weight:850;letter-spacing:.06em}
      .rp-player-admin-identity b{color:#46d9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1rem;font-weight:950}
      .rp-player-admin-status{min-height:16px;margin:9px 3px 0;color:#728196;font-size:.54rem;font-weight:800;text-align:center;line-height:1.35}
      .rp-player-admin-status.error{color:#ff7f8e}.rp-player-admin-status.success{color:#53dfad}
      .rp-player-admin-actions{display:grid;gap:8px;margin-top:11px}
      .rp-player-admin-action{min-height:45px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 13px;border:1px solid rgba(255,255,255,.075);border-radius:13px;color:#dbe5ef;background:#070c13;text-align:left;font-family:var(--rp-display,Arial,sans-serif);font-size:.58rem;font-weight:950;letter-spacing:.055em}
      .rp-player-admin-action span{color:#53657a;font-size:.8rem}.rp-player-admin-action.warn{color:#ffd17a;border-color:rgba(255,190,78,.14);background:rgba(115,70,7,.06)}.rp-player-admin-action.danger{color:#ff8794;border-color:rgba(255,73,94,.18);background:rgba(120,14,27,.08)}
      .rp-player-admin-action:disabled{opacity:.42}
      .rp-player-admin-form{display:grid;gap:10px;margin-top:12px}
      .rp-player-admin-form label{display:grid;gap:6px;color:#748397;font-size:.48rem;font-weight:900;letter-spacing:.08em}
      .rp-player-admin-form input{width:100%;min-height:44px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:0 12px;outline:0;color:#eef6ff;background:#050910;font:700 16px var(--rp-body,Arial,sans-serif)}
      .rp-player-admin-form input:focus{border-color:rgba(71,215,255,.38)}
      .rp-player-admin-warning{margin:11px 0 0;padding:12px 13px;border:1px solid rgba(255,187,67,.13);border-radius:13px;color:#b9a789;background:rgba(100,61,8,.06);font-size:.6rem;line-height:1.5}
      .rp-player-admin-warning.danger{border-color:rgba(255,73,94,.17);color:#c99aa1;background:rgba(115,12,25,.08)}
      .rp-player-admin-form-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin-top:3px}
      .rp-player-admin-form-actions button{min-height:43px;border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#8d9bad;background:#070c13;font-family:var(--rp-display,Arial,sans-serif);font-size:.55rem;font-weight:950;letter-spacing:.06em}
      .rp-player-admin-form-actions button.primary{color:#001018;border-color:#46d9ff;background:#46d9ff}.rp-player-admin-form-actions button.warn{color:#1a1000;border-color:#ffc45f;background:#ffc45f}.rp-player-admin-form-actions button.danger{color:#fff;border-color:#d83248;background:#b71f34}
      .rp-player-admin-form-actions button:disabled{opacity:.4}
      @media(max-width:380px){.rp-player-admin-sheet{padding-inline:8px}.rp-player-admin-card{border-radius:18px}.rp-player-admin-body{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function createSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('section');
    sheet.className = 'rp-player-admin-sheet';
    sheet.dataset.rpPlayerAdminSheet = 'true';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = `
      <div class="rp-player-admin-card" role="dialog" aria-modal="true" aria-label="Player admin actions">
        <header class="rp-player-admin-head">
          <div><small>ADMIN · PLAYER MANAGEMENT</small><strong data-rp-player-admin-title>PLAYER ACTIONS</strong></div>
          <button type="button" data-rp-player-admin-close aria-label="Close player admin actions">×</button>
        </header>
        <div class="rp-player-admin-body" data-rp-player-admin-body></div>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet || event.target.closest('[data-rp-player-admin-close]')) closeSheet();
    });
    sheet.querySelector('[data-rp-player-admin-body]')?.addEventListener('click', handleSheetClick);
    sheet.querySelector('[data-rp-player-admin-body]')?.addEventListener('input', handleSheetInput);
    return sheet;
  }

  function playerStatus(player) {
    return String(player?.status || player?.memberStatus || player?.accountStatus || 'active').toLowerCase();
  }

  function playerNumberLabel(player) {
    return player?.playerNumber === null || player?.playerNumber === undefined ? '#—' : `#${Number(player.playerNumber)}`;
  }

  function playerOvrLabel(player) {
    return player?.ovr === null || player?.ovr === undefined ? 'UNRANKED' : `${player.ovr} OVR`;
  }

  function identityMarkup(player) {
    return `
      <div class="rp-player-admin-identity">
        <div><strong>${esc(player?.playerName || 'REAL PLAY PLAYER')} ${esc(playerNumberLabel(player))}</strong><span>${esc(playerStatus(player).toUpperCase())} · ${esc(playerOvrLabel(player))}</span></div>
        <b>${player?.ovr === null || player?.ovr === undefined ? '—' : esc(player.ovr)}</b>
      </div>`;
  }

  function setSheetStatus(message = '', type = '') {
    const node = sheet?.querySelector('[data-rp-player-admin-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function renderMain() {
    const body = sheet?.querySelector('[data-rp-player-admin-body]');
    if (!body || !selectedPlayer) return;
    const status = playerStatus(selectedPlayer);
    const suspended = status === 'suspended' || status === 'inactive';
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <div class="rp-player-admin-actions">
        <button type="button" class="rp-player-admin-action" data-admin-menu-action="view" ${suspended ? 'disabled' : ''}>VIEW PLAYER PROFILE <span>›</span></button>
        <button type="button" class="rp-player-admin-action" data-admin-menu-action="edit_name">EDIT PLAYER NAME <span>›</span></button>
        <button type="button" class="rp-player-admin-action" data-admin-menu-action="change_jersey">CHANGE JERSEY NUMBER <span>›</span></button>
        <button type="button" class="rp-player-admin-action warn" data-admin-menu-action="reset_competitive">RESET COMPETITIVE RECORD <span>›</span></button>
        <button type="button" class="rp-player-admin-action ${suspended ? '' : 'warn'}" data-admin-menu-action="${suspended ? 'reactivate' : 'suspend'}">${suspended ? 'REACTIVATE PLAYER' : 'SUSPEND PLAYER'} <span>›</span></button>
        <button type="button" class="rp-player-admin-action danger" data-admin-menu-action="delete_account">DELETE ACCOUNT PERMANENTLY <span>›</span></button>
      </div>`;
    if (suspended) setSheetStatus('This player is hidden from the normal player directory until reactivated.');
  }

  function renderEditName() {
    const body = sheet.querySelector('[data-rp-player-admin-body]');
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <form class="rp-player-admin-form" data-admin-form="edit_name">
        <label>PLAYER NAME<input name="playerName" type="text" minlength="2" maxlength="60" value="${esc(selectedPlayer.playerName || '')}" required /></label>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-back>BACK</button><button class="primary" type="submit">SAVE NAME</button></div>
      </form>`;
    body.querySelector('input')?.focus();
  }

  function renderChangeJersey() {
    const body = sheet.querySelector('[data-rp-player-admin-body]');
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <form class="rp-player-admin-form" data-admin-form="change_jersey">
        <label>NEW JERSEY NUMBER<input name="playerNumber" type="number" min="0" max="99" inputmode="numeric" value="${selectedPlayer.playerNumber ?? ''}" placeholder="0–99" required /></label>
        <p class="rp-player-admin-warning">This changes the player's current-month jersey assignment. A number already owned by another player cannot be taken.</p>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-back>BACK</button><button class="primary" type="submit">CHANGE NUMBER</button></div>
      </form>`;
    body.querySelector('input')?.focus();
  }

  function renderReset() {
    const body = sheet.querySelector('[data-rp-player-admin-body]');
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <form class="rp-player-admin-form" data-admin-form="reset_competitive">
        <p class="rp-player-admin-warning">This removes this player's finalized Ranking game entries, official stats, W/L record and OVR. Existing final team scores stay recorded, and leaderboard ratings may recalculate. This cannot be undone from the app.</p>
        <label>TYPE RESET TO CONFIRM<input name="confirmation" type="text" autocomplete="off" data-admin-confirm-word="RESET" placeholder="RESET" required /></label>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-back>BACK</button><button class="warn" type="submit" data-admin-confirm-submit disabled>RESET RECORD</button></div>
      </form>`;
    body.querySelector('input')?.focus();
  }

  function renderSuspension(reactivate = false) {
    const body = sheet.querySelector('[data-rp-player-admin-body]');
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <form class="rp-player-admin-form" data-admin-form="${reactivate ? 'reactivate' : 'suspend'}">
        <p class="rp-player-admin-warning ${reactivate ? '' : 'danger'}">${reactivate
          ? 'Reactivating restores this player’s Real Play access. Their existing history remains intact.'
          : 'Suspension blocks Real Play account access and hides the player from the normal directory. Their verified basketball history is preserved.'}</p>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-back>BACK</button><button class="${reactivate ? 'primary' : 'warn'}" type="submit">${reactivate ? 'REACTIVATE' : 'SUSPEND PLAYER'}</button></div>
      </form>`;
  }

  function renderDelete() {
    const body = sheet.querySelector('[data-rp-player-admin-body]');
    body.innerHTML = `
      ${identityMarkup(selectedPlayer)}
      <p class="rp-player-admin-status" data-rp-player-admin-status></p>
      <form class="rp-player-admin-form" data-admin-form="delete_account">
        <p class="rp-player-admin-warning danger">Permanent deletion removes the Real Play account, player profile, jersey assignments, community posts/chat, membership/support records and attached competitive data. Use suspension instead when you only need to restrict access.</p>
        <label>TYPE DELETE TO CONFIRM<input name="confirmation" type="text" autocomplete="off" data-admin-confirm-word="DELETE" placeholder="DELETE" required /></label>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-back>BACK</button><button class="danger" type="submit" data-admin-confirm-submit disabled>DELETE ACCOUNT</button></div>
      </form>`;
    body.querySelector('input')?.focus();
  }

  function openSheet(player) {
    selectedPlayer = player;
    createSheet();
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    renderMain();
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    selectedPlayer = null;
  }

  function handleSheetInput(event) {
    const input = event.target.closest('[data-admin-confirm-word]');
    if (!input) return;
    const form = input.closest('form');
    const submit = form?.querySelector('[data-admin-confirm-submit]');
    if (!submit) return;
    submit.disabled = String(input.value || '').trim().toUpperCase() !== input.dataset.adminConfirmWord;
  }

  async function submitAdminAction(form) {
    if (!selectedPlayer) return;
    const action = form.dataset.adminForm;
    const submit = form.querySelector('button[type="submit"]');
    if (submit?.dataset.busy === 'true') return;
    if (submit) {
      submit.dataset.busy = 'true';
      submit.disabled = true;
    }
    setSheetStatus('SAVING...');

    try {
      const payload = { playerId: selectedPlayer.userId };
      const data = new FormData(form);
      if (action === 'edit_name') payload.playerName = String(data.get('playerName') || '').trim();
      if (action === 'change_jersey') payload.playerNumber = Number(data.get('playerNumber'));
      if (action === 'reset_competitive' || action === 'delete_account') {
        payload.confirmation = String(data.get('confirmation') || '').trim();
      }

      const result = await adminCall(action, payload);
      setSheetStatus(result?.message || 'Player updated.', 'success');
      if (result?.player) selectedPlayer = { ...selectedPlayer, ...result.player };

      await refreshAdminDirectory();
      window.RealPlayPlayers?.refresh?.();
      window.setTimeout(() => {
        decorateRows();
        if (action === 'delete_account') closeSheet();
        else renderMain();
      }, 350);
    } catch (error) {
      setSheetStatus(error.message || 'Could not complete that admin action.', 'error');
      if (submit) {
        submit.dataset.busy = 'false';
        submit.disabled = false;
      }
    }
  }

  function handleSheetClick(event) {
    if (event.target.closest('[data-admin-back]')) {
      renderMain();
      return;
    }

    const menu = event.target.closest('[data-admin-menu-action]');
    if (menu) {
      const action = menu.dataset.adminMenuAction;
      if (action === 'view') {
        const playerId = selectedPlayer?.userId;
        closeSheet();
        if (playerId) window.RealPlayPlayers?.openProfile?.(playerId);
      } else if (action === 'edit_name') renderEditName();
      else if (action === 'change_jersey') renderChangeJersey();
      else if (action === 'reset_competitive') renderReset();
      else if (action === 'suspend') renderSuspension(false);
      else if (action === 'reactivate') renderSuspension(true);
      else if (action === 'delete_account') renderDelete();
    }
  }

  function formSubmitHandler(event) {
    const form = event.target.closest('form[data-admin-form]');
    if (!form) return;
    event.preventDefault();
    submitAdminAction(form);
  }

  function rowPlayer(row) {
    const id = Number(row?.dataset?.worldPlayerId);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const known = adminPlayers.get(id);
    if (known) return known;

    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || 'REAL PLAY PLAYER').trim();
    const jerseyText = String(row.querySelector('.rp-world-player-name b')?.textContent || '').trim();
    const jerseyMatch = jerseyText.match(/#\s*(\d{1,2})/);
    const ovrNode = row.querySelector('.rp-world-player-ovr');
    const ovr = !ovrNode || ovrNode.classList.contains('unranked')
      ? null
      : Number.parseFloat(String(ovrNode.textContent || '').replace(/[^0-9.\-]/g, ''));
    return {
      userId: id,
      playerName: name,
      playerNumber: jerseyMatch ? Number(jerseyMatch[1]) : null,
      ovr: Number.isFinite(ovr) ? ovr : null,
      status: row.dataset.worldPlayerStatus || 'active',
    };
  }

  function adminRowMarkup(player) {
    const jersey = playerNumberLabel(player);
    const status = playerStatus(player);
    const rating = player?.ovr === null || player?.ovr === undefined
      ? '<span class="rp-world-player-ovr unranked">UNRANKED</span>'
      : `<span class="rp-world-player-ovr">${esc(player.ovr)} <small>OVR</small></span>`;
    return `
      <button type="button" class="rp-world-player-row rp-admin-suspended" data-world-player-id="${esc(player.userId)}" data-world-player-status="${esc(status)}" aria-label="Manage ${esc(player.playerName)} player account">
        <span class="rp-world-player-name"><strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong><b>${esc(jersey)}</b></span>
        <span class="rp-world-player-admin-right"><em class="${status === 'inactive' ? 'inactive' : ''}">${esc(status.toUpperCase())}</em>${rating}</span>
      </button>`;
  }

  function decorateRows() {
    if (!list || !isAdmin) return;
    const seen = new Set();
    list.querySelectorAll('.rp-world-player-row[data-world-player-id]').forEach((row) => {
      const id = Number(row.dataset.worldPlayerId);
      if (!Number.isSafeInteger(id)) return;
      seen.add(id);
      const player = adminPlayers.get(id);
      if (!player) return;
      const status = playerStatus(player);
      row.dataset.worldPlayerStatus = status;
      row.classList.toggle('rp-admin-suspended', status !== 'active');
      row.title = 'Admin: long hold for player actions';
    });

    for (const player of adminPlayers.values()) {
      if (seen.has(Number(player.userId))) continue;
      if (playerStatus(player) === 'active') continue;
      list.insertAdjacentHTML('beforeend', adminRowMarkup(player));
    }
  }

  async function refreshAdminDirectory() {
    if (syncBusy || !token()) return;
    syncBusy = true;
    try {
      const data = await adminCall('list');
      isAdmin = data?.admin === true;
      adminChecked = true;
      const next = new Map();
      (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
        const id = Number(player?.userId);
        if (Number.isSafeInteger(id) && id > 0) next.set(id, player);
      });
      adminPlayers = next;
      decorateRows();
    } catch (error) {
      adminChecked = true;
      if (error.status === 403 || error.status === 401 || error.status === 404) {
        isAdmin = false;
        adminPlayers = new Map();
      }
    } finally {
      syncBusy = false;
    }
  }

  function cancelHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = null;
    holdRow?.classList.remove('rp-admin-holding');
    holdRow = null;
  }

  function startHold(event) {
    if (!isAdmin || sheet?.classList.contains('open')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const row = event.target.closest('.rp-world-player-row[data-world-player-id]');
    if (!row || !list?.contains(row)) return;
    cancelHold();
    holdRow = row;
    holdStartX = event.clientX;
    holdStartY = event.clientY;
    row.classList.add('rp-admin-holding');
    holdTimer = window.setTimeout(() => {
      const activeRow = holdRow;
      holdTimer = null;
      if (!activeRow) return;
      activeRow.classList.remove('rp-admin-holding');
      const player = rowPlayer(activeRow);
      holdRow = null;
      if (!player) return;
      suppressClickUntil = Date.now() + 900;
      suppressPlayerId = Number(player.userId);
      openSheet(player);
    }, HOLD_MS);
  }

  function moveHold(event) {
    if (!holdRow || !holdTimer) return;
    const dx = Math.abs(event.clientX - holdStartX);
    const dy = Math.abs(event.clientY - holdStartY);
    if (dx > 10 || dy > 10) cancelHold();
  }

  function handleListClickCapture(event) {
    const row = event.target.closest('.rp-world-player-row[data-world-player-id]');
    if (!row) return;
    const id = Number(row.dataset.worldPlayerId);
    if (Date.now() < suppressClickUntil && id === suppressPlayerId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
      suppressPlayerId = null;
      return;
    }

    if (isAdmin && row.dataset.worldPlayerStatus && row.dataset.worldPlayerStatus !== 'active') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const player = rowPlayer(row);
      if (player) openSheet(player);
    }
  }

  function handleContextMenu(event) {
    if (!isAdmin) return;
    const row = event.target.closest('.rp-world-player-row[data-world-player-id]');
    if (!row) return;
    event.preventDefault();
    const player = rowPlayer(row);
    if (player) openSheet(player);
  }

  function install() {
    panel = document.querySelector('[data-rp-world]');
    const playersView = panel?.querySelector('[data-world-view="players"]');
    list = playersView?.querySelector('[data-world-player-list]') || null;
    if (!panel || !playersView || !list) return false;

    createSheet();
    sheet.querySelector('[data-rp-player-admin-body]')?.addEventListener('submit', formSubmitHandler);

    list.addEventListener('pointerdown', startHold, { passive: true });
    list.addEventListener('pointermove', moveHold, { passive: true });
    list.addEventListener('pointerup', cancelHold, { passive: true });
    list.addEventListener('pointercancel', cancelHold, { passive: true });
    list.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') cancelHold();
    }, { passive: true });
    list.addEventListener('click', handleListClickCapture, true);
    list.addEventListener('contextmenu', handleContextMenu);

    const playersTab = panel.querySelector('[data-world-tab="players"]');
    playersTab?.addEventListener('click', () => window.setTimeout(refreshAdminDirectory, 250));

    listObserver = new MutationObserver(() => {
      if (isAdmin) window.requestAnimationFrame(decorateRows);
    });
    listObserver.observe(list, { childList: true });

    refreshAdminDirectory();
    return true;
  }

  installStyles();
  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('focus', () => {
    if (panel?.classList.contains('open') && !panel.querySelector('[data-world-view="players"]')?.hidden) {
      refreshAdminDirectory();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet?.classList.contains('open')) closeSheet();
  });

  window.RealPlayPlayerAdmin = {
    refresh: refreshAdminDirectory,
    isAdmin: () => isAdmin,
    checked: () => adminChecked,
  };
})();
