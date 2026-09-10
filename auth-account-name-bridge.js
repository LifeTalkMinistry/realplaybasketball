(() => {
  const NAME_KEY = 'real_play_account_name';
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  function rememberName(value) {
    const name = String(value || '').trim();
    if (name.length >= 2) localStorage.setItem(NAME_KEY, name);
    return name;
  }

  function savedName() {
    return String(localStorage.getItem(NAME_KEY) || '').trim();
  }

  // Capture the canonical account name whenever register/login succeeds.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const requestUrl = String(args[0]?.url || args[0] || '');
      if (
        response.ok &&
        (requestUrl.includes('/api/real-play/auth/register') || requestUrl.includes('/api/real-play/auth/login'))
      ) {
        const data = await response.clone().json().catch(() => null);
        rememberName(data?.user?.name);
      }
    } catch (_error) {}
    return response;
  };

  async function recoverNameFromAccount() {
    const existing = savedName();
    if (existing) return existing;

    const token = String(localStorage.getItem(TOKEN_KEY) || '').trim();
    if (!token) return '';

    try {
      const response = await nativeFetch(`${API_BASE_URL}/api/real-play/profile-ownership/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return '';
      const data = await response.json().catch(() => ({}));
      return rememberName(data?.accountName);
    } catch (_error) {
      return '';
    }
  }

  async function applyNameCarryForward() {
    const form = document.querySelector('[data-auth-complete-form]');
    const input = form?.querySelector('input[name="player_name"]');
    if (!form || !input) return;

    const name = savedName() || await recoverNameFromAccount();
    if (!name) {
      // Legacy fallback only: keep the field visible if an older session has no
      // recoverable account name. Normal register/login flows never ask twice.
      return;
    }

    input.value = name;
    input.type = 'hidden';
    input.autocomplete = 'off';
    const field = input.closest('.auth-field');
    if (field) field.hidden = true;
  }

  function installCleanLogin() {
    const panel = document.querySelector('.auth-panel');
    const tabsWrap = document.querySelector('[data-auth-tabs]');
    const status = document.querySelector('[data-auth-status]');
    const loginView = document.querySelector('[data-auth-view="login"]');
    const signupView = document.querySelector('[data-auth-view="signup"]');
    const completeView = document.querySelector('[data-auth-view="complete"]');
    const accountView = document.querySelector('[data-auth-view="account"]');
    if (!panel || !tabsWrap || !loginView || !signupView) return;

    panel.classList.add('rp-auth-clean');

    // Keep the existing auth tabs and existing auth-core click handlers intact.
    // We only move that same control below the views so it becomes a quiet
    // secondary action instead of a competing tab bar.
    if (status && tabsWrap.nextElementSibling !== status) {
      panel.insertBefore(tabsWrap, status);
    }

    const loginSubmit = loginView.querySelector('.auth-submit');
    const signupSubmit = signupView.querySelector('.auth-submit');
    if (loginSubmit) loginSubmit.textContent = 'LOG IN';
    if (signupSubmit) signupSubmit.textContent = 'CREATE PLAYER';

    if (!document.querySelector('[data-rp-auth-clean-style]')) {
      const style = document.createElement('style');
      style.dataset.rpAuthCleanStyle = 'true';
      style.textContent = `
        .auth-overlay{
          padding:18px!important;
          background:rgba(1,4,9,.91)!important;
          backdrop-filter:blur(18px)!important;
          -webkit-backdrop-filter:blur(18px)!important;
        }
        .auth-panel.rp-auth-clean{
          width:min(100%,430px)!important;
          max-height:min(720px,calc(100dvh - 36px))!important;
          padding:30px 26px 25px!important;
          overflow-y:auto!important;
          clip-path:none!important;
          border:1px solid rgba(255,255,255,.09)!important;
          border-radius:22px!important;
          color:#f5f9fd!important;
          background:
            radial-gradient(circle at 8% 0%,rgba(29,192,255,.09),transparent 32%),
            radial-gradient(circle at 100% 18%,rgba(255,47,67,.055),transparent 28%),
            linear-gradient(155deg,#070c13 0%,#03070d 55%,#020409 100%)!important;
          box-shadow:0 30px 90px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.025)!important;
        }
        .auth-panel.rp-auth-clean::before{
          left:26px!important;
          right:auto!important;
          width:54px!important;
          height:2px!important;
          border-radius:999px!important;
          background:#42d8ff!important;
          box-shadow:0 0 18px rgba(66,216,255,.3)!important;
        }
        .auth-panel.rp-auth-clean::after{
          content:'';
          position:absolute;
          top:0;
          right:26px;
          width:34px;
          height:2px;
          border-radius:999px;
          background:#ff4b60;
          opacity:.72;
        }
        .rp-auth-clean .auth-close{
          top:16px!important;
          right:16px!important;
          width:32px!important;
          height:32px!important;
          border:1px solid rgba(255,255,255,.09)!important;
          border-radius:10px!important;
          background:rgba(255,255,255,.025)!important;
          color:#91a2b5!important;
          font-size:20px!important;
        }
        .rp-auth-clean .auth-close:hover,
        .rp-auth-clean .auth-close:focus-visible{
          color:#fff!important;
          border-color:rgba(66,216,255,.34)!important;
          outline:none!important;
        }
        .rp-auth-clean>.auth-kicker{
          margin:5px 42px 7px 0!important;
          color:#42d8ff!important;
          font-size:.56rem!important;
          font-weight:950!important;
          letter-spacing:.18em!important;
        }
        .rp-auth-clean>.auth-title{
          margin:0 42px 0 0!important;
          color:#f7fbff!important;
          font-family:Impact,'Arial Narrow',Arial,sans-serif!important;
          font-size:clamp(2rem,8vw,2.65rem)!important;
          font-style:italic!important;
          font-weight:950!important;
          line-height:.96!important;
          letter-spacing:-.025em!important;
        }
        .rp-auth-clean>.auth-subtitle{
          max-width:330px!important;
          margin:10px 0 23px!important;
          color:#7f90a4!important;
          font-size:.78rem!important;
          line-height:1.5!important;
        }
        .rp-auth-clean .auth-form{gap:13px!important}
        .rp-auth-clean .auth-field{gap:6px!important}
        .rp-auth-clean .auth-field label{
          color:#8fa0b3!important;
          font-size:.61rem!important;
          font-weight:900!important;
          letter-spacing:.1em!important;
        }
        .rp-auth-clean .auth-field input{
          min-height:52px!important;
          padding:0 14px!important;
          border:1px solid rgba(255,255,255,.085)!important;
          border-radius:13px!important;
          background:#02060b!important;
          color:#f7fbff!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.015)!important;
        }
        .rp-auth-clean .auth-field input::placeholder{color:#536276!important}
        .rp-auth-clean .auth-field input:focus{
          border-color:rgba(66,216,255,.48)!important;
          box-shadow:0 0 0 3px rgba(66,216,255,.07)!important;
        }
        .rp-auth-clean .auth-submit{
          min-height:50px!important;
          margin-top:5px!important;
          border:1px solid rgba(83,221,255,.34)!important;
          border-radius:13px!important;
          color:#031018!important;
          background:linear-gradient(135deg,#6be4ff,#35c8f4)!important;
          box-shadow:0 10px 26px rgba(29,187,238,.13),inset 0 1px 0 rgba(255,255,255,.42)!important;
          font-size:.72rem!important;
          font-weight:950!important;
          letter-spacing:.1em!important;
        }
        .rp-auth-clean .auth-tabs{
          display:block!important;
          margin:15px 0 0!important;
          text-align:center!important;
        }
        .rp-auth-clean .auth-tab{
          width:auto!important;
          min-height:0!important;
          padding:4px!important;
          border:0!important;
          background:transparent!important;
          color:#64758a!important;
          font-size:0!important;
          line-height:1.4!important;
        }
        .rp-auth-clean .auth-tab.active{display:none!important}
        .rp-auth-clean .auth-tab[data-auth-tab="signup"]:not(.active)::before{
          content:'New to Real Play?  CREATE FREE PLAYER';
          color:#718297;
          font-size:.69rem;
          font-weight:700;
          letter-spacing:.015em;
          text-transform:none;
        }
        .rp-auth-clean .auth-tab[data-auth-tab="login"]:not(.active)::before{
          content:'Already have a player?  LOG IN';
          color:#718297;
          font-size:.69rem;
          font-weight:700;
          letter-spacing:.015em;
          text-transform:none;
        }
        .rp-auth-clean .auth-tab[data-auth-tab="signup"]:not(.active)::after,
        .rp-auth-clean .auth-tab[data-auth-tab="login"]:not(.active)::after{
          content:'';
        }
        .rp-auth-clean .auth-tab:not(.active):hover,
        .rp-auth-clean .auth-tab:not(.active):focus-visible{
          color:#58dfff!important;
          outline:none!important;
        }
        .rp-auth-clean[data-rp-auth-mode="signup"] [data-auth-view="signup"]>.auth-divider,
        .rp-auth-clean[data-rp-auth-mode="signup"] [data-auth-view="signup"]>.auth-note{
          display:none!important;
        }
        .rp-auth-clean[data-rp-auth-mode="login"] .auth-status,
        .rp-auth-clean[data-rp-auth-mode="signup"] .auth-status{
          min-height:18px!important;
          margin:10px 0 0!important;
          font-size:.68rem!important;
          text-align:center!important;
        }
        @media(max-width:620px){
          .auth-overlay{padding:10px!important;place-items:center!important}
          .auth-panel.rp-auth-clean{
            width:100%!important;
            max-height:calc(100dvh - 20px)!important;
            padding:26px 20px 22px!important;
            border-radius:20px!important;
          }
          .rp-auth-clean>.auth-title{font-size:2.15rem!important}
          .rp-auth-clean>.auth-subtitle{margin-bottom:20px!important}
        }
      `;
      document.head.appendChild(style);
    }

    const kicker = panel.querySelector(':scope > .auth-kicker');
    const title = panel.querySelector(':scope > .auth-title');
    const subtitle = panel.querySelector(':scope > .auth-subtitle');

    function syncHeading() {
      let mode = 'account';
      if (!loginView.hidden) mode = 'login';
      else if (!signupView.hidden) mode = 'signup';
      else if (completeView && !completeView.hidden) mode = 'complete';
      else if (accountView && !accountView.hidden) mode = 'account';
      panel.dataset.rpAuthMode = mode;

      if (mode === 'login') {
        if (kicker) kicker.textContent = 'REAL PLAY BASKETBALL';
        if (title) title.textContent = 'WELCOME BACK.';
        if (subtitle) subtitle.textContent = 'Log in to your player account.';
      } else if (mode === 'signup') {
        if (kicker) kicker.textContent = 'REAL PLAY BASKETBALL';
        if (title) title.textContent = 'CREATE YOUR PLAYER.';
        if (subtitle) subtitle.textContent = 'Build your free Real Play identity and start your official court history.';
      } else if (mode === 'complete') {
        if (kicker) kicker.textContent = 'REAL PLAY BASKETBALL';
        if (title) title.textContent = 'FINISH YOUR PLAYER.';
        if (subtitle) subtitle.textContent = 'One last step before your Real Play identity is ready.';
      } else {
        if (kicker) kicker.textContent = 'REAL PLAY PLAYER';
        if (title) title.textContent = 'YOUR COURT ID.';
        if (subtitle) subtitle.textContent = 'Your player identity, number and Real Play account.';
      }
    }

    // Observe only which auth view becomes hidden/visible. Text/style changes made
    // by syncHeading are outside this observer, so this cannot create the old
    // child-list feedback loop that caused startup to hang.
    const modeObserver = new MutationObserver(syncHeading);
    [loginView, signupView, completeView, accountView].filter(Boolean).forEach((view) => {
      modeObserver.observe(view, { attributes: true, attributeFilter: ['hidden'] });
    });

    syncHeading();
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-auth-complete-form] input[name="player_name"]')) {
      applyNameCarryForward();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-profile-choice-create]')) return;
    setTimeout(() => applyNameCarryForward(), 0);
  });

  document.addEventListener('submit', (event) => {
    const signup = event.target.closest?.('[data-auth-signup-form]');
    if (!signup) return;
    const value = signup.querySelector('[name="name"]')?.value;
    rememberName(value);
  }, true);

  applyNameCarryForward();
  installCleanLogin();
})();