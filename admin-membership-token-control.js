(() => {
  if (window.__realPlayAdminMembershipTokenControlInstalled) return;
  window.__realPlayAdminMembershipTokenControlInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const nativeFetch = window.fetch.bind(window);
  let activePlayerId = null;
  let currentTokenBalance = 0;
  let tokenAdjustment = 0;
  let tokenReady = false;
  let tokenManageable = false;
  let loadSequence = 0;
  let directoryPlayersById = new Map();
  let decorateTimer = null;

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function resultingBalance() {
    return Math.max(0, currentTokenBalance + tokenAdjustment);
  }

  function playerIdOf(player) {
    const id = Number(player?.playerId ?? player?.userId ?? player?.manualPlayerId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function availableTokensOf(player) {
    const value = player?.playTokensAvailable
      ?? player?.membership?.playTokensAvailable
      ?? player?.tokens?.available
      ?? 0;
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }

  function isMonthlyPlayer(player) {
    const accessType = String(
      player?.access?.type
      ?? player?.membership?.accessType
      ?? player?.membership?.access_type
      ?? ''
    ).trim().toLowerCase();
    const status = String(player?.membership?.status || '').trim().toLowerCase();
    return accessType === 'monthly' || ['active', 'pending', 'expired', 'suspended'].includes(status);
  }

  function ensureStyles() {
    if (document.getElementById('rp-admin-membership-token-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-admin-membership-token-style';
    style.textContent = `
      .rp-member-token-control{display:grid;gap:8px;margin-top:2px}
      .rp-member-token-control>span,.rp-member-token-adjust-label{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6f879c}
      .rp-member-token-current{min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;border:1px solid #17334a;border-radius:12px;background:#06121d}
      .rp-member-token-current small{color:#71889c;font-size:10px;font-weight:750;letter-spacing:.04em;text-transform:uppercase}
      .rp-member-token-current strong{color:#f7fbff;font:900 18px/1 system-ui}
      .rp-member-token-stepper{display:grid;grid-template-columns:52px 1fr 52px;min-height:46px;border:1px solid #17334a;border-radius:12px;overflow:hidden;background:#06121d}
      .rp-member-token-stepper button{border:0;background:#0a1b29;color:#66eaff;font:900 23px/1 system-ui;cursor:pointer}
      .rp-member-token-stepper button:disabled{cursor:not-allowed;color:#405363;opacity:.55}
      .rp-member-token-stepper output{min-width:0;display:grid;place-items:center;border-left:1px solid #17334a;border-right:1px solid #17334a;background:#06121d;color:#f7fbff;text-align:center;font:900 16px/1 system-ui}
      .rp-member-token-help{margin:0;color:#71889c;font-size:10px;line-height:1.45}
      .rp-member-token-help strong{color:#a9f3ff}
      .rp-member-token-control.is-loading .rp-member-token-current,.rp-member-token-control.is-loading .rp-member-token-stepper{opacity:.65}
      .rp-member-dates.has-token-summary{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(66px,.65fr)}
      .rp-member-token-left{text-align:right}
      .rp-member-token-left strong{color:#62eaff;font-family:var(--rp-display,Arial,sans-serif);font-size:.72rem;font-weight:950}
      .rp-member-token-left strong span{color:#7890a4;font-family:var(--rp-body,Arial,sans-serif);font-size:.46rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
      @media(max-width:390px){.rp-member-dates.has-token-summary{grid-template-columns:1fr 1fr auto}.rp-member-token-left strong span{display:none}}
    `;
    document.head.appendChild(style);
  }

  function decorateMemberCards() {
    decorateTimer = null;
    if (!directoryPlayersById.size) return;
    ensureStyles();

    document.querySelectorAll('[data-member-player]').forEach((card) => {
      const playerId = Number(card.dataset.memberPlayer);
      const player = directoryPlayersById.get(playerId);
      const dates = card.querySelector('.rp-member-dates');
      if (!player || !dates) return;

      const existing = dates.querySelector('[data-member-token-left]');
      if (!isMonthlyPlayer(player)) {
        existing?.remove();
        dates.classList.remove('has-token-summary');
        return;
      }

      const count = availableTokensOf(player);
      const tokenNode = existing || document.createElement('div');
      tokenNode.className = 'rp-member-date rp-member-token-left';
      tokenNode.dataset.memberTokenLeft = '1';
      tokenNode.innerHTML = `<small>Tokens left</small><strong>${count} <span>PLAY</span></strong>`;
      if (!existing) dates.appendChild(tokenNode);
      dates.classList.add('has-token-summary');
    });
  }

  function scheduleCardDecoration(delay = 0) {
    if (decorateTimer !== null) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(decorateMemberCards, delay);
  }

  function cacheDirectoryPlayers(data) {
    const next = new Map();
    (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
      const id = playerIdOf(player);
      if (id) next.set(id, player);
    });
    directoryPlayersById = next;
    scheduleCardDecoration(0);
    scheduleCardDecoration(80);
  }

  function ensureControl() {
    ensureStyles();
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    if (!backdrop) return null;
    let wrap = backdrop.querySelector('[data-member-editor-token-wrap]');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.className = 'rp-member-token-control is-loading';
    wrap.dataset.memberEditorTokenWrap = '1';
    wrap.innerHTML = `
      <span>Play Tokens</span>
      <div class="rp-member-token-current">
        <small>Current balance</small>
        <strong data-member-token-current>—</strong>
      </div>
      <div class="rp-member-token-adjust-label">Admin adjustment</div>
      <div class="rp-member-token-stepper">
        <button type="button" data-member-token-minus aria-label="Subtract one Play Token as an admin correction">−</button>
        <output data-member-token-adjustment aria-label="Play Token admin adjustment">0</output>
        <button type="button" data-member-token-plus aria-label="Add one Play Token as an admin correction">+</button>
      </div>
      <p class="rp-member-token-help" data-member-token-help>Loading Play Tokens…</p>`;

    const amountWrap = backdrop.querySelector('[data-member-editor-amount-wrap]');
    const note = backdrop.querySelector('[data-member-editor-note]');
    if (amountWrap) amountWrap.insertAdjacentElement('afterend', wrap);
    else if (note) note.insertAdjacentElement('beforebegin', wrap);
    else backdrop.querySelector('.rp-member-editor-fields')?.appendChild(wrap);
    return wrap;
  }

  function renderAdjustment(helpOverride = '') {
    const wrap = ensureControl();
    if (!wrap) return;
    const current = wrap.querySelector('[data-member-token-current]');
    const output = wrap.querySelector('[data-member-token-adjustment]');
    const minus = wrap.querySelector('[data-member-token-minus]');
    const plus = wrap.querySelector('[data-member-token-plus]');
    const help = wrap.querySelector('[data-member-token-help]');
    const after = resultingBalance();

    if (current) current.textContent = tokenManageable ? String(currentTokenBalance) : '—';
    if (output) output.textContent = tokenAdjustment > 0 ? `+${tokenAdjustment}` : String(tokenAdjustment);
    if (minus) minus.disabled = !tokenManageable || after <= 0;
    if (plus) plus.disabled = !tokenManageable || after >= 99;
    if (help) {
      help.innerHTML = helpOverride || (tokenManageable
        ? (tokenAdjustment === 0
          ? 'Monthly membership includes <strong>4 Play Tokens automatically</strong>. Use this adjustment only for corrections or disputes.'
          : `After correction: <strong>${after} available Play Token${after === 1 ? '' : 's'}</strong>. Save Access to apply.`)
        : 'A Real Play account is required before Play Tokens can be adjusted.');
    }
  }

  function setTokenState(value, manageable, helpText = '') {
    const wrap = ensureControl();
    if (!wrap) return;
    currentTokenBalance = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    tokenAdjustment = 0;
    tokenManageable = Boolean(manageable);
    tokenReady = true;
    wrap.classList.remove('is-loading');
    renderAdjustment(helpText);
  }

  function setLoading() {
    tokenReady = false;
    tokenManageable = false;
    currentTokenBalance = 0;
    tokenAdjustment = 0;
    const wrap = ensureControl();
    if (!wrap) return;
    wrap.classList.add('is-loading');
    const current = wrap.querySelector('[data-member-token-current]');
    const output = wrap.querySelector('[data-member-token-adjustment]');
    const minus = wrap.querySelector('[data-member-token-minus]');
    const plus = wrap.querySelector('[data-member-token-plus]');
    const help = wrap.querySelector('[data-member-token-help]');
    if (current) current.textContent = '—';
    if (output) output.textContent = '0';
    if (minus) minus.disabled = true;
    if (plus) plus.disabled = true;
    if (help) help.textContent = 'Loading Play Tokens…';
  }

  async function hydrateTokens(playerId) {
    const sequence = ++loadSequence;
    setLoading();
    const auth = authToken();
    if (!auth) {
      setTokenState(0, false, 'Sign in again to manage Play Tokens.');
      return;
    }

    try {
      const response = await nativeFetch(`${API_BASE_URL}/api/real-play/admin/player`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        cache: 'no-store',
        body: JSON.stringify({ action: 'membership_directory' }),
      });
      const data = await response.json().catch(() => ({}));
      cacheDirectoryPlayers(data);
      if (sequence !== loadSequence || Number(playerId) !== Number(activePlayerId)) return;
      if (!response.ok) throw new Error(data?.message || 'Unable to load Play Tokens.');
      const player = Array.isArray(data?.players)
        ? data.players.find((entry) => Number(entry?.playerId) === Number(playerId))
        : null;
      if (!player) throw new Error('Player token record was not found.');

      const manageable = player.tokenManagementAvailable !== false && Number.isSafeInteger(Number(player.accountUserId || player.userId));
      const available = availableTokensOf(player);
      setTokenState(available, manageable);
    } catch (error) {
      setTokenState(0, false, error?.message || 'Unable to load Play Tokens.');
    }
  }

  function changeToken(delta) {
    if (!tokenReady || !tokenManageable) return;
    const nextAdjustment = tokenAdjustment + delta;
    const nextBalance = currentTokenBalance + nextAdjustment;
    if (nextBalance < 0 || nextBalance > 99) return;
    tokenAdjustment = Math.max(-99, Math.min(99, nextAdjustment));
    renderAdjustment();
  }

  window.fetch = function realPlayAdminTokenFetch(input, init = {}) {
    let requestAction = '';
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      if (url.includes('/api/real-play/admin/player') && typeof init?.body === 'string') {
        const body = JSON.parse(init.body);
        requestAction = String(body?.action || '');
        const requestPlayerId = Number(body?.playerId ?? body?.player_id);
        if (
          body?.action === 'membership_access_update'
          && tokenReady
          && tokenManageable
          && requestPlayerId > 0
          && requestPlayerId === Number(activePlayerId)
        ) {
          init = {
            ...init,
            body: JSON.stringify({ ...body, playTokenAdjustment: tokenAdjustment }),
          };
        }
      }
    } catch (_error) {
      // Leave unrelated requests untouched.
    }

    const request = nativeFetch(input, init);
    if (requestAction === 'membership_directory') {
      return request.then((response) => {
        response.clone().json().then((data) => {
          if (response.ok) cacheDirectoryPlayers(data);
        }).catch(() => {});
        return response;
      });
    }
    return request;
  };

  document.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-member-edit]');
    if (edit) {
      const playerId = Number(edit.dataset.memberEdit);
      if (Number.isSafeInteger(playerId) && playerId > 0) {
        activePlayerId = playerId;
        tokenReady = false;
        tokenManageable = false;
        window.requestAnimationFrame(() => hydrateTokens(playerId));
      }
      return;
    }

    if (event.target.closest?.('[data-member-token-minus]')) {
      event.preventDefault();
      changeToken(-1);
      return;
    }
    if (event.target.closest?.('[data-member-token-plus]')) {
      event.preventDefault();
      changeToken(1);
    }
  }, true);

  const cardObserver = new MutationObserver(() => {
    if (directoryPlayersById.size && document.querySelector('[data-member-player]')) {
      scheduleCardDecoration(0);
    }
  });
  cardObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
