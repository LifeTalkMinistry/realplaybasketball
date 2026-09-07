(() => {
  if (window.__realPlayVisitorReplayAccessInstalled) return;
  window.__realPlayVisitorReplayAccessInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const VISITOR_REPLAY_TOKEN = '__REAL_PLAY_VISITOR_REPLAY__';
  const originalFetch = window.fetch.bind(window);

  let bridgeExpiresAt = 0;
  let cleanupTimer = null;

  function realToken() {
    const value = localStorage.getItem(TOKEN_KEY) || '';
    return value === VISITOR_REPLAY_TOKEN ? '' : value;
  }

  function visitorActive() {
    return localStorage.getItem(VISITOR_KEY) === '1' && !realToken();
  }

  function bridgeActive() {
    return localStorage.getItem(VISITOR_KEY) === '1'
      && localStorage.getItem(TOKEN_KEY) === VISITOR_REPLAY_TOKEN
      && Date.now() < bridgeExpiresAt;
  }

  function clearBridge() {
    bridgeExpiresAt = 0;
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    if (localStorage.getItem(TOKEN_KEY) === VISITOR_REPLAY_TOKEN) {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function armBridge() {
    if (!visitorActive()) return false;
    localStorage.setItem(TOKEN_KEY, VISITOR_REPLAY_TOKEN);
    bridgeExpiresAt = Date.now() + 15000;
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(clearBridge, 15050);
    return true;
  }

  function strippedHeaders(input, init) {
    const headers = new Headers(
      init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
    );
    headers.delete('Authorization');
    return headers;
  }

  window.fetch = function realPlayVisitorReplayFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    const url = String(rawUrl || '');

    try {
      if (bridgeActive()) {
        const replayMatch = url.match(/\/api\/real-play\/career\/games\/(\d+)\/replay(?:[?#]|$)/);
        if (replayMatch) {
          const publicUrl = `${API_BASE_URL}/api/real-play/public/career/games/${encodeURIComponent(replayMatch[1])}/replay`;
          const request = originalFetch(publicUrl, { ...init, headers: strippedHeaders(input, init) });
          clearBridge();
          return request;
        }

        if (/\/api\/real-play\/community(?:[?#]|$)/.test(url)) {
          let body = null;
          try { body = JSON.parse(String(init?.body || '{}')); } catch (_) {}
          if (String(body?.action || '').toLowerCase() === 'player_profile') {
            return originalFetch(`${API_BASE_URL}/api/real-play/public/community`, {
              ...init,
              headers: strippedHeaders(input, init),
            });
          }
        }
      }
    } catch (_error) {
      // Fall through to the original request path.
    }

    return originalFetch(input, init);
  };

  // Public profile game cards resolve their session id asynchronously before
  // they trigger the canonical replay viewer. Keep one temporary sentinel alive
  // across that lookup so both the player-profile read and replay request are
  // transparently redirected to the visitor-safe public endpoints.
  document.addEventListener('click', (event) => {
    if (!visitorActive()) return;
    const card = event.target?.closest?.('.rp-profile-history .rp-profile-game');
    if (card) armBridge();
  }, true);

  window.addEventListener('realplay:visitorchange', (event) => {
    if (!event?.detail?.visitor) clearBridge();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === VISITOR_KEY && event.newValue !== '1') clearBridge();
  });
})();
