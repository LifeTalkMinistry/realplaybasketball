(() => {
  if (window.__realPlayLegacyBottomNavRemovalInstalled) return;
  window.__realPlayLegacyBottomNavRemovalInstalled = true;

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

  installProfileNavStyle();
  document.documentElement.classList.add('rp-legacy-bottom-nav-removed');

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-simple-nav-item]')) return;
    closePublicProfileForBottomNav();
  }, true);
})();