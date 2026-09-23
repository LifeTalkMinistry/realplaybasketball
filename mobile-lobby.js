(() => {
  if (document.querySelector('[data-rp-app]')) return;

  const body = document.body;
  body.classList.add('rp-lobby-active');

  const app = document.createElement('div');
  app.className = 'rp-app';
  app.dataset.rpApp = 'true';
  app.innerHTML = `
    <section class="rp-entry" data-rp-entry aria-label="Real Play player access">
      <div class="rp-entry-glow" aria-hidden="true"></div>
      <div class="rp-entry-brand">
        <div class="rp-entry-mark">RP</div>
        <p>REAL PLAY BASKETBALL</p>
      </div>
      <div class="rp-entry-hero">
        <div class="rp-entry-ball" aria-hidden="true"></div>
        <p class="rp-entry-kicker">REAL-WORLD BASKETBALL CAREER</p>
        <h1>LESS SCREEN.<br><span>REAL POINTS.</span></h1>
        <div class="rp-entry-copy" aria-label="Real Play features">
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">◉</span><strong>REAL COURTS.</strong></div>
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">⌁</span><strong>REAL GAMES.</strong></div>
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">♕</span><strong>REAL HISTORY.</strong></div>
        </div>
      </div>
      <div class="rp-entry-actions">
        <button class="rp-entry-primary" type="button" data-rp-entry-login>LOG IN</button>
        <button class="rp-entry-secondary" type="button" data-rp-entry-create>CREATE PLAYER</button>
      </div>
      <p class="rp-entry-foot">THE GAME HAPPENS ON THE COURT.<br>THE SYSTEM RECORDS IT.</p>
    </section>

    <div class="rp-app-inner" data-rp-lobby>
      <header class="rp-topbar">
        <div class="rp-brandmark" aria-hidden="true">RP</div>
        <div class="rp-brandcopy"><strong>REAL PLAY</strong></div>
        <button class="rp-profile-chip" type="button" data-rp-profile aria-label="Open my Real Play profile">●</button>
      </header>

      <section class="rp-player-strip" aria-label="Player identity">
        <div class="rp-player-id">
          <div class="rp-player-number" data-rp-number>#--</div>
          <div class="rp-player-name"><strong data-rp-name>YOUR PLAYER</strong><span data-rp-player-label>REAL PLAY PLAYER</span></div>
        </div>
        <div class="rp-player-rating"><strong data-rp-ovr>UNRANKED</strong><span data-rp-rating-label>COMPLETE PLACEMENT</span></div>
      </section>
    </div>
  `;

  body.insertBefore(app, body.firstChild);

  const authOpen = document.querySelector('[data-auth-open]');
  const accountView = document.querySelector('[data-auth-view="account"]');
  const authName = document.querySelector('[data-auth-account-name]');
  const authNumber = document.querySelector('[data-auth-player-number]');
  const profileChip = app.querySelector('[data-rp-profile]');
  const playerName = app.querySelector('[data-rp-name]');
  const playerNumber = app.querySelector('[data-rp-number]');
  const playerOvr = app.querySelector('[data-rp-ovr]');
  const playerLabel = app.querySelector('[data-rp-player-label]');
  const ratingLabel = app.querySelector('[data-rp-rating-label]');
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const API_BASE_URL = 'https://api.clarapmc.com';

  const hasToken = () => Boolean(window.localStorage.getItem(TOKEN_KEY));
  const isLoggedIn = () => hasToken() || Boolean(accountView && !accountView.hidden);
  const isVisitor = () => !isLoggedIn() && window.localStorage.getItem(VISITOR_KEY) === '1';

  function applyIdentity(name, number) {
    const cleanName = String(name || '').trim();
    const rawNumber = number === 0 ? '0' : String(number || '').trim().replace(/^#/, '');
    if (cleanName) playerName.textContent = cleanName.toUpperCase();
    if (rawNumber && rawNumber !== '--') playerNumber.textContent = `#${rawNumber}`;
  }

  async function refreshPlayerIdentity() {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const state = await response.json();
      const profile = state?.profile || {};
      const currentNumber = state?.currentNumber?.number ?? profile.player_number ?? profile.playerNumber ?? profile.number;
      applyIdentity(profile.player_name || profile.playerName || profile.name, currentNumber);
    } catch (_error) {
      // Keep the lobby usable if identity refresh is temporarily unavailable.
    }
  }

  function syncPlayer() {
    const loggedIn = isLoggedIn();
    const visitor = !loggedIn && isVisitor();
    const insideApp = loggedIn || visitor;

    if (loggedIn) window.localStorage.removeItem(VISITOR_KEY);
    app.classList.toggle('rp-authenticated', loggedIn);
    app.classList.toggle('rp-visitor', visitor);
    app.classList.toggle('rp-guest', !insideApp);
    body.classList.toggle('rp-guest-active', !insideApp);
    body.classList.toggle('rp-visitor-active', visitor);

    if (visitor) {
      playerName.textContent = 'VISITOR';
      playerNumber.textContent = '#--';
      if (playerOvr) playerOvr.textContent = 'BROWSE';
      if (playerLabel) playerLabel.textContent = 'READ-ONLY ACCESS';
      if (ratingLabel) ratingLabel.textContent = 'CREATE A PLAYER TO COMPETE';
      return;
    }
    if (!loggedIn) return;

    if (playerLabel) playerLabel.textContent = 'REAL PLAY PLAYER';
    if (ratingLabel) ratingLabel.textContent = 'COMPLETE PLACEMENT';
    const name = (authName?.textContent || '').trim();
    const number = (authNumber?.textContent || '').trim();
    if (name && name !== 'REAL PLAY PLAYER') playerName.textContent = name.toUpperCase();
    if (number && number !== '#--') playerNumber.textContent = number;
    refreshPlayerIdentity();
  }

  function openAuth(view) {
    if (!authOpen) return;
    authOpen.click();
    if (!view) return;
    window.setTimeout(() => {
      const tab = document.querySelector(`[data-auth-tab="${view}"]`);
      if (tab) tab.click();
    }, 20);
  }

  function requireAccount(reason = 'Create your Real Play player to use this feature.') {
    if (!isVisitor()) return false;
    if (window.RealPlayVisitor?.requireAccount) {
      window.RealPlayVisitor.requireAccount({ copy: reason });
    } else {
      openAuth('signup');
    }
    return true;
  }

  function openProfile() {
    if (requireAccount('Create your Real Play player to unlock your own profile, stats and history.')) return;
    openAuth();
  }

  app.querySelector('[data-rp-entry-login]')?.addEventListener('click', () => openAuth('login'));
  app.querySelector('[data-rp-entry-create]')?.addEventListener('click', () => openAuth('signup'));
  profileChip?.addEventListener('click', openProfile);

  syncPlayer();
  if (accountView) {
    const observer = new MutationObserver(syncPlayer);
    observer.observe(accountView, { attributes: true, attributeFilter: ['hidden'] });
  }
  [authName, authNumber].forEach((node) => {
    if (!node) return;
    const observer = new MutationObserver(syncPlayer);
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  });
  window.addEventListener('focus', () => { syncPlayer(); refreshPlayerIdentity(); });
  window.addEventListener('storage', syncPlayer);
  window.addEventListener('realplay:visitorchange', syncPlayer);
})();