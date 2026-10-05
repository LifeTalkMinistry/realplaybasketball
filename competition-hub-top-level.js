(() => {
  if (window.__realPlayCompetitionHubTopLevelInstalled) return;
  window.__realPlayCompetitionHubTopLevelInstalled = true;

  const STATS_NAV_ID = 'players';
  let navObserver = null;
  let apiPatchTimer = null;

  function installStyles() {
    if (document.querySelector('[data-rp-competition-top-level-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCompetitionTopLevelStyles = '1';
    style.textContent = `
      body.rp-simple-navigation-active .rp-competition-hub{
        top:0!important;
        left:0!important;
        right:0!important;
        bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom))!important;
        z-index:580!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-shell{
        min-height:calc(100dvh - var(--rp-simple-nav-height) - env(safe-area-inset-bottom))!important;
        padding-bottom:20px!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-close{
        display:none!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-topbar{
        grid-template-columns:42px minmax(0,1fr) 42px!important;
      }
      body.rp-simple-navigation-active.rp-competition-hub-open .rp-simple-nav{
        visibility:visible!important;
        pointer-events:auto!important;
        z-index:590!important;
      }
      body.rp-simple-navigation-active:not(:has([data-rp-simple-nav-item="players"].active)) .rp-competition-hub.open{
        display:none!important;
        pointer-events:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function statsHub() {
    return document.querySelector('[data-rp-competition-hub]');
  }

  function closeStats() {
    const hub = statsHub();
    if (!hub) return;
    try { window.RealPlayCompetitionHub?.close?.(); } catch (_error) {}
    hub.classList.remove('open');
    hub.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-competition-hub-open');
  }

  function closeOtherPrimaryLayersForStats() {
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}
    try { window.RealPlayUpdates?.close?.(); } catch (_error) {}

    const world = document.querySelector('[data-rp-world]');
    if (world && world.getAttribute('aria-hidden') === 'false') {
      world.setAttribute('aria-hidden', 'true');
      world.classList.remove('open');
    }

    const profile = document.querySelector('[data-rp-profile]');
    if (profile && profile.getAttribute('aria-hidden') === 'false') {
      profile.setAttribute('aria-hidden', 'true');
      profile.classList.remove('open');
    }

    const updates = document.querySelector('[data-rp-updates]');
    if (updates && updates.getAttribute('aria-hidden') === 'false') {
      updates.setAttribute('aria-hidden', 'true');
      updates.classList.remove('open');
    }
  }

  function activeNavId() {
    return document.querySelector('[data-rp-simple-nav-item].active')?.dataset?.rpSimpleNavItem || '';
  }

  function enforceSinglePrimaryView() {
    const hub = statsHub();
    if (!hub?.classList.contains('open')) return;
    if (activeNavId() !== STATS_NAV_ID) closeStats();
  }

  function beforePrimaryNavigation(event) {
    const navItem = event.target.closest?.('[data-rp-simple-nav-item]');
    if (!navItem) return;

    const target = navItem.dataset.rpSimpleNavItem;
    if (target === STATS_NAV_ID) {
      // Core navigation now owns the STATS transition and loading shell.
      // Only the explicit competition bypass is allowed to reach PLAYERS.
      if (navItem.dataset.rpCompetitionBypass === '1') return;
      if (typeof window.RealPlaySimpleNavigation?.stats === 'function') return;
      closeOtherPrimaryLayersForStats();
      if (typeof window.RealPlayCompetitionHub?.open === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.RealPlayCompetitionHub.open();
      }
      return;
    }

    closeStats();
  }

  function patchSimpleNavigationApi() {
    const api = window.RealPlaySimpleNavigation;
    if (!api || api.__statsAuthorityPatched) return Boolean(api);

    ['home', 'world', 'chats', 'me'].forEach((key) => {
      const original = api[key];
      if (typeof original !== 'function') return;
      api[key] = (...args) => {
        closeStats();
        return original(...args);
      };
    });

    api.__statsAuthorityPatched = true;
    return true;
  }

  function observeNavigationState() {
    const nav = document.querySelector('[data-rp-simple-nav]');
    if (!nav || navObserver) return Boolean(nav);

    navObserver = new MutationObserver(() => {
      window.queueMicrotask(enforceSinglePrimaryView);
    });
    navObserver.observe(nav, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-current'],
    });
    return true;
  }

  function installRuntimeGuards() {
    patchSimpleNavigationApi();
    observeNavigationState();

    if (apiPatchTimer) window.clearInterval(apiPatchTimer);
    apiPatchTimer = window.setInterval(() => {
      const apiReady = patchSimpleNavigationApi();
      const navReady = observeNavigationState();
      if (apiReady && navReady) {
        window.clearInterval(apiPatchTimer);
        apiPatchTimer = null;
      }
    }, 100);
  }

  installStyles();

  // Only switch primary layers during the click event. Closing on pointerdown
  // creates a visible gap before click, exposing Home for a few milliseconds.
  // Window capture still runs before the document-level competition handler,
  // so the outgoing and incoming views swap within one event cycle.
  window.addEventListener('click', beforePrimaryNavigation, true);
  installRuntimeGuards();

  window.addEventListener('realplay:app-ready', installRuntimeGuards);
  window.addEventListener('realplay:enhancements-ready', installRuntimeGuards);
})();
