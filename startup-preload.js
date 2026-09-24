(() => {
  if (window.__realPlayStartupPreloadInstalled) return;
  window.__realPlayStartupPreloadInstalled = true;

  // app.js intentionally executes these classic scripts in a fixed order before
  // revealing the core player shell. Preloading only downloads them early; it
  // does not execute them or change that dependency/execution order.
  const APP_ASSET_VERSION = '20260923-profile-hero-contract-v119';

  const appStartupScripts = [
    'auth-session-guard.js',
    'public-first-entry.js',
    'mobile-lobby.js',
    'legacy-bottom-nav-removal.js',
    'simple-navigation.js',
    'simple-navigation-state-authority.js',
    'public-landing.js',
    'home-why-real-play.js',
    'visitor-mode.js',
    'public-founder-credit.js',
    'home-future-4v4-preview.js',
    'home-future-4v4-card-cleanup.js',
    'home-payment-admin.js',
    'login-landing-fix.js',
    'persistent-session-fix.js',
    'visitor-replay-access.js',
    'career-game-replay.js',
    'career-game-replay-marker-cleanup.js',
    'career-game-replay-assist-authority.js',
    'career-game-replay-positive-events.js',
    'career-game-replay-fullscreen-back.js',
    'career-game-replay-stats.js',
    'career-game-replay-official-mvp.js',
    'career-game-replay-comments-viewport.js',
    'career-game-replay-winner.js',
    'membership-bootstrap.js',
    'three-v-three-beta.js',
    'three-v-three-layout-order.js',
    'three-v-three-refinement.js',
    'three-v-three-participants.js',
    'three-v-three-club-art.js',
    'real-play-updates.js',
    'real-play-updates-info-toggle.js',
    'updates-session-title-admin.js',
    'real-play-updates-game-detail.js',
    'real-play-world.js',
    'real-play-world-chat-cleanup.js',
    'profile-load-guard.js',
    'real-play-profile.js',
    'settings-panel.js',
    'profile-art-owner-access.js',
    'real-play-profile-intro.js',
    'profile-metrics-stability.js',
    'real-play-profile-metrics.js',
    'real-play-world-players.js',
    'visitor-world-players.js',
    'public-profile-history.js',
    'real-play-rank-explainer.js',
    'world-results.js',
    'player-id-badge.js',
    'real-play-world-score-order-fix.js',
    'profile-game-replay-link.js',
    'real-play-world-player-filters.js',
    'real-play-captain-eligibility.js',
    'real-play-world-player-bar-vector.js',
    'real-play-world-player-admin.js',
    'real-play-player-claim.js',
    'player-number-recovery.js',
    'player-identity-manager.js',
    'ranking-games.js',
    'ranking-games-secured-players.js',
    'ranking-games-standby-players.js',
    'ranking-games-info-toggle.js',
    'ranking-games-session-cleanup.js',
    'ranking-team-support-center-force.js',
    'ranking-team-support-tiers.js',
    'ranking-session-teams.js',
    'ranking-spot-priority.js',
    'ranking-reservation-snapshot.js',
  ];

  // auth.js owns this chain independently of app.js. Preloading it too keeps
  // the existing player-identity initialization ordering fast and unchanged.
  const exactAuthScripts = [
    'auth-account-name-bridge.js?v=20260907-ownership-disputes-v1',
    'auth-ownership-core.js?v=20260907-ownership-disputes-v1',
    'auth-ownership-disputes.js?v=20260907-ownership-disputes-v1',
    'profile-experience.js',
    'player-identity-manager.js?v=20260917-name-number-v1',
  ];

  const seen = new Set();

  function preloadScript(url) {
    const absolute = new URL(url, document.baseURI).href;
    if (seen.has(absolute)) return;
    seen.add(absolute);

    const existing = Array.from(document.querySelectorAll('link[rel="preload"][as="script"]'))
      .some((link) => link.href === absolute);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = url;
    document.head.appendChild(link);
  }

  appStartupScripts.forEach((href) => preloadScript(`${href}?v=${APP_ASSET_VERSION}`));
  exactAuthScripts.forEach(preloadScript);
})();
