(() => {
  if (window.__realPlayLegacyBottomNavRemovalInstalled) return;
  window.__realPlayLegacyBottomNavRemovalInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const TEAM_ROUTE_MAX_ATTEMPTS = 100;
  const TEAM_ROUTE_RETRY_MS = 100;

  function removeLegacyBottomNav(root = document) {
    root.querySelectorAll?.('.rp-bottom-nav,[data-rp-bottom-nav]').forEach((node) => node.remove());
  }

  function installProfileNavStyle() {
    if (document.querySelector('[data-rp-public-profile-nav-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPublicProfileNavStyle = 'true';
    style.textContent = `
      body.rp-simple-navigation-active [data-rp-public-profile] .rp-profile-topbar{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function closePublicProfileForBottomNav() {
    const profile = document.querySelector('[data-rp-public-profile].open');
    if (!profile) return;

    const closeButton = profile.querySelector('[data-rp-public-profile-close]');
    if (closeButton) {
      closeButton.click();
      return;
    }

    profile.classList.remove('open');
    profile.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('[data-rp-profile].open')) {
      document.body.classList.remove('rp-profile-open');
    }
  }

  function openTeamSecuring(attempt = 0) {
    if (!localStorage.getItem(TOKEN_KEY)) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }

    const teamRoute = document.querySelector(
      '[data-rp-home-future-4v4="true"] .rp-home-4v4-explore, .rp-home-coming-card.is-4v4 .rp-home-4v4-explore'
    );

    if (teamRoute) {
      teamRoute.click();
      return;
    }

    if (attempt < TEAM_ROUTE_MAX_ATTEMPTS) {
      window.setTimeout(() => openTeamSecuring(attempt + 1), TEAM_ROUTE_RETRY_MS);
      return;
    }

    console.warn('[Real Play] Team selection route was not ready; using the Ranking Games fallback.');
    if (window.RealPlayRankingGames?.open) {
      window.RealPlayRankingGames.open();
      return;
    }

    window.RealPlayUpdates?.open?.();
  }

  removeLegacyBottomNav();
  installProfileNavStyle();
  document.documentElement.classList.add('rp-legacy-bottom-nav-removed');

  // Home booking authority: SAVE MY SLOT is now an entry point into the
  // team-securing screen. The actual session spot is still secured only when
  // the player successfully joins/locks a team through that screen.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-rp-home-save-slot]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTeamSecuring();
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-simple-nav-item]')) return;
    closePublicProfileForBottomNav();
  }, true);

  const app = document.querySelector('[data-rp-app]');
  if (!app) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.rp-bottom-nav,[data-rp-bottom-nav]')) node.remove();
        else removeLegacyBottomNav(node);
      }
    }
  });

  observer.observe(app, { childList: true, subtree: true });
})();