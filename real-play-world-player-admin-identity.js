(() => {
  if (window.__realPlayWorldPlayerAdminIdentityInstalled) return;
  window.__realPlayWorldPlayerAdminIdentityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';

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

    const markup = `
      <div class="rp-player-admin-identity-meta" data-rp-admin-identity-meta>
        <div><small>PLAYER ID</small><span>${esc(playerId)}</span></div>
        <div><small>REGISTERED EMAIL</small><span class="email">${esc(email || 'NO REGISTERED EMAIL')}</span></div>
        <div><small>ACCOUNT</small><span class="account${statusClass}">${esc(status)}</span></div>
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
      .rp-player-admin-identity:has([data-rp-admin-identity-meta]){display:block}
      .rp-player-admin-identity:has([data-rp-admin-identity-meta])>div:first-child{min-width:0}
      .rp-player-admin-identity-meta{grid-column:1/-1;display:grid!important;gap:7px!important;margin-top:11px!important;padding-top:10px!important;border-top:1px solid rgba(255,255,255,.065)}
      .rp-player-admin-identity-meta>div{display:grid!important;grid-template-columns:92px minmax(0,1fr)!important;gap:9px!important;align-items:start!important;min-width:0}
      .rp-player-admin-identity-meta small{display:block;color:#53647a;font-size:.43rem;font-weight:950;letter-spacing:.09em;line-height:1.35}
      .rp-player-admin-identity-meta span{display:block!important;margin:0!important;min-width:0;color:#aebdcd!important;font-size:.5rem!important;font-weight:850!important;letter-spacing:.025em!important;line-height:1.4;overflow-wrap:anywhere;white-space:normal!important}
      .rp-player-admin-identity-meta span.account{color:#58ddff!important;font-weight:950!important}
      .rp-player-admin-identity-meta span.account.unclaimed{color:#ffd17a!important}
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
