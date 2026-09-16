(() => {
  if (window.__realPlayAdminMembershipTokenControlInstalled) return;
  window.__realPlayAdminMembershipTokenControlInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const nativeFetch = window.fetch.bind(window);
  let activePlayerId = null;
  let tokenReady = false;
  let tokenManageable = false;
  let loadSequence = 0;

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function tokenValue() {
    const input = document.querySelector('[data-member-editor-token-count]');
    const value = Number(input?.value);
    return Number.isSafeInteger(value) && value >= 0 ? Math.min(99, value) : 0;
  }

  function ensureStyles() {
    if (document.getElementById('rp-admin-membership-token-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-admin-membership-token-style';
    style.textContent = `
      .rp-member-token-control{display:grid;gap:8px;margin-top:2px}
      .rp-member-token-control>span{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6f879c}
      .rp-member-token-stepper{display:grid;grid-template-columns:52px 1fr 52px;min-height:46px;border:1px solid #17334a;border-radius:12px;overflow:hidden;background:#06121d}
      .rp-member-token-stepper button{border:0;background:#0a1b29;color:#66eaff;font:900 23px/1 system-ui;cursor:pointer}
      .rp-member-token-stepper button:disabled{cursor:not-allowed;color:#405363;opacity:.55}
      .rp-member-token-stepper input{min-width:0;border:0;border-left:1px solid #17334a;border-right:1px solid #17334a;background:#06121d;color:#f7fbff;text-align:center;font:900 16px/1 system-ui;outline:none;-moz-appearance:textfield}
      .rp-member-token-stepper input::-webkit-inner-spin-button,.rp-member-token-stepper input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .rp-member-token-help{margin:0;color:#71889c;font-size:10px;line-height:1.45}
      .rp-member-token-control.is-loading .rp-member-token-stepper{opacity:.65}
    `;
    document.head.appendChild(style);
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
      <div class="rp-member-token-stepper">
        <button type="button" data-member-token-minus aria-label="Remove one Play Token">−</button>
        <input type="number" min="0" max="99" step="1" value="0" inputmode="numeric" data-member-editor-token-count aria-label="Available Play Tokens">
        <button type="button" data-member-token-plus aria-label="Add one Play Token">+</button>
      </div>
      <p class="rp-member-token-help" data-member-token-help>Loading available Play Tokens…</p>`;

    const amountWrap = backdrop.querySelector('[data-member-editor-amount-wrap]');
    const note = backdrop.querySelector('[data-member-editor-note]');
    if (amountWrap) amountWrap.insertAdjacentElement('afterend', wrap);
    else if (note) note.insertAdjacentElement('beforebegin', wrap);
    else backdrop.querySelector('.rp-member-editor-fields')?.appendChild(wrap);
    return wrap;
  }

  function setTokenState(value, manageable, helpText) {
    const wrap = ensureControl();
    if (!wrap) return;
    const input = wrap.querySelector('[data-member-editor-token-count]');
    const minus = wrap.querySelector('[data-member-token-minus]');
    const plus = wrap.querySelector('[data-member-token-plus]');
    const help = wrap.querySelector('[data-member-token-help]');
    const count = Number.isFinite(Number(value)) ? Math.max(0, Math.min(99, Number(value))) : 0;

    tokenManageable = Boolean(manageable);
    tokenReady = true;
    wrap.classList.remove('is-loading');
    if (input) {
      input.value = tokenManageable ? String(count) : '';
      input.disabled = !tokenManageable;
    }
    if (minus) minus.disabled = !tokenManageable || count <= 0;
    if (plus) plus.disabled = !tokenManageable || count >= 99;
    if (help) {
      help.textContent = helpText || (tokenManageable
        ? `${count} available Play Token${count === 1 ? '' : 's'}. Use − or +, then Save Access.`
        : 'A Real Play account is required before Play Tokens can be managed.');
    }
  }

  function setLoading() {
    tokenReady = false;
    tokenManageable = false;
    const wrap = ensureControl();
    if (!wrap) return;
    wrap.classList.add('is-loading');
    const input = wrap.querySelector('[data-member-editor-token-count]');
    const minus = wrap.querySelector('[data-member-token-minus]');
    const plus = wrap.querySelector('[data-member-token-plus]');
    const help = wrap.querySelector('[data-member-token-help]');
    if (input) { input.value = '0'; input.disabled = true; }
    if (minus) minus.disabled = true;
    if (plus) plus.disabled = true;
    if (help) help.textContent = 'Loading available Play Tokens…';
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
      if (sequence !== loadSequence || Number(playerId) !== Number(activePlayerId)) return;
      if (!response.ok) throw new Error(data?.message || 'Unable to load Play Tokens.');
      const player = Array.isArray(data?.players)
        ? data.players.find((entry) => Number(entry?.playerId) === Number(playerId))
        : null;
      if (!player) throw new Error('Player token record was not found.');

      const manageable = player.tokenManagementAvailable !== false && Number.isSafeInteger(Number(player.accountUserId || player.userId));
      const available = player.playTokensAvailable ?? player.membership?.playTokensAvailable ?? player.tokens?.available ?? 0;
      setTokenState(available, manageable);
    } catch (error) {
      setTokenState(0, false, error?.message || 'Unable to load Play Tokens.');
    }
  }

  function changeToken(delta) {
    if (!tokenReady || !tokenManageable) return;
    const input = document.querySelector('[data-member-editor-token-count]');
    if (!input) return;
    const next = Math.max(0, Math.min(99, tokenValue() + delta));
    input.value = String(next);
    const wrap = input.closest('[data-member-editor-token-wrap]');
    const minus = wrap?.querySelector('[data-member-token-minus]');
    const plus = wrap?.querySelector('[data-member-token-plus]');
    const help = wrap?.querySelector('[data-member-token-help]');
    if (minus) minus.disabled = next <= 0;
    if (plus) plus.disabled = next >= 99;
    if (help) help.textContent = `${next} available Play Token${next === 1 ? '' : 's'}. Save Access to apply.`;
  }

  window.fetch = function realPlayAdminTokenFetch(input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      if (url.includes('/api/real-play/admin/player') && typeof init?.body === 'string') {
        const body = JSON.parse(init.body);
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
            body: JSON.stringify({ ...body, playTokensAvailable: tokenValue() }),
          };
        }
      }
    } catch (_error) {
      // Leave unrelated requests untouched.
    }
    return nativeFetch(input, init);
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

  document.addEventListener('input', (event) => {
    if (!event.target.matches?.('[data-member-editor-token-count]') || !tokenManageable) return;
    const normalized = Math.max(0, Math.min(99, Math.trunc(Number(event.target.value) || 0)));
    event.target.value = String(normalized);
    const wrap = event.target.closest('[data-member-editor-token-wrap]');
    const minus = wrap?.querySelector('[data-member-token-minus]');
    const plus = wrap?.querySelector('[data-member-token-plus]');
    const help = wrap?.querySelector('[data-member-token-help]');
    if (minus) minus.disabled = normalized <= 0;
    if (plus) plus.disabled = normalized >= 99;
    if (help) help.textContent = `${normalized} available Play Token${normalized === 1 ? '' : 's'}. Save Access to apply.`;
  });
})();
