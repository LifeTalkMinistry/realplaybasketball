(() => {
  if (window.__realPlayVisitorReplayAccessInstalled) return;
  window.__realPlayVisitorReplayAccessInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const VISITOR_REPLAY_TOKEN = '__REAL_PLAY_VISITOR_REPLAY__';
  const originalFetch = window.fetch.bind(window);
  let replayBridgeActive = false;

  function visitorActive() {
    return localStorage.getItem(VISITOR_KEY) === '1'
      && !localStorage.getItem(TOKEN_KEY);
  }

  window.fetch = function realPlayVisitorReplayFetch(input, init = {}) {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const match = String(rawUrl || '').match(/\/api\/real-play\/career\/games\/(\d+)\/replay(?:[?#]|$)/);
      const visitorSession = localStorage.getItem(VISITOR_KEY) === '1';
      const accessToken = localStorage.getItem(TOKEN_KEY);

      if (match && visitorSession && accessToken === VISITOR_REPLAY_TOKEN) {
        const headers = new Headers(
          init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
        );
        headers.delete('Authorization');
        const publicUrl = `${API_BASE_URL}/api/real-play/public/career/games/${encodeURIComponent(match[1])}/replay`;
        return originalFetch(publicUrl, { ...init, headers });
      }
    } catch (_error) {
      // Fall through to the normal request path if this is not our replay request.
    }
    return originalFetch(input, init);
  };

  window.addEventListener('click', (event) => {
    if (replayBridgeActive || !visitorActive()) return;
    const trigger = event.target?.closest?.('[data-rp-career-replay-session]');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    localStorage.setItem(TOKEN_KEY, VISITOR_REPLAY_TOKEN);
    replayBridgeActive = true;
    try {
      // The canonical replay viewer already owns playback, score markers,
      // fullscreen, seeking and YouTube/direct-video handling. Re-dispatch once
      // with a temporary visitor marker so it can reuse that exact UI while the
      // request is transparently redirected to the public read-only endpoint.
      trigger.click();
    } finally {
      replayBridgeActive = false;
      if (localStorage.getItem(TOKEN_KEY) === VISITOR_REPLAY_TOKEN) {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }, true);
})();
