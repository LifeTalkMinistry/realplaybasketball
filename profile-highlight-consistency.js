(() => {
  if (window.__realPlayHighlightConsistencyInstalled) return;
  window.__realPlayHighlightConsistencyInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

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

          // Never allow the full video to visibly run from 0:00 while the
          // official highlight timestamp is still being applied.
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

            // A timeout is only a fallback for YouTube reporting lag. Re-seek
            // once before releasing playback so every profile/view path uses
            // the same authoritative timestamp.
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

  function attachSessions(profile, games) {
    if (!profile || !Array.isArray(games) || !games.length) return;
    const cards = [...profile.querySelectorAll('.rp-profile-history > .rp-profile-game')];
    cards.forEach((card, index) => {
      if (positiveId(card.dataset.rpProfileGameSession)) return;

      const rankNo = visibleOpenRankNumber(card);
      let game = rankNo ? games.find((row) => openRankNumber(row) === rankNo) : null;
      if (!game) game = games[index] || null;
      const id = sessionId(game);
      if (id) card.dataset.rpProfileGameSession = String(id);
    });
  }

  function publicProfileById(playerId) {
    const id = positiveId(playerId);
    if (!id) return null;
    return [...document.querySelectorAll('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]')]
      .find((profile) => positiveId(profile.dataset?.rpPublicPlayerId) === id) || null;
  }

  function makeHistoryArchivePublic(button) {
    const source = button?.closest?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]');
    if (!source) return;

    const playerId = positiveId(source.dataset?.rpPublicPlayerId)
      || positiveId(source.__realPlayPublicPlayer?.playerId ?? source.__realPlayPublicPlayer?.userId);
    const name = String(source.querySelector('.rp-profile-name h1')?.textContent || '').trim();
    if (!playerId) return;

    window.setTimeout(() => {
      const archive = document.querySelector('[data-rp-public-history-overlay]');
      if (!archive) return;
      archive.dataset.rpPublicProfile = 'true';
      archive.dataset.rpPublicPlayerId = String(playerId);
      archive.__realPlayPublicPlayer = {
        ...(source.__realPlayPublicPlayer || {}),
        playerId,
        playerName: name || source.__realPlayPublicPlayer?.playerName || 'REAL PLAY PLAYER',
      };
    }, 0);
  }

  async function enrichOwnProfile() {
    const profile = document.querySelector('[data-rp-profile].open, .rp-profile[data-rp-profile="true"].open');
    if (!profile || profile.dataset.rpHighlightSessionsEnriched === '1') return;
    profile.dataset.rpHighlightSessionsEnriched = '1';

    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const career = data?.career || data?.careerSummary || data?.career_summary || {};
      const games = data?.recentGames || data?.recent_games || career?.recentGames || career?.recent_games || data?.games;
      attachSessions(profile, Array.isArray(games) ? games : []);
    } catch (_) {}
  }

  window.addEventListener('realplay:public-profile-loaded', (event) => {
    const player = event?.detail?.player || null;
    const playerId = positiveId(event?.detail?.playerId ?? player?.playerId ?? player?.userId);
    const profile = publicProfileById(playerId);
    const career = player?.career || player?.careerSummary || player?.career_summary || {};
    const games = player?.recentGames || player?.recent_games || career?.recentGames || career?.recent_games || player?.games;
    if (profile) attachSessions(profile, Array.isArray(games) ? games : []);
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
    installYouTubePatch();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    enrichOwnProfile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();