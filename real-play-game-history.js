(() => {
  if (window.__realPlayGameHistoryInstalled) return;
  window.__realPlayGameHistoryInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const RANGE_DAYS = { '30': 30, '90': 90, '365': 365, all: null };
  const RANGE_LABELS = { '30': '30 DAYS', '90': '90 DAYS', '365': '1 YEAR', all: 'ALL TIME' };

  let page = null;
  let state = null;
  let loading = false;
  let selectedRange = '90';

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
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  function orderedGames() {
    const games = Array.isArray(state?.recentGames) ? state.recentGames : [];
    return games
      .map((game, index) => ({ game, index, time: gameTime(game) }))
      .sort((a, b) => {
        if (a.time !== null && b.time !== null && a.time !== b.time) return b.time - a.time;
        if (a.time !== null && b.time === null) return -1;
        if (a.time === null && b.time !== null) return 1;
        return a.index - b.index;
      })
      .map((entry) => entry.game);
  }

  function filteredGames() {
    const games = orderedGames();
    const days = RANGE_DAYS[selectedRange];
    if (!days) return games;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return games.filter((game) => {
      const time = gameTime(game);
      return time !== null && time >= cutoff;
    });
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function formatRangeDate(date) {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function rangeText() {
    const days = RANGE_DAYS[selectedRange];
    if (!days) return 'ALL FINALIZED GAMES';
    const end = new Date();
    const start = new Date(end.getTime() - (days * 24 * 60 * 60 * 1000));
    return `${formatRangeDate(start)} — ${formatRangeDate(end)}`;
  }

  function monthKey(game) {
    const time = gameTime(game);
    if (time === null) return 'DATE UNKNOWN';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'long', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(new Date(time)).toUpperCase();
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

  function formatOvrImpact(before, after, movement) {
    if (after === undefined || after === null || after === '') return '';
    const beforeText = before === undefined || before === null || before === '' ? 'UNRANKED' : String(before);
    const afterText = String(after);
    const move = Number(movement);
    const moveText = Number.isFinite(move) && move !== 0 ? ` (${move > 0 ? '+' : ''}${move})` : '';
    return `${beforeText} → ${afterText}${moveText}`;
  }

  function renderPlayer(player) {
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
      <div class="rp-game-history-player${isYou ? ' is-you' : ''}">
        <div class="rp-game-history-player-head">
          <div>
            <strong>${esc(player?.playerName || player?.player_name || 'REAL PLAY PLAYER')}</strong>
            <small>${unclaimed ? 'UNCLAIMED PLAYER' : impact ? esc(impact) : 'OFFICIAL PARTICIPANT'}</small>
          </div>
          ${isYou ? '<b>YOU</b>' : unclaimed ? '<em>UNCLAIMED</em>' : ''}
        </div>
        <div class="rp-game-history-player-stats">
          <span><strong>${pts}</strong><small>PTS</small></span>
          <span><strong>${ast}</strong><small>AST</small></span>
          <span><strong>${reb}</strong><small>REB</small></span>
          <span><strong>${tov}</strong><small>TO</small></span>
        </div>
      </div>`;
  }

  function renderTeam(game, side) {
    const fromTeams = game?.teams?.[side];
    const players = Array.isArray(fromTeams)
      ? fromTeams
      : (Array.isArray(game?.players) ? game.players : [])
        .filter((player) => String(player?.team || '').toLowerCase() === side);

    return `
      <section class="rp-game-history-team ${side}">
        <header><span>${esc(sideLabel(game, side))}</span><strong>${gameScore(game, side)}</strong></header>
        <div>${players.length ? players.map(renderPlayer).join('') : '<p>PLAYER BOX SCORE NOT AVAILABLE.</p>'}</div>
      </section>`;
  }

  function renderGame(game) {
    const result = String(game?.result || 'FINAL').toUpperCase();
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const pts = number(pick(game?.pts, game?.points));
    const ast = number(pick(game?.ast, game?.assists));
    const reb = number(pick(game?.reb, game?.rebounds));
    const tov = number(pick(game?.tov, game?.to, game?.turnovers));
    const date = formatDate(pick(game?.finalizedAt, game?.finalized_at, game?.startsAt, game?.starts_at));
    const location = game?.locationName ? String(game.locationName).toUpperCase() : '';
    const meta = [date, location].filter(Boolean).join(' · ');
    const players = Array.isArray(game?.players) ? game.players : [];
    const impact = formatOvrImpact(
      pick(game?.ovrBefore, game?.ovr_before),
      pick(game?.ovrAfter, game?.ovr_after, game?.ovr),
      pick(game?.ovrMovement, game?.ovr_movement)
    );

    return `
      <details class="rp-game-history-game">
        <summary>
          <div class="rp-game-history-game-main">
            <strong>${esc(gameLabel(game))}</strong>
            <span>${esc(meta)}</span>
          </div>
          <b class="${resultClass}">${esc(result)}</b>
          <div class="rp-game-history-score">
            <span>${esc(sideLabel(game, 'east'))}</span><strong>${gameScore(game, 'east')}</strong><i>—</i><strong>${gameScore(game, 'west')}</strong><span>${esc(sideLabel(game, 'west'))}</span>
          </div>
          <div class="rp-game-history-stats">
            <span>${pts} PTS</span><span>${ast} AST</span><span>${reb} REB</span><span>${tov} TO</span>
          </div>
          <div class="rp-game-history-open"><span>VIEW BOX SCORE</span><b>⌄</b></div>
        </summary>
        <div class="rp-game-history-detail">
          ${impact ? `<div class="rp-game-history-impact"><span>YOUR OVR</span><strong>${esc(impact)}</strong></div>` : ''}
          ${players.length ? `
            <div class="rp-game-history-teams">
              ${renderTeam(game, 'east')}
              ${renderTeam(game, 'west')}
            </div>` : `
            <div class="rp-game-history-detail-empty">
              <strong>FULL BOX SCORE NOT AVAILABLE YET.</strong>
              <p>This finalized game is on your record, but its all-player detail has not been returned yet.</p>
            </div>`}
        </div>
      </details>`;
  }

  function groupedGameMarkup(games) {
    const groups = new Map();
    for (const game of games) {
      const key = monthKey(game);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(game);
    }
    return [...groups.entries()].map(([month, monthGames]) => `
      <section class="rp-game-history-month">
        <div class="rp-game-history-month-head">
          <strong>${esc(month)}</strong>
          <span>${monthGames.length} GAME${monthGames.length === 1 ? '' : 'S'}</span>
        </div>
        <div class="rp-game-history-list">${monthGames.map(renderGame).join('')}</div>
      </section>`).join('');
  }

  function createPage() {
    if (page) return page;
    page = document.createElement('section');
    page.className = 'rp-game-history-page';
    page.dataset.rpGameHistory = 'true';
    page.setAttribute('aria-hidden', 'true');
    page.innerHTML = `
      <div class="rp-game-history-shell">
        <header class="rp-game-history-topbar">
          <button type="button" data-rp-game-history-back aria-label="Back to Me">←</button>
          <div><strong>GAME HISTORY</strong><span>REAL PLAY BASKETBALL</span></div>
          <b>FINALIZED</b>
        </header>
        <main class="rp-game-history-body">
          <p class="rp-game-history-status" data-rp-game-history-status aria-live="polite"></p>
          <div data-rp-game-history-content></div>
        </main>
      </div>`;
    document.body.appendChild(page);
    page.querySelector('[data-rp-game-history-back]')?.addEventListener('click', closeHistory);
    return page;
  }

  function setStatus(message = '', error = false) {
    const node = page?.querySelector('[data-rp-game-history-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  function render() {
    const root = page?.querySelector('[data-rp-game-history-content]');
    if (!root) return;
    const games = filteredGames();
    const wins = games.filter((game) => String(game?.result || '').toUpperCase() === 'WIN').length;
    const losses = games.filter((game) => String(game?.result || '').toUpperCase() === 'LOSS').length;

    root.innerHTML = `
      <section class="rp-game-history-intro">
        <small>MY REAL PLAY</small>
        <h1>GAME HISTORY</h1>
        <p>Review your finalized games without crowding your main player profile.</p>
      </section>

      <section class="rp-game-history-range-card">
        <div class="rp-game-history-range-tabs" role="group" aria-label="Game history timeframe">
          ${Object.keys(RANGE_DAYS).map((range) => `
            <button type="button" data-rp-history-range="${range}" class="${selectedRange === range ? 'active' : ''}" aria-pressed="${selectedRange === range ? 'true' : 'false'}">
              ${RANGE_LABELS[range]}
            </button>`).join('')}
        </div>
        <div class="rp-game-history-range-summary">
          <div><small>TIMEFRAME</small><strong>${esc(rangeText())}</strong></div>
          <div><small>RECORD</small><strong>${wins}-${losses}</strong></div>
          <div><small>GAMES</small><strong>${games.length}</strong></div>
        </div>
      </section>

      ${games.length ? groupedGameMarkup(games) : `
        <section class="rp-game-history-empty">
          <strong>NO FINALIZED GAMES IN THIS RANGE.</strong>
          <p>Choose a wider timeframe to look further back in your Real Play history.</p>
          ${selectedRange !== 'all' ? '<button type="button" data-rp-history-show-all>SHOW ALL TIME</button>' : ''}
        </section>`}`;

    root.querySelectorAll('[data-rp-history-range]').forEach((button) => {
      button.addEventListener('click', () => {
        const range = button.dataset.rpHistoryRange;
        if (!Object.prototype.hasOwnProperty.call(RANGE_DAYS, range)) return;
        selectedRange = range;
        render();
        page.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    root.querySelector('[data-rp-history-show-all]')?.addEventListener('click', () => {
      selectedRange = 'all';
      render();
      page.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  async function loadHistory() {
    if (loading) return;
    loading = true;
    setStatus('LOADING GAME HISTORY...');
    try {
      const accessToken = token();
      if (!accessToken) throw new Error('Please log in to Real Play first.');
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load your game history.');
      state = data;
      render();
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'Could not load your game history.', true);
    } finally {
      loading = false;
    }
  }

  function openHistory() {
    createPage();
    selectedRange = '90';
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-game-history-open');
    page.scrollTop = 0;
    loadHistory();
  }

  function closeHistory() {
    if (!page) return;
    page.classList.remove('open');
    page.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-game-history-open');
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-profile-history-toggle]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openHistory();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !page?.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeHistory();
  }, true);

  window.RealPlayGameHistory = { open: openHistory, close: closeHistory, refresh: loadHistory };
})();