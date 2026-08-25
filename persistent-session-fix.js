(() => {
  const TOKEN_KEY = 'real_play_access_token';

  function syncPersistentSession() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return;

    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    const authenticated = Boolean(token);
    const bottomNav = app.querySelector('[data-rp-bottom-nav]');
    const accountName = document.querySelector('[data-auth-account-name]');
    const accountNumber = document.querySelector('[data-auth-player-number]');
    const playerName = app.querySelector('[data-rp-name]');
    const playerNumber = app.querySelector('[data-rp-number]');

    app.classList.toggle('rp-authenticated', authenticated);
    app.classList.toggle('rp-guest', !authenticated);
    document.body.classList.toggle('rp-guest-active', !authenticated);

    if (bottomNav) bottomNav.style.display = authenticated ? 'grid' : 'none';

    if (authenticated) {
      const name = (accountName?.textContent || '').trim();
      const number = (accountNumber?.textContent || '').trim();
      if (playerName && name) playerName.textContent = name.toUpperCase();
      if (playerNumber && number) playerNumber.textContent = number;
    }
  }

  function start() {
    syncPersistentSession();

    const accountView = document.querySelector('[data-auth-view="account"]');
    const accountName = document.querySelector('[data-auth-account-name]');
    const accountNumber = document.querySelector('[data-auth-player-number]');
    const authOpen = document.querySelector('[data-auth-open]');

    const observer = new MutationObserver(syncPersistentSession);
    if (accountView) observer.observe(accountView, { attributes: true, attributeFilter: ['hidden'] });
    [accountName, accountNumber, authOpen].forEach((node) => {
      if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
    });

    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_KEY) syncPersistentSession();
    });

    document.addEventListener('click', () => window.setTimeout(syncPersistentSession, 0), true);
    window.addEventListener('pageshow', syncPersistentSession);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();