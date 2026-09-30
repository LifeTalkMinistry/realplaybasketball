(() => {
  if (window.__realPlayAdminGameRecapCareerStandingInstalled) return;
  window.__realPlayAdminGameRecapCareerStandingInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SYNC_MS = 1200;
  const CACHE_MS = 20000;

  let lastScreen = null;
  let lastPanel = null;
  let lastRenderSignature = '';
  let cache = null;
  let cacheAt = 0;
  let loadPromise = null;

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

  const normalizeName = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

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

  function adminPlayers() {
    return request('/api/real-play/admin/player', {
      method: 'POST',
      json: { action: 'list' },
    });
  }

  function rosterFromControl(control) {
    return (Array.isArray(control?.players) ? control.players : [])
      .filter((player) => player?.checkedIn && normalizeTeam(player?.team))
      .map((player) => ({
        signedId: safeInt(player?.userId),
        playerName: String(player?.playerName || 'REAL PLAY PLAYER').trim(),
        jerseyNumber: player?.playerNumber ?? null,
        team: normalizeTeam(player?.team),
      }));
  }

  function matchByName(rosterPlayer, candidates) {
    const wanted = normalizeName(rosterPlayer?.playerName);
    if (!wanted) return null;
    const matches = candidates.filter((candidate) => normalizeName(candidate?.playerName) === wanted);
    return matches.length === 1 ? matches[0] : null;
  }

  function matchCommunityPlayer(rosterPlayer, players) {
    const signedId = safeInt(rosterPlayer?.signedId);
    if (!signedId) return matchByName(rosterPlayer, players);

    if (signedId > 0) {
      const canonical = players.find((player) => safeInt(player?.accountUserId) === signedId);
      if (canonical) return canonical;

      // Legacy /community players used account userId directly and did not expose
      // accountUserId/playerId. Only use that shape as a fallback so a canonical
      // manual player whose playerId happens to equal an account ID cannot collide.
      const legacy = players.find((player) => (
        safeInt(player?.userId) === signedId
        && player?.accountUserId == null
        && player?.playerId == null
        && player?.unclaimed !== true
      ));
      if (legacy) return legacy;
    } else {
      const manualId = Math.abs(signedId);
      const manual = players.find((player) => (
        safeInt(player?.playerId ?? player?.userId) === manualId
        && (player?.unclaimed === true || player?.accountUserId == null)
      ));
      if (manual) return manual;
    }

    return matchByName(rosterPlayer, players);
  }

  function matchAdminPlayer(rosterPlayer, players) {
    const signedId = safeInt(rosterPlayer?.signedId);
    if (!signedId) return matchByName(rosterPlayer, players);

    if (signedId > 0) {
      const claimed = players.find((player) => (
        safeInt(player?.accountUserId) === signedId
        || (player?.unclaimed !== true && player?.accountUserId == null && safeInt(player?.userId) === signedId)
      ));
      if (claimed) return claimed;
    } else {
      const manualId = Math.abs(signedId);
      const manual = players.find((player) => (
        safeInt(player?.playerId ?? player?.userId) === manualId
        && (player?.unclaimed === true || player?.accountUserId == null)
      ));
      if (manual) return manual;
    }

    return matchByName(rosterPlayer, players);
  }

  function profileLookupId(rosterPlayer, communityPlayer, adminPlayer) {
    const canonicalId = safeInt(communityPlayer?.playerId ?? adminPlayer?.playerId);
    if (canonicalId && (communityPlayer?.accountUserId != null || communityPlayer?.playerId != null || communityPlayer?.unclaimed === true)) {
      return canonicalId;
    }

    const signedId = safeInt(rosterPlayer?.signedId);
    if (signedId && signedId > 0) return signedId;
    if (signedId && signedId < 0) return Math.abs(signedId);

    return safeInt(communityPlayer?.userId ?? adminPlayer?.userId);
  }

  function mergePlayerData(...sources) {
    const valid = sources.filter(Boolean);
    if (!valid.length) return null;
    return valid.reduce((acc, source) => ({
      ...acc,
      ...source,
      ranking: { ...(acc.ranking || {}), ...(source.ranking || {}) },
      record: { ...(acc.record || {}), ...(source.record || {}) },
      careerStats: { ...(acc.careerStats || {}), ...(source.careerStats || {}) },
      recognitions: Array.isArray(source.recognitions) ? source.recognitions : acc.recognitions,
      badges: Array.isArray(source.badges) ? source.badges : acc.badges,
    }), {});
  }

  function needsProfile(player) {
    if (!player) return true;
    const stats = player.careerStats || {};
    const record = player.record || {};
    const games = finiteNumber(player.games ?? player.gamesPlayed ?? record.games ?? stats.games ?? stats.gamesPlayed);
    const wins = finiteNumber(player.wins ?? record.wins ?? stats.wins);
    const losses = finiteNumber(player.losses ?? record.losses ?? stats.losses);
    const ranking = player.ranking || {};
    const hasRankingShape = ranking.requiredGames != null
      || ranking.totalGames != null
      || player.officialRankingEligible != null
      || player.rankingEligible != null;
    return games === null || wins === null || losses === null || !hasRankingShape;
  }

  async function hydrateOne(rosterPlayer, communityPlayer, adminPlayer) {
    let profilePlayer = null;
    const base = mergePlayerData(adminPlayer, communityPlayer);
    if (needsProfile(base)) {
      const lookupId = profileLookupId(rosterPlayer, communityPlayer, adminPlayer);
      if (lookupId) {
        try {
          const result = await community('player_profile', { playerId: lookupId });
          profilePlayer = result?.player || null;
        } catch (_) {
          // The list snapshot still provides useful canonical standing even when
          // a single profile read is unavailable.
        }
      }
    }
    return mergePlayerData(adminPlayer, communityPlayer, profilePlayer);
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
    const games = finiteNumber(player.games ?? player.gamesPlayed ?? record.games ?? stats.games ?? stats.gamesPlayed ?? ranking.totalGames);
    const wins = finiteNumber(player.wins ?? record.wins ?? stats.wins);
    const losses = finiteNumber(player.losses ?? record.losses ?? stats.losses);
    const winRateRaw = finiteNumber(player.winRate ?? record.winRate);
    const winRate = winRateRaw !== null
      ? Math.round(winRateRaw)
      : (wins !== null && losses !== null && wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null);
    const requiredGames = finiteNumber(ranking.requiredGames ?? player.rankingGamesRequired ?? player.officialRankingGamesRequired ?? player.placementGamesRequired);
    const completedGames = finiteNumber(ranking.completedGames ?? player.rankingGamesCompleted ?? player.placementGamesCompleted);
    const ovr = finiteNumber(player.ovr ?? player.rating ?? ranking.ovr);
    const rank = finiteNumber(player.rank ?? ranking.rank);
    const ranked = rankedFlag(player);

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
      rank: ranked && rank !== null && rank > 0 ? Math.round(rank) : null,
      ovr: ovr !== null ? Math.round(ovr) : null,
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
        <div class="rp-recap-career-status muted"><b>CAREER DATA UNAVAILABLE</b><span>Official game data remains unaffected.</span></div>
      </article>`;
    }

    const statusBits = [];
    if (career.ranked) statusBits.push(career.rank ? `RANK #${career.rank}` : 'RANKED');
    else statusBits.push('UNRANKED');
    if (career.ovr !== null) statusBits.push(`${career.ovr} OVR`);

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

  function screenRosterFallback(screen) {
    const players = [];
    screen.querySelectorAll('.rp-video-sheet-team').forEach((teamNode) => {
      const team = normalizeTeam(teamNode.querySelector('header strong')?.textContent);
      if (!team) return;
      teamNode.querySelectorAll('.rp-video-sheet-player').forEach((row) => {
        const label = String(row.querySelector(':scope > div:first-child > strong')?.textContent || '').trim();
        const jerseyMatch = label.match(/^#(\d+)\s+/);
        players.push({
          signedId: null,
          playerName: label.replace(/^#(?:--|—|\d+)\s+/i, '').trim() || 'REAL PLAY PLAYER',
          jerseyNumber: jerseyMatch ? Number(jerseyMatch[1]) : null,
          team,
        });
      });
    });
    return players;
  }

  async function loadSnapshot(screen, force = false) {
    const now = Date.now();
    if (!force && cache && now - cacheAt < CACHE_MS) return cache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      const [controlResult, communityResult, adminResult] = await Promise.allSettled([
        request('/api/real-play/admin/career/control'),
        community('players'),
        adminPlayers(),
      ]);

      const control = controlResult.status === 'fulfilled' ? controlResult.value?.control || null : null;
      const communityPlayers = communityResult.status === 'fulfilled' && Array.isArray(communityResult.value?.players)
        ? communityResult.value.players
        : [];
      const adminDirectory = adminResult.status === 'fulfilled' && Array.isArray(adminResult.value?.players)
        ? adminResult.value.players
        : [];
      const roster = control ? rosterFromControl(control) : screenRosterFallback(screen);

      const hydrated = await Promise.all(roster.map(async (rosterPlayer) => {
        const communityPlayer = matchCommunityPlayer(rosterPlayer, communityPlayers);
        const adminPlayer = matchAdminPlayer(rosterPlayer, adminDirectory);
        const authority = await hydrateOne(rosterPlayer, communityPlayer, adminPlayer);
        return { rosterPlayer, career: careerFrom(authority) };
      }));

      cache = hydrated;
      cacheAt = Date.now();
      return hydrated;
    })().finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  function signature(items) {
    return JSON.stringify(items.map(({ rosterPlayer, career }) => ({
      id: rosterPlayer.signedId,
      n: rosterPlayer.playerName,
      t: rosterPlayer.team,
      c: career,
    })));
  }

  async function sync(force = false) {
    const screen = reviewScreen();
    const panel = standingPanel(screen);
    const list = panel?.querySelector('.rp-recap-career-list') || null;
    if (!screen || !panel || !list) {
      lastScreen = null;
      lastPanel = null;
      lastRenderSignature = '';
      return;
    }

    try {
      const items = await loadSnapshot(screen, force || screen !== lastScreen);
      if (!Array.isArray(items) || !items.length) return;
      const nextSignature = signature(items);
      if (screen === lastScreen && panel === lastPanel && nextSignature === lastRenderSignature && list.dataset.rpCareerStandingHydrated === '1') return;

      list.innerHTML = items.map(({ rosterPlayer, career }) => standingHtml(rosterPlayer, career)).join('');
      list.dataset.rpCareerStandingHydrated = '1';
      lastScreen = screen;
      lastPanel = panel;
      lastRenderSignature = nextSignature;
    } catch (error) {
      console.warn('[Real Play] Current player standing enhancement did not load.', error);
    }
  }

  document.addEventListener('realplay:admin-render', () => {
    window.setTimeout(() => sync(false), 0);
  });

  document.addEventListener('click', (event) => {
    if (!root()?.contains(event.target)) return;
    if (event.target.closest('[data-rp-video-finish], [data-rp-recap-retry], [data-rp-video-sheet-back], [data-rp-review-back]')) {
      window.setTimeout(() => sync(true), 50);
    }
  }, true);

  const heartbeat = window.setInterval(() => sync(false), SYNC_MS);
  window.addEventListener('pagehide', () => window.clearInterval(heartbeat), { once: true });
  window.setTimeout(() => sync(true), 80);
})();
