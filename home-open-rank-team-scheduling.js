(() => {
  if (window.__realPlayHomeTeamSchedulingV3LoaderInstalled) return;
  window.__realPlayHomeTeamSchedulingV3LoaderInstalled = true;

  const loadPremiumCards = () => {
    if (document.querySelector('script[data-rp-home-team-premium-cards-loader]')) return;
    const polish = document.createElement('script');
    polish.dataset.rpHomeTeamPremiumCardsLoader = '1';
    polish.src = 'home-open-rank-team-scheduling-premium-cards.js?v=20260930-premium-selected-team-cards-v1';
    polish.async = false;
    polish.addEventListener('error', () => {
      console.warn('[Real Play] Premium selected-team card styling did not load.');
    }, { once: true });
    document.head.appendChild(polish);
  };

  const loadScheduler = () => {
    const script = document.createElement('script');
    script.src = 'home-open-rank-team-scheduling-v3.js?v=20260930-team-picker-v4';
    script.async = false;
    script.addEventListener('load', loadPremiumCards, { once: true });
    script.addEventListener('error', () => {
      console.warn('[Real Play] Compact team scheduling layer did not load.');
    }, { once: true });
    document.head.appendChild(script);
  };

  if (window.__realPlayFourVFourLegacyScheduleFallbackInstalled === true) {
    loadScheduler();
    return;
  }

  const fallback = document.createElement('script');
  fallback.src = 'home-4v4-slot-picker-legacy-schedule-fallback.js?v=20260930-admin-slot-hydration-v2';
  fallback.async = false;
  fallback.addEventListener('load', loadScheduler, { once: true });
  fallback.addEventListener('error', () => {
    console.warn('[Real Play] Current Home time slot recovery did not load.');
    loadScheduler();
  }, { once: true });
  document.head.appendChild(fallback);
})();