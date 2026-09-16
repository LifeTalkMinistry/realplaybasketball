(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let membershipLoaded = false;
  let probing = false;
  let probedToken = '';

  function relabelFreePlayerEntry() {
    const kicker = document.querySelector('.auth-kicker');
    const subtitle = document.querySelector('.auth-subtitle');
    const signupTab = document.querySelector('[data-auth-tab="signup"]');
    const signupSubmit = document.querySelector('[data-auth-signup-form] button[type="submit"]');
    const completeSubmit = document.querySelector('[data-auth-complete-form] button[type="submit"]');

    if (kicker && kicker.textContent !== 'REAL PLAY PLAYER ACCESS') kicker.textContent = 'REAL PLAY PLAYER ACCESS';
    if (subtitle && !subtitle.closest('[data-auth-view="complete"]')) {
      const copy = 'Log in or create your free Real Play player identity. Membership is required only when you secure an official weekly game slot.';
      if (subtitle.textContent !== copy) subtitle.textContent = copy;
    }
    if (signupTab && signupTab.textContent !== 'CREATE FREE PLAYER') signupTab.textContent = 'CREATE FREE PLAYER';
    if (signupSubmit && signupSubmit.textContent !== 'CREATE MY PLAYER') signupSubmit.textContent = 'CREATE MY PLAYER';
    if (completeSubmit && completeSubmit.textContent !== 'CREATE MY PLAYER') completeSubmit.textContent = 'CREATE MY PLAYER';
  }

  function loadMembershipExperience() {
    if (membershipLoaded || document.querySelector('script[data-rp-membership-script]')) return;
    membershipLoaded = true;
    const script = document.createElement('script');
    script.src = 'membership.js?v=20260902-membership-v1';
    script.async = false;
    script.dataset.rpMembershipScript = 'true';
    script.onerror = () => { membershipLoaded = false; script.remove(); };
    document.head.appendChild(script);
  }

  function loadTokenCancellationFlow() {
    if (document.querySelector('script[data-rp-token-cancellation-flow]')) return;
    const script = document.createElement('script');
    script.src = 'ranking-token-cancellation-flow.js?v=20260916-token-cutoff-v1';
    script.async = true;
    script.dataset.rpTokenCancellationFlow = 'true';
    document.head.appendChild(script);
  }

  function loadRankingEntryActions() {
    if (document.querySelector('script[data-rp-entry-actions]')) {
      loadTokenCancellationFlow();
      return;
    }
    const actions = document.createElement('script');
    actions.src = 'ranking-game-entry-actions.js?v=20260916-token-cutoff-v2';
    actions.async = true;
    actions.dataset.rpEntryActions = 'true';
    actions.onload = () => {
      if (document.querySelector('script[data-rp-entry-open-state]')) {
        loadTokenCancellationFlow();
        return;
      }
      const state = document.createElement('script');
      state.src = 'ranking-game-entry-open-state.js?v=20260916-token-cutoff-v2';
      state.async = true;
      state.dataset.rpEntryOpenState = 'true';
      state.onload = loadTokenCancellationFlow;
      state.onerror = loadTokenCancellationFlow;
      document.head.appendChild(state);
    };
    document.head.appendChild(actions);
  }

  async function probeMembershipService() {
    relabelFreePlayerEntry();
    const token = localStorage.getItem(TOKEN_KEY) || '';

    if (!token) {
      probedToken = '';
      return false;
    }

    if (membershipLoaded) return true;
    if (probing || probedToken === token) return false;

    probing = true;
    probedToken = token;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/membership`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        loadMembershipExperience();
        return true;
      }
    } catch (_error) {
      // Keep the rest of Real Play usable if the optional membership service is offline.
    } finally {
      probing = false;
    }
    return false;
  }

  const observer = new MutationObserver(relabelFreePlayerEntry);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.(
      '[data-auth-membership-card], [data-membership-open], [data-plus-one-prompt], [data-rp-settings-action="membership"], [data-session-action]'
    );
    if (target) probeMembershipService();
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    probedToken = '';
  });

  window.__realPlayEnsureMembership = probeMembershipService;
  loadRankingEntryActions();
  relabelFreePlayerEntry();
})();
