(() => {
  // Compatibility shim: the experimental SVG/vector player bars have been retired.
  // Real Play World rows now use the intended PNG player-bar assets.
  if (window.__realPlayWorldPlayerBarAssetsRestored) return;
  window.__realPlayWorldPlayerBarAssetsRestored = true;

  const CAPTAIN_BADGE_DOMINANT_BAR = 'assets/world/player-bars/badge-dominant/player-row-bar-captain-eligible.png';

  const ORIGINAL_BARS = Object.freeze({
    most_overall_mvp: 'assets/recognitions/bars/bar-most-overall-team-mvp.png',
    most_team_mvp: 'assets/recognitions/bars/bar-most-team-mvp.png',
    best_shooting: 'assets/recognitions/bars/bar-best-shooting.png',
    best_rebounder: 'assets/recognitions/bars/bar-best-rebounder.png',
    captain_eligible: CAPTAIN_BADGE_DOMINANT_BAR,
  });

  // Remove styles injected by the retired vector implementation if this bundle is
  // evaluated in an already-running page during development/hot reload.
  document.querySelectorAll('[data-rp-world-player-bar-vector],[data-rp-captain-row-retired],[data-rp-captain-badge-dominant-route]').forEach((node) => node.remove());

  // The recognition system still has a legacy Captain Eligible bar path in its
  // metadata. Force the visual route to the dedicated badge-dominant asset so
  // that legacy artwork can never win on the Players leaderboard.
  function installCaptainBadgeDominantRoute() {
    const style = document.createElement('style');
    style.dataset.rpCaptainBadgeDominantRoute = '1';
    style.textContent = `
      .rp-world-player-row[data-recognition-type="captain_eligible"]{
        --rp-recognition-bar:url("${CAPTAIN_BADGE_DOMINANT_BAR}")!important;
      }
    `;
    document.head.appendChild(style);
  }

  function restoreRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const type = String(row.dataset.recognitionType || '').trim().toLowerCase();
    const asset = ORIGINAL_BARS[type];
    if (!asset) return;

    const next = `url("${asset}")`;
    if (row.style.getPropertyValue('--rp-recognition-bar') !== next) {
      row.style.setProperty('--rp-recognition-bar', next);
    }
  }

  function restoreAll(root = document) {
    if (root instanceof HTMLElement && root.matches('.rp-world-player-row[data-recognition-type]')) {
      restoreRow(root);
    }
    root.querySelectorAll?.('.rp-world-player-row[data-recognition-type]').forEach(restoreRow);
  }

  installCaptainBadgeDominantRoute();
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

  // Load the dedicated 4v4 preference OVR header enhancement. Keeping the
  // feature in its own file lets the team-formation UI stay independent from
  // the recognition artwork compatibility code above.
  if (!document.querySelector('script[data-rp-4v4-team-ovr-header-loader]')) {
    const script = document.createElement('script');
    script.dataset.rp4v4TeamOvrHeaderLoader = '1';
    script.src = 'home-future-4v4-team-ovr-header.js?v=20260915-4v4-team-ovr-v1';
    script.async = false;
    document.head.appendChild(script);
  }
})();
