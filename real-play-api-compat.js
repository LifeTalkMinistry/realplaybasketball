(() => {
  if (window.__realPlayApiCompatInstalled) return;
  window.__realPlayApiCompatInstalled = true;
  if (typeof window.fetch !== 'function') return;

  const nativeFetch = window.fetch.bind(window);
  const HOME_SUMMARY = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/public\/home-summary(?:\?|$)/i;
  const HOME_FALLBACK = 'https://api.clarapmc.com/api/real-play/public/updates';
  const ME_SUMMARY = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/me\/summary(?:\?|$)/i;
  const ME_FALLBACK = 'https://api.clarapmc.com/api/real-play/me';
  const COMPAT_BACKOFF_MS = 5 * 60 * 1000;

  let homeSummaryUnavailableUntil = 0;
  let meSummaryUnavailableUntil = 0;
  let homeFallbackInFlight = null;
  let meFallbackInFlight = null;

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || '');
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  function compatibleInit(input, init) {
    const method = requestMethod(input, init);
    const headers = init?.headers || input?.headers;
    return {
      ...init,
      method,
      headers,
      cache: init?.cache || input?.cache || 'no-store',
    };
  }

  async function sharedFallback(kind, input, init) {
    const fallbackUrl = kind === 'home' ? HOME_FALLBACK : ME_FALLBACK;
    const key = kind === 'home' ? 'homeFallbackInFlight' : 'meFallbackInFlight';
    const existing = key === 'homeFallbackInFlight' ? homeFallbackInFlight : meFallbackInFlight;
    if (existing) {
      const response = await existing;
      return response.clone();
    }

    const request = nativeFetch(fallbackUrl, compatibleInit(input, init));
    if (key === 'homeFallbackInFlight') homeFallbackInFlight = request;
    else meFallbackInFlight = request;

    try {
      const response = await request;
      return response.clone();
    } finally {
      if (key === 'homeFallbackInFlight') homeFallbackInFlight = null;
      else meFallbackInFlight = null;
    }
  }

  window.fetch = async function realPlayApiCompatFetch(input, init) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    if (method === 'GET' && HOME_SUMMARY.test(url)) {
      if (Date.now() < homeSummaryUnavailableUntil) {
        return sharedFallback('home', input, init);
      }

      const response = await nativeFetch(input, init);
      if (response.status === 401 || response.status === 404) {
        homeSummaryUnavailableUntil = Date.now() + COMPAT_BACKOFF_MS;
        return sharedFallback('home', input, init);
      }
      return response;
    }

    if (method === 'GET' && ME_SUMMARY.test(url)) {
      if (Date.now() < meSummaryUnavailableUntil) {
        return sharedFallback('me', input, init);
      }

      const response = await nativeFetch(input, init);
      if (response.status === 404) {
        meSummaryUnavailableUntil = Date.now() + COMPAT_BACKOFF_MS;
        return sharedFallback('me', input, init);
      }
      return response;
    }

    return nativeFetch(input, init);
  };

  window.RealPlayApiCompat = {
    get homeSummaryFallbackActive() {
      return Date.now() < homeSummaryUnavailableUntil;
    },
    get meSummaryFallbackActive() {
      return Date.now() < meSummaryUnavailableUntil;
    },
  };
})();

(() => {
  if (document.querySelector('script[data-rp-game-story-viewer-loader]')) return;
  const script = document.createElement('script');
  script.src = 'world-game-story-viewer.js?v=20261007-story-carousel-v1';
  script.defer = true;
  script.dataset.rpGameStoryViewerLoader = 'true';
  document.head.appendChild(script);
})();
