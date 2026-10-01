(() => {
  if (window.__realPlayWorldPlayerAdminIdentityInstalled) return;
  window.__realPlayWorldPlayerAdminIdentityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  const DAY_MS = 24 * 60 * 60 * 1000;

  let lastPlayerId = null;
  let playerDirectory = new Map();
  let directoryPromise = null;
  let renderQueued = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function capturePlayerId(event) {
    const row = event.target?.closest?.('.rp-world-player-row[data-world-player-id]');
    const id = positiveId(row?.dataset?.worldPlayerId);
    if (id) lastPlayerId = id;
  }

  async function loadDirectory(force = false) {
    if (directoryPromise && !force) return directoryPromise;

    directoryPromise = (async () => {
      const accessToken = localStorage.getItem(TOKEN_KEY) || '';
      if (!accessToken || window.__realPlayAdminVerified !== true) return playerDirectory;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'list' }),
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.admin !== true) return playerDirectory;

      const next = new Map();
      for (const player of Array.isArray(data?.players) ? data.players : []) {
        const id = positiveId(player?.playerId ?? player?.userId);
        if (id) next.set(id, player);
      }
      playerDirectory = next;
      return playerDirectory;
    })().catch(() => playerDirectory).finally(() => {
      directoryPromise = null;
    });

    return directoryPromise;
  }

  function accountLabel(player) {
    const ownership = String(player?.ownershipStatus || '').trim().toUpperCase();
    const unclaimed = Boolean(player?.unclaimed) || (!positiveId(player?.accountUserId) && ownership === 'UNCLAIMED');
    if (unclaimed) return 'UNCLAIMED';
    if (ownership) return ownership;
    return positiveId(player?.accountUserId) ? 'CLAIMED' : '—';
  }

  function parseTime(value) {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function elapsedDaysSince(value) {
    const timestamp = parseTime(value);
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS));
  }

  function lastAuditedGameMeta(player) {
    const lastPlayedAt = player?.lastPlayedAt ?? player?.ranking?.lastPlayedAt ?? null;
    const days = elapsedDaysSince(lastPlayedAt);
    if (days === null) {
      return { text: 'NO AUDITED GAME FOUND', tone: 'empty' };
    }

    const activityWindowDays = Math.max(1, Number(
      player?.rankActivityWindowDays
      ?? player?.ranking?.activityWindowDays
      ?? 30
    ) || 30);

    if (days === 0) return { text: 'TODAY', tone: 'recent' };
    return {
      text: `${days} DAY${days === 1 ? '' : 'S'} AGO`,
      tone: days >= activityWindowDays ? 'inactive' : 'recent',
    };
  }

  function inactiveMeta(player) {
    const rankingStatus = String(
      player?.competitiveStatus
      ?? player?.rankingStatus
      ?? player?.ranking?.status
      ?? ''
    ).trim().toLowerCase();
    const inactive = Boolean(player?.inactive ?? player?.ranking?.inactive) || rankingStatus === 'inactive';
    if (!inactive) return null;

    const inactiveSince = player?.inactiveSince ?? player?.ranking?.inactiveSince ?? null;
    const days = elapsedDaysSince(inactiveSince);
    if (days !== null) {
      return {
        label: 'INACTIVE FOR',
        text: days === 0 ? 'LESS THAN 1 DAY' : `${days} DAY${days === 1 ? '' : 'S'}`,
      };
    }

    const manuallyInactive = Boolean(player?.manualUnranked ?? player?.ranking?.manualUnranked);
    return {
      label: 'INACTIVE STATUS',
      text: manuallyInactive ? 'MANUALLY SET' : 'INACTIVE',
    };
  }

  function renderIdentityDetails() {
    renderQueued = false;
    const sheet = document.querySelector('.rp-player-admin-sheet.open');
    const identity = sheet?.querySelector('.rp-player-admin-identity');
    if (!sheet || !identity || !lastPlayerId) return;

    const player = playerDirectory.get(lastPlayerId);
    if (!player) {
      loadDirectory(true).then(() => queueRender());
      return;
    }

    const existing = identity.querySelector('[data-rp-admin-identity-meta]');
    const playerId = positiveId(player?.playerId ?? player?.userId) || lastPlayerId;
    const email = String(player?.registeredEmail || '').trim();
    const status = accountLabel(player);
    const statusClass = status === 'UNCLAIMED' ? ' unclaimed' : '';
    const lastGame = lastAuditedGameMeta(player);
    const inactivity = inactiveMeta(player);

    const markup = `
      <div class="rp-player-admin-identity-meta" data-rp-admin-identity-meta>
        <div><small>PLAYER ID</small><span>${esc(playerId)}</span></div>
        <div><small>REGISTERED EMAIL</small><span class="email">${esc(email || 'NO REGISTERED EMAIL')}</span></div>
        <div><small>ACCOUNT</small><span class="account${statusClass}">${esc(status)}</span></div>
        <div><small>LAST AUDITED GAME</small><span class="activity ${lastGame.tone}">${esc(lastGame.text)}</span></div>
        ${inactivity ? `<div><small>${esc(inactivity.label)}</small><span class="activity inactive">${esc(inactivity.text)}</span></div>` : ''}
      </div>`;

    if (existing) existing.outerHTML = markup;
    else identity.insertAdjacentHTML('beforeend', markup);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(renderIdentityDetails);
  }

  function installStyles() {
    if (document.querySelector('[data-rp-admin-identity-details-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpAdminIdentityDetailsStyles = '1';
    style.textContent = `
      .rp-player-admin-identity-meta{grid-column:1/-1;display:grid!important;gap:7px!important;margin-top:2px!important;padding-top:10px!important;border-top:1px solid rgba(255,255,255,.065)}
      .rp-player-admin-identity-meta>div{display:grid!important;grid-template-columns:92px minmax(0,1fr)!important;gap:9px!important;align-items:start!important;min-width:0}
      .rp-player-admin-identity-meta small{display:block;color:#53647a;font-size:.43rem;font-weight:950;letter-spacing:.09em;line-height:1.35}
      .rp-player-admin-identity-meta span{display:block!important;margin:0!important;min-width:0;color:#aebdcd!important;font-size:.5rem!important;font-weight:850!important;letter-spacing:.025em!important;line-height:1.4;overflow-wrap:anywhere;white-space:normal!important}
      .rp-player-admin-identity-meta span.account{color:#58ddff!important;font-weight:950!important}
      .rp-player-admin-identity-meta span.account.unclaimed{color:#ffd17a!important}
      .rp-player-admin-identity-meta span.activity.recent{color:#58ddff!important;font-weight:950!important}
      .rp-player-admin-identity-meta span.activity.inactive{color:#ffb65f!important;font-weight:950!important}
      .rp-player-admin-identity-meta span.activity.empty{color:#718096!important;font-weight:900!important}
    `;
    document.head.appendChild(style);
  }

  installStyles();

  document.addEventListener('pointerdown', capturePlayerId, true);
  document.addEventListener('contextmenu', capturePlayerId, true);
  document.addEventListener('click', capturePlayerId, true);

  const observer = new MutationObserver(() => {
    if (document.querySelector('.rp-player-admin-sheet.open .rp-player-admin-identity')) queueRender();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.addEventListener('focus', () => {
    if (window.__realPlayAdminVerified === true) loadDirectory(true).then(() => queueRender());
  });

  loadDirectory();
})();
