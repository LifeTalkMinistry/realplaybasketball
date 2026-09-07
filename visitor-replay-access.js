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
  let currentPublicPlayerId = null;

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

  function jsonResponse(data, sourceResponse) {
    const headers = new Headers(sourceResponse?.headers || undefined);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(data ?? {}), {
      status: sourceResponse?.status || 200,
      statusText: sourceResponse?.statusText || '',
      headers,
    });
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

        // The legacy profile replay linker still treats the visitor-owned public
        // profile panel as "my profile" and asks /me for recent games. Translate
        // that one temporary read into the selected public player's profile so
        // the canonical replay viewer can resolve the correct session id.
        if (/\/api\/real-play\/me(?:[?#]|$)/.test(url)
            && Number.isSafeInteger(currentPublicPlayerId)
            && currentPublicPlayerId > 0) {
          return originalFetch(`${API_BASE_URL}/api/real-play/public/community`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'player_profile', playerId: currentPublicPlayerId }),
            cache: 'no-store',
          }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            return jsonResponse(data?.player || data, response);
          });
        }
      }
    } catch (_error) {
      // Fall through to the original request path.
    }

    return originalFetch(input, init);
  };

  // Keep track of the public player selected before visitor-world-players stops
  // propagation on the row click. This listener is installed earlier, so it
  // records the identity without changing the visitor UI behavior.
  document.addEventListener('click', (event) => {
    if (!visitorActive()) return;

    const playerRow = event.target?.closest?.('[data-world-player-id]');
    if (playerRow) {
      const playerId = Number(playerRow.dataset.worldPlayerId);
      if (Number.isSafeInteger(playerId) && playerId > 0) currentPublicPlayerId = playerId;
      return;
    }

    const card = event.target?.closest?.('.rp-profile-history .rp-profile-game');
    if (card) armBridge();
  }, true);

  window.addEventListener('realplay:visitorchange', (event) => {
    if (!event?.detail?.visitor) {
      currentPublicPlayerId = null;
      clearBridge();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === VISITOR_KEY && event.newValue !== '1') {
      currentPublicPlayerId = null;
      clearBridge();
    }
  });
})();
