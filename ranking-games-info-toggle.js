(() => {
  // Preserve the existing Open Rank information button while this entry file
  // also installs the admin-only roster removal enhancement below.
  const core = document.createElement('script');
  core.src = 'ranking-games-info-toggle-core.js?v=20260918-session-admin-remove-v1';
  core.async = false;
  document.head.appendChild(core);
})();

(() => {
  if (window.__realPlayRankingSessionAdminRemoveInstalled) return;
  window.__realPlayRankingSessionAdminRemoveInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HOLD_MS = 650;
  const MOVE_CANCEL_PX = 10;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  let bindingTimer = 0;
  let bindingBusy = false;
  let holdTimer = 0;
  let holdCard = null;
  let holdPointerId = null;
  let holdStartX = 0;
  let holdStartY = 0;
  let suppressClickUntil = 0;
  let suppressCard = null;
  let selected = null;
  let actionBusy = false;
  let sheet = null;
  let statusNode = null;
  let nameNode = null;
  let detailNode = null;
  let confirmButton = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch (_error) { return ''; }
  }

  function positiveInt(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function isAdmin() {
    return Boolean(window.RealPlayPlayerAdmin?.isAdmin?.());
  }

  function installStyles() {
    if (document.querySelector('[data-rp-session-admin-remove-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpSessionAdminRemoveStyles = 'true';
    style.textContent = `
      .rp-ranking-secured-player.rp-session-admin-holding{border-color:rgba(255,99,116,.42)!important}
      .rp-ranking-secured-player.rp-session-admin-holding::after{
        content:''!important;position:absolute!important;z-index:7!important;left:0!important;bottom:0!important;
        width:0;height:3px!important;pointer-events:none!important;
        background:linear-gradient(90deg,#ff5368,#ff9aa8)!important;
        box-shadow:0 0 14px rgba(255,83,104,.5)!important;
        animation:rpSessionAdminHold ${HOLD_MS}ms linear forwards!important;
      }
      @keyframes rpSessionAdminHold{from{width:0}to{width:100%}}
      .rp-session-admin-remove-backdrop{
        position:fixed;z-index:2900;inset:0;display:flex;align-items:flex-end;justify-content:center;
        padding:16px max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));
        background:rgba(0,0,0,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      }
      .rp-session-admin-remove-backdrop[hidden]{display:none!important}
      .rp-session-admin-remove-sheet{
        width:min(100%,480px);padding:18px;border:1px solid rgba(255,96,116,.24);border-radius:22px;
        background:linear-gradient(155deg,rgba(14,15,22,.99),rgba(4,7,12,.995));
        box-shadow:0 28px 90px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,255,255,.025);
      }
      .rp-session-admin-remove-kicker{display:block;color:#ff7183;font-size:.46rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
      .rp-session-admin-remove-sheet h2{margin:7px 0 0;color:#f7f9fc;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.45rem;font-style:italic;font-weight:950;letter-spacing:.01em;line-height:1;text-transform:uppercase}
      .rp-session-admin-remove-detail{margin:9px 0 0;color:#8798aa;font-size:.59rem;font-weight:800;letter-spacing:.025em;line-height:1.5;text-transform:uppercase}
      .rp-session-admin-remove-warning{margin:14px 0 0;padding:12px 13px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025);color:#93a2b2;font-size:.58rem;font-weight:750;line-height:1.55}
      .rp-session-admin-remove-warning strong{color:#e8eef5}
      .rp-session-admin-remove-status{min-height:18px;margin:11px 0 0;color:#8da0b3;font-size:.53rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
      .rp-session-admin-remove-status.error{color:#ff8797}.rp-session-admin-remove-status.success{color:#71e8c0}
      .rp-session-admin-remove-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
      .rp-session-admin-remove-actions button{min-height:45px;border-radius:12px;font-family:var(--rp-display,Arial,sans-serif);font-size:.57rem;font-weight:950;letter-spacing:.075em;text-transform:uppercase;cursor:pointer}
      .rp-session-admin-remove-cancel{border:1px solid rgba(255,255,255,.09);background:#080d14;color:#9aabba}
      .rp-session-admin-remove-confirm{border:1px solid rgba(255,89,108,.34);background:linear-gradient(180deg,rgba(112,22,37,.48),rgba(49,9,17,.68));color:#ff9aaa}
      .rp-session-admin-remove-actions button:disabled{opacity:.45;cursor:default}
      @media(min-width:700px){.rp-session-admin-remove-backdrop{align-items:center}.rp-session-admin-remove-sheet{border-radius:22px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSheet() {
    if (sheet) return sheet;
    const backdrop = document.createElement('div');
    backdrop.className = 'rp-session-admin-remove-backdrop';
    backdrop.dataset.rpSessionAdminRemove = 'true';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="rp-session-admin-remove-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-session-admin-remove-title">
        <small class="rp-session-admin-remove-kicker">ADMIN · OPEN RANK</small>
        <h2 id="rp-session-admin-remove-title" data-rp-session-admin-remove-name>REMOVE PLAYER?</h2>
        <p class="rp-session-admin-remove-detail" data-rp-session-admin-remove-detail>CURRENT SESSION ENTRY</p>
        <p class="rp-session-admin-remove-warning"><strong>This only removes the player's current Open Rank reservation / standby entry.</strong><br>It does not delete the player, profile, OVR, Rank, stats, or game history.</p>
        <p class="rp-session-admin-remove-status" data-rp-session-admin-remove-status></p>
        <div class="rp-session-admin-remove-actions">
          <button class="rp-session-admin-remove-cancel" type="button" data-rp-session-admin-remove-cancel>KEEP PLAYER</button>
          <button class="rp-session-admin-remove-confirm" type="button" data-rp-session-admin-remove-confirm>REMOVE FROM SESSION</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    sheet = backdrop;
    statusNode = backdrop.querySelector('[data-rp-session-admin-remove-status]');
    nameNode = backdrop.querySelector('[data-rp-session-admin-remove-name]');
    detailNode = backdrop.querySelector('[data-rp-session-admin-remove-detail]');
    confirmButton = backdrop.querySelector('[data-rp-session-admin-remove-confirm]');

    backdrop.addEventListener('click', (event) => {
      if (actionBusy) return;
      if (event.target === backdrop || event.target.closest('[data-rp-session-admin-remove-cancel]')) closeSheet();
    });
    confirmButton?.addEventListener('click', removeSelected);
    return backdrop;
  }

  function setStatus(message = '', type = '') {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle('error', type === 'error');
    statusNode.classList.toggle('success', type === 'success');
  }

  function closeSheet() {
    if (!sheet || actionBusy) return;
    sheet.hidden = true;
    document.body.classList.remove('rp-session-admin-remove-open');
    selected = null;
    setStatus('');
  }

  function cardTarget(card) {
    if (!card) return null;
    const playerId = positiveInt(card.dataset.rpSessionPlayerId);
    const accountUserId = positiveInt(card.dataset.rpSessionAccountUserId);
    if (!playerId && !accountUserId) return null;
    return {
      playerId,
      accountUserId,
      playerName: String(card.dataset.rpSessionPlayerName || card.querySelector('.rp-ranking-secured-name')?.textContent || 'REAL PLAY PLAYER').trim(),
      group: String(card.dataset.rpSessionEntryGroup || 'session').trim(),
      card,
    };
  }

  function openSheet(card) {
    const target = cardTarget(card);
    if (!target || !isAdmin()) return;
    selected = target;
    ensureSheet();
    nameNode.textContent = `REMOVE ${target.playerName}?`;
    detailNode.textContent = target.group === 'standby' ? 'CURRENT ENTRY · STANDBY' : 'CURRENT ENTRY · SECURED SPOT';
    confirmButton.disabled = false;
    confirmButton.textContent = 'REMOVE FROM SESSION';
    setStatus('');
    sheet.hidden = false;
    document.body.classList.add('rp-session-admin-remove-open');
    window.setTimeout(() => confirmButton?.focus({ preventScroll: true }), 0);
  }

  async function adminRemove(payload) {
    const auth = token();
    if (!auth) throw new Error('Please log in to Real Play first.');
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/player`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action: 'remove_from_schedule', ...payload }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result?.message || result?.error || 'Could not remove this player from the session.');
      error.code = result?.code || '';
      throw error;
    }
    return result;
  }

  async function removeSelected() {
    if (actionBusy || !selected) return;
    actionBusy = true;
    confirmButton.disabled = true;
    confirmButton.textContent = 'REMOVING…';
    setStatus('UPDATING SESSION…');

    try {
      const result = await adminRemove({
        playerId: selected.playerId,
        accountUserId: selected.accountUserId,
      });
      setStatus(result?.message || 'PLAYER REMOVED FROM THIS SESSION.', 'success');
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed', {
        detail: { source: 'admin-session-remove', playerId: selected.playerId, accountUserId: selected.accountUserId },
      }));
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: result }));
      try { window.RealPlayRankingGames?.refresh?.(); } catch (_error) {}
      scheduleBindings(150);
      window.setTimeout(() => {
        actionBusy = false;
        closeSheet();
      }, 650);
      return;
    } catch (error) {
      setStatus(error?.message || 'COULD NOT REMOVE THIS PLAYER.', 'error');
      confirmButton.disabled = false;
      confirmButton.textContent = 'TRY REMOVE AGAIN';
    } finally {
      if (!sheet?.hidden && confirmButton?.disabled && statusNode?.classList.contains('error')) {
        confirmButton.disabled = false;
      }
      if (!statusNode?.classList.contains('success')) actionBusy = false;
    }
  }

  function cancelHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdCard?.classList.remove('rp-session-admin-holding');
    holdCard = null;
    holdPointerId = null;
  }

  function startHold(event) {
    if (!isAdmin() || sheet?.hidden === false) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = event.target instanceof Element
      ? event.target.closest('.rp-ranking-secured-player[data-rp-session-admin-target="true"]')
      : null;
    if (!card || !view.contains(card)) {
      scheduleBindings(0);
      return;
    }

    cancelHold();
    holdCard = card;
    holdPointerId = event.pointerId;
    holdStartX = event.clientX;
    holdStartY = event.clientY;
    card.classList.add('rp-session-admin-holding');
    holdTimer = window.setTimeout(() => {
      const active = holdCard;
      holdTimer = 0;
      if (!active) return;
      active.classList.remove('rp-session-admin-holding');
      holdCard = null;
      holdPointerId = null;
      suppressCard = active;
      suppressClickUntil = Date.now() + 1000;
      openSheet(active);
    }, HOLD_MS);
  }

  function moveHold(event) {
    if (!holdCard || !holdTimer || (holdPointerId !== null && event.pointerId !== holdPointerId)) return;
    const dx = Math.abs(event.clientX - holdStartX);
    const dy = Math.abs(event.clientY - holdStartY);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) cancelHold();
  }

  function decorateCard(card, player, group) {
    if (!card || !player) return;
    const playerId = positiveInt(player.playerId);
    const accountUserId = positiveInt(player.accountUserId ?? player.profileUserId);
    card.dataset.rpSessionAdminTarget = 'true';
    card.dataset.rpSessionPlayerId = playerId ? String(playerId) : '';
    card.dataset.rpSessionAccountUserId = accountUserId ? String(accountUserId) : '';
    card.dataset.rpSessionPlayerName = String(player.playerName || 'REAL PLAY PLAYER');
    card.dataset.rpSessionEntryGroup = group;
  }

  async function refreshBindings() {
    bindingTimer = 0;
    if (bindingBusy || !view.classList.contains('open') || !isAdmin() || !token()) return;
    bindingBusy = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/session-roster`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const securedPlayers = Array.isArray(data.players) ? data.players : [];
      const standbyPlayers = Array.isArray(data.standbyPlayers) ? data.standbyPlayers : [];
      const securedCards = [...view.querySelectorAll('[data-rp-ranking-secured-list] > .rp-ranking-secured-player')];
      const standbyCards = [...view.querySelectorAll('[data-rp-ranking-standby-list] > .rp-ranking-secured-player')];

      securedCards.forEach((card, index) => decorateCard(card, securedPlayers[index], 'secured'));
      standbyCards.forEach((card, index) => decorateCard(card, standbyPlayers[index], 'standby'));
    } catch (_error) {
      // The roster remains usable even if this admin-only enhancement cannot bind.
    } finally {
      bindingBusy = false;
    }
  }

  function scheduleBindings(delay = 90) {
    if (bindingTimer) window.clearTimeout(bindingTimer);
    bindingTimer = window.setTimeout(refreshBindings, delay);
  }

  installStyles();
  ensureSheet();

  document.addEventListener('pointerdown', startHold, true);
  document.addEventListener('pointermove', moveHold, true);
  document.addEventListener('pointerup', cancelHold, true);
  document.addEventListener('pointercancel', cancelHold, true);
  document.addEventListener('contextmenu', (event) => {
    if (!isAdmin()) return;
    const card = event.target instanceof Element
      ? event.target.closest('.rp-ranking-secured-player[data-rp-session-admin-target="true"]')
      : null;
    if (!card || !view.contains(card)) return;
    event.preventDefault();
    cancelHold();
    suppressCard = card;
    suppressClickUntil = Date.now() + 1000;
    openSheet(card);
  }, true);
  document.addEventListener('click', (event) => {
    if (Date.now() > suppressClickUntil || !suppressCard) return;
    const card = event.target instanceof Element ? event.target.closest('.rp-ranking-secured-player') : null;
    if (card !== suppressCard) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressCard = null;
    suppressClickUntil = 0;
  }, true);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet?.hidden === false && !actionBusy) closeSheet();
  });
  window.addEventListener('realplay:ranking-session-changed', () => scheduleBindings(120));
  window.addEventListener('realplay:ranking-entry-updated', () => scheduleBindings(120));
  window.addEventListener('focus', () => scheduleBindings(120));

  const observer = new MutationObserver(() => scheduleBindings(100));
  observer.observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // The World admin module resolves admin permission asynchronously. Give it a
  // moment, then bind current roster cards. Rebinding is cheap and event-driven.
  window.setTimeout(() => {
    if (!window.RealPlayPlayerAdmin?.checked?.()) window.RealPlayPlayerAdmin?.refresh?.();
    scheduleBindings(500);
  }, 350);
})();
