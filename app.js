document.documentElement.classList.add('js');

(() => {
  ['mobile-lobby.css', 'mobile-entry.css'].forEach((href) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    document.head.appendChild(css);
  });

  const script = document.createElement('script');
  script.src = 'mobile-lobby.js';
  script.defer = true;
  document.head.appendChild(script);
})();
