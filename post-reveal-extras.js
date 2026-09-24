(() => {
  if (window.__realPlayPostRevealExtrasInstalled) return;
  window.__realPlayPostRevealExtrasInstalled = true;

  const scripts = [
    'profile-admin-account-info.js?v=20260923-profile-admin-account-info-v1',
    'profile-share-linked-card.js?v=20260920-profile-share-story-my-day-v110',
    'home-open-rank-admin-delete.js?v=20260921-home-schedule-delete-v1',
    'home-open-rank-admin-clear-list.js?v=20260921-home-schedule-clear-list-v3',
    'takeover-announcement.js?v=20260923-takeover-clean-v1',
    'takeover-local-test.js?v=20260923-takeover-clean-v1',
    'takeover-admin-clean.js?v=20260923-takeover-clean-v1',
  ];

  let started = false;

  function loadScript(src, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const existing = Array.from(document.scripts).find((script) => script.src === new URL(src, document.baseURI).href);
      if (existing) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      let settled = false;
      let timer = 0;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        resolve(Boolean(loaded));
      };

      script.src = src;
      script.async = false;
      script.addEventListener('load', () => finish(true), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
      timer = window.setTimeout(() => finish(false), timeoutMs);
      document.head.appendChild(script);
    });
  }

  async function start() {
    if (started) return;
    started = true;

    for (const src of scripts) {
      const loaded = await loadScript(src);
      if (!loaded) console.warn(`[Real Play] Post-reveal extra failed to load: ${src}`);
    }
  }

  function scheduleStart() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => start(), { timeout: 1200 });
      return;
    }
    window.setTimeout(start, 0);
  }

  if (document.documentElement.classList.contains('rp-shell-ready')) scheduleStart();
  else window.addEventListener('realplay:app-ready', scheduleStart, { once: true });
})();
