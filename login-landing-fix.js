(() => {
  function install() {
    const status = document.querySelector('[data-auth-status]');
    const overlay = document.querySelector('[data-auth-overlay]');
    const closeButton = document.querySelector('[data-auth-close]');
    const accountView = document.querySelector('[data-auth-view="account"]');
    if (!status || !overlay || !accountView) return false;

    let previousLoggedIn = !accountView.hidden;

    const routeToMainMenu = () => {
      const loggedIn = !accountView.hidden;
      const message = (status.textContent || '').trim();
      const successfulExistingLogin = loggedIn && /welcome back\. your real play profile is ready\./i.test(message);
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