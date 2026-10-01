(() => {
  if (window.__realPlayHomeTeamSchedulingV4LoaderInstalled) return;
  window.__realPlayHomeTeamSchedulingV4LoaderInstalled = true;

  const repairRotationNoteHook = () => {
    document.querySelectorAll('[data-rp-home-team-schedule-open-note]').forEach((node) => {
      if (!node.hasAttribute('data-rp-team-schedule-open-note')) node.setAttribute('data-rp-team-schedule-open-note', '');
    });
  };
  const repairObserver = new MutationObserver(repairRotationNoteHook);
  repairObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => repairObserver.disconnect(), 15000);

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

  const loadAssignedSessionWindow = () => {
    if (document.querySelector('script[data-rp-assigned-session-window-loader]')) return;
    const layer = document.createElement('script');
    layer.dataset.rpAssignedSessionWindowLoader = '1';
    layer.src = 'home-open-rank-assigned-session-window.js?v=20261001-blocks-define-session-v1';
    layer.async = false;
    layer.addEventListener('error', () => {
      console.warn('[Real Play] Team rotation could not sync the session window.');
    }, { once: true });
    document.head.appendChild(layer);
  };

  const loadScheduler = () => {
    const script = document.createElement('script');
    script.src = 'home-open-rank-team-scheduling-v4.js?v=20261001-team-schedule-rotation-v2';
    script.async = false;
    script.addEventListener('load', () => {
      repairRotationNoteHook();
      loadAssignedSessionWindow();
      loadPremiumCards();
    }, { once: true });
    script.addEventListener('error', () => {
      console.warn('[Real Play] Team schedule rotation layer did not load.');
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
    console.warn('[Real Play] Current Home schedule recovery did not load.');
    loadScheduler();
  }, { once: true });
  document.head.appendChild(fallback);
})();
