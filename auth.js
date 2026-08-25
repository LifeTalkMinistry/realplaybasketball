(() => {
  const SUPABASE_URL = 'https://aydgnziueszxxhusatsv.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mp0vfLH556XEuNEvLllcrw_JfPJgTWk';
  const MANILA_TIME_ZONE = 'Asia/Manila';

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
  let numberDashboard = null;
  let numberAvailabilityTimers = new WeakMap();

  injectNumberStyles();
  installNumberFields();
  installNumberManager();

  const signupNumberInput = signupForm.querySelector('[name="player_number"]');
  const completeNumberInput = completeForm.querySelector('[name="player_number"]');
  const numberManagerForm = accountView.querySelector('[data-number-manager-form]');
  const numberManagerInput = accountView.querySelector('[data-number-manager-input]');

  function injectNumberStyles() {
    if (document.getElementById('real-play-number-styles')) return;
    const style = document.createElement('style');
    style.id = 'real-play-number-styles';
    style.textContent = `
      .rp-number-field{position:relative}.rp-number-input-wrap{display:flex;align-items:center;border:1px solid rgba(149,169,194,.28);background:#050a11;min-height:50px;transition:border-color .2s ease,box-shadow .2s ease}.rp-number-input-wrap:focus-within{border-color:#00d8ff;box-shadow:0 0 0 1px rgba(0,216,255,.16)}.rp-number-prefix{padding-left:14px;color:#00d8ff;font-family:inherit;font-size:20px;font-weight:900}.rp-number-input-wrap input{border:0!important;background:transparent!important;box-shadow:none!important;padding-left:8px!important;width:100%}.rp-number-help{margin:7px 0 0;font-size:11px;line-height:1.45;color:#7f91a8}.rp-number-help.available{color:#48e7a4}.rp-number-help.taken{color:#ff7b8d}.rp-number-help.checking{color:#8ba3bf}.rp-number-manager{margin-top:18px;border:1px solid rgba(0,216,255,.22);background:linear-gradient(145deg,rgba(5,14,25,.96),rgba(3,7,13,.96));padding:18px}.rp-number-head{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center}.rp-number-badge{width:82px;height:82px;display:grid;place-items:center;border:1px solid rgba(0,216,255,.55);background:rgba(0,216,255,.07);clip-path:polygon(10% 0,100% 0,100% 90%,90% 100%,0 100%,0 10%);font-size:34px;font-weight:950;color:#f4f8ff;letter-spacing:-1px}.rp-number-kicker{display:block;color:#00d8ff;font-size:10px;font-weight:900;letter-spacing:.16em}.rp-number-title{margin:5px 0 3px;color:#f5f8fc;font-size:18px;font-weight:900}.rp-number-lock{display:block;color:#8ea1b7;font-size:11px;line-height:1.4}.rp-number-alert{margin:14px 0 0;padding:11px 12px;border-left:2px solid #ff3e63;background:rgba(255,62,99,.08);color:#cbd6e5;font-size:12px;line-height:1.5}.rp-number-next{margin:14px 0 0;padding:11px 12px;border-left:2px solid #00d8ff;background:rgba(0,216,255,.06);color:#b9c9db;font-size:12px;line-height:1.5}.rp-number-manager-form{margin-top:16px}.rp-number-manager-form label{display:block;margin-bottom:7px;color:#afbdd0;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.rp-number-row{display:grid;grid-template-columns:1fr auto;gap:8px}.rp-number-row .rp-number-input-wrap{min-width:0}.rp-number-action{border:1px solid #00d8ff;background:linear-gradient(110deg,#00d8ff,#168cff);color:#03101d;padding:0 14px;min-height:50px;font-size:10px;font-weight:950;letter-spacing:.07em;cursor:pointer}.rp-number-action:disabled{opacity:.5;cursor:not-allowed}.rp-number-manager-status{min-height:18px;margin:8px 0 0;font-size:11px;line-height:1.45;color:#8ea1b7}.rp-number-manager-status.success{color:#48e7a4}.rp-number-manager-status.error{color:#ff7b8d}.rp-support-tier{display:inline-flex;margin-top:12px;padding:5px 8px;border:1px solid rgba(255,255,255,.12);color:#9fb1c7;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.rp-notifications{margin-top:16px;padding-top:15px;border-top:1px solid rgba(255,255,255,.09)}.rp-notifications h4{margin:0 0 9px;color:#f0f5fb;font-size:10px;letter-spacing:.13em}.rp-notification{padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}.rp-notification:first-of-type{border-top:0}.rp-notification strong{display:block;color:#dce8f6;font-size:10px;letter-spacing:.06em}.rp-notification p{margin:4px 0 0;color:#8fa1b7;font-size:11px;line-height:1.45}.rp-notification time{display:block;margin-top:5px;color:#5f7288;font-size:9px}.rp-notifications-empty{margin:0;color:#65788e;font-size:11px}.auth-account-card .rp-account-number{display:block;margin-top:8px;color:#00d8ff;font-size:13px;font-weight:900;letter-spacing:.08em}@media(max-width:520px){.rp-number-head{grid-template-columns:66px 1fr}.rp-number-badge{width:66px;height:66px;font-size:28px}.rp-number-row{grid-template-columns:1fr}.rp-number-action{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installNumberFields() {
    installNumberField(signupForm, 'real-play-player-number', 'Choose your number for this month. Once claimed, it stays yours through month-end.');
    installNumberField(completeForm, 'real-play-complete-number', 'Choose an available Real Play number for the current month.');
  }

  function installNumberField(form, inputId, helperText) {
    if (!form || form.querySelector('[name="player_number"]')) return;
    const playerNameInput = form.querySelector('[name="player_name"]');
    const anchor = playerNameInput?.closest('.auth-field');
    if (!anchor) return;

    const field = document.createElement('div');
    field.className = 'auth-field rp-number-field';
    field.innerHTML = `
      <label for="${inputId}">Player Number</label>
      <div class="rp-number-input-wrap">
        <span class="rp-number-prefix">#</span>
        <input id="${inputId}" name="player_number" type="number" min="0" max="99" inputmode="numeric" placeholder="23" required />
      </div>
      <p class="rp-number-help" data-number-availability>${helperText}</p>
    `;
    anchor.insertAdjacentElement('afterend', field);

    const input = field.querySelector('input');
    input.addEventListener('input', () => scheduleAvailabilityCheck(input));
    input.addEventListener('blur', () => checkAndRenderAvailability(input));
  }

  function installNumberManager() {
    if (accountView.querySelector('[data-number-manager]')) return;
    const accountCard = accountView.querySelector('.auth-account-card');
    const note = accountView.querySelector('.auth-note');
    if (!accountCard) return;

    const numberText = document.createElement('span');
    numberText.className = 'rp-account-number';
    numberText.dataset.authAccountNumber = '';
    accountCard.appendChild(numberText);

    const manager = document.createElement('section');
    manager.className = 'rp-number-manager';
    manager.dataset.numberManager = '';
    manager.innerHTML = `
      <div class="rp-number-head">
        <div class="rp-number-badge" data-number-badge>#—</div>
        <div>
          <span class="rp-number-kicker">REAL PLAY NUMBER</span>
          <div class="rp-number-title" data-number-title>Choose your number</div>
          <span class="rp-number-lock" data-number-lock>Your number is owned month by month.</span>
        </div>
      </div>
      <div class="rp-number-alert" data-number-alert hidden></div>
      <div class="rp-number-next" data-number-next hidden></div>
      <span class="rp-support-tier" data-support-tier hidden></span>
      <form class="rp-number-manager-form" data-number-manager-form>
        <label data-number-manager-label>Choose your current player number</label>
        <div class="rp-number-row">
          <div class="rp-number-input-wrap">
            <span class="rp-number-prefix">#</span>
            <input data-number-manager-input type="number" min="0" max="99" inputmode="numeric" placeholder="23" required />
          </div>
          <button class="rp-number-action" data-number-manager-button type="submit">CLAIM NUMBER</button>
        </div>
        <p class="rp-number-manager-status" data-number-manager-status></p>
      </form>
      <div class="rp-notifications" data-number-notifications>
        <h4>NUMBER UPDATES</h4>
        <p class="rp-notifications-empty">No number updates yet.</p>
      </div>
    `;

    if (note) note.insertAdjacentElement('beforebegin', manager);
    else accountCard.insertAdjacentElement('afterend', manager);

    const input = manager.querySelector('[data-number-manager-input]');
    input.addEventListener('input', () => scheduleAvailabilityCheck(input, true));
  }

  function setStatus(message = '', type = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function setNumberManagerStatus(message = '', type = '') {
    const el = accountView.querySelector('[data-number-manager-status]');
    if (!el) return;
    el.textContent = message;
    el.className = `rp-number-manager-status${type ? ` ${type}` : ''}`;
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
      loadNumberDashboard();
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
    setNumberManagerStatus('');
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

  function manilaDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type)?.value;
    return { year: value('year'), month: value('month'), day: value('day') };
  }

  function currentManilaMonthStart() {
    const { year, month } = manilaDateParts();
    return `${year}-${month}-01`;
  }

  function formatMonth(dateString) {
    if (!dateString) return '';
    const date = new Date(`${dateString}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIME_ZONE,
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function formatShortDate(dateString) {
    if (!dateString) return '';
    const date = new Date(`${dateString}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIME_ZONE,
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  function formatTimestamp(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function normalizeNumber(input) {
    const value = Number.parseInt(String(input ?? ''), 10);
    return Number.isInteger(value) && value >= 0 && value <= 99 ? value : null;
  }

  async function getNumberAvailability(playerNumber) {
    const number = normalizeNumber(playerNumber);
    if (number === null) return { valid: false, available: false };

    const { data, error } = await client
      .from('real_play_number_registry')
      .select('player_number, player_name, locked_through')
      .eq('month_start', currentManilaMonthStart())
      .eq('player_number', number)
      .maybeSingle();

    if (error) {
      console.error('Could not check player number:', error);
      return { valid: true, available: null, error };
    }

    return {
      valid: true,
      available: !data,
      owner: data?.player_name || null,
      lockedThrough: data?.locked_through || null,
    };
  }

  function scheduleAvailabilityCheck(input, manager = false) {
    const oldTimer = numberAvailabilityTimers.get(input);
    if (oldTimer) window.clearTimeout(oldTimer);
    const timer = window.setTimeout(() => checkAndRenderAvailability(input, manager), 260);
    numberAvailabilityTimers.set(input, timer);
  }

  async function checkAndRenderAvailability(input, manager = false) {
    const number = normalizeNumber(input.value);
    const helper = manager
      ? accountView.querySelector('[data-number-manager-status]')
      : input.closest('.rp-number-field')?.querySelector('[data-number-availability]');

    if (!helper) return null;
    if (number === null) {
      helper.textContent = 'Choose a number from 0 to 99.';
      helper.className = manager ? 'rp-number-manager-status error' : 'rp-number-help taken';
      return { valid: false, available: false };
    }

    if (manager && numberDashboard?.player_number != null) {
      helper.textContent = 'Checking current ownership…';
      helper.className = 'rp-number-manager-status';
    } else {
      helper.textContent = 'Checking number…';
      helper.className = manager ? 'rp-number-manager-status' : 'rp-number-help checking';
    }

    const result = await getNumberAvailability(number);
    if (result.available === null) {
      helper.textContent = 'Could not check this number right now.';
      helper.className = manager ? 'rp-number-manager-status error' : 'rp-number-help taken';
      return result;
    }

    if (manager && numberDashboard?.player_number != null) {
      if (number === numberDashboard.player_number) {
        helper.textContent = `#${number} is already yours this month.`;
      } else if (result.available) {
        helper.textContent = `#${number} is open this month. You can request it for ${formatMonth(numberDashboard.next_month)}.`;
      } else {
        helper.textContent = `#${number} belongs to ${result.owner || 'another player'} through ${formatShortDate(result.lockedThrough)}. If your verified support priority is higher, you can request next-month priority.`;
      }
      helper.className = 'rp-number-manager-status';
      return result;
    }

    helper.textContent = result.available
      ? `#${number} is available. Claim it for this month.`
      : `#${number} is already owned through ${formatShortDate(result.lockedThrough)}. Choose another number.`;
    helper.className = manager
      ? `rp-number-manager-status ${result.available ? 'success' : 'error'}`
      : `rp-number-help ${result.available ? 'available' : 'taken'}`;
    return result;
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

  async function loadNumberDashboard() {
    if (!currentSession || !currentProfile) return null;

    const { data, error } = await client.rpc('real_play_get_number_dashboard');
    if (error) {
      console.error('Could not load Real Play number dashboard:', error);
      setNumberManagerStatus('Player-number status is temporarily unavailable.', 'error');
      return null;
    }

    numberDashboard = data || null;
    renderNumberDashboard();
    return numberDashboard;
  }

  function renderNumberDashboard() {
    const badge = accountView.querySelector('[data-number-badge]');
    const title = accountView.querySelector('[data-number-title]');
    const lock = accountView.querySelector('[data-number-lock]');
    const alert = accountView.querySelector('[data-number-alert]');
    const next = accountView.querySelector('[data-number-next]');
    const tier = accountView.querySelector('[data-support-tier]');
    const label = accountView.querySelector('[data-number-manager-label]');
    const button = accountView.querySelector('[data-number-manager-button]');
    const accountNumber = accountView.querySelector('[data-auth-account-number]');
    const notifications = accountView.querySelector('[data-number-notifications]');

    if (!numberDashboard) return;

    const currentNumber = numberDashboard.player_number;
    if (currentNumber == null) {
      if (badge) badge.textContent = '#—';
      if (title) title.textContent = 'Choose your number';
      if (lock) lock.textContent = `Claim an available number for ${formatMonth(numberDashboard.current_month)}.`;
      if (accountNumber) accountNumber.textContent = 'NO PLAYER NUMBER YET';
      if (label) label.textContent = 'Choose your current player number';
      if (button) button.textContent = 'CLAIM NUMBER';
    } else {
      if (badge) badge.textContent = `#${currentNumber}`;
      if (title) title.textContent = `#${currentNumber} IS YOURS`;
      if (lock) lock.textContent = `Locked to you through ${formatShortDate(numberDashboard.locked_through)}.`;
      if (accountNumber) accountNumber.textContent = `PLAYER NUMBER · #${currentNumber}`;
      if (label) label.textContent = `Number for ${formatMonth(numberDashboard.next_month)}`;
      if (button) button.textContent = 'REQUEST NUMBER';
    }

    const incoming = numberDashboard.incoming_priority;
    if (alert) {
      if (incoming) {
        const challengerLabel = incoming.challenger_tier
          ? `${String(incoming.challenger_tier).toUpperCase()} supporter`
          : 'higher-priority supporter';
        alert.hidden = false;
        alert.textContent = `Your #${currentNumber} is safe through ${formatShortDate(numberDashboard.locked_through)}. ${incoming.challenger_name}, a ${challengerLabel}, currently holds priority for #${currentNumber} next month. You can secure another number below.`;
      } else {
        alert.hidden = true;
        alert.textContent = '';
      }
    }

    if (next) {
      if (numberDashboard.next_requested_number != null) {
        next.hidden = false;
        next.textContent = `NEXT MONTH · You currently hold priority for #${numberDashboard.next_requested_number}. This takes effect when ${formatMonth(numberDashboard.next_month)} begins if your priority remains in place.`;
      } else if (currentNumber != null && !incoming) {
        next.hidden = false;
        next.textContent = `NEXT MONTH · No change is scheduled. #${currentNumber} carries forward unless a higher support priority successfully requests it.`;
      } else {
        next.hidden = true;
        next.textContent = '';
      }
    }

    if (tier) {
      if (numberDashboard.support_tier) {
        tier.hidden = false;
        tier.textContent = `SUPPORT TIER · ${String(numberDashboard.support_tier).toUpperCase()}`;
      } else {
        tier.hidden = true;
        tier.textContent = '';
      }
    }

    if (notifications) {
      const items = Array.isArray(numberDashboard.notifications) ? numberDashboard.notifications : [];
      notifications.innerHTML = '<h4>NUMBER UPDATES</h4>';
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'rp-notifications-empty';
        empty.textContent = 'No number updates yet.';
        notifications.appendChild(empty);
      } else {
        items.forEach((item) => {
          const article = document.createElement('article');
          article.className = 'rp-notification';
          const strong = document.createElement('strong');
          strong.textContent = item.title || 'NUMBER UPDATE';
          const body = document.createElement('p');
          body.textContent = item.body || '';
          const time = document.createElement('time');
          time.textContent = formatTimestamp(item.created_at);
          article.append(strong, body, time);
          notifications.appendChild(article);
        });
      }
    }
  }

  async function refreshSession(session = null) {
    if (session) {
      currentSession = session;
    } else {
      const { data } = await client.auth.getSession();
      currentSession = data.session || null;
    }

    if (currentSession) await loadProfile();
    else {
      currentProfile = null;
      numberDashboard = null;
    }

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
    const playerNumber = normalizeNumber(form.get('player_number'));
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

    const availability = await getNumberAvailability(playerNumber);
    if (availability.available !== true) {
      setStatus(availability.available === false
        ? `#${playerNumber} is already owned for this month. Choose another number.`
        : 'Could not verify that player number. Please try again.', 'error');
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
          player_number: String(playerNumber),
        },
      },
    });
    setBusy(signupForm, false);

    if (error) {
      setStatus(error.message, 'error');
      return;
    }

    signupForm.reset();
    resetAvailabilityHelper(signupNumberInput, 'Choose your number for this month. Once claimed, it stays yours through month-end.');

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
    const playerNumber = normalizeNumber(form.get('player_number'));

    if (playerName.length < 2 || playerName.length > 40) {
      setStatus('Player name must be between 2 and 40 characters.', 'error');
      return;
    }

    if (playerNumber === null) {
      setStatus('Choose a player number from 0 to 99.', 'error');
      return;
    }

    const availability = await getNumberAvailability(playerNumber);
    if (availability.available !== true) {
      setStatus(availability.available === false
        ? `#${playerNumber} is already owned for this month. Choose another number.`
        : 'Could not verify that player number. Please try again.', 'error');
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

    if (error) {
      setBusy(completeForm, false);
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
    const { data: claimResult, error: claimError } = await client.rpc('real_play_claim_number', {
      p_player_number: playerNumber,
    });
    setBusy(completeForm, false);

    completeForm.reset();
    resetAvailabilityHelper(completeNumberInput, 'Choose an available Real Play number for the current month.');
    updateNav();
    showView('account');

    if (claimError) {
      setStatus('Player profile created, but the number could not be claimed yet. Choose a number in My Profile.', 'error');
      return;
    }

    if (claimResult?.status === 'taken') {
      setStatus(`Profile created, but #${playerNumber} was claimed by someone else at the same time. Choose another number below.`, 'error');
    } else {
      setStatus(`Player profile created. #${playerNumber} is yours for this month.`, 'success');
    }
  });

  if (numberManagerForm) {
    numberManagerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentSession || !currentProfile) return;

      const playerNumber = normalizeNumber(numberManagerInput?.value);
      if (playerNumber === null) {
        setNumberManagerStatus('Choose a number from 0 to 99.', 'error');
        return;
      }

      setBusy(numberManagerForm, true);
      setNumberManagerStatus('');

      if (numberDashboard?.player_number == null) {
        const availability = await getNumberAvailability(playerNumber);
        if (availability.available !== true) {
          setBusy(numberManagerForm, false);
          setNumberManagerStatus(availability.available === false
            ? `#${playerNumber} is already owned for this month. Choose another number.`
            : 'Could not verify that number. Try again.', 'error');
          return;
        }

        const { data, error } = await client.rpc('real_play_claim_number', {
          p_player_number: playerNumber,
        });
        setBusy(numberManagerForm, false);

        if (error) {
          setNumberManagerStatus(error.message, 'error');
          return;
        }

        if (data?.status === 'claimed' || data?.status === 'already_owned') {
          numberManagerInput.value = '';
          setNumberManagerStatus(`#${data.player_number ?? playerNumber} is yours through ${formatShortDate(data.locked_through || numberDashboard?.locked_through)}.`, 'success');
          await loadNumberDashboard();
        } else {
          setNumberManagerStatus(data?.message || 'That number could not be claimed.', 'error');
        }
        return;
      }

      const { data, error } = await client.rpc('real_play_request_next_number', {
        p_player_number: playerNumber,
      });
      setBusy(numberManagerForm, false);

      if (error) {
        setNumberManagerStatus(error.message, 'error');
        return;
      }

      const successStatuses = new Set(['priority_leading', 'reserved', 'already_leading', 'already_yours']);
      setNumberManagerStatus(data?.message || 'Number request updated.', successStatuses.has(data?.status) ? 'success' : 'error');
      if (successStatuses.has(data?.status)) numberManagerInput.value = '';
      await loadNumberDashboard();
    });
  }

  function resetAvailabilityHelper(input, text) {
    if (!input) return;
    const helper = input.closest('.rp-number-field')?.querySelector('[data-number-availability]');
    if (!helper) return;
    helper.textContent = text;
    helper.className = 'rp-number-help';
  }

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
      numberDashboard = null;
      updateNav();
      showView('login');
      setStatus('You are logged out.', 'success');
    });
  }

  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session || null;
    window.setTimeout(async () => {
      if (currentSession) await loadProfile();
      else {
        currentProfile = null;
        numberDashboard = null;
      }
      updateNav();
      renderAccount();
      if (currentSession && currentProfile && !accountView.hidden) await loadNumberDashboard();
    }, 0);
  });

  refreshSession();
})();
