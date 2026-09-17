(() => {
  if (window.__realPlayPlayerAdminProbeGuardInstalled) return;
  window.__realPlayPlayerAdminProbeGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const ADMIN_API_PREFIX = 'https://api.clarapmc.com/api/real-play/admin/';

  function adminContextRequested() {
    try {
      const rememberedAdmin = window.RealPlayServerGate?.isAdminBypass?.() === true;
      return Boolean(
        window.__realPlayAdminVerified ||
        rememberedAdmin ||
        window.__realPlayAdminAccessProbe ||
        new URLSearchParams(window.location.search).get('admin') === '1'
      );
    } catch (_error) {
      return Boolean(
        window.__realPlayAdminVerified ||
        window.__realPlayAdminAccessProbe ||
        new URLSearchParams(window.location.search).get('admin') === '1'
      );
    }
  }

  window.fetch = function playerSafeFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // Normal player sessions should not touch admin-only endpoints just to
    // discover that they are not admins. A previously server-verified admin is
    // also accepted through RealPlayServerGate so Players long-hold management
    // is not accidentally downgraded while the admin bootstrap is refreshing.
    if (url.startsWith(ADMIN_API_PREFIX) && !adminContextRequested()) {
      return Promise.resolve(new Response(JSON.stringify({
        admin: false,
        message: 'Admin access is not active in this player session.',
      }), {
        status: 403,
        statusText: 'Player context',
        headers: {
          'Content-Type': 'application/json',
          'X-Real-Play-Local-Guard': 'player-context',
        },
      }));
    }

    return nativeFetch(input, init);
  };

  /*
    Head Admin player controls keep their own verified player directory. The
    permanent PLAYERS navigation is intentionally isolated from World bootstrap,
    so it no longer clicks the old internal Players tab that used to refresh that
    admin directory. Resync it here after global admin verification completes.
  */
  let adminSyncTimer = 0;
  let adminSyncAttempts = 0;

  function syncPlayerAdminAccess({ reset = false } = {}) {
    if (reset) adminSyncAttempts = 0;
    if (adminSyncTimer) window.clearTimeout(adminSyncTimer);
    adminSyncTimer = 0;

    const playerAdmin = window.RealPlayPlayerAdmin;
    if (adminContextRequested() && typeof playerAdmin?.refresh === 'function') {
      adminSyncAttempts = 0;
      try { playerAdmin.refresh(); } catch (_error) {}
      return true;
    }

    // admin-access-bootstrap loads after the player-admin layer and verifies the
    // server asynchronously. Give it a short bounded window to finish instead
    // of permanently leaving the player-admin module in its initial false state.
    if (adminSyncAttempts < 40) {
      adminSyncAttempts += 1;
      adminSyncTimer = window.setTimeout(() => syncPlayerAdminAccess(), 125);
    }
    return false;
  }

  /*
    Players is a directory view, not the World social feed. Previously the
    permanent PLAYERS nav opened RealPlayWorld.open(), which starts the full
    World bootstrap, renders feed + channels + chat, and starts its polling
    timer before the Players directory is forced into view. That means a
    Players click could wake the heaviest World work even though none of it is
    visible. Keep Players on the same visual shell, but open only the directory.
  */
  let playersOpenQueued = false;

  function setSimpleNavPlayersActive() {
    document.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === 'players';
      if (button.classList.contains('active') !== selected) {
        button.classList.toggle('active', selected);
      }
      const next = selected ? 'page' : 'false';
      if (button.getAttribute('aria-current') !== next) button.setAttribute('aria-current', next);
    });
  }

  function forcePlayersDirectory(panel) {
    if (!panel) return false;
    const playersView = panel.querySelector('[data-world-view="players"]');
    if (!playersView) return false;

    const title = panel.querySelector('.rp-world-title strong');
    if (title && title.textContent !== 'PLAYERS') title.textContent = 'PLAYERS';
    const badge = panel.querySelector('.rp-world-online');
    if (badge && badge.textContent !== 'COMMUNITY') badge.textContent = 'COMMUNITY';

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      const selected = button.dataset.worldTab === 'players';
      if (button.classList.contains('active') !== selected) {
        button.classList.toggle('active', selected);
      }
    });
    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      const hidden = view.dataset.worldView !== 'players';
      if (view.hidden !== hidden) view.hidden = hidden;
    });
    return true;
  }

  function openPlayersDirectory(attempt = 0) {
    const panel = document.querySelector('[data-rp-world]');
    const playersView = panel?.querySelector('[data-world-view="players"]');
    if (!panel || !playersView) {
      if (attempt < 20) {
        window.setTimeout(() => openPlayersDirectory(attempt + 1), 50);
      }
      return;
    }

    // Shut down any World social polling/bootstrap owner first. We reopen the
    // shell ourselves below without calling RealPlayWorld.open().
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayUpdates?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    document.querySelector('[data-rp-updates]')?.classList.remove('rp-world-results-entry');

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-world-open');
    panel.scrollTop = 0;

    setSimpleNavPlayersActive();
    forcePlayersDirectory(panel);

    if (!playersOpenQueued) {
      playersOpenQueued = true;
      window.requestAnimationFrame(() => {
        playersOpenQueued = false;
        forcePlayersDirectory(panel);
        try { window.RealPlayPlayers?.refresh?.(); } catch (_error) {}
        syncPlayerAdminAccess({ reset: true });
      });
    }

    // A previously in-flight World request can finish after the directory was
    // opened. Reassert Players once after that short race window, without any
    // polling or recurring observer.
    window.setTimeout(() => {
      if (document.querySelector('[data-rp-simple-nav-item="players"][aria-current="page"]')) {
        forcePlayersDirectory(panel);
        syncPlayerAdminAccess();
      }
    }, 300);
  }

  document.addEventListener('click', (event) => {
    const playersButton = event.target.closest?.('[data-rp-simple-nav-item="players"]');
    if (!playersButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPlayersDirectory();
  }, true);

  window.RealPlayPlayersStableNavigation = {
    open: openPlayersDirectory,
  };

  // Start one bounded sync attempt during app boot as well. This covers Head
  // Admin opening directly into Players or returning from a restored session.
  syncPlayerAdminAccess({ reset: true });
  window.addEventListener('realplay:app-ready', () => syncPlayerAdminAccess({ reset: true }));
  window.addEventListener('focus', () => {
    if (document.querySelector('[data-rp-simple-nav-item="players"][aria-current="page"]')) {
      syncPlayerAdminAccess({ reset: true });
    }
  });

  // Player-facing long-hold controls are kept separate from the Head Admin
  // long-hold menu. This layer only exposes VIEW + CLAIM for real admin-created
  // beta identities that are still unclaimed; server ownership rules remain the
  // authority for whether a claim is accepted.
  if (!document.querySelector('script[data-rp-player-claim-loader]')) {
    const script = document.createElement('script');
    script.dataset.rpPlayerClaimLoader = '1';
    script.src = 'real-play-player-claim.js?v=20260917-player-claim-v1';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Player claim controls failed to load.');
    document.head.appendChild(script);
  }
})();