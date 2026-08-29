(() => {
  if (window.__realPlayAdminManualOpenInstalled) return;
  window.__realPlayAdminManualOpenInstalled = true;

  let userRequestedOpen = false;

  function cleanAdminQuery() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('admin')) return;
      url.searchParams.delete('admin');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', next);
    } catch (_error) {
      // Keep the app usable if URL cleanup is unavailable.
    }
  }

  function closeUnauthorizedAutoOpen() {
    const root = document.querySelector('.rp-admin-control');
    if (!root?.classList.contains('open') || userRequestedOpen) return;

    const exit = root.querySelector('[data-admin-exit]');
    if (exit) {
      exit.click();
    } else {
      root.classList.remove('open');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-admin-open');
      document.querySelector('.rp-admin-launcher')?.classList.add('visible');
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.rp-admin-launcher')) {
      userRequestedOpen = true;
      return;
    }
    if (event.target.closest('[data-admin-exit]')) {
      userRequestedOpen = false;
    }
  }, true);

  const observer = new MutationObserver(() => {
    closeUnauthorizedAutoOpen();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  cleanAdminQuery();
  closeUnauthorizedAutoOpen();
  window.setTimeout(closeUnauthorizedAutoOpen, 100);
  window.setTimeout(closeUnauthorizedAutoOpen, 500);
})();
