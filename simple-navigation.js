(() => {
  if (window.__realPlaySimpleNavigationInstalled) return;
  window.__realPlaySimpleNavigationInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const NAV_ITEMS = [
    { id: 'home', label: 'HOME', icon: '⌂' },
    { id: 'world', label: 'WORLD', icon: '◎' },
    { id: 'players', label: 'PLAYERS', icon: '▥' },
    { id: 'chats', label: 'CHATS', icon: '◌' },
    { id: 'me', label: 'ME', icon: '●' },
  ];

  let active = 'home';
  let installed = false;

  const hasAccount = () => Boolean(localStorage.getItem(TOKEN_KEY));

  function ensurePublicEntry() {
    if (hasAccount()) return;
    if (window.RealPlayVisitor?.isActive?.()) return;
    window.RealPlayVisitor?.enter?.();
  }

  function menu() {
    return document.querySelector('[data-rp-main-menu]');
  }

  function nav() {
    return document.querySelector('[data-rp-simple-nav]');
  }

  function requestHomeRefresh() {
    try {
      window.dispatchEvent(new CustomEvent('realplay:home-schedule-changed'));
    } catch (_error) {}
  }

  function setActive(next) {
    active = NAV_ITEMS.some((item) => item.id === next) ? next : 'home';
    nav()?.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function releaseLayerFocus(selector) {
    const layer = document.querySelector(selector);
    const focused = document.activeElement;
    if (!layer || !focused || !layer.contains(focused)) return;
    try { focused.blur?.(); } catch (_error) {}
    try { nav()?.querySelector(`[data-rp-simple-nav-item="${active}"]`)?.focus({ preventScroll: true }); } catch (_error) {}
  }

  function closeLayer(layer) {
    try {
      if (layer === 'world') {
        releaseLayerFocus('[data-rp-world]');
        window.RealPlayWorld?.close?.();
      }
      if (layer === 'profile') {
        releaseLayerFocus('[data-rp-profile]');
        window.RealPlayProfile?.close?.();
      }
      if (layer === 'updates') {
        releaseLayerFocus('[data-rp-updates]');
        window.RealPlayUpdates?.close?.();
      }
    } catch (_error) {
      // Navigation should stay usable even if an optional layer is unavailable.
    }
  }

  function closePrimaryLayers(except = '') {
    if (except !== 'world') closeLayer('world');
    if (except !== 'profile') closeLayer('profile');
    if (except !== 'updates') closeLayer('updates');
  }

  function updateWorldTitle(tab) {
    const strong = document.querySelector('[data-rp-world] .rp-world-title strong');
    const badge = document.querySelector('[data-rp-world] .rp-world-online');
    if (strong) strong.textContent = tab === 'players' ? 'PLAYERS' : tab === 'chats' ? 'CHATS' : 'WORLD';
    if (badge) badge.textContent = tab === 'chats' && !hasAccount() ? 'READ ONLY' : 'COMMUNITY';
  }

  function forcePlayersView(panel) {
    const playerView = panel?.querySelector('[data-world-view="players"]');
    if (!playerView) return false;

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.worldTab === 'players');
    });
    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== 'players';
    });
    window.RealPlayPlayers?.refresh?.();
    updateWorldTitle('players');
    return true;
  }

  function activateWorldTab(tab, attempt = 0) {
    const panel = document.querySelector('[data-rp-world]');
    if (!panel) {
      if (attempt < 14) window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
      return;
    }

    if (tab === 'players') {
      if (!forcePlayersView(panel) && attempt < 14) {
        window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
      }
      return;
    }

    const trigger = panel.querySelector(`[data-world-tab="${tab}"]`);
    if (trigger) {
      trigger.click();
      updateWorldTitle(tab);
      return;
    }
    if (attempt < 14) window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
  }

  function openWorldTab(tab) {
    closePrimaryLayers('world');
    if (window.RealPlayWorld?.open) window.RealPlayWorld.open();
    else document.querySelector('[data-rp-main-action="world"]')?.click();
    setActive(tab === 'players' ? 'players' : tab === 'chats' ? 'chats' : 'world');
    window.setTimeout(() => activateWorldTab(tab), 30);
  }

  function openHome() {
    closePrimaryLayers();
    document.body.classList.remove('rp-simple-subview');
    setActive('home');
    requestHomeRefresh();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function requireAccount(copy) {
    if (hasAccount()) return true;
    if (window.RealPlayVisitor?.requireAccount) {
      window.RealPlayVisitor.requireAccount({
        title: 'CREATE YOUR REAL PLAY PLAYER',
        copy: copy || 'Create your Real Play player when you are ready to participate.',
      });
    } else {
      window.RealPlayVisitor?.openAuth?.('signup');
      document.querySelector('[data-auth-open]')?.click();
    }
    return false;
  }

  function syncMeHeader() {
    const profile = document.querySelector('[data-rp-profile]');
    const title = profile?.querySelector('.rp-profile-topbar strong');
    if (title) title.textContent = 'ME';
  }

  function openMe() {
    if (!requireAccount('Create your player to unlock your own OVR, stats, game history, membership and settings.')) return;
    closePrimaryLayers('profile');
    setActive('me');
    window.RealPlayProfile?.open?.();
    window.setTimeout(() => {
      syncMeHeader();
      ensureProfileSettingsButton();
    }, 50);
  }

  function openSettingsFromMe() {
    if (window.RealPlaySettings?.open) {
      window.RealPlaySettings.open();
      return;
    }
    document.querySelector('[data-auth-open]')?.click();
  }

  function ensureProfileSettingsButton() {
    const profile = document.querySelector('[data-rp-profile]');
    const actions = profile?.querySelector('.rp-profile-actions');
    if (!actions || actions.querySelector('[data-rp-simple-settings]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rpSimpleSettings = 'true';
    button.textContent = 'SETTINGS';
    button.addEventListener('click', openSettingsFromMe);
    actions.appendChild(button);
  }

  function installHome() {
    const root = menu();
    if (!root || root.querySelector('[data-rp-simple-home]')) return Boolean(root);
    root.classList.add('rp-simple-menu');
    const section = document.createElement('section');
    section.className = 'rp-simple-home';
    section.dataset.rpSimpleHome = 'true';
    root.appendChild(section);
    return true;
  }

  function installNav() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return false;
    if (nav()) return true;
    const bar = document.createElement('nav');
    bar.className = 'rp-simple-nav';
    bar.dataset.rpSimpleNav = 'true';
    bar.setAttribute('aria-label', 'Real Play primary navigation');
    bar.innerHTML = NAV_ITEMS.map((item) => `
      <button type="button" class="rp-simple-nav-item${item.id === 'home' ? ' active' : ''}" data-rp-simple-nav-item="${item.id}" aria-current="${item.id === 'home' ? 'page' : 'false'}">
        <span aria-hidden="true">${item.icon}</span><small>${item.label}</small>
      </button>`).join('');
    app.appendChild(bar);
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-rp-simple-nav-item]');
      if (!button) return;
      const target = button.dataset.rpSimpleNavItem;
      if (target === 'home') openHome();
      else if (target === 'world') openWorldTab('world');
      else if (target === 'players') openWorldTab('players');
      else if (target === 'chats') openWorldTab('chats');
      else if (target === 'me') openMe();
    });
    return true;
  }

  function syncLayerClose(event) {
    if (event.target.closest('[data-world-close], [data-rp-profile-close]')) {
      window.setTimeout(() => setActive('home'), 0);
      return;
    }
    if (event.target.closest('[data-updates-close]')) {
      window.setTimeout(() => setActive('home'), 0);
    }
  }

  function install() {
    if (installed) return true;
    if (!document.querySelector('[data-rp-app]') || !menu()) return false;
    ensurePublicEntry();
    if (!installHome() || !installNav()) return false;
    installed = true;
    document.body.classList.add('rp-simple-navigation-active');
    setActive('home');

    const profileObserver = new MutationObserver(() => {
      ensureProfileSettingsButton();
      if (active === 'me') syncMeHeader();
    });
    profileObserver.observe(document.body, { childList: true, subtree: true });
    ensureProfileSettingsButton();

    document.addEventListener('click', syncLayerClose, true);
    window.addEventListener('focus', () => {
      ensurePublicEntry();
      if (active === 'me') syncMeHeader();
      ensureProfileSettingsButton();
    });
    window.addEventListener('storage', ensurePublicEntry);
    window.addEventListener('realplay:visitorchange', ensurePublicEntry);
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RealPlaySimpleNavigation = {
    home: openHome,
    world: () => openWorldTab('world'),
    players: () => openWorldTab('players'),
    chats: () => openWorldTab('chats'),
    me: openMe,
    refreshHome: requestHomeRefresh,
  };
})();