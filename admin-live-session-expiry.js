(() => {
  if (window.__realPlayLiveSessionExpiryInstalled) return;
  window.__realPlayLiveSessionExpiryInstalled = true;

  // RETIRED: there is no FUTURE/LIVE session-scoring lifecycle to expire.
  // Keep this compatibility slot useful by loading the current Ranking Game
  // entry-choice UI after the Ranking Game screen has mounted.
  if (!window.__realPlayRankingGameEntryOptionsInstalled && !document.querySelector('script[data-rp-ranking-entry-options-loader]')) {
    const script = document.createElement('script');
    script.dataset.rpRankingEntryOptionsLoader = '1';
    script.src = 'ranking-game-entry-options.js?v=20260916-entry-options-v1';
    script.async = false;
    script.addEventListener('error', () => {
      console.warn('[Real Play] Ranking Game entry options UI failed to load.');
    }, { once: true });
    document.head.appendChild(script);
  }

  // Open Rank roster cards are a secondary navigation surface. Load the
  // identity-safe routing layer after the ranking/profile modules so secured
  // and standby clicks resolve against the canonical Players directory before
  // a public profile is allowed to open. The query version also forces clients
  // past any cached copy of this hotfix.
  if (!window.__realPlayOpenRankPlayerProfileFixInstalled && !document.querySelector('script[data-rp-open-rank-profile-fix-loader]')) {
    const profileFix = document.createElement('script');
    profileFix.dataset.rpOpenRankProfileFixLoader = '1';
    profileFix.src = 'open-rank-player-profile-fix.js?v=20260917-open-rank-profile-v2';
    profileFix.async = false;
    profileFix.addEventListener('error', () => {
      console.error('[Real Play] Open Rank player-profile fix failed to load.');
    }, { once: true });
    document.head.appendChild(profileFix);
  }

  // Head Admin ownership migration lets a newly created real account adopt an
  // older admin-created canonical career without rewriting audited games.
  if (!window.__realPlayAdminOwnershipMigrationInstalled && !document.querySelector('script[data-rp-ownership-migration-loader]')) {
    const migrationScript = document.createElement('script');
    migrationScript.dataset.rpOwnershipMigrationLoader = '1';
    migrationScript.src = 'admin-player-ownership-migration.js?v=20260917-ownership-migration-v2';
    migrationScript.async = false;
    migrationScript.addEventListener('error', () => {
      console.warn('[Real Play] Player ownership migration UI failed to load.');
    }, { once: true });
    document.head.appendChild(migrationScript);
  }
})();