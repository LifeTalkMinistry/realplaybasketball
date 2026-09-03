document.documentElement.classList.add('js');

(() => {
  const version = '20260903-3v3-beta-v1';

  // Load the session guard immediately so auth-core cannot erase a valid
  // persisted login because one protected API request temporarily returns 401.
  const sessionGuard = document.createElement('script');
  sessionGuard.src = `auth-session-guard.js?v=${version}`;
  sessionGuard.async = false;
  document.head.appendChild(sessionGuard);

  ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css', 'three-v-three-beta.css', 'career-beta.css', 'career-beta-play.css', 'real-play-world.css', 'membership.css', 'admin-game-control.css', 'admin-launcher-mobile-fix.css', 'admin-game-control-simplify.css', 'admin-courtside-live.css', 'admin-membership-review.css', 'admin-three-v-three.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  // Keep startup order deterministic. The 3v3 beta layer replaces the public
  // game-format carousel after the base mobile lobby mounts, while the existing
  // Career operations remain available underneath for current beta tooling.
  [
    'mobile-lobby.js',
    'three-v-three-beta.js',
    'login-landing-fix.js',
    'persistent-session-fix.js',
    'career-beta.js',
    'career-beta-play.js',
    'membership-bootstrap.js',
    'career-beta-leaderboard.js',
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
  ].forEach((href) => {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.async = false;
    document.head.appendChild(script);
  });
})();
