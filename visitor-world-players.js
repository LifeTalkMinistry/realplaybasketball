(() => {
  if (window.__realPlayVisitorWorldPlayersInstalled) return;
  window.__realPlayVisitorWorldPlayersInstalled = true;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const isVisitor = () => Boolean(window.RealPlayVisitor?.isActive?.());

  let profilePanel = null;
  let loadingPlayers = false;
  let loadingProfile = false;

  function world() {
    return document.querySelector('[data-rp-world]');
  }

  function activatePlayersView() {
    const panel = world();
    if (!panel) return false;
    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.worldTab === 'players');
    });
    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== 'players';
    });
    return true;
  }

  function setStatus(message = '', type = '') {
    const node = world()?.querySelector('[data-world-player-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  async function loadPlayers() {
    if (loadingPlayers || !isVisitor()) return;
    loadingPlayers = true;
    setStatus('LOADING PLAYERS...');
    try {
      const data = await window.RealPlayWorld?.community?.('players');
      const players = Array.isArray(data?.players) ? data.players : [];
      const root = world()?.querySelector('[data-world-player-list]');
      const count = world()?.querySelector('[data-world-player-count]');
      if (count) count.textContent = `${players.length} PLAYER${players.length === 1 ? '' : 'S'}`;
      if (root) {
        root.innerHTML = players.length ? players.map((player) => {
          const jersey = player.playerNumber === null || player.playerNumber === undefined ? '#—' : `#${Number(player.playerNumber)}`;
          const rating = player.ovr === null || player.ovr === undefined
            ? '<span class="rp-world-player-ovr unranked">UNRANKED</span>'
            : `<span class="rp-world-player-ovr">${esc(player.ovr)} <small>OVR</small></span>`;
          return `<button type="button" class="rp-world-player-row" data-world-player-id="${esc(player.playerId || player.userId)}"><span class="rp-world-player-name"><strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong><b>${esc(jersey)}</b></span>${rating}</button>`;
        }).join('') : '<div class="rp-world-player-empty">NO REAL PLAY PLAYER PROFILES YET.</div>';
      }
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'Could not load players.', 'error');
    } finally {
      loadingPlayers = false;
    }
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date).toUpperCase();
  }

  function createProfilePanel() {
    if (profilePanel) return profilePanel;
    profilePanel = document.createElement('section');
    profilePanel.className = 'rp-profile rp-public-player-profile';
    profilePanel.dataset.rpVisitorPublicProfile = 'true';
    profilePanel.setAttribute('aria-hidden', 'true');
    profilePanel.innerHTML = `<div class="rp-profile-shell"><header class="rp-profile-topbar"><button type="button" class="rp-profile-back" data-visitor-profile-close aria-label="Back to players">←</button><div><strong>PROFILE</strong><span>REAL PLAY BASKETBALL</span></div><b>PLAYER ID</b></header><main class="rp-profile-body"><p class="rp-profile-status" data-visitor-profile-status aria-live="polite"></p><div data-visitor-profile-content></div></main></div>`;
    document.body.appendChild(profilePanel);
    profilePanel.querySelector('[data-visitor-profile-close]')?.addEventListener('click', closeProfile);
    return profilePanel;
  }

  function closeProfile() {
    if (!profilePanel) return;
    profilePanel.classList.remove('open');
    profilePanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-profile-open');
  }

  function renderProfile(player) {
    const root = profilePanel?.querySelector('[data-visitor-profile-content]');
    if (!root) return;
    const stats = player?.careerStats || {};
    const rating = player?.ovr === null || player?.ovr === undefined ? null : Number(player.ovr);
    const rank = player?.rank === null || player?.rank === undefined ? null : Number(player.rank);
    const jersey = player?.playerNumber === null || player?.playerNumber === undefined ? null : Number(player.playerNumber);
    const games = number(pick(stats.games, stats.gamesPlayed));
    const wins = number(stats.wins);
    const losses = number(stats.losses);
    const recent = Array.isArray(player?.recentGames) ? player.recentGames.slice(0, 4) : [];

    root.innerHTML = `
      <section class="rp-profile-hero">
        <div class="rp-profile-hero-glow" aria-hidden="true"></div>
        <div class="rp-profile-identity-line"><span>REAL PLAY PLAYER</span><b>${esc(player?.publicPlayerId || 'PLAYER PROFILE')}</b></div>
        <div class="rp-profile-player"><div class="rp-profile-number"><small>PLAYER</small><strong>${jersey === null ? '#—' : `#${jersey}`}</strong></div><div class="rp-profile-name"><small>PUBLIC PROFILE</small><h1>${esc(player?.playerName || 'REAL PLAY PLAYER')}</h1><p>LESS SCREEN. REAL POINTS.</p></div></div>
        <div class="rp-profile-rating-row"><div class="rp-profile-ovr"><span>OVR</span><strong>${rating === null ? '—' : rating}</strong><small>${rating === null ? 'UNRANKED' : 'BETA RATING'}</small></div><div class="rp-profile-rank"><span>RANK</span><strong>${rank === null ? '—' : `#${rank}`}</strong><small>REAL PLAY</small></div><div class="rp-profile-record"><span>RECORD</span><strong>${wins}-${losses}</strong><small>${games} GAME${games === 1 ? '' : 'S'}</small></div></div>
      </section>
      <section class="rp-profile-section"><div class="rp-profile-section-head"><div><small>CAREER NUMBERS</small><h2>THE COURT KEEPS THE RECEIPTS.</h2></div><span>OFFICIAL GAMES ONLY</span></div><div class="rp-profile-stat-grid"><article><strong>${number(pick(stats.pts, stats.points))}</strong><span>PTS</span></article><article><strong>${number(pick(stats.ast, stats.assists))}</strong><span>AST</span></article><article><strong>${number(pick(stats.reb, stats.rebounds))}</strong><span>REB</span></article><article><strong>${number(pick(stats.to, stats.tov, stats.turnovers))}</strong><span>TO</span></article></div></section>
      <section class="rp-profile-section rp-profile-history"><div class="rp-profile-section-head"><div><small>RECENT HISTORY</small><h2>RECENT REAL PLAY.</h2></div><span>FINALIZED GAMES</span></div>${recent.length ? recent.map((game) => `<article class="rp-profile-game"><div class="rp-profile-game-summary"><div class="rp-profile-game-main"><strong>${esc(game.displayLabel || game.title || game.label || 'OFFICIAL GAME')}</strong><span>${esc([formatDate(game.finalizedAt || game.startsAt), game.locationName].filter(Boolean).join(' · '))}</span></div><b class="${String(game.result || '').toLowerCase()}">${esc(game.result || 'FINAL')}</b><div class="rp-profile-game-stats"><span>${number(pick(game.pts, game.points))} PTS</span><span>${number(pick(game.ast, game.assists))} AST</span><span>${number(pick(game.reb, game.rebounds))} REB</span><span>${number(pick(game.tov, game.to, game.turnovers))} TO</span></div></div></article>`).join('') : '<div class="rp-profile-no-games"><strong>NO OFFICIAL GAMES YET.</strong><p>This player’s verified game history will build here automatically.</p></div>'}</section>`;
  }

  async function openProfile(playerId) {
    if (loadingProfile || !isVisitor()) return;
    createProfilePanel();
    profilePanel.classList.add('open');
    profilePanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-profile-open');
    profilePanel.scrollTop = 0;
    const status = profilePanel.querySelector('[data-visitor-profile-status]');
    const root = profilePanel.querySelector('[data-visitor-profile-content]');
    if (status) status.textContent = 'LOADING PLAYER PROFILE...';
    if (root) root.innerHTML = '';
    loadingProfile = true;
    try {
      const data = await window.RealPlayWorld?.community?.('player_profile', { playerId });
      renderProfile(data?.player || null);
      if (status) status.textContent = '';
    } catch (error) {
      if (status) status.textContent = error.message || 'Could not load this player profile.';
    } finally {
      loadingProfile = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (!isVisitor()) return;
    const playersTab = event.target.closest('[data-world-tab="players"]');
    if (playersTab) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (activatePlayersView()) loadPlayers();
      return;
    }
    const row = event.target.closest('[data-world-player-id]');
    if (row) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const playerId = Number(row.dataset.worldPlayerId);
      if (Number.isSafeInteger(playerId) && playerId > 0) openProfile(playerId);
    }
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profilePanel?.classList.contains('open')) {
      event.stopImmediatePropagation();
      closeProfile();
    }
  }, true);
})();
