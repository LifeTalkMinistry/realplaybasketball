(() => {
  if (window.__realPlayRankingSessionCleanupInstalled) return;
  window.__realPlayRankingSessionCleanupInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const status = view.querySelector('[data-rp-ranking-session-status]');
  const title = view.querySelector('[data-rp-ranking-session-title]');
  if (!status || !title) return;

  function sync() {
    const statusText = String(status.textContent || '').trim().toUpperCase();
    const titleText = String(title.textContent || '').trim().toUpperCase();

    status.hidden = statusText === 'RANKING GAME ANNOUNCED';
    title.hidden = titleText === 'OPEN RANK GAME';
  }

  const observer = new MutationObserver(sync);
  observer.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  observer.observe(title, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  sync();
})();
