(() => {
  if (window.__realPlayAdminTempPasswordInstalled) return;
  window.__realPlayAdminTempPasswordInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let activePlayerId = null;
  let activeAccountUserId = null;
  let activePlayerName = 'this player';
  let hydrateSequence = 0;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function ensureStyles() {
    if (document.getElementById('rp-admin-temp-password-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-admin-temp-password-style';
    style.textContent = `
      .rp-member-temp-password{display:grid;gap:8px;padding-top:2px}
      .rp-member-temp-password>span{color:#6f879c;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .rp-member-temp-password-box{display:grid;gap:8px;padding:11px;border:1px solid #17334a;border-radius:12px;background:#06121d}
      .rp-member-temp-password-action{min-height:42px;border:1px solid rgba(67,232,255,.28);border-radius:10px;background:#082230;color:#67eaff;font:900 .59rem var(--rp-display,Arial,sans-serif);letter-spacing:.07em;cursor:pointer}
      .rp-member-temp-password-action:disabled{cursor:not-allowed;opacity:.5}
      .rp-member-temp-password-result{display:none;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}
      .rp-member-temp-password-result.open{display:grid}
      .rp-member-temp-password-code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:11px;border:1px solid rgba(67,232,255,.2);border-radius:9px;background:#020b12;color:#f7fbff;font:900 .83rem/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;user-select:all}
      .rp-member-temp-password-copy{min-height:39px;padding:0 12px;border:1px solid rgba(67,232,255,.25);border-radius:9px;background:#0a1b29;color:#7cefff;font:900 .55rem var(--rp-display,Arial,sans-serif);letter-spacing:.06em;cursor:pointer}
      .rp-member-temp-password-help{margin:0;color:#71889c;font-size:10px;line-height:1.45}
      .rp-member-temp-password-help strong{color:#a9f3ff}
      .rp-member-temp-password.is-busy .rp-member-temp-password-box{opacity:.7}
    `;
    document.head.appendChild(style);
  }

  function ensureControl() {
    ensureStyles();
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    if (!backdrop) return null;
    let wrap = backdrop.querySelector('[data-member-temp-password-wrap]');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.className = 'rp-member-temp-password';
    wrap.dataset.memberTempPasswordWrap = '1';
    wrap.innerHTML = `
      <span>Temporary password</span>
      <div class="rp-member-temp-password-box">
        <button class="rp-member-temp-password-action" type="button" data-member-temp-password-create disabled>CREATE TEMP PASSWORD</button>
        <div class="rp-member-temp-password-result" data-member-temp-password-result>
          <code class="rp-member-temp-password-code" data-member-temp-password-code></code>
          <button class="rp-member-temp-password-copy" type="button" data-member-temp-password-copy>COPY</button>
        </div>
        <p class="rp-member-temp-password-help" data-member-temp-password-help>Checking this player's login account…</p>
      </div>`;

    const fields = backdrop.querySelector('.rp-member-editor-fields');
    const tokenWrap = backdrop.querySelector('[data-member-editor-token-wrap]');
    const note = backdrop.querySelector('[data-member-editor-note]');
    if (tokenWrap) tokenWrap.insertAdjacentElement('afterend', wrap);
    else if (note) note.insertAdjacentElement('beforebegin', wrap);
    else fields?.appendChild(wrap);
    return wrap;
  }

  function resetResult() {
    const wrap = ensureControl();
    if (!wrap) return;
    wrap.classList.remove('is-busy');
    const result = wrap.querySelector('[data-member-temp-password-result]');
    const code = wrap.querySelector('[data-member-temp-password-code]');
    const copy = wrap.querySelector('[data-member-temp-password-copy]');
    result?.classList.remove('open');
    if (code) code.textContent = '';
    if (copy) copy.textContent = 'COPY';
  }

  function setAvailability({ accountUserId = null, playerName = '', message = '' } = {}) {
    const wrap = ensureControl();
    if (!wrap) return;
    activeAccountUserId = Number.isSafeInteger(Number(accountUserId)) && Number(accountUserId) > 0
      ? Number(accountUserId)
      : null;
    if (playerName) activePlayerName = String(playerName);
    const button = wrap.querySelector('[data-member-temp-password-create]');
    const help = wrap.querySelector('[data-member-temp-password-help]');
    if (button) button.disabled = !activeAccountUserId;
    if (help) {
      help.innerHTML = message || (activeAccountUserId
        ? 'Creates a new admin-issued login password. <strong>The current password stops working immediately.</strong> The plain password is shown only once here.'
        : 'This player has not claimed a Real Play login account yet, so there is no password to reset.');
    }
  }

  async function hydratePlayer(playerId) {
    const sequence = ++hydrateSequence;
    resetResult();
    setAvailability({ message: 'Checking this player\'s login account…' });
    const auth = token();
    if (!auth) {
      setAvailability({ message: 'Sign in again to manage player passwords.' });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/player`, {
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
      if (sequence !== hydrateSequence || Number(playerId) !== Number(activePlayerId)) return;
      if (!response.ok) throw new Error(data?.message || 'Unable to verify this player account.');
      const player = (Array.isArray(data?.players) ? data.players : [])
        .find((entry) => Number(entry?.playerId) === Number(playerId));
      if (!player) throw new Error('Player account record was not found.');
      setAvailability({
        accountUserId: player.accountUserId ?? player.userId,
        playerName: player.playerName || activePlayerName,
      });
    } catch (error) {
      setAvailability({ message: error?.message || 'Unable to verify this player account.' });
    }
  }

  async function createTemporaryPassword() {
    if (!activeAccountUserId) return;
    const wrap = ensureControl();
    if (!wrap) return;
    const createButton = wrap.querySelector('[data-member-temp-password-create]');
    const help = wrap.querySelector('[data-member-temp-password-help]');
    const result = wrap.querySelector('[data-member-temp-password-result]');
    const code = wrap.querySelector('[data-member-temp-password-code]');

    const confirmed = window.confirm(
      `Create a temporary password for ${activePlayerName}? Their current password will stop working immediately.`
    );
    if (!confirmed) return;

    wrap.classList.add('is-busy');
    if (createButton) {
      createButton.disabled = true;
      createButton.textContent = 'CREATING…';
    }
    if (help) help.textContent = 'Creating a secure temporary password…';
    result?.classList.remove('open');
    if (code) code.textContent = '';

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/player`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'create_temp_password',
          accountUserId: activeAccountUserId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.temporaryPassword) {
        throw new Error(data?.message || 'Unable to create a temporary password.');
      }

      if (code) code.textContent = data.temporaryPassword;
      result?.classList.add('open');
      if (help) help.innerHTML = '<strong>Created.</strong> Copy it now and share it privately. The plain password will not be available again after this window is closed.';
      if (createButton) createButton.textContent = 'CREATE NEW TEMP PASSWORD';
    } catch (error) {
      if (help) help.textContent = error?.message || 'Unable to create a temporary password.';
      if (createButton) createButton.textContent = 'CREATE TEMP PASSWORD';
    } finally {
      wrap.classList.remove('is-busy');
      if (createButton) createButton.disabled = !activeAccountUserId;
    }
  }

  async function copyTemporaryPassword() {
    const wrap = ensureControl();
    const code = wrap?.querySelector('[data-member-temp-password-code]');
    const copy = wrap?.querySelector('[data-member-temp-password-copy]');
    const value = String(code?.textContent || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (copy) copy.textContent = 'COPIED';
      window.setTimeout(() => {
        if (copy) copy.textContent = 'COPY';
      }, 1400);
    } catch (_error) {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  document.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-member-edit]');
    if (edit) {
      const playerId = Number(edit.dataset.memberEdit);
      if (Number.isSafeInteger(playerId) && playerId > 0) {
        activePlayerId = playerId;
        activeAccountUserId = null;
        const rowName = edit.closest('[data-member-player]')?.querySelector('.rp-member-identity strong')?.textContent;
        activePlayerName = String(rowName || 'this player').trim();
        window.requestAnimationFrame(() => hydratePlayer(playerId));
      }
      return;
    }

    if (event.target.closest?.('[data-member-temp-password-create]')) {
      event.preventDefault();
      createTemporaryPassword();
      return;
    }

    if (event.target.closest?.('[data-member-temp-password-copy]')) {
      event.preventDefault();
      copyTemporaryPassword();
      return;
    }

    if (event.target.closest?.('[data-member-editor-close]')) {
      resetResult();
    }
  }, true);
})();
