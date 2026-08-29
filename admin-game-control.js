(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const POLL_MS = 2000;

  let token = '';
  let admin = false;
  let openedForToken = '';
  let activeTab = 'session';
  let control = { session: null, players: [] };
  let busy = false;
  let pollTimer = null;
  let authTimer = null;
  let message = '';
  let messageType = '';

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'rp-admin-launcher';
  launcher.textContent = 'GAME CONTROL';
  launcher.setAttribute('aria-label', 'Open Real Play Game Control');
  document.body.appendChild(launcher);

  const root = document.createElement('section');
  root.className = 'rp-admin-control';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="rp-admin-shell">
      <header class="rp-admin-topbar">
        <div class="rp-admin-brand">
          <small>REAL PLAY ADMIN</small>
          <strong>GAME CONTROL</strong>
        </div>
        <button type="button" class="rp-admin-exit" data-admin-exit>EXIT</button>
      </header>
      <div class="rp-admin-livebar" data-admin-livebar></div>
      <nav class="rp-admin-tabs" aria-label="Game control sections">
        <button type="button" class="rp-admin-tab active" data-admin-tab="session">SESSION</button>
        <button type="button" class="rp-admin-tab" data-admin-tab="players">PLAYERS</button>
        <button type="button" class="rp-admin-tab" data-admin-tab="live">LIVE</button>
        <button type="button" class="rp-admin-tab" data-admin-tab="finalize">FINALIZE</button>
      </nav>
      <div class="rp-admin-body" data-admin-body></div>
    </div>`;
  document.body.appendChild(root);

  const body = root.querySelector('[data-admin-body]');
  const livebar = root.querySelector('[data-admin-livebar]');
  const tabs = [...root.querySelectorAll('[data-admin-tab]')];

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDateTime(value) {
    if (!value) return 'TIME TO BE ANNOUNCED';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TIME TO BE ANNOUNCED';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function sessionStatus(session) {
    if (!session) return 'NO SESSION';
    if (session.gameStatus === 'live') return 'LIVE';
    if (session.gameStatus === 'final') return 'FINAL';
    return 'SETUP';
  }

  function setMessage(text = '', type = '') {
    message = text;
    messageType = type;
  }

  function messageHtml() {
    if (!message) return '';
    return `<div class="${messageType === 'success' ? 'rp-admin-success' : 'rp-admin-alert'}">${esc(message)}</div>`;
  }

  async function api(path, options = {}) {
    if (!token) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function closeAuthOverlay() {
    const overlay = document.querySelector('[data-auth-overlay]');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('auth-open');
  }

  function openDashboard() {
    if (!admin) return;
    closeAuthOverlay();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    launcher.classList.remove('visible');
    document.body.classList.add('rp-admin-open');
    render();
    startPolling();
  }

  function closeDashboard() {
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-admin-open');
    if (admin) launcher.classList.add('visible');
    stopPolling();
  }

  function roster(team) {
    return control.players.filter((player) => player.checkedIn && player.team === team);
  }

  function playerLabel(player) {
    return `${player.playerNumber === null ? '#--' : `#${player.playerNumber}`} ${player.playerName}`;
  }

  function renderLivebar() {
    const session = control.session;
    if (!session) {
      livebar.innerHTML = '<div><strong>NO ACTIVE SESSION</strong><span> Open one from SESSION.</span></div><span>ADMIN</span>';
      return;
    }
    const status = sessionStatus(session);
    const dotClass = status === 'LIVE' ? ' live' : '';
    livebar.innerHTML = `
      <div>
        <strong><i class="rp-admin-status-dot${dotClass}"></i>${esc(session.title)}</strong>
        <span>${esc(status)} · ${Number(session.confirmedCount || 0)} CONFIRMED</span>
      </div>
      <span>${session.gameStatus === 'live' ? `${session.westScore}–${session.eastScore}` : 'ADMIN'}</span>`;
  }

  function renderSession() {
    const session = control.session;
    const sessionCard = session ? `
      <div class="rp-admin-card">
        <div class="rp-admin-card-head">
          <strong>${esc(session.title)}</strong>
          <span class="rp-admin-pill ${session.gameStatus === 'live' ? 'live' : session.gameStatus === 'final' ? 'final' : ''}">${esc(sessionStatus(session))}</span>
        </div>
        <div class="rp-admin-meta">
          <span><b>WHEN</b> · ${esc(formatDateTime(session.startsAt))}</span>
          <span><b>WHERE</b> · ${esc(session.locationName || 'COURT TO BE ANNOUNCED')}</span>
          <span><b>CAPACITY</b> · ${session.capacity === null ? 'OPEN' : esc(session.capacity)}</span>
        </div>
        <div class="rp-admin-count">
          <div><strong>${Number(session.confirmedCount || 0)}</strong><span> CONFIRMED PLAYERS</span></div>
          <span>${session.capacity === null ? '' : `${Math.max(0, session.capacity - session.confirmedCount)} SPOTS LEFT`}</span>
        </div>
      </div>` : `
      <div class="rp-admin-empty">
        <strong>NO CAREER SESSION OPEN</strong>
        <p>Create the next Beta Career session below.</p>
      </div>`;

    return `
      <div class="rp-admin-title"><span class="rp-admin-kicker">BETA OPERATIONS</span><h1>SESSION CONTROL</h1><p>Open the game your testers can join with one tap.</p></div>
      ${messageHtml()}
      ${sessionCard}
      <div class="rp-admin-card soft">
        <div class="rp-admin-card-head"><strong>OPEN NEW SESSION</strong><span class="rp-admin-pill">ADMIN</span></div>
        <form class="rp-admin-form" data-new-session-form style="margin-top:14px">
          <label>Session title<input name="title" maxlength="100" placeholder="BETA CAREER SESSION #002" required></label>
          <label>Court / location<input name="locationName" maxlength="160" placeholder="Fairview Court"></label>
          <label>Date & time<input type="datetime-local" name="startsAt"></label>
          <label>Player capacity<input type="number" name="capacity" min="1" max="500" inputmode="numeric" placeholder="10"></label>
          <button type="submit" class="rp-admin-primary" ${busy ? 'disabled' : ''}>OPEN SESSION</button>
        </form>
      </div>`;
  }

  function renderPlayers() {
    const session = control.session;
    if (!session) return `<div class="rp-admin-title"><span class="rp-admin-kicker">ATTENDANCE</span><h1>PLAYERS</h1></div>${messageHtml()}<div class="rp-admin-empty"><strong>NO ACTIVE SESSION</strong><p>Open a Career session first.</p></div>`;
    const locked = session.gameStatus !== 'setup';
    const rows = control.players.length ? control.players.map((player) => `
      <article class="rp-admin-player">
        <div class="rp-admin-player-top">
          <div class="rp-admin-number">${player.playerNumber === null ? '--' : esc(player.playerNumber)}</div>
          <div class="rp-admin-player-name"><strong>${esc(player.playerName)}</strong><small>${player.checkedIn ? (player.team ? `${player.team.toUpperCase()} · PLAYING` : 'CHECKED IN · TEAM NEEDED') : 'CONFIRMED ONLINE'}</small></div>
          <button type="button" class="rp-admin-check ${player.checkedIn ? 'in' : ''}" data-control-action="checkin" data-user-id="${player.userId}" data-checked-in="${player.checkedIn ? 'false' : 'true'}" ${locked || busy ? 'disabled' : ''}>${player.checkedIn ? '✓ HERE' : 'CHECK IN'}</button>
        </div>
        <div class="rp-admin-teams">
          <button type="button" class="rp-admin-team ${player.team === 'west' ? 'active' : ''}" data-control-action="team" data-user-id="${player.userId}" data-team="west" ${locked || !player.checkedIn || busy ? 'disabled' : ''}>WEST</button>
          <button type="button" class="rp-admin-team ${player.team === 'east' ? 'active' : ''}" data-control-action="team" data-user-id="${player.userId}" data-team="east" ${locked || !player.checkedIn || busy ? 'disabled' : ''}>EAST</button>
        </div>
      </article>`).join('') : '<div class="rp-admin-empty"><strong>NO PLAYERS YET</strong><p>As testers tap PLAY, they will appear here automatically.</p></div>';
    return `
      <div class="rp-admin-title"><span class="rp-admin-kicker">${control.players.length} CONFIRMED</span><h1>WHO'S PLAYING?</h1><p>Check in the players who actually arrived, then place them on West or East.</p></div>
      ${messageHtml()}
      ${locked ? '<div class="rp-admin-success">Attendance and teams are locked because this game has already started.</div>' : ''}
      <div class="rp-admin-player-list">${rows}</div>`;
  }

  function renderRoster(team) {
    const players = roster(team);
    return players.length ? players.map((player) => `<span>${esc(playerLabel(player))}</span>`).join('') : '<span>NO PLAYERS</span>';
  }

  function statBox(player, key, label) {
    const value = Number(player.stats?.[key] || 0);
    const live = control.session?.gameStatus === 'live';
    const controls = key === 'pts'
      ? `<button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="-1" ${!live || busy ? 'disabled' : ''}>−</button><button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="1" ${!live || busy ? 'disabled' : ''}>+1</button><button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="2" ${!live || busy ? 'disabled' : ''}>+2</button><button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="3" ${!live || busy ? 'disabled' : ''}>+3</button>`
      : `<button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="-1" ${!live || busy ? 'disabled' : ''}>−</button><button type="button" data-control-action="stat" data-user-id="${player.userId}" data-stat="${key}" data-delta="1" ${!live || busy ? 'disabled' : ''}>+</button>`;
    return `<div class="rp-admin-stat"><label>${label}</label><strong>${value}</strong><div class="rp-admin-stat-controls">${controls}</div></div>`;
  }

  function renderGame() {
    const session = control.session;
    if (!session) return `<div class="rp-admin-title"><span class="rp-admin-kicker">COURTSIDE</span><h1>LIVE GAME</h1></div>${messageHtml()}<div class="rp-admin-empty"><strong>NO ACTIVE SESSION</strong><p>Open a session and check players in first.</p></div>`;
    const live = session.gameStatus === 'live';
    const final = session.gameStatus === 'final';
    const canStart = session.gameStatus === 'setup' && roster('west').length > 0 && roster('east').length > 0;
    const players = control.players.filter((player) => player.checkedIn && player.team);
    const rows = players.length ? players.map((player) => `
      <article class="rp-admin-stat-player">
        <div class="rp-admin-stat-player-head"><strong>${esc(playerLabel(player))}</strong><span class="rp-admin-pill">${esc(player.team)}</span></div>
        <div class="rp-admin-stat-grid">${statBox(player,'pts','PTS')}${statBox(player,'ast','AST')}${statBox(player,'reb','REB')}${statBox(player,'tov','TO')}</div>
      </article>`).join('') : '<div class="rp-admin-empty"><strong>NO PLAYERS IN GAME</strong><p>Check players in and assign teams before tracking stats.</p></div>';

    return `
      <div class="rp-admin-title"><span class="rp-admin-kicker">${esc(sessionStatus(session))}</span><h1>LIVE GAME</h1><p>Record the player. Real Play builds the team score automatically from PTS.</p></div>
      ${messageHtml()}
      <div class="rp-admin-scoreboard">
        <div class="rp-admin-score-side"><small>WEST</small><strong>${Number(session.westScore || 0)}</strong></div>
        <div class="rp-admin-score-dash">—</div>
        <div class="rp-admin-score-side"><small>EAST</small><strong>${Number(session.eastScore || 0)}</strong></div>
      </div>
      <div class="rp-admin-team-grid">
        <div class="rp-admin-roster"><h3>WEST</h3>${renderRoster('west')}</div>
        <div class="rp-admin-roster"><h3>EAST</h3>${renderRoster('east')}</div>
      </div>
      ${session.gameStatus === 'setup' ? `<div class="rp-admin-card soft"><button type="button" class="rp-admin-primary" data-control-action="start" ${!canStart || busy ? 'disabled' : ''}>START GAME</button>${!canStart ? '<div class="rp-admin-alert">Check in players and assign at least one player to both West and East.</div>' : ''}</div>` : ''}
      <div class="rp-admin-title"><span class="rp-admin-kicker">OFFICIAL STATS</span><h1>PLAYER STATS</h1><p>PTS changes the scoreboard automatically. AST, REB, and TO remain player stats only.</p></div>
      ${!live && !final ? '<div class="rp-admin-success">Stat controls unlock when the game is LIVE.</div>' : ''}
      ${final ? '<div class="rp-admin-success">This game is final. Score and stat controls are locked.</div>' : ''}
      <div class="rp-admin-stat-list">${rows}</div>`;
  }

  function renderStats() {
    return renderGame();
  }

  function renderFinalize() {
    const session = control.session;
    if (!session) return `<div class="rp-admin-title"><span class="rp-admin-kicker">OFFICIAL RECORD</span><h1>FINALIZE</h1></div>${messageHtml()}<div class="rp-admin-empty"><strong>NO ACTIVE SESSION</strong></div>`;
    const players = control.players.filter((player) => player.checkedIn && player.team);
    const final = session.gameStatus === 'final';
    const tie = Number(session.westScore || 0) === Number(session.eastScore || 0);
    const winner = tie ? 'TIED' : session.westScore > session.eastScore ? 'WEST WINS' : 'EAST WINS';
    const rows = players.map((player) => `<div class="rp-admin-final-row"><strong>${esc(playerLabel(player))}</strong><span>${player.stats.pts} PTS · ${player.stats.ast} AST · ${player.stats.reb} REB · ${player.stats.tov} TO</span></div>`).join('');
    return `
      <div class="rp-admin-title"><span class="rp-admin-kicker">OFFICIAL RECORD</span><h1>FINALIZE GAME</h1><p>Confirm only when the real game is complete.</p></div>
      ${messageHtml()}
      <div class="rp-admin-scoreboard">
        <div class="rp-admin-score-side"><small>WEST</small><strong>${session.westScore}</strong></div><div class="rp-admin-score-dash">—</div><div class="rp-admin-score-side"><small>EAST</small><strong>${session.eastScore}</strong></div>
      </div>
      <div class="rp-admin-card"><div class="rp-admin-card-head"><strong>${esc(winner)}</strong><span class="rp-admin-pill ${final ? 'final' : ''}">${final ? 'FINAL' : 'REVIEW'}</span></div><div class="rp-admin-final-list">${rows || '<div class="rp-admin-empty"><strong>NO PLAYER STATS</strong></div>'}</div></div>
      ${tie && !final ? '<div class="rp-admin-alert">A Career game cannot be finalized as a tie.</div>' : ''}
      ${final ? '<div class="rp-admin-success">FINAL RESULT CONFIRMED. Game controls are locked.</div>' : `<div class="rp-admin-card soft"><button type="button" class="rp-admin-danger" data-control-action="finalize" ${session.gameStatus !== 'live' || tie || busy ? 'disabled' : ''}>CONFIRM FINAL RESULT</button></div>`}`;
  }

  function render() {
    if (!root.classList.contains('open')) return;
    renderLivebar();
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.adminTab === activeTab));
    if (activeTab === 'players') body.innerHTML = renderPlayers();
    else if (activeTab === 'live' || activeTab === 'game' || activeTab === 'stats') body.innerHTML = renderGame();
    else if (activeTab === 'finalize') body.innerHTML = renderFinalize();
    else body.innerHTML = renderSession();
  }

  async function refresh(options = {}) {
    if (!token || busy) return;
    try {
      const data = await api('/api/real-play/admin/career/control');
      admin = Boolean(data?.admin);
      control = data?.control || { session: null, players: [] };
      if (admin) launcher.classList.toggle('visible', !root.classList.contains('open'));
      if (!options.silent) setMessage('', '');
      render();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        admin = false;
        launcher.classList.remove('visible');
        closeDashboard();
      } else if (!options.silent) {
        setMessage(error.message || 'Unable to load Game Control.', 'error');
        render();
      }
    }
  }

  async function detectAdmin() {
    if (!token) return;
    try {
      const data = await api('/api/real-play/admin/career/control');
      admin = Boolean(data?.admin);
      control = data?.control || { session: null, players: [] };
      if (!admin) return;
      launcher.classList.add('visible');
      if (openedForToken !== token) {
        openedForToken = token;
        openDashboard();
      }
    } catch (error) {
      if (error.status === 403 || error.status === 401) {
        admin = false;
        launcher.classList.remove('visible');
      }
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      const focused = root.querySelector('input:focus,select:focus,textarea:focus');
      if (!focused) refresh({ silent: true });
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  async function postControl(payload) {
    if (busy) return;
    busy = true;
    render();
    try {
      const data = await api('/api/real-play/admin/career/control', { method: 'POST', body: payload });
      control = data?.control || control;
      setMessage('', '');
    } catch (error) {
      setMessage(error.message || 'Game Control action failed.', 'error');
    } finally {
      busy = false;
      render();
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.adminTab;
      setMessage('', '');
      render();
    });
  });

  launcher.addEventListener('click', openDashboard);
  root.querySelector('[data-admin-exit]').addEventListener('click', closeDashboard);

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-control-action]');
    if (!button || button.disabled || busy) return;
    const action = button.dataset.controlAction;

    if (action === 'checkin') {
      await postControl({ action, userId: Number(button.dataset.userId), checkedIn: button.dataset.checkedIn === 'true' });
    } else if (action === 'team') {
      await postControl({ action, userId: Number(button.dataset.userId), team: button.dataset.team });
    } else if (action === 'start') {
      if (window.confirm('Start this official Beta Career game? Attendance and teams will lock.')) await postControl({ action });
    } else if (action === 'stat') {
      await postControl({ action, userId: Number(button.dataset.userId), stat: button.dataset.stat, delta: Number(button.dataset.delta) });
    } else if (action === 'finalize') {
      if (window.confirm('Confirm the FINAL RESULT? This will lock the game score and stats.')) {
        await postControl({ action });
        setMessage('Final result confirmed. This Beta game is now locked.', 'success');
        render();
      }
    }
  });

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-new-session-form]');
    if (!form) return;
    event.preventDefault();
    if (busy) return;
    if (control.session && !window.confirm('Opening a new session will close the current session. Continue?')) return;

    const data = new FormData(form);
    const localStartsAt = String(data.get('startsAt') || '').trim();
    const startsAt = localStartsAt ? new Date(localStartsAt).toISOString() : null;
    const capacityRaw = String(data.get('capacity') || '').trim();
    const payload = {
      title: String(data.get('title') || '').trim(),
      locationName: String(data.get('locationName') || '').trim(),
      startsAt,
      capacity: capacityRaw ? Number(capacityRaw) : null,
    };

    busy = true;
    render();
    try {
      await api('/api/real-play/admin/career/session', { method: 'POST', body: payload });
      form.reset();
      await refresh({ silent: true });
      setMessage('New Career session is open. Players can tap PLAY now.', 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to open the session.', 'error');
    } finally {
      busy = false;
      render();
    }
  });

  function watchAuth() {
    const nextToken = window.localStorage.getItem(TOKEN_KEY) || '';
    if (nextToken === token) return;
    token = nextToken;
    if (!token) {
      admin = false;
      openedForToken = '';
      launcher.classList.remove('visible');
      closeDashboard();
      return;
    }
    detectAdmin();
  }

  token = window.localStorage.getItem(TOKEN_KEY) || '';
  if (token) detectAdmin();
  authTimer = window.setInterval(watchAuth, 700);

  window.addEventListener('focus', () => {
    watchAuth();
    if (admin && root.classList.contains('open')) refresh({ silent: true });
  });
})();
