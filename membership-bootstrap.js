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
      // Keep this copy identical to membership.js. The previous bootstrap copy
      // differed by a few words, so once the membership API became live the two
      // MutationObservers continuously rewrote this node back and forth and
      // starved the browser's main thread.
      const copy = 'Log in or create your free Real Play player identity. Membership is only required when you secure an official weekly game slot.';
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
    script.src = 'membership.js?v=20260903-membership-freeze-fix-v1';
    script.async = false;
    script.dataset.rpMembershipScript = 'true';
    script.onerror = () => {
      membershipLoaded = false;
      script.remove();
    };
    document.head.appendChild(script);
  }

  async function probeMembershipService() {
    // Once membership.js owns the membership UI, bootstrap must stop touching
    // the same DOM nodes. This prevents competing observers/rewrites.
    if (!membershipLoaded) relabelFreePlayerEntry();

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

  // Do not observe the entire document here. membership.js already performs
  // the live DOM synchronization after it loads; a second broad observer was
  // the source of the immediate page freeze when the backend endpoint changed
  // from 404 to 200.
  window.addEventListener('focus', probeMembershipService);
  window.addEventListener('storage', (event) => { if (event.key === TOKEN_KEY) probeMembershipService(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) probeMembershipService(); });

  relabelFreePlayerEntry();
  probeMembershipService();
  window.setInterval(probeMembershipService, 5000);
})();
