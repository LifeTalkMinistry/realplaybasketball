(() => {
  if (window.__realPlayAdminLiveRefreshFixInstalled) return;
  window.__realPlayAdminLiveRefreshFixInstalled = true;

  // LIVE-scoring refresh behavior is retired. This file remains in the global
  // enhancement loader, so use it as a lightweight compatibility guard for the
  // old backend placeholder that could exist before an admin actually opened a
  // Career session.

  let rootObserver = null;
  let bootObserver = null;
  let queued = false;

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function queueScrub() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      scrubPhantomSession();
    });
  }

  function isUntouchedLegacyPlaceholder(card) {
    if (!card) return false;

    const title = normalize(card.querySelector('.rp-admin-card-head strong')?.textContent);
    if (title !== 'CAREER SESSION') return false;

    const values = [...card.querySelectorAll('.rp-admin-meta em')].map((item) => normalize(item.textContent));
    if (values.length < 3) return false;

    const [date, court, players] = values;
    const zeroPlayers = /^0(?:\s*\/\s*\d+)?\s+CONFIRMED$/.test(players);

    return date === 'NOT SET' && court === 'NOT SET' && zeroPlayers;
  }

  function scrubPhantomSession() {
    const root = document.querySelector('.rp-admin-control');
    if (!root) return;

    let removed = false;
    for (const card of root.querySelectorAll('.rp-admin-session-summary')) {
      if (!isUntouchedLegacyPlaceholder(card)) continue;
      card.remove();
      removed = true;
    }

    if (!removed) return;

    const toggle = root.querySelector('[data-admin-new-session-toggle]');
    if (toggle && /OPEN NEXT SESSION/i.test(toggle.textContent || '')) {
      toggle.textContent = '+ OPEN SESSION';
    }
  }

  function watchAdminRoot() {
    const root = document.querySelector('.rp-admin-control');
    if (!root || rootObserver) return false;

    rootObserver = new MutationObserver(queueScrub);
    rootObserver.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    queueScrub();
    return true;
  }

  if (!watchAdminRoot()) {
    bootObserver = new MutationObserver(() => {
      if (!watchAdminRoot()) return;
      bootObserver?.disconnect();
      bootObserver = null;
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // admin-game-control-simplify.js performs its compact-card conversion on the
  // next animation frame after this event. Queue two frames so the guard always
  // evaluates the final compact DOM rather than racing the simplifier.
  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(queueScrub));
  });
})();
