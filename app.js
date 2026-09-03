(() => {
  const version = '20260903-public-landing-stable-v2';
  const REAL_PLAY_API = 'https://api.clarapmc.com/api/real-play/';

  // Session protection must not be a network dependency ahead of the visible UI.
  // Install the guard here synchronously, then mount the lobby immediately.
  if (!window.__realPlaySessionGuardInstalled && typeof window.fetch === 'function') {
    window.__realPlaySessionGuardInstalled = true;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async function guardedRealPlayFetch(input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url || '';
      const headers = new Headers(
        init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {}
      );
      const protectedRequest = url.startsWith(REAL_PLAY_API) && headers.has('Authorization');
      let response = await nativeFetch(input, init);

      if (!protectedRequest || response.status !== 401) return response;

      try {
        response = await nativeFetch(input, init);
      } catch (_error) {
        return response;
      }
      if (response.status !== 401) return response;

      const body = await response.clone().text();
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Real-Play-Session-Guard', 'preserved');
      return new Response(body, {
        status: 503,
        statusText: 'Session sync unavailable',
        headers: responseHeaders,
      });
    };
  }

  function addStylesheet(href) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  }

  function addScript(href, { onload, onerror } = {}) {
    const script = document.createElement('script');
    script.src = `${href}?v=${version}`;
    script.async = false;
    if (onload) script.addEventListener('load', onload, { once: true });
    if (onerror) script.addEventListener('error', onerror, { once: true });
    document.head.appendChild(script);
    return script;
  }

  function lobbyIsHealthy() {
    const app = document.querySelector('[data-rp-app]');
    return Boolean(
      app &&
      app.querySelector('[data-rp-entry]') &&
      app.querySelector('[data-rp-lobby]')
    );
  }

  function restoreBaseSite(reason) {
    document.body?.classList.remove('rp-lobby-active', 'rp-guest-active', 'rp-3v3-open');
    const brokenApp = document.querySelector('[data-rp-app]');
    if (brokenApp && !brokenApp.querySelector('[data-rp-lobby]')) brokenApp.remove();
    if (reason) console.error(`[Real Play] ${reason}`);
  }

  [
    'mobile-lobby.css',
    'mobile-entry.css',
    'public-landing.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'three-v-three-beta.css',
    'career-beta.css',
    'career-beta-play.css',
    'real-play-world.css',
    'membership.css',
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'admin-membership-review.css',
    'admin-three-v-three.css',
  ].forEach(addStylesheet);

  let enhancementsStarted = false;
  function startEnhancements() {
    if (enhancementsStarted || !lobbyIsHealthy()) return;
    enhancementsStarted = true;

    // The public landing is an enhancement of the already-mounted guest entry.
    // No optional feature below is allowed to hold the visible shell hostage.
    [
      'public-landing.js',
      'login-landing-fix.js',
      'persistent-session-fix.js',
      'career-beta.js',
      'career-beta-play.js',
      'membership-bootstrap.js',
      'career-beta-leaderboard.js',
      'three-v-three-beta.js',
      'real-play-world.js',
    ].forEach((href) => addScript(href));

    if (new URLSearchParams(window.location.search).get('admin') === '1') {
      [
        'admin-score-sync.js',
        'admin-game-control.js',
        'admin-session-start.js',
        'admin-game-control-simplify.js',
        'admin-courtside-live.js',
        'admin-manual-open.js',
        'admin-session-picker.js',
        'admin-score-dom-sync.js',
        'admin-membership-review.js',
        'admin-three-v-three.js',
      ].forEach((href) => addScript(href));
    }
  }

  // Critical path: the visible lobby mounts first. We deliberately do not add
  // the old global .js reveal class before this point, so a delayed asset can no
  // longer turn the whole page into an empty black screen.
  addScript('mobile-lobby.js', {
    onload: () => {
      if (!lobbyIsHealthy()) {
        restoreBaseSite('Mobile lobby loaded but did not mount correctly.');
        return;
      }
      startEnhancements();
    },
    onerror: () => restoreBaseSite('Mobile lobby asset failed to load.'),
  });

  window.setTimeout(() => {
    if (!lobbyIsHealthy()) {
      restoreBaseSite('Mobile lobby startup timed out; restored the base site.');
    } else {
      startEnhancements();
    }
  }, 4500);
})();
