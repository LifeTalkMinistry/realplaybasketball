(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

  // Real Play is public-first: no account is required to browse the live
  // community, players, public chat, schedules, results, or announcements.
  // Existing participation gates remain responsible for asking visitors to
  // create/sign in to a player account only when identity is actually needed.
  if (!window.localStorage.getItem(TOKEN_KEY)) {
    window.localStorage.setItem(VISITOR_KEY, '1');
  } else {
    window.localStorage.removeItem(VISITOR_KEY);
  }
})();
