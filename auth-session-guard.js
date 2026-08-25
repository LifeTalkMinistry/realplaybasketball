(() => {
  if (window.__realPlaySessionGuardInstalled) return;
  window.__realPlaySessionGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const REAL_PLAY_API = 'https://api.clarapmc.com/api/real-play/';

  function isProtectedRealPlayRequest(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.startsWith(REAL_PLAY_API)) return false;

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    return headers.has('Authorization');
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

    // auth-core historically clears the saved login token on *any* 401.
    // Preserve the response body but surface it as a recoverable session-sync
    // failure so the UI keeps the locally persisted player session. Explicit
    // LOG OUT still removes the token normally.
    const body = await response.clone().text();
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