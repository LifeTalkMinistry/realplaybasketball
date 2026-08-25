(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  const overlay = document.querySelector('[data-auth-overlay]');
  const navLink = document.querySelector('[data-auth-open]');
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
  const loginForm = document.querySelector('[data-auth-login-form]');
  const signupForm = document.querySelector('[data-auth-signup-form]');
  const completeForm = document.querySelector('[data-auth-complete-form]');
  const numberRequestForm = document.querySelector('[data-auth-number-request-form]');
  const logoutButton = document.querySelector('[data-auth-logout]');
  const numberInputs = [...document.querySelectorAll('[data-player-number-input]')];

  if (!overlay || !navLink || !loginForm || !signupForm || !completeForm || !accountView) {
    return;
  }

  let token = window.localStorage.getItem(TOKEN_KEY) || '';
  let currentUser = null;
  let realPlayState = null;
  const numberCheckTimers = new Map();

  function setStatus(message = '', type = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function setBusy(formOrButton, busy) {
    const submit = formOrButton instanceof HTMLFormElement
      ? formOrButton.querySelector('button[type="submit"]')
      : formOrButton;
    if (!submit) return;

    submit.disabled = busy;
    if (busy) {
      submit.dataset.originalText = submit.textContent;
      submit.textContent = 'WORKING...';
    } else if (submit.dataset.originalText) {
      submit.textContent = submit.dataset.originalText;
      delete submit.dataset.originalText;
    }
  }

  function makeApiError(response, data) {
    const error = new Error(data?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data?.code || null;
    error.details = data?.details || null;
    return error;
  }

  async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    };

    if (options.auth) {
      if (!token) {
        const authError = new Error('Please log in first.');
        authError.status = 401;
        throw authError;
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 && options.auth) clearSession();
      throw makeApiError(response, data);
    }

    return data;
  }

  function saveToken(nextToken) {
    token = String(nextToken || '');
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }

  function clearSession() {
    saveToken('');
    currentUser = null;
    realPlayState = null;
    updateNav();
  }

  function hideAllViews() {
    [loginView, signupView, completeView, accountView].forEach((view) => {
      if (view) view.hidden = true;
    });
  }

  function showTabs(show) {
    if (tabsWrap) tabsWrap.hidden = !show;
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
    const defaultView = token
      ? (realPlayState?.profile ? 'account' : 'complete')
      : 'login';
    showView(preferredView || defaultView);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-open');

    window.setTimeout(() => {
      const firstInput = overlay.querySelector('.auth-view:not([hidden]) input');
      if (firstInput) firstInput.focus();
    }, 60);
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-open');
    setStatus('');
  }

  function updateNav() {
    if (!token) navLink.textContent = 'LOG IN';
    else if (realPlayState?.profile) navLink.textContent = 'MY PROFILE';
    else navLink.textContent = 'COMPLETE PROFILE';
  }

  function formatDate(dateValue) {
    if (!dateValue) return '';
    const raw = String(dateValue).slice(0, 10);
    const date = new Date(`${raw}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date);
  }

  function formatMonth(dateValue) {
    if (!dateValue) return 'next month';
    const raw = String(dateValue).slice(0, 10);
    const date = new Date(`${raw}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return 'next month';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date);
  }

  function renderNotifications() {
    if (!notificationsWrap || !notificationsList) return;
    const notices = Array.isArray(realPlayState?.notifications)
      ? realPlayState.notifications
      : [];

    notificationsList.innerHTML = '';
    notificationsWrap.hidden = notices.length === 0;

    notices.forEach((notice) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `auth-notification${notice.read_at ? '' : ' unread'}`;
      item.dataset.notificationId = String(notice.id);

      const title = document.createElement('strong');
      title.textContent = notice.title || 'REAL PLAY NOTICE';

      const body = document.createElement('span');
      body.textContent = notice.body || '';

      const time = document.createElement('small');
      time.textContent = notice.created_at
        ? new Intl.DateTimeFormat('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Asia/Manila',
          }).format(new Date(notice.created_at))
        : '';

      item.append(title, body, time);
      notificationsList.append(item);
    });
  }

  function renderAccount() {
    const profile = realPlayState?.profile;
    if (!profile) return;

    if (accountName) accountName.textContent = profile.player_name || 'REAL PLAY PLAYER';
    if (accountEmail) accountEmail.textContent = profile.email || currentUser?.email || '';

    const current = realPlayState?.currentNumber;
    if (accountNumber) accountNumber.textContent = current ? `#${current.number}` : '#--';
    if (accountNumberLock) {
      accountNumberLock.textContent = current?.lockedThrough
        ? `SECURED THROUGH ${formatDate(current.lockedThrough).toUpperCase()}`
        : 'NO CURRENT NUMBER';
    }

    if (supportTier) {
      if (realPlayState?.supportTier) {
        supportTier.hidden = false;
        supportTier.textContent = `SUPPORT · ${String(realPlayState.supportTier).toUpperCase()}`;
      } else {
        supportTier.hidden = true;
        supportTier.textContent = '';
      }
    }

    const future = realPlayState?.nextMonth || {};
    const futureMonth = formatMonth(future.monthStart);
    if (future.assignment) {
      if (nextNumber) nextNumber.textContent = `#${future.assignment.number} SECURED`;
      if (nextStatus) nextStatus.textContent = `This number is reserved for you beginning ${futureMonth}.`;
    } else if (future.request) {
      const requestStatus = String(future.request.status || '').toLowerCase();
      if (nextNumber) nextNumber.textContent = `#${future.request.number} · ${requestStatus === 'leading' ? 'PRIORITY LEAD' : 'PRIORITY REQUEST'}`;
      if (nextStatus) {
        nextStatus.textContent = requestStatus === 'leading'
          ? `You currently lead for this number in ${futureMonth}. The current owner keeps it through this month.`
          : `Your request is recorded for ${futureMonth}, but you do not currently hold priority.`;
      }
    } else {
      if (nextNumber) nextNumber.textContent = 'No number change scheduled.';
      if (nextStatus) nextStatus.textContent = 'Your current number remains protected through the end of this month.';
    }

    renderNotifications();
  }

  async function loadRealPlayState() {
    if (!token) {
      realPlayState = null;
      updateNav();
      return null;
    }

    try {
      realPlayState = await api('/api/real-play/me', { auth: true });
      updateNav();
      renderAccount();
      return realPlayState;
    } catch (error) {
      if (error.status === 401) {
        realPlayState = null;
        updateNav();
        return null;
      }
      throw error;
    }
  }

  async function login(email, password) {
    const result = await api('/api/login', {
      method: 'POST',
      body: { email, password },
    });
    saveToken(result?.token || '');
    currentUser = result?.user || null;
    await loadRealPlayState();
    return result;
  }

  function validatePlayerNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 99 ? number : null;
  }

  async function checkNumberAvailability(input) {
    const key = input.dataset.playerNumberInput;
    const output = document.querySelector(`[data-number-status="${key}"]`);
    if (!output) return;

    const playerNumber = validatePlayerNumber(input.value);
    if (playerNumber === null) {
      output.className = 'auth-number-status';
      output.textContent = 'Choose a whole number from 0 to 99.';
      return;
    }

    output.className = 'auth-number-status checking';
    output.textContent = `Checking #${playerNumber}...`;

    try {
      const result = await api(`/api/real-play/numbers/${playerNumber}`);
      if (result.available) {
        output.className = 'auth-number-status available';
        output.textContent = `#${playerNumber} IS AVAILABLE — claim it for this month.`;
      } else {
        output.className = 'auth-number-status taken';
        const owner = result.ownerName ? ` by ${result.ownerName}` : '';
        output.textContent = `#${playerNumber} is already owned${owner} through ${formatDate(result.lockedThrough)}.`;
      }
    } catch (_error) {
      output.className = 'auth-number-status';
      output.textContent = 'Number availability could not be checked right now.';
    }
  }

  numberInputs.forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.playerNumberInput;
      if (numberCheckTimers.has(key)) window.clearTimeout(numberCheckTimers.get(key));
      numberCheckTimers.set(key, window.setTimeout(() => checkNumberAvailability(input), 320));
    });
    input.addEventListener('blur', () => checkNumberAvailability(input));
  });

  navLink.addEventListener('click', async (event) => {
    event.preventDefault();
    if (token && !realPlayState) {
      try {
        await loadRealPlayState();
      } catch (_error) {
        // Open the modal even if the backend is temporarily unavailable.
      }
    }
    openModal();
  });

  if (closeButton) closeButton.addEventListener('click', closeModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.authTab));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    setBusy(loginForm, true);

    const form = new FormData(loginForm);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    try {
      await login(email, password);
      loginForm.reset();
      if (realPlayState?.profile) {
        showView('account');
        setStatus('Welcome back. Your Real Play profile is ready.', 'success');
      } else {
        showView('complete');
        setStatus('Account recognized. Choose your Real Play player name and number.', 'success');
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
    const playerName = String(form.get('player_name') || '').trim();
    const playerNumber = validatePlayerNumber(form.get('player_number'));
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirm_password') || '');

    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }
    if (playerNumber === null) {
      setStatus('Choose a player number from 0 to 99.', 'error');
      return;
    }
    if (password.length < 8) {
      setStatus('Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.', 'error');
      return;
    }

    setBusy(signupForm, true);

    try {
      const numberState = await api(`/api/real-play/numbers/${playerNumber}`);
      if (!numberState.available) {
        setStatus(`#${playerNumber} is already owned through ${formatDate(numberState.lockedThrough)}. Choose another number.`, 'error');
        return;
      }

      await api('/api/users', {
        method: 'POST',
        body: { name: playerName, email, password },
      });

      await login(email, password);

      try {
        await api('/api/real-play/profile', {
          method: 'POST',
          auth: true,
          body: { playerName, playerNumber },
        });
      } catch (error) {
        if (error.code === 'NUMBER_TAKEN') {
          const completeName = completeForm.querySelector('[name="player_name"]');
          const completeNumber = completeForm.querySelector('[name="player_number"]');
          if (completeName) completeName.value = playerName;
          if (completeNumber) completeNumber.value = playerNumber;
          showView('complete');
          setStatus(`Your account was created, but #${playerNumber} was just claimed by another player. Choose another available number to finish your profile.`, 'error');
          return;
        }
        throw error;
      }

      await loadRealPlayState();
      signupForm.reset();
      showView('account');
      setStatus(`Account created. #${playerNumber} is yours for this month.`, 'success');
    } catch (error) {
      if (error.status === 409 && /email/i.test(error.message || '')) {
        setStatus('That email already has a LifeTalk account. Use LOG IN, then create your separate Real Play profile.', 'error');
      } else {
        setStatus(error.message, 'error');
      }
    } finally {
      setBusy(signupForm, false);
    }
  });

  completeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    if (!token) {
      showView('login');
      setStatus('Please log in first.', 'error');
      return;
    }

    const form = new FormData(completeForm);
    const playerName = String(form.get('player_name') || '').trim();
    const playerNumber = validatePlayerNumber(form.get('player_number'));

    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }
    if (playerNumber === null) {
      setStatus('Choose a player number from 0 to 99.', 'error');
      return;
    }

    setBusy(completeForm, true);
    try {
      await api('/api/real-play/profile', {
        method: 'POST',
        auth: true,
        body: { playerName, playerNumber },
      });
      await loadRealPlayState();
      completeForm.reset();
      showView('account');
      setStatus(`Player profile created. #${playerNumber} is yours for this month.`, 'success');
    } catch (error) {
      if (error.code === 'NUMBER_TAKEN') {
        setStatus(`#${playerNumber} is already owned through ${formatDate(error.details?.lockedThrough)}. Choose another available number.`, 'error');
      } else if (error.code === 'PROFILE_EXISTS') {
        await loadRealPlayState();
        showView('account');
        setStatus('Your Real Play player profile already exists.', 'success');
      } else {
        setStatus(error.message, 'error');
      }
    } finally {
      setBusy(completeForm, false);
    }
  });

  if (numberRequestForm) {
    numberRequestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      const form = new FormData(numberRequestForm);
      const playerNumber = validatePlayerNumber(form.get('player_number'));
      if (playerNumber === null) {
        setStatus('Choose a player number from 0 to 99.', 'error');
        return;
      }

      setBusy(numberRequestForm, true);
      try {
        const result = await api(`/api/real-play/numbers/${playerNumber}/request`, {
          method: 'POST',
          auth: true,
        });
        await loadRealPlayState();
        numberRequestForm.reset();
        renderAccount();
        setStatus(result.message || 'Your number request has been updated.', 'success');
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        setBusy(numberRequestForm, false);
      }
    });
  }

  if (notificationsList) {
    notificationsList.addEventListener('click', async (event) => {
      const item = event.target.closest('[data-notification-id]');
      if (!item || !token || !item.classList.contains('unread')) return;

      try {
        await api(`/api/real-play/notifications/${item.dataset.notificationId}/read`, {
          method: 'POST',
          auth: true,
        });
        item.classList.remove('unread');
        const notice = realPlayState?.notifications?.find(
          (entry) => String(entry.id) === String(item.dataset.notificationId)
        );
        if (notice) notice.read_at = new Date().toISOString();
      } catch (_error) {
        // Reading a notice is non-critical; keep the notice visible.
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      clearSession();
      showView('login');
      setStatus('You are logged out.', 'success');
    });
  }

  async function restoreSession() {
    updateNav();
    if (!token) return;

    try {
      await loadRealPlayState();
    } catch (error) {
      console.error('Real Play session could not be restored:', error);
    }
  }

  restoreSession();
})();
