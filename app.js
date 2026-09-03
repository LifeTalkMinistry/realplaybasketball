(() => {
  const version = '20260903-3v3-beta-v3';
  const html = document.documentElement;
  html.classList.add('js');

  function restoreBaseSite() {
    document.body?.classList.remove('rp-lobby-active', 'rp-guest-active', 'rp-3v3-open');
    html.classList.remove('js');
  }

  function addStylesheet(href) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  }

  function loadScript(href) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `${href}?v=${version}`;
      script.async = false;
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      document.head.appendChild(script);
    });
  }

  [
    'mobile-lobby.css',
    'mobile-entry.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'three-v-three-beta.css',
    'career-beta.css',
    'career-beta-play.css',
    'real-play-world.css',
    'membership.css',
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'admin-membership-review.css',
    'admin-three-v-three.css',
  ].forEach(addStylesheet);

  // Never allow the loader to leave the whole public page hidden. If the
  // mobile shell cannot mount for any reason, reveal the original site again.
  const shellWatchdog = window.setTimeout(() => {
    if (!document.querySelector('[data-rp-app]')) restoreBaseSite();
  }, 3500);

  (async () => {
    // Session guard is useful but must never be capable of blocking rendering.
    await loadScript('auth-session-guard.js');

    // The lobby is the only critical script. Mount it first, verify that it
    // actually rendered, then load all optional beta layers afterwards.
    const lobbyLoaded = await loadScript('mobile-lobby.js');
    const lobbyMounted = Boolean(document.querySelector('[data-rp-app]'));

    if (!lobbyLoaded || !lobbyMounted) {
      window.clearTimeout(shellWatchdog);
      restoreBaseSite();
      console.error('[Real Play] Mobile lobby failed to mount; restored base site.');
      return;
    }

    window.clearTimeout(shellWatchdog);

    const enhancements = [
      'login-landing-fix.js',
      'persistent-session-fix.js',
      'career-beta.js',
      'career-beta-play.js',
      'membership-bootstrap.js',
      'career-beta-leaderboard.js',
      'three-v-three-beta.js',
      'real-play-world.js',
      'admin-score-sync.js',
      'admin-game-control.js',
      'admin-session-start.js',
      'admin-game-control-simplify.js',
      'admin-courtside-live.js',
      'admin-manual-open.js',
      'admin-session-picker.js',
      'admin-score-dom-sync.js',
      'admin-membership-review.js',
      'admin-three-v-three.js',
    ];

    // Enhancement failures are isolated: one unfinished beta feature should
    // never stop the core Real Play lobby from appearing.
    for (const href of enhancements) {
      const loaded = await loadScript(href);
      if (!loaded) console.warn(`[Real Play] Optional layer failed to load: ${href}`);
    }
  })().catch((error) => {
    window.clearTimeout(shellWatchdog);
    if (!document.querySelector('[data-rp-app]')) restoreBaseSite();
    console.error('[Real Play] Startup recovered from an unexpected error.', error);
  });
})();
