(() => {
  if (window.__realPlayStartupPreloadInstalled) return;
  window.__realPlayStartupPreloadInstalled = true;

  // Preload only the files required to render and operate the first HOME frame.
  // World / Players / Me / Ranking / Replay are intentionally loaded on demand
  // by lazy-feature-loader.js after the user asks for those features.
  const APP_ASSET_VERSION = '20260924-lazy-start-v1';
  const coreScripts = [
    'auth-session-guard.js',
    'public-first-entry.js',
    'mobile-lobby.js',
    'legacy-bottom-nav-removal.js',
    'simple-navigation.js',
    'simple-navigation-state-authority.js',
    'home-why-real-play.js',
    'visitor-mode.js',
    'public-founder-credit.js',
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

  coreScripts.forEach((href) => preloadScript(`${href}?v=${APP_ASSET_VERSION}`));
})();
