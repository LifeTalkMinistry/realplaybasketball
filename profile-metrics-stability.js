(() => {
  if (window.__realPlayProfileMetricsStabilityInstalled) return;
  window.__realPlayProfileMetricsStabilityInstalled = true;

  const METRICS_PATH = '/api/real-play/career/metrics';
  const RETRY_COOLDOWN_MS = 30000;
  const originalFetch = window.fetch.bind(window);

  let inFlight = null;
  let blockedUntil = 0;
  let lastFailureStatus = 0;

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input?.url || '';
  }

  function isMetricsRequest(input) {
    const url = urlOf(input);
    return url.includes(METRICS_PATH);
  }

  function syntheticUnavailable() {
    return new Response(JSON.stringify({
      error: 'career_metrics_temporarily_unavailable',
      retryAfterMs: Math.max(0, blockedUntil - Date.now()),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function showUnavailable(status = lastFailureStatus) {
    const profiles = document.querySelectorAll('.rp-public-player-profile.open, [data-rp-profile].open, .rp-profile.open');
    profiles.forEach((profile) => {
      const grid = profile.querySelector('.rp-profile-stat-grid');
      const section = grid?.closest('.rp-profile-section');
      if (!grid || !section) return;

      let shell = section.querySelector('[data-rp-metrics-shell]');
      if (!shell) {
        shell = document.createElement('div');
        shell.className = 'rp-profile-metrics-shell';
        shell.dataset.rpMetricsShell = 'true';
        grid.insertAdjacentElement('afterend', shell);
      }

      if (shell.dataset.rpMetricsUnavailable === 'true') return;
      shell.dataset.rpMetricsUnavailable = 'true';
      shell.innerHTML = `
        <div class="rp-profile-metrics-unavailable" role="status">
          <strong>CAREER METRICS TEMPORARILY UNAVAILABLE</strong>
          <span>${status >= 500 ? 'THE METRICS SERVICE RETURNED A SERVER ERROR.' : 'REAL PLAY COULD NOT LOAD METRICS RIGHT NOW.'}</span>
          <small>YOUR PROFILE AND RECENT GAMES ARE STILL AVAILABLE.</small>
        </div>`;
    });
  }

  function clearUnavailable() {
    document.querySelectorAll('[data-rp-metrics-shell][data-rp-metrics-unavailable="true"]').forEach((shell) => {
      delete shell.dataset.rpMetricsUnavailable;
    });
  }

  window.fetch = function stableProfileMetricsFetch(input, init = {}) {
    if (!isMetricsRequest(input)) return originalFetch(input, init);

    const now = Date.now();
    if (now < blockedUntil) {
      showUnavailable();
      return Promise.resolve(syntheticUnavailable());
    }

    if (inFlight) {
      return inFlight.then((response) => response.clone());
    }

    inFlight = originalFetch(input, init)
      .then((response) => {
        if (response.status >= 500) {
          lastFailureStatus = response.status;
          blockedUntil = Date.now() + RETRY_COOLDOWN_MS;
          showUnavailable(response.status);
        } else if (response.ok) {
          lastFailureStatus = 0;
          blockedUntil = 0;
          clearUnavailable();
        }
        return response;
      })
      .catch((error) => {
        lastFailureStatus = 0;
        blockedUntil = Date.now() + RETRY_COOLDOWN_MS;
        showUnavailable(0);
        throw error;
      })
      .finally(() => {
        window.setTimeout(() => {
          inFlight = null;
        }, 0);
      });

    return inFlight.then((response) => response.clone());
  };

  function installMinimalPlayerConnectionStyles() {
    if (document.querySelector('[data-rp-player-connections-minimal-inline]')) return;

    const style = document.createElement('style');
    style.dataset.rpPlayerConnectionsMinimalInline = 'true';
    style.textContent = `
      .rp-player-connections-section > .rp-profile-section-head{display:none!important}
      .rp-player-connections-section{padding-block:18px!important}
      .rp-player-connections-section::after{display:none!important}
      .rp-player-connections-section .rp-player-connections-preview{position:relative!important;z-index:1!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:22px!important;align-items:center!important;padding:0 4px!important}
      .rp-player-connections-section .rp-player-connections-preview::after{content:'|'!important;position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;color:#5f7185!important;font-family:Arial,sans-serif!important;font-size:.72rem!important;font-weight:900!important;line-height:1!important;pointer-events:none!important}
      .rp-player-connections-section .rp-player-connection-preview{appearance:none!important;-webkit-appearance:none!important;min-width:0!important;min-height:0!important;width:100%!important;padding:2px 0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;display:block!important;color:#eef8ff!important;text-align:center!important;cursor:pointer!important;overflow:visible!important;opacity:1!important}
      .rp-player-connections-section .rp-player-connection-preview::before,.rp-player-connections-section .rp-player-connection-preview>strong,.rp-player-connections-section .rp-player-connection-preview>span,.rp-player-connections-section .rp-player-connection-preview .rp-connection-arrow{display:none!important}
      .rp-player-connections-section .rp-player-connection-preview>small{display:block!important;max-width:none!important;margin:0!important;color:#f2f7fb!important;font-family:Impact,'Arial Narrow',Arial,sans-serif!important;font-size:.72rem!important;font-style:italic!important;font-weight:900!important;letter-spacing:.035em!important;line-height:1.15!important;white-space:nowrap!important}
      .rp-player-connections-section .rp-player-connection-preview:hover>small,.rp-player-connections-section .rp-player-connection-preview:focus-visible>small{color:#42d8ff!important}
      .rp-player-connections-section .rp-player-connection-preview.against:hover>small,.rp-player-connections-section .rp-player-connection-preview.against:focus-visible>small{color:#ff7597!important}
      @media(max-width:360px){.rp-player-connections-section .rp-player-connections-preview{gap:18px!important}.rp-player-connections-section .rp-player-connection-preview>small{font-size:.62rem!important;letter-spacing:.02em!important}}
    `;
    document.head.appendChild(style);
  }

  function loadMinimalPlayerConnections() {
    installMinimalPlayerConnectionStyles();
    if (window.__realPlayPlayerConnectionsMinimalInstalled) return;
    if (document.querySelector('script[data-rp-player-connections-minimal-loader]')) return;

    const script = document.createElement('script');
    script.dataset.rpPlayerConnectionsMinimalLoader = 'true';
    script.src = 'profile-player-connections-minimal.js?v=20260917-player-connections-minimal-v2';
    script.async = false;
    script.addEventListener('error', () => {
      console.warn('[Real Play] Minimal Player Connections styling failed to load.');
    }, { once: true });
    document.head.appendChild(script);
  }

  function loadPlayerConnections() {
    installMinimalPlayerConnectionStyles();
    if (window.__realPlayPlayerConnectionsInstalled) {
      loadMinimalPlayerConnections();
      return;
    }

    const existing = document.querySelector('script[data-rp-player-connections-loader]');
    if (existing) {
      existing.addEventListener('load', loadMinimalPlayerConnections, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.rpPlayerConnectionsLoader = 'true';
    script.src = 'profile-player-connections.js?v=20260917-player-connections-v2';
    script.async = false;
    script.addEventListener('load', loadMinimalPlayerConnections, { once: true });
    script.addEventListener('error', () => {
      console.warn('[Real Play] Player Connections failed to load.');
    }, { once: true });
    document.head.appendChild(script);
  }

  function appendProfileShareScript() {
    if (window.__realPlayProfileShareInstalled) return;
    if (document.querySelector('script[data-rp-profile-share-loader]')) return;

    const script = document.createElement('script');
    script.dataset.rpProfileShareLoader = 'true';
    script.src = 'profile-share.js?v=20260919-profile-share-dom-capture-v3';
    script.async = false;
    script.addEventListener('error', () => {
      console.warn('[Real Play] Profile sharing failed to load.');
    }, { once: true });
    document.head.appendChild(script);
  }

  function loadProfileShare() {
    if (window.__realPlayProfileShareInstalled) return;

    if (window.__realPlayProfileShareArtBridgeInstalled) {
      appendProfileShareScript();
      return;
    }

    const existing = document.querySelector('script[data-rp-profile-share-art-bridge-loader]');
    if (existing) {
      existing.addEventListener('load', appendProfileShareScript, { once: true });
      existing.addEventListener('error', appendProfileShareScript, { once: true });
      return;
    }

    const bridge = document.createElement('script');
    bridge.dataset.rpProfileShareArtBridgeLoader = 'true';
    bridge.src = 'profile-share-art-bridge.js?v=20260919-profile-share-art-bridge-v1';
    bridge.async = false;
    bridge.addEventListener('load', appendProfileShareScript, { once: true });
    bridge.addEventListener('error', () => {
      console.warn('[Real Play] Profile share art bridge failed to load.');
      appendProfileShareScript();
    }, { once: true });
    document.head.appendChild(bridge);
  }

  loadPlayerConnections();
  loadProfileShare();
})();