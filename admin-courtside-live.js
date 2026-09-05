(() => {
  if (window.__realPlayCourtsideLiveInstalled) return;
  window.__realPlayCourtsideLiveInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let selectedUserId = null;
  let lastSnapshot = null;
  let scheduled = false;
  let hydrationSequence = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function shortSessionTitle() {
    const raw = root()?.querySelector('[data-admin-livebar] strong')?.textContent.trim() || 'OPEN RANK GAME';
    const match = raw.match(/#\s*(\d+)/);
    return match ? `CAREER #${String(Number(match[1])).padStart(3, '0')}` : raw;
  }

  function parseScoreboard(scope) {
    const sides = [...scope.querySelectorAll('.rp-admin-score-side')].map((side) => ({
      team: side.querySelector('small')?.textContent.trim().toUpperCase() || '',
      score: Number(side.querySelector('strong')?.textContent.trim() || 0),
    }));
    const west = sides.find((side) => side.team === 'WEST')?.score || 0;
    const east = sides.find((side) => side.team === 'EAST')?.score || 0;
    return { west, east };
  }

  function parsePlayers(scope) {
    return [...scope.querySelectorAll('.rp-admin-stat-player')].map((card) => {
      const action = card.querySelector('[data-control-action="stat"]');
      if (!action) return null;
      const stats = { PTS: 0, MAKE: 0, MISS: 0, AST: 0, REB: 0, TO: 0, STL: 0, BLK: 0, FOUL: 0 };
      card.querySelectorAll('.rp-admin-stat').forEach((box) => {
        const key = box.querySelector('label')?.textContent.trim().toUpperCase();
        if (key && Object.hasOwn(stats, key)) stats[key] = Number(box.querySelector('strong')?.textContent.trim() || 0);
      });
      return {
        userId: String(action.dataset.userId || ''),
        label: card.querySelector('.rp-admin-stat-player-head strong')?.textContent.trim() || 'PLAYER',
        team: card.querySelector('.rp-admin-stat-player-head .rp-admin-pill')?.textContent.trim().toUpperCase() || '',
        stats,
      };
    }).filter(Boolean).sort((a, b) => {
      const aNum = Number(a.label.match(/#(\d+)/)?.[1] ?? 999);
      const bNum = Number(b.label.match(/#(\d+)/)?.[1] ?? 999);
      return aNum - bNum || a.label.localeCompare(b.label);
    });
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined
      ? '#--'
      : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function snapshotFromControl(control) {
    if (!control?.session) return null;
    const players = (control.players || [])
      .filter((player) => player.checkedIn && player.team)
      .map((player) => ({
        userId: String(player.userId ?? player.playerId ?? ''),
        label: playerLabel(player),
        team: String(player.team || '').toUpperCase(),
        stats: {
          PTS: Number(player.stats?.pts || 0),
          MAKE: Number(player.stats?.make || 0),
          MISS: Number(player.stats?.miss || 0),
          AST: Number(player.stats?.ast || 0),
          REB: Number(player.stats?.reb || 0),
          TO: Number(player.stats?.tov || 0),
          STL: Number(player.stats?.stl || 0),
          BLK: Number(player.stats?.blk || 0),
          FOUL: Number(player.stats?.foul || 0),
        },
      }))
      .sort((a, b) => {
        const aNum = Number(a.label.match(/#(\d+)/)?.[1] ?? 999);
        const bNum = Number(b.label.match(/#(\d+)/)?.[1] ?? 999);
        return aNum - bNum || a.label.localeCompare(b.label);
      });

    return {
      score: {
        west: Number(control.session.westScore || 0),
        east: Number(control.session.eastScore || 0),
      },
      players,
      gameStatus: String(control.session.gameStatus || ''),
    };
  }

  async function fetchExpandedSnapshot() {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      return snapshotFromControl(data?.control || null);
    } catch (_) {
      return null;
    }
  }

  function scoreboardHtml(score) {
    return `<div class="rp-admin-scoreboard">
      <div class="rp-admin-score-side"><small>WEST</small><strong>${score.west}</strong></div>
      <div class="rp-admin-score-dash">—</div>
      <div class="rp-admin-score-side"><small>EAST</small><strong>${score.east}</strong></div>
    </div>`;
  }

  function rosterHtml(team, players) {
    const teamPlayers = players.filter((player) => player.team === team);
    const rows = teamPlayers.length
      ? teamPlayers.map((player) => `<button type="button" class="rp-courtside-player" data-courtside-player="${esc(player.userId)}">${esc(player.label)}</button>`).join('')
      : '<div class="rp-courtside-empty">NO PLAYERS</div>';
    return `<section class="rp-courtside-team">
      <div class="rp-courtside-team-head"><span>${team}</span><span>${teamPlayers.length}</span></div>
      <div class="rp-courtside-player-list">${rows}</div>
    </section>`;
  }

  function statActions(player, stat) {
    const userId = esc(player.userId);
    if (stat === 'pts') {
      return `<div class="rp-courtside-stat-actions points">
        <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="pts" data-delta="-1">−</button>
        <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="pts" data-delta="1">+1</button>
        <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="pts" data-delta="2">+2</button>
        <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="pts" data-delta="3">+3</button>
      </div>`;
    }
    return `<div class="rp-courtside-stat-actions">
      <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="${stat}" data-delta="-1">−</button>
      <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="${stat}" data-delta="1">+</button>
    </div>`;
  }

  function statBox(player, label, stat) {
    return `<div class="rp-courtside-stat"><label>${label}</label><strong>${player.stats[label]}</strong>${statActions(player, stat)}</div>`;
  }

  function playerPanelHtml(player) {
    return `<section class="rp-courtside-player-panel">
      <div class="rp-courtside-player-panel-head">
        <div><span class="rp-courtside-state">${esc(player.team)}</span><strong>${esc(player.label)}</strong></div>
        <button type="button" class="rp-courtside-close" data-courtside-close aria-label="Close player controls">×</button>
      </div>
      <div class="rp-courtside-stats">
        ${statBox(player, 'PTS', 'pts')}
        ${statBox(player, 'MAKE', 'make')}
        ${statBox(player, 'MISS', 'miss')}
        ${statBox(player, 'AST', 'ast')}
        ${statBox(player, 'REB', 'reb')}
        ${statBox(player, 'TO', 'tov')}
        ${statBox(player, 'STL', 'stl')}
        ${statBox(player, 'BLK', 'blk')}
        ${statBox(player, 'FOUL', 'foul')}
      </div>
    </section>`;
  }

  function renderLive(snapshot) {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !adminBody || !snapshot) return;
    adminRoot.classList.add('rp-courtside-locked');
    lastSnapshot = snapshot;

    const selected = snapshot.players.find((player) => player.userId === selectedUserId) || null;
    if (!selected) selectedUserId = null;

    adminBody.innerHTML = `<div class="rp-courtside-view" data-courtside-view>
      <div class="rp-courtside-head">
        <div class="rp-courtside-head-left"><span class="rp-courtside-state"><i class="rp-courtside-live-dot"></i>LIVE</span><strong class="rp-courtside-title">${esc(shortSessionTitle())}</strong></div>
      </div>
      ${scoreboardHtml(snapshot.score)}
      ${selected
        ? playerPanelHtml(selected)
        : `<div class="rp-courtside-roster">${rosterHtml('WEST', snapshot.players)}${rosterHtml('EAST', snapshot.players)}</div><button type="button" class="rp-courtside-finish" data-courtside-finish>FINISH GAME</button>`}
    </div>`;
  }

  async function hydrateLive(fallbackSnapshot) {
    const sequence = ++hydrationSequence;
    renderLive(fallbackSnapshot);
    const expanded = await fetchExpandedSnapshot();
    if (sequence !== hydrationSequence || !expanded || expanded.gameStatus !== 'live') return;
    const adminRoot = root();
    if (!adminRoot?.classList.contains('open')) return;
    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';
    if (active !== 'live') return;
    renderLive(expanded);
  }

  function renderPregame(scope) {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !adminBody) return;
    adminRoot.classList.remove('rp-courtside-locked');

    const rosters = [...scope.querySelectorAll('.rp-admin-roster')];
    const names = (team) => {
      const roster = rosters.find((item) => item.querySelector('h3')?.textContent.trim().toUpperCase() === team);
      return [...(roster?.querySelectorAll('span') || [])].map((item) => item.textContent.trim()).filter((name) => name && name !== 'NO PLAYERS');
    };
    const makeTeam = (team, list) => `<section class="rp-courtside-team"><div class="rp-courtside-team-head"><span>${team}</span><span>${list.length}</span></div><div class="rp-courtside-player-list">${list.length ? list.map((name) => `<div class="rp-courtside-player" style="display:flex;align-items:center">${esc(name)}</div>`).join('') : '<div class="rp-courtside-empty">NO PLAYERS</div>'}</div></section>`;
    const west = names('WEST');
    const east = names('EAST');
    const start = scope.querySelector('[data-control-action="start"]');
    const disabled = start?.disabled ? 'disabled' : '';

    adminBody.innerHTML = `<div class="rp-courtside-pregame" data-courtside-pregame>
      <div class="rp-courtside-pregame-head"><small>GAME READY</small><strong>READY TO START</strong></div>
      <div class="rp-courtside-roster">${makeTeam('WEST', west)}${makeTeam('EAST', east)}</div>
      <button type="button" class="rp-admin-primary" data-control-action="start" ${disabled}>START GAME</button>
    </div>`;
  }

  function renderReview(scope) {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !adminBody) return;
    adminRoot.classList.add('rp-courtside-locked');

    const score = parseScoreboard(scope);
    const winner = scope.querySelector('.rp-admin-card-head strong')?.textContent.trim() || 'FINAL REVIEW';
    const rows = [...scope.querySelectorAll('.rp-admin-final-row')].map((row) => ({
      player: row.querySelector('strong')?.textContent.trim() || 'PLAYER',
      stats: row.querySelector('span')?.textContent.trim() || '',
    }));
    const finalize = scope.querySelector('[data-control-action="finalize"]');
    const disabled = finalize?.disabled ? 'disabled' : '';
    const tie = score.west === score.east;

    adminBody.innerHTML = `<div class="rp-courtside-view" data-courtside-review>
      <div class="rp-courtside-head"><div class="rp-courtside-head-left"><span class="rp-courtside-state">FINAL REVIEW</span><strong class="rp-courtside-title">${esc(shortSessionTitle())}</strong></div></div>
      ${scoreboardHtml(score)}
      <section class="rp-courtside-review-card"><strong>${esc(winner)}</strong><div class="rp-courtside-review-list">${rows.map((row) => `<div class="rp-courtside-review-row"><b>${esc(row.player)}</b><span>${esc(row.stats)}</span></div>`).join('')}</div></section>
      ${tie ? '<div class="rp-admin-alert">A Career game cannot be finalized as a tie.</div>' : ''}
      <div class="rp-courtside-review-actions">
        <button type="button" class="rp-admin-secondary" data-courtside-back>BACK TO SCORING</button>
        <button type="button" class="rp-admin-danger" data-control-action="finalize" ${disabled}>CONFIRM FINAL RESULT</button>
      </div>
    </div>`;
  }

  function enhance() {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !adminBody || !adminRoot.classList.contains('open')) return;
    if (adminBody.querySelector('[data-courtside-view],[data-courtside-pregame],[data-courtside-review]')) return;

    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';

    if (active === 'live') {
      const state = adminBody.querySelector('.rp-admin-title .rp-admin-kicker')?.textContent.trim().toUpperCase() || '';
      if (state === 'SETUP') {
        renderPregame(adminBody);
        return;
      }
      if (state === 'LIVE') {
        hydrateLive({ score: parseScoreboard(adminBody), players: parsePlayers(adminBody), gameStatus: 'live' });
        return;
      }
    }

    if (active === 'finalize' && adminBody.querySelector('[data-control-action="finalize"]')) {
      renderReview(adminBody);
      return;
    }

    hydrationSequence += 1;
    selectedUserId = null;
    lastSnapshot = null;
    adminRoot.classList.remove('rp-courtside-locked');
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const player = event.target.closest('[data-courtside-player]');
    if (player) {
      selectedUserId = String(player.dataset.courtsidePlayer || '');
      renderLive(lastSnapshot);
      return;
    }

    if (event.target.closest('[data-courtside-close]')) {
      selectedUserId = null;
      renderLive(lastSnapshot);
      return;
    }

    if (event.target.closest('[data-courtside-finish]')) {
      if (window.confirm('Finish scoring and review the final result?')) {
        selectedUserId = null;
        adminRoot.querySelector('[data-admin-tab="finalize"]')?.click();
      }
      return;
    }

    if (event.target.closest('[data-courtside-back]')) {
      adminRoot.querySelector('[data-admin-tab="live"]')?.click();
    }
  });

  window.addEventListener('realplay:admin-render', () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  });
  enhance();
})();
