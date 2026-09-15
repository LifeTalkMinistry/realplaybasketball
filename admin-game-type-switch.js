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

  cleanup();
  window.addEventListener('realplay:admin-control-render', cleanup);
  window.addEventListener('realplay:entry-mode-state', cleanup);

  const observer = new MutationObserver(cleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
