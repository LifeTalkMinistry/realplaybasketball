(() => {
  if (window.__realPlayTuneUpPlayerProfileInstalled) return;
  window.__realPlayTuneUpPlayerProfileInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let panel = null;
  let requestVersion = 0;
  let previousFocus = null;

  function esc(value) {
    return String(value == null ? '' : value).replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
  function quantity(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }
  function asCount(value) { return String(Math.max(0, Math.trunc(quantity(value)))); }
  function average(value, fallback = '—') {
    return value === null || value === undefined || !Number.isFinite(Number(value))
      ? fallback : Number(value).toFixed(1);
  }
  function percent(value) {
    return value === null || value === undefined || !Number.isFinite(Number(value))
      ? '—' : String(Math.round(Number(value))) + '%';
  }
  function recognizedIdentity(player) {
    const key = String(player && player.identityKey || '').trim();
    if (/^(user|manual):[1-9][0-9]*$/.test(key)) return key;
    const account = Number(player && player.accountUserId);
    const manual = Number(player && player.manualPlayerId);
    if (Number.isSafeInteger(account) && account > 0) return 'user:' + account;
    if (Number.isSafeInteger(manual) && manual > 0) return 'manual:' + manual;
    return '';
  }
  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'rp-tuneup-profile';
    panel.dataset.rpTuneupPlayerProfile = 'true';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Tune-Up season player journey');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = [
      '<div class="rp-tuneup-shell">',
        '<header class="rp-tuneup-topbar">',
          '<button type="button" data-rp-tuneup-close aria-label="Back to Tune-Up rankings">←</button>',
          '<div><strong>TUNE-UP</strong><small>PLAYER JOURNEY</small></div>',
          '<span aria-hidden="true"></span>',
        '</header>',
        '<main data-rp-tuneup-content></main>',
      '</div>'
    ].join('');
    document.body.appendChild(panel);
    panel.querySelector('[data-rp-tuneup-close]').addEventListener('click', close);
    panel.addEventListener('click', function(event) {
      const button = event.target.closest('[data-rp-tuneup-open-game]');
      if (!button) return;
      const id = Number(button.dataset.rpTuneupOpenGame);
      if (!Number.isSafeInteger(id) || id < 1) return;
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.hidden = true;
      proxy.dataset.rpCareerReplaySession = String(id);
      document.body.appendChild(proxy);
      proxy.click();
      window.setTimeout(function() { proxy.remove(); }, 0);
    });
    return panel;
  }
  function metric(label, value) {
    return '<article><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></article>';
  }
  function tile(label, value) {
    return '<div class="rp-tuneup-tile"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></div>';
  }
  function renderPlayer(player, seasonId) {
    const stats = player.leaderboardStats || {};
    const record = player.record || {};
    const rankValue = quantity(player.officialRank || player.rank, 0);
    const rank = rankValue > 0 ? '#' + Math.trunc(rankValue) : '—';
    const rawOvr = player.ovr == null ? null : Number(player.ovr);
    const ovr = rawOvr !== null && Number.isFinite(rawOvr) ? String(Math.round(rawOvr)) : '—';
    const wins = quantity(record.wins != null ? record.wins : player.wins);
    const losses = quantity(record.losses != null ? record.losses : player.losses);
    const games = quantity(record.games != null ? record.games : stats.games);
    const winRate = player.winRate != null ? player.winRate : record.winRate;
    const jersey = player.playerNumber == null ? '#—' : '#' + player.playerNumber;
    const name = String(player.playerName || 'REAL PLAY PLAYER').trim();
    const teamValue = player.currentTeam && player.currentTeam.name
      || player.teamName || null;
    const teamRank = player.teamStanding && player.teamStanding.rank || null;
    const teamRecord = player.teamStanding && player.teamStanding.record || null;
    const overallMvps = Math.max(0, Math.trunc(quantity(stats.overallMvpCount)));
    const teamMvps = Math.max(0, Math.trunc(quantity(stats.teamMvpCount)));
    const awardNodes = [];
    if (overallMvps > 0) awardNodes.push('<div class="rp-tuneup-award"><b>★</b> OVERALL MVP × ' + overallMvps + '</div>');
    if (teamMvps > 0) awardNodes.push('<div class="rp-tuneup-award"><b>✦</b> TEAM MVP × ' + teamMvps + '</div>');
    const teamCopy = teamValue ? 'Current designated Tune-Up team' : 'No season team confirmed in the official record';
    const standingCopy = teamRecord ? String(teamRecord) : 'Team standings are not yet recorded';
    const mode = seasonId ? 'SELECTED TUNE-UP SEASON' : 'VERIFIED TUNE-UP GAMES';
    return [
      '<section class="rp-tuneup-hero">',
        '<div class="rp-tuneup-eyebrow"><span>REAL PLAY BASKETBALL</span><span>', esc(mode), '</span></div>',
        '<div class="rp-tuneup-identity"><div><small>SEASON PLAYER</small><h1>', esc(name), '</h1></div>',
        '<div class="rp-tuneup-jersey">', esc(jersey), '</div></div>',
        '<div class="rp-tuneup-core">',
          tile('OVR', ovr),tile('PLAYER RANK', rank),tile('W–L', asCount(wins) + '–' + asCount(losses)),
          tile('WIN RATE', percent(winRate)),
        '</div>',
      '</section>',
      '<section class="rp-tuneup-block">',
        '<div class="rp-tuneup-section-title"><h2>TEAM STATUS</h2><small>TUNE-UP ONLY</small></div>',
        '<div class="rp-tuneup-team">',
          '<article><small>CURRENT TEAM</small><strong>', esc(teamValue ? String(teamValue).toUpperCase() : 'NOT CONFIRMED'),
          '</strong><span>', esc(teamCopy), '</span></article>',
          '<article><small>TEAM STANDING</small><strong>', esc(teamRank ? '#' + teamRank : 'PENDING'),
          '</strong><span>', esc(standingCopy), '</span></article>',
        '</div>',
      '</section>',
      '<section class="rp-tuneup-block">',
        '<div class="rp-tuneup-section-title"><h2>SEASON PERFORMANCE</h2><small>',asCount(games),' VERIFIED GAMES</small></div>',
        '<div class="rp-tuneup-stats">',
          metric('PPG', average(stats.pointsPerGame)),
          metric('APG', average(stats.assistsPerGame)),
          metric('RPG', average(stats.reboundsPerGame)),
          metric('SPG', average(stats.stealsPerGame)),
          metric('BPG', average(stats.blocksPerGame)),
          metric('SHOOTING', percent(stats.fieldGoalPct)),
        '</div>',
        '<p class="rp-tuneup-stat-legend">Derived from finalized Tune-Up games only. No career or unrelated League stats are included.</p>',
      '</section>',
      '<section class="rp-tuneup-block">',
        '<div class="rp-tuneup-section-title"><h2>AWARDS & BADGES</h2><small>VERIFIED RECOGNITIONS</small></div>',
        awardNodes.length ? '<div class="rp-tuneup-awards">' + awardNodes.join('') + '</div>'
          : '<p class="rp-tuneup-note">No individual Tune-Up awards recorded yet.</p>',
      '</section>',
      '<section class="rp-tuneup-block">',
        '<div class="rp-tuneup-section-title"><h2>HIGHLIGHTS</h2><small>SEASON MEDIA</small></div>',
        '<p class="rp-tuneup-note">Season-specific highlight clips will appear when linked to verified games. Open a game below to view its available recording and details.</p>',
      '</section>',
      '<section class="rp-tuneup-block">',
        '<div class="rp-tuneup-section-title"><h2>RECENT GAMES</h2><small>VERIFIED RESULTS</small></div>',
        '<div class="rp-tuneup-game-list" data-rp-tuneup-games>',
          '<p class="rp-tuneup-note">Loading this player’s Tune-Up games…</p>',
        '</div>',
        '<p class="rp-tuneup-status" data-rp-tuneup-status role="status"></p>',
      '</section>',
    ].join('');
  }
  function formatDate(raw) {
    if (!raw) return '';
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric'
    }).format(date).toUpperCase();
  }
  function renderGame(game) {
    const sessionId = Number(game.sessionId);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return '';
    const result = String(game.result || 'FINAL').toUpperCase();
    const resultClass = result === 'LOSS' ? 'loss' : result === 'DRAW' ? 'draw' : '';
    const side = String(game.side || '').toUpperCase();
    const date = formatDate(game.finalizedAt || game.startsAt);
    const score = asCount(game.westScore) + ' – ' + asCount(game.eastScore);
    const stats = asCount(game.points) + ' PTS · ' + asCount(game.assists) + ' AST · '
      + asCount(game.rebounds) + ' REB';
    return [
      '<button type="button" class="rp-tuneup-game" data-rp-tuneup-open-game="', sessionId,
        '" aria-label="View verified game ', sessionId, '">',
        '<span class="rp-tuneup-game-row"><strong>GAME #', sessionId,
        '</strong><b class="rp-tuneup-result ', esc(resultClass), '">', esc(result), '</b></span>',
        '<div class="rp-tuneup-game-meta">EAST ', esc(score),' WEST',
        date ? ' · ' + esc(date) : '', '</div>',
        '<div class="rp-tuneup-game-foot"><small>', esc(side), ' · ',esc(stats),
        '</small><b>VIEW GAME →</b></div>',
      '</button>',
    ].join('');
  }
  async function loadGames(identityKey, seasonId, version) {
    const root = panel && panel.querySelector('[data-rp-tuneup-games]');
    const status = panel && panel.querySelector('[data-rp-tuneup-status]');
    if (!root || !status) return;
    if (!identityKey) {
      root.innerHTML = '<p class="rp-tuneup-note">Game history is unavailable until the player identity is verified.</p>';
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      root.innerHTML = '<p class="rp-tuneup-note">Sign in to view verified game history.</p>';
      return;
    }
    const params = new URLSearchParams({
      context: 'open_ranking', identity_key: identityKey
    });
    if (seasonId) params.set('season_id', String(seasonId));
    try {
      const response = await fetch(API_BASE_URL + '/api/real-play/competition/player-games?' + params.toString(), {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      const data = await response.json().catch(function() { return {}; });
      if (!response.ok) throw new Error(data.message || data.error || 'Game history is currently unavailable.');
      if (version !== requestVersion || !panel.classList.contains('open')) return;
      const games = Array.isArray(data.games) ? data.games : [];
      root.innerHTML = games.length ? games.map(renderGame).join('') :
        '<p class="rp-tuneup-note">No verified Tune-Up game results are available for this player.</p>';
      if (data.totalGames > games.length) {
        status.textContent = 'Showing the most recent ' + games.length + ' of ' + data.totalGames + ' verified games.';
      } else {
        status.textContent = '';
      }
    } catch (error) {
      if (version !== requestVersion || !panel.classList.contains('open')) return;
      root.innerHTML = '<p class="rp-tuneup-note">Season totals above remain available. The detailed game timeline could not be loaded.</p>';
      status.textContent = error.message || 'Please try again later.';
      status.classList.add('error');
    }
  }
  function open(player, options) {
    if (!player || typeof player !== 'object') return false;
    ensurePanel();
    const seasonRaw = options && options.seasonId;
    const seasonId = Number.isSafeInteger(Number(seasonRaw)) && Number(seasonRaw) > 0
      ? Number(seasonRaw) : null;
    const version = ++requestVersion;
    previousFocus = document.activeElement;
    const root = panel.querySelector('[data-rp-tuneup-content]');
    root.innerHTML = renderPlayer(player, seasonId);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    panel.scrollTop = 0;
    panel.querySelector('[data-rp-tuneup-close]').focus({ preventScroll: true });
    loadGames(recognizedIdentity(player), seasonId, version);
    return true;
  }
  function close() {
    if (!panel || !panel.classList.contains('open')) return;
    ++requestVersion;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape' || !panel || !panel.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }, true);
  document.addEventListener('pointerdown', function(event) {
    if (!panel || !panel.classList.contains('open')) return;
    if (event.target.closest('[data-rp-simple-nav-item]')) close();
  }, true);
  window.RealPlayTuneUpProfile = { open: open, close: close };
})();
