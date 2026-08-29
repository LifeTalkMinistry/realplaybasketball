(() => {
  if (window.__realPlayAdminDomScoreSyncInstalledV4) return;
  window.__realPlayAdminDomScoreSyncInstalledV4 = true;

  function readNumber(value) {
    const parsed = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function playerCardPoints(card) {
    const ptsControl = card.querySelector('[data-control-action="stat"][data-stat="pts"]');
    const ptsBox = ptsControl?.closest('.rp-admin-stat') || card.querySelector('.rp-admin-stat');
    return readNumber(ptsBox?.querySelector('strong')?.textContent);
  }

  function playerCardTeam(card) {
    return String(card.querySelector('.rp-admin-stat-player-head .rp-admin-pill')?.textContent || '')
      .trim()
      .toLowerCase();
  }

  function calculate(root) {
    if (!root?.classList.contains('open')) return null;
    const scores = { west: 0, east: 0 };
    let players = 0;

    root.querySelectorAll('.rp-admin-stat-player').forEach((card) => {
      const team = playerCardTeam(card);
      if (team !== 'west' && team !== 'east') return;
      scores[team] += playerCardPoints(card);
      players += 1;
    });

    return players ? scores : null;
  }

  function writeScore(root = document.querySelector('.rp-admin-control')) {
    const scores = calculate(root);
    if (!scores) return;

    root.querySelectorAll('.rp-admin-scoreboard').forEach((scoreboard) => {
      const sides = scoreboard.querySelectorAll('.rp-admin-score-side strong');
      if (sides.length < 2) return;
      if (sides[0].textContent !== String(scores.west)) sides[0].textContent = String(scores.west);
      if (sides[1].textContent !== String(scores.east)) sides[1].textContent = String(scores.east);
    });

    const livebar = root.querySelector('.rp-admin-livebar > span:last-child');
    if (livebar && /\d+\s*[–-]\s*\d+/.test(livebar.textContent || '')) {
      const next = `${scores.west}–${scores.east}`;
      if (livebar.textContent !== next) livebar.textContent = next;
    }
  }

  let raf = 0;
  function queue(root) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      writeScore(root);
    });
  }

  function attach(root) {
    if (!root || root.dataset.scoreSyncReady === 'true') return Boolean(root);
    root.dataset.scoreSyncReady = 'true';

    // Observe only the admin control subtree. The previous whole-document
    // observer + 250ms interval kept waking up the entire app and caused lag.
    const observer = new MutationObserver(() => queue(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    queue(root);
    return true;
  }

  function boot() {
    const existing = document.querySelector('.rp-admin-control');
    if (existing && attach(existing)) return;

    const observer = new MutationObserver(() => {
      const root = document.querySelector('.rp-admin-control');
      if (!root || !attach(root)) return;
      observer.disconnect();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('click', (event) => {
    const statButton = event.target.closest('[data-control-action="stat"]');
    if (!statButton) return;
    const root = statButton.closest('.rp-admin-control');
    queue(root);
    window.setTimeout(() => writeScore(root), 60);
    window.setTimeout(() => writeScore(root), 300);
  }, true);

  window.addEventListener('focus', () => writeScore());

  // Startup safety net. If the newer mobile lobby has not mounted, retry only
  // that critical layer once or twice; no recurring loop is left running.
  function rescueLobby() {
    if (document.querySelector('[data-rp-app]')) return;

    const version = '20260829-1018-rescue';
    ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css'].forEach((href) => {
      const alreadyLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .some((link) => String(link.href || '').includes(href));
      if (alreadyLoaded) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${href}?v=${version}`;
      document.head.appendChild(link);
    });

    if (!document.querySelector('script[data-rp-lobby-rescue]')) {
      const script = document.createElement('script');
      script.src = `mobile-lobby.js?v=${version}`;
      script.async = false;
      script.dataset.rpLobbyRescue = 'true';
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(rescueLobby, 350), { once: true });
  } else {
    window.setTimeout(rescueLobby, 350);
  }
  window.setTimeout(rescueLobby, 1200);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
