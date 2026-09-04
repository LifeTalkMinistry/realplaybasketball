(() => {
  if (window.__realPlayProfileInstalled) return;
  window.__realPlayProfileInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let panel = null;
  let state = null;
  let teamState = null;
  let loading = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function pick(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function playerName() {
    return String(pick(state?.profile?.player_name, state?.profile?.playerName, state?.profile?.name, 'REAL PLAY PLAYER')).trim();
  }

  function playerNumber() {
    const value = pick(state?.currentNumber?.number, state?.current_number?.number);
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  function career() {
    return state?.careerStats || state?.career?.stats || state?.career || {};
  }

  function ovr() {
    const value = pick(state?.ovr, state?.career?.ovr, state?.careerStats?.ovr, state?.rating);
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  function rank() {
    const value = pick(state?.rank, state?.career?.rank, state?.careerStats?.rank);
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  function team() {
    return String(pick(teamState?.assignedClub, teamState?.preferredClub, '') || '').trim().toUpperCase();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function gameLabel(game) {
    if (game?.displayLabel) return String(game.displayLabel);
    const id = Number(game?.sessionId ?? game?.id);
    if (String(game?.mode || '').toLowerCase() === 'ranking' && Number.isFinite(id)) {
      return `RANKING GAME #${String(id).padStart(3, '0')}`;
    }
    return String(game?.label || `OFFICIAL GAME #${Number.isFinite(id) ? id : ''}`);
  }

  function sideLabel(game, side) {
    const labels = game?.teamLabels || game?.team_labels || {};
    return String(labels?.[side] || side).toUpperCase();
  }

  function gameScore(game, side) {
    if (side === 'east') return number(pick(game?.eastScore, game?.east_score), 0);
    return number(pick(game?.westScore, game?.west_score), 0);
  }

  function gamePlayers(game, side) {
    const fromTeams = game?.teams?.[side];
    if (Array.isArray(fromTeams)) return fromTeams;
    const players = Array.isArray(game?.players) ? game.players : [];
    return players.filter((player) => String(player?.team || '').toLowerCase() === side);
  }

  function formatOvrImpact(before, after, movement) {
    if (after === undefined || after === null || after === '') return '';
    const beforeText = before === undefined || before === null || before === '' ? 'UNRANKED' : String(before);
    const afterText = String(after);
    const move = Number(movement);
    const moveText = Number.isFinite(move) && move !== 0 ? ` (${move > 0 ? '+' : ''}${move})` : '';
    return `${beforeText} → ${afterText}${moveText}`;
  }

  function renderBoxPlayer(player) {
    const pts = number(pick(player?.pts, player?.points));
    const ast = number(pick(player?.ast, player?.assists));
    const reb = number(pick(player?.reb, player?.rebounds));
    const tov = number(pick(player?.tov, player?.to, player?.turnovers));
    const isYou = Boolean(player?.isYou);
    const unclaimed = Boolean(player?.unclaimed);
    const rating = unclaimed
      ? 'UNCLAIMED PLAYER'
      : formatOvrImpact(
        pick(player?.ovrBefore, player?.ovr_before),
        pick(player?.ovrAfter, player?.ovr_after),
        pick(player?.ovrMovement, player?.ovr_movement)
      );

    return `
      <div class="rp-profile-box-player${isYou ? ' is-you' : ''}">
        <div class="rp-profile-box-player-head">
          <div>
            <strong>${esc(player?.playerName || player?.player_name || 'REAL PLAY PLAYER')}</strong>
            <span>${rating ? esc(rating) : 'OFFICIAL PARTICIPANT'}</span>
          </div>
          ${isYou ? '<b>YOU</b>' : unclaimed ? '<em>UNCLAIMED</em>' : ''}
        </div>
        <div class="rp-profile-box-stats">
          <span><strong>${pts}</strong><small>PTS</small></span>
          <span><strong>${ast}</strong><small>AST</small></span>
          <span><strong>${reb}</strong><small>REB</small></span>
          <span><strong>${tov}</strong><small>TO</small></span>
        </div>
      </div>`;
  }

  function renderTeamBox(game, side) {
    const players = gamePlayers(game, side);
    return `
      <section class="rp-profile-team-box ${side}">
        <header>
          <span>${esc(sideLabel(game, side))}</span>
          <strong>${gameScore(game, side)}</strong>
        </header>
        <div class="rp-profile-team-players">
          ${players.length
            ? players.map(renderBoxPlayer).join('')
            : '<p class="rp-profile-box-missing">PLAYER BOX SCORE NOT AVAILABLE.</p>'}
        </div>
      </section>`;
  }

  function renderGameDetail(game) {
    const eastScore = gameScore(game, 'east');
    const westScore = gameScore(game, 'west');
    const eastLabel = sideLabel(game, 'east');
    const westLabel = sideLabel(game, 'west');
    const players = Array.isArray(game?.players) ? game.players : [];
    const ownerImpact = formatOvrImpact(
      pick(game?.ovrBefore, game?.ovr_before),
      pick(game?.ovrAfter, game?.ovr_after, game?.ovr),
      pick(game?.ovrMovement, game?.ovr_movement)
    );

    return `
      <div class="rp-profile-game-detail">
        <div class="rp-profile-final-board">
          <small>OFFICIAL FINAL</small>
          <div>
            <span>${esc(eastLabel)}</span>
            <strong>${eastScore}</strong>
            <i>—</i>
            <strong>${westScore}</strong>
            <span>${esc(westLabel)}</span>
          </div>
        </div>
        ${ownerImpact ? `
          <div class="rp-profile-game-impact">
            <span>YOUR OVR</span>
            <strong>${esc(ownerImpact)}</strong>
          </div>` : ''}
        ${players.length ? `
          <div class="rp-profile-box-score-head"><span>FULL BOX SCORE</span><small>ALL VERIFIED PLAYERS</small></div>
          <div class="rp-profile-team-grid">
            ${renderTeamBox(game, 'east')}
            ${renderTeamBox(game, 'west')}
          </div>` : `
          <div class="rp-profile-game-detail-empty">
            <strong>FULL BOX SCORE NOT AVAILABLE YET.</strong>
            <p>This finalized game is on your record, but its all-player detail has not been returned by the game record service yet.</p>
          </div>`}
      </div>`;
  }

  function renderRecentGame(game) {
    const result = String(game?.result || 'FINAL').toUpperCase();
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const eastLabel = sideLabel(game, 'east');
    const westLabel = sideLabel(game, 'west');
    const pts = number(pick(game?.pts, game?.points));
    const ast = number(pick(game?.ast, game?.assists));
    const reb = number(pick(game?.reb, game?.rebounds));
    const tov = number(pick(game?.tov, game?.to, game?.turnovers));
    const date = formatDate(game?.finalizedAt || game?.startsAt);
    const location = game?.locationName ? String(game.locationName).toUpperCase() : '';
    const meta = [date, location].filter(Boolean).join(' · ');

    return `
      <details class="rp-profile-game">
        <summary class="rp-profile-game-summary">
          <div class="rp-profile-game-main">
            <strong>${esc(gameLabel(game))}</strong>
            <span>${esc(meta)}</span>
          </div>
          <b class="${resultClass}">${esc(result)}</b>
          <div class="rp-profile-game-score">
            <span>${esc(eastLabel)}</span><strong>${gameScore(game, 'east')}</strong><i>—</i><strong>${gameScore(game, 'west')}</strong><span>${esc(westLabel)}</span>
          </div>
          <div class="rp-profile-game-stats">
            <span>${pts} PTS</span><span>${ast} AST</span><span>${reb} REB</span><span>${tov} TO</span>
          </div>
          <div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>⌄</b></div>
        </summary>
        ${renderGameDetail(game)}
      </details>`;
  }

  async function api(path) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Could not load your Real Play profile.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function createPanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'rp-profile';
    panel.dataset.rpProfile = 'true';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="rp-profile-shell">
        <header class="rp-profile-topbar">
          <button type="button" class="rp-profile-back" data-rp-profile-close aria-label="Back to Real Play">←</button>
          <div><strong>PROFILE</strong><span>REAL PLAY BASKETBALL</span></div>
          <b>PLAYER ID</b>
        </header>
        <main class="rp-profile-body">
          <p class="rp-profile-status" data-rp-profile-status aria-live="polite"></p>
          <div data-rp-profile-content></div>
        </main>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('[data-rp-profile-close]')?.addEventListener('click', closeProfile);
    return panel;
  }

  function renderEmpty() {
    const root = panel?.querySelector('[data-rp-profile-content]');
    if (!root) return;
    root.innerHTML = `
      <section class="rp-profile-empty">
        <small>REAL PLAY IDENTITY</small>
        <h1>CREATE YOUR PLAYER PROFILE.</h1>
        <p>Your Real Play identity starts here. Once your player profile exists, your official number, games, stats and career history will live in this space.</p>
        <button type="button" data-rp-profile-create>CREATE PLAYER PROFILE</button>
      </section>`;
    root.querySelector('[data-rp-profile-create]')?.addEventListener('click', () => {
      closeProfile();
      setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 30);
    });
  }

  function renderProfile() {
    const root = panel?.querySelector('[data-rp-profile-content]');
    if (!root) return;
    if (!state?.profile) {
      renderEmpty();
      return;
    }

    const stats = career();
    const name = playerName();
    const jersey = playerNumber();
    const rating = ovr();
    const playerRank = rank();
    const club = team();
    const games = number(pick(stats.games, stats.gamesPlayed));
    const wins = number(stats.wins);
    const losses = number(stats.losses);
    const points = number(pick(stats.pts, stats.points));
    const assists = number(pick(stats.ast, stats.assists));
    const rebounds = number(pick(stats.reb, stats.rebounds));
    const turnovers = number(pick(stats.to, stats.tov, stats.turnovers));
    const supportTier = String(state?.supportTier || '').trim();
    const recentGames = Array.isArray(state?.recentGames) ? state.recentGames.slice(0, 4) : [];

    root.innerHTML = `
      <section class="rp-profile-hero">
        <div class="rp-profile-hero-glow" aria-hidden="true"></div>
        <div class="rp-profile-identity-line">
          <span>REAL PLAY PLAYER</span>
          <b>${supportTier ? esc(supportTier.toUpperCase()) : 'BETA SEASON'}</b>
        </div>
        <div class="rp-profile-player">
          <div class="rp-profile-number"><small>PLAYER</small><strong>${jersey === null ? '#—' : `#${jersey}`}</strong></div>
          <div class="rp-profile-name"><small>MY REAL PLAY PROFILE</small><h1>${esc(name)}</h1><p>${club ? `${esc(club)} · ` : ''}LESS SCREEN. REAL POINTS.</p></div>
        </div>
        <div class="rp-profile-rating-row">
          <div class="rp-profile-ovr"><span>OVR</span><strong>${rating === null ? '—' : rating}</strong><small>${rating === null ? 'UNRANKED' : 'BETA RATING'}</small></div>
          <div class="rp-profile-rank"><span>RANK</span><strong>${playerRank === null ? '—' : `#${playerRank}`}</strong><small>REAL PLAY</small></div>
          <div class="rp-profile-record"><span>RECORD</span><strong>${wins}-${losses}</strong><small>${games} GAME${games === 1 ? '' : 'S'}</small></div>
        </div>
      </section>

      <section class="rp-profile-section">
        <div class="rp-profile-section-head"><div><small>CAREER NUMBERS</small><h2>THE COURT KEEPS THE RECEIPTS.</h2></div><span>OFFICIAL GAMES ONLY</span></div>
        <div class="rp-profile-stat-grid">
          <article><strong>${points}</strong><span>PTS</span></article>
          <article><strong>${assists}</strong><span>AST</span></article>
          <article><strong>${rebounds}</strong><span>REB</span></article>
          <article><strong>${turnovers}</strong><span>TO</span></article>
        </div>
      </section>

      <section class="rp-profile-section rp-profile-history">
        <div class="rp-profile-section-head"><div><small>RECENT HISTORY</small><h2>YOUR LAST REAL PLAY.</h2></div><span>FINALIZED GAMES</span></div>
        ${recentGames.length ? recentGames.map(renderRecentGame).join('') : `
          <div class="rp-profile-no-games"><strong>NO OFFICIAL GAMES YET.</strong><p>Your verified game history will build here automatically.</p></div>`}
      </section>

      <section class="rp-profile-actions">
        <button type="button" data-rp-profile-manage-number>MANAGE PLAYER NUMBER</button>
      </section>`;

    root.querySelector('[data-rp-profile-manage-number]')?.addEventListener('click', () => {
      closeProfile();
      setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 30);
    });
  }

  function setStatus(message = '', type = '') {
    const node = panel?.querySelector('[data-rp-profile-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    setStatus('LOADING PLAYER PROFILE...');
    try {
      const [profileResult, teamResult] = await Promise.allSettled([
        api('/api/real-play/me'),
        api('/api/real-play/3v3/me'),
      ]);
      if (profileResult.status === 'rejected') throw profileResult.reason;
      state = profileResult.value;
      teamState = teamResult.status === 'fulfilled' ? teamResult.value : null;
      renderProfile();
      setStatus('');
    } catch (error) {
      if (error.status === 401) {
        closeProfile();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      setStatus(error.message || 'Could not load your profile.', 'error');
    } finally {
      loading = false;
    }
  }

  function openProfile() {
    createPanel();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-profile-open');
    panel.scrollTop = 0;
    refresh();
  }

  function closeProfile() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-profile-open');
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]');
    if (!trigger || panel?.contains(trigger)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openProfile();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel?.classList.contains('open')) closeProfile();
  });
  window.addEventListener('focus', () => {
    if (panel?.classList.contains('open')) refresh();
  });

  createPanel();
  window.RealPlayProfile = { open: openProfile, close: closeProfile, refresh };
})();
