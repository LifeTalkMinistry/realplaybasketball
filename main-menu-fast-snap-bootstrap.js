(() => {
  if (window.__realPlayFastSnapBootstrapInstalled) return;
  window.__realPlayFastSnapBootstrapInstalled = true;

  const original = window.matchMedia?.bind(window);
  if (!original || window.__realPlayOriginalMatchMedia) return;

  window.__realPlayOriginalMatchMedia = original;
  window.matchMedia = (query) => {
    const result = original(query);
    if (query !== '(prefers-reduced-motion: reduce)') return result;

    return new Proxy(result, {
      get(target, property) {
        if (property === 'matches') return true;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
})();