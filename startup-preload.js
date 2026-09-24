(() => {
  if (window.__realPlayStartupPreloadInstalled) return;
  window.__realPlayStartupPreloadInstalled = true;

  // Preload only assets that still block the first usable HOME frame. Deep
  // feature downloads are intentionally left until after reveal so they do not
  // compete with the critical navigation and reservation path on a cold cache.
  const APP_ASSET_VERSION = '20260924-home-first-v121';

  const appStartupScripts = [
    'auth-session-guard.js',
    'public-first-entry.js',
    'mobile-lobby.js',
    'legacy-bottom-nav-removal.js',
    'simple-navigation.js',
    'simple-navigation-state-authority.js',
    'home-why-real-play.js',
    'visitor-mode.js',
    'public-founder-credit.js',
    'login-landing-fix.js',
    'persistent-session-fix.js',
    'real-play-updates.js',
    'real-play-world.js',
    'real-play-world-chat-cleanup.js',
    'profile-load-guard.js',
    'real-play-profile.js',
    'real-play-world-players.js',
    'visitor-world-players.js',
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

  // auth.js owns this chain independently of app.js. Preloading it keeps the
  // existing authentication/ownership initialization timing stable.
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
