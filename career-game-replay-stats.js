(() => {
  if (window.__realPlayCareerReplayStatsInstalled) return;
  window.__realPlayCareerReplayStatsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let requestSequence = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function statRow(player) {
    const attempts1 = Number(player.onePtMade || 0) + Number(player.onePtMiss || 0);
    const attempts2 = Number(player.twoPtMade || 0) + Number(player.twoPtMiss || 0);
    return `<article class="rp-career-replay-stat-player">
      <div class="rp-career-replay-stat-name"><strong>${esc(playerLabel(player))}</strong><small>${Number(player.onePtMade || 0)}/${attempts1} 1PT · ${Number(player.twoPtMade || 0)}/${attempts2} 2PT</small></div>
      <div class="rp-career-replay-stat-line">
        <span><b>${Number(player.pts || 0)}</b><small>PTS</small></span>
        <span><b>${Number(player.ast || 0)}</b><small>AST</small></span>
        <span><b>${Number(player.reb || 0)}</b><small>REB</small></span>
        <span><b>${Number(player.tov || 0)}</b><small>TO</small></span>
        <span><b>${Number(player.stl || 0)}</b><small>STL</small></span>
        <span><b>${Number(player.blk || 0)}</b><small>BLK</small></span>
        <span><b>${Number(player.foul || 0)}</b><small>FOUL</small></span>
      </div>
    </article>`;
  }

  function teamBlock(team, players, active = false) {
    const rows = players.filter((player) => String(player.team || '').toLowerCase() === team);
    return `<section class="rp-career-replay-stat-team" data-rp-career-stat-panel="${team}"${active ? '' : ' hidden'}>
      <header><strong>${team.toUpperCase()}</strong><span>${rows.length} PLAYERS</span></header>
      <div>${rows.length ? rows.map(statRow).join('') : '<p class="rp-career-replay-stat-empty">No verified player stats.</p>'}</div>
    </section>`;
  }

  function setActiveTeam(section, team) {
    if (!section || !['west', 'east'].includes(team)) return;
    section.querySelectorAll('[data-rp-career-stat-team]').forEach((button) => {
      const active = button.dataset.rpCareerStatTeam === team;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    section.querySelectorAll('[data-rp-career-stat-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.rpCareerStatPanel !== team;
    });
  }

  function installStats(data, sequence, attempt = 0) {
    if (sequence !== requestSequence) return;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    const main = viewer?.querySelector('[data-rp-career-replay-main]');
    if (!main || !main.querySelector('[data-rp-career-replay-stage]')) {
      if (attempt < 20) setTimeout(() => installStats(data, sequence, attempt + 1), 150);
      return;
    }

    main.querySelector('[data-rp-career-replay-stats]')?.remove();
    const stats = Array.isArray(data?.playerStats) ? data.playerStats : [];
    const section = document.createElement('section');
    section.className = 'rp-career-replay-stats';
    section.dataset.rpCareerReplayStats = '1';
    section.innerHTML = `
      <div class="rp-career-replay-stats-head"><div><small>OFFICIAL BOX SCORE</small><strong>PLAYER STATS</strong></div><span>VERIFIED FROM VIDEO REVIEW</span></div>
      <div class="rp-career-replay-stat-tabs" role="tablist" aria-label="Choose team stats">
        <button type="button" class="active" role="tab" aria-selected="true" data-rp-career-stat-team="west">WEST</button>
        <button type="button" role="tab" aria-selected="false" tabindex="-1" data-rp-career-stat-team="east">EAST</button>
      </div>
      <div class="rp-career-replay-stat-teams">${teamBlock('west', stats, true)}${teamBlock('east', stats, false)}</div>`;
    main.appendChild(section);
  }

  async function loadStats(sessionId) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return;
    const sequence = ++requestSequence;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(id)}/replay`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || sequence !== requestSequence) return;
      installStats(data, sequence);
    } catch (_) {}
  }

  document.addEventListener('click', (event) => {
    const teamButton = event.target.closest('[data-rp-career-stat-team]');
    if (teamButton) {
      const section = teamButton.closest('[data-rp-career-replay-stats]');
      setActiveTeam(section, teamButton.dataset.rpCareerStatTeam);
      return;
    }

    const trigger = event.target.closest('[data-rp-career-replay-session]');
    if (!trigger) return;
    loadStats(trigger.dataset.rpCareerReplaySession);
  }, true);
})();
