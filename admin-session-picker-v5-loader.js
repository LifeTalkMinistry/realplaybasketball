(() => {
  if (window.__realPlayAdminSessionPickerV5LoaderInstalled) return;
  window.__realPlayAdminSessionPickerV5LoaderInstalled = true;

  // Prevent a cached V4 picker from reintroducing the retired SESSION PURPOSE
  // selector when Admin tools are opened later in this page session.
  window.__realPlayAdminSessionPickerInstalledV4 = true;

  if (!window.__realPlayAdminSessionPickerInstalledV5) {
    const script = document.createElement('script');
    script.src = 'admin-session-picker.js?v=20260908-single-game-type-v5';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!document.querySelector('script[data-rp-admin-player-schedule-loader]')) {
    const scheduleScript = document.createElement('script');
    scheduleScript.dataset.rpAdminPlayerScheduleLoader = '1';
    scheduleScript.src = 'admin-player-schedule.js?v=20260918-admin-player-schedule-v2';
    scheduleScript.async = false;
    scheduleScript.onerror = () => console.error('[Real Play] Admin player schedule controls failed to load.');
    document.head.appendChild(scheduleScript);
  }

  function loadLastFiveGames() {
    if (document.querySelector('script[data-rp-commentary-last-five-loader]')) return;
    const recentScript = document.createElement('script');
    recentScript.dataset.rpCommentaryLastFiveLoader = '1';
    recentScript.src = 'admin-commentary-last-five-games.js?v=20260928-last-five-games-v1';
    recentScript.async = false;
    recentScript.onerror = () => console.error('[Real Play] Last Five Games carousel failed to load.');
    document.head.appendChild(recentScript);
  }

  if (!document.querySelector('script[data-rp-commentary-stats-loader]')) {
    const commentaryScript = document.createElement('script');
    commentaryScript.dataset.rpCommentaryStatsLoader = '1';
    commentaryScript.src = 'admin-commentary-stats-viewer-v2.js?v=20260928-commentary-stats-subpage-v2';
    commentaryScript.async = false;
    commentaryScript.onload = loadLastFiveGames;
    commentaryScript.onerror = () => console.error('[Real Play] Commentary Stats Viewer failed to load.');
    document.head.appendChild(commentaryScript);
  } else {
    loadLastFiveGames();
  }
})();
