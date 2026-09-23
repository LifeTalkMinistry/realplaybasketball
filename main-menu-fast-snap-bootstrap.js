(() => {
  if (window.__realPlayFastSnapBootstrapInstalled) return;
  window.__realPlayFastSnapBootstrapInstalled = true;

  // Load the optional post-team support prompt early so it can establish the
  // player's initial team state before any create/join action happens.
  if (!document.querySelector('script[data-rp-team-support-tiers-loader]')) {
    const supportTiers = document.createElement('script');
    supportTiers.src = 'ranking-team-support-tiers.js?v=20260923-team-support-funnel-v2';
    supportTiers.async = false;
    supportTiers.dataset.rpTeamSupportTiersLoader = 'true';
    document.head.appendChild(supportTiers);
  }

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
