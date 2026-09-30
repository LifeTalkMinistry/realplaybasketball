(() => {
  if (window.__realPlayHomeTeamSchedulingV3LoaderInstalled) return;
  window.__realPlayHomeTeamSchedulingV3LoaderInstalled = true;

  const script = document.createElement('script');
  script.src = 'home-open-rank-team-scheduling-v3.js?v=20260930-team-picker-v3';
  script.async = false;
  script.addEventListener('error', () => {
    console.warn('[Real Play] Compact team scheduling layer did not load.');
  }, { once: true });
  document.head.appendChild(script);
})();