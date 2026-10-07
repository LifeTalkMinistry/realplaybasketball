(() => {
  if (window.__realPlayGameTypeSwitchInstalled) return;
  window.__realPlayGameTypeSwitchInstalled = true;

  // FUTURE/LIVE scoring has been retired. Recorded/video scoring is the only
  // supported Real Play game workflow, so the old mode badge and switch no
  // longer belong in the session card.
  function cleanup() {
    document.querySelectorAll([
      '[data-rp-game-type-switch]',
      '.rp-game-type-switch',
      '[data-rp-entry-mode-badge]',
      '.rp-entry-mode-badge',
      '[data-admin-tab="live"]',
    ].join(',')).forEach((node) => node.remove());
  }

  // The World player-admin layer is lazy-loaded after admin verification.
  // If the Players view is already open when that happens, its local admin
  // directory used to remain unsynced, so long-hold silently did nothing.
  function syncWorldPlayerAdmin() {
    if (window.__realPlayAdminVerified !== true) return;
    window.RealPlayPlayerAdmin?.refresh?.();
  }

  function queueWorldPlayerAdminSync() {
    syncWorldPlayerAdmin();
    window.setTimeout(syncWorldPlayerAdmin, 150);
    window.setTimeout(syncWorldPlayerAdmin, 500);
  }

  function ensureParticipationTimeline() {
    if (window.__realPlayRecordedParticipationTimelineInstalled) return;
    if ([...document.scripts].some((script) => String(script.src || '').includes('admin-recorded-participation-timeline.js'))) return;
    const script = document.createElement('script');
    script.src = 'admin-recorded-participation-timeline.js?v=20261007-participation-authority-v4';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Recorded participation timeline failed to load.');
    document.head.appendChild(script);
  }

  function ensureAuditBoundaries() {
    if (window.__realPlayRecordedAuditBoundariesInstalled) return;
    if ([...document.scripts].some((script) => String(script.src || '').includes('admin-recorded-audit-boundaries.js'))) return;
    const script = document.createElement('script');
    script.src = 'admin-recorded-audit-boundaries.js?v=20261007-audit-boundaries-v2';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Audit boundary markers failed to load.');
    document.head.appendChild(script);
  }

  cleanup();
  ensureParticipationTimeline();
  ensureAuditBoundaries();
  queueWorldPlayerAdminSync();
  window.addEventListener('realplay:admin-render', () => {
    ensureParticipationTimeline();
    ensureAuditBoundaries();
    queueWorldPlayerAdminSync();
  });
  window.addEventListener('realplay:admin-control-render', () => {
    cleanup();
    ensureParticipationTimeline();
    ensureAuditBoundaries();
    queueWorldPlayerAdminSync();
  });
  window.addEventListener('realplay:entry-mode-state', cleanup);
  window.addEventListener('focus', () => {
    ensureParticipationTimeline();
    ensureAuditBoundaries();
    queueWorldPlayerAdminSync();
  });

  const observer = new MutationObserver(cleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
