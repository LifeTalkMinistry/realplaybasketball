document.documentElement.classList.add('js');

(() => {
  const version = '20260825-1714';
  ['mobile-lobby.css', 'mobile-entry.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  });

  const script = document.createElement('script');
  script.src = `mobile-lobby.js?v=${version}`;
  script.defer = true;
  document.head.appendChild(script);
})();
