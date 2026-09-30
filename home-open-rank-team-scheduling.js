(() => {
  if (window.__realPlayHomeTeamSchedulingV2LoaderInstalled) return;
  window.__realPlayHomeTeamSchedulingV2LoaderInstalled = true;

  const script = document.createElement('script');
  script.src = 'home-open-rank-team-scheduling-v2.js?v=20260930-team-asset-authority-v2';
  script.async = false;
  script.addEventListener('error', () => {
    console.warn('[Real Play] Team scheduling asset-authority layer did not load.');
  }, { once: true });
  document.head.appendChild(script);
})();
