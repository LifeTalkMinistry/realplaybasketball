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
        <div class="rp-profile-section-head"><div><small>RECENT HISTORY</small><h2>YOUR LAST REAL PLAY.</h2></div></div>
        ${recentGames.length ? recentGames.map((game) => `
          <article class="rp-profile-game">
            <div><strong>${esc(game.label || `CAREER GAME #${game.id || ''}`)}</strong><span>${esc(formatDate(game.finalizedAt || game.startsAt))}${game.locationName ? ` · ${esc(game.locationName)}` : ''}</span></div>
            <b class="${String(game.result || '').toLowerCase() === 'win' ? 'win' : 'loss'}">${esc(game.result || 'FINAL')}</b>
            <div class="rp-profile-game-stats"><span>${number(pick(game.pts, game.points))} PTS</span><span>${number(pick(game.ast, game.assists))} AST</span><span>${number(pick(game.reb, game.rebounds))} REB</span></div>
          </article>`).join('') : `
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
