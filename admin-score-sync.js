(() => {
  if (window.__realPlayAdminScoreSyncInstalled) return;
  window.__realPlayAdminScoreSyncInstalled = true;

  const CONTROL_PATH = '/api/real-play/admin/career/control';
  const originalFetch = window.fetch.bind(window);
  let lastRawControl = null;

  function isControlRequest(input) {
    const url = typeof input === 'string' ? input : input?.url;
    return typeof url === 'string' && url.includes(CONTROL_PATH);
  }

  function parseAction(options = {}) {
    if (!options?.body || typeof options.body !== 'string') return '';
    try {
      return String(JSON.parse(options.body)?.action || '').trim().toLowerCase();
    } catch (_error) {
      return '';
    }
  }

  function deriveScores(control) {
    const scores = { west: 0, east: 0 };
    for (const player of control?.players || []) {
      if (!player?.checkedIn || !['west', 'east'].includes(player?.team)) continue;
      scores[player.team] += Math.max(0, Number(player?.stats?.pts || 0));
    }
    return scores;
  }

  function withDerivedScore(data) {
    const control = data?.control;
    if (!control?.session) return data;

    lastRawControl = JSON.parse(JSON.stringify(control));
    const scores = deriveScores(control);
    control.session.westScore = scores.west;
    control.session.eastScore = scores.east;
    return data;
  }

  function copyResponse(response, data) {
    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  function requestHeaders(input, options = {}) {
    const headers = new Headers(typeof input !== 'string' && input?.headers ? input.headers : undefined);
    new Headers(options?.headers || {}).forEach((value, key) => headers.set(key, value));
    return headers;
  }

  async function rawControl(url, headers) {
    const response = await originalFetch(url, {
      method: 'GET',
      headers,
    });
    const data = await response.clone().json().catch(() => null);
    if (!response.ok || !data?.control?.session) return null;
    return data.control;
  }

  async function addLegacyPoints(url, headers, team, points) {
    let remaining = Math.max(0, Math.floor(points));
    while (remaining > 0) {
      const chunk = Math.min(3, remaining);
      const response = await originalFetch(url, {
        method: 'POST',
        headers: new Headers({
          ...Object.fromEntries(headers.entries()),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ action: 'score', team, points: chunk }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // The new backend intentionally rejects direct team scoring because
        // player PTS already controls the score. In that case no bridge is needed.
        if (data?.code === 'PLAYER_POINTS_CONTROL_SCORE') return;
        throw new Error(data?.message || 'Unable to synchronize the team score before finalizing.');
      }
      remaining -= chunk;
    }
  }

  async function syncLegacyScoreBeforeFinalize(input, options = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const headers = requestHeaders(input, options);
    const current = await rawControl(url, headers) || lastRawControl;
    if (!current?.session) return;

    const desired = deriveScores(current);
    const storedWest = Math.max(0, Number(current.session.westScore || 0));
    const storedEast = Math.max(0, Number(current.session.eastScore || 0));

    // Current production backend may still be on the legacy model where team
    // score and player PTS are stored separately. Bring the legacy counters up
    // to the player totals immediately before FINALIZE. The new backend already
    // returns matching values, so this becomes a no-op after deployment.
    if (storedWest < desired.west) {
      await addLegacyPoints(url, headers, 'west', desired.west - storedWest);
    }
    if (storedEast < desired.east) {
      await addLegacyPoints(url, headers, 'east', desired.east - storedEast);
    }
  }

  window.fetch = async function realPlayScoreAwareFetch(input, options = {}) {
    if (!isControlRequest(input)) return originalFetch(input, options);

    const action = parseAction(options);
    if (action === 'finalize') {
      await syncLegacyScoreBeforeFinalize(input, options);
    }

    const response = await originalFetch(input, options);
    const clone = response.clone();
    const data = await clone.json().catch(() => null);
    if (!data?.control) return response;

    return copyResponse(response, withDerivedScore(data));
  };
})();
