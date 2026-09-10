(() => {
  if (window.__realPlayWorldResultsInstalled) return;
  window.__realPlayWorldResultsInstalled = true;

  // WORLD must never own or render a second result system. The authoritative
  // result experience already lives inside RealPlayUpdates, including its
  // score/MVP presentation, admin controls, game detail and replay behavior.
  // This file is intentionally only a routing bridge.

  function injectWorldResultsStyles() {
    if (document.getElementById('rp-world-results-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-world-results-authority-style';
    style.textContent = `
      /* WORLD is only an entry point into the authoritative Results feed.
         Remove Updates-specific chrome so WORLD feels like its own clean
         destination without duplicating the result renderer. */
      .rp-updates.rp-world-results-entry .rp-updates-topbar,
      .rp-updates.rp-world-results-entry .rp-updates-head,
      .rp-updates.rp-world-results-entry .rp-updates-filters,
      .rp-updates.rp-world-results-entry .rp-updates-info-button,
      .rp-updates.rp-world-results-entry .rp-updates-info-overlay{
        display:none!important;
      }
      .rp-updates.rp-world-results-entry .rp-updates-shell{
        padding-top:max(14px,env(safe-area-inset-top))!important;
      }
      .rp-updates.rp-world-results-entry .rp-updates-status{
        margin-top:0!important;
      }
    `;
    document.head.appendChild(style);
  }

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

  function setWorldResultsMode(enabled) {
    const updatesPanel = document.querySelector('[data-rp-updates]');
    updatesPanel?.classList.toggle('rp-world-results-entry', Boolean(enabled));
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
    injectWorldResultsStyles();

    // Do not leave the old World/profile panels underneath the official result
    // layer. WORLD is now just another entry point into RealPlayUpdates.
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    markWorldActive();

    if (window.RealPlayUpdates?.open) {
      window.RealPlayUpdates.open();
      setWorldResultsMode(true);
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
        setWorldResultsMode(true);
        chooseResultsFilter();
      }, 0);
    }
  }

  function patchSimpleNavigationApi(attempt = 0) {
    if (window.RealPlaySimpleNavigation) {
      window.RealPlaySimpleNavigation.world = openAuthoritativeResults;
      return;
    }
    if (attempt < 40) window.setTimeout(() => patchSimpleNavigationApi(attempt + 1), 100);
  }

  // WORLD is now an entry point to the one official Results implementation.
  // Capture the tap before simple-navigation.js can open the retired World
  // result view.
  document.addEventListener('click', (event) => {
    const worldButton = event.target.closest?.('[data-rp-simple-nav-item="world"]');
    if (worldButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAuthoritativeResults();
      return;
    }

    // As soon as navigation leaves WORLD, restore the normal Updates chrome so
    // announcement/schedule entry points continue to behave normally.
    const otherNav = event.target.closest?.('[data-rp-simple-nav-item]');
    if (otherNav && otherNav.dataset.rpSimpleNavItem !== 'world') {
      setWorldResultsMode(false);
      return;
    }

    if (event.target.closest?.('[data-rp-home-command-card], [data-rp-simple-updates], [data-rp-simple-next]')) {
      setWorldResultsMode(false);
    }
  }, true);

  // Clean up any duplicate result DOM left behind by an older cached shell and
  // also replace the programmatic WORLD route once simple navigation installs.
  injectWorldResultsStyles();
  removeLegacyWorldResults();
  patchSimpleNavigationApi();

  window.RealPlayWorldResults = {
    open: openAuthoritativeResults,
    refresh() {
      return window.RealPlayUpdates?.refresh?.({ quiet: true });
    },
  };
})();
