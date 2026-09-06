(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  const overlay = document.querySelector('[data-auth-overlay]');
  const closeButton = document.querySelector('[data-auth-close]');
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  const loginView = document.querySelector('[data-auth-view="login"]');
  const signupView = document.querySelector('[data-auth-view="signup"]');
  const completeView = document.querySelector('[data-auth-view="complete"]');
  const accountView = document.querySelector('[data-auth-view="account"]');
  const tabsWrap = document.querySelector('[data-auth-tabs]');
  const status = document.querySelector('[data-auth-status]');
  const accountName = document.querySelector('[data-auth-account-name]');
  const accountEmail = document.querySelector('[data-auth-account-email]');
  const accountNumber = document.querySelector('[data-auth-player-number]');
  const accountNumberLock = document.querySelector('[data-auth-number-lock]');
  const supportTier = document.querySelector('[data-auth-support-tier]');
  const nextNumber = document.querySelector('[data-auth-next-number]');
  const nextStatus = document.querySelector('[data-auth-next-status]');
  const notificationsWrap = document.querySelector('[data-auth-notifications-wrap]');
  const notificationsList = document.querySelector('[data-auth-notifications]');
  const numberRequestForm = document.querySelector('[data-auth-number-request-form]');
  const logoutButton = document.querySelector('[data-auth-logout]');

  if (!overlay || !loginView || !signupView || !completeView || !accountView) return;

  // Account creation is deliberately separate from player profile creation.
  signupView.innerHTML = `
    <form class="auth-form" data-auth-signup-form>
      <div class="auth-field"><label for="real-play-account-name">Account Name</label><input id="real-play-account-name" name="name" type="text" minlength="2" maxlength="100" autocomplete="name" placeholder="Your name" required /></div>
      <div class="auth-field"><label for="real-play-signup-email">Email</label><input id="real-play-signup-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
      <div class="auth-field"><label for="real-play-signup-password">Password</label><input id="real-play-signup-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required /></div>
      <div class="auth-field"><label for="real-play-signup-confirm">Confirm Password</label><input id="real-play-signup-confirm" name="confirm_password" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat your password" required /></div>
      <button class="auth-submit" type="submit">CREATE REAL PLAY ACCOUNT</button>
    </form>
    <div class="auth-divider"></div>
    <p class="auth-note">After your account is created, choose whether to claim an existing Real Play player profile or create a new one.</p>
  `;

  completeView.innerHTML = `
    <div data-profile-choice>
      <p class="auth-subtitle">Your account is ready. Now connect it to the Real Play player identity that belongs to you.</p>
      <div class="auth-profile-choice">
        <button type="button" data-profile-choice-claim>
          <strong>CLAIM AN EXISTING PLAYER PROFILE</strong>
          <span>Choose this if you already played in Real Play and a profile was created for you.</span>
        </button>
        <button type="button" data-profile-choice-create>
          <strong>CREATE A NEW PLAYER PROFILE</strong>
          <span>Choose this if you have never had a Real Play player profile before.</span>
        </button>
      </div>
      <p class="auth-choice-note">Whichever profile you attach starts as temporary ownership. Head Admin validation makes the ownership permanent.</p>
    </div>

    <div data-profile-claim-flow hidden>
      <div class="auth-profile-flow-head"><strong>CLAIM YOUR PLAYER</strong><button class="auth-profile-back" type="button" data-profile-back>← BACK</button></div>
      <div class="auth-claim-search">
        <div class="auth-field"><label for="real-play-claim-search">Search your name or Player ID</label><input id="real-play-claim-search" type="search" autocomplete="off" placeholder="Type your name" data-profile-claim-search /></div>
      </div>
      <div class="auth-claim-results" data-profile-claim-results></div>
      <p class="auth-choice-note">Only unclaimed player profiles appear here. Once you claim one, it becomes temporarily attached to your account until Head Admin validates it.</p>
    </div>

    <div data-profile-create-flow hidden>
      <div class="auth-profile-flow-head"><strong>CREATE YOUR PLAYER</strong><button class="auth-profile-back" type="button" data-profile-back>← BACK</button></div>
      <form class="auth-form" data-auth-complete-form>
        <div class="auth-field"><label for="real-play-complete-name">Player Name</label><input id="real-play-complete-name" name="player_name" type="text" minlength="2" maxlength="40" autocomplete="nickname" placeholder="Name shown on your Real Play profile" required /></div>
        <div class="auth-field"><label for="real-play-complete-number">Player Number</label><input id="real-play-complete-number" name="player_number" type="number" min="0" max="99" inputmode="numeric" placeholder="0–99" required data-player-number-input="complete" /><p class="auth-number-status" data-number-status="complete">Choose 0–99. If available, it becomes your current number.</p></div>
        <button class="auth-submit" type="submit">CREATE PLAYER PROFILE</button>
      </form>
      <p class="auth-choice-note">This profile will be temporarily owned by your account until Head Admin validation.</p>
    </div>
  `;

  const loginForm = document.querySelector('[data-auth-login-form]');
  const signupForm = document.querySelector('[data-auth-signup-form]');
  const completeForm = document.querySelector('[data-auth-complete-form]');
  const choiceWrap = completeView.querySelector('[data-profile-choice]');
  const claimFlow = completeView.querySelector('[data-profile-claim-flow]');
  const createFlow = completeView.querySelector('[data-profile-create-flow]');
  const claimSearch = completeView.querySelector('[data-profile-claim-search]');
  const claimResults = completeView.querySelector('[data-profile-claim-results]');
  const choiceClaim = completeView.querySelector('[data-profile-choice-claim]');
  const choiceCreate = completeView.querySelector('[data-profile-choice-create]');
  const backButtons = [...completeView.querySelectorAll('[data-profile-back]')];

  if (!loginForm || !signupForm || !completeForm) return;

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let currentUser = null;
  let realPlayState = null;
  let ownershipState = null;
  let claimTimer = null;
  let numberTimer = null;

  function setStatus(message = '', type = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function setBusy(target, busy, busyText = 'WORKING...') {
    const button = target instanceof HTMLFormElement ? target.querySelector('button[type="submit"]') : target;
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  function apiError(response, data) {
    const error = new Error(data?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data?.code || null;
    error.details = data?.details || null;
    return error;
  }

  async function api(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    };
    if (options.auth) {
      if (!token) throw new Error('Please log in first.');
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && options.auth) clearSession();
      throw apiError(response, data);
    }
    return data;
  }

  function saveToken(value) {
    token = String(value || '');
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function clearSession() {
    saveToken('');
    currentUser = null;
    realPlayState = null;
    ownershipState = null;
    updateNav();
  }

  function formatDate(value) {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
  }

  function formatMonth(value) {
    if (!value) return 'next month';
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return 'next month';
    return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
  }

  function hideAllViews() {
    [loginView, signupView, completeView, accountView].forEach((view) => { view.hidden = true; });
  }

  function showTabs(show) {
    if (tabsWrap) tabsWrap.hidden = !show;
  }

  function resetProfileChoice() {
    choiceWrap.hidden = false;
    claimFlow.hidden = true;
    createFlow.hidden = true;
    claimResults.innerHTML = '';
    if (claimSearch) claimSearch.value = '';
  }

  function showView(name) {
    hideAllViews();
    setStatus('');
    if (name === 'login') {
      loginView.hidden = false;
      showTabs(true);
    } else if (name === 'signup') {
      signupView.hidden = false;
      showTabs(true);
    } else if (name === 'complete') {
      completeView.hidden = false;
      showTabs(false);
      resetProfileChoice();
    } else {
      accountView.hidden = false;
      showTabs(false);
      renderAccount();
    }
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function openModal(preferredView) {
    const defaultView = token ? (realPlayState?.profile ? 'account' : 'complete') : 'login';
    showView(preferredView || defaultView);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-open');
    setTimeout(() => overlay.querySelector('.auth-view:not([hidden]) input')?.focus(), 50);
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-open');
    setStatus('');
  }

  function updateNav() {
    document.querySelectorAll('[data-auth-open]').forEach((button) => {
      if (!token) button.textContent = button.classList.contains('account-button') ? 'PLAYER' : 'LOG IN';
      else if (realPlayState?.profile) button.textContent = button.classList.contains('account-button') ? 'PLAYER' : 'MY PROFILE';
      else button.textContent = button.classList.contains('account-button') ? 'PLAYER' : 'CHOOSE PROFILE';
    });
  }

  async function loadOwnership() {
    if (!token) return null;
    try {
      const data = await api('/api/real-play/profile-ownership/me', { auth: true });
      ownershipState = data?.ownership || null;
    } catch (error) {
      console.warn('[Real Play] Ownership state unavailable.', error);
      ownershipState = null;
    }
    return ownershipState;
  }

  async function loadRealPlayState() {
    if (!token) return null;
    realPlayState = await api('/api/real-play/me', { auth: true });
    await loadOwnership();
    updateNav();
    renderAccount();
    return realPlayState;
  }

  function renderNotifications() {
    if (!notificationsWrap || !notificationsList) return;
    const notices = Array.isArray(realPlayState?.notifications) ? realPlayState.notifications : [];
    notificationsList.innerHTML = '';
    notificationsWrap.hidden = notices.length === 0;
    notices.forEach((notice) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `auth-notification${notice.read_at ? '' : ' unread'}`;
      item.dataset.notificationId = String(notice.id);
      item.innerHTML = `<strong></strong><span></span><small></small>`;
      item.querySelector('strong').textContent = notice.title || 'REAL PLAY NOTICE';
      item.querySelector('span').textContent = notice.body || '';
      item.querySelector('small').textContent = notice.created_at
        ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(notice.created_at))
        : '';
      notificationsList.appendChild(item);
    });
  }

  function renderOwnershipBadge() {
    const identity = accountView.querySelector('.auth-player-identity');
    if (!identity) return;
    accountView.querySelector('.auth-ownership-badge')?.remove();
    accountView.querySelector('.auth-ownership-player-id')?.remove();
    if (!ownershipState) return;

    const badge = document.createElement('span');
    badge.className = `auth-ownership-badge${ownershipState.ownershipStatus === 'verified' ? ' verified' : ''}`;
    badge.textContent = ownershipState.ownershipStatus === 'verified'
      ? 'VERIFIED OWNER · PERMANENT'
      : 'TEMPORARY OWNER · PENDING ADMIN VALIDATION';
    identity.insertAdjacentElement('afterend', badge);

    const id = document.createElement('span');
    id.className = 'auth-ownership-player-id';
    id.textContent = ownershipState.publicPlayerId || '';
    badge.insertAdjacentElement('afterend', id);
  }

  function renderAccount() {
    const profile = realPlayState?.profile;
    if (!profile) return;
    if (accountName) accountName.textContent = profile.player_name || 'REAL PLAY PLAYER';
    if (accountEmail) accountEmail.textContent = profile.email || currentUser?.email || '';
    const current = realPlayState?.currentNumber;
    if (accountNumber) accountNumber.textContent = current ? `#${current.number}` : '#--';
    if (accountNumberLock) accountNumberLock.textContent = current?.lockedThrough
      ? `SECURED THROUGH ${formatDate(current.lockedThrough).toUpperCase()}`
      : 'NO CURRENT NUMBER';

    if (supportTier) {
      supportTier.hidden = !realPlayState?.supportTier;
      supportTier.textContent = realPlayState?.supportTier ? `SUPPORT · ${String(realPlayState.supportTier).toUpperCase()}` : '';
    }

    const future = realPlayState?.nextMonth || {};
    const month = formatMonth(future.monthStart);
    if (future.assignment) {
      if (nextNumber) nextNumber.textContent = `#${future.assignment.number} SECURED`;
      if (nextStatus) nextStatus.textContent = `This number is reserved for you beginning ${month}.`;
    } else if (future.request) {
      if (nextNumber) nextNumber.textContent = `#${future.request.number} · ${String(future.request.status || 'REQUEST').toUpperCase()}`;
      if (nextStatus) nextStatus.textContent = `Your number request is recorded for ${month}.`;
    } else {
      if (nextNumber) nextNumber.textContent = 'No number change scheduled.';
      if (nextStatus) nextStatus.textContent = current ? 'Your current number remains protected through the end of this month.' : 'Choose a number when you are ready.';
    }
    renderOwnershipBadge();
    renderNotifications();
  }

  function validateNumber(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
  }

  async function checkNumber(input) {
    const output = completeView.querySelector('[data-number-status="complete"]');
    const n = validateNumber(input.value);
    if (!output) return;
    if (n === null) {
      output.className = 'auth-number-status';
      output.textContent = 'Choose a whole number from 0 to 99.';
      return;
    }
    output.className = 'auth-number-status checking';
    output.textContent = `Checking #${n}...`;
    try {
      const result = await api(`/api/real-play/numbers/${n}`);
      output.className = `auth-number-status ${result.available ? 'available' : 'taken'}`;
      output.textContent = result.available
        ? `#${n} IS AVAILABLE.`
        : `#${n} is already owned${result.ownerName ? ` by ${result.ownerName}` : ''} through ${formatDate(result.lockedThrough)}.`;
    } catch (_error) {
      output.className = 'auth-number-status';
      output.textContent = 'Number availability could not be checked right now.';
    }
  }

  const completeNumberInput = completeView.querySelector('[data-player-number-input="complete"]');
  completeNumberInput?.addEventListener('input', () => {
    clearTimeout(numberTimer);
    numberTimer = setTimeout(() => checkNumber(completeNumberInput), 300);
  });
  completeNumberInput?.addEventListener('blur', () => checkNumber(completeNumberInput));

  async function renderClaimResults(query = '') {
    claimResults.innerHTML = '<div class="auth-claim-empty">Searching unclaimed Real Play player profiles…</div>';
    try {
      const data = await api(`/api/real-play/profile-ownership/unclaimed?q=${encodeURIComponent(query)}`, { auth: true });
      const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
      claimResults.innerHTML = '';
      if (!profiles.length) {
        claimResults.innerHTML = '<div class="auth-claim-empty">No unclaimed profile found. Try another name, or go back and create a new player profile.</div>';
        return;
      }
      profiles.forEach((profile) => {
        const card = document.createElement('div');
        card.className = 'auth-claim-card';
        const info = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = profile.playerName || 'REAL PLAY PLAYER';
        const id = document.createElement('span');
        id.textContent = profile.publicPlayerId || `RP-${profile.playerId}`;
        const games = document.createElement('small');
        games.textContent = `${Number(profile.gamesPlayed || 0)} VERIFIED GAME${Number(profile.gamesPlayed || 0) === 1 ? '' : 'S'}`;
        info.append(name, id, games);
        const claim = document.createElement('button');
        claim.type = 'button';
        claim.textContent = 'CLAIM';
        claim.addEventListener('click', () => claimProfile(profile, claim));
        card.append(info, claim);
        claimResults.append(card);
      });
    } catch (error) {
      claimResults.innerHTML = `<div class="auth-claim-empty">${error.message || 'Could not load unclaimed profiles.'}</div>`;
    }
  }

  async function claimProfile(profile, button) {
    if (!window.confirm(`Claim ${profile.playerName} (${profile.publicPlayerId}) as your Real Play player profile?\n\nOwnership will remain temporary until Head Admin validates it.`)) return;
    setBusy(button, true, 'CLAIMING...');
    try {
      await api('/api/real-play/profile-ownership/claim', {
        method: 'POST',
        auth: true,
        body: { playerId: profile.playerId },
      });
      await loadRealPlayState();
      showView('account');
      setStatus('Profile claimed. You are the temporary owner while Head Admin validates the ownership.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
      await renderClaimResults(claimSearch?.value || '');
    } finally {
      setBusy(button, false);
    }
  }

  choiceClaim.addEventListener('click', async () => {
    choiceWrap.hidden = true;
    createFlow.hidden = true;
    claimFlow.hidden = false;
    await renderClaimResults('');
    claimSearch?.focus();
  });

  choiceCreate.addEventListener('click', () => {
    choiceWrap.hidden = true;
    claimFlow.hidden = true;
    createFlow.hidden = false;
    completeForm.querySelector('[name="player_name"]')?.focus();
  });

  backButtons.forEach((button) => button.addEventListener('click', resetProfileChoice));
  claimSearch?.addEventListener('input', () => {
    clearTimeout(claimTimer);
    claimTimer = setTimeout(() => renderClaimResults(claimSearch.value), 260);
  });

  tabs.forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.authTab)));

  document.addEventListener('click', async (event) => {
    const opener = event.target.closest('[data-auth-open]');
    if (!opener) return;
    event.preventDefault();
    if (token && !realPlayState) {
      try { await loadRealPlayState(); } catch (_error) {}
    }
    openModal();
  });

  closeButton?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    setBusy(loginForm, true);
    const form = new FormData(loginForm);
    try {
      const result = await api('/api/real-play/auth/login', {
        method: 'POST',
        body: { email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') },
      });
      saveToken(result?.token || '');
      currentUser = result?.user || null;
      await loadRealPlayState();
      loginForm.reset();
      if (realPlayState?.profile) {
        showView('account');
        setStatus('Welcome back.', 'success');
      } else {
        showView('complete');
        setStatus('Account recognized. Claim an existing player profile or create a new one.', 'success');
      }
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(loginForm, false);
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    const form = new FormData(signupForm);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm_password') || '');
    if (name.length < 2) return setStatus('Enter your name.', 'error');
    if (password.length < 8) return setStatus('Password must be at least 8 characters.', 'error');
    if (password !== confirm) return setStatus('Passwords do not match.', 'error');
    setBusy(signupForm, true);
    try {
      const result = await api('/api/real-play/auth/register', { method: 'POST', body: { name, email, password } });
      saveToken(result?.token || '');
      currentUser = result?.user || null;
      realPlayState = await api('/api/real-play/me', { auth: true });
      await loadOwnership();
      signupForm.reset();
      updateNav();
      showView('complete');
      setStatus('Account created. Now claim your existing player profile or create a new one.', 'success');
    } catch (error) {
      setStatus(error.code === 'EMAIL_ALREADY_REGISTERED' ? 'That email already has a Real Play account. Use LOG IN instead.' : error.message, 'error');
    } finally {
      setBusy(signupForm, false);
    }
  });

  completeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(completeForm);
    const playerName = String(form.get('player_name') || '').trim();
    const playerNumber = validateNumber(form.get('player_number'));
    if (playerName.length < 2 || playerName.length > 40) return setStatus('Player name must be between 2 and 40 characters.', 'error');
    if (playerNumber === null) return setStatus('Choose a player number from 0 to 99.', 'error');
    setBusy(completeForm, true);
    try {
      await api('/api/real-play/profile', { method: 'POST', auth: true, body: { playerName, playerNumber } });
      await loadRealPlayState();
      completeForm.reset();
      showView('account');
      setStatus('Player profile created. Ownership is temporary until Head Admin validates it.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(completeForm, false);
    }
  });

  numberRequestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(numberRequestForm);
    const n = validateNumber(form.get('player_number'));
    if (n === null) return setStatus('Choose a player number from 0 to 99.', 'error');
    setBusy(numberRequestForm, true);
    try {
      const result = await api(`/api/real-play/numbers/${n}/request`, { method: 'POST', auth: true });
      await loadRealPlayState();
      numberRequestForm.reset();
      setStatus(result.message || 'Your number request has been updated.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(numberRequestForm, false);
    }
  });

  notificationsList?.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification-id]');
    if (!item || !item.classList.contains('unread')) return;
    try {
      await api(`/api/real-play/notifications/${item.dataset.notificationId}/read`, { method: 'POST', auth: true });
      item.classList.remove('unread');
    } catch (_error) {}
  });

  logoutButton?.addEventListener('click', () => {
    clearSession();
    showView('login');
    setStatus('You are logged out.', 'success');
  });

  window.__realPlayOpenAuth = openModal;

  (async () => {
    updateNav();
    if (!token) return;
    try { await loadRealPlayState(); } catch (error) { console.error('Real Play session could not be restored:', error); }
  })();
})();
