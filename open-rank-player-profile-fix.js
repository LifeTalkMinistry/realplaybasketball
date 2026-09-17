(() => {
  if (window.__realPlayOpenRankPlayerProfileFixInstalled) return;
  window.__realPlayOpenRankPlayerProfileFixInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let routing = false;
  let expectedPlayerId = null;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  const normalizeName = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function installStyles() {
    if (document.querySelector('[data-rp-open-rank-profile-fix-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpOpenRankProfileFixStyle = '1';
    style.textContent = `
      body.rp-ranking-open .rp-public-player-profile.open,
      body.rp-ranking-open [data-rp-profile].open,
      body.rp-ranking-open [data-rp-visitor-public-profile].open{
        z-index:2300!important;
      }

      body.rp-simple-navigation-active.rp-ranking-open.rp-profile-open:not(.rp-settings-open) [data-rp-simple-nav]{
        z-index:2400!important;
        display:grid!important;
        visibility:visible!important;
        pointer-events:auto!important;
      }

      body.rp-ranking-open .rp-public-player-profile.open .rp-profile-topbar,
      body.rp-simple-navigation-active.rp-ranking-open [data-rp-profile].open .rp-profile-topbar{
        display:grid!important;
      }

      body.rp-ranking-open .rp-public-player-profile.open .rp-profile-back,
      body.rp-simple-navigation-active.rp-ranking-open [data-rp-profile].open .rp-profile-back{
        display:block!important;
        visibility:visible!important;
        pointer-events:auto!important;
      }

      .rp-open-rank-profile-back{
        position:fixed;
        z-index:2450;
        top:max(10px,env(safe-area-inset-top));
        left:max(12px,calc((100vw - min(100vw,620px))/2 + 12px));
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border:1px solid rgba(255,255,255,.14);
        border-radius:12px;
        color:#f7fbff;
        background:rgba(5,10,17,.96);
        box-shadow:0 10px 28px rgba(0,0,0,.38);
        font:950 1.05rem/1 Arial,sans-serif;
        backdrop-filter:blur(12px);
      }

      body.rp-simple-navigation-active.rp-ranking-open.rp-profile-open .rp-public-player-profile.open .rp-profile-shell,
      body.rp-simple-navigation-active.rp-ranking-open.rp-profile-open [data-rp-profile].open .rp-profile-shell{
        padding-bottom:calc(var(--rp-simple-nav-height,68px) + env(safe-area-inset-bottom) + 24px)!important;
      }
    `;
    document.head.appendChild(style);
  }

  async function getJson(url, options = {}) {
    const auth = token();
    if (!auth) throw new Error('REAL PLAY LOGIN REQUIRED.');
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not resolve this Real Play player.');
    return data;
  }

  function rosterPosition(card) {
    const standbyRoot = card.closest('[data-rp-ranking-standby-roster]');
    if (standbyRoot) {
      const cards = [...standbyRoot.querySelectorAll('.rp-ranking-standby-player')];
      return { kind: 'standby', index: cards.indexOf(card) };
    }

    const securedRoot = card.closest('[data-rp-ranking-secured]');
    if (securedRoot) {
      const cards = [...securedRoot.querySelectorAll('.rp-ranking-secured-player:not(.rp-ranking-standby-player)')];
      return { kind: 'secured', index: cards.indexOf(card) };
    }

    return { kind: '', index: -1 };
  }

  async function resolveCanonicalPlayer(card) {
    const position = rosterPosition(card);
    const cardName = normalizeName(card.querySelector('.rp-ranking-secured-name')?.textContent);

    const [rosterData, directoryData] = await Promise.all([
      getJson(`${API_BASE_URL}/api/real-play/career/session-roster`),
      getJson(`${API_BASE_URL}/api/real-play/community`, {
        method: 'POST',
        body: JSON.stringify({ action: 'players' }),
      }),
    ]);

    const rosterList = position.kind === 'standby'
      ? (Array.isArray(rosterData?.standbyPlayers) ? rosterData.standbyPlayers : [])
      : (Array.isArray(rosterData?.players) ? rosterData.players : []);
    const rosterPlayer = position.index >= 0 ? rosterList[position.index] : null;
    const directory = Array.isArray(directoryData?.players) ? directoryData.players : [];

    const accountUserId = positiveId(rosterPlayer?.accountUserId ?? rosterPlayer?.profileUserId);
    if (accountUserId) {
      const byAccount = directory.find((player) => positiveId(player?.accountUserId) === accountUserId);
      const canonicalId = positiveId(byAccount?.playerId ?? byAccount?.userId);
      if (canonicalId) return { playerId: canonicalId, player: byAccount, rosterPlayer };
    }

    const candidateId = positiveId(rosterPlayer?.playerId ?? card.dataset.rpSecuredPlayerId);
    if (candidateId) {
      const byCanonical = directory.find((player) => {
        const sameId = positiveId(player?.playerId ?? player?.userId) === candidateId;
        if (!sameId) return false;
        const directoryName = normalizeName(player?.playerName);
        return !cardName || !directoryName || directoryName === cardName;
      });
      if (byCanonical) return { playerId: candidateId, player: byCanonical, rosterPlayer };
    }

    if (cardName) {
      const nameMatches = directory.filter((player) => normalizeName(player?.playerName) === cardName);
      if (nameMatches.length === 1) {
        const canonicalId = positiveId(nameMatches[0]?.playerId ?? nameMatches[0]?.userId);
        if (canonicalId) return { playerId: canonicalId, player: nameMatches[0], rosterPlayer };
      }
    }

    return null;
  }

  function showRoutingError(message = '') {
    const node = document.querySelector('[data-rp-ranking-message]');
    if (!node) return;
    const text = String(message || '');
    node.textContent = text;
    node.classList.toggle('error', Boolean(text));
  }

  function closeCurrentProfile() {
    const visitor = document.querySelector('[data-rp-visitor-public-profile].open');
    if (visitor) {
      try { window.RealPlayVisitorPublicProfile?.close?.(); } catch (_error) {}
    }

    const publicProfile = document.querySelector('.rp-public-player-profile.open:not([data-rp-visitor-public-profile])');
    if (publicProfile) {
      const closeButton = publicProfile.querySelector('[data-rp-public-profile-close]:not([data-rp-open-rank-profile-back])');
      if (closeButton) {
        try { closeButton.click(); } catch (_error) {}
      } else {
        publicProfile.classList.remove('open');
        publicProfile.setAttribute('aria-hidden', 'true');
      }
    }

    const ownProfile = document.querySelector('[data-rp-profile].open');
    if (ownProfile) {
      try { window.RealPlayProfile?.close?.(); } catch (_error) {}
    }

    if (!document.querySelector('.rp-public-player-profile.open, [data-rp-profile].open')) {
      document.body.classList.remove('rp-profile-open');
    }
  }

  function ensureBackControl() {
    if (!document.body.classList.contains('rp-ranking-open')) return;
    const panel = document.querySelector('.rp-public-player-profile.open, [data-rp-profile].open');
    if (!panel) return;

    const existing = panel.querySelector('.rp-profile-back, [data-rp-public-profile-close], [data-rp-profile-close]');
    if (existing) return;
    if (panel.querySelector('[data-rp-open-rank-profile-back]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-open-rank-profile-back';
    button.dataset.rpOpenRankProfileBack = 'true';
    button.setAttribute('aria-label', 'Back to Open Rank');
    button.textContent = '←';
    panel.appendChild(button);
  }

  async function openResolvedPlayer(card) {
    if (routing) return;
    routing = true;
    card.setAttribute('aria-busy', 'true');
    showRoutingError('');

    try {
      const resolved = await resolveCanonicalPlayer(card);
      if (!resolved?.playerId) {
        throw new Error('PLAYER IDENTITY COULD NOT BE VERIFIED. PROFILE WAS NOT OPENED.');
      }

      expectedPlayerId = resolved.playerId;
      if (!window.RealPlayPlayers?.openProfile) {
        throw new Error('PLAYER PROFILE SERVICE IS NOT READY.');
      }
      await window.RealPlayPlayers.openProfile(resolved.playerId);
      window.setTimeout(ensureBackControl, 0);
    } catch (error) {
      expectedPlayerId = null;
      showRoutingError(error?.message || 'Could not open that player profile safely.');
      console.warn('[Real Play] Open Rank profile routing blocked an unsafe profile open.', error);
    } finally {
      card.removeAttribute('aria-busy');
      routing = false;
    }
  }

  installStyles();

  /* Capture before the older roster-card listener. The older path trusted one
     numeric field whose meaning changed from account ID to canonical player ID.
     This path resolves the roster row against the canonical Players directory
     first, so a numeric collision can never open a different person. */
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const back = target.closest('[data-rp-open-rank-profile-back]');
    if (back) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeCurrentProfile();
      expectedPlayerId = null;
      return;
    }

    const card = target.closest(
      '[data-rp-ranking-secured] .rp-ranking-secured-player, [data-rp-ranking-standby-roster] .rp-ranking-standby-player'
    );
    if (!card || !document.body.classList.contains('rp-ranking-open')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const isYou = card.classList.contains('is-you') || Boolean(card.querySelector('.rp-ranking-secured-you'));
    if (isYou && window.RealPlayProfile?.open) {
      expectedPlayerId = null;
      window.RealPlayProfile.open();
      window.setTimeout(ensureBackControl, 0);
      return;
    }

    openResolvedPlayer(card);
  }, true);

  /* The permanent bottom navigation is an escape route, not decoration. Close
     both drill-down layers on pointer-down so even earlier click interceptors
     (notably the PLAYERS navigation optimization) cannot leave a profile over
     the destination the user selected. */
  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const navItem = target?.closest?.('[data-rp-simple-nav-item]');
    if (!navItem || !document.body.classList.contains('rp-ranking-open')) return;
    if (!document.body.classList.contains('rp-profile-open')) return;

    closeCurrentProfile();
    try { window.RealPlayRankingGames?.close?.(); } catch (_error) {}
    expectedPlayerId = null;
  }, true);

  window.addEventListener('realplay:public-profile-loaded', (event) => {
    const loadedId = positiveId(event?.detail?.playerId ?? event?.detail?.player?.playerId);
    if (expectedPlayerId && loadedId && loadedId !== expectedPlayerId) {
      console.error('[Real Play] Profile identity mismatch blocked.', {
        expectedPlayerId,
        loadedPlayerId: loadedId,
      });
      closeCurrentProfile();
      showRoutingError('PROFILE IDENTITY MISMATCH BLOCKED. TRY AGAIN.');
      expectedPlayerId = null;
      return;
    }
    window.setTimeout(ensureBackControl, 0);
  });

  const observer = new MutationObserver(() => ensureBackControl());
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})();
