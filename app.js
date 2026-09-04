(() => {
  const version = '20260904-season-team-admin-v1';
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
    'lobby-topbar-cleanup.css',
    'mobile-entry.css',
    'public-landing.css',
    'public-pricing-breakdown.css',
    'public-story-carousel.css',
    'ambient-brand-glow.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'main-menu.css',
    'three-v-three-beta.css',
    'three-v-three-secure-spot.css',
    'three-v-three-refinement.css',
    'three-v-three-participants.css',
    'career-beta.css',
    'career-beta-play.css',
    'real-play-updates.css',
    'real-play-updates-cleanup.css',
    'real-play-world.css',
    'real-play-world-chat-cleanup.css',
    'real-play-profile.css',
    'real-play-profile-photo.css',
    'membership.css',
    'real-play-brand-system.css',
    'main-menu-brand-overrides.css',
    'settings-panel.css',
    'auth-welcome-cleanup.css',
  ].forEach(addStylesheet);

  const shellWatchdog = window.setTimeout(() => {
    if (!document.querySelector('[data-rp-app]')) restoreBaseSite();
  }, 3500);

  (async () => {
    await loadScript('auth-session-guard.js');

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
      'public-landing.js',
      'login-landing-fix.js',
      'persistent-session-fix.js',
      'career-beta.js',
      'career-beta-play.js',
      'membership-bootstrap.js',
      'career-beta-leaderboard.js',
      'three-v-three-beta.js',
      'three-v-three-layout-order.js',
      'three-v-three-refinement.js',
      'three-v-three-participants.js',
      'real-play-updates.js',
      'real-play-world.js',
      'real-play-world-chat-cleanup.js',
      'real-play-profile.js',
      'real-play-profile-photo.js',
      'main-menu.js',
      'overlay-focus-release.js',
      'settings-panel.js',
      'player-admin-probe-guard.js',
      'admin-access-bootstrap.js',
    ];

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
