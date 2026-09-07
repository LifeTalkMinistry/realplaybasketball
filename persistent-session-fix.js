(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

  function syncPersistentSession() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return;

    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    const authenticated = Boolean(token);
    const visitor = !authenticated && window.localStorage.getItem(VISITOR_KEY) === '1';
    const insideApp = authenticated || visitor;
    const bottomNav = app.querySelector('[data-rp-bottom-nav]');
    const accountName = document.querySelector('[data-auth-account-name]');
    const accountNumber = document.querySelector('[data-auth-player-number]');
    const playerName = app.querySelector('[data-rp-name]');
    const playerNumber = app.querySelector('[data-rp-number]');
    const playerOvr = app.querySelector('[data-rp-ovr]');

    if (authenticated) window.localStorage.removeItem(VISITOR_KEY);
    app.classList.toggle('rp-authenticated', authenticated);
    app.classList.toggle('rp-visitor', visitor);
    app.classList.toggle('rp-guest', !insideApp);
    document.body.classList.toggle('rp-guest-active', !insideApp);
    document.body.classList.toggle('rp-visitor-active', visitor);

    if (bottomNav) bottomNav.style.display = insideApp ? 'grid' : 'none';

    if (visitor) {
      if (playerName) playerName.textContent = 'VISITOR';
      if (playerNumber) playerNumber.textContent = '#--';
      if (playerOvr) playerOvr.textContent = 'BROWSE';
      return;
    }

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
      if (event.key === TOKEN_KEY || event.key === VISITOR_KEY) syncPersistentSession();
    });
    window.addEventListener('realplay:visitorchange', syncPersistentSession);

    document.addEventListener('click', () => window.setTimeout(syncPersistentSession, 0), true);
    window.addEventListener('pageshow', syncPersistentSession);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();