(() => {
  // Compatibility shim: the experimental SVG/vector player bars have been retired.
  // Real Play World rows now use the intended PNG player-bar assets.
  if (window.__realPlayWorldPlayerBarAssetsRestored) return;
  window.__realPlayWorldPlayerBarAssetsRestored = true;

  // IMPORTANT: the uploaded badge-dominant Captain bar is the retired artwork.
  // Keep it disconnected from the live Players leaderboard. The Captain Eligible
  // row must use the original recognition bar instead.
  const CAPTAIN_PLAYER_BAR = 'assets/recognitions/bars/bar-captain-eligible.png';

  const ORIGINAL_BARS = Object.freeze({
    most_overall_mvp: 'assets/recognitions/bars/bar-most-overall-team-mvp.png',
    most_team_mvp: 'assets/recognitions/bars/bar-most-team-mvp.png',
    best_shooting: 'assets/recognitions/bars/bar-best-shooting.png',
    best_rebounder: 'assets/recognitions/bars/bar-best-rebounder.png',
    captain_eligible: CAPTAIN_PLAYER_BAR,
  });

  // Remove any older routing styles that could force the retired Captain bar.
  document.querySelectorAll('[data-rp-world-player-bar-vector],[data-rp-captain-row-retired],[data-rp-captain-badge-dominant-route],[data-rp-captain-player-bar-route]').forEach((node) => node.remove());

  function installCaptainPlayerBarRoute() {
    const style = document.createElement('style');
    style.dataset.rpCaptainPlayerBarRoute = '1';
    style.textContent = `
      .rp-world-player-row[data-recognition-type="captain_eligible"]{
        --rp-recognition-bar:url("${CAPTAIN_PLAYER_BAR}")!important;
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

  installCaptainPlayerBarRoute();
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

  // Use the stable Players-authority bridge for profile badges. It does not
  // toggle the legacy profile badge layout class, so the old recognition
  // renderer and the authority layer cannot fight over hero height.
  if (!window.__realPlayProfileRecognitionAuthorityInstalled
    && !document.querySelector('script[data-rp-profile-recognition-authority-loader]')) {
    const syncScript = document.createElement('script');
    syncScript.dataset.rpProfileRecognitionAuthorityLoader = '1';
    syncScript.src = 'real-play-profile-recognition-authority.js?v=20260923-profile-recognition-stability-v1';
    syncScript.async = false;
    document.head.appendChild(syncScript);
  }

  // Load the dedicated 4v4 preference OVR/profile-link enhancement. Keeping the
  // feature in its own file lets the team-formation UI stay independent from
  // the recognition artwork compatibility code above.
  if (!document.querySelector('script[data-rp-4v4-team-ovr-header-loader]')) {
    const script = document.createElement('script');
    script.dataset.rp4v4TeamOvrHeaderLoader = '1';
    script.src = 'home-future-4v4-team-ovr-header.js?v=20260917-team-ovr-only-v3';
    script.async = false;
    document.head.appendChild(script);
  }
})();