(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const HOME_PUBLIC_UPDATES_PATH = '/api/real-play/public/updates';
  const HOME_RANKING_ACCESS_PATH = '/api/real-play/career/access';

  // Keep the same Real Play loading screen in place after the core shell mounts
  // until the initial Home authority has actually settled the data visible on
  // the first screen. This gate deliberately ignores World, Players, Chats,
  // Profile, videos, admin tools, and other progressive enhancements.
  if (!window.__realPlayInitialHomeReadinessGateInstalled) {
    window.__realPlayInitialHomeReadinessGateInstalled = true;

    const originalFetch = window.fetch?.bind(window);
    const state = {
      appReady: false,
      publicSeen: false,
      publicBodySettled: false,
      availabilitySeen: false,
      availabilityBodySettled: false,
      released: false,
      fallbackTimer: 0,
    };

    const needsAvailability = () => Boolean(window.localStorage.getItem(TOKEN_KEY));

    function normalizeUrl(input) {
      try {
        if (typeof input === 'string') return new URL(input, window.location.href).href;
        if (input instanceof URL) return input.href;
        if (input && typeof input.url === 'string') return new URL(input.url, window.location.href).href;
      } catch (_error) {}
      return '';
    }

    function homeInstalled() {
      return Boolean(document.querySelector('[data-rp-simple-home][data-rp-home-command-center="true"]'));
    }

    function bodySettled(response) {
      if (!response || typeof response.clone !== 'function') return Promise.resolve();
      try {
        const copy = response.clone();
        return copy.text().catch(() => undefined);
      } catch (_error) {
        return Promise.resolve();
      }
    }

    function nextPaint() {
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      });
    }

    async function releaseGate(reason) {
      if (state.released) return;
      state.released = true;
      if (state.fallbackTimer) window.clearTimeout(state.fallbackTimer);
      await nextPaint();
      if (originalFetch && window.fetch === trackedFetch) window.fetch = originalFetch;
      try {
        window.dispatchEvent(new CustomEvent('realplay:initial-home-ready', { detail: { reason } }));
      } catch (_error) {}
    }

    function maybeRelease() {
      if (state.released || !state.appReady || !homeInstalled()) return;
      if (!state.publicSeen || !state.publicBodySettled) return;
      if (needsAvailability() && (!state.availabilitySeen || !state.availabilityBodySettled)) return;
      releaseGate('home-data-settled');
    }

    function trackResponse(kind, request) {
      Promise.resolve(request).then(
        async (response) => {
          await bodySettled(response);
          if (kind === 'public') state.publicBodySettled = true;
          if (kind === 'availability') state.availabilityBodySettled = true;
          queueMicrotask(maybeRelease);
        },
        () => {
          if (kind === 'public') state.publicBodySettled = true;
          if (kind === 'availability') state.availabilityBodySettled = true;
          queueMicrotask(maybeRelease);
        },
      );
    }

    function trackedFetch(...args) {
      const request = originalFetch(...args);
      if (!state.appReady || !window.__realPlaySimpleNavigationStateAuthorityInstalled) return request;

      const url = normalizeUrl(args[0]);
      if (!state.publicSeen && url.includes(HOME_PUBLIC_UPDATES_PATH)) {
        state.publicSeen = true;
        trackResponse('public', request);
      } else if (!state.availabilitySeen && url.includes(HOME_RANKING_ACCESS_PATH)) {
        state.availabilitySeen = true;
        trackResponse('availability', request);
      }
      return request;
    }

    if (originalFetch) window.fetch = trackedFetch;

    window.addEventListener('realplay:app-ready', () => {
      state.appReady = true;
      // This is only a deadlock escape if the Home authority itself fails to
      // load or never starts its initial request. It is not the normal reveal
      // condition and does not intentionally delay a healthy startup.
      state.fallbackTimer = window.setTimeout(() => {
        if (!state.released) {
          console.warn('[Real Play] Initial Home readiness gate used its failure fallback.');
          releaseGate('failure-fallback');
        }
      }, 10_000);
      queueMicrotask(maybeRelease);
    }, { once: true });
  }

  // Real Play is public-first: no account is required to browse the live
  // community, players, public chat, schedules, results, or announcements.
  // Existing participation gates remain responsible for asking visitors to
  // create/sign in to a player account only when identity is actually needed.
  if (!window.localStorage.getItem(TOKEN_KEY)) {
    window.localStorage.setItem(VISITOR_KEY, '1');
  } else {
    window.localStorage.removeItem(VISITOR_KEY);
  }

  // Full-screen announcements are a reusable public canvas. The frontend is
  // intentionally backend-ready: today a missing endpoint quietly means there
  // is no active takeover; later the public/admin endpoints only need to supply
  // and store the media payload without another UI rewrite.
  if (!window.__realPlayTakeoverLoaderInstalled) {
    window.__realPlayTakeoverLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'takeover-announcement.js?v=20260921-takeover-ui-v2';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Takeover announcement UI failed to load.');
    document.head.appendChild(script);
  }

  // Backend-free local launch testing lets Head Admin experience the takeover
  // exactly as it will appear on app open. The selected image/video is stored
  // only in this browser and is consumed on the next reload; nothing is
  // published to other users until the real backend endpoints are connected.
  if (!window.__realPlayTakeoverLocalTestLoaderInstalled) {
    window.__realPlayTakeoverLocalTestLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'takeover-local-test.js?v=20260921-takeover-local-test-v1';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Local takeover test helper failed to load.');
    document.head.appendChild(script);
  }

  // Home schedule editing is intentionally independent from Game Control.
  // Load its lightweight authority on every shell; it exposes the pencil only
  // after its own admin-status verification succeeds.
  if (!window.__realPlayHomeScheduleLoaderInstalled) {
    window.__realPlayHomeScheduleLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'home-open-rank-admin-edit.js?v=20260920-home-live-spots-single-writer-v2';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Home schedule editor failed to load.');
    document.head.appendChild(script);
  }

  // Game Control keeps its operational session data/functions, but the old
  // Career Session card and + Open Next Session controls no longer belong on
  // Setup now that the Home pencil owns schedule confirmation.
  if (!window.__realPlayAdminSetupSessionCleanupLoaderInstalled) {
    window.__realPlayAdminSetupSessionCleanupLoaderInstalled = true;
    const script = document.createElement('script');
    script.src = 'admin-setup-operational-session-hide.js?v=20260919-setup-cleanup-v1';
    script.async = false;
    script.onerror = () => console.warn('[Real Play] Admin Setup cleanup failed to load.');
    document.head.appendChild(script);
  }
})();
