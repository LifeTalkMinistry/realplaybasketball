(() => {
  if (window.__realPlayProfileAdminAccountInfoInstalled) return;
  window.__realPlayProfileAdminAccountInfoInstalled = true;

  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  const TOKEN_KEY = 'real_play_access_token';

  let selectedAccountUserId = null;
  let selectedRow = null;
  let requestSequence = 0;
  let enhanceQueued = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function adminContextActive() {
    try {
      return Boolean(
        window.__realPlayAdminVerified === true ||
        window.RealPlayServerGate?.isAdminBypass?.() === true
      );
    } catch (_error) {
      return window.__realPlayAdminVerified === true;
    }
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

  function cleanStatus(value, fallback = '—') {
    const text = String(value || '').trim();
    return text ? text.replaceAll('_', ' ').toUpperCase() : fallback;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-admin-player-info-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpAdminPlayerInfoStyle = '1';
    style.textContent = `
      .rp-player-admin-private-info{margin-top:11px;padding:12px;border:1px solid rgba(69,216,255,.18);border-radius:14px;background:linear-gradient(180deg,rgba(7,19,29,.96),rgba(4,9,15,.98));box-shadow:inset 0 0 0 1px rgba(255,255,255,.018)}
      .rp-player-admin-private-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 1px 9px;border-bottom:1px solid rgba(255,255,255,.06)}
      .rp-player-admin-private-head strong{color:#55dcff;font-family:var(--rp-display,Arial,sans-serif);font-size:.56rem;font-style:italic;font-weight:950;letter-spacing:.08em}
      .rp-player-admin-private-head span{padding:3px 6px;border:1px solid rgba(255,95,111,.16);border-radius:999px;color:#ff8994;background:rgba(255,47,72,.06);font-size:.38rem;font-weight:950;letter-spacing:.09em}
      .rp-player-admin-private-status{margin:10px 0 0;color:#718196;font-size:.52rem;font-weight:850;line-height:1.45;text-align:center}
      .rp-player-admin-private-status.error{color:#ff8190}
      .rp-player-admin-private-grid{display:grid;gap:6px;margin-top:10px}
      .rp-player-admin-private-row{display:grid;grid-template-columns:minmax(92px,.72fr) minmax(0,1.28fr);gap:10px;align-items:center;min-height:39px;padding:7px 9px;border:1px solid rgba(255,255,255,.052);border-radius:10px;background:#050a10}
      .rp-player-admin-private-row span{color:#607185;font-size:.42rem;font-weight:950;letter-spacing:.075em}
      .rp-player-admin-private-row strong{min-width:0;overflow-wrap:anywhere;color:#dce8f2;font-size:.56rem;font-weight:900;line-height:1.35;text-align:right}
      .rp-player-admin-private-row strong.accent{color:#58dcff}
      .rp-player-admin-private-note{margin:9px 2px 0;color:#526377;font-size:.44rem;font-weight:800;line-height:1.4;text-align:center}
      @media(max-width:380px){.rp-player-admin-private-row{grid-template-columns:82px minmax(0,1fr)}.rp-player-admin-private-row strong{font-size:.52rem}}
    `;
    document.head.appendChild(style);
  }

  function removeLegacyProfileWidgets() {
    document.querySelectorAll('[data-rp-profile-admin-account]').forEach((node) => node.remove());
  }

  function rememberPlayer(target) {
    const row = target?.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row) return;
    const id = positiveId(row.dataset.worldPlayerId);
    if (!id) return;
    if (selectedAccountUserId !== id) {
      selectedAccountUserId = id;
      requestSequence += 1;
    }
    selectedRow = row;
  }

  document.addEventListener('pointerdown', (event) => rememberPlayer(event.target), true);
  document.addEventListener('click', (event) => rememberPlayer(event.target), true);
  document.addEventListener('contextmenu', (event) => rememberPlayer(event.target), true);

  function activeSheet() {
    return document.querySelector('[data-rp-player-admin-sheet].open');
  }

  function makeRow(label, value, accent = false) {
    const row = document.createElement('div');
    row.className = 'rp-player-admin-private-row';

    const key = document.createElement('span');
    key.textContent = label;

    const content = document.createElement('strong');
    if (accent) content.classList.add('accent');
    content.textContent = value || '—';

    row.append(key, content);
    return row;
  }

  function rowText(selector) {
    const node = selectedRow?.querySelector?.(selector);
    return String(node?.textContent || '').trim();
  }

  function renderInfo(panel, data, accountUserId) {
    if (!panel?.isConnected) return;

    const player = data?.player || {};
    const status = panel.querySelector('[data-rp-admin-private-status]');
    status?.remove();

    const canonicalPlayerId = positiveId(player.playerId);
    const publicPlayerId = String(player.publicPlayerId || '').trim() || '—';
    const linkedAccountId = positiveId(player.accountUserId) || accountUserId;
    const grid = document.createElement('div');
    grid.className = 'rp-player-admin-private-grid';

    const displayedName = String(player.playerName || '').trim() || rowText('.rp-world-player-name') || '—';
    const ownership = cleanStatus(player.ownershipStatus, player.accountLinked ? 'CLAIMED' : 'UNCLAIMED');

    grid.append(
      makeRow('PLAYER NAME', displayedName),
      makeRow('PUBLIC PLAYER ID', publicPlayerId, true),
      makeRow('INTERNAL PLAYER ID', canonicalPlayerId ? `#${canonicalPlayerId}` : 'NOT AVAILABLE'),
      makeRow('ACCOUNT ID', linkedAccountId ? `#${linkedAccountId}` : 'NO ACCOUNT LINKED'),
      makeRow('LINKED EMAIL', player.accountLinked ? (player.email || '—') : 'NO ACCOUNT LINKED'),
      makeRow('OWNERSHIP', ownership),
      makeRow('ACCOUNT STATUS', cleanStatus(player.accountStatus)),
      makeRow('IDENTITY CREATED', formatDateTime(player.identityCreatedAt)),
      makeRow('PROFILE CREATED', formatDateTime(player.profileCreatedAt || player.playerCreatedAt)),
      makeRow('ACCOUNT CREATED', formatDateTime(player.accountCreatedAt)),
      makeRow('CLAIMED AT', formatDateTime(player.claimedAt))
    );

    panel.appendChild(grid);

    const note = document.createElement('p');
    note.className = 'rp-player-admin-private-note';
    note.textContent = 'PRIVATE ADMIN METADATA · AUTHENTICATION SECRETS ARE NEVER SHOWN';
    panel.appendChild(note);
  }

  async function loadInfo(panel, accountUserId) {
    const requestId = ++requestSequence;
    const status = panel.querySelector('[data-rp-admin-private-status]');

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
        body: JSON.stringify({
          action: 'account_info',
          accountUserId,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.admin !== true) {
        throw new Error(data?.message || data?.error || 'Unable to load player information.');
      }

      if (
        requestId !== requestSequence ||
        !panel.isConnected ||
        positiveId(panel.dataset.accountUserId) !== accountUserId
      ) return;

      panel.dataset.loaded = '1';
      renderInfo(panel, data, accountUserId);
    } catch (error) {
      if (!panel.isConnected) return;
      if (status) {
        status.classList.add('error');
        status.textContent = error?.message || 'Unable to load player information.';
      }
    }
  }

  function createInfoPanel(accountUserId) {
    const panel = document.createElement('section');
    panel.className = 'rp-player-admin-private-info';
    panel.dataset.rpAdminPlayerPrivateInfo = '1';
    panel.dataset.accountUserId = String(accountUserId);
    panel.innerHTML = `
      <div class="rp-player-admin-private-head">
        <strong>PLAYER INFORMATION</strong>
        <span>ADMIN ONLY</span>
      </div>
      <p class="rp-player-admin-private-status" data-rp-admin-private-status>LOADING PRIVATE PLAYER INFORMATION…</p>`;
    return panel;
  }

  function enhanceSheet() {
    enhanceQueued = false;
    removeLegacyProfileWidgets();

    if (!adminContextActive()) return;
    const sheet = activeSheet();
    const accountUserId = positiveId(selectedAccountUserId);
    if (!sheet || !accountUserId) return;

    const body = sheet.querySelector('[data-rp-player-admin-body]');
    const identity = body?.querySelector('.rp-player-admin-identity');
    if (!body || !identity) return;

    const existing = body.querySelector('[data-rp-admin-player-private-info]');
    if (existing && positiveId(existing.dataset.accountUserId) === accountUserId) return;
    existing?.remove();

    installStyles();
    const panel = createInfoPanel(accountUserId);
    identity.insertAdjacentElement('afterend', panel);
    void loadInfo(panel, accountUserId);
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    window.requestAnimationFrame(enhanceSheet);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) queueEnhance();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  removeLegacyProfileWidgets();
  queueEnhance();
})();
