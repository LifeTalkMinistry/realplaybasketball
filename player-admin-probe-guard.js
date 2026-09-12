(() => {
  if (window.__realPlayPlayerAdminProbeGuardInstalled) return;
  window.__realPlayPlayerAdminProbeGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const ADMIN_API_PREFIX = 'https://api.clarapmc.com/api/real-play/admin/';

  function adminContextRequested() {
    try {
      return Boolean(
        window.__realPlayAdminVerified ||
        window.__realPlayAdminAccessProbe ||
        new URLSearchParams(window.location.search).get('admin') === '1'
      );
    } catch (_error) {
      return Boolean(window.__realPlayAdminVerified || window.__realPlayAdminAccessProbe);
    }
  }

  window.fetch = function playerSafeFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // Normal player sessions should not touch admin-only endpoints just to
    // discover that they are not admins. Admin access still works through the
    // explicit ?admin=1 flow used by admin.html.
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
      });
    }

    // A previously in-flight World request can finish after the directory was
    // opened. Reassert Players once after that short race window, without any
    // polling or recurring observer.
    window.setTimeout(() => {
      if (document.querySelector('[data-rp-simple-nav-item="players"][aria-current="page"]')) {
        forcePlayersDirectory(panel);
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
})();
