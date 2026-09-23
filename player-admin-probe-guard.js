(() => {
  if (window.__realPlayPlayerAdminProbeGuardInstalled) return;
  window.__realPlayPlayerAdminProbeGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const ADMIN_API_PREFIX = 'https://api.clarapmc.com/api/real-play/admin/';
  const ADMIN_VERIFY_URL = `${ADMIN_API_PREFIX}career/control`;
  const PROFILE_ART_API_PREFIX = `${ADMIN_API_PREFIX}profile-art`;
  const ADMIN_SYNC_MIN_MS = 5_000;

  function adminContextRequested() {
    try {
      const rememberedAdmin = window.RealPlayServerGate?.isAdminBypass?.() === true;
      return Boolean(window.__realPlayAdminVerified === true || rememberedAdmin);
    } catch (_error) {
      return window.__realPlayAdminVerified === true;
    }
  }

  function adminVerificationRequested(url, input, init) {
    if (window.__realPlayAdminAccessProbe !== true || url !== ADMIN_VERIFY_URL) return false;
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    return method === 'GET';
  }

  function playerProfileArtRequest(url) {
    // Profile Art Studio is player-owned now. These routes intentionally retain
    // their historical /admin/profile-art path, but the backend authorizes a
    // normal signed-in player for their own account and only requires admin
    // authority when the target belongs to somebody else.
    return url.startsWith(PROFILE_ART_API_PREFIX);
  }

  window.fetch = function playerSafeFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // Normal player sessions should not touch truly admin-only endpoints just to
    // discover that they are not admins. Profile Art Studio is explicitly exempt:
    // every authenticated player may upload/save/remove their OWN profile art,
    // while the backend remains the authority for cross-player/admin editing.
    if (
      url.startsWith(ADMIN_API_PREFIX)
      && !playerProfileArtRequest(url)
      && !adminContextRequested()
      && !adminVerificationRequested(url, input, init)
    ) {
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
  let lastAdminSyncAt = 0;

  function syncPlayerAdminAccess({ reset = false } = {}) {
    if (reset) adminSyncAttempts = 0;
    if (adminSyncTimer) window.clearTimeout(adminSyncTimer);
    adminSyncTimer = 0;

    const playerAdmin = window.RealPlayPlayerAdmin;
    if (adminContextRequested() && typeof playerAdmin?.refresh === 'function') {
      adminSyncAttempts = 0;
      const now = Date.now();
      if (lastAdminSyncAt && now - lastAdminSyncAt < ADMIN_SYNC_MIN_MS) return true;
      lastAdminSyncAt = now;
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

  // Head Admin can manually move a ranked player back to UNRANKED without
  // touching OVR, stats, wins/losses, or game history. This remains separate
  // from the automatic 30-day INACTIVE state.
  if (!document.querySelector('script[data-rp-admin-rank-status-loader]')) {
    const script = document.createElement('script');
    script.dataset.rpAdminRankStatusLoader = '1';
    script.src = 'real-play-admin-rank-status.js?v=20260923-admin-rank-status-v4';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Admin rank status controls failed to load.');
    document.head.appendChild(script);
  }

  // INACTIVE is a dedicated competitive population. Inactive players retain OVR
  // and history, but are removed from active Rank/stat/recognition leaderboards.
  if (!document.querySelector('script[data-rp-inactive-player-state-loader]')) {
    const script = document.createElement('script');
    script.dataset.rpInactivePlayerStateLoader = '1';
    script.src = 'real-play-inactive-player-state.js?v=20260922-inactive-player-state-v1';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Inactive player state controls failed to load.');
    document.head.appendChild(script);
  }

  // CAPTAIN ELIGIBLE is rank-dependent, not a permanent earned award. Keep it
  // synchronized with the same canonical official-rank state used by Players.
  if (!document.querySelector('script[data-rp-rank-recognition-sync-loader]')) {
    const script = document.createElement('script');
    script.dataset.rpRankRecognitionSyncLoader = '1';
    script.src = 'real-play-rank-recognition-sync.js?v=20260923-rank-recognition-sync-v3';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Rank recognition sync failed to load.');
    document.head.appendChild(script);
  }
})();