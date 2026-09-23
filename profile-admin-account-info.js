(() => {
  if (window.__realPlayProfileAdminAccountInfoInstalled) return;
  window.__realPlayProfileAdminAccountInfoInstalled = true;

  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  const TOKEN_KEY = 'real_play_access_token';
  const MAX_ADMIN_WAIT_ATTEMPTS = 48;
  const ADMIN_WAIT_MS = 125;

  let activePlayerId = null;
  let activePlayer = null;
  let mountSequence = 0;
  let verifyPromise = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function adminAlreadyVerified() {
    try {
      return Boolean(
        window.__realPlayAdminVerified === true ||
        window.RealPlayServerGate?.isAdminBypass?.() === true
      );
    } catch (_error) {
      return window.__realPlayAdminVerified === true;
    }
  }

  async function verifyAdminOnce() {
    if (adminAlreadyVerified()) return true;
    if (!token()) return false;
    if (verifyPromise) return verifyPromise;

    const verify = window.__realPlayVerifyAdminAccess;
    if (typeof verify !== 'function') return null;

    verifyPromise = Promise.resolve()
      .then(() => verify())
      .then((allowed) => Boolean(allowed))
      .catch(() => false)
      .finally(() => { verifyPromise = null; });

    return verifyPromise;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-profile-admin-account-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileAdminAccountStyle = '1';
    style.textContent = `
      .rp-profile-admin-account{margin:14px 0 max(22px,env(safe-area-inset-bottom));padding:0 0 4px}
      .rp-profile-admin-account-button{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(69,216,255,.30);border-radius:14px;color:#59ddff;background:linear-gradient(180deg,rgba(12,54,72,.25),rgba(4,17,25,.72));box-shadow:inset 0 0 0 1px rgba(255,255,255,.018);font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.58rem;font-style:italic;font-weight:950;letter-spacing:.09em;cursor:pointer;text-transform:uppercase}
      .rp-profile-admin-account-button::before{content:'◆';font-size:.55rem;font-style:normal}
      .rp-profile-admin-account-button[aria-expanded="true"]{border-color:rgba(69,216,255,.48);background:rgba(15,83,111,.18)}
      .rp-profile-admin-account-panel{display:none;margin-top:9px;padding:14px;border:1px solid rgba(69,216,255,.17);border-radius:15px;background:linear-gradient(180deg,#071019,#04080d);box-shadow:0 14px 34px rgba(0,0,0,.22)}
      .rp-profile-admin-account.open .rp-profile-admin-account-panel{display:block}
      .rp-profile-admin-account-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.065)}
      .rp-profile-admin-account-head span{color:#45d8ff;font-size:.48rem;font-weight:950;letter-spacing:.13em}
      .rp-profile-admin-account-head b{color:#53657a;font-size:.44rem;font-weight:900;letter-spacing:.08em}
      .rp-profile-admin-account-status{min-height:20px;margin:12px 0 0;color:#718196;font-size:.54rem;font-weight:850;line-height:1.45;text-align:center}
      .rp-profile-admin-account-status.error{color:#ff8190}
      .rp-profile-admin-account-grid{display:grid;gap:7px;margin-top:11px}
      .rp-profile-admin-account-row{display:grid;grid-template-columns:minmax(92px,.72fr) minmax(0,1.28fr);gap:10px;align-items:center;min-height:43px;padding:8px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:#050a10}
      .rp-profile-admin-account-row span{color:#617286;font-size:.44rem;font-weight:950;letter-spacing:.08em}
      .rp-profile-admin-account-row strong{min-width:0;overflow-wrap:anywhere;color:#dce8f2;font-size:.58rem;font-weight:900;line-height:1.35;text-align:right}
      .rp-profile-admin-account-row strong.accent{color:#58dcff}
      .rp-profile-admin-account-note{margin:10px 2px 0;color:#56677b;font-size:.48rem;font-weight:750;line-height:1.45;text-align:center}
      @media(max-width:380px){.rp-profile-admin-account-row{grid-template-columns:82px minmax(0,1fr);padding-inline:9px}.rp-profile-admin-account-row strong{font-size:.54rem}}
    `;
    document.head.appendChild(style);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function publicProfilePanel() {
    const openPanel = [...document.querySelectorAll('.rp-public-player-profile')]
      .find((panel) => panel.getAttribute('aria-hidden') !== 'true');
    return openPanel || document.querySelector('.rp-public-player-profile');
  }

  function removeExisting(panel = document) {
    panel.querySelectorAll?.('[data-rp-profile-admin-account]').forEach((node) => node.remove());
  }

  function makeRow(label, value, accent = false) {
    const row = document.createElement('div');
    row.className = 'rp-profile-admin-account-row';

    const key = document.createElement('span');
    key.textContent = label;

    const content = document.createElement('strong');
    if (accent) content.classList.add('accent');
    content.textContent = value || '—';

    row.append(key, content);
    return row;
  }

  function renderInfo(widget, data) {
    const panel = widget.querySelector('[data-rp-admin-account-panel]');
    const status = widget.querySelector('[data-rp-admin-account-status]');
    if (!panel || !status) return;

    const player = data?.player || {};
    const linked = player.accountLinked === true && positiveId(player.accountUserId);
    const publicId = String(player.publicPlayerId || `RP-${String(player.playerId || activePlayerId || 0).padStart(5, '0')}`);
    const rawPlayerId = positiveId(player.playerId || activePlayerId);

    status.remove();
    const grid = document.createElement('div');
    grid.className = 'rp-profile-admin-account-grid';
    grid.append(
      makeRow('PLAYER ID', rawPlayerId ? `${publicId} · #${rawPlayerId}` : publicId, true),
      makeRow('ACCOUNT ID', linked ? `#${player.accountUserId}` : 'NO ACCOUNT LINKED'),
      makeRow('LINKED EMAIL', linked ? (player.email || '—') : 'NO ACCOUNT LINKED'),
      makeRow('PLAYER CREATED', formatDateTime(player.playerCreatedAt)),
      makeRow('ACCOUNT CREATED', linked ? formatDateTime(player.accountCreatedAt) : '—')
    );

    panel.appendChild(grid);

    const note = document.createElement('p');
    note.className = 'rp-profile-admin-account-note';
    note.textContent = linked
      ? 'PRIVATE ADMIN ACCOUNT METADATA'
      : 'THIS PLAYER IDENTITY HAS NOT BEEN ATTACHED TO A REAL PLAY ACCOUNT.';
    panel.appendChild(note);
  }

  async function loadAccountInfo(widget) {
    const playerId = positiveId(widget.dataset.playerId);
    if (!playerId) return;

    const status = widget.querySelector('[data-rp-admin-account-status]');
    const button = widget.querySelector('[data-rp-admin-account-toggle]');
    if (status) {
      status.classList.remove('error');
      status.textContent = 'LOADING ACCOUNT INFORMATION…';
    }
    if (button) button.disabled = true;

    try {
      const accessToken = token();
      if (!accessToken) throw new Error('Admin session is not signed in.');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'account_info', playerId }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.admin !== true) {
        throw new Error(data?.message || data?.error || 'Unable to load account information.');
      }

      if (!widget.isConnected || positiveId(widget.dataset.playerId) !== activePlayerId) return;
      widget.dataset.loaded = '1';
      renderInfo(widget, data);
    } catch (error) {
      if (status) {
        status.classList.add('error');
        status.textContent = error?.message || 'Unable to load account information.';
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function createWidget(playerId) {
    const widget = document.createElement('section');
    widget.className = 'rp-profile-admin-account';
    widget.dataset.rpProfileAdminAccount = '1';
    widget.dataset.playerId = String(playerId);
    widget.innerHTML = `
      <button type="button" class="rp-profile-admin-account-button" data-rp-admin-account-toggle aria-expanded="false">
        ADMIN · VIEW ACCOUNT INFO
      </button>
      <div class="rp-profile-admin-account-panel" data-rp-admin-account-panel>
        <div class="rp-profile-admin-account-head">
          <span>ADMIN ACCOUNT INFO</span>
          <b>PRIVATE</b>
        </div>
        <p class="rp-profile-admin-account-status" data-rp-admin-account-status>OPEN TO LOAD PRIVATE ACCOUNT METADATA.</p>
      </div>`;

    const button = widget.querySelector('[data-rp-admin-account-toggle]');
    button?.addEventListener('click', async () => {
      const open = !widget.classList.contains('open');
      widget.classList.toggle('open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && widget.dataset.loaded !== '1') await loadAccountInfo(widget);
    });

    return widget;
  }

  function mountForCurrentPlayer() {
    const playerId = activePlayerId;
    if (!playerId || !adminAlreadyVerified()) return false;

    const profile = publicProfilePanel();
    if (!profile || profile.getAttribute('aria-hidden') === 'true') return false;

    const history = profile.querySelector('.rp-profile-history');
    if (!history) return false;

    removeExisting(profile);
    const widget = createWidget(playerId);
    history.insertAdjacentElement('afterend', widget);
    return true;
  }

  async function waitForAdminAndMount(sequence, attempt = 0) {
    if (sequence !== mountSequence || !activePlayerId) return;

    if (adminAlreadyVerified()) {
      installStyles();
      mountForCurrentPlayer();
      return;
    }

    const verified = await verifyAdminOnce();
    if (sequence !== mountSequence || !activePlayerId) return;
    if (verified === true) {
      installStyles();
      mountForCurrentPlayer();
      return;
    }

    if (verified === false && typeof window.__realPlayVerifyAdminAccess === 'function') {
      removeExisting(publicProfilePanel() || document);
      return;
    }

    if (attempt >= MAX_ADMIN_WAIT_ATTEMPTS) return;
    window.setTimeout(() => waitForAdminAndMount(sequence, attempt + 1), ADMIN_WAIT_MS);
  }

  function handlePublicProfileLoaded(event) {
    const player = event?.detail?.player || null;
    const playerId = positiveId(event?.detail?.playerId ?? player?.playerId);
    activePlayer = player;
    activePlayerId = playerId;
    mountSequence += 1;

    const profile = publicProfilePanel();
    if (profile) removeExisting(profile);
    if (!playerId) return;

    waitForAdminAndMount(mountSequence);
  }

  window.addEventListener('realplay:public-profile-loaded', handlePublicProfileLoaded);
  window.addEventListener('realplay:enhancements-ready', () => {
    if (!activePlayerId) return;
    mountSequence += 1;
    waitForAdminAndMount(mountSequence);
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    activePlayer = null;
    activePlayerId = null;
    mountSequence += 1;
    removeExisting(document);
  });
})();
