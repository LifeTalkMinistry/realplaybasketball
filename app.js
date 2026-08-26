document.documentElement.classList.add('js');

(() => {
  const version = '20260826-1015';

  // Load the session guard immediately so auth-core cannot erase a valid
  // persisted login because one protected API request temporarily returns 401.
  const sessionGuard = document.createElement('script');
  sessionGuard.src = `auth-session-guard.js?v=${version}`;
  sessionGuard.async = false;
  document.head.appendChild(sessionGuard);

  ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css', 'career-beta.css', 'career-beta-play.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  ['mobile-lobby.js', 'login-landing-fix.js', 'persistent-session-fix.js', 'career-beta.js', 'career-beta-play.js'].forEach((href) => {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.defer = true;
    document.head.appendChild(script);
  });
})();
