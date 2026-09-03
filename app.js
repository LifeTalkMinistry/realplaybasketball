document.documentElement.classList.add('js');

(() => {
  const version = '20260903-membership-freeze-fix-v1';

  // This restores the exact startup pattern that was working when the 3v3
  // screen was visibly rendering before the later blank-screen debugging.
  const sessionGuard = document.createElement('script');
  sessionGuard.src = `auth-session-guard.js?v=${version}`;
  sessionGuard.async = false;
  document.head.appendChild(sessionGuard);

  [
    'mobile-lobby.css',
    'mobile-entry.css',
    'public-landing.css',
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
  ].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  [
    'mobile-lobby.js',
    'public-landing.js',
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
  ].forEach((href) => {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.async = false;
    document.head.appendChild(script);
  });

  // Safety net only: if something prevents the mobile lobby from mounting,
  // never leave the original page hidden behind a black screen.
  window.setTimeout(() => {
    if (document.querySelector('[data-rp-app]')) return;
    document.documentElement.classList.remove('js');
    document.body?.classList.remove('rp-lobby-active', 'rp-guest-active', 'rp-3v3-open');
    console.error('[Real Play] Lobby did not mount; restored base page.');
  }, 4000);
})();
