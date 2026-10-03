(() => {
  if (window.__realPlayPlayerSummaryStoreInstalled) return;
  window.__realPlayPlayerSummaryStoreInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const SUMMARY_URL = 'https://api.clarapmc.com/api/real-play/me/summary';
  const LEGACY_ME_URL = 'https://api.clarapmc.com/api/real-play/me';
  const CACHE_MS = 15_000;

  let cachedToken = '';
  let cachedState = null;
  let cachedAt = 0;
  let inFlight = null;

  function currentToken() {
    return String(window.localStorage.getItem(TOKEN_KEY) || '');
  }

  function clear() {
    cachedToken = '';
    cachedState = null;
    cachedAt = 0;
    inFlight = null;
  }

  function prime(state) {
    if (!state || typeof state !== 'object') return;
    const token = currentToken();
    if (!token) {
      clear();
      return;
    }

    const careerSummary = state.careerSummary || state.career_summary || {};
    const ovr = state.ovr
      ?? state.career?.ovr
      ?? careerSummary.ovr
      ?? state.profile?.ovr
      ?? state.profile?.rating
      ?? null;
    const rank = state.rank
      ?? state.ranking?.rank
      ?? state.career?.rank
      ?? careerSummary.rank
      ?? null;

    cachedToken = token;
    cachedState = {
      profile: state.profile || null,
      currentNumber: state.currentNumber || state.current_number || null,
      ovr,
      rank,
      officialRankingEligible: Boolean(
        state.officialRankingEligible
        ?? state.official_ranking_eligible
        ?? careerSummary.officialRankingEligible
        ?? careerSummary.official_ranking_eligible
      ),
      careerSummary: {
        ...careerSummary,
        ovr: careerSummary.ovr ?? ovr,
        rank: careerSummary.rank ?? rank,
      },
    };
    cachedAt = Date.now();
  }

  async function get(options = {}) {
    const force = Boolean(options.force);
    const token = currentToken();
    if (!token) {
      clear();
      return null;
    }

    if (cachedToken && cachedToken !== token) clear();
    const now = Date.now();
    if (!force && cachedState && cachedToken === token && now - cachedAt < CACHE_MS) {
      return cachedState;
    }
    if (inFlight) return inFlight;

    const requestToken = token;
    const requestOptions = {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${requestToken}`,
      },
      cache: 'no-store',
    };

    inFlight = fetch(SUMMARY_URL, requestOptions).then(async (response) => {
      // Deployment compatibility: if the frontend reaches a backend node that
      // has not received /me/summary yet, preserve player identity/OVR using
      // the old endpoint. This fallback disappears naturally once summary is live.
      if (response.status === 404 || response.status === 405) {
        response = await fetch(LEGACY_ME_URL, requestOptions);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.message || data?.error || 'Could not load player summary.');
        error.status = response.status;
        throw error;
      }

      if (currentToken() === requestToken) {
        cachedToken = requestToken;
        cachedState = data;
        cachedAt = Date.now();
        try {
          window.dispatchEvent(new CustomEvent('realplay:player-summary-updated', { detail: data }));
        } catch (_error) {}
      }
      return data;
    }).finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  function peek() {
    const token = currentToken();
    if (!token || token !== cachedToken) return null;
    return cachedState;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === null) clear();
  });
  window.addEventListener('realplay:visitorchange', () => {
    if (!currentToken()) clear();
  });
  window.addEventListener('realplay:profile-loaded', (event) => {
    prime(event?.detail?.state);
  });

  window.RealPlayPlayerSummary = {
    CACHE_MS,
    get,
    peek,
    prime,
    clear,
  };
})();
