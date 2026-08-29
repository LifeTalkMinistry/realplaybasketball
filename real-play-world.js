(() => {
  if (window.__realPlayWorldInstalled) return;
  window.__realPlayWorldInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const categories = [
    { key: 'ovr', label: 'OVR' },
    { key: 'pts', label: 'PTS' },
    { key: 'ast', label: 'AST' },
    { key: 'reb', label: 'REB' },
  ];

  let activeKey = 'ovr';
  let lastState = null;
  let refreshing = false;
  let panel = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

  function normalizeRows(rows, key) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({
      ...row,
      rank: Number(row.rank || index + 1),
      value: Number(row.value ?? row[key] ?? row.rating ?? row.points ?? 0),
      playerName: row.playerName || row.player_name || row.name || 'REAL PLAY PLAYER',
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      games: Number(row.games || row.gamesPlayed || 0),
    }));
  }

  function stateLeaderboards(state) {
    const boards = state?.leaderboards || {};
    return {
      ovr: normalizeRows(boards.ovr || state?.ovrLeaderboard || state?.leaderboard, 'ovr'),
      pts: normalizeRows(boards.pts || [], 'pts'),
      ast: normalizeRows(boards.ast || [], 'ast'),
      reb: normalizeRows(boards.reb || [], 'reb'),
    };
  }

  function currentPlayerName(state) {
    return String(pick(
      state?.profile?.player_name,
      state?.profile?.playerName,
      document.querySelector('[data-rp-name]')?.textContent,
      ''
    ) || '').trim();
  }

  function activeSession(state) {
    return pick(
      state?.nextCareerSession,
      state?.next_career_session,
      state?.activeCareerSession,
      state?.active_career_session,
      state?.careerSession,
      state?.career_session,
      state?.upcomingCareerSession,
      state?.upcoming_career_session
    ) || null;
  }

  function formatSessionTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date);
  }

  function worldFeed(state, boards) {
    const feed = [];
    const ovrLeader = boards.ovr[0];
    const ptsLeader = boards.pts[0];
    const astLeader = boards.ast[0];
    const rebLeader = boards.reb[0];
    const session = activeSession(state);

    if (session) {
      const title = pick(session.title, 'CAREER SESSION');
      const confirmed = Number(pick(session.confirmedCount, session.confirmed_count, session.reserved, 0));
      const timing = formatSessionTime(pick(session.startsAt, session.starts_at));
      const gameStatus = String(pick(session.gameStatus, session.game_status, session.status, '')).toLowerCase();
      const open = Boolean(pick(session.bookable, session.canBook, session.available, gameStatus === 'setup'));
      feed.push({
        icon: '◎',
        kicker: open ? 'SESSION OPEN' : 'CAREER SESSION',
        title: String(title).toUpperCase(),
        copy: [timing, confirmed ? `${confirmed} confirmed player${confirmed === 1 ? '' : 's'}` : '', open ? 'Spots can still be secured.' : 'Real Play has posted this session.'].filter(Boolean).join(' · '),
      });
    }

    if (ovrLeader) {
      feed.push({
        icon: '↑', kicker: 'OVR LEADER',
        title: `${ovrLeader.playerName} LEADS THE BETA BOARD`,
        copy: `${ovrLeader.value} OVR · ${ovrLeader.wins}-${ovrLeader.losses} record across ${ovrLeader.games} Career game${ovrLeader.games === 1 ? '' : 's'}.`,
      });
    }
    if (ptsLeader) {
      feed.push({
        icon: '●', kicker: 'SCORING',
        title: `${ptsLeader.playerName} IS #1 IN POINTS`,
        copy: `${ptsLeader.value} verified Career points currently leads Real Play Beta.`,
      });
    }
    if (astLeader && astLeader.playerName !== ptsLeader?.playerName) {
      feed.push({
        icon: '↗', kicker: 'PLAYMAKING',
        title: `${astLeader.playerName} LEADS IN ASSISTS`,
        copy: `${astLeader.value} verified assists on the Beta board.`,
      });
    }
    if (rebLeader && rebLeader.playerName !== ptsLeader?.playerName && rebLeader.playerName !== astLeader?.playerName) {
      feed.push({
        icon: '◇', kicker: 'REBOUNDING',
        title: `${rebLeader.playerName} LEADS THE GLASS`,
        copy: `${rebLeader.value} verified rebounds on the Beta board.`,
      });
    }

    const recent = Array.isArray(state?.recentGames) ? state.recentGames[0] : null;
    if (recent) {
      const score = `${Number(recent.westScore || 0)}–${Number(recent.eastScore || 0)}`;
      feed.push({
        icon: '✓', kicker: 'YOUR LATEST',
        title: `${String(recent.result || 'VERIFIED').toUpperCase()} · ${String(recent.label || 'CAREER GAME').toUpperCase()}`,
        copy: `${score} final · ${Number(recent.pts || 0)} PTS · ${Number(recent.ast || 0)} AST · ${Number(recent.reb || 0)} REB.`,
      });
    }

    return feed.slice(0, 5);
  }

  function createPanel() {
    if (panel || document.querySelector('[data-rp-world]')) {
      panel = document.querySelector('[data-rp-world]');
      return panel;
    }

    panel = document.createElement('section');
    panel.className = 'rp-world';
    panel.dataset.rpWorld = 'true';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="rp-world-shell">
        <header class="rp-world-topbar">
          <button class="rp-world-back" type="button" data-world-close aria-label="Back to Play">←</button>
          <div class="rp-world-title"><strong>WORLD</strong><span>REAL PLAY BASKETBALL</span></div>
          <div class="rp-world-live">BETA LIVE</div>
        </header>

        <section class="rp-world-hero">
          <span class="rp-world-kicker">REAL PLAY WORLD</span>
          <h1>The board is alive.</h1>
          <p>See who is moving, who is leading, and what is happening across verified Real Play Career activity.</p>
          <div class="rp-world-metrics">
            <article><span>RANKED PLAYERS</span><strong data-world-player-count>0</strong></article>
            <article><span>TOP OVR</span><strong data-world-top-ovr>—</strong></article>
            <article><span>YOUR RANK</span><strong data-world-my-rank>—</strong></article>
          </div>
        </section>

        <section class="rp-world-section">
          <div class="rp-world-section-head"><div><small>WHO'S MOVING UP?</small><h2>Beta Leaderboard</h2></div><span data-world-board-label>OVR</span></div>
          <div class="rp-world-tabs">
            ${categories.map((item, index) => `<button type="button" class="rp-world-tab${index === 0 ? ' active' : ''}" data-world-stat="${item.key}">${item.label}</button>`).join('')}
          </div>
          <div class="rp-world-board" data-world-board>
            <div class="rp-world-empty"><strong>THE BOARD IS WAITING FOR VERIFIED GAMES.</strong><p>Finalized Career results automatically build Real Play World.</p></div>
          </div>
        </section>

        <section class="rp-world-section">
          <div class="rp-world-section-head"><div><small>REAL PLAY RIGHT NOW</small><h2>What's Happening</h2></div><span>LIVE FEED</span></div>
          <div class="rp-world-feed" data-world-feed>
            <div class="rp-world-empty"><strong>WORLD IS QUIET FOR NOW.</strong><p>Sessions, leaders and verified Career movement will appear here.</p></div>
          </div>
        </section>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelector('[data-world-close]')?.addEventListener('click', closeWorld);
    panel.querySelectorAll('[data-world-stat]').forEach((button) => {
      button.addEventListener('click', () => {
        activeKey = button.dataset.worldStat || 'ovr';
        render(lastState);
      });
    });
    return panel;
  }

  function render(state) {
    const root = createPanel();
    if (!root) return;
    const boards = stateLeaderboards(state || {});
    const rows = boards[activeKey] || [];
    const me = currentPlayerName(state || {}).toLowerCase();
    const ovrRows = boards.ovr;
    const myRow = ovrRows.find((row) => String(row.playerName).trim().toLowerCase() === me) || null;

    root.querySelector('[data-world-player-count]').textContent = String(ovrRows.length);
    root.querySelector('[data-world-top-ovr]').textContent = ovrRows.length ? String(ovrRows[0].value) : '—';
    root.querySelector('[data-world-my-rank]').textContent = myRow ? `#${myRow.rank}` : '—';
    root.querySelector('[data-world-board-label]').textContent = categories.find((item) => item.key === activeKey)?.label || 'OVR';

    root.querySelectorAll('[data-world-stat]').forEach((button) => button.classList.toggle('active', button.dataset.worldStat === activeKey));

    const board = root.querySelector('[data-world-board]');
    if (!rows.length) {
      board.innerHTML = '<div class="rp-world-empty"><strong>THE BOARD IS WAITING FOR VERIFIED GAMES.</strong><p>Finalized Career results automatically build Real Play World.</p></div>';
    } else {
      const label = categories.find((item) => item.key === activeKey)?.label || activeKey.toUpperCase();
      board.innerHTML = rows.slice(0, 20).map((row) => {
        const mine = String(row.playerName).trim().toLowerCase() === me;
        return `<article class="rp-world-row${mine ? ' you' : ''}">
          <em>#${esc(row.rank)}</em>
          <div class="rp-world-player"><strong>${esc(row.playerName)}${mine ? ' · YOU' : ''}</strong><small>${row.wins}-${row.losses} · ${row.games} GAME${row.games === 1 ? '' : 'S'}</small></div>
          <div class="rp-world-value"><strong>${esc(row.value)}</strong><span>${esc(label)}</span></div>
        </article>`;
      }).join('');
    }

    const feed = root.querySelector('[data-world-feed]');
    const items = worldFeed(state || {}, boards);
    feed.innerHTML = items.length ? items.map((item) => `<article class="rp-world-feed-item">
      <div class="rp-world-feed-icon">${esc(item.icon)}</div>
      <div><small>${esc(item.kicker)}</small><strong>${esc(item.title)}</strong><p>${esc(item.copy)}</p></div>
    </article>`).join('') : '<div class="rp-world-empty"><strong>WORLD IS QUIET FOR NOW.</strong><p>Sessions, leaders and verified Career movement will appear here.</p></div>';
  }

  async function refreshWorld() {
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token || refreshing) return;
    refreshing = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      lastState = await response.json().catch(() => ({}));
      render(lastState);
    } catch (_error) {
      // World stays available with the last verified snapshot if the API is temporarily unavailable.
    } finally {
      refreshing = false;
    }
  }

  function setWorldNavActive(active) {
    document.querySelectorAll('[data-rp-bottom-nav] .rp-nav-item').forEach((button) => {
      button.classList.toggle('active', active && button.dataset.rpNav === 'world');
    });
    if (!active) {
      document.querySelector('[data-rp-nav="play"]')?.classList.add('active');
    }
  }

  function openWorld() {
    createPanel();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-world-open');
    panel.scrollTop = 0;
    setWorldNavActive(true);
    render(lastState || {});
    refreshWorld();
  }

  function closeWorld() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-world-open');
    setWorldNavActive(false);
  }

  function repurposeNavigation() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return false;

    const oldProfileNav = app.querySelector('[data-rp-nav="player"], [data-rp-nav="profile"]');
    if (oldProfileNav) {
      oldProfileNav.dataset.rpNav = 'world';
      oldProfileNav.innerHTML = '<span>◎</span>WORLD';
      oldProfileNav.setAttribute('aria-label', 'Open Real Play World');
    }

    const quickProfile = app.querySelector('[data-rp-action="profile"]');
    if (quickProfile) {
      quickProfile.dataset.rpAction = 'world';
      const strong = quickProfile.querySelector('strong');
      const copy = quickProfile.querySelector('span');
      if (strong) strong.textContent = 'WORLD';
      if (copy) copy.textContent = 'Leaders & updates';
    }

    createPanel();
    return true;
  }

  // Capture these taps before the legacy lobby handler treats the old third slot as Profile/More.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-nav="world"], [data-rp-action="world"]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWorld();
  }, true);

  window.addEventListener('focus', () => {
    if (panel?.classList.contains('open')) refreshWorld();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel?.classList.contains('open')) closeWorld();
  });

  if (!repurposeNavigation()) {
    const observer = new MutationObserver(() => {
      if (repurposeNavigation()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
