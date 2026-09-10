(() => {
  if (window.__realPlayLegacyBottomNavRemovalInstalled) return;
  window.__realPlayLegacyBottomNavRemovalInstalled = true;

  function removeLegacyBottomNav(root = document) {
    root.querySelectorAll?.('.rp-bottom-nav,[data-rp-bottom-nav]').forEach((node) => node.remove());
  }

  function installProfileNavStyle() {
    if (document.querySelector('[data-rp-public-profile-nav-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPublicProfileNavStyle = 'true';
    style.textContent = `
      body.rp-simple-navigation-active [data-rp-public-profile] .rp-profile-topbar{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function closePublicProfileForBottomNav() {
    const profile = document.querySelector('[data-rp-public-profile].open');
    if (!profile) return;

    const closeButton = profile.querySelector('[data-rp-public-profile-close]');
    if (closeButton) {
      closeButton.click();
      return;
    }

    profile.classList.remove('open');
    profile.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('[data-rp-profile].open')) {
      document.body.classList.remove('rp-profile-open');
    }
  }

  removeLegacyBottomNav();
  installProfileNavStyle();
  document.documentElement.classList.add('rp-legacy-bottom-nav-removed');

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-simple-nav-item]')) return;
    closePublicProfileForBottomNav();
  }, true);

  const app = document.querySelector('[data-rp-app]');
  if (!app) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.rp-bottom-nav,[data-rp-bottom-nav]')) node.remove();
        else removeLegacyBottomNav(node);
      }
    }
  });

  observer.observe(app, { childList: true, subtree: true });
})();
