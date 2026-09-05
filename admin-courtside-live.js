(() => {
  if (window.__realPlayCourtsideLiveInstalled) return;
  window.__realPlayCourtsideLiveInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let selectedUserId = null;
  let lastSnapshot = null;
  let hydrationSequence = 0;
  let shotBusy = false;
  let refreshPromise = null;

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

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function normalizeStats(stats = {}) {
    const normalized = {
      onePtMade: number(stats.onePtMade),
      onePtMiss: number(stats.onePtMiss),
      twoPtMade: number(stats.twoPtMade),
      twoPtMiss: number(stats.twoPtMiss),
      AST: number(stats.AST ?? stats.ast),
      REB: number(stats.REB ?? stats.reb),
      TO: number(stats.TO ?? stats.tov),
      STL: number(stats.STL ?? stats.stl),
      BLK: number(stats.BLK ?? stats.blk),
      FOUL: number(stats.FOUL ?? stats.foul),
    };
    normalized.PTS = normalized.onePtMade + (2 * normalized.twoPtMade);
    return normalized;
  }

  function shotSummary(made, missed) {
    const attempts = made + missed;
    return {
      made,
      attempts,
      percent: attempts ? `${Math.round((made / attempts) * 100)}%` : '—',
    };
  }

  function parseScoreboard(scope) {
    const sides = [...scope.querySelectorAll('.rp-admin-score-side')].map((side) => ({
      team: side.querySelector('small')?.textContent.trim().toUpperCase() || '',
      score: number(side.querySelector('strong')?.textContent.trim()),
    }));
    return {
      west: sides.find((side) => side.team === 'WEST')?.score || 0,
      east: sides.find((side) => side.team === 'EAST')?.score || 0,
    };
  }

  function parsePlayers(scope) {
    return [...scope.querySelectorAll('.rp-admin-stat-player')].map((card) => {
      const action = card.querySelector('[data-control-action="stat"]');
      if (!action) return null;
      const userId = String(action.dataset.userId || '');
      const cached = lastSnapshot?.players.find((player) => player.userId === userId);
      const stats = normalizeStats(cached?.stats || {});

      card.querySelectorAll('.rp-admin-stat').forEach((box) => {
        const key = box.querySelector('label')?.textContent.trim().toUpperCase();
        const value = number(box.querySelector('strong')?.textContent.trim());
        if (key === 'AST') stats.AST = value;
        else if (key === 'REB') stats.REB = value;
        else if (key === 'TO') stats.TO = value;
        else if (key === 'STL') stats.STL = value;
        else if (key === 'BLK') stats.BLK = value;
        else if (key === 'FOUL') stats.FOUL = value;
      });

      return {
        userId,
        label: card.querySelector('.rp-admin-stat-player-head strong')?.textContent.trim() || cached?.label || 'PLAYER',
        team: card.querySelector('.rp-admin-stat-player-head .rp-admin-pill')?.textContent.trim().toUpperCase() || cached?.team || '',
        stats: normalizeStats(stats),
      };
    }).filter(Boolean).sort((a, b) => {
      const aNum = Number(a.label.match(/#(\d+)/)?.[1] ?? 999);
      const bNum = Number(b.label.match(/#(\d+)/)?.[1] ?? 999);
      return aNum - bNum || a.label.localeCompare(b.label);
    });
  }

  function playerLabel(player) {
    const playerNumber = player?.playerNumber === null || player?.playerNumber === undefined
      ? '#--'
      : `#${Number(player.playerNumber)}`;
    return `${playerNumber} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function snapshotFromControl(control) {
    if (!control?.session) return null;
    const players = (control.players || [])
      .filter((player) => player.checkedIn && player.team)
      .map((player) => ({
        userId: String(player.userId ?? player.playerId ?? ''),
        label: playerLabel(player),
        team: String(player.team || '').toUpperCase(),
        stats: normalizeStats(player.stats || {}),
      }))
      .sort((a, b) => {
        const aNum = Number(a.label.match(/#(\d+)/)?.[1] ?? 999);
        const bNum = Number(b.label.match(/#(\d+)/)?.[1] ?? 999);
        return aNum - bNum || a.label.localeCompare(b.label);
      });

    const score = { west: 0, east: 0 };
    players.forEach((player) => {
      if (player.team === 'WEST') score.west += player.stats.PTS;
      if (player.team === 'EAST') score.east += player.stats.PTS;
    });

    return {
      score,
      players,
      gameStatus: String(control.session.gameStatus || ''),
    };
  }

  async function controlRequest(method = 'GET', payload) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  async function fetchExpandedSnapshot() {
    try {
      const data = await controlRequest('GET');
      return snapshotFromControl(data?.control || null);
    } catch (_) {
      return null;
    }
  }

  function scoreboardHtml(score) {
    return `<div class="rp-admin-scoreboard">
      <div class="rp-admin-score-side"><small>WEST</small><strong>${number(score.west)}</strong></div>
      <div class="rp-admin-score-dash">—</div>
      <div class="rp-admin-score-side"><small>EAST</small><strong>${number(score.east)}</strong></div>
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
    return `<div class="rp-courtside-stat-actions">
      <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="${stat}" data-delta="-1">−</button>
      <button type="button" data-control-action="stat" data-user-id="${userId}" data-stat="${stat}" data-delta="1">+</button>
    </div>`;
  }

  function statBox(player, label, stat) {
    return `<div class="rp-courtside-stat"><label>${label}</label><strong>${number(player.stats[label])}</strong>${statActions(player, stat)}</div>`;
  }

  function pointsCard(player) {
    return `<div class="rp-courtside-stat rp-shot-points"><label>PTS</label><strong>${number(player.stats.PTS)}</strong><span class="rp-shot-auto">AUTO</span></div>`;
  }

  function shotCard(player, shotValue, summary, rangeLabel) {
    const userId = esc(player.userId);
    return `<div class="rp-courtside-stat rp-shot-card">
      <label>${shotValue}PT</label>
      <strong>${summary.made} / ${summary.attempts}</strong>
      <span class="rp-shot-meta">${summary.percent} · ${rangeLabel}</span>
      <div class="rp-shot-actions">
        <button type="button" data-rp-shot-action="shot" data-user-id="${userId}" data-shot-value="${shotValue}" data-result="miss" ${shotBusy ? 'disabled' : ''}>MISS</button>
        <button type="button" class="make" data-rp-shot-action="shot" data-user-id="${userId}" data-shot-value="${shotValue}" data-result="make" ${shotBusy ? 'disabled' : ''}>MAKE</button>
      </div>
    </div>`;
  }

  function playerPanelHtml(player) {
    const one = shotSummary(player.stats.onePtMade, player.stats.onePtMiss);
    const two = shotSummary(player.stats.twoPtMade, player.stats.twoPtMiss);
    const attempts = one.attempts + two.attempts;
    return `<section class="rp-courtside-player-panel">
      <div class="rp-courtside-player-panel-head">
        <div><span class="rp-courtside-state">${esc(player.team)}</span><strong>${esc(player.label)}</strong></div>
        <button type="button" class="rp-courtside-close" data-courtside-close aria-label="Close player controls">×</button>
      </div>
      <div class="rp-courtside-stats">
        ${pointsCard(player)}
        ${shotCard(player, 1, one, 'INSIDE ARC')}
        ${shotCard(player, 2, two, 'OUTSIDE ARC')}
        ${statBox(player, 'AST', 'ast')}
        ${statBox(player, 'REB', 'reb')}
        ${statBox(player, 'TO', 'tov')}
        ${statBox(player, 'STL', 'stl')}
        ${statBox(player, 'BLK', 'blk')}
        ${statBox(player, 'FOUL', 'foul')}
      </div>
      <button type="button" class="rp-shot-undo" data-rp-shot-action="undo-shot" data-user-id="${esc(player.userId)}" ${shotBusy || attempts === 0 ? 'disabled' : ''}>UNDO LAST SHOT</button>
      <div class="rp-shot-error" data-rp-shot-error hidden></div>
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

  async function refreshSnapshot() {
    if (refreshPromise) return refreshPromise;
    const sequence = ++hydrationSequence;
    refreshPromise = (async () => {
      const expanded = await fetchExpandedSnapshot();
      if (sequence !== hydrationSequence || !expanded || expanded.gameStatus !== 'live') return;
      const adminRoot = root();
      if (!adminRoot?.classList.contains('open')) return;
      if (adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'live') return;
      renderLive(expanded);
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  function hydrateLive(fallbackSnapshot) {
    renderLive(lastSnapshot || fallbackSnapshot);
    refreshSnapshot();
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

  async function handleShotAction(button) {
    if (shotBusy) return;
    const userId = Number(button.dataset.userId);
    if (!Number.isSafeInteger(userId) || userId === 0) return;

    shotBusy = true;
    if (lastSnapshot) renderLive(lastSnapshot);
    try {
      const payload = button.dataset.rpShotAction === 'shot'
        ? {
            action: 'shot',
            userId,
            shotValue: Number(button.dataset.shotValue),
            result: String(button.dataset.result || ''),
          }
        : { action: 'undo-shot', userId };
      const data = await controlRequest('POST', payload);
      const next = snapshotFromControl(data?.control || null);
      if (next) renderLive(next);
    } catch (error) {
      const panel = body()?.querySelector('.rp-courtside-player-panel');
      const errorBox = panel?.querySelector('[data-rp-shot-error]');
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = error.message || 'Unable to record that shot.';
      }
    } finally {
      shotBusy = false;
      if (lastSnapshot) renderLive(lastSnapshot);
    }
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const shotButton = event.target.closest('[data-rp-shot-action]');
    if (shotButton) {
      event.preventDefault();
      event.stopPropagation();
      handleShotAction(shotButton);
      return;
    }

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
  }, true);

  // The base admin screen rebuilds its body whenever live server state changes.
  // Restore the stable courtside view synchronously in the same event turn so
  // the legacy PTS/MAKE/MISS layout is never painted between refreshes.
  window.addEventListener('realplay:admin-render', () => {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !adminBody || !adminRoot.classList.contains('open')) return;
    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';
    const state = adminBody.querySelector('.rp-admin-title .rp-admin-kicker')?.textContent.trim().toUpperCase() || '';

    if (active === 'live' && state === 'LIVE' && lastSnapshot?.gameStatus === 'live') {
      renderLive(lastSnapshot);
      refreshSnapshot();
      return;
    }

    enhance();
  });

  enhance();
})();
