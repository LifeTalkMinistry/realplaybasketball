(() => {
  if (window.__realPlayLiveSessionExpiryInstalled) return;
  window.__realPlayLiveSessionExpiryInstalled = true;

  // RETIRED: there is no FUTURE/LIVE session-scoring lifecycle to expire.
  // Keep this compatibility slot useful by loading the current Ranking Game
  // entry-choice UI after the Ranking Game screen has mounted.
  if (window.__realPlayRankingGameEntryOptionsInstalled) return;

  const script = document.createElement('script');
  script.src = 'ranking-game-entry-options.js?v=20260916-entry-options-v1';
  script.async = false;
  script.addEventListener('error', () => {
    console.warn('[Real Play] Ranking Game entry options UI failed to load.');
  }, { once: true });
  document.head.appendChild(script);
})();
