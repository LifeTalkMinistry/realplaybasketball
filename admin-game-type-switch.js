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

  cleanup();
  queueWorldPlayerAdminSync();
  window.addEventListener('realplay:admin-render', queueWorldPlayerAdminSync);
  window.addEventListener('realplay:admin-control-render', () => {
    cleanup();
    queueWorldPlayerAdminSync();
  });
  window.addEventListener('realplay:entry-mode-state', cleanup);
  window.addEventListener('focus', queueWorldPlayerAdminSync);

  const observer = new MutationObserver(cleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
