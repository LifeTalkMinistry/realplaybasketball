(() => {
  if (window.__realPlayWorldPlayersInstalled) return;
  window.__realPlayWorldPlayersInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;

  let worldPanel = null;
  let publicProfilePanel = null;
  let players = [];
  let meUserId = null;
  let loadingPlayers = false;
  let loadingProfile = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function pick(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function community(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }
    const response = await fetch(COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Real Play could not complete that request.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-world-players-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayersStyles = '1';
    style.textContent = `
      .rp-world-player-directory{display:grid;gap:10px}
      .rp-world-player-directory-head{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:3px 2px 2px}
      .rp-world-player-directory-head small{display:block;color:#42d4ff;font-size:.47rem;font-weight:950;letter-spacing:.12em}
      .rp-world-player-directory-head strong{display:block;margin-top:3px;font-family:var(--rp-display,Arial,sans-serif);font-size:1.05rem;font-style:italic;font-weight:950;letter-spacing:.025em}
      .rp-world-player-directory-head span{color:#536174;font-size:.46rem;font-weight:900;letter-spacing:.08em}
      .rp-world-player-list{display:grid;gap:7px}
      .rp-world-player-row{width:100%;min-height:58px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:0 14px;border:1px solid rgba(255,255,255,.075);border-radius:15px;color:#eef6ff;background:rgba(5,9,15,.94);text-align:left;transition:border-color .16s ease,background .16s ease,transform .16s ease}
      .rp-world-player-row:active{transform:scale(.992)}
      .rp-world-player-row:focus-visible{outline:2px solid rgba(72,215,255,.65);outline-offset:2px}
      .rp-world-player-row:hover{border-color:rgba(62,206,255,.2);background:#07101a}
      .rp-world-player-name{min-width:0;display:flex;align-items:baseline;gap:7px;overflow:hidden}
      .rp-world-player-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.84rem;font-style:italic;font-weight:950;letter-spacing:.02em;text-transform:uppercase}
      .rp-world-player-name b{flex:none;color:#5f7186;font-family:var(--rp-display,Arial,sans-serif);font-size:.7rem;font-weight:950}
      .rp-world-player-ovr{display:flex;align-items:baseline;gap:4px;color:#48d7ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1rem;font-weight:950;letter-spacing:.02em}
      .rp-world-player-ovr small{color:#5d7187;font-size:.43rem;font-weight:950;letter-spacing:.09em}
      .rp-world-player-ovr.unranked{color:#66768a;font-size:.55rem;letter-spacing:.08em}
      .rp-world-player-empty{padding:34px 16px;border:1px dashed rgba(255,255,255,.08);border-radius:16px;color:#627287;background:rgba(4,8,14,.55);font-size:.64rem;font-weight:800;text-align:center}
      .rp-world-player-status{min-height:16px;margin:2px 0 0;color:#617288;font-size:.52rem;font-weight:850;text-align:center;letter-spacing:.04em}
      .rp-world-player-status.error{color:#ff7f8e}
      .rp-public-player-profile{z-index:556}
      @media(max-width:420px){
        .rp-world-primary-tabs{gap:12px}
        .rp-world-primary-tabs button{font-size:.72rem;letter-spacing:.1em}
        .rp-world-primary-tabs>span{font-size:.72rem}
        .rp-world-player-row{min-height:56px;padding-inline:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function renderPlayers() {
    const root = worldPanel?.querySelector('[data-world-player-list]');
    const count = worldPanel?.querySelector('[data-world-player-count]');
    if (!root) return;
    if (count) count.textContent = `${players.length} PLAYER${players.length === 1 ? '' : 'S'}`;

    if (!players.length) {
      root.innerHTML = '<div class="rp-world-player-empty">NO REAL PLAY PLAYER PROFILES YET.</div>';
      return;
    }

    root.innerHTML = players.map((player) => {
      const jersey = player.playerNumber === null || player.playerNumber === undefined
        ? '#—'
        : `#${Number(player.playerNumber)}`;
      const rating = player.ovr === null || player.ovr === undefined
        ? '<span class="rp-world-player-ovr unranked">UNRANKED</span>'
        : `<span class="rp-world-player-ovr">${esc(player.ovr)} <small>OVR</small></span>`;
      return `
        <button type="button" class="rp-world-player-row" data-world-player-id="${esc(player.userId)}" aria-label="Open ${esc(player.playerName)} player profile">
          <span class="rp-world-player-name"><strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong><b>${esc(jersey)}</b></span>
          ${rating}
        </button>`;
    }).join('');
  }

  function setPlayersStatus(message = '', type = '') {
    const node = worldPanel?.querySelector('[data-world-player-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  async function refreshPlayers() {
    if (loadingPlayers) return;
    loadingPlayers = true;
    setPlayersStatus('LOADING PLAYERS...');
    try {
      const data = await community('players');
      players = Array.isArray(data?.players) ? data.players : [];
      meUserId = Number(data?.meUserId || 0) || null;
      renderPlayers();
      setPlayersStatus('');
    } catch (error) {
      setPlayersStatus(error.message || 'Could not load players.', 'error');
      if (error.status === 401) {
        worldPanel?.querySelector('[data-world-close]')?.click();
        document.querySelector('[data-auth-open]')?.click();
      }
    } finally {
      loadingPlayers = false;
    }
  }

  function activatePlayers() {
    if (!worldPanel) return;
    worldPanel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.worldTab === 'players');
    });
    worldPanel.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== 'players';
    });
    refreshPlayers();
  }

  function installPlayersTab() {
    worldPanel = document.querySelector('[data-rp-world]');
    if (!worldPanel) return false;

    const nav = worldPanel.querySelector('.rp-world-primary-tabs');
    const body = worldPanel.querySelector('.rp-world-body');
    const chatsButton = nav?.querySelector('[data-world-tab="chats"]');
    const chatsView = body?.querySelector('[data-world-view="chats"]');
    if (!nav || !body || !chatsButton || !chatsView) return false;

    if (!nav.querySelector('[data-world-tab="players"]')) {
      const separator = document.createElement('span');
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '|';
      separator.dataset.worldPlayersSeparator = 'true';

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.worldTab = 'players';
      button.textContent = 'PLAYERS';

      const separatorBeforeChats = chatsButton.previousElementSibling;
      if (separatorBeforeChats?.matches('span')) {
        nav.insertBefore(button, separatorBeforeChats);
        nav.insertBefore(separator, button);
      } else {
        nav.insertBefore(separator, chatsButton);
        nav.insertBefore(button, chatsButton);
      }

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        activatePlayers();
      });
    }

    if (!body.querySelector('[data-world-view="players"]')) {
      const view = document.createElement('section');
      view.className = 'rp-world-view';
      view.dataset.worldView = 'players';
      view.hidden = true;
      view.innerHTML = `
        <div class="rp-world-player-directory">
          <header class="rp-world-player-directory-head">
            <div><small>REAL PLAY COMMUNITY</small><strong>PLAYERS</strong></div>
            <span data-world-player-count>0 PLAYERS</span>
          </header>
          <p class="rp-world-player-status" data-world-player-status aria-live="polite"></p>
          <div class="rp-world-player-list" data-world-player-list></div>
        </div>`;
      body.insertBefore(view, chatsView);
      view.querySelector('[data-world-player-list]')?.addEventListener('click', handlePlayerClick);
    }

    return true;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function gameScore(game, side) {
    return number(side === 'east'
      ? pick(game?.eastScore, game?.east_score)
      : pick(game?.westScore, game?.west_score), 0);
  }

  function sideLabel(game, side) {
    const labels = game?.teamLabels || game?.team_labels || {};
    return String(labels?.[side] || side).toUpperCase();
  }

  function gameLabel(game) {
    if (game?.displayLabel) return String(game.displayLabel);
    const id = Number(game?.sessionId ?? game?.id);
    if (Number.isFinite(id)) return `RANKING GAME #${String(id).padStart(3, '0')}`;
    return String(game?.label || 'OFFICIAL GAME');
  }

  function renderPublicGame(game) {
    const result = String(game?.result || 'FINAL').toUpperCase();
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const meta = [formatDate(game?.finalizedAt || game?.startsAt), game?.locationName ? String(game.locationName).toUpperCase() : '']
      .filter(Boolean).join(' · ');
    const pts = number(pick(game?.pts, game?.points));
    const ast = number(pick(game?.ast, game?.assists));
    const reb = number(pick(game?.reb, game?.rebounds));
    const tov = number(pick(game?.tov, game?.to, game?.turnovers));

    return `
      <details class="rp-profile-game">
        <summary class="rp-profile-game-summary">
          <div class="rp-profile-game-main"><strong>${esc(gameLabel(game))}</strong><span>${esc(meta)}</span></div>
          <b class="${resultClass}">${esc(result)}</b>
          <div class="rp-profile-game-score">
            <span>${esc(sideLabel(game, 'west'))}</span><strong>${gameScore(game, 'west')}</strong><i>—</i><strong>${gameScore(game, 'east')}</strong><span>${esc(sideLabel(game, 'east'))}</span>
          </div>
          <div class="rp-profile-game-stats"><span>${pts} PTS</span><span>${ast} AST</span><span>${reb} REB</span><span>${tov} TO</span></div>
          <div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>⌄</b></div>
        </summary>
        <div class="rp-profile-game-detail">
          <div class="rp-profile-final-board">
            <small>OFFICIAL FINAL</small>
            <div><span>${esc(sideLabel(game, 'west'))}</span><strong>${gameScore(game, 'west')}</strong><i>—</i><strong>${gameScore(game, 'east')}</strong><span>${esc(sideLabel(game, 'east'))}</span></div>
          </div>
        </div>
      </details>`;
  }

  function createPublicProfilePanel() {
    if (publicProfilePanel) return publicProfilePanel;
    publicProfilePanel = document.createElement('section');
    publicProfilePanel.className = 'rp-profile rp-public-player-profile';
    publicProfilePanel.dataset.rpPublicProfile = 'true';
    publicProfilePanel.setAttribute('aria-hidden', 'true');
    publicProfilePanel.innerHTML = `
      <div class="rp-profile-shell">
        <header class="rp-profile-topbar">
          <button type="button" class="rp-profile-back" data-rp-public-profile-close aria-label="Back to players">←</button>
          <div><strong>PROFILE</strong><span>REAL PLAY BASKETBALL</span></div>
          <b>PLAYER ID</b>
        </header>
        <main class="rp-profile-body">
          <p class="rp-profile-status" data-rp-public-profile-status aria-live="polite"></p>
          <div data-rp-public-profile-content></div>
        </main>
      </div>`;
    document.body.appendChild(publicProfilePanel);
    publicProfilePanel.querySelector('[data-rp-public-profile-close]')?.addEventListener('click', closePublicProfile);
    return publicProfilePanel;
  }

  function setPublicProfileStatus(message = '', type = '') {
    const node = publicProfilePanel?.querySelector('[data-rp-public-profile-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  function renderPublicProfile(player) {
    const root = publicProfilePanel?.querySelector('[data-rp-public-profile-content]');
    if (!root) return;
    publicProfilePanel.__realPlayPublicPlayer = player || null;
    if (player?.playerId) publicProfilePanel.dataset.rpPublicPlayerId = String(player.playerId);
    else delete publicProfilePanel.dataset.rpPublicPlayerId;

    const stats = player?.careerStats || {};
    const jersey = player?.playerNumber === null || player?.playerNumber === undefined ? null : Number(player.playerNumber);
    const rating = player?.ovr === null || player?.ovr === undefined ? null : Number(player.ovr);
    const playerRank = player?.rank === null || player?.rank === undefined ? null : Number(player.rank);
    const games = number(pick(stats.games, stats.gamesPlayed));
    const wins = number(stats.wins);
    const losses = number(stats.losses);
    const points = number(pick(stats.pts, stats.points));
    const assists = number(pick(stats.ast, stats.assists));
    const rebounds = number(pick(stats.reb, stats.rebounds));
    const turnovers = number(pick(stats.to, stats.tov, stats.turnovers));
    const recentGames = Array.isArray(player?.recentGames) ? player.recentGames.slice(0, 4) : [];

    root.innerHTML = `
      <section class="rp-profile-hero">
        <div class="rp-profile-hero-glow" aria-hidden="true"></div>
        <div class="rp-profile-identity-line"><span>REAL PLAY PLAYER</span><b>PLAYER PROFILE</b></div>
        <div class="rp-profile-player">
          <div class="rp-profile-number"><small>PLAYER</small><strong>${jersey === null ? '#—' : `#${jersey}`}</strong></div>
          <div class="rp-profile-name"><small>REAL PLAY PROFILE</small><h1>${esc(player?.playerName || 'REAL PLAY PLAYER')}</h1><p>LESS SCREEN. REAL POINTS.</p></div>
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
        <div class="rp-profile-section-head"><div><small>RECENT HISTORY</small><h2>RECENT REAL PLAY.</h2></div><span>FINALIZED GAMES</span></div>
        ${recentGames.length
          ? recentGames.map(renderPublicGame).join('')
          : '<div class="rp-profile-no-games"><strong>NO OFFICIAL GAMES YET.</strong><p>This player’s verified game history will build here automatically.</p></div>'}
      </section>`;

    window.dispatchEvent(new CustomEvent('realplay:public-profile-loaded', {
      detail: { playerId: Number(player?.playerId || 0) || null },
    }));
  }

  async function openPublicProfile(playerId) {
    if (loadingProfile) return;
    createPublicProfilePanel();
    publicProfilePanel.__realPlayPublicPlayer = null;
    delete publicProfilePanel.dataset.rpPublicPlayerId;
    publicProfilePanel.classList.add('open');
    publicProfilePanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-profile-open');
    publicProfilePanel.scrollTop = 0;
    const root = publicProfilePanel.querySelector('[data-rp-public-profile-content]');
    if (root) root.innerHTML = '';
    setPublicProfileStatus('LOADING PLAYER PROFILE...');
    loadingProfile = true;
    try {
      const data = await community('player_profile', { playerId });
      renderPublicProfile(data?.player || null);
      setPublicProfileStatus('');
    } catch (error) {
      setPublicProfileStatus(error.message || 'Could not load this player profile.', 'error');
      if (error.status === 401) {
        closePublicProfile();
        document.querySelector('[data-auth-open]')?.click();
      }
    } finally {
      loadingProfile = false;
    }
  }

  function closePublicProfile() {
    if (!publicProfilePanel) return;
    publicProfilePanel.classList.remove('open');
    publicProfilePanel.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('[data-rp-profile].open')) document.body.classList.remove('rp-profile-open');
  }

  function handlePlayerClick(event) {
    const row = event.target.closest('[data-world-player-id]');
    if (!row) return;
    const playerId = Number(row.dataset.worldPlayerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return;

    if (meUserId && playerId === meUserId && window.RealPlayProfile?.open) {
      window.RealPlayProfile.open();
      return;
    }
    openPublicProfile(playerId);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && publicProfilePanel?.classList.contains('open')) {
      event.stopImmediatePropagation();
      closePublicProfile();
    }
  }, true);

  window.addEventListener('focus', () => {
    if (worldPanel?.classList.contains('open') && !worldPanel.querySelector('[data-world-view="players"]')?.hidden) {
      refreshPlayers();
    }
  });

  installStyles();
  if (!installPlayersTab()) {
    const observer = new MutationObserver(() => {
      if (installPlayersTab()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RealPlayPlayers = {
    refresh: refreshPlayers,
    openProfile: openPublicProfile,
  };
})();
