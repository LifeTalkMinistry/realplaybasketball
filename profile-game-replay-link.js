(() => {
  if (window.__realPlayProfileGameReplayLinkInstalled) return;
  window.__realPlayProfileGameReplayLinkInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const PUBLIC_COMMUNITY_URL = `${API_BASE_URL}/api/real-play/public/community`;
  const RESOLVE_TIMEOUT_MS = 5000;

  let currentPublicPlayerId = null;
  let ownGamesCache = null;
  let ownGamesCacheAt = 0;
  const publicGamesCache = new Map();
  let resolving = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function visitorActive() {
    return !token() && localStorage.getItem(VISITOR_KEY) === '1';
  }

  function recentGamesFrom(value) {
    const career = value?.career || value?.careerSummary || value?.career_summary || value?.profile?.career || {};
    const rows = value?.recentGames || value?.recent_games || career?.recentGames || career?.recent_games || value?.games;
    return Array.isArray(rows) ? rows : [];
  }

  function sessionIdFrom(game) {
    const id = Number(game?.sessionId ?? game?.session_id ?? game?.id ?? 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function openRankNumberFrom(game) {
    const value = Number(
      game?.openRankNumber
      ?? game?.open_rank_number
      ?? game?.rankingNumber
      ?? game?.ranking_number
      ?? 0
    );
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  function cachedSessionIdFrom(card) {
    const id = Number(card?.dataset?.rpProfileGameSession || 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function visibleOpenRankNumberFrom(card) {
    if (!card) return null;
    const label = String(card.querySelector('.rp-profile-game-main strong')?.textContent || '').trim();
    if (!label) return null;

    // This number is the public Open Rank number, NOT the database session id.
    // Examples: OPEN RANK #034, OPEN RANKING SESSION #034.
    const match = label.match(/\bOPEN\s+RANK(?:ING)?(?:\s+(?:SESSION|GAME))?\s*#\s*0*(\d+)\b/i);
    const value = Number(match?.[1] || 0);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  function gameIndex(card) {
    const history = card?.closest('.rp-profile-history');
    if (!history) return -1;
    return [...history.querySelectorAll(':scope > .rp-profile-game')].indexOf(card);
  }

  function resolveCanonicalSessionId(games, card, index) {
    const rows = Array.isArray(games) ? games : [];
    const openRankNumber = visibleOpenRankNumberFrom(card);

    // Prefer matching the displayed Open Rank number to the API game record,
    // then take that record's canonical sessionId. This prevents #034 from
    // being mistaken for database session id 34.
    if (openRankNumber) {
      const matched = rows.find((game) => openRankNumberFrom(game) === openRankNumber);
      const matchedSessionId = sessionIdFrom(matched);
      if (matchedSessionId) return matchedSessionId;
    }

    return index >= 0 ? sessionIdFrom(rows[index]) : null;
  }

  async function fetchJsonWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadOwnGames() {
    if (ownGamesCache && Date.now() - ownGamesCacheAt < 5000) return ownGamesCache;
    const auth = token();
    if (!auth) throw new Error('Sign in to Real Play to watch this game.');
    const { response, data } = await fetchJsonWithTimeout(`${API_BASE_URL}/api/real-play/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load this game.');
    ownGamesCache = recentGamesFrom(data);
    ownGamesCacheAt = Date.now();
    return ownGamesCache;
  }

  async function loadPublicGames(playerId) {
    const id = Number(playerId);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Player profile is unavailable.');
    const cached = publicGamesCache.get(id);
    if (cached && Date.now() - cached.at < 5000) return cached.games;

    const auth = token();
    const visitor = visitorActive();
    if (!auth && !visitor) throw new Error('Sign in to Real Play to watch this game.');

    const { response, data } = await fetchJsonWithTimeout(visitor ? PUBLIC_COMMUNITY_URL : COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ action: 'player_profile', playerId: id }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load this player game.');
    const games = recentGamesFrom(data?.player || data);
    publicGamesCache.set(id, { games, at: Date.now() });
    return games;
  }

  function publicPlayerIdFrom(profile) {
    const values = [
      profile?.dataset?.rpPublicPlayerId,
      profile?.__realPlayPublicPlayer?.playerId,
      profile?.__realPlayPublicPlayer?.userId,
      currentPublicPlayerId,
    ];
    for (const value of values) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0) return id;
    }
    return null;
  }

  function closeSourceProfile(card) {
    const publicProfile = card?.closest('[data-rp-public-profile], [data-rp-visitor-public-profile], .rp-public-player-profile');
    if (publicProfile) {
      const closeButton = publicProfile.querySelector('[data-rp-public-profile-close], [data-visitor-profile-close], [data-rp-profile-close], [data-rp-player-profile-close]');
      if (closeButton) {
        closeButton.click();
      } else {
        publicProfile.classList.remove('open');
        publicProfile.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('[data-rp-profile].open, [data-rp-public-profile].open, [data-rp-visitor-public-profile].open')) {
          document.body.classList.remove('rp-profile-open');
        }
      }
      return;
    }

    const ownProfile = card?.closest('[data-rp-profile]');
    if (!ownProfile) return;
    if (window.RealPlayProfile?.close) {
      window.RealPlayProfile.close();
    } else {
      ownProfile.classList.remove('open');
      ownProfile.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-profile-open');
    }
  }

  function openReplay(sessionId, sourceCard = null) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id < 1) return false;

    // A replay opened from a player profile is a child view of that profile.
    // Keep the source profile mounted/open underneath the replay so Back from
    // the video returns to the exact player profile instead of dropping the
    // user back to the Open Rank appointment that launched the profile.

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.rpCareerReplaySession = String(id);
    document.body.appendChild(proxy);
    window.requestAnimationFrame(() => {
      if (!proxy.isConnected) return;
      proxy.click();
      window.setTimeout(() => proxy.remove(), 0);
    });
    return true;
  }

  function setCardBusy(card, busy) {
    if (!card) return;
    card.classList.toggle('rp-profile-game-replay-loading', Boolean(busy));
    card.setAttribute('aria-busy', busy ? 'true' : 'false');
    const hint = card.querySelector('.rp-profile-game-open-hint span');
    if (hint) hint.textContent = busy ? 'OPENING GAME…' : 'VIEW GAME';
  }

  function openResolvedCard(card, id) {
    if (!card || !id) return false;
    card.dataset.rpProfileGameSession = String(id);
    setCardBusy(card, true);
    const opened = openReplay(id, card);
    if (!opened) {
      setCardBusy(card, false);
      return false;
    }

    // Cached game cards used to remain permanently stuck on OPENING GAME…
    // because this fast path returns before handleGameCard reaches its finally
    // block. Clear the temporary state after the replay handoff is dispatched.
    window.setTimeout(() => {
      if (card.isConnected) setCardBusy(card, false);
    }, 250);
    return true;
  }

  async function handleGameCard(card) {
    if (!card || resolving) return;

    // Only trust a session id previously resolved from API data. Never infer a
    // database session id from the visible Open Rank number on the card.
    const immediateId = cachedSessionIdFrom(card);
    if (immediateId) {
      openResolvedCard(card, immediateId);
      return;
    }

    const index = gameIndex(card);
    if (index < 0) return;

    resolving = true;
    setCardBusy(card, true);
    try {
      const publicProfile = card.closest('[data-rp-public-profile], [data-rp-visitor-public-profile], .rp-public-player-profile');
      const games = publicProfile
        ? await loadPublicGames(publicPlayerIdFrom(publicProfile))
        : await loadOwnGames();
      const id = resolveCanonicalSessionId(games, card, index);
      if (!id) throw new Error('This game does not have a verified game page yet.');
      card.dataset.rpProfileGameSession = String(id);
      if (!openReplay(id, card)) throw new Error('This game could not be opened.');
    } catch (error) {
      console.warn('[Real Play] Profile game page could not open.', error);
      const hint = card.querySelector('.rp-profile-game-open-hint span');
      if (hint) {
        hint.textContent = error?.name === 'AbortError' ? 'TRY AGAIN' : 'GAME UNAVAILABLE';
        window.setTimeout(() => {
          if (hint.isConnected) hint.textContent = 'VIEW GAME';
        }, 1800);
      }
    } finally {
      resolving = false;
      if (card.isConnected) setCardBusy(card, false);
    }
  }

  function collapseProfileGames(root = document) {
    root.querySelectorAll?.('.rp-profile-game[open]').forEach((card) => card.removeAttribute('open'));
  }

  function installNavigationStyles() {
    if (document.querySelector('[data-rp-profile-replay-link-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileReplayLinkStyles = '1';
    style.textContent = `
      .rp-profile-game{cursor:pointer}
      .rp-profile-game>.rp-profile-game-detail{display:none!important}
      .rp-profile-game[open]{border-color:rgba(255,255,255,.07);background:#070c14}
      .rp-profile-game .rp-profile-game-open-hint b{font-size:0!important;transform:none!important}
      .rp-profile-game .rp-profile-game-open-hint b::after{content:'›';font-size:.75rem;line-height:1}
      .rp-profile-game:hover,.rp-profile-game:focus-within{border-color:rgba(55,202,255,.2);background:#060d17}
      .rp-profile-game-replay-loading{opacity:.72}
      .rp-profile-game-replay-loading .rp-profile-game-open-hint span{color:#48d7ff}

      /* Open Rank itself is a high-z full-screen layer (2050), the selected
         profile is 2300, and its permanent nav is 2400. Replay is a child
         route of the profile, so it must be the top normal app layer. */
      body.rp-career-replay-open .rp-career-replay{z-index:2600!important}
      .rp-career-replay::before{display:none!important}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', (event) => {
    const playerRow = event.target.closest('[data-world-player-id]');
    if (playerRow) {
      const id = Number(playerRow.dataset.worldPlayerId);
      if (Number.isSafeInteger(id) && id > 0) currentPublicPlayerId = id;
      return;
    }

    const card = event.target.closest('.rp-profile-history .rp-profile-game');
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    card.removeAttribute('open');
    handleGameCard(card);
  }, true);

  document.addEventListener('toggle', (event) => {
    const card = event.target.closest?.('.rp-profile-history .rp-profile-game');
    if (card?.open) card.removeAttribute('open');
  }, true);

  window.addEventListener('realplay:public-profile-loaded', (event) => {
    const id = Number(event?.detail?.playerId || 0);
    if (Number.isSafeInteger(id) && id > 0) currentPublicPlayerId = id;
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY && event.key !== VISITOR_KEY) return;
    ownGamesCache = null;
    ownGamesCacheAt = 0;
    publicGamesCache.clear();
  });

  installNavigationStyles();
  collapseProfileGames();
})();