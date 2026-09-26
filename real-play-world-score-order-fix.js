(() => {
  if (window.__realPlayWorldScoreOrderFixInstalled) return;
  window.__realPlayWorldScoreOrderFixInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let profileRankRequestId = 0;

  function putWestFirst(board) {
    if (!(board instanceof HTMLElement) || board.dataset.rpWestFirst === 'true') return;
    const children = [...board.children];
    if (children.length !== 5) return;

    // real-play-world-players.js currently renders public game score rows as:
    // EAST label, EAST score, dash, WEST score, WEST label.
    // The rest of Real Play uses WEST — EAST, so normalize the public profile
    // to the same visual order without changing any score/stat values.
    board.replaceChildren(children[4], children[3], children[2], children[1], children[0]);
    board.dataset.rpWestFirst = 'true';
  }

  function normalizePublicProfileScores(root = document) {
    root.querySelectorAll?.('.rp-public-player-profile .rp-profile-game-score')
      .forEach(putWestFirst);
    root.querySelectorAll?.('.rp-public-player-profile .rp-profile-final-board > div')
      .forEach(putWestFirst);
  }

  function loadPublicProfileHistory() {
    if (window.__realPlayPublicProfileHistoryInstalled || document.querySelector('script[data-rp-public-profile-history-loader]')) return;
    const script = document.createElement('script');
    script.src = 'public-profile-history.js?v=20260914-public-history-v1';
    script.async = false;
    script.dataset.rpPublicProfileHistoryLoader = '1';
    script.addEventListener('error', () => console.warn('[Real Play] Public profile game history controls did not load.'), { once: true });
    document.head.appendChild(script);
  }

  function loadWorldPlayerBarAssets() {
    if (window.__realPlayWorldPlayerBarAssetsInstalled || document.querySelector('script[data-rp-world-player-bar-assets-loader]')) return;
    const script = document.createElement('script');
    script.src = 'real-play-world-player-bar-assets.js?v=20260918-stable-filter-position-v9';
    script.async = false;
    script.dataset.rpWorldPlayerBarAssetsLoader = '1';
    script.addEventListener('error', () => console.warn('[Real Play] World player bar assets did not load.'), { once: true });
    document.head.appendChild(script);
  }

  function normalizeId(value) {
    return String(value ?? '').trim();
  }

  function applyCanonicalOwnRank(panel, player) {
    if (!(panel instanceof HTMLElement) || !player) return;
    const rankNode = panel.querySelector('.rp-profile-rank');
    const strong = rankNode?.querySelector('strong');
    const small = rankNode?.querySelector('small');
    if (!strong) return;

    const numericRank = Number(player?.rank);
    const hasRank = Number.isFinite(numericRank) && numericRank > 0;
    strong.textContent = hasRank ? `#${numericRank}` : '—';
    if (small) small.textContent = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
    rankNode.dataset.rpCanonicalRank = hasRank ? String(numericRank) : 'unranked';
  }

  async function syncOwnProfileRank(event) {
    const panel = document.querySelector('.rp-profile.open:not(.rp-public-player-profile)');
    if (!panel) return;

    const accessToken = localStorage.getItem(TOKEN_KEY) || '';
    if (!accessToken) return;

    const requestId = ++profileRankRequestId;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/community`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'players' }),
        cache: 'no-store',
      });
      if (!response.ok || requestId !== profileRankRequestId) return;

      const data = await response.json().catch(() => ({}));
      if (requestId !== profileRankRequestId) return;

      const players = Array.isArray(data?.players) ? data.players : [];
      const ownPlayerId = normalizeId(data?.meUserId);
      const ownAccountUserId = normalizeId(data?.meAccountUserId);
      const eventPlayerId = normalizeId(event?.detail?.playerId);
      const eventState = event?.detail?.state || {};
      const profileName = normalizeId(
        eventState?.profile?.player_name ?? eventState?.profile?.playerName ?? eventState?.profile?.name
      ).toLowerCase();
      const profileNumber = Number(
        eventState?.currentNumber?.number ?? eventState?.current_number?.number
      );

      const player = players.find((row) => {
        const playerId = normalizeId(row?.playerId ?? row?.userId);
        const accountUserId = normalizeId(row?.accountUserId);
        if (ownPlayerId && playerId === ownPlayerId) return true;
        if (ownAccountUserId && accountUserId === ownAccountUserId) return true;
        if (eventPlayerId && playerId === eventPlayerId) return true;

        // Last-resort identity bridge for older community payloads that do not
        // expose both canonical IDs yet.
        const rowName = normalizeId(row?.playerName ?? row?.player_name ?? row?.name).toLowerCase();
        const rowNumber = Number(row?.playerNumber ?? row?.player_number);
        return Boolean(
          profileName && rowName === profileName &&
          Number.isFinite(profileNumber) && Number.isFinite(rowNumber) &&
          profileNumber === rowNumber
        );
      });

      if (!player) return;
      const currentPanel = document.querySelector('.rp-profile.open:not(.rp-public-player-profile)');
      if (currentPanel !== panel) return;
      applyCanonicalOwnRank(panel, player);
    } catch (_error) {
      // Keep the profile usable if the leaderboard authority is temporarily
      // unavailable; a later profile refresh will retry the canonical rank.
    }
  }

  normalizePublicProfileScores();
  loadPublicProfileHistory();
  loadWorldPlayerBarAssets();

  window.addEventListener('realplay:profile-loaded', syncOwnProfileRank);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.rp-profile-game-score, .rp-profile-final-board > div')) {
          putWestFirst(node);
        }
        normalizePublicProfileScores(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
