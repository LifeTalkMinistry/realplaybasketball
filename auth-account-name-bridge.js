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
      // Legacy fallback: only leave the field visible if the account name cannot
      // be recovered. Normal register/login flows never need to type it twice.
      return;
    }

    input.value = name;
    input.type = 'hidden';
    input.autocomplete = 'off';
    const field = input.closest('.auth-field');
    if (field) field.hidden = true;

    let summary = form.querySelector('[data-carried-player-name]');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'auth-carried-player-name';
      summary.dataset.carriedPlayerName = '';
      summary.innerHTML = '<span>PLAYER NAME</span><strong></strong><small>Carried from your Real Play account.</small>';
      form.prepend(summary);
    }
    summary.querySelector('strong').textContent = name;
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
})();
