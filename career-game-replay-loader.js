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
  let runtimeReady = false;
  let loadingOverlay = null;

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

  function ensureLoadingOverlay() {
    if (loadingOverlay?.isConnected) return loadingOverlay;

    if (!document.getElementById('rp-replay-runtime-loading-style')) {
      const style = document.createElement('style');
      style.id = 'rp-replay-runtime-loading-style';
      style.textContent = `
        .rp-replay-runtime-loading{
          position:fixed;
          inset:0;
          z-index:2147483000;
          display:grid;
          place-items:center;
          background:rgba(1,8,15,.88);
          backdrop-filter:blur(7px);
          -webkit-backdrop-filter:blur(7px);
        }
        .rp-replay-runtime-loading[hidden]{display:none!important}
        .rp-replay-runtime-loading-card{
          min-width:190px;
          padding:22px 24px;
          border:1px solid rgba(66,211,255,.28);
          border-radius:18px;
          background:rgba(3,16,27,.96);
          box-shadow:0 18px 55px rgba(0,0,0,.45);
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:12px;
          color:#f4fbff;
          font:800 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.12em;
          text-transform:uppercase;
        }
        .rp-replay-runtime-loading-spinner{
          width:28px;
          height:28px;
          border-radius:50%;
          border:3px solid rgba(85,220,255,.2);
          border-top-color:#55dcff;
          animation:rpReplayRuntimeSpin .72s linear infinite;
        }
        @keyframes rpReplayRuntimeSpin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){
          .rp-replay-runtime-loading-spinner{animation:none;border-top-color:#55dcff}
        }
      `;
      document.head.appendChild(style);
    }

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'rp-replay-runtime-loading';
    loadingOverlay.hidden = true;
    loadingOverlay.setAttribute('role', 'status');
    loadingOverlay.setAttribute('aria-live', 'polite');
    loadingOverlay.innerHTML = `
      <div class="rp-replay-runtime-loading-card">
        <span class="rp-replay-runtime-loading-spinner" aria-hidden="true"></span>
        <span>Loading Replay…</span>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
    return loadingOverlay;
  }

  function showLoadingOverlay() {
    ensureLoadingOverlay().hidden = false;
  }

  function hideLoadingOverlay() {
    if (loadingOverlay?.isConnected) loadingOverlay.hidden = true;
  }

  async function ensureReplayRuntime() {
    if (runtimeReady) return true;
    if (runtimePromise) return runtimePromise;

    runtimePromise = (async () => {
      for (const src of REPLAY_SCRIPTS) {
        await loadScript(src);
      }
      if (window.__realPlayCareerReplayInstalled !== true) {
        throw new Error('Real Play replay core did not initialize.');
      }
      runtimeReady = true;
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
    if (!id) {
      hideLoadingOverlay();
      return;
    }

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.rpCareerReplaySession = String(id);
    proxy.dataset.rpReplayRuntimeHandoff = '1';
    document.body.appendChild(proxy);

    window.requestAnimationFrame(() => {
      if (!proxy.isConnected) {
        hideLoadingOverlay();
        return;
      }
      proxy.click();
      window.setTimeout(() => {
        proxy.remove();
        hideLoadingOverlay();
      }, 80);
    });
  }

  function prewarmFromTarget(target) {
    if (!target?.closest) return;
    if (!target.closest(
      '[data-rp-select-mode="Career Mode"], [data-rp-nav="career"], '
      + '.rp-profile-history .rp-profile-game, [data-rp-public-history-more], '
      + '[data-rp-public-history-list] .rp-profile-game, '
      + '[data-rp-world-watch], [data-rp-world-game-recap]'
    )) return;

    ensureReplayRuntime().catch((error) => {
      console.warn('[Real Play] Replay runtime prewarm did not finish.', error);
    });
  }

  document.addEventListener('pointerdown', (event) => {
    prewarmFromTarget(event.target);
  }, { capture: true, passive: true });

  document.addEventListener('click', (event) => {
    prewarmFromTarget(event.target);
    const button = event.target?.closest?.('[data-rp-career-replay-session]');
    if (!button || runtimeReady) return;

    const sessionId = validSessionId(button.dataset.rpCareerReplaySession);
    if (!sessionId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    button.setAttribute('aria-busy', 'true');
    showLoadingOverlay();

    ensureReplayRuntime()
      .then(() => {
        if (button.isConnected) button.removeAttribute('aria-busy');
        reopenSession(sessionId);
      })
      .catch((error) => {
        hideLoadingOverlay();
        console.error('[Real Play] Replay runtime failed to load.', error);
        if (button.isConnected) {
          button.removeAttribute('aria-busy');
          button.setAttribute('title', 'Replay could not load. Tap again to retry.');
        }
      });
  }, true);

  window.RealPlayReplayRuntime = {
    ensure: ensureReplayRuntime,
    isReady: () => runtimeReady,
  };
})();
