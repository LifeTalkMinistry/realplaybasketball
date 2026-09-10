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

  function openSettingsFromProfile() {
    const settingsChoice = document.querySelector('[data-rp-main-action="settings"]');
    if (!settingsChoice) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }

    const alreadyActive = settingsChoice.classList.contains('slot-active');
    settingsChoice.classList.add('slot-active');
    settingsChoice.click();
    if (!alreadyActive) {
      window.setTimeout(() => settingsChoice.classList.remove('slot-active'), 0);
    }
  }

  function ensureProfileSettingsAction() {
    const profile = document.querySelector('[data-rp-profile]');
    const actions = profile?.querySelector('.rp-profile-actions');
    if (!actions) return false;

    let button = actions.querySelector('[data-rp-simple-settings]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.rpSimpleSettings = 'true';
      button.textContent = 'SETTINGS';
      button.addEventListener('click', openSettingsFromProfile);
      actions.appendChild(button);
    }
    return true;
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
  ensureProfileSettingsAction();
  document.documentElement.classList.add('rp-legacy-bottom-nav-removed');

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-simple-nav-item]')) return;
    closePublicProfileForBottomNav();
    window.setTimeout(ensureProfileSettingsAction, 0);
    window.setTimeout(ensureProfileSettingsAction, 80);
    window.setTimeout(ensureProfileSettingsAction, 250);
  }, true);

  const observer = new MutationObserver(() => {
    removeLegacyBottomNav();
    ensureProfileSettingsAction();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('focus', ensureProfileSettingsAction);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ensureProfileSettingsAction();
  });
})();
