(() => {
  if (!window.__realPlayAdminDomScoreSyncInstalledV3) {
    window.__realPlayAdminDomScoreSyncInstalledV3 = true;

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

    function calculate() {
      const root = document.querySelector('.rp-admin-control.open');
      if (!root) return null;

      const scores = { west: 0, east: 0 };
      let players = 0;

      root.querySelectorAll('.rp-admin-stat-player').forEach((card) => {
        const team = playerCardTeam(card);
        if (team !== 'west' && team !== 'east') return;
        scores[team] += playerCardPoints(card);
        players += 1;
      });

      return players ? { root, scores } : null;
    }

    function writeScore() {
      const state = calculate();
      if (!state) return;

      const { root, scores } = state;
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
    function queue() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        writeScore();
      });
    }

    const observer = new MutationObserver(queue);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-control-action="stat"]')) return;
      queue();
      window.setTimeout(writeScore, 50);
      window.setTimeout(writeScore, 250);
      window.setTimeout(writeScore, 750);
    }, true);

    window.setInterval(writeScore, 250);
    window.addEventListener('focus', writeScore);
    queue();
  }

  // Startup safety net. If the newer mobile lobby has not mounted, reload only
  // that critical layer instead of leaving the user on the hidden legacy page.
  function rescueLobby() {
    if (document.querySelector('[data-rp-app]')) return;

    const version = '20260829-1014-rescue';
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
})();
