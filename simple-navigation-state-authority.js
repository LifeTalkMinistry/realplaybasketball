(() => {
  if (window.__realPlaySimpleNavigationStateAuthorityInstalled) return;
  window.__realPlaySimpleNavigationStateAuthorityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  let enforcing = false;

  function activeRoute() {
    const selected = document.querySelector('[data-rp-simple-nav-item][aria-current="page"]')
      || document.querySelector('[data-rp-simple-nav-item].active');
    return String(selected?.dataset?.rpSimpleNavItem || '');
  }

  function enforcePlayersView() {
    if (activeRoute() !== 'players') return;

    const panel = document.querySelector('[data-rp-world]');
    const playersView = panel?.querySelector('[data-world-view="players"]');
    if (!panel || !playersView) return;

    const title = panel.querySelector('.rp-world-title strong');
    if (title && title.textContent !== 'PLAYERS') title.textContent = 'PLAYERS';

    const badge = panel.querySelector('.rp-world-online');
    if (badge && badge.textContent !== 'COMMUNITY') badge.textContent = 'COMMUNITY';

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      const shouldBeActive = button.dataset.worldTab === 'players';
      if (button.classList.contains('active') !== shouldBeActive) {
        button.classList.toggle('active', shouldBeActive);
      }
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      const shouldBeHidden = view.dataset.worldView !== 'players';
      if (view.hidden !== shouldBeHidden) view.hidden = shouldBeHidden;
    });
  }

  function enforceChatsView() {
    if (activeRoute() !== 'chats') return;

    const panel = document.querySelector('[data-rp-world]');
    const chatsView = panel?.querySelector('[data-world-view="chats"]');
    if (!panel || !chatsView) return;

    const title = panel.querySelector('.rp-world-title strong');
    if (title && title.textContent !== 'CHATS') title.textContent = 'CHATS';

    const badge = panel.querySelector('.rp-world-online');
    const expectedBadge = localStorage.getItem(TOKEN_KEY) ? 'COMMUNITY' : 'READ ONLY';
    if (badge && badge.textContent !== expectedBadge) badge.textContent = expectedBadge;

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      const shouldBeActive = button.dataset.worldTab === 'chats';
      if (button.classList.contains('active') !== shouldBeActive) {
        button.classList.toggle('active', shouldBeActive);
      }
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      const shouldBeHidden = view.dataset.worldView !== 'chats';
      if (view.hidden !== shouldBeHidden) view.hidden = shouldBeHidden;
    });
  }

  function enforce() {
    if (enforcing) return;
    enforcing = true;
    try {
      enforcePlayersView();
      enforceChatsView();
    } finally {
      enforcing = false;
    }
  }

  const observer = new MutationObserver(() => enforce());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class', 'aria-current', 'aria-hidden'],
  });

  document.addEventListener('click', () => queueMicrotask(enforce), true);
  window.addEventListener('focus', enforce);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) enforce();
  });

  enforce();
})();