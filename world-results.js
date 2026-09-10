(() => {
  if (window.__realPlayWorldResultsInstalled) return;
  window.__realPlayWorldResultsInstalled = true;

  // WORLD must not own or render a second result system. The authoritative
  // result experience already lives inside RealPlayUpdates, including its
  // score/MVP presentation, admin controls, game detail and replay behavior.
  // This file is intentionally only a routing bridge.

  function markWorldActive() {
    document.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === 'world';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function removeLegacyWorldResults() {
    document.querySelectorAll('[data-rp-world-results]').forEach((node) => node.remove());
  }

  function chooseResultsFilter(attempt = 0) {
    const resultFilter = document.querySelector('[data-rp-updates] [data-update-filter="result"]');
    if (resultFilter) {
      resultFilter.click();
      return;
    }
    if (attempt < 12) window.setTimeout(() => chooseResultsFilter(attempt + 1), 50);
  }

  function openAuthoritativeResults() {
    removeLegacyWorldResults();

    // Do not leave the old World panel underneath the official results layer.
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    markWorldActive();

    if (window.RealPlayUpdates?.open) {
      window.RealPlayUpdates.open();
      chooseResultsFilter();
      return;
    }

    // Very early-load fallback: enter the existing Updates system, never build
    // another result renderer here.
    const legacyUpdates = document.querySelector('[data-rp-main-action="updates"]');
    if (legacyUpdates) {
      legacyUpdates.click();
      window.setTimeout(() => {
        legacyUpdates.click();
        chooseResultsFilter();
      }, 0);
    }
  }

  // WORLD is now an entry point to the one official Results implementation.
  // Capture the tap before simple-navigation.js opens the old World view.
  document.addEventListener('click', (event) => {
    const worldButton = event.target.closest?.('[data-rp-simple-nav-item="world"]');
    if (!worldButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAuthoritativeResults();
  }, true);

  // Clean up any duplicate result DOM left behind by an older cached shell.
  removeLegacyWorldResults();

  window.RealPlayWorldResults = {
    open: openAuthoritativeResults,
    refresh() {
      return window.RealPlayUpdates?.refresh?.({ quiet: true });
    },
  };
})();
