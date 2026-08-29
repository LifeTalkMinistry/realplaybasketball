(() => {
  if (window.__realPlayAdminDomScoreSyncInstalled) return;
  window.__realPlayAdminDomScoreSyncInstalled = true;

  function number(value) {
    const parsed = Number.parseInt(String(value || '').replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function deriveVisibleScores(root) {
    const scores = { west: 0, east: 0 };
    root.querySelectorAll('.rp-admin-stat-player').forEach((card) => {
      const team = String(card.querySelector('.rp-admin-stat-player-head .rp-admin-pill')?.textContent || '')
        .trim()
        .toLowerCase();
      if (team !== 'west' && team !== 'east') return;

      const stats = card.querySelectorAll('.rp-admin-stat');
      if (!stats.length) return;
      const pts = number(stats[0].querySelector('strong')?.textContent);
      scores[team] += pts;
    });
    return scores;
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }

  function sync() {
    const root = document.querySelector('.rp-admin-control.open');
    if (!root) return;

    const playerCards = root.querySelectorAll('.rp-admin-stat-player');
    if (!playerCards.length) return;

    const scores = deriveVisibleScores(root);
    const scoreSides = root.querySelectorAll('.rp-admin-scoreboard .rp-admin-score-side strong');
    if (scoreSides.length >= 2) {
      setText(scoreSides[0], scores.west);
      setText(scoreSides[1], scores.east);
    }

    const livebarScore = root.querySelector('.rp-admin-livebar > span:last-child');
    if (livebarScore && /\d+\s*[–-]\s*\d+/.test(livebarScore.textContent || '')) {
      setText(livebarScore, `${scores.west}–${scores.east}`);
    }
  }

  let queued = false;
  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }

  const observer = new MutationObserver(queueSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-control-action="stat"]')) {
      window.setTimeout(queueSync, 0);
      window.setTimeout(queueSync, 150);
      window.setTimeout(queueSync, 500);
    }
  }, true);

  window.addEventListener('focus', queueSync);
  queueSync();
})();
