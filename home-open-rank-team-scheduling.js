(() => {
  if (window.__realPlayHomeTeamSchedulingV5LoaderInstalled) return;
  window.__realPlayHomeTeamSchedulingV5LoaderInstalled = true;

  const loadPremiumCards = () => {
    if (document.querySelector('script[data-rp-home-team-premium-cards-loader]')) return;
    const polish = document.createElement('script');
    polish.dataset.rpHomeTeamPremiumCardsLoader = '1';
    polish.src = 'home-open-rank-team-scheduling-premium-cards.js?v=20260930-premium-selected-team-cards-v1';
    polish.async = false;
    polish.addEventListener('error', () => console.warn('[Real Play] Premium selected-team card styling did not load.'), { once: true });
    document.head.appendChild(polish);
  };

  const loadScheduler = () => {
    if (document.querySelector('script[data-rp-team-rotation-scheduler-loader]')) return;
    const script = document.createElement('script');
    script.dataset.rpTeamRotationSchedulerLoader = '1';
    script.src = 'home-open-rank-team-scheduling-v5.js?v=20261005-weekly-day-toggles-v1';
    script.async = false;
    script.addEventListener('load', loadPremiumCards, { once: true });
    script.addEventListener('error', () => console.warn('[Real Play] Team schedule rotation layer did not load.'), { once: true });
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
    console.warn('[Real Play] Current Home schedule recovery did not load.');
    loadScheduler();
  }, { once: true });
  document.head.appendChild(fallback);
})();
