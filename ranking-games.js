(() => {
  if (window.__realPlayRankingGamesInstalled) return;
  window.__realPlayRankingGamesInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const REQUIRED_GAMES = 5;

  const app = document.querySelector('[data-rp-app]');
  const lobby = document.querySelector('[data-rp-lobby]');
  if (!app || !lobby || document.querySelector('[data-rp-ranking-games]')) return;

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  const view = document.createElement('section');
  view.className = 'rp-ranking-view';
  view.dataset.rpRankingGames = 'true';
  view.setAttribute('aria-hidden', 'true');
  view.innerHTML = `
    <div class="rp-ranking-shell">
      <header class="rp-ranking-topbar">
        <button class="rp-ranking-back" type="button" aria-label="Back to main menu" data-rp-ranking-back>←</button>
        <div class="rp-ranking-brand">
          <strong>RANKING GAMES</strong>
          <span>REAL PLAY BASKETBALL</span>
        </div>
        <div class="rp-ranking-mark">E/W</div>
      </header>

      <section class="rp-ranking-hero">
        <small class="rp-ranking-kicker" data-rp-ranking-kicker>BUILD YOUR OVR</small>
        <h1 data-rp-ranking-title>GET RANKED.</h1>
        <p data-rp-ranking-copy>Complete 5 official East vs West Ranking Games to establish your first Real Play OVR.</p>

        <div class="rp-ranking-status-card">
          <div>
            <span data-rp-ranking-status-label>UNRANKED</span>
            <strong data-rp-ranking-status-value>0 / 5</strong>
          </div>
          <em data-rp-ranking-status-note>OFFICIAL GAMES</em>
        </div>

        <div class="rp-ranking-progress" data-rp-ranking-progress aria-label="Ranking Game progress">
          ${Array.from({ length: REQUIRED_GAMES }, (_, index) => `<i data-rp-ranking-step="${index + 1}"></i>`).join('')}
        </div>
      </section>

      <section class="rp-ranking-matchup" aria-labelledby="rp-ranking-matchup-title">
        <div class="rp-ranking-section-head">
          <div><small>EVERY RANKING GAME</small><h2 id="rp-ranking-matchup-title">EAST <span>VS</span> WEST</h2></div>
          <b>TEMPORARY SIDES</b>
        </div>
        <div class="rp-ranking-sides">
          <article class="east"><small>TEAM</small><strong>EAST</strong><span>Assigned for this game</span></article>
          <div class="rp-ranking-versus">VS</div>
          <article class="west"><small>TEAM</small><strong>WEST</strong><span>Assigned for this game</span></article>
        </div>
        <p class="rp-ranking-side-note">East and West are game sides only. They do not replace your permanent Real Play identity or your Beta League club.</p>
      </section>

      <section class="rp-ranking-rules">
        <div class="rp-ranking-section-head">
          <div><small>WHAT COUNTS</small><h2>OFFICIAL COMPETITIVE DATA</h2></div>
        </div>
        <div class="rp-ranking-stat-grid">
          <article><strong>PTS</strong><span>Points</span></article>
          <article><strong>AST</strong><span>Assists</span></article>
          <article><strong>REB</strong><span>Rebounds</span></article>
          <article><strong>TO</strong><span>Turnovers</span></article>
          <article><strong>W/L</strong><span>Result</span></article>
          <article><strong>OVR</strong><span>Rating</span></article>
        </div>
        <div class="rp-ranking-rule-row">
          <span>UNRANKED PLAYER</span>
          <strong>5 VERIFIED GAMES → FIRST OVR</strong>
        </div>
        <div class="rp-ranking-rule-row">
          <span>ALREADY RANKED</span>
          <strong>KEEP PLAYING → OVR CAN MOVE</strong>
        </div>
        <div class="rp-ranking-rule-row muted">
          <span>MEDIA</span>
          <strong>NO OFFICIAL VIDEO RECORDING</strong>
        </div>
      </section>

      <section class="rp-ranking-next">
        <div class="rp-ranking-section-head">
          <div><small>GET ON COURT</small><h2>NEXT RANKING GAME</h2></div>
        </div>
        <article class="rp-ranking-session" data-rp-ranking-session>
          <span data-rp-ranking-session-status>NO SESSION POSTED</span>
          <strong data-rp-ranking-session-title>TO BE ANNOUNCED</strong>
          <p data-rp-ranking-session-copy>When Real Play posts an official Ranking Game, the court, date, time and East vs West player slots will appear here.</p>
          <button type="button" data-rp-ranking-session-action disabled>WAITING FOR SCHEDULE</button>
        </article>
      </section>

      <p class="rp-ranking-message" data-rp-ranking-message aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(view);

  const q = (selector) => view.querySelector(selector);
  const steps = [...view.querySelectorAll('[data-rp-ranking-step]')];
  let loading = false;

  function setText(selector, value) {
    const node = q(selector);
    if (node) node.textContent = String(value);
  }

  function setMessage(message = '', type = '') {
    const node = q('[data-rp-ranking-message]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  function formatSessionDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function renderSession(session) {
    const card = q('[data-rp-ranking-session]');
    const action = q('[data-rp-ranking-session-action]');
    if (!card || !action) return;

    if (!session || typeof session !== 'object') {
      card.classList.remove('posted');
      setText('[data-rp-ranking-session-status]', 'NO SESSION POSTED');
      setText('[data-rp-ranking-session-title]', 'TO BE ANNOUNCED');
      setText('[data-rp-ranking-session-copy]', 'When Real Play posts an official Ranking Game, the court, date, time and East vs West player slots will appear here.');
      action.disabled = true;
      action.textContent = 'WAITING FOR SCHEDULE';
      return;
    }

    const title = pick(session.title, session.location_name, session.locationName, session.location, 'RANKING GAME');
    const date = pick(session.startsAt, session.starts_at, session.date, session.dateLabel, session.date_label);
    const time = pick(session.time, session.timeLabel, session.time_label);
    const capacity = pick(session.capacity, session.playerCapacity, session.player_capacity);
    const reserved = pick(session.reservedCount, session.reserved_count, session.reserved);
    const details = [
      formatSessionDate(date),
      time && !date ? String(time).toUpperCase() : '',
      capacity !== undefined && reserved !== undefined ? `${reserved}/${capacity} PLAYERS` : '',
      'EAST VS WEST',
    ].filter(Boolean);

    card.classList.add('posted');
    setText('[data-rp-ranking-session-status]', 'OFFICIAL RANKING GAME');
    setText('[data-rp-ranking-session-title]', String(title).toUpperCase());
    setText('[data-rp-ranking-session-copy]', details.join(' · ') || 'OFFICIAL EAST VS WEST RANKING GAME');
    action.disabled = true;
    action.textContent = 'BOOKING VIA REAL PLAY SCHEDULE';
  }

  function render(state = {}) {
    const profile = state.profile || {};
    const career = state.career || state.careerSummary || state.career_summary || profile.career || {};
    const ranking = state.ranking || state.rankingGames || state.ranking_games || career.ranking || {};

    const ovr = pick(
      state.ovr,
      ranking.ovr,
      career.ovr,
      career.rating,
      profile.ovr,
      profile.rating
    );
    const ranked = ovr !== undefined && ovr !== null && ovr !== '';

    const required = Math.max(1, num(pick(
      ranking.requiredGames,
      ranking.required_games,
      state.rankingGamesRequired,
      state.ranking_games_required,
      state.placementGamesRequired,
      state.placement_games_required,
      REQUIRED_GAMES
    ), REQUIRED_GAMES));

    const completed = clamp(num(pick(
      ranking.completedGames,
      ranking.completed_games,
      ranking.gamesCompleted,
      ranking.games_completed,
      state.rankingGamesCompleted,
      state.ranking_games_completed,
      state.placementGamesCompleted,
      state.placement_games_completed,
      career.rankingGamesCompleted,
      career.ranking_games_completed,
      career.placementGamesCompleted,
      career.placement_games_completed,
      0
    ), 0), 0, required);

    view.classList.toggle('ranked', ranked);

    if (ranked) {
      setText('[data-rp-ranking-kicker]', 'RANKED COMPETITIVE PLAY');
      setText('[data-rp-ranking-title]', 'DEFEND YOUR OVR.');
      setText('[data-rp-ranking-copy]', 'You already have a Real Play ranking. Keep playing official East vs West Ranking Games and your OVR can rise or fall from verified performance.');
      setText('[data-rp-ranking-status-label]', 'CURRENT OVR');
      setText('[data-rp-ranking-status-value]', ovr);
      setText('[data-rp-ranking-status-note]', 'RANKED PLAYER');
      q('[data-rp-ranking-progress]')?.setAttribute('aria-hidden', 'true');
      steps.forEach((step) => step.classList.add('complete'));
    } else {
      setText('[data-rp-ranking-kicker]', 'BUILD YOUR OVR');
      setText('[data-rp-ranking-title]', 'GET RANKED.');
      setText('[data-rp-ranking-copy]', `Complete ${required} official East vs West Ranking Games to establish your first Real Play OVR.`);
      setText('[data-rp-ranking-status-label]', 'UNRANKED');
      setText('[data-rp-ranking-status-value]', `${completed} / ${required}`);
      setText('[data-rp-ranking-status-note]', 'OFFICIAL GAMES');
      q('[data-rp-ranking-progress]')?.setAttribute('aria-hidden', 'false');
      steps.forEach((step, index) => step.classList.toggle('complete', index < completed));
    }

    renderSession(pick(
      state.nextRankingSession,
      state.next_ranking_session,
      ranking.nextSession,
      ranking.next_session,
      state.upcomingRankingSession,
      state.upcoming_ranking_session
    ));
  }

  async function refresh() {
    if (loading || !token()) return;
    loading = true;
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
        cache: 'no-store',
      });
      if (response.status === 401) {
        close();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      if (!response.ok) throw new Error('Could not load your Ranking Games status.');
      render(await response.json().catch(() => ({})));
    } catch (error) {
      setMessage(error.message || 'Could not load your Ranking Games status.', 'error');
    } finally {
      loading = false;
    }
  }

  function open() {
    if (!token()) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-ranking-open');
    view.scrollTop = 0;
    refresh();
  }

  function close() {
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-ranking-open');
  }

  q('[data-rp-ranking-back]')?.addEventListener('click', close);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && view.classList.contains('open')) close();
  });
  window.addEventListener('focus', () => {
    if (view.classList.contains('open')) refresh();
  });

  window.RealPlayRankingGames = { open, close, refresh };
})();