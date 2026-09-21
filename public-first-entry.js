(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

  // Real Play is public-first: no account is required to browse the live
  // community, players, public chat, schedules, results, or announcements.
  // Existing participation gates remain responsible for asking visitors to
  // create/sign in to a player account only when identity is actually needed.
  if (!window.localStorage.getItem(TOKEN_KEY)) {
    window.localStorage.setItem(VISITOR_KEY, '1');
  } else {
    window.localStorage.removeItem(VISITOR_KEY);
  }

  // Home schedule editing is intentionally independent from Game Control.
  // Load its lightweight authority on every shell; it exposes the pencil only
  // after its own admin-status verification succeeds.
  if (!window.__realPlayHomeScheduleLoaderInstalled) {
    window.__realPlayHomeScheduleLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'home-open-rank-admin-edit.js?v=20260920-home-live-spots-single-writer-v2';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Home schedule editor failed to load.');
    document.head.appendChild(script);
  }

  // Game Control keeps its operational session data/functions, but the old
  // Career Session card and + Open Next Session controls no longer belong on
  // Setup now that the Home pencil owns schedule confirmation.
  if (!window.__realPlayAdminSetupSessionCleanupLoaderInstalled) {
    window.__realPlayAdminSetupSessionCleanupLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'admin-setup-operational-session-hide.js?v=20260919-setup-cleanup-v1';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Admin Setup cleanup failed to load.');
    document.head.appendChild(script);
  }
})();
