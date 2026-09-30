(() => {
  if (window.__realPlayRecordedStatControlsFixInstalled) return;
  window.__realPlayRecordedStatControlsFixInstalled = true;

  // Recorded score-sheet buttons are now owned entirely by
  // admin-recorded-scoring-draft.js. This legacy compatibility request stays
  // intentionally free of scoring interception.
  //
  // It also acts as a tiny progressive loader for the supporter-status bridge
  // so older cached app shells that already request this file can gain the
  // current support dashboard without changing scoring behavior.
  if (window.__realPlaySupportStatusDashboardInstalled) return;
  if (document.querySelector('script[data-rp-support-status-dashboard]')) return;

  const version = String(document.documentElement?.dataset?.rpDeploy || Date.now());
  const script = document.createElement('script');
  script.src = `support-status-dashboard.js?v=${encodeURIComponent(version)}`;
  script.async = false;
  script.dataset.rpSupportStatusDashboard = 'true';
  document.head.appendChild(script);
})();
