(() => {
  if (window.__realPlayOriginalMatchMedia) {
    window.matchMedia = window.__realPlayOriginalMatchMedia;
    delete window.__realPlayOriginalMatchMedia;
  }

  if (window.__realPlayHomeCommandRoutingFixInstalled) return;
  window.__realPlayHomeCommandRoutingFixInstalled = true;

  function loadHomePaymentAdmin() {
    if (window.__realPlayHomePaymentAdminInstalled) return;
    if (document.querySelector('script[data-rp-home-payment-admin-loader]')) return;

    const script = document.createElement('script');
    script.src = 'home-payment-admin.js?v=20260916-payment-admin-v1';
    script.async = true;
    script.dataset.rpHomePaymentAdminLoader = '1';
    document.head.appendChild(script);
  }

  function loadCompetitionHub() {
    if (window.__realPlayCompetitionHubInstalled) return;
    if (document.querySelector('script[data-rp-competition-hub-loader]')) return;

    const script = document.createElement('script');
    script.src = 'competition-hub.js?v=20261001-competition-hub-v4';
    script.async = true;
    script.dataset.rpCompetitionHubLoader = '1';
    document.head.appendChild(script);
  }

  function loadCompetitionHubCleanup() {
    if (window.__realPlayCompetitionHubCleanupInstalled) return;
    if (document.querySelector('script[data-rp-competition-hub-cleanup-loader]')) return;

    const script = document.createElement('script');
    script.src = 'competition-hub-cleanup.js?v=20261001-stats-cleanup-v1';
    script.async = true;
    script.dataset.rpCompetitionHubCleanupLoader = '1';
    document.head.appendChild(script);
  }

  function loadCompetitionHubTopLevel() {
    if (window.__realPlayCompetitionHubTopLevelInstalled) return;
    if (document.querySelector('script[data-rp-competition-hub-top-level-loader]')) return;

    const script = document.createElement('script');
    script.src = 'competition-hub-top-level.js?v=20261001-stats-top-level-v1';
    script.async = true;
    script.dataset.rpCompetitionHubTopLevelLoader = '1';
    document.head.appendChild(script);
  }

  loadHomePaymentAdmin();
  loadCompetitionHub();
  loadCompetitionHubCleanup();
  loadCompetitionHubTopLevel();

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