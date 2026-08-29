document.documentElement.classList.add('js');

(() => {
  const version = '20260829-1524';

  // Load the session guard immediately so auth-core cannot erase a valid
  // persisted login because one protected API request temporarily returns 401.
  const sessionGuard = document.createElement('script');
  sessionGuard.src = `auth-session-guard.js?v=${version}`;
  sessionGuard.async = false;
  document.head.appendChild(sessionGuard);

  ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css', 'career-beta.css', 'career-beta-play.css', 'real-play-world.css', 'admin-game-control.css', 'admin-launcher-mobile-fix.css', 'admin-game-control-simplify.css', 'admin-courtside-live.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  // Keep startup order deterministic: the lobby exists first, then Career and
  // World enhance the two main identity/community destinations.
  [
    'mobile-lobby.js',
    'login-landing-fix.js',
    'persistent-session-fix.js',
    'career-beta.js',
    'career-beta-play.js',
    'career-beta-leaderboard.js',
    'real-play-world.js',
    'admin-score-sync.js',
    'admin-game-control.js',
    'admin-game-control-simplify.js',
    'admin-courtside-live.js',
    'admin-manual-open.js',
    'admin-session-picker.js',
    'admin-score-dom-sync.js',
  ].forEach((href) => {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.async = false;
    document.head.appendChild(script);
  });
})();
