(() => {
  if (!window.__realPlayOriginalMatchMedia) return;
  window.matchMedia = window.__realPlayOriginalMatchMedia;
  delete window.__realPlayOriginalMatchMedia;
})();