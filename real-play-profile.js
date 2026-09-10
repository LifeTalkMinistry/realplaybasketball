(() => {
  if (window.__realPlayProfileInstalled) return;
  window.__realPlayProfileInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const PROFILE_TIMEOUT_MS = 7000;
  const TEAM_TIMEOUT_MS = 1200;

  let panel = null;
  let state = null;
  let teamState = null;
  let loading = false;
  let loadGeneration = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
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

  function gameTime(game) {
    const value = pick(
      game?.finalizedAt,
      game?.finalized_at,
      game?.startsAt,
      game?.starts_at,
      game?.playedAt,
      game?.played_at,
      game?.date
    );
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : null;
  }

  function orderedRecentGames() {
    const source = Array.isArray(state?.recentGames) ? state.recentGames : [];
    return source
      .map((game, index) => ({ game, index, time: gameTime(game) }))
      .sort((a, b) => {
        if (a.time !== null && b.time !== null && a.time !== b.time) return b.time - a.time;
        if (a.time !== null && b.time === null) return -1;
        if (a.time === null && b.time !== null) return 1;
        return a.index - b.index;
      })
      .map((entry) => entry.game);
  }

  function gameLabel(game) {
    if (game?.displayLabel) return String(game.displayLabel);
    const id = Number(game?.sessionId ?? game?.id);
    if (String(game?.mode || '').toLowerCase() === 'ranking' && Number.isFinite(id)) {
      return `OPEN RANK #${String(id).padStart(3, '0')}`;
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
    const impact = unclaimed ? '' : formatOvrImpact(
      pick(player?.ovrBefore, player?.ovr_before),
      pick(player?.ovrAfter, player?.ovr_after),
      pick(player?.ovrMovement, player?.ovr_movement)
    );

    return `
      <div class="rp-profile-box-player${isYou ? ' is-you' : ''}">
        <div class="rp-profile-box-player-head">
          <div>
            <strong>${esc(player?.playerName || player?.player_name || 'REAL PLAY PLAYER')}</strong>
            <span>${unclaimed ? 'UNCLAIMED PLAYER' : impact ? esc(impact) : 'OFFICIAL PARTICIPANT'}</span>
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
        <header><span>${esc(sideLabel(game, side))}</span><strong>${gameScore(game, side)}</strong></header>
        <div class="rp-profile-team-players">
          ${players.length ? players.map(renderBoxPlayer).join('') : '<p class="rp-profile-box-missing">PLAYER BOX SCORE NOT AVAILABLE.</p>'}
        </div>
      </section>`;
  }

  function renderGameDetail(game) {
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
            <span>${esc(sideLabel(game, 'east'))}</span>
            <strong>${gameScore(game, 'east')}</strong>
            <i>—</i>
            <strong>${gameScore(game, 'west')}</strong>
            <span>${esc(sideLabel(game, 'west'))}</span>
          </div>
        </div>
        ${ownerImpact ? `<div class="rp-profile-game-impact"><span>YOUR OVR</span><strong>${esc(ownerImpact)}</strong></div>` : ''}
        ${players.length ? `
          <div class="rp-profile-box-score-head"><span>FULL BOX SCORE</span><small>ALL VERIFIED PLAYERS</small></div>
          <div class="rp-profile-team-grid">${renderTeamBox(game, 'east')}${renderTeamBox(game, 'west')}</div>` : `
          <div class="rp-profile-game-detail-empty">
            <strong>FULL BOX SCORE NOT AVAILABLE YET.</strong>
            <p>This finalized game is on your record, but its all-player detail has not been returned yet.</p>
          </div>`}
      </div>`;
  }

  function renderRecentGame(game) {
    const result = String(game?.result || 'FINAL').toUpperCase();
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const pts = number(pick(game?.pts, game?.points));
    const ast = number(pick(game?.ast, game?.assists));
    const reb = number(pick(game?.reb, game?.rebounds));
    const tov = number(pick(game?.tov, game?.to, game?.turnovers));
    const date = formatDate(pick(game?.finalizedAt, game?.finalized_at, game?.startsAt, game?.starts_at));
    const location = game?.locationName ? String(game.locationName).toUpperCase() : '';
    const meta = [date, location].filter(Boolean).join(' · ');

    return `
      <details class="rp-profile-game">
        <summary class="rp-profile-game-summary">
          <div class="rp-profile-game-main"><strong>${esc(gameLabel(game))}</strong><span>${esc(meta)}</span></div>
          <b class="${resultClass}">${esc(result)}</b>
          <div class="rp-profile-game-score">
            <span>${esc(sideLabel(game, 'east'))}</span><strong>${gameScore(game, 'east')}</strong><i>—</i><strong>${gameScore(game, 'west')}</strong><span>${esc(sideLabel(game, 'west'))}</span>
          </div>
          <div class="rp-profile-game-stats"><span>${pts} PTS</span><span>${ast} AST</span><span>${reb} REB</span><span>${tov} TO</span></div>
          <div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>⌄</b></div>
        </summary>
        ${renderGameDetail(game)}
      </details>`;
  }

  function timeoutError(message) {
    const error = new Error(message);
    error.status = 408;
    error.name = 'RealPlayProfileTimeoutError';
    return error;
  }

  async function requestJson(path, timeoutMs = PROFILE_TIMEOUT_MS) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }

    const controller = new AbortController();
    let timer = 0;
    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => {
        try { controller.abort(); } catch (_) {}
        reject(timeoutError('Player profile took too long to respond. Tap Retry.'));
      }, timeoutMs);
    });

    const request = fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.message || data?.error || 'Could not load your Real Play profile.');
        error.status = response.status;
        throw error;
      }
      return data;
    });

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
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
          <div><strong>PROFILE</strong><span>REAL PLAY BASKBALL</span></div>
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

  function setStatus(message = '', type = '') {
    const node = panel?.querySelector('[data-rp-profile-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
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

  function openSettings() {
    const settingsChoice = document.querySelector('[data-rp-main-action="settings"]');
    if (!settingsChoice) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    const wasActive = settingsChoice.classList.contains('slot-active');
    settingsChoice.classList.add('slot-active');
    settingsChoice.click();
    if (!wasActive) queueMicrotask(() => settingsChoice.classList.remove('slot-active'));
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
    const recentGames = orderedRecentGames().slice(0, 3);
    const hasMoreHistory = orderedRecentGames().length > 3;

    const rankingState = state?.ranking || {};
    const rankingRequired = Math.max(1, number(pick(
      rankingState.requiredGames,
      rankingState.required_games,
      state?.officialRankingGamesRequired,
      state?.official_ranking_games_required,
      state?.rankingGamesRequired,
      state?.ranking_games_required,
      5
    ), 5));
    const rankingCompleted = Math.min(rankingRequired, Math.max(0, number(pick(
      rankingState.completedGames,
      rankingState.completed_games,
      state?.rankingGamesCompleted,
      state?.ranking_games_completed,
      games
    ), games)));
    const eligibilityValue = pick(
      rankingState.officialRankingEligible,
      rankingState.official_ranking_eligible,
      rankingState.rankingEligible,
      rankingState.ranking_eligible,
      rankingState.ranked,
      state?.officialRankingEligible,
      state?.official_ranking_eligible
    );
    const rankingEligible = eligibilityValue === undefined
      ? Boolean(rating !== null && rankingCompleted >= rankingRequired)
      : Boolean(eligibilityValue);
    const ovrCaption = rating === null ? 'NO OVR YET' : rankingEligible ? 'OFFICIAL RANKING' : `EARLY OVR · ${rankingCompleted}/${rankingRequired}`;
    const rankCaption = rankingEligible ? 'OFFICIAL RANK' : `${rankingCompleted}/${rankingRequired} VERIFIED`;

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
          <div class="rp-profile-ovr"><span>OVR</span><strong>${rating === null ? '—' : rating}</strong><small>${esc(ovrCaption)}</small></div>
          <div class="rp-profile-rank"><span>RANK</span><strong>${rankingEligible && playerRank !== null ? `#${playerRank}` : '—'}</strong><small>${esc(rankCaption)}</small></div>
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
        ${hasMoreHistory ? '<button type="button" class="rp-profile-history-toggle" data-rp-profile-history-toggle>VIEW MORE</button>' : ''}
      </section>

      <section class="rp-profile-actions rp-me-actions">
        <button type="button" data-rp-profile-manage-number>MANAGE PLAYER NUMBER</button>
        <button type="button" data-rp-profile-settings data-rp-simple-settings>SETTINGS</button>
      </section>`;

    root.querySelector('[data-rp-profile-manage-number]')?.addEventListener('click', () => {
      closeProfile();
      setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 30);
    });
    root.querySelector('[data-rp-profile-settings]')?.addEventListener('click', openSettings);
  }

  function renderLoadError(error) {
    const root = panel?.querySelector('[data-rp-profile-content]');
    if (!root) return;
    const message = error?.message || 'Could not load your Real Play profile.';
    root.innerHTML = `
      <section class="rp-profile-empty">
        <small>PROFILE CONNECTION</small>
        <h1>COULD NOT LOAD ME.</h1>
        <p>${esc(message)}</p>
        <button type="button" data-rp-profile-retry>RETRY PROFILE</button>
      </section>`;
    root.querySelector('[data-rp-profile-retry]')?.addEventListener('click', refresh);
  }

  async function loadOptionalTeam(generation) {
    try {
      const nextTeam = await requestJson('/api/real-play/3v3/me', TEAM_TIMEOUT_MS);
      if (generation !== loadGeneration || !panel?.classList.contains('open')) return;
      teamState = nextTeam;
      const club = team();
      const description = panel.querySelector('.rp-profile-name p');
      if (description && club) description.textContent = `${club} · LESS SCREEN. REAL POINTS.`;
    } catch (_) {
      // Team identity is optional. It must never block or replace the main profile.
    }
  }

  async function refresh() {
    if (loading) return;
    const generation = ++loadGeneration;
    loading = true;
    teamState = null;
    setStatus('LOADING PLAYER PROFILE...');

    const root = panel?.querySelector('[data-rp-profile-content]');
    if (root) root.innerHTML = '';

    try {
      const profileState = await requestJson('/api/real-play/me', PROFILE_TIMEOUT_MS);
      if (generation !== loadGeneration || !panel?.classList.contains('open')) return;

      state = profileState;
      renderProfile();
      setStatus('');
      void loadOptionalTeam(generation);
    } catch (error) {
      if (generation !== loadGeneration) return;
      if (error?.status === 401) {
        closeProfile();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      setStatus('', 'error');
      renderLoadError(error);
    } finally {
      if (generation === loadGeneration) loading = false;
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
    ++loadGeneration;
    loading = false;
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

  createPanel();
  window.RealPlayProfile = { open: openProfile, close: closeProfile, refresh };
})();