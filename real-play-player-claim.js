(() => {
  if (window.__realPlayPlayerClaimInstalled) return;
  window.__realPlayPlayerClaimInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const HOLD_MS = 650;
  const FRESH_MS = 15000;

  let sheet = null;
  let holdTimer = 0;
  let holdRow = null;
  let holdStartX = 0;
  let holdStartY = 0;
  let suppressClickUntil = 0;
  let suppressPlayerId = null;
  let claimable = new Map();
  let claimableLoadedAt = 0;
  let claimablePromise = null;
  let selectedRow = null;
  let selectedPlayerId = null;
  let selectedPlayerName = '';

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_error) { return ''; }
  }

  function adminContext() {
    try {
      return Boolean(
        window.__realPlayAdminVerified === true ||
        window.RealPlayServerGate?.isAdminBypass?.() === true ||
        new URLSearchParams(window.location.search).get('admin') === '1'
      );
    } catch (_error) {
      return window.__realPlayAdminVerified === true;
    }
  }

  function playerIdFromRow(row) {
    const id = Number(row?.dataset?.worldPlayerId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function playerNameFromRow(row) {
    return String(row?.querySelector('.rp-world-player-name strong')?.textContent || 'REAL PLAY PLAYER').trim();
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) {
      const error = new Error('Log in to your Real Play account first.');
      error.status = 401;
      throw error;
    }
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
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Real Play could not complete that request.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  async function refreshClaimable(force = false) {
    if (!token()) {
      claimable = new Map();
      claimableLoadedAt = Date.now();
      return claimable;
    }
    if (!force && Date.now() - claimableLoadedAt < FRESH_MS) return claimable;
    if (claimablePromise) return claimablePromise;

    claimablePromise = (async () => {
      try {
        const data = await api('/api/real-play/profile-ownership/unclaimed');
        const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
        claimable = new Map(profiles
          .map((profile) => [Number(profile?.playerId ?? profile?.id), profile])
          .filter(([id]) => Number.isSafeInteger(id) && id > 0));
        claimableLoadedAt = Date.now();
      } catch (_error) {
        claimableLoadedAt = Date.now();
      } finally {
        claimablePromise = null;
      }
      return claimable;
    })();

    return claimablePromise;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-player-claim-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPlayerClaimStyle = '1';
    style.textContent = `
      .rp-player-claim-sheet{position:fixed;z-index:585;inset:0;display:none;align-items:flex-end;justify-content:center;padding:18px 12px max(12px,env(safe-area-inset-bottom));background:rgba(0,0,0,.68);backdrop-filter:blur(8px)}
      .rp-player-claim-sheet.open{display:flex}
      .rp-player-claim-card{width:min(100%,500px);overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:22px;background:linear-gradient(180deg,#0a0f17,#04070c);box-shadow:0 -24px 70px rgba(0,0,0,.52);color:#f5f9ff;font-family:var(--rp-body,Arial,sans-serif)}
      .rp-player-claim-head{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:16px;border-bottom:1px solid rgba(255,255,255,.07)}
      .rp-player-claim-head small{display:block;color:#45d8ff;font-size:.46rem;font-weight:950;letter-spacing:.13em}.rp-player-claim-head strong{display:block;margin-top:4px;font-family:var(--rp-display,Arial,sans-serif);font-size:.92rem;font-style:italic;font-weight:950;text-transform:uppercase}.rp-player-claim-head button{width:36px;height:36px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:#080d14;color:#aab5c3;font-size:1.05rem}
      .rp-player-claim-body{display:grid;gap:8px;padding:15px}.rp-player-claim-action{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:#070c13;color:#dbe5ef;font-family:var(--rp-display,Arial,sans-serif);font-size:.59rem;font-weight:950;letter-spacing:.055em;text-align:left}.rp-player-claim-action span{color:#53657a;font-size:.82rem}.rp-player-claim-action.claim{border-color:rgba(70,217,255,.22);color:#63e3ff;background:rgba(5,42,58,.34)}.rp-player-claim-action.cancel{justify-content:center;color:#738296}.rp-player-claim-action:disabled{opacity:.45}.rp-player-claim-status{min-height:18px;margin:2px 3px 0;color:#718198;font-size:.55rem;font-weight:850;line-height:1.4;text-align:center}.rp-player-claim-status.success{color:#58dda9}.rp-player-claim-status.error{color:#ff8190}
      .rp-world-player-row.rp-player-claim-holding{position:relative;overflow:hidden}.rp-world-player-row.rp-player-claim-holding::after{content:'';position:absolute;left:0;bottom:0;height:2px;width:0;background:#45d8ff;animation:rpPlayerClaimHold ${HOLD_MS}ms linear forwards}@keyframes rpPlayerClaimHold{to{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureSheet() {
    if (sheet?.isConnected) return sheet;
    installStyles();
    sheet = document.createElement('section');
    sheet.className = 'rp-player-claim-sheet';
    sheet.dataset.rpPlayerClaimSheet = '1';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = `
      <div class="rp-player-claim-card" role="dialog" aria-modal="true" aria-label="Player options">
        <header class="rp-player-claim-head"><div><small>PLAYER OPTIONS</small><strong data-rp-player-claim-name>REAL PLAY PLAYER</strong></div><button type="button" data-rp-player-claim-close aria-label="Close player options">×</button></header>
        <div class="rp-player-claim-body" data-rp-player-claim-body></div>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', handleSheetClick);
    return sheet;
  }

  function closeSheet() {
    sheet?.classList.remove('open');
    sheet?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-player-claim-open');
    selectedRow = null;
    selectedPlayerId = null;
    selectedPlayerName = '';
  }

  function renderSheet(canClaim) {
    const panel = ensureSheet();
    const name = panel.querySelector('[data-rp-player-claim-name]');
    const body = panel.querySelector('[data-rp-player-claim-body]');
    if (name) name.textContent = selectedPlayerName || 'REAL PLAY PLAYER';
    if (body) {
      body.innerHTML = `
        <button type="button" class="rp-player-claim-action" data-player-option="view">VIEW PLAYER PROFILE <span>›</span></button>
        ${canClaim ? '<button type="button" class="rp-player-claim-action claim" data-player-option="claim">CLAIM THIS PLAYER — THIS IS ME <span>›</span></button>' : ''}
        <button type="button" class="rp-player-claim-action cancel" data-player-option="cancel">CANCEL</button>
        <p class="rp-player-claim-status" data-rp-player-claim-status></p>`;
    }
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-player-claim-open');
  }

  function setStatus(message = '', type = '') {
    const node = sheet?.querySelector('[data-rp-player-claim-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('success', type === 'success');
    node.classList.toggle('error', type === 'error');
  }

  async function openOptions(row) {
    const playerId = playerIdFromRow(row);
    if (!playerId || !token() || adminContext()) return;
    selectedRow = row;
    selectedPlayerId = playerId;
    selectedPlayerName = playerNameFromRow(row);
    await refreshClaimable(false);
    if (!selectedRow || selectedPlayerId !== playerId) return;
    renderSheet(claimable.has(playerId));
  }

  async function submitClaim() {
    if (!selectedPlayerId || !claimable.has(selectedPlayerId)) return;
    const confirmed = window.confirm(`Claim ${selectedPlayerName} as your Real Play player profile? Head Admin must validate the claim before ownership becomes permanent.`);
    if (!confirmed) return;

    const buttons = sheet?.querySelectorAll('[data-player-option]') || [];
    buttons.forEach((button) => { button.disabled = true; });
    setStatus('SENDING CLAIM…');
    try {
      await api('/api/real-play/profile-ownership/claim', {
        method: 'POST',
        body: { playerId: selectedPlayerId },
      });
      claimable.delete(selectedPlayerId);
      claimableLoadedAt = Date.now();
      setStatus('CLAIM SENT · WAITING FOR ADMIN VALIDATION', 'success');
      try { window.RealPlayPlayers?.refresh?.(); } catch (_error) {}
      try {
        window.dispatchEvent(new CustomEvent('realplay:player-claim-submitted', {
          detail: { playerId: selectedPlayerId, playerName: selectedPlayerName },
        }));
      } catch (_error) {}
      window.setTimeout(closeSheet, 1100);
    } catch (error) {
      const message = error?.code === 'PROFILE_EXISTS'
        ? 'THIS ACCOUNT ALREADY HAS A REAL PLAY PLAYER PROFILE.'
        : error?.code === 'PROFILE_NOT_CLAIMABLE'
          ? 'THIS PLAYER IS NO LONGER AVAILABLE TO CLAIM.'
          : (error?.message || 'CLAIM COULD NOT BE SENT.');
      setStatus(message, 'error');
      buttons.forEach((button) => { button.disabled = false; });
      await refreshClaimable(true);
    }
  }

  function handleSheetClick(event) {
    if (event.target === sheet || event.target.closest('[data-rp-player-claim-close]')) {
      closeSheet();
      return;
    }
    const button = event.target.closest('[data-player-option]');
    if (!button) return;
    const action = button.dataset.playerOption;
    if (action === 'cancel') {
      closeSheet();
      return;
    }
    if (action === 'view') {
      const row = selectedRow;
      suppressClickUntil = 0;
      suppressPlayerId = null;
      closeSheet();
      window.setTimeout(() => row?.click(), 0);
      return;
    }
    if (action === 'claim') submitClaim();
  }

  function cancelHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdRow?.classList.remove('rp-player-claim-holding');
    holdRow = null;
  }

  document.addEventListener('pointerdown', (event) => {
    const row = event.target.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row || !token() || adminContext() || sheet?.classList.contains('open')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelHold();
    holdRow = row;
    holdStartX = event.clientX;
    holdStartY = event.clientY;
    row.classList.add('rp-player-claim-holding');
    holdTimer = window.setTimeout(async () => {
      const activeRow = holdRow;
      const playerId = playerIdFromRow(activeRow);
      cancelHold();
      if (!activeRow || !playerId || adminContext()) return;
      suppressPlayerId = playerId;
      suppressClickUntil = Date.now() + 1000;
      await openOptions(activeRow);
    }, HOLD_MS);
  }, { passive: true, capture: true });

  document.addEventListener('pointermove', (event) => {
    if (!holdRow) return;
    if (Math.abs(event.clientX - holdStartX) > 10 || Math.abs(event.clientY - holdStartY) > 10) cancelHold();
  }, { passive: true, capture: true });

  document.addEventListener('pointerup', cancelHold, { passive: true, capture: true });
  document.addEventListener('pointercancel', cancelHold, { passive: true, capture: true });

  document.addEventListener('click', (event) => {
    if (Date.now() > suppressClickUntil) return;
    const row = event.target.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row || playerIdFromRow(row) !== suppressPlayerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('contextmenu', (event) => {
    const row = event.target.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row || !token() || adminContext()) return;
    event.preventDefault();
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-rp-simple-nav-item="players"], [data-world-tab="players"]')) {
      window.setTimeout(() => refreshClaimable(true), 150);
    }
  }, true);

  window.addEventListener('realplay:player-claim-submitted', () => refreshClaimable(true));
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) refreshClaimable(true);
  });

  refreshClaimable(true);
})();