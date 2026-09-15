(() => {
  // Compatibility shim: the experimental SVG/vector player bars have been retired.
  // Real Play World rows now use the original recognition PNG assets again.
  if (window.__realPlayWorldPlayerBarAssetsRestored) return;
  window.__realPlayWorldPlayerBarAssetsRestored = true;

  const ORIGINAL_BARS = Object.freeze({
    most_overall_mvp: 'assets/recognitions/bars/bar-most-overall-team-mvp.png',
    most_team_mvp: 'assets/recognitions/bars/bar-most-team-mvp.png',
    best_shooting: 'assets/recognitions/bars/bar-best-shooting.png',
    best_rebounder: 'assets/recognitions/bars/bar-best-rebounder.png',
    captain_eligible: 'assets/recognitions/bars/bar-captain-eligible.png',
  });

  // Remove styles injected by the retired vector implementation if this bundle is
  // evaluated in an already-running page during development/hot reload.
  document.querySelectorAll('[data-rp-world-player-bar-vector]').forEach((node) => node.remove());

  function restoreRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const type = String(row.dataset.recognitionType || '').trim().toLowerCase();
    const asset = ORIGINAL_BARS[type];
    if (!asset) return;

    // real-play-captain-eligibility.js remains the recognition authority. This
    // simply guarantees the visual source is the original asset rather than a
    // generated SVG/data URL.
    row.style.setProperty('--rp-recognition-bar', `url("${asset}")`);
  }

  function restoreAll(root = document) {
    if (root instanceof HTMLElement && root.matches('.rp-world-player-row[data-recognition-type]')) {
      restoreRow(root);
    }
    root.querySelectorAll?.('.rp-world-player-row[data-recognition-type]').forEach(restoreRow);
  }

  restoreAll();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) restoreAll(node);
        });
        continue;
      }
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        restoreRow(mutation.target);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-recognition-type'],
  });
})();
