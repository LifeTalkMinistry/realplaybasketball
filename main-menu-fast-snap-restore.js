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

  function openUpdates() {
    if (window.RealPlayUpdates?.open) {
      window.RealPlayUpdates.open();
      return;
    }
    routeLegacy('updates');
  }

  function openRanking() {
    if (window.RealPlayRankingGames?.open) {
      window.RealPlayRankingGames.open();
      return;
    }
    routeLegacy('ranking');
  }

  function openThreeVThree() {
    const trigger = document.querySelector('[data-rp-enter-3v3]');
    if (trigger) {
      trigger.click();
      return;
    }
    routeLegacy('3v3');
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