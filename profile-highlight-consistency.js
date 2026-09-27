(() => {
  if (window.__realPlayHighlightConsistencyInstalled) return;
  window.__realPlayHighlightConsistencyInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let ownGamesCache = null;
  let ownGamesCacheAt = 0;
  let ownGamesLoading = false;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function viewer() {
    return document.querySelector('.rp-highlight-viewer.open');
  }

  function setSeekReady(ready, targetSeconds) {
    const root = viewer();
    if (!root) return;
    root.dataset.rpHighlightSeekReady = ready ? '1' : '0';
    if (Number.isFinite(Number(targetSeconds))) {
      root.dataset.rpHighlightTargetMs = String(Math.max(0, Math.round(Number(targetSeconds) * 1000)));
    }
  }

  function dispatchSeekReady(targetSeconds) {
    try {
      window.dispatchEvent(new CustomEvent('realplay:highlight-seek-ready', {
        detail: { targetSeconds: Math.max(0, Number(targetSeconds) || 0) }
      }));
    } catch (_) {}
  }

  function patchYouTubePlayer() {
    if (!window.YT?.Player) return false;
    if (window.YT.Player.__realPlayCanonicalSeekWrapped) return true;

    const OriginalPlayer = window.YT.Player;

    function CanonicalPlayer(...args) {
      const player = new OriginalPlayer(...args);
      let pendingPlay = false;
      let seekGeneration = 0;

      const originalSeekTo = typeof player.seekTo === 'function' ? player.seekTo.bind(player) : null;
      const originalPlayVideo = typeof player.playVideo === 'function' ? player.playVideo.bind(player) : null;
      const originalPauseVideo = typeof player.pauseVideo === 'function' ? player.pauseVideo.bind(player) : null;
      const originalGetCurrentTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime.bind(player) : null;

      setSeekReady(false, 0);

      if (originalPlayVideo) {
        player.playVideo = function realPlayPlayVideo() {
          const root = viewer();
          if (root && root.dataset.rpHighlightSeekReady !== '1') {
            pendingPlay = true;
            try { originalPauseVideo?.(); } catch (_) {}
            return;
          }
          pendingPlay = false;
          return originalPlayVideo();
        };
      }

      if (originalPauseVideo) {
        player.pauseVideo = function realPlayPauseVideo() {
          pendingPlay = false;
          return originalPauseVideo();
        };
      }

      if (originalSeekTo) {
        player.seekTo = function realPlaySeekTo(seconds, allowSeekAhead) {
          const target = Math.max(0, Number(seconds) || 0);
          const generation = ++seekGeneration;
          setSeekReady(false, target);
          try { originalPauseVideo?.(); } catch (_) {}

          const result = originalSeekTo(target, allowSeekAhead);
          const startedAt = Date.now();

          const confirm = () => {
            if (generation !== seekGeneration) return;
            let current = NaN;
            try { current = Number(originalGetCurrentTime?.()); } catch (_) {}

            const closeEnough = Number.isFinite(current) && Math.abs(current - target) <= 1.05;
            const timedOut = Date.now() - startedAt >= 2200;
            if (!closeEnough && !timedOut) {
              window.setTimeout(confirm, 45);
              return;
            }

            if (!closeEnough) {
              try { originalSeekTo(target, true); } catch (_) {}
            }

            setSeekReady(true, target);
            dispatchSeekReady(target);

            if (pendingPlay) {
              pendingPlay = false;
              try { originalPlayVideo?.(); } catch (_) {}
            }
          };

          window.setTimeout(confirm, 35);
          return result;
        };
      }

      return player;
    }

    try { Object.setPrototypeOf(CanonicalPlayer, OriginalPlayer); } catch (_) {}
    try { CanonicalPlayer.prototype = OriginalPlayer.prototype; } catch (_) {}
    try {
      Object.defineProperty(CanonicalPlayer, '__realPlayCanonicalSeekWrapped', { value: true });
    } catch (_) {
      CanonicalPlayer.__realPlayCanonicalSeekWrapped = true;
    }

    window.YT.Player = CanonicalPlayer;
    return true;
  }

  function installYouTubePatch() {
    if (patchYouTubePlayer()) return;

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { patchYouTubePlayer(); } catch (_) {}
      try { previous?.(); } catch (_) {}
    };

    const started = Date.now();
    const poll = window.setInterval(() => {
      if (patchYouTubePlayer() || Date.now() - started > 20000) window.clearInterval(poll);
    }, 40);
  }

  function bindDirectVideo(video) {
    if (!video || video.dataset.rpHighlightConsistencyBound === '1') return;
    video.dataset.rpHighlightConsistencyBound = '1';

    video.addEventListener('seeking', () => {
      setSeekReady(false, video.currentTime || 0);
    });

    video.addEventListener('seeked', () => {
      const seconds = Math.max(0, Number(video.currentTime) || 0);
      setSeekReady(true, seconds);
      dispatchSeekReady(seconds);
    });
  }

  function sessionId(game) {
    return positiveId(game?.sessionId ?? game?.session_id ?? game?.id);
  }

  function openRankNumber(game) {
    return positiveId(game?.openRankNumber ?? game?.open_rank_number ?? game?.rankingNumber ?? game?.ranking_number);
  }

  function visibleOpenRankNumber(card) {
    const label = String(card?.querySelector('.rp-profile-game-main strong')?.textContent || '').trim();
    const match = label.match(/\bOPEN\s+RANK(?:ING)?(?:\s+(?:SESSION|GAME))?\s*#\s*0*(\d+)\b/i);
    return positiveId(match?.[1]);
  }

  function visibleGameLabel(card) {
    return normalize(card?.querySelector('.rp-profile-game-main strong')?.textContent);
  }

  function gameLabelCandidates(game) {
    const labels = new Set();
    const add = (value) => {
      const clean = normalize(value);
      if (clean) labels.add(clean);
    };

    add(game?.displayLabel);
    add(game?.officialGameId);
    add(game?.official_game_id);
    add(game?.label);
    add(game?.title);

    const rankNo = openRankNumber(game);
    if (rankNo) {
      add(`OPEN RANK #${String(rankNo).padStart(3, '0')}`);
      add(`OPEN RANKING SESSION #${String(rankNo).padStart(3, '0')}`);
      add(`OPEN RANK #${rankNo}`);
      add(`OPEN RANKING SESSION #${rankNo}`);
    }

    const id = sessionId(game);
    if (id) {
      add(`RANKING GAME #${String(id).padStart(3, '0')}`);
      add(`OFFICIAL GAME #${id}`);
    }

    return labels;
  }

  function attachSessions(profile, games) {
    if (!profile || !Array.isArray(games) || !games.length) return;
    const cards = [...profile.querySelectorAll('.rp-profile-history > .rp-profile-game')];
    cards.forEach((card, index) => {
      if (positiveId(card.dataset.rpProfileGameSession)) return;

      const rankNo = visibleOpenRankNumber(card);
      const label = visibleGameLabel(card);
      let game = rankNo ? games.find((row) => openRankNumber(row) === rankNo) : null;
      if (!game && label) game = games.find((row) => gameLabelCandidates(row).has(label)) || null;
      if (!game) game = games[index] || null;

      const id = sessionId(game);
      if (id) card.dataset.rpProfileGameSession = String(id);
    });
  }

  function canonicalPlayerIdFromProfile(profile) {
    if (!profile) return null;
    const loaded = profile.__realPlayPublicPlayer || null;
    return positiveId(
      profile.dataset?.rpPublicCanonicalPlayerId
      ?? loaded?.playerId
      ?? loaded?.canonicalPlayerId
      ?? loaded?.canonical_player_id
    ) || positiveId(profile.dataset?.rpPublicPlayerId);
  }

  function accountUserIdFromProfile(profile) {
    if (!profile) return null;
    const loaded = profile.__realPlayPublicPlayer || null;
    return positiveId(
      profile.dataset?.rpPublicAccountUserId
      ?? loaded?.accountUserId
      ?? loaded?.account_user_id
      ?? loaded?.userId
      ?? loaded?.user_id
    );
  }

  function publicProfileById(playerId) {
    const id = positiveId(playerId);
    if (!id) return null;
    return [...document.querySelectorAll('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]')]
      .find((profile) => {
        const loaded = profile.__realPlayPublicPlayer || null;
        const canonical = positiveId(
          profile.dataset?.rpPublicCanonicalPlayerId
          ?? loaded?.playerId
          ?? loaded?.canonicalPlayerId
          ?? loaded?.canonical_player_id
        );
        if (canonical) return canonical === id;
        return positiveId(profile.dataset?.rpPublicPlayerId) === id;
      }) || null;
  }

  function activePublicProfile() {
    return document.querySelector(
      '.rp-public-player-profile.open, [data-rp-public-profile].open, [data-rp-visitor-public-profile].open, [data-rp-public-history-overlay].open[data-rp-public-profile]'
    );
  }

  function activeReplayIdentity() {
    const profile = activePublicProfile();
    if (!profile) return null;
    const canonicalPlayerId = canonicalPlayerIdFromProfile(profile);
    const accountUserId = accountUserIdFromProfile(profile);
    const playerName = String(
      profile.querySelector('.rp-profile-name h1')?.textContent
      || profile.__realPlayPublicPlayer?.playerName
      || profile.__realPlayPublicPlayer?.player_name
      || ''
    ).trim();
    const numberText = String(profile.querySelector('.rp-profile-number strong')?.textContent || '').trim();
    const rawNumber = Number(numberText.replace(/^#/, ''));
    const playerNumber = Number.isSafeInteger(rawNumber) && rawNumber >= 0 ? rawNumber : null;

    const playerIds = new Set();
    if (accountUserId) playerIds.add(accountUserId);
    if (canonicalPlayerId) {
      playerIds.add(canonicalPlayerId);
      playerIds.add(-canonicalPlayerId);
    }
    if (!playerIds.size && !playerName) return null;
    return {
      profile,
      canonicalPlayerId,
      accountUserId,
      playerName,
      playerNameKey: normalize(playerName),
      playerNumber,
      playerIds,
    };
  }

  function eventPlayerId(event) {
    const raw = event?.playerId ?? event?.player_id ?? event?.userId ?? event?.user_id;
    const id = Number(raw);
    return Number.isSafeInteger(id) && id !== 0 ? id : null;
  }

  function eventPlayerName(event) {
    return String(event?.playerName ?? event?.player_name ?? event?.name ?? '').trim();
  }

  function isReplayEvent(value) {
    if (!value || typeof value !== 'object') return false;
    return value.videoTimestampMs !== undefined
      || value.video_timestamp_ms !== undefined
      || value.timestampMs !== undefined
      || value.timestamp_ms !== undefined
      || value.eventType !== undefined
      || value.event_type !== undefined
      || value.shotResult !== undefined
      || value.shot_result !== undefined
      || value.statKey !== undefined
      || value.stat_key !== undefined;
  }

  function eventMatchesIdentity(event, identity) {
    const id = eventPlayerId(event);
    if (id !== null && identity.playerIds.has(id)) return true;
    const name = normalize(eventPlayerName(event));
    return Boolean(name && identity.playerNameKey && name === identity.playerNameKey);
  }

  function normalizeReplayEvent(event, identity) {
    if (!eventMatchesIdentity(event, identity)) return false;
    let changed = false;

    if (identity.playerName && normalize(eventPlayerName(event)) !== identity.playerNameKey) {
      event.playerName = identity.playerName;
      changed = true;
    }
    if (identity.playerNumber !== null && (event.playerNumber === undefined || event.playerNumber === null || event.playerNumber === '')) {
      event.playerNumber = identity.playerNumber;
      changed = true;
    }

    const type = normalize(event?.eventType ?? event?.event_type ?? event?.type);
    const result = normalize(event?.shotResult ?? event?.shot_result ?? event?.result);
    if (type === 'shot' && (result === 'make' || result === 'made')) {
      const shotValue = Number(event?.shotValue ?? event?.shot_value ?? event?.points ?? event?.value ?? 0);
      const statKey = Number.isFinite(shotValue) && shotValue >= 2 ? 'two_point_make' : 'one_point_make';
      if (!event.statKey && !event.stat_key) {
        event.statKey = statKey;
        changed = true;
      }
    }

    return changed;
  }

  function normalizeReplayPayload(data, identity) {
    if (!data || typeof data !== 'object' || !identity) return false;
    let changed = false;
    const walked = new Set();

    function walk(value, depth) {
      if (depth > 8 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (typeof value !== 'object' || walked.has(value)) return;
      walked.add(value);
      if (isReplayEvent(value) && normalizeReplayEvent(value, identity)) changed = true;
      Object.values(value).forEach((child) => walk(child, depth + 1));
    }

    walk(data, 0);
    return changed;
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || '');
  }

  function canonicalizePublicProfileRequest(url, options, identity) {
    if (!identity?.canonicalPlayerId || !identity?.accountUserId) return options;
    if (identity.canonicalPlayerId === identity.accountUserId) return options;
    if (!/\/api\/real-play\/(?:public\/)?community(?:\?|$)/i.test(url)) return options;
    if (!options || typeof options.body !== 'string') return options;

    try {
      const body = JSON.parse(options.body);
      if (normalize(body?.action) !== 'player_profile') return options;
      const requested = positiveId(body?.playerId ?? body?.userId);
      if (requested !== identity.accountUserId) return options;
      return {
        ...options,
        body: JSON.stringify({ ...body, playerId: identity.canonicalPlayerId }),
      };
    } catch (_) {
      return options;
    }
  }

  function installReplayFetchPatch() {
    if (window.fetch?.__realPlayHighlightIdentityWrapped) return;
    const originalFetch = window.fetch.bind(window);

    const wrappedFetch = async function realPlayHighlightIdentityFetch(input, options = {}) {
      const url = requestUrl(input);
      const identityBefore = activeReplayIdentity();
      const nextOptions = canonicalizePublicProfileRequest(url, options, identityBefore);
      const response = await originalFetch(input, nextOptions);

      if (!response.ok || !/\/api\/real-play\/career\/games\/\d+\/replay(?:\?|$)/i.test(url)) return response;
      const identity = activeReplayIdentity() || identityBefore;
      if (!identity) return response;

      try {
        const data = await response.clone().json();
        if (!normalizeReplayPayload(data, identity)) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (_) {
        return response;
      }
    };

    try {
      Object.defineProperty(wrappedFetch, '__realPlayHighlightIdentityWrapped', { value: true });
    } catch (_) {
      wrappedFetch.__realPlayHighlightIdentityWrapped = true;
    }
    window.fetch = wrappedFetch;
  }

  function makeHistoryArchivePublic(button) {
    const source = button?.closest?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]');
    if (!source) return;

    const loaded = source.__realPlayPublicPlayer || {};
    const canonicalPlayerId = canonicalPlayerIdFromProfile(source);
    const accountUserId = accountUserIdFromProfile(source);
    const replayAuthorityId = positiveId(source.dataset?.rpPublicPlayerId) || accountUserId || canonicalPlayerId;
    const name = String(source.querySelector('.rp-profile-name h1')?.textContent || '').trim();
    if (!canonicalPlayerId && !replayAuthorityId) return;

    window.setTimeout(() => {
      const archive = document.querySelector('[data-rp-public-history-overlay]');
      if (!archive) return;
      archive.dataset.rpPublicProfile = 'true';
      if (replayAuthorityId) archive.dataset.rpPublicPlayerId = String(replayAuthorityId);
      if (canonicalPlayerId) archive.dataset.rpPublicCanonicalPlayerId = String(canonicalPlayerId);
      if (accountUserId) archive.dataset.rpPublicAccountUserId = String(accountUserId);
      archive.__realPlayPublicPlayer = {
        ...loaded,
        ...(canonicalPlayerId ? { playerId: canonicalPlayerId } : {}),
        ...(accountUserId ? { accountUserId } : {}),
        playerName: name || loaded?.playerName || 'REAL PLAY PLAYER',
      };
      attachSessions(archive, recentGamesFrom(loaded));
    }, 0);
  }

  function recentGamesFrom(data) {
    const career = data?.career || data?.careerSummary || data?.career_summary || data?.profile?.career || {};
    const games = data?.recentGames || data?.recent_games || career?.recentGames || career?.recent_games || data?.games;
    return Array.isArray(games) ? games : [];
  }

  async function enrichOwnProfile() {
    const profile = document.querySelector('[data-rp-profile].open, .rp-profile[data-rp-profile="true"].open');
    if (!profile) return;

    if (ownGamesCache && Date.now() - ownGamesCacheAt < 5000) {
      attachSessions(profile, ownGamesCache);
      return;
    }
    if (ownGamesLoading) return;

    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return;

    ownGamesLoading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      ownGamesCache = recentGamesFrom(data);
      ownGamesCacheAt = Date.now();
      attachSessions(profile, ownGamesCache);
    } catch (_) {
    } finally {
      ownGamesLoading = false;
    }
  }

  window.addEventListener('realplay:public-profile-loaded', (event) => {
    const player = event?.detail?.player || null;
    const playerId = positiveId(event?.detail?.playerId ?? player?.playerId ?? player?.userId);
    const profile = publicProfileById(playerId);
    if (profile) {
      if (playerId) profile.dataset.rpPublicCanonicalPlayerId = String(playerId);
      const accountUserId = positiveId(player?.accountUserId ?? player?.account_user_id ?? player?.userId ?? player?.user_id);
      if (accountUserId) profile.dataset.rpPublicAccountUserId = String(accountUserId);
      attachSessions(profile, recentGamesFrom(player));
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    ownGamesCache = null;
    ownGamesCacheAt = 0;
  });

  document.addEventListener('click', (event) => {
    const filter = event.target.closest?.('[data-rp-highlight-filter], [data-rp-highlight-next], [data-rp-highlight-replay]');
    if (filter) setSeekReady(false, 0);

    const more = event.target.closest?.('[data-rp-public-history-more]');
    if (more) makeHistoryArchivePublic(more);
  }, true);

  const observer = new MutationObserver(() => {
    const root = viewer();
    const video = root?.querySelector('[data-rp-highlight-media] video');
    if (video) bindDirectVideo(video);
    enrichOwnProfile();
  });

  function start() {
    installReplayFetchPatch();
    installYouTubePatch();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    enrichOwnProfile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();