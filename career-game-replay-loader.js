(() => {
  if (window.__realPlayReplayRuntimeLoaderInstalled) return;
  window.__realPlayReplayRuntimeLoaderInstalled = true;

  const REPLAY_SCRIPTS = [
    'visitor-replay-access.js',
    'career-game-replay.js',
    'career-game-replay-marker-cleanup.js',
    'career-game-replay-assist-authority.js',
    'career-game-replay-positive-events.js',
    'career-game-replay-fullscreen-back.js',
    'career-game-replay-stats.js',
    'career-game-replay-official-mvp.js',
    'career-game-replay-comments-viewport.js',
    'career-game-replay-winner.js',
  ];

  let runtimePromise = null;

  function version() {
    return String(document.documentElement?.dataset?.rpDeploy || 'replay-runtime');
  }

  function scriptLoaded(src) {
    return [...document.scripts].some((script) => {
      const url = String(script.src || '');
      return url.includes('/' + src) || url.endsWith(src) || url.includes(src + '?');
    });
  }

  function loadScript(src) {
    if (scriptLoaded(src)) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${src}?v=${encodeURIComponent(version())}`;
      script.async = false;
      script.dataset.rpReplayRuntimeScript = src;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Unable to load replay runtime: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureReplayRuntime() {
    if (window.__realPlayCareerReplayInstalled === true) return true;
    if (runtimePromise) return runtimePromise;

    runtimePromise = (async () => {
      for (const src of REPLAY_SCRIPTS) {
        await loadScript(src);
      }
      if (window.__realPlayCareerReplayInstalled !== true) {
        throw new Error('Real Play replay core did not initialize.');
      }
      try {
        window.dispatchEvent(new CustomEvent('realplay:replay-runtime-ready'));
      } catch (_error) {}
      return true;
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });

    return runtimePromise;
  }

  function validSessionId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function reopenSession(sessionId) {
    const id = validSessionId(sessionId);
    if (!id) return;

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.rpCareerReplaySession = String(id);
    proxy.dataset.rpReplayRuntimeHandoff = '1';
    document.body.appendChild(proxy);

    window.requestAnimationFrame(() => {
      if (!proxy.isConnected) return;
      proxy.click();
      window.setTimeout(() => proxy.remove(), 0);
    });
  }

  function prewarmFromTarget(target) {
    if (!target?.closest) return;
    if (!target.closest(
      '[data-rp-select-mode="Career Mode"], [data-rp-nav="career"], '
      + '.rp-profile-history .rp-profile-game, [data-rp-public-history-more], '
      + '[data-rp-public-history-list] .rp-profile-game'
    )) return;

    ensureReplayRuntime().catch((error) => {
      console.warn('[Real Play] Replay runtime prewarm did not finish.', error);
    });
  }

  document.addEventListener('pointerdown', (event) => {
    prewarmFromTarget(event.target);
  }, { capture: true, passive: true });

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-rp-career-replay-session]');
    if (!button || window.__realPlayCareerReplayInstalled === true) return;

    const sessionId = validSessionId(button.dataset.rpCareerReplaySession);
    if (!sessionId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    button.setAttribute('aria-busy', 'true');

    ensureReplayRuntime()
      .then(() => reopenSession(sessionId))
      .catch((error) => {
        console.error('[Real Play] Replay runtime failed to load.', error);
        if (button.isConnected) {
          button.removeAttribute('aria-busy');
          button.setAttribute('title', 'Replay could not load. Tap again to retry.');
        }
      });
  }, true);

  window.RealPlayReplayRuntime = {
    ensure: ensureReplayRuntime,
    isReady: () => window.__realPlayCareerReplayInstalled === true,
  };
})();
