(() => {
  if (window.__realPlayAdminGameRecapCareerStandingInstalled) return;
  window.__realPlayAdminGameRecapCareerStandingInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SYNC_MS = 1200;
  const CACHE_MS = 12000;

  let cache = null;
  let cacheAt = 0;
  let cacheSessionId = 0;
  let loadPromise = null;
  let lastRenderSignature = '';

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const finiteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const safeInt = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };

  const normalizeTeam = (value) => {
    const team = String(value || '').trim().toLowerCase();
    return team === 'west' || team === 'east' ? team : '';
  };

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function reviewScreen() {
    return root()?.querySelector('[data-admin-body] .rp-video-sheet-review') || null;
  }

  function standingPanel(screen) {
    if (!screen) return null;
    return [...screen.querySelectorAll('.rp-recap-panel')].find((panel) => {
      const title = String(panel.querySelector('.rp-recap-panel-head strong')?.textContent || '')
        .trim()
        .toUpperCase();
      return title === 'CURRENT PLAYER STANDING' || title === 'PLAYER RESULTS / CURRENT STANDING';
    }) || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function request(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function community(action, payload = {}) {
    return request('/api/real-play/community', {
      method: 'POST',
      json: { action, ...payload },
    });
  }

  function rosterFromControl(control) {
    return (Array.isArray(control?.players) ? control.players : [])
      .filter((player) => player?.checkedIn && normalizeTeam(player?.team))
      .map((player) => ({
        signedId: safeInt(player?.userId ?? player?.playerId),
        playerName: String(player?.playerName || 'REAL PLAY PLAYER').trim(),
        jerseyNumber: player?.playerNumber ?? null,
        team: normalizeTeam(player?.team),
      }));
  }

  async function loadCareerForRosterPlayer(rosterPlayer) {
    const signedId = safeInt(rosterPlayer?.signedId);
    if (!signedId || signedId === 0) return null;

    try {
      if (signedId > 0) {
        // Registered game-control players are keyed by ACCOUNT user ID.
        // Read that exact account's canonical Career record directly; do not
        // translate it through the World/canonical-player identity directory.
        const result = await community('admin_account_career', { accountUserId: signedId });
        return result?.player || null;
      }

      // Manual/unclaimed game-control players are negative IDs. Their absolute
      // value is the canonical manual player identity ID used by player_profile.
      const result = await community('player_profile', { playerId: Math.abs(signedId) });
      return result?.player || null;
    } catch (error) {
      console.warn('[Real Play] Career lookup failed for recap player.', rosterPlayer?.playerName, error);
      return null;
    }
  }

  function rankedFlag(player) {
    if (!player) return false;
    const ranking = player.ranking || {};
    return Boolean(
      player.officialRankingEligible
      ?? player.rankingEligible
      ?? ranking.officialRankingEligible
      ?? ranking.rankingEligible
      ?? ranking.ranked
      ?? false
    );
  }

  function careerFrom(player) {
    if (!player) return null;

    const ranking = player.ranking || {};
    const record = player.record || {};
    const stats = player.careerStats || player.career?.stats || {};

    const games = finiteNumber(
      stats.games
      ?? stats.gamesPlayed
      ?? player.games
      ?? player.gamesPlayed
      ?? record.games
      ?? ranking.totalGames
    );
    const wins = finiteNumber(stats.wins ?? player.wins ?? record.wins);
    const losses = finiteNumber(stats.losses ?? player.losses ?? record.losses);

    let winRate = null;
    if (wins !== null && losses !== null) {
      const decisions = wins + losses;
      winRate = decisions > 0 ? Math.round((wins / decisions) * 100) : null;
    } else {
      const rawWinRate = finiteNumber(player.winRate ?? record.winRate);
      winRate = rawWinRate === null ? null : Math.round(rawWinRate);
    }

    const requiredGames = finiteNumber(
      ranking.requiredGames
      ?? player.rankingGamesRequired
      ?? player.officialRankingGamesRequired
      ?? player.placementGamesRequired
    );
    const completedGames = finiteNumber(
      ranking.completedGames
      ?? player.rankingGamesCompleted
      ?? player.placementGamesCompleted
    );

    const ranked = rankedFlag(player);
    const rawRank = finiteNumber(player.rank ?? ranking.rank);
    const rawOvr = finiteNumber(player.ovr ?? player.rating ?? ranking.ovr);

    const rawRecognitions = Array.isArray(player.recognitions)
      ? player.recognitions
      : Array.isArray(player.badges)
        ? player.badges
        : [];
    const recognitions = rawRecognitions
      .map((item) => ({
        title: String(item?.title ?? item?.label ?? item?.name ?? '').trim(),
        priority: finiteNumber(item?.priority) ?? 0,
      }))
      .filter((item) => item.title)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2);

    return {
      ranked,
      rank: ranked && rawRank !== null && rawRank > 0 ? Math.round(rawRank) : null,
      // Public recap OVR is official-only. A provisional 1-4 game OVR may
      // exist inside backend compatibility payloads but must stay hidden here.
      ovr: ranked && rawOvr !== null ? Math.round(rawOvr) : null,
      games: games !== null ? Math.max(0, Math.round(games)) : null,
      wins: wins !== null ? Math.max(0, Math.round(wins)) : null,
      losses: losses !== null ? Math.max(0, Math.round(losses)) : null,
      winRate,
      requiredGames: requiredGames !== null && requiredGames > 0 ? Math.round(requiredGames) : null,
      completedGames: completedGames !== null ? Math.max(0, Math.round(completedGames)) : null,
      recognitions,
    };
  }

  function badgesHtml(recognitions) {
    if (!Array.isArray(recognitions) || !recognitions.length) return '';
    return `<div class="rp-recap-badges">${recognitions.map((badge) => `<span>${esc(badge.title)}</span>`).join('')}</div>`;
  }

  function standingHtml(rosterPlayer, career) {
    const jersey = rosterPlayer.jerseyNumber === null || rosterPlayer.jerseyNumber === undefined
      ? '#—'
      : `#${Number(rosterPlayer.jerseyNumber)}`;

    if (!career) {
      return `<article class="rp-recap-career-player">
        <div class="rp-recap-career-name"><small>${esc(rosterPlayer.team.toUpperCase())} · ${esc(jersey)}</small><strong>${esc(rosterPlayer.playerName)}</strong></div>
        <div class="rp-recap-career-status muted"><b>CAREER DATA UNAVAILABLE</b><span>Game scoring remains unaffected.</span></div>
      </article>`;
    }

    const statusBits = [];
    if (career.ranked) statusBits.push(career.rank ? `RANK #${career.rank}` : 'RANKED');
    else statusBits.push('UNRANKED');
    if (career.ranked && career.ovr !== null) statusBits.push(`${career.ovr} OVR`);

    let gamesText = 'VERIFIED GAMES —';
    if (career.requiredGames) {
      const completed = career.completedGames !== null
        ? Math.min(career.completedGames, career.requiredGames)
        : career.games !== null
          ? Math.min(career.games, career.requiredGames)
          : null;
      gamesText = `${completed ?? '—'}/${career.requiredGames} VERIFIED GAMES`;
    } else if (career.games !== null) {
      gamesText = `${career.games} VERIFIED GAME${career.games === 1 ? '' : 'S'}`;
    }

    const recordText = career.wins !== null && career.losses !== null
      ? `${career.wins}-${career.losses}`
      : 'W-L —';
    const winRateText = career.winRate !== null ? `${career.winRate}% WR` : 'WR —';

    return `<article class="rp-recap-career-player">
      <div class="rp-recap-career-name"><small>${esc(rosterPlayer.team.toUpperCase())} · ${esc(jersey)}</small><strong>${esc(rosterPlayer.playerName)}</strong>${badgesHtml(career.recognitions)}</div>
      <div class="rp-recap-career-status"><b>${esc(statusBits.join(' · '))}</b><span>${esc(gamesText)} · ${esc(recordText)} · ${esc(winRateText)}</span></div>
    </article>`;
  }

  async function loadSnapshot(force = false) {
    const controlResult = await request('/api/real-play/admin/career/control');
    const control = controlResult?.control || { session: null, players: [] };
    const sessionId = safeInt(control?.session?.id) || 0;
    const now = Date.now();

    if (!force && cache && cacheSessionId === sessionId && now - cacheAt < CACHE_MS) {
      return cache;
    }
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      const roster = rosterFromControl(control);
      const items = await Promise.all(roster.map(async (rosterPlayer) => ({
        rosterPlayer,
        career: careerFrom(await loadCareerForRosterPlayer(rosterPlayer)),
      })));
      cache = items;
      cacheAt = Date.now();
      cacheSessionId = sessionId;
      return items;
    })().finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  function signature(items) {
    return JSON.stringify(items.map(({ rosterPlayer, career }) => ({
      id: rosterPlayer.signedId,
      team: rosterPlayer.team,
      career,
    })));
  }

  async function sync(force = false) {
    const screen = reviewScreen();
    const panel = standingPanel(screen);
    const list = panel?.querySelector('.rp-recap-career-list') || null;
    if (!screen || !panel || !list) return;

    try {
      const items = await loadSnapshot(force);
      if (!Array.isArray(items) || !items.length) return;
      const nextSignature = signature(items);
      if (!force && nextSignature === lastRenderSignature && list.dataset.rpExplicitCareerAuthority === '1') return;

      list.innerHTML = items.map(({ rosterPlayer, career }) => standingHtml(rosterPlayer, career)).join('');
      list.dataset.rpExplicitCareerAuthority = '1';
      lastRenderSignature = nextSignature;
    } catch (error) {
      console.warn('[Real Play] Explicit recap Career authority did not load.', error);
    }
  }

  function invalidateAndSync() {
    cache = null;
    cacheAt = 0;
    cacheSessionId = 0;
    lastRenderSignature = '';
    window.setTimeout(() => sync(true), 80);
  }

  document.addEventListener('realplay:admin-render', () => {
    window.setTimeout(() => sync(false), 0);
  });

  document.addEventListener('click', (event) => {
    if (!root()?.contains(event.target)) return;
    if (event.target.closest('[data-rp-video-finish], [data-rp-recap-retry], [data-rp-video-sheet-back], [data-rp-review-back]')) {
      invalidateAndSync();
    }
  }, true);

  const heartbeat = window.setInterval(() => sync(false), SYNC_MS);
  window.addEventListener('pagehide', () => window.clearInterval(heartbeat), { once: true });
  window.setTimeout(() => sync(true), 100);
})();
