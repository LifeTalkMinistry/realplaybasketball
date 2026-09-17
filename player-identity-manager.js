(() => {
  if (window.__realPlayPlayerIdentityManagerInstalled) return;
  window.__realPlayPlayerIdentityManagerInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const accountView = document.querySelector('[data-auth-view="account"]');
  const overlay = document.querySelector('[data-auth-overlay]');
  const accountName = document.querySelector('[data-auth-account-name]');
  const numberManager = accountView?.querySelector('.auth-number-manager-v2');

  if (!accountView || !accountName || !numberManager) return;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function canonicalName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function token() {
    return String(localStorage.getItem(TOKEN_KEY) || '').trim();
  }

  function installStyles() {
    if (document.querySelector('[data-rp-player-identity-manager-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPlayerIdentityManagerStyle = 'true';
    style.textContent = `
      .auth-name-manager{margin-bottom:10px!important}
      .auth-name-manager-body{display:grid;gap:12px}
      .auth-name-manager-form{display:grid;gap:11px}
      .auth-name-manager-form .auth-field{margin:0}
      .auth-name-manager-form input{
        width:100%;
        min-height:48px;
        padding:0 13px;
        border:1px solid rgba(255,255,255,.09);
        border-radius:11px;
        background:#02070c;
        color:#f2f7fc;
        font:inherit;
        font-size:.82rem;
        font-weight:800;
        box-sizing:border-box;
      }
      .auth-name-manager-form input:focus{
        outline:none;
        border-color:rgba(66,216,255,.5);
        box-shadow:0 0 0 3px rgba(66,216,255,.07);
      }
      .auth-name-manager-save{
        min-height:46px;
        border:1px solid rgba(70,218,255,.35);
        border-radius:11px;
        background:rgba(16,185,225,.08);
        color:#5de2ff;
        font-size:.63rem;
        font-weight:950;
        letter-spacing:.11em;
      }
      .auth-name-manager-save:disabled{opacity:.48;cursor:wait}
      .auth-name-manager-note{
        margin:0;
        color:#697b90;
        font-size:.59rem;
        font-weight:700;
        line-height:1.55;
      }
      .auth-name-manager-status{
        min-height:16px;
        margin:0;
        color:#6de7cf;
        font-size:.58rem;
        font-weight:850;
        line-height:1.45;
      }
      .auth-name-manager-status.error{color:#ff7d8e}
      .auth-name-manager summary strong{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  installStyles();

  const nameManager = document.createElement('details');
  nameManager.className = 'auth-number-manager auth-number-manager-v2 auth-name-manager';
  nameManager.innerHTML = `
    <summary>
      <span>
        <small>PLAYER NAME</small>
        <strong data-auth-name-summary>${esc(canonicalName(accountName.textContent) || 'REAL PLAY PLAYER')}</strong>
      </span>
      <b>MANAGE</b>
    </summary>
    <div class="auth-number-manager-body auth-name-manager-body">
      <form class="auth-name-manager-form" data-auth-name-update-form>
        <div class="auth-field">
          <label for="real-play-manage-player-name">PLAYER NAME</label>
          <input id="real-play-manage-player-name" name="player_name" type="text" minlength="2" maxlength="40" autocomplete="nickname" required />
        </div>
        <button class="auth-name-manager-save" type="submit">SAVE PLAYER NAME</button>
        <p class="auth-name-manager-note">Your name stays attached to the same Real Play Player ID, stats, rank and game history. Permanent ownership must be verified before you can rename it.</p>
        <p class="auth-name-manager-status" data-auth-name-update-status aria-live="polite"></p>
      </form>
    </div>
  `;

  numberManager.insertAdjacentElement('beforebegin', nameManager);

  const summary = nameManager.querySelector('[data-auth-name-summary]');
  const form = nameManager.querySelector('[data-auth-name-update-form]');
  const input = form?.querySelector('input[name="player_name"]');
  const saveButton = form?.querySelector('button[type="submit"]');
  const status = nameManager.querySelector('[data-auth-name-update-status]');

  function setStatus(message = '', type = '') {
    if (!status) return;
    if (status.textContent !== message) status.textContent = message;
    status.classList.toggle('error', type === 'error');
  }

  function applyName(value) {
    const name = canonicalName(value);
    if (!name) return;
    if (canonicalName(accountName.textContent) !== name) accountName.textContent = name;
    const summaryName = name.toUpperCase();
    if (summary && summary.textContent !== summaryName) summary.textContent = summaryName;
    if (input && document.activeElement !== input && input.value !== name) input.value = name;
  }

  function syncFromAccount() {
    const name = canonicalName(accountName.textContent);
    if (!name) return;
    const summaryName = name.toUpperCase();
    if (summary && summary.textContent !== summaryName) summary.textContent = summaryName;
    if (input && document.activeElement !== input && input.value !== name) input.value = name;
  }

  syncFromAccount();

  const nameObserver = new MutationObserver(syncFromAccount);
  nameObserver.observe(accountName, { childList: true, characterData: true, subtree: true });

  async function fetchCanonicalName() {
    const accessToken = token();
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      applyName(data?.profile?.player_name);
    } catch (_error) {}
  }

  if (overlay) {
    const overlayObserver = new MutationObserver(() => {
      if (overlay.classList.contains('open')) fetchCanonicalName();
    });
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const playerName = canonicalName(input?.value);
    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }

    const accessToken = token();
    if (!accessToken) {
      setStatus('Please log in again before changing your player name.', 'error');
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.dataset.originalText = saveButton.textContent;
      saveButton.textContent = 'SAVING...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/profile-ownership/name`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ playerName }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Real Play could not update your player name.');
      }

      applyName(data?.playerName || data?.profile?.player_name || playerName);
      setStatus(data?.changed === false
        ? 'THIS IS ALREADY YOUR PLAYER NAME.'
        : 'PLAYER NAME UPDATED. YOUR PLAYER ID AND CAREER HISTORY STAY THE SAME.');

      window.RealPlayProfile?.refresh?.();
      window.dispatchEvent(new CustomEvent('realplay:player-identity-updated', {
        detail: { playerName: data?.playerName || playerName },
      }));
    } catch (error) {
      setStatus(error?.message || 'Real Play could not update your player name.', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = saveButton.dataset.originalText || 'SAVE PLAYER NAME';
        delete saveButton.dataset.originalText;
      }
    }
  });

  function renameProfileManageButton() {
    const button = document.querySelector('[data-rp-profile-manage-number]');
    if (!button) return false;
    if (button.textContent !== 'MANAGE NAME & NUMBER') button.textContent = 'MANAGE NAME & NUMBER';
    if (button.getAttribute('aria-label') !== 'Manage player name and number') {
      button.setAttribute('aria-label', 'Manage player name and number');
    }
    return true;
  }

  renameProfileManageButton();
  const documentObserver = new MutationObserver(() => renameProfileManageButton());
  documentObserver.observe(document.body, { childList: true, subtree: true });
})();
