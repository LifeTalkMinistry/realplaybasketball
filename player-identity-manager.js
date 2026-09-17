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
      .auth-name-manager-save:disabled{opacity:.48;cursor:not-allowed}
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
      .auth-name-manager-status.locked{color:#f2c665}
      .auth-name-manager.is-ownership-locked input{
        color:#8493a1;
        border-color:rgba(255,255,255,.055);
        background:#05090e;
        cursor:not-allowed;
        opacity:.68;
      }
      .auth-name-manager.is-ownership-locked .auth-name-manager-note{color:#9a8460}
      .auth-name-manager.is-ownership-locked summary>b{color:#f2c665!important}
      .auth-name-manager summary strong{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  installStyles();

  const nameManager = document.createElement('details');
  nameManager.className = 'auth-number-manager auth-number-manager-v2 auth-name-manager is-ownership-locked';
  nameManager.innerHTML = `
    <summary>
      <span>
        <small>PLAYER NAME</small>
        <strong data-auth-name-summary>${esc(canonicalName(accountName.textContent) || 'REAL PLAY PLAYER')}</strong>
      </span>
      <b data-auth-name-action>LOCKED</b>
    </summary>
    <div class="auth-number-manager-body auth-name-manager-body">
      <form class="auth-name-manager-form" data-auth-name-update-form>
        <div class="auth-field">
          <label for="real-play-manage-player-name">PLAYER NAME</label>
          <input id="real-play-manage-player-name" name="player_name" type="text" minlength="2" maxlength="40" autocomplete="nickname" required disabled readonly />
        </div>
        <button class="auth-name-manager-save" type="submit" disabled>SAVE PLAYER NAME</button>
        <p class="auth-name-manager-note" data-auth-name-note>Player name changes unlock only after Admin fully validates permanent ownership.</p>
        <p class="auth-name-manager-status locked" data-auth-name-update-status aria-live="polite">CHECKING OWNERSHIP STATUS…</p>
      </form>
    </div>
  `;

  numberManager.insertAdjacentElement('beforebegin', nameManager);

  const summary = nameManager.querySelector('[data-auth-name-summary]');
  const summaryAction = nameManager.querySelector('[data-auth-name-action]');
  const form = nameManager.querySelector('[data-auth-name-update-form]');
  const input = form?.querySelector('input[name="player_name"]');
  const saveButton = form?.querySelector('button[type="submit"]');
  const note = nameManager.querySelector('[data-auth-name-note]');
  const status = nameManager.querySelector('[data-auth-name-update-status]');

  let ownershipStatus = 'unknown';
  let canRename = false;
  let ownershipRequestSequence = 0;

  function setStatus(message = '', type = '') {
    if (!status) return;
    if (status.textContent !== message) status.textContent = message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('locked', type === 'locked');
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

  function renameProfileManageButton() {
    const button = document.querySelector('[data-rp-profile-manage-number]');
    if (!button) return false;
    const label = canRename ? 'MANAGE NAME & NUMBER' : 'MANAGE PLAYER NUMBER';
    const ariaLabel = canRename ? 'Manage player name and number' : 'Manage player number';
    if (button.textContent !== label) button.textContent = label;
    if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
    return true;
  }

  function applyOwnershipState(ownership) {
    const nextStatus = String(ownership?.ownershipStatus || '').trim().toLowerCase();
    ownershipStatus = nextStatus || 'unknown';
    canRename = ownershipStatus === 'verified';

    nameManager.dataset.ownershipStatus = ownershipStatus;
    nameManager.classList.toggle('is-ownership-locked', !canRename);

    if (input) {
      input.disabled = !canRename;
      input.readOnly = !canRename;
      input.setAttribute('aria-disabled', String(!canRename));
    }
    if (saveButton) saveButton.disabled = !canRename;
    if (summaryAction) summaryAction.textContent = canRename ? 'MANAGE' : 'LOCKED';

    if (canRename) {
      if (note) note.textContent = 'Your name stays attached to the same Real Play Player ID, stats, rank and game history.';
      if (status?.classList.contains('locked')) setStatus('');
    } else if (ownershipStatus === 'pending') {
      if (note) note.textContent = 'Your ownership is still under Admin review. You can change this player name only after Admin fully validates you as the permanent owner.';
      setStatus('PLAYER NAME LOCKED · WAITING FOR ADMIN VALIDATION.', 'locked');
    } else {
      if (note) note.textContent = 'Verified permanent ownership is required before this player name can be changed.';
      setStatus('PLAYER NAME LOCKED · VERIFIED OWNERSHIP REQUIRED.', 'locked');
    }

    renameProfileManageButton();
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

  async function fetchOwnershipState() {
    const requestSequence = ++ownershipRequestSequence;
    const accessToken = token();
    if (!accessToken) {
      if (requestSequence === ownershipRequestSequence) applyOwnershipState(null);
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/profile-ownership/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (requestSequence !== ownershipRequestSequence) return canRename;
      if (!response.ok) {
        applyOwnershipState(null);
        return false;
      }
      applyOwnershipState(data?.ownership || null);
      return canRename;
    } catch (_error) {
      if (requestSequence === ownershipRequestSequence) applyOwnershipState(null);
      return false;
    }
  }

  async function refreshIdentityState() {
    await Promise.all([fetchCanonicalName(), fetchOwnershipState()]);
  }

  if (overlay) {
    const overlayObserver = new MutationObserver(() => {
      if (overlay.classList.contains('open')) refreshIdentityState();
    });
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('focus', () => {
    if (token()) fetchOwnershipState();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!canRename) {
      const unlocked = await fetchOwnershipState();
      if (!unlocked) {
        setStatus(
          ownershipStatus === 'pending'
            ? 'PLAYER NAME LOCKED · WAITING FOR ADMIN VALIDATION.'
            : 'PLAYER NAME LOCKED · VERIFIED OWNERSHIP REQUIRED.',
          'locked'
        );
        return;
      }
    }

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
        if (data?.code === 'PLAYER_NAME_LOCKED_PENDING_VERIFICATION') {
          await fetchOwnershipState();
          throw new Error('Player name changes unlock after Admin fully validates permanent ownership.');
        }
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
      setStatus(error?.message || 'Real Play could not update your player name.', canRename ? 'error' : 'locked');
    } finally {
      if (saveButton) {
        saveButton.textContent = saveButton.dataset.originalText || 'SAVE PLAYER NAME';
        delete saveButton.dataset.originalText;
        saveButton.disabled = !canRename;
      }
    }
  });

  refreshIdentityState();
  renameProfileManageButton();
  const documentObserver = new MutationObserver(() => renameProfileManageButton());
  documentObserver.observe(document.body, { childList: true, subtree: true });
})();
