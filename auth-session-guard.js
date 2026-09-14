(() => {
  if (window.__realPlaySessionGuardInstalled) return;
  window.__realPlaySessionGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const REAL_PLAY_API = 'https://api.clarapmc.com/api/real-play/';
  const COMMUNITY_URL = `${REAL_PLAY_API}community`;
  const PUBLIC_COMMUNITY_URL = `${REAL_PLAY_API}public/community`;
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const PUBLIC_ACTIONS = new Set(['bootstrap', 'feed', 'channels', 'chat', 'players', 'player_profile']);

  function requestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function isProtectedRealPlayRequest(input, init = {}) {
    const url = requestUrl(input);
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

  function switchToPublicSession() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.setItem(VISITOR_KEY, '1');
    } catch (_error) {}

    try {
      window.dispatchEvent(new CustomEvent('realplay:session-expired'));
      window.dispatchEvent(new CustomEvent('realplay:visitorchange'));
    } catch (_error) {}
  }

  function readBody(init = {}) {
    if (typeof init.body !== 'string' || !init.body) return null;
    try {
      return JSON.parse(init.body);
    } catch (_error) {
      return null;
    }
  }

  async function retryPublicCommunity(input, init = {}) {
    const url = requestUrl(input);
    if (url !== COMMUNITY_URL) return null;

    const body = readBody(init);
    const action = String(body?.action || '');
    if (!PUBLIC_ACTIONS.has(action)) return null;

    const headers = new Headers(init.headers || {});
    headers.delete('Authorization');
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    return nativeFetch(PUBLIC_COMMUNITY_URL, {
      ...init,
      method: init.method || 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  }

  async function guardedFetch(input, init = {}) {
    const protectedRequest = isProtectedRealPlayRequest(input, init);
    let response = await nativeFetch(input, init);

    if (!protectedRequest || response.ok) return response;

    // Inspect explicit expired-token responses regardless of whether the backend
    // surfaced them as 401, 403, or another auth failure status.
    const firstBody = await response.clone().text().catch(() => '');
    if (isConfirmedExpiredSession(firstBody)) {
      switchToPublicSession();

      // Public World/Players data should keep working instantly. Transparently
      // retry the same read action against the public endpoint, so the user does
      // not need to clear browser data, close the tab, or manually reset storage.
      try {
        const publicResponse = await retryPublicCommunity(input, init);
        if (publicResponse) return publicResponse;
      } catch (_error) {}

      return response;
    }

    if (response.status !== 401) return response;

    // A single ambiguous 401 must never destroy the whole app session. Retry once
    // in case the request raced with page/app initialization.
    try {
      response = await nativeFetch(input, init);
    } catch (_error) {
      return response;
    }

    if (response.status !== 401) return response;

    const body = await response.clone().text().catch(() => firstBody);
    if (isConfirmedExpiredSession(body)) {
      switchToPublicSession();
      try {
        const publicResponse = await retryPublicCommunity(input, init);
        if (publicResponse) return publicResponse;
      } catch (_error) {}
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
