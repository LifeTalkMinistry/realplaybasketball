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

  // The 4v4 Team Code module originally created its admin button with
  // data-rp4v4-team-code-admin, while the same module searched/listened for
  // data-rp-4v4-team-code-admin. That mismatch caused every render to create
  // another lock button. Normalize the attribute, dedupe it, and keep the
  // single control hidden unless the app has explicitly verified an admin.
  function sanitizeTeamAdminButtons() {
    document.querySelectorAll('.rp-4v4-preference-actions').forEach((actions) => {
      const buttons = [...actions.querySelectorAll('.rp-4v4-team-code-admin')];
      if (!buttons.length) return;

      const keeper = buttons.find((button) => button.hasAttribute('data-rp-4v4-team-code-admin')) || buttons[0];
      keeper.setAttribute('data-rp-4v4-team-code-admin', '');
      keeper.removeAttribute('data-rp4v4-team-code-admin');
      keeper.hidden = window.__realPlayAdminVerified !== true;

      buttons.forEach((button) => {
        if (button !== keeper) button.remove();
      });
    });
  }

  let teamAdminSanitizeQueued = false;
  function queueTeamAdminSanitize() {
    if (teamAdminSanitizeQueued) return;
    teamAdminSanitizeQueued = true;
    window.requestAnimationFrame(() => {
      teamAdminSanitizeQueued = false;
      sanitizeTeamAdminButtons();
    });
  }

  // Close the Team Code modal without depending on the modal's own bubble
  // listener. Some app-level click handlers can intercept the normal click
  // before it reaches the CANCEL/CLOSE button, so handle the pointer at the
  // document capture phase and remove the modal contents immediately.
  function closeTeamCodeDialog() {
    const dialog = document.querySelector('[data-rp-4v4-team-code-dialog]');
    if (!dialog) return false;
    dialog.hidden = true;
    dialog.innerHTML = '';
    return true;
  }

  function handleTeamCodeClose(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-rp-4v4-code-close]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeTeamCodeDialog();
  }

  removeLegacyBottomNav();
  installProfileNavStyle();
  sanitizeTeamAdminButtons();
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

  // Pointer capture makes CANCEL/CLOSE reliable on both mouse and touch even
  // when another app-level click handler would otherwise swallow the click.
  document.addEventListener('pointerdown', handleTeamCodeClose, true);
  document.addEventListener('click', handleTeamCodeClose, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeTeamCodeDialog();
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-simple-nav-item]')) return;
    closePublicProfileForBottomNav();
  }, true);

  window.addEventListener('realplay:4v4-open', queueTeamAdminSanitize);
  window.addEventListener('realplay:admin-render', queueTeamAdminSanitize);

  const teamAdminObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.rp-4v4-team-code-admin') || node.querySelector?.('.rp-4v4-team-code-admin')) {
          queueTeamAdminSanitize();
          return;
        }
      }
    }
  });
  teamAdminObserver.observe(document.documentElement, { childList: true, subtree: true });

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