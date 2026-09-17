(() => {
  // Compatibility shim: the experimental SVG/vector player bars have been retired.
  // Real Play World rows now use the original recognition PNG assets again.
  if (window.__realPlayWorldPlayerBarAssetsRestored) return;
  window.__realPlayWorldPlayerBarAssetsRestored = true;

  // Captain Eligible is no longer a Players-directory recognition bar. Captain
  // opportunity belongs to the League/team-formation flow, not to a live Rank
  // decoration on the global leaderboard. Keep this guard here so even older
  // cached recognition code cannot paint the retired blue Captain row.
  const ORIGINAL_BARS = Object.freeze({
    most_overall_mvp: 'assets/recognitions/bars/bar-most-overall-team-mvp.png',
    most_team_mvp: 'assets/recognitions/bars/bar-most-team-mvp.png',
    best_shooting: 'assets/recognitions/bars/bar-best-shooting.png',
    best_rebounder: 'assets/recognitions/bars/bar-best-rebounder.png',
  });

  // Remove styles injected by the retired vector implementation if this bundle is
  // evaluated in an already-running page during development/hot reload.
  document.querySelectorAll('[data-rp-world-player-bar-vector]').forEach((node) => node.remove());

  function installCaptainRetirementStyles() {
    if (document.querySelector('[data-rp-captain-row-retired]')) return;
    const style = document.createElement('style');
    style.dataset.rpCaptainRowRetired = '1';
    style.textContent = `
      .rp-world-player-row[data-recognition-type="captain_eligible"]{
        --rp-recognition-bar:none!important;
        border-color:rgba(255,255,255,.075)!important;
        background:rgba(5,9,15,.94)!important;
        box-shadow:none!important;
      }
      .rp-world-player-row[data-recognition-type="captain_eligible"]::before,
      .rp-world-player-row[data-recognition-type="captain_eligible"]::after,
      .rp-world-player-row[data-recognition-type="captain_eligible"] .rp-player-featured-badge{
        display:none!important;
      }
      .rp-world-player-row[data-recognition-type="captain_eligible"] .rp-world-player-name{
        padding-right:0!important;
      }
      .rp-world-player-row[data-recognition-type="captain_eligible"]:hover{
        border-color:rgba(62,206,255,.2)!important;
        background:#07101a!important;
      }
    `;
    document.head.appendChild(style);
  }

  function restoreRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const type = String(row.dataset.recognitionType || '').trim().toLowerCase();

    if (type === 'captain_eligible') {
      row.style.removeProperty('--rp-recognition-bar');
      return;
    }

    const asset = ORIGINAL_BARS[type];
    if (!asset) return;

    // real-play-captain-eligibility.js remains the recognition authority for
    // actual earned recognitions. This simply guarantees their visual source is
    // the original asset rather than a generated SVG/data URL.
    row.style.setProperty('--rp-recognition-bar', `url("${asset}")`);
  }

  function restoreAll(root = document) {
    if (root instanceof HTMLElement && root.matches('.rp-world-player-row[data-recognition-type]')) {
      restoreRow(root);
    }
    root.querySelectorAll?.('.rp-world-player-row[data-recognition-type]').forEach(restoreRow);
  }

  installCaptainRetirementStyles();
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
