(() => {
  if (window.__realPlayReservationSnapshotStandbyFitInstalled) return;
  window.__realPlayReservationSnapshotStandbyFitInstalled = true;

  /*
    Premium Profile Art admin compatibility
    ---------------------------------------
    During the Profile Art Studio rollout, the frontend may arrive before the
    newer /admin/profile-art/access backend route. In that case we keep the
    editor admin-only by falling back to the already-established Real Play
    admin permission endpoint. Normal players still receive a 403 response.
  */
  const PROFILE_ART_ACCESS_PATH = '/api/real-play/admin/profile-art/access';
  const EXISTING_ADMIN_ACCESS_PATH = '/api/real-play/admin/career/control';
  const TOKEN_KEY = 'real_play_access_token';

  function installProfileArtAdminAccessCompat() {
    if (window.__realPlayProfileArtAdminAccessCompatInstalled) return;
    window.__realPlayProfileArtAdminAccessCompatInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.__realPlayNativeFetch = window.__realPlayNativeFetch || nativeFetch;

    window.fetch = async (input, init) => {
      const inputUrl = typeof input === 'string'
        ? input
        : (typeof Request !== 'undefined' && input instanceof Request)
          ? input.url
          : String(input?.url || input || '');

      if (!inputUrl.includes(PROFILE_ART_ACCESS_PATH)) {
        return nativeFetch(input, init);
      }

      // Prefer the dedicated Profile Art permission route as soon as the
      // backend has it. Compatibility is used only when that route is absent.
      const primary = await nativeFetch(input, init);
      if (primary.status !== 404 && primary.status !== 405) return primary;

      const headers = new Headers(
        init?.headers ||
        ((typeof Request !== 'undefined' && input instanceof Request) ? input.headers : undefined)
      );

      const fallbackUrl = inputUrl.replace(PROFILE_ART_ACCESS_PATH, EXISTING_ADMIN_ACCESS_PATH);
      const fallback = await nativeFetch(fallbackUrl, {
        ...init,
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      const data = await fallback.clone().json().catch(() => ({}));
      const admin = Boolean(fallback.ok && data?.admin === true);

      return new Response(JSON.stringify({
        admin,
        compatibilityFallback: true,
      }), {
        status: admin ? 200 : 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    };
  }

  function refreshProfileArtAdminAccess() {
    // The Profile Art module caches a failed admin probe. A synthetic storage
    // event resets that cache without changing the user's auth token.
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: TOKEN_KEY,
        storageArea: window.localStorage,
      }));
    } catch (_error) {
      const event = new Event('storage');
      try { Object.defineProperty(event, 'key', { value: TOKEN_KEY }); } catch (_ignore) {}
      window.dispatchEvent(event);
    }

    try {
      window.RealPlayPremiumProfileArt?.refresh?.();
    } catch (_error) {}
  }

  installProfileArtAdminAccessCompat();

  // Cover both load orders: this direct script can run before or after the
  // dynamically loaded profile-art module.
  [0, 250, 900, 1800].forEach((delay) => {
    window.setTimeout(refreshProfileArtAdminAccess, delay);
  });

  ['realplay:app-ready', 'realplay:profile-loaded', 'realplay:public-profile-loaded'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      window.setTimeout(refreshProfileArtAdminAccess, 0);
    });
  });

  const style = document.createElement('style');
  style.id = 'rp-reservation-snapshot-standby-fit-style';
  style.textContent = `
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-cell{
      min-width:0!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-line{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      gap:5px!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name{
      flex:1 1 0!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-standby-access{
      flex:0 0 auto!important;
      box-sizing:border-box!important;
      padding-left:4px!important;
      padding-right:4px!important;
      font-size:.28rem!important;
      letter-spacing:.055em!important;
      line-height:1!important;
      overflow:hidden!important;
      white-space:nowrap!important;
    }
  `;
  document.head.appendChild(style);
})();
