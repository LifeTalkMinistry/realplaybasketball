(() => {
  if (window.__realPlaySessionGuardInstalled) return;
  window.__realPlaySessionGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const REAL_PLAY_API = 'https://api.clarapmc.com/api/real-play/';
  const TOKEN_KEY = 'real_play_access_token';

  function isProtectedRealPlayRequest(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.startsWith(REAL_PLAY_API)) return false;

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    return headers.has('Authorization');
  }

  function isConfirmedExpiredSession(body) {
    const text = String(body || '').toLowerCase();
    return [
      'authorization token is invalid or expired',
      'token is invalid or expired',
      'token expired',
      'jwt expired',
      'invalid token',
      'expired token',
    ].some((phrase) => text.includes(phrase));
  }

  function recoverExpiredSession() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch (_error) {}

    try {
      window.dispatchEvent(new CustomEvent('realplay:session-expired'));
    } catch (_error) {}

    // auth-core keeps an in-memory copy of the token. Reload once after removing
    // the persisted token so every layer starts from the same logged-out state.
    window.setTimeout(() => {
      try {
        window.location.reload();
      } catch (_error) {}
    }, 80);
  }

  async function guardedFetch(input, init = {}) {
    const protectedRequest = isProtectedRealPlayRequest(input, init);
    let response = await nativeFetch(input, init);

    if (!protectedRequest || response.status !== 401) return response;

    // A single failed protected request must never destroy the whole app session.
    // Retry once in case the request raced with page/app initialization.
    try {
      response = await nativeFetch(input, init);
    } catch (_error) {
      return response;
    }

    if (response.status !== 401) return response;

    const body = await response.clone().text();

    // A genuinely expired/invalid credential is not a transient sync problem.
    // Clear only that stale device token and restart the app cleanly so mobile
    // never gets trapped showing an empty Players screen with an auth error.
    if (isConfirmedExpiredSession(body)) {
      recoverExpiredSession();
      return response;
    }

    // Preserve ambiguous/transient 401s. This keeps the original protection
    // against accidental logouts caused by short-lived backend/session races.
    const headers = new Headers(response.headers);
    headers.set('X-Real-Play-Session-Guard', 'preserved');

    return new Response(body, {
      status: 503,
      statusText: 'Session sync unavailable',
      headers,
    });
  }

  window.fetch = guardedFetch;
})();