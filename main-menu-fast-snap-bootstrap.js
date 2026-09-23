(() => {
  if (window.__realPlayFastSnapBootstrapInstalled) return;
  window.__realPlayFastSnapBootstrapInstalled = true;

  // Load the optional post-team support prompt early so it can establish the
  // player's initial team state before any create/join action happens.
  if (!document.querySelector('link[data-rp-team-support-modal-style]')) {
    const supportStyle = document.createElement('link');
    supportStyle.rel = 'stylesheet';
    supportStyle.href = 'ranking-team-support-modal-refine.css?v=20260923-team-support-modal-center-v1';
    supportStyle.dataset.rpTeamSupportModalStyle = 'true';
    document.head.appendChild(supportStyle);
  }

  // The shared team sheet is intentionally a bottom sheet. The support funnel
  // is not: give it its own overlay/card mechanics, matching the centered rank
  // explainer pattern instead of fighting the shared bottom-sheet CSS.
  if (!document.querySelector('link[data-rp-team-support-center-style]')) {
    const centerStyle = document.createElement('link');
    centerStyle.rel = 'stylesheet';
    centerStyle.href = 'ranking-team-support-center-force.css?v=20260923-team-support-rank-center-v1';
    centerStyle.dataset.rpTeamSupportCenterStyle = 'true';
    document.head.appendChild(centerStyle);
  }

  if (!document.querySelector('script[data-rp-team-support-center-force]')) {
    const centerForce = document.createElement('script');
    centerForce.src = 'ranking-team-support-center-force.js?v=20260923-team-support-rank-center-v1';
    centerForce.async = false;
    centerForce.dataset.rpTeamSupportCenterForce = 'true';
    document.head.appendChild(centerForce);
  }

  if (!document.querySelector('script[data-rp-team-support-tiers-loader]')) {
    const supportTiers = document.createElement('script');
    supportTiers.src = 'ranking-team-support-tiers.js?v=20260923-team-support-funnel-v4';
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
