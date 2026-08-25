document.documentElement.classList.add('js');

(() => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'mobile-lobby.css';
  document.head.appendChild(css);

  const script = document.createElement('script');
  script.src = 'mobile-lobby.js';
  script.defer = true;
  document.head.appendChild(script);
})();
