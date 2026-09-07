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

  function releaseFocus(container = null) {
    const active = document.activeElement;
    if (!active || active === document.body) return;
    if (container && !container.contains(active)) return;
    try { active.blur?.(); } catch (_) {}
  }

  function closeCompetingOverlay(selector, closeSelector, bodyClass = '') {
    const overlay = document.querySelector(selector);
    if (!overlay?.classList.contains('open')) return;

    releaseFocus(overlay);
    const close = overlay.querySelector(closeSelector);
    if (close) {
      close.click();
      return;
    }

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if (bodyClass) document.body.classList.remove(bodyClass);
  }

  function prepareProfileOpen() {
    // Real Play uses full-screen application surfaces. Never leave another
    // full-screen surface active underneath Profile; overlapping surfaces were
    // causing focus/aria warnings and visible one-frame UI swaps.
    closeCompetingOverlay('[data-rp-career-replay]', '[data-rp-career-replay-close]', 'rp-career-replay-open');
    closeCompetingOverlay('[data-rp-updates]', '[data-updates-close]', 'rp-updates-open');
    closeCompetingOverlay('.rp-admin-control', '[data-admin-exit]', 'rp-admin-open');
    closeCompetingOverlay('.rp-public-player-profile, [data-rp-public-profile]', '[data-rp-public-profile-close], [data-rp-player-profile-close], [data-rp-profile-close]');
    releaseFocus();
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]')) return;
    prepareProfileOpen();
  }, true);

  // This guard intentionally loads before real-play-profile.js and
  // real-play-profile-metrics.js. Those legacy modules both listen for window
  // focus and rebuild/refetch an already-open profile. With DevTools, tab
  // switching, or a native dialog, that caused the base profile to paint and
  // the enhancement layer to immediately paint over it. Keep the currently
  // rendered Profile stable instead.
  window.addEventListener('focus', (event) => {
    if (!profileIsOpen()) return;
    event.stopImmediatePropagation();
  }, true);

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

    // Team/club state is cosmetic on the current Profile. Never let a slow
    // optional endpoint hold the visible profile loader for several seconds.
    const timer = window.setTimeout(() => controller.abort(), 900);
    return originalFetch(input, { ...init, signal: controller.signal }).finally(() => {
      window.clearTimeout(timer);
      if (init?.signal && callerAbortHandler) {
        init.signal.removeEventListener('abort', callerAbortHandler);
      }
    });
  };
})();