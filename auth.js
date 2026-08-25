(() => {
  const SUPABASE_URL = 'https://aydgnziueszxxhusatsv.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mp0vfLH556XEuNEvLllcrw_JfPJgTWk';

  if (!window.supabase) {
    console.error('Supabase client failed to load.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

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
  const loginForm = document.querySelector('[data-auth-login-form]');
  const signupForm = document.querySelector('[data-auth-signup-form]');
  const completeForm = document.querySelector('[data-auth-complete-form]');
  const logoutButton = document.querySelector('[data-auth-logout]');

  if (!overlay || !navLink || !loginForm || !signupForm || !completeForm || !accountView) {
    return;
  }

  let currentSession = null;
  let currentProfile = null;

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
    const view = preferredView || (currentSession ? (currentProfile ? 'account' : 'complete') : 'login');
    showView(view);
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

  function renderAccount() {
    if (!currentSession) return;
    const email = currentSession.user?.email || '';
    const fallbackName = currentSession.user?.user_metadata?.player_name || 'REAL PLAY PLAYER';
    if (accountName) accountName.textContent = currentProfile?.player_name || fallbackName;
    if (accountEmail) accountEmail.textContent = email;
  }

  function updateNav() {
    navLink.textContent = currentSession ? 'MY PROFILE' : 'LOG IN';
  }

  async function loadProfile() {
    currentProfile = null;
    if (!currentSession?.user?.id) return null;

    const { data, error } = await client
      .from('real_play_player_profiles')
      .select('user_id, player_name, avatar_url, member_status, created_at')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    if (error) {
      console.error('Could not load Real Play profile:', error);
      return null;
    }

    currentProfile = data || null;
    return currentProfile;
  }

  async function refreshSession(session = null) {
    if (session) {
      currentSession = session;
    } else {
      const { data } = await client.auth.getSession();
      currentSession = data.session || null;
    }

    if (currentSession) await loadProfile();
    else currentProfile = null;

    updateNav();
    renderAccount();
  }

  navLink.addEventListener('click', (event) => {
    event.preventDefault();
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

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setBusy(loginForm, false);

    if (error) {
      setStatus(error.message, 'error');
      return;
    }

    currentSession = data.session;
    await loadProfile();
    updateNav();

    if (currentProfile) {
      showView('account');
      setStatus('Welcome back. Your Real Play profile is ready.', 'success');
    } else {
      showView('complete');
      setStatus('Your account is recognized. Create your separate Real Play player profile to continue.', 'success');
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const form = new FormData(signupForm);
    const playerName = String(form.get('player_name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirm_password') || '');

    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }

    if (password.length < 6) {
      setStatus('Password must be at least 6 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match.', 'error');
      return;
    }

    setBusy(signupForm, true);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          source_app: 'real_play',
          player_name: playerName,
          display_name: playerName,
        },
      },
    });
    setBusy(signupForm, false);

    if (error) {
      setStatus(error.message, 'error');
      return;
    }

    signupForm.reset();

    if (data.session) {
      currentSession = data.session;
      await loadProfile();
      updateNav();
      showView(currentProfile ? 'account' : 'complete');
      setStatus('Your Real Play account has been created.', 'success');
    } else {
      showView('login');
      setStatus('Account created. Check your email to confirm it, then log in.', 'success');
    }
  });

  completeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    if (!currentSession?.user?.id) {
      showView('login');
      setStatus('Please log in first.', 'error');
      return;
    }

    const form = new FormData(completeForm);
    const playerName = String(form.get('player_name') || '').trim();

    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }

    setBusy(completeForm, true);
    const { data, error } = await client
      .from('real_play_player_profiles')
      .insert({
        user_id: currentSession.user.id,
        player_name: playerName,
      })
      .select('user_id, player_name, avatar_url, member_status, created_at')
      .single();
    setBusy(completeForm, false);

    if (error) {
      if (error.code === '23505') {
        await loadProfile();
        showView('account');
        setStatus('Your Real Play player profile already exists.', 'success');
        return;
      }
      setStatus(error.message, 'error');
      return;
    }

    currentProfile = data;
    completeForm.reset();
    updateNav();
    showView('account');
    setStatus('Player profile created. Welcome to Real Play.', 'success');
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      setBusy(logoutButton, true);
      const { error } = await client.auth.signOut();
      setBusy(logoutButton, false);

      if (error) {
        setStatus(error.message, 'error');
        return;
      }

      currentSession = null;
      currentProfile = null;
      updateNav();
      showView('login');
      setStatus('You are logged out.', 'success');
    });
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session || null;
    if (currentSession) await loadProfile();
    else currentProfile = null;
    updateNav();
    renderAccount();
  });

  refreshSession();
})();
