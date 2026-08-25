document.documentElement.classList.add('js');

(() => {
  const version = '20260825-2000';
  ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  ['mobile-lobby.js', 'login-landing-fix.js', 'persistent-session-fix.js'].forEach((href) => {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.defer = true;
    document.head.appendChild(script);
  });
})();
