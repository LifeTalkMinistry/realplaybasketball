(() => {
  if (window.__realPlayOriginalMatchMedia) {
    window.matchMedia = window.__realPlayOriginalMatchMedia;
    delete window.__realPlayOriginalMatchMedia;
  }

  if (window.__realPlayHomeCommandRoutingFixInstalled) return;
  window.__realPlayHomeCommandRoutingFixInstalled = true;

  function routeLegacy(action) {
    const button = document.querySelector(`[data-rp-main-action="${action}"]`);
    if (!button) return false;

    const alreadyActive = button.classList.contains('slot-active')
      || button.getAttribute('aria-current') === 'true';

    button.click();
    if (!alreadyActive) button.click();
    return true;
  }

  function requestFeature(name, label, open) {
    const loader = window.RealPlayFeatures;
    if (typeof loader?.request === 'function') {
      loader.request(name, open, { label, channel: 'home-command' });
      return true;
    }
    open?.();
    return false;
  }

  function openUpdates() {
    requestFeature('updates', 'UPDATES', () => window.RealPlayUpdates?.open?.());
  }

  function openRanking() {
    requestFeature('ranking', 'OPEN RANKING', () => window.RealPlayRankingGames?.open?.());
  }

  function openThreeVThree() {
    requestFeature('3v3', '3V3', () => {
      const trigger = document.querySelector('[data-rp-enter-3v3]');
      if (trigger) trigger.click();
      else routeLegacy('3v3');
    });
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-rp-home-command-card]');
    if (!card) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (card.matches('[data-rp-home-main-announcement]')) {
      openUpdates();
      return;
    }

    if (card.matches('[data-rp-home-open-rank]')) {
      openRanking();
      return;
    }

    if (card.matches('[data-rp-home-3v3]')) {
      openThreeVThree();
      return;
    }

    if (card.matches('[data-rp-home-5v5]')) {
      routeLegacy('5v5');
    }
  }, true);
})();
