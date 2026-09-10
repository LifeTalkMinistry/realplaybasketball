(() => {
  if (window.__realPlaySimpleNavigationInstalled) return;
  window.__realPlaySimpleNavigationInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const NAV_ITEMS = [
    { id: 'home', label: 'HOME', icon: '⌂' },
    { id: 'world', label: 'WORLD', icon: '◎' },
    { id: 'players', label: 'PLAYERS', icon: '▥' },
    { id: 'chats', label: 'CHATS', icon: '◌' },
    { id: 'me', label: 'ME', icon: '●' },
  ];

  let active = 'home';
  let homeRefreshTimer = null;
  let installed = false;

  const hasAccount = () => Boolean(localStorage.getItem(TOKEN_KEY));
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function formatEvent(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function ensurePublicEntry() {
    if (hasAccount()) return;
    if (window.RealPlayVisitor?.isActive?.()) return;
    window.RealPlayVisitor?.enter?.();
  }

  function menu() {
    return document.querySelector('[data-rp-main-menu]');
  }

  function simpleHome() {
    return document.querySelector('[data-rp-simple-home]');
  }

  function nav() {
    return document.querySelector('[data-rp-simple-nav]');
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
    refreshHome();
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
    const legacy = document.querySelector('[data-rp-main-action="settings"]');
    if (!legacy) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    const alreadyActive = legacy.classList.contains('slot-active');
    legacy.classList.add('slot-active');
    legacy.click();
    if (!alreadyActive) window.setTimeout(() => legacy.classList.remove('slot-active'), 0);
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
    section.innerHTML = `
      <header class="rp-simple-home-head">
        <div><small>REAL PLAY BASKETBALL</small><h1>HOME</h1></div>
        <span data-rp-simple-access>PUBLIC</span>
      </header>
      <section class="rp-simple-next" data-rp-simple-next>
        <small>NEXT REAL PLAY</small>
        <h2>CHECKING THE COURT...</h2>
        <p>Official schedules will appear here.</p>
      </section>
      <section class="rp-simple-home-grid">
        <article data-rp-simple-announcement>
          <small>ANNOUNCEMENT</small>
          <strong>REAL PLAY IS LIVE.</strong>
          <p>Official community announcements will appear here.</p>
        </article>
        <article data-rp-simple-result>
          <small>LATEST RESULT</small>
          <strong>NO RESULT YET.</strong>
          <p>Finalized games will appear here.</p>
        </article>
      </section>
      <button class="rp-simple-home-updates" type="button" data-rp-simple-updates>
        <span><small>OFFICIAL FEED</small><strong>SCHEDULES · RESULTS · ANNOUNCEMENTS</strong></span><b>→</b>
      </button>`;
    root.appendChild(section);
    section.querySelector('[data-rp-simple-next]')?.addEventListener('click', () => {
      setActive('home');
      window.RealPlayUpdates?.open?.();
    });
    section.querySelector('[data-rp-simple-updates]')?.addEventListener('click', () => {
      setActive('home');
      window.RealPlayUpdates?.open?.();
    });
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

  function resultLabel(update) {
    const west = Number(update?.metadata?.westScore);
    const east = Number(update?.metadata?.eastScore);
    if (Number.isFinite(west) && Number.isFinite(east)) return `WEST ${west} · ${east} EAST`;
    return String(update?.title || 'FINAL RESULT').trim();
  }

  async function refreshHome() {
    const root = simpleHome();
    if (!root) return;
    const access = root.querySelector('[data-rp-simple-access]');
    if (access) access.textContent = hasAccount() ? 'PLAYER' : 'PUBLIC';

    try {
      const response = await fetch(PUBLIC_UPDATES_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load public updates.');
      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const now = Date.now();
      const schedules = updates
        .filter((item) => item?.category === 'schedule')
        .map((item) => ({ item, time: Date.parse(item.event_at || item.eventAt || '') }))
        .filter((entry) => Number.isFinite(entry.time) && entry.time >= now - 60_000)
        .sort((a, b) => a.time - b.time);
      const next = schedules[0]?.item || null;
      const announcement = updates.find((item) => item?.category === 'announcement' && item?.pinned)
        || updates.find((item) => item?.category === 'announcement')
        || null;
      const result = updates.find((item) => item?.category === 'result') || null;

      const nextNode = root.querySelector('[data-rp-simple-next]');
      if (nextNode) {
        const when = formatEvent(next?.event_at || next?.eventAt);
        const location = String(next?.location_name || next?.locationName || '').trim();
        nextNode.innerHTML = next
          ? `<small>NEXT REAL PLAY</small><h2>${esc(next.title || 'OFFICIAL SESSION')}</h2><p>${esc([when, location].filter(Boolean).join(' · ') || 'Open the official feed for details.')}</p>`
          : '<small>NEXT REAL PLAY</small><h2>TO BE ANNOUNCED.</h2><p>The next official schedule will appear here as soon as it is published.</p>';
      }

      const announcementNode = root.querySelector('[data-rp-simple-announcement]');
      if (announcementNode) {
        announcementNode.innerHTML = announcement
          ? `<small>${announcement.pinned ? 'PINNED ANNOUNCEMENT' : 'ANNOUNCEMENT'}</small><strong>${esc(announcement.title || 'REAL PLAY UPDATE')}</strong><p>${esc(announcement.body || 'Open the official feed for the full update.')}</p>`
          : '<small>ANNOUNCEMENT</small><strong>NO NEW ANNOUNCEMENT.</strong><p>Official community announcements will appear here.</p>';
      }

      const resultNode = root.querySelector('[data-rp-simple-result]');
      if (resultNode) {
        resultNode.innerHTML = result
          ? `<small>LATEST RESULT</small><strong>${esc(resultLabel(result))}</strong><p>${esc(result.title || 'Official game result')}</p>`
          : '<small>LATEST RESULT</small><strong>NO RESULT YET.</strong><p>Finalized Real Play games will appear here.</p>';
      }
    } catch (_error) {
      const nextNode = root.querySelector('[data-rp-simple-next]');
      if (nextNode) nextNode.innerHTML = '<small>NEXT REAL PLAY</small><h2>HOME IS READY.</h2><p>Open the official feed to check schedules and announcements.</p>';
    }
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
    refreshHome();
    homeRefreshTimer = window.setInterval(() => {
      if (!document.hidden && active === 'home') refreshHome();
    }, 60_000);

    const profileObserver = new MutationObserver(() => {
      ensureProfileSettingsButton();
      if (active === 'me') syncMeHeader();
    });
    profileObserver.observe(document.body, { childList: true, subtree: true });
    ensureProfileSettingsButton();

    document.addEventListener('click', syncLayerClose, true);
    window.addEventListener('focus', () => {
      ensurePublicEntry();
      if (active === 'home') refreshHome();
      if (active === 'me') syncMeHeader();
      ensureProfileSettingsButton();
    });
    window.addEventListener('storage', () => {
      ensurePublicEntry();
      refreshHome();
    });
    window.addEventListener('realplay:visitorchange', refreshHome);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && active === 'home') refreshHome();
    });
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    if (homeRefreshTimer) window.clearInterval(homeRefreshTimer);
  });

  window.RealPlaySimpleNavigation = {
    home: openHome,
    world: () => openWorldTab('world'),
    players: () => openWorldTab('players'),
    chats: () => openWorldTab('chats'),
    me: openMe,
    refreshHome,
  };
})();