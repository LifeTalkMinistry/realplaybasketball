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

  // A replay route is keyed by the canonical career session id. A generic
  // object id is not interchangeable with that relationship key.
  function sessionIdFrom(game) {
    const id = Number(game?.sessionId ?? game?.session_id ?? 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function openRankNumberFrom(game) {
    const value = Number(game?.openRankNumber ?? game?.open_rank_number ?? game?.rankingNumber ?? game?.ranking_number ?? 0);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  function cachedSessionIdFrom(card) {
    const id = Number(card?.dataset?.rpProfileGameSession || 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function normalizeText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function visibleGameLabel(card) {
    return normalizeText(card?.querySelector('.rp-profile-game-main strong')?.textContent);
  }

  function gameLabels(game) {
    return [
      game?.displayLabel,
      game?.display_label,
      game?.officialGameId,
      game?.official_game_id,
      game?.label,
      game?.title,
    ].map(normalizeText).filter(Boolean);
  }

  function visibleScore(card) {
    const score = card?.querySelector('.rp-profile-game-score');
    if (!score) return null;

    const labels = [...score.querySelectorAll('span')].map((node) => normalizeText(node.textContent));
    const values = [...score.querySelectorAll('strong')].map((node) => Number(String(node.textContent || '').trim()));
    if (labels.length < 2 || values.length < 2) return null;

    const result = { west: null, east: null };
    labels.forEach((label, index) => {
      if (!Number.isFinite(values[index])) return;
      if (label.includes('WEST')) result.west = values[index];
      if (label.includes('EAST')) result.east = values[index];
    });

    return Number.isFinite(result.west) && Number.isFinite(result.east) ? result : null;
  }

  function gameScoreMatches(game, score) {
    if (!score) return true;
    const west = Number(game?.westScore ?? game?.west_score);
    const east = Number(game?.eastScore ?? game?.east_score);
    return Number.isFinite(west) && Number.isFinite(east)
      && west === score.west
      && east === score.east;
  }

  function visibleOpenRankNumberFrom(card) {
    const label = String(card?.querySelector('.rp-profile-game-main strong')?.textContent || '').trim();
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
    const canonicalRows = rows.filter((game) => sessionIdFrom(game));

    const openRankNumber = visibleOpenRankNumberFrom(card);
    if (openRankNumber) {
      const matches = canonicalRows.filter((game) => openRankNumberFrom(game) === openRankNumber);
      if (matches.length === 1) return sessionIdFrom(matches[0]);
    }

    // Public history can be filtered, preview-limited, or re-rendered. Resolve
    // the clicked card by its visible game identity before ever trusting its
    // current list position.
    const label = visibleGameLabel(card);
    const score = visibleScore(card);
    if (label) {
      const exact = canonicalRows.filter((game) => gameLabels(game).includes(label) && gameScoreMatches(game, score));
      if (exact.length === 1) return sessionIdFrom(exact[0]);

      const labelOnly = canonicalRows.filter((game) => gameLabels(game).includes(label));
      if (labelOnly.length === 1) return sessionIdFrom(labelOnly[0]);
    }

    if (score) {
      const scoreOnly = canonicalRows.filter((game) => gameScoreMatches(game, score));
      if (scoreOnly.length === 1) return sessionIdFrom(scoreOnly[0]);
    }

    // Index is only a last-resort compatibility path, and it can only resolve
    // a row that already carries an explicit canonical session id.
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

  function openReplay(sessionId) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id < 1) return false;
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
    const opened = openReplay(id);
    if (!opened) {
      setCardBusy(card, false);
      return false;
    }
    window.setTimeout(() => {
      if (card.isConnected) setCardBusy(card, false);
    }, 250);
    return true;
  }

  async function handleGameCard(card) {
    if (!card || resolving) return;

    const publicProfile = card.closest('[data-rp-public-profile], [data-rp-visitor-public-profile], .rp-public-player-profile');
    const publicArchive = card.closest('[data-rp-public-history-overlay]');
    const isPublicGame = Boolean(publicProfile || publicArchive);

    // A private/own-profile card may use its already-resolved canonical session.
    // Public cards are always re-resolved against that player's canonical game
    // list so stale DOM data or a generic result id can never route the replay.
    const immediateId = cachedSessionIdFrom(card);
    if (immediateId && !isPublicGame) {
      openResolvedCard(card, immediateId);
      return;
    }

    const index = gameIndex(card);
    if (index < 0) return;

    resolving = true;
    setCardBusy(card, true);
    try {
      const games = isPublicGame
        ? await loadPublicGames(publicProfile ? publicPlayerIdFrom(publicProfile) : currentPublicPlayerId)
        : await loadOwnGames();
      const id = resolveCanonicalSessionId(games, card, index);
      if (!id) throw new Error('This game does not have a verified game page yet.');
      card.dataset.rpProfileGameSession = String(id);
      if (!openReplay(id)) throw new Error('This game could not be opened.');
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
      .rp-profile-game-media-actions{grid-column:1/-1!important}
      .rp-profile-game-replay-loading{opacity:.72}
      .rp-profile-game-replay-loading .rp-profile-game-open-hint span{color:#48d7ff}
      body.rp-career-replay-open .rp-career-replay{z-index:2600!important}
      .rp-career-replay::before{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function loadHighlightLayer() {
    if (window.__realPlayProfileHighlightsInstalled || document.querySelector('script[data-rp-profile-highlights-loader]')) return;
    const script = document.createElement('script');
    script.src = `profile-game-highlights.js?v=20260918-highlight-picker-v2`;
    script.async = false;
    script.dataset.rpProfileHighlightsLoader = '1';
    script.onerror = () => console.warn('[Real Play] Player highlight layer could not load.');
    document.head.appendChild(script);
  }

  function loadHighlightAutoplayLayer() {
    if (window.__realPlayHighlightAutoplayInstalled || document.querySelector('script[data-rp-highlight-autoplay-loader]')) return;
    const script = document.createElement('script');
    script.src = `profile-highlight-autoplay.js?v=20260918-highlight-seek-autoplay-v3`;
    script.async = false;
    script.dataset.rpHighlightAutoplayLoader = '1';
    script.onerror = () => console.warn('[Real Play] Highlight autoplay layer could not load.');
    document.head.appendChild(script);
  }

  function isTouchIOSBrowser() {
    const ua = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    return /iPhone|iPod|iPad/i.test(ua)
      || ((/Macintosh/i.test(ua) || platform === 'MacIntel') && touchPoints > 1);
  }

  function loadIPhoneHighlightOrientationLayer() {
    if (!isTouchIOSBrowser()) return;
    if (window.__realPlayIPhoneHighlightOrientationInstalled || document.querySelector('script[data-rp-iphone-highlight-orientation-loader]')) return;
    const script = document.createElement('script');
    script.src = `profile-highlight-iphone-orientation.js?v=20260918-ios-video-only-v3`;
    script.async = false;
    script.dataset.rpIphoneHighlightOrientationLoader = '1';
    script.onerror = () => console.warn('[Real Play] iOS highlight orientation layer could not load.');
    document.head.appendChild(script);
  }

  document.addEventListener('click', (event) => {
    const playerRow = event.target.closest('[data-world-player-id]');
    if (playerRow) {
      const id = Number(playerRow.dataset.worldPlayerId);
      if (Number.isSafeInteger(id) && id > 0) currentPublicPlayerId = id;
      return;
    }

    if (event.target.closest('[data-rp-profile-highlight-action]')) return;

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
  loadHighlightLayer();
  loadHighlightAutoplayLayer();
  loadIPhoneHighlightOrientationLayer();
})();