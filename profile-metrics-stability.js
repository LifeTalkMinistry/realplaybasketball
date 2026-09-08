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
})();