(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

  // Real Play is public-first: no account is required to browse the stable Home
  // shell. Participation/account gates continue to protect identity-only actions.
  if (!window.localStorage.getItem(TOKEN_KEY)) {
    window.localStorage.setItem(VISITOR_KEY, '1');
  } else {
    window.localStorage.removeItem(VISITOR_KEY);
  }

  // Admin Home editing and Game Control cleanup are intentionally feature-owned.
  // They are loaded only after trusted Admin access is requested/verified.
})();
