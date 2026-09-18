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
})();
