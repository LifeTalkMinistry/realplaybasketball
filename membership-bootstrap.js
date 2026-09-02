(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let membershipLoaded = false;
  let probing = false;

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

  async function probeMembershipService() {
    relabelFreePlayerEntry();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || membershipLoaded || probing) return;

    probing = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/membership`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (response.ok) loadMembershipExperience();
    } catch (_error) {
      // Preserve the existing Career flow until the membership API is live.
    } finally {
      probing = false;
    }
  }

  const observer = new MutationObserver(relabelFreePlayerEntry);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('focus', probeMembershipService);
  window.addEventListener('storage', (event) => { if (event.key === TOKEN_KEY) probeMembershipService(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) probeMembershipService(); });

  relabelFreePlayerEntry();
  probeMembershipService();
  window.setInterval(probeMembershipService, 5000);
})();
