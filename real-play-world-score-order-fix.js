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
    script.src = 'real-play-world-player-bar-assets.js?v=20260915-recognition-count-clearance-v7';
    script.async = false;
    script.dataset.rpWorldPlayerBarAssetsLoader = '1';
    script.addEventListener('error', () => console.warn('[Real Play] World player bar assets did not load.'), { once: true });
    document.head.appendChild(script);
  }

  normalizePublicProfileScores();
  loadPublicProfileHistory();
  loadWorldPlayerBarAssets();

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
