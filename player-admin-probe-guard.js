(() => {
  if (window.__realPlayPlayerAdminProbeGuardInstalled) return;
  window.__realPlayPlayerAdminProbeGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const ADMIN_API_PREFIX = 'https://api.clarapmc.com/api/real-play/admin/';

  function adminContextRequested() {
    try {
      return new URLSearchParams(window.location.search).get('admin') === '1';
    } catch (_error) {
      return false;
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
})();
