(() => {
  if (window.__realPlayAdminRankStatusInstalled) return;
  window.__realPlayAdminRankStatusInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';

  let selectedPlayerId = null;
  let selectedState = null;
  let stateRequestId = 0;
  let enhanceQueued = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function adminContextActive() {
    try {
      return Boolean(
        window.__realPlayAdminVerified === true
        || window.RealPlayServerGate?.isAdminBypass?.() === true
      );
    } catch (_error) {
      return window.__realPlayAdminVerified === true;
    }
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
    if (!response.ok) throw new Error(data?.message || data?.error || 'Player rank action failed.');
    return data;
  }

  function rowPlayerId(target) {
    const row = target?.closest?.('.rp-world-player-row[data-world-player-id]');
    const id = Number(row?.dataset?.worldPlayerId || 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function rememberPlayer(target) {
    const id = rowPlayerId(target);
    if (!id) return;
    if (selectedPlayerId !== id) {
      selectedPlayerId = id;
      selectedState = null;
    }
  }

  document.addEventListener('pointerdown', (event) => rememberPlayer(event.target), true);
  document.addEventListener('click', (event) => rememberPlayer(event.target), true);
  document.addEventListener('contextmenu', (event) => rememberPlayer(event.target), true);

  function sheet() {
    return document.querySelector('[data-rp-player-admin-sheet].open');
  }

  function sheetStatus(message, type = '') {
    const node = sheet()?.querySelector('[data-rp-player-admin-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function rankingEligible(player) {
    return Boolean(
      player?.rankingEligible === true
      || player?.officialRankingEligible === true
      || Number(player?.rank || 0) > 0
    );
  }

  function updateIdentity(player) {
    const activeSheet = sheet();
    if (!activeSheet || !player) return;
    const identityStatus = activeSheet.querySelector('.rp-player-admin-identity span');
    if (!identityStatus) return;

    const status = String(player.status || player.memberStatus || player.accountStatus || 'active').toUpperCase();
    const ovr = player.ovr === null || player.ovr === undefined ? null : Number(player.ovr);
    const rank = Number(player.rank || 0);
    const ranked = rankingEligible(player) && Number.isFinite(rank) && rank > 0;
    const rankLabel = ranked ? `RANK #${rank}` : 'UNRANKED';
    const ovrLabel = Number.isFinite(ovr) ? ` · ${ovr} OVR` : '';
    identityStatus.textContent = `${status} · ${rankLabel}${ovrLabel}`;
  }

  function renderRankAction(player) {
    const activeSheet = sheet();
    const actions = activeSheet?.querySelector('.rp-player-admin-actions');
    if (!actions || !player) return;

    actions.querySelector('[data-rp-manual-rank-action]')?.remove();
    updateIdentity(player);

    const manuallyUnranked = Boolean(player.manualUnranked);
    if (!manuallyUnranked && !rankingEligible(player)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rp-player-admin-action ${manuallyUnranked ? 'attach' : 'warn'}`;
    button.dataset.rpManualRankAction = manuallyUnranked ? 'restore_rank' : 'unrank_player';
    button.innerHTML = `${manuallyUnranked ? 'RESTORE RANK ELIGIBILITY' : 'MAKE PLAYER UNRANKED'} <span>›</span>`;

    const resetButton = actions.querySelector('[data-admin-menu-action="reset_competitive"]');
    actions.insertBefore(button, resetButton || null);
  }

  async function loadSelectedState() {
    if (!selectedPlayerId || !adminContextActive() || !sheet()) return;
    const requestId = ++stateRequestId;
    try {
      const data = await adminCall('list');
      if (requestId !== stateRequestId || !sheet()) return;
      const players = Array.isArray(data?.players) ? data.players : [];
      selectedState = players.find((player) => Number(player?.playerId ?? player?.userId) === selectedPlayerId) || null;
      if (selectedState) renderRankAction(selectedState);
    } catch (_error) {
      // The base admin sheet remains fully usable if this optional rank control
      // cannot load. Do not replace its own status/error handling.
    }
  }

  function enhance() {
    enhanceQueued = false;
    const activeSheet = sheet();
    if (!activeSheet || !selectedPlayerId || !adminContextActive()) return;

    if (selectedState && Number(selectedState?.playerId ?? selectedState?.userId) === selectedPlayerId) {
      renderRankAction(selectedState);
      return;
    }
    void loadSelectedState();
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    window.requestAnimationFrame(enhance);
  }

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-rp-manual-rank-action]');
    if (!button || !selectedPlayerId) return;

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.rpManualRankAction;
    const restoring = action === 'restore_rank';
    const playerName = selectedState?.playerName || 'this player';
    const ovrText = selectedState?.ovr === null || selectedState?.ovr === undefined
      ? 'Their OVR and all competitive history will stay untouched.'
      : `Their ${selectedState.ovr} OVR and all competitive history will stay untouched.`;

    const approved = window.confirm(
      restoring
        ? `Remove the manual unrank override for ${playerName}? Their existing OVR and game history stay unchanged. Their current Rank will still follow the normal activity rules.`
        : `Make ${playerName} UNRANKED? ${ovrText} Only their official Rank is removed.`
    );
    if (!approved) return;

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = restoring ? 'RESTORING…' : 'MOVING TO UNRANKED…';
    sheetStatus(restoring ? 'Removing manual unrank override…' : 'Moving player to Unranked…');

    try {
      const data = await adminCall(action, {
        playerId: selectedPlayerId,
        confirmation: restoring ? 'RESTORE' : 'UNRANK',
      });
      selectedState = {
        ...(selectedState || {}),
        ...(data?.player || {}),
        userId: selectedPlayerId,
        playerId: selectedPlayerId,
      };
      renderRankAction(selectedState);
      sheetStatus(data?.message || (restoring ? 'Manual unrank override removed.' : 'Player is now Unranked.'), 'success');

      try { window.RealPlayPlayerAdmin?.refresh?.(); } catch (_error) {}
      try { window.RealPlayPlayers?.refresh?.(); } catch (_error) {}
    } catch (error) {
      button.disabled = false;
      button.textContent = oldText;
      sheetStatus(error?.message || 'Could not update the player rank status.', 'error');
    }
  }, true);

  queueEnhance();
})();
