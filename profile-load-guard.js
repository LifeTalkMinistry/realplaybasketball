(() => {
  if (window.__rpProfileLoadGuard) return;
  window.__rpProfileLoadGuard = true;

  const originalFetch = window.fetch.bind(window);

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input?.url || '';
  }

  function profileIsOpen() {
    return Boolean(document.querySelector('[data-rp-profile].open'));
  }

  window.fetch = function guardedRealPlayFetch(input, init = {}) {
    const url = urlOf(input);
    const isOptionalProfileTeamState = profileIsOpen()
      && /\/api\/real-play\/3v3\/me(?:\?|$)/.test(url);

    if (!isOptionalProfileTeamState) {
      return originalFetch(input, init);
    }

    const controller = new AbortController();
    let callerAbortHandler = null;

    if (init?.signal) {
      if (init.signal.aborted) controller.abort();
      else {
        callerAbortHandler = () => controller.abort();
        init.signal.addEventListener('abort', callerAbortHandler, { once: true });
      }
    }

    const timer = window.setTimeout(() => controller.abort(), 2500);
    return originalFetch(input, { ...init, signal: controller.signal }).finally(() => {
      window.clearTimeout(timer);
      if (init?.signal && callerAbortHandler) {
        init.signal.removeEventListener('abort', callerAbortHandler);
      }
    });
  };
})();