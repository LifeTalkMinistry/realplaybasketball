(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const ME_URL = `${API_BASE_URL}/api/real-play/me`;
  let mvpRaceLeader = null;
  let mvpLoading = false;
  let mvpFetchedAt = 0;

  const style = document.createElement('style');
  style.dataset.rpUpdatesResultReceipt = 'true';
  style.textContent = `
    /* Hidden authority copy must not leave an empty footer strip behind. */
    .rp-update-card footer:not(:has(button)){
      display:none!important;
    }

    /* Make the MVP race a deliberate compact receipt beneath the final score. */
    .rp-update-result .rp-update-score{
      margin-bottom:10px!important;
    }
    .rp-update-mvp{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:14px!important;
      min-height:36px!important;
      margin:0 1px 12px!important;
      padding:9px 10px!important;
      border-top:1px solid rgba(255,255,255,.055)!important;
      border-bottom:1px solid rgba(255,255,255,.055)!important;
    }
    .rp-update-mvp span{
      color:#55d9ff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.46rem!important;
      font-weight:950!important;
      letter-spacing:.11em!important;
      white-space:nowrap!important;
    }
    .rp-update-mvp strong{
      min-width:0!important;
      overflow:hidden!important;
      color:#f7fbff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.66rem!important;
      font-style:italic!important;
      font-weight:950!important;
      letter-spacing:.035em!important;
      text-align:right!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
  `;
  document.head.appendChild(style);

  function sessionIdFromCard(card) {
    const id = String(card?.dataset.updateId || '');
    const match = id.match(/^career-(\d+)-result$/);
    const sessionId = Number(match?.[1] || 0);
    return Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : 0;
  }

  function openReplay(sessionId) {
    const bridge = document.createElement('button');
    bridge.type = 'button';
    bridge.hidden = true;
    bridge.dataset.rpCareerReplaySession = String(sessionId);
    document.body.appendChild(bridge);
    bridge.click();
    setTimeout(() => bridge.remove(), 0);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function participationMultiplier(games) {
    const count = Number(games || 0);
    if (count >= 10) return 1.25;
    if (count === 9) return 1.20;
    if (count === 8) return 1.15;
    if (count === 7) return 1.10;
    if (count === 6) return 1.05;
    return 1.00;
  }

  function scoreMvpRace(player) {
    const games = Number(player.games || 0);
    if (games <= 0) return 0;
    const impact = Number(player.pts ?? player.points ?? 0)
      + (Number(player.ast ?? player.assists ?? 0) * 2)
      + Number(player.reb ?? player.rebounds ?? 0)
      - Number(player.to ?? player.turnovers ?? 0)
      + (Number(player.wins || 0) * 3);
    return (impact / games) * participationMultiplier(games);
  }

  function leaderFromCareerState(data) {
    const boards = data?.leaderboards || {};
    const source = Array.isArray(boards.pts) && boards.pts.length
      ? boards.pts
      : Array.isArray(boards.wins) ? boards.wins : [];
    if (!source.length) return null;

    const players = [...source]
      .map((player) => ({
        playerName: String(player.playerName || player.player_name || '').trim(),
        games: Number(player.games || 0),
        wins: Number(player.wins || 0),
        points: Number(player.pts ?? player.points ?? 0),
        assists: Number(player.ast ?? player.assists ?? 0),
        rebounds: Number(player.reb ?? player.rebounds ?? 0),
        turnovers: Number(player.to ?? player.turnovers ?? 0),
      }))
      .filter((player) => player.playerName && player.games > 0)
      .map((player) => ({
        ...player,
        score: scoreMvpRace(player),
        eligible: player.games >= 5,
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.wins !== left.wins) return right.wins - left.wins;
        if (right.games !== left.games) return right.games - left.games;
        if (right.points !== left.points) return right.points - left.points;
        return left.playerName.localeCompare(right.playerName);
      });

    return players[0] || null;
  }

  function renderMvpRaceLeader() {
    const panel = document.querySelector('[data-rp-updates]');
    if (!panel) return;

    panel.querySelectorAll('.rp-update-card.rp-update-result').forEach((card) => {
      const score = card.querySelector('.rp-update-score');
      if (!score) return;

      let node = card.querySelector('.rp-update-mvp');
      if (!mvpRaceLeader?.playerName) {
        node?.remove();
        return;
      }

      if (!node) {
        node = document.createElement('div');
        node.className = 'rp-update-mvp';
        score.insertAdjacentElement('afterend', node);
      }

      const games = Number(mvpRaceLeader.games || 0);
      const label = mvpRaceLeader.eligible ? 'CURRENT MVP LEADER' : 'MVP RACE LEADER';
      const gameCopy = games > 0 ? ` · ${games} ${games === 1 ? 'GAME' : 'GAMES'}` : '';
      const html = `<span>${label}</span><strong>${escapeHtml(mvpRaceLeader.playerName)}${gameCopy}</strong>`;
      if (node.innerHTML !== html) node.innerHTML = html;
    });
  }

  async function authenticatedMvpFallback() {
    const accessToken = localStorage.getItem(TOKEN_KEY) || '';
    if (!accessToken) return null;
    try {
      const response = await fetch(ME_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      return leaderFromCareerState(data);
    } catch (_error) {
      return null;
    }
  }

  async function refreshMvpRaceLeader({ force = false } = {}) {
    if (mvpLoading) return;
    if (!force && Date.now() - mvpFetchedAt < 15000) {
      renderMvpRaceLeader();
      return;
    }

    mvpLoading = true;
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = response.ok ? await response.json().catch(() => ({})) : {};
      const updates = Array.isArray(data.updates) ? data.updates : [];
      const source = updates.find((item) => item?.category === 'result' && item?.metadata?.mvpRaceLeader?.playerName);
      mvpRaceLeader = source?.metadata?.mvpRaceLeader || await authenticatedMvpFallback();
      mvpFetchedAt = Date.now();
      renderMvpRaceLeader();
    } catch (_error) {
      mvpRaceLeader = await authenticatedMvpFallback();
      mvpFetchedAt = Date.now();
      renderMvpRaceLeader();
    } finally {
      mvpLoading = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-update-delete]')) return;
    const card = event.target.closest('.rp-update-card.rp-update-result');
    if (!card) return;
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    event.preventDefault();
    openReplay(sessionId);
  });

  /*
   * Do not observe the entire DOM here. The old whole-document MutationObserver
   * was triggered by the MVP node that it created itself, causing a render loop
   * and freezing the Updates screen. A lightweight timer is enough to restore
   * the receipt after the feed's normal polling re-renders its cards.
   */
  const mvpTimer = window.setInterval(() => {
    if (!document.querySelector('[data-rp-updates].open')) return;
    renderMvpRaceLeader();
    refreshMvpRaceLeader();
  }, 2000);

  window.addEventListener('pagehide', () => window.clearInterval(mvpTimer), { once: true });

  window.addEventListener('focus', () => {
    if (document.querySelector('[data-rp-updates].open')) refreshMvpRaceLeader({ force: true });
  });

  if (document.querySelector('[data-rp-updates].open')) refreshMvpRaceLeader({ force: true });
})();