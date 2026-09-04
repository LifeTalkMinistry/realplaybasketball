(() => {
  if (window.__realPlayRankingGamesInstalled) return;
  window.__realPlayRankingGamesInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const REQUIRED_GAMES = 5;
  const SESSION_POLL_MS = 2000;

  const app = document.querySelector('[data-rp-app]');
  const lobby = document.querySelector('[data-rp-lobby]');
  if (!app || !lobby || document.querySelector('[data-rp-ranking-games]')) return;

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Real Play session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
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
        <p data-rp-ranking-copy>Complete 5 official Ranking Games to establish your first Real Play OVR.</p>

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

      <section class="rp-ranking-next" data-rp-ranking-announcement>
        <div class="rp-ranking-section-head">
          <div><small>GET ON COURT</small><h2>NEXT RANKING GAME</h2></div>
          <button type="button" data-rp-ranking-cancel hidden aria-label="Cancel Ranking Game reservation" style="appearance:none;align-self:center;min-height:30px;padding:0 10px;border:1px solid rgba(255,104,119,.30);border-radius:9px;background:rgba(55,14,24,.38);color:#ff91a0;font-family:var(--rp-display);font-size:.43rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase">CANCEL SPOT</button>
        </div>
        <article class="rp-ranking-session" data-rp-ranking-session>
          <span data-rp-ranking-session-status>NO GAME ANNOUNCED</span>
          <strong data-rp-ranking-session-title>TO BE ANNOUNCED</strong>
          <p data-rp-ranking-session-copy>The next official Ranking Game will appear here once Real Play announces the court, date and time.</p>
          <button type="button" data-rp-ranking-session-action disabled>WAITING FOR ANNOUNCEMENT</button>
        </article>
      </section>

      <section class="rp-ranking-matchup" data-rp-ranking-live-matchup aria-labelledby="rp-ranking-matchup-title" hidden>
        <div class="rp-ranking-section-head">
          <div><small>GAME IS LIVE</small><h2 id="rp-ranking-matchup-title">EAST <span>VS</span> WEST</h2></div>
          <b>LIVE SIDES</b>
        </div>
        <div class="rp-ranking-sides">
          <article class="east"><small>TEAM EAST</small><strong data-rp-ranking-east-score>0</strong><span>LIVE SCORE</span></article>
          <div class="rp-ranking-versus">VS</div>
          <article class="west"><small>TEAM WEST</small><strong data-rp-ranking-west-score>0</strong><span>LIVE SCORE</span></article>
        </div>
        <p class="rp-ranking-side-note" data-rp-ranking-live-note>East and West appear only after the admin starts the actual basketball game.</p>
      </section>

      <section class="rp-ranking-rules">
        <div class="rp-ranking-section-head">
          <div><small>YOUR VERIFIED TOTALS</small><h2>OFFICIAL COMPETITIVE DATA</h2></div>
        </div>
        <div class="rp-ranking-stat-grid">
          <article><strong data-rp-ranking-stat-pts>0</strong><span>PTS</span></article>
          <article><strong data-rp-ranking-stat-ast>0</strong><span>AST</span></article>
          <article><strong data-rp-ranking-stat-reb>0</strong><span>REB</span></article>
          <article><strong data-rp-ranking-stat-to>0</strong><span>TO</span></article>
          <article><strong data-rp-ranking-stat-record>0-0</strong><span>W/L</span></article>
          <article><strong data-rp-ranking-stat-ovr>—</strong><span>OVR</span></article>
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

      <p class="rp-ranking-message" data-rp-ranking-message aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(view);

  const q = (selector) => view.querySelector(selector);
  const steps = [...view.querySelectorAll('[data-rp-ranking-step]')];
  const sessionAction = q('[data-rp-ranking-session-action]');
  const cancelAction = q('[data-rp-ranking-cancel]');
  let profileLoading = false;
  let sessionLoading = false;
  let joining = false;
  let leaving = false;
  let currentSession = null;
  let pollTimer = null;
  let pollCount = 0;

  function setText(selector, value) {
    const node = q(selector);
    if (node) node.textContent = String(value);
  }

  function setMessage(message = '', type = '') {
    const node = q('[data-rp-ranking-message]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
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

  function isGameLive(session) {
    const status = String(pick(session?.gameStatus, session?.game_status, session?.status, '')).trim().toLowerCase();
    return status === 'live' || status === 'in_progress' || status === 'in-progress';
  }

  function showAnnouncement() {
    const announcement = q('[data-rp-ranking-announcement]');
    const matchup = q('[data-rp-ranking-live-matchup]');
    if (announcement) announcement.hidden = false;
    if (matchup) matchup.hidden = true;
  }

  function showLiveMatchup(session) {
    const announcement = q('[data-rp-ranking-announcement]');
    const matchup = q('[data-rp-ranking-live-matchup]');
    if (announcement) announcement.hidden = true;
    if (matchup) matchup.hidden = false;
    setText('[data-rp-ranking-east-score]', Number(session?.eastScore ?? session?.east_score ?? 0) || 0);
    setText('[data-rp-ranking-west-score]', Number(session?.westScore ?? session?.west_score ?? 0) || 0);
    setText('[data-rp-ranking-live-note]', session?.joined
      ? 'You are in this Ranking Game. East and West were revealed when the admin started the game.'
      : 'This Ranking Game is live. East and West were revealed when the admin started the game.');
  }

  function renderSession(session) {
    currentSession = session || null;
    const card = q('[data-rp-ranking-session]');
    if (!card || !sessionAction) return;

    card.classList.remove('posted', 'joined', 'full');
    if (cancelAction) {
      cancelAction.hidden = true;
      cancelAction.disabled = true;
      cancelAction.textContent = 'CANCEL SPOT';
    }

    if (session && isGameLive(session)) {
      showLiveMatchup(session);
      return;
    }

    showAnnouncement();

    if (!session || typeof session !== 'object') {
      setText('[data-rp-ranking-session-status]', 'NO GAME ANNOUNCED');
      setText('[data-rp-ranking-session-title]', 'TO BE ANNOUNCED');
      setText('[data-rp-ranking-session-copy]', 'The next official Ranking Game will appear here once Real Play announces the court, date and time.');
      sessionAction.disabled = true;
      sessionAction.textContent = 'WAITING FOR ANNOUNCEMENT';
      return;
    }

    const gameStatus = String(session.gameStatus || session.game_status || 'setup').toLowerCase();
    const confirmed = Number(session.confirmedCount ?? session.confirmed_count ?? 0) || 0;
    const capacity = session.capacity === null || session.capacity === undefined ? null : Number(session.capacity);
    const joined = Boolean(session.joined);
    const full = capacity !== null && confirmed >= capacity;
    const available = session.available !== false && !full && gameStatus === 'setup';
    const sessionStarted = Boolean(session.sessionStarted ?? session.session_started);
    const details = [];

    if (session.locationName || session.location_name) details.push(String(session.locationName || session.location_name).toUpperCase());
    if (session.startsAt || session.starts_at) details.push(formatSessionDate(session.startsAt || session.starts_at));
    details.push(capacity === null ? `${confirmed} CONFIRMED` : `${confirmed}/${capacity} CONFIRMED`);

    card.classList.add('posted');
    card.classList.toggle('joined', joined);
    card.classList.toggle('full', full);

    const canCancel = joined && gameStatus === 'setup';
    if (cancelAction) {
      cancelAction.hidden = !canCancel;
      cancelAction.disabled = !canCancel || joining || leaving;
      cancelAction.textContent = leaving ? 'CANCELLING…' : 'CANCEL SPOT';
    }

    if (gameStatus === 'final') {
      setText('[data-rp-ranking-session-status]', 'RANKING GAME COMPLETE');
      setText('[data-rp-ranking-session-title]', String(session.title || 'RANKING GAME').toUpperCase());
      setText('[data-rp-ranking-session-copy]', `FINAL · EAST ${Number(session.eastScore || 0)} — ${Number(session.westScore || 0)} WEST`);
      sessionAction.disabled = true;
      sessionAction.textContent = 'FINAL';
      return;
    }

    setText('[data-rp-ranking-session-status]', joined
      ? (sessionStarted ? 'YOU’RE IN · CHECK-IN OPEN' : 'YOU’RE IN · SCHEDULED')
      : full
        ? 'RANKING GAME FULL'
        : sessionStarted
          ? 'CHECK-IN OPEN'
          : 'RANKING GAME ANNOUNCED');
    setText('[data-rp-ranking-session-title]', String(session.title || 'RANKING GAME').toUpperCase());
    setText('[data-rp-ranking-session-copy]', details.join(' · '));

    if (joining) {
      sessionAction.disabled = true;
      sessionAction.textContent = 'JOINING…';
    } else if (joined) {
      sessionAction.disabled = true;
      sessionAction.textContent = '✓ YOU’RE IN';
    } else if (full || !available) {
      sessionAction.disabled = true;
      sessionAction.textContent = full ? 'RANKING GAME FULL' : 'JOINING CLOSED';
    } else {
      sessionAction.disabled = false;
      sessionAction.textContent = 'JOIN RANKING GAME';
    }
  }

  function renderProfile(state = {}) {
    const profile = state.profile || {};
    const career = state.career || state.careerSummary || state.career_summary || profile.career || {};
    const ranking = state.ranking || state.rankingGames || state.ranking_games || career.ranking || {};
    const stats = state.careerStats || career.stats || career || {};

    const ovr = pick(
      state.ovr,
      ranking.ovr,
      career.ovr,
      career.rating,
      state.careerStats?.ovr,
      state.careerStats?.rating,
      profile.ovr,
      profile.rating
    );
    const ranked = ovr !== undefined && ovr !== null && ovr !== '';

    const points = num(pick(stats.pts, stats.points), 0);
    const assists = num(pick(stats.ast, stats.assists), 0);
    const rebounds = num(pick(stats.reb, stats.rebounds), 0);
    const turnovers = num(pick(stats.to, stats.tov, stats.turnovers), 0);
    const wins = num(stats.wins, 0);
    const losses = num(stats.losses, 0);

    setText('[data-rp-ranking-stat-pts]', points);
    setText('[data-rp-ranking-stat-ast]', assists);
    setText('[data-rp-ranking-stat-reb]', rebounds);
    setText('[data-rp-ranking-stat-to]', turnovers);
    setText('[data-rp-ranking-stat-record]', `${wins}-${losses}`);
    setText('[data-rp-ranking-stat-ovr]', ranked ? ovr : '—');

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
      stats.games,
      stats.gamesPlayed,
      0
    ), 0), 0, required);

    view.classList.toggle('ranked', ranked);

    if (ranked) {
      setText('[data-rp-ranking-kicker]', 'RANKED COMPETITIVE PLAY');
      setText('[data-rp-ranking-title]', 'DEFEND YOUR OVR.');
      setText('[data-rp-ranking-copy]', 'You already have a Real Play ranking. Keep playing official Ranking Games and your OVR can rise or fall from verified performance.');
      setText('[data-rp-ranking-status-label]', 'CURRENT OVR');
      setText('[data-rp-ranking-status-value]', ovr);
      setText('[data-rp-ranking-status-note]', 'RANKED PLAYER');
      q('[data-rp-ranking-progress]')?.setAttribute('aria-hidden', 'true');
      steps.forEach((step) => step.classList.add('complete'));
    } else {
      setText('[data-rp-ranking-kicker]', 'BUILD YOUR OVR');
      setText('[data-rp-ranking-title]', 'GET RANKED.');
      setText('[data-rp-ranking-copy]', `Complete ${required} official Ranking Games to establish your first Real Play OVR.`);
      setText('[data-rp-ranking-status-label]', 'UNRANKED');
      setText('[data-rp-ranking-status-value]', `${completed} / ${required}`);
      setText('[data-rp-ranking-status-note]', 'OFFICIAL GAMES');
      q('[data-rp-ranking-progress]')?.setAttribute('aria-hidden', 'false');
      steps.forEach((step, index) => step.classList.toggle('complete', index < completed));
    }
  }

  async function refreshProfile() {
    if (profileLoading || !token()) return;
    profileLoading = true;
    try {
      const data = await api('/api/real-play/me');
      renderProfile(data || {});
    } catch (error) {
      if (error.status === 401) {
        close();
        document.querySelector('[data-auth-open]')?.click();
      }
    } finally {
      profileLoading = false;
    }
  }

  async function refreshSession({ quiet = false } = {}) {
    if (sessionLoading || joining || leaving || !token()) return;
    sessionLoading = true;
    try {
      const data = await api('/api/real-play/career/session');
      renderSession(data?.session || null);
      if (!quiet) setMessage('');
    } catch (error) {
      if (error.status === 401) {
        close();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      if (!quiet) setMessage(error.message || 'Could not load the Ranking Game schedule.', 'error');
    } finally {
      sessionLoading = false;
    }
  }

  async function joinRankingGame() {
    if (joining || leaving || !currentSession || currentSession.joined) return;
    if (String(currentSession.gameStatus || 'setup').toLowerCase() !== 'setup') return;
    joining = true;
    setMessage('');
    renderSession(currentSession);
    try {
      const data = await api('/api/real-play/career/play', { method: 'POST' });
      renderSession(data?.session || currentSession);
      setMessage('YOU’RE CONFIRMED FOR THIS RANKING GAME.', 'success');
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed'));
    } catch (error) {
      setMessage(error.message || 'Unable to join this Ranking Game.', 'error');
    } finally {
      joining = false;
      await refreshSession({ quiet: true });
    }
  }

  async function cancelRankingGame() {
    if (joining || leaving || !currentSession || !currentSession.joined) return;
    if (String(currentSession.gameStatus || currentSession.game_status || 'setup').toLowerCase() !== 'setup') return;

    const title = String(currentSession.title || 'this Ranking Game');
    if (!window.confirm(`Cancel your reservation for ${title}?\n\nYour spot will be released for another player.`)) return;

    leaving = true;
    setMessage('');
    renderSession(currentSession);
    try {
      const data = await api('/api/real-play/career/play', { method: 'DELETE' });
      renderSession(data?.session || currentSession);
      setMessage('YOUR RANKING GAME RESERVATION WAS CANCELLED.', 'success');
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed'));
    } catch (error) {
      setMessage(error.message || 'Unable to cancel this Ranking Game reservation.', 'error');
    } finally {
      leaving = false;
      await refreshSession({ quiet: true });
    }
  }

  function startPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollCount = 0;
    pollTimer = window.setInterval(() => {
      if (!view.classList.contains('open')) return;
      pollCount += 1;
      refreshSession({ quiet: true });
      if (pollCount % 2 === 0) refreshProfile();
    }, SESSION_POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
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
    refreshProfile();
    refreshSession();
    startPolling();
  }

  function close() {
    stopPolling();
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-ranking-open');
  }

  sessionAction?.addEventListener('click', joinRankingGame);
  cancelAction?.addEventListener('click', cancelRankingGame);
  q('[data-rp-ranking-back]')?.addEventListener('click', close);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && view.classList.contains('open')) close();
  });
  window.addEventListener('focus', () => {
    if (!view.classList.contains('open')) return;
    refreshProfile();
    refreshSession({ quiet: true });
  });
  window.addEventListener('realplay:ranking-session-changed', () => {
    refreshProfile();
    refreshSession({ quiet: true });
  });
  window.addEventListener('realplay:player-stats-changed', refreshProfile);

  showAnnouncement();
  window.RealPlayRankingGames = { open, close, refresh: () => Promise.all([refreshProfile(), refreshSession()]) };
})();