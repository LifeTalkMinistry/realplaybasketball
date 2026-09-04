(() => {
  if (window.__realPlayRankingSessionCleanupInstalled) return;
  window.__realPlayRankingSessionCleanupInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const status = view.querySelector('[data-rp-ranking-session-status]');
  if (!status) return;

  function sync() {
    const text = String(status.textContent || '').trim().toUpperCase();
    const redundant = text === 'RANKING GAME ANNOUNCED';
    status.hidden = redundant;
  }

  new MutationObserver(sync).observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  sync();
})();
