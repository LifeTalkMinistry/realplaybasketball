(() => {
  function install() {
    const status = document.querySelector('[data-auth-status]');
    const overlay = document.querySelector('[data-auth-overlay]');
    const closeButton = document.querySelector('[data-auth-close]');
    const accountView = document.querySelector('[data-auth-view="account"]');
    const signupTab = document.querySelector('[data-auth-tab="signup"]');
    if (signupTab) signupTab.textContent = 'CREATE ACCOUNT';
    if (!status || !overlay || !accountView) return false;

    let previousLoggedIn = !accountView.hidden;

    const routeToMainMenu = () => {
      const loggedIn = !accountView.hidden;
      const message = (status.textContent || '').trim();
      const successfulExistingLogin = loggedIn && /^welcome back\.?/i.test(message);
      const becameLoggedIn = loggedIn && !previousLoggedIn;

      if (overlay.classList.contains('open') && (successfulExistingLogin || becameLoggedIn && /welcome back/i.test(message))) {
        if (closeButton) closeButton.click();
        else {
          overlay.classList.remove('open');
          overlay.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('auth-open');
        }
        window.location.hash = 'play';
      }

      previousLoggedIn = loggedIn;
    };

    new MutationObserver(() => window.setTimeout(routeToMainMenu, 0)).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    new MutationObserver(() => window.setTimeout(routeToMainMenu, 0)).observe(accountView, {
      attributes: true,
      attributeFilter: ['hidden'],
    });

    return true;
  }

  function boot() {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts > 100) window.clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  if (window.__realPlay4v4TeamCodeBetaLoaderInstalled) return;
  window.__realPlay4v4TeamCodeBetaLoaderInstalled = true;

  let loading = false;

  function loadBeta() {
    if (window.__realPlay4v4TeamCodeBetaInstalled || loading) return;
    if ([...document.scripts].some((script) => String(script.src || '').includes('home-future-4v4-team-code-beta.js'))) return;

    loading = true;
    const script = document.createElement('script');
    const version = String(document.documentElement?.dataset?.rpDeploy || Date.now());
    script.src = `home-future-4v4-team-code-beta.js?v=${encodeURIComponent(version)}-freeze-fix-v2`;
    script.async = false;
    script.onload = () => { loading = false; };
    script.onerror = () => {
      loading = false;
      console.error('[Real Play] 4v4 team-code Beta UI failed to load.');
    };
    document.head.appendChild(script);
  }

  // The existing roadmap click handler runs on document capture and stops
  // propagation. Window capture runs first, so this safely starts the optional
  // 4v4 layer only when the player actually opens that feature.
  window.addEventListener('click', (event) => {
    if (event.target?.closest?.('.rp-home-4v4-explore')) loadBeta();
  }, true);

  // Support a view that was already opened before this loader initialized.
  if (document.querySelector('.rp-4v4-preference-panel')) loadBeta();
})();