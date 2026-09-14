(() => {
  if (window.__realPlayWorldScoreOrderFixInstalled) return;
  window.__realPlayWorldScoreOrderFixInstalled = true;

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

  function normalizePublicProfileRanks(root = document) {
    root.querySelectorAll?.('.rp-public-player-profile').forEach((profile) => {
      const player = profile.__realPlayPublicPlayer || null;
      if (!player) return;

      const rank = player?.rank ?? player?.career?.rank ?? player?.careerStats?.rank ?? null;
      const numericRank = Number(rank);
      const hasRank = Number.isFinite(numericRank) && numericRank > 0;
      const nextStrong = hasRank ? `#${numericRank}` : '—';
      const nextSmall = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';

      profile.querySelectorAll('.rp-profile-rank').forEach((node) => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (strong && strong.textContent !== nextStrong) strong.textContent = nextStrong;
        if (small && small.textContent !== nextSmall) small.textContent = nextSmall;
      });
    });
  }

  normalizePublicProfileScores();
  normalizePublicProfileRanks();

  const observer = new MutationObserver((mutations) => {
    let shouldNormalizeRanks = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.rp-profile-game-score, .rp-profile-final-board > div')) {
          putWestFirst(node);
        }
        normalizePublicProfileScores(node);
        if (node.matches?.('.rp-public-player-profile, .rp-public-player-profile *')) {
          shouldNormalizeRanks = true;
        }
        normalizePublicProfileRanks(node);
      }

      if (mutation.type === 'childList' && mutation.target instanceof HTMLElement) {
        if (mutation.target.closest?.('.rp-public-player-profile')) {
          shouldNormalizeRanks = true;
        }
      }
    }

    if (shouldNormalizeRanks) normalizePublicProfileRanks();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
