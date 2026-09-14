(() => {
  if (window.__realPlayWorldPlayerFiltersInstalled) return;
  window.__realPlayWorldPlayerFiltersInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const PUBLIC_COMMUNITY_URL = `${API_BASE_URL}/api/real-play/public/community`;
  const RANK_AUTHORITY_TTL_MS = 60_000;
  const DEFAULT_429_BACKOFF_MS = 60_000;

  const FILTERS = Object.freeze([
    ['ranked', 'RANK OVR'],
    ['unranked', 'UNRANK OVR'],
    ['winrate', 'WIN RATE'],
    ['overallmvp', 'MOST OVERALL MVP'],
    ['teammvp', 'MOST TEAM MVP'],
    ['shooting', 'BEST SHOOTING %'],
    ['rebounding', 'BEST REBOUNDER'],
    ['scoring', 'SCORING'],
    ['assists', 'ASSISTS'],
    ['steals', 'STEALS'],
    ['blocks', 'BLOCKS'],
    ['games', 'GAMES PLAYED'],
    ['name', 'NAME'],
    ['jersey', 'JERSEY #'],
  ]);

  const CUSTOM_STAT_KEYS = new Set([
    'overallmvp', 'teammvp', 'shooting', 'rebounding',
    'scoring', 'assists', 'steals', 'blocks', 'games',
  ]);
  const GAME_STAT_KEYS = new Set(['scoring', 'assists', 'steals', 'blocks', 'games']);

  let panel = null;
  let controls = null;
  let list = null;
  let listObserver = null;
  let sortKey = 'ovr';
  let filterMode = 'ranked';
  const directions = {
    ovr: 'desc', winrate: 'desc', overallmvp: 'desc', teammvp: 'desc',
    shooting: 'desc', rebounding: 'desc', scoring: 'desc', assists: 'desc',
    steals: 'desc', blocks: 'desc', games: 'desc', name: 'asc', jersey: 'asc',
  };
  let scheduled = false;
  let rankByUserId = new Map();
  let rankByAccountUserId = new Map();
  let authorityPlayerById = new Map();
  let rankAuthorityReady = false;
  let rankRefreshPromise = null;
  let rankAuthorityAt = 0;
  let rankBackoffUntil = 0;
  let ownWorldPlayerId = '';
  let ownAccountUserId = '';

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-filter-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerFilterStyles = '1';
    style.textContent = `
      .rp-world-player-sort{
        display:flex;gap:7px;margin:7px 0 5px;padding:7px;overflow-x:auto;overflow-y:hidden;
        border:1px solid rgba(72,216,255,.18);border-radius:16px;background:rgba(2,7,13,.92);
        box-shadow:0 12px 28px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.02);backdrop-filter:blur(8px);
        scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
        scroll-snap-type:x proximity;scroll-padding-inline:7px;touch-action:pan-x;
      }
      .rp-world-player-sort::-webkit-scrollbar{display:none}
      .rp-world-player-sort button{
        box-sizing:border-box;flex:0 0 calc((100% - 28px)/5);min-width:0;min-height:44px;padding:4px 4px;
        display:flex;align-items:center;justify-content:center;gap:2px;border:1px solid rgba(160,194,224,.2);border-radius:12px;
        color:#d9e8f6;background:#0a1420;font-family:var(--rp-display,Arial,sans-serif);font-size:.48rem;font-weight:1000;
        line-height:1.02;letter-spacing:.035em;text-align:center;white-space:normal;text-wrap:balance;scroll-snap-align:start;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 4px 10px rgba(0,0,0,.24);
        transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease,box-shadow .16s ease;
      }
      .rp-world-player-sort button:hover{color:#fff;border-color:rgba(72,216,255,.42);background:#0d1c2a}
      .rp-world-player-sort button:active{transform:scale(.97)}
      .rp-world-player-sort button.active{color:#00131c;border-color:#55ddff;background:linear-gradient(180deg,#57ddff 0%,#1fb8ea 100%);box-shadow:0 0 0 1px rgba(72,216,255,.2),0 0 18px rgba(41,195,239,.28)}
      .rp-world-player-sort button.active b{color:#00384d}
      .rp-world-player-sort button:focus-visible{outline:2px solid #71e4ff;outline-offset:2px}
      .rp-world-player-sort b{flex:none;margin-left:1px;color:#8da3b8;font-size:.56rem}
      .rp-world-player-directory-head{position:relative}
      .rp-world-player-row[hidden]{display:none!important}
      .rp-world-player-row{min-height:58px}
      .rp-world-player-row .rp-world-player-winrate,.rp-world-player-row .rp-world-player-filter-stat{display:none!important}
      .rp-world-player-row .rp-world-player-metrics{gap:0}
      .rp-world-winrate-mode .rp-world-player-row .rp-world-player-ovr,
      .rp-world-stat-mode .rp-world-player-row .rp-world-player-ovr{display:none!important}
      .rp-world-winrate-mode .rp-world-player-row .rp-world-player-winrate{display:flex!important;align-items:baseline;gap:4px;color:#48d7ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1rem;font-weight:950;letter-spacing:.02em;line-height:1}
      .rp-world-winrate-mode .rp-world-player-row .rp-world-player-winrate small{color:#5d7187;font-size:.43rem;font-weight:950;letter-spacing:.09em}
      .rp-world-winrate-mode .rp-world-player-row .rp-world-player-winrate.empty{color:#66768a;font-size:.7rem}
      .rp-world-stat-mode .rp-world-player-row .rp-world-player-filter-stat{display:flex!important;align-items:baseline;justify-content:flex-end;gap:3px;min-width:42px;color:#48d7ff;font-family:var(--rp-display,Arial,sans-serif);font-style:italic;line-height:1;white-space:nowrap}
      .rp-world-player-filter-stat strong{font-size:.88rem;font-weight:1000}
      .rp-world-player-filter-stat small{color:#5d7187;font-size:.37rem;font-style:normal;font-weight:950;letter-spacing:.055em}
      .rp-world-player-rank-badge{display:none;flex:none;min-width:38px;margin-right:2px;color:#48d8ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.18rem;font-style:italic;font-weight:1000;line-height:1;letter-spacing:-.035em;text-align:left;text-shadow:0 0 16px rgba(72,216,255,.28)}
      .rp-world-player-rank-badge.is-visible{display:inline-block}
      .rp-world-player-ovr-info{position:absolute;top:0;right:1px;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(72,216,255,.24);border-radius:50%;background:rgba(5,12,19,.82);color:#48d8ff;font-family:Georgia,serif;font-size:1rem;font-style:italic;font-weight:900;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);z-index:2}
      .rp-world-player-ovr-info:hover{border-color:rgba(72,216,255,.46);background:rgba(13,54,72,.35)}
      .rp-world-player-ovr-info:active{transform:scale(.96)}
      .rp-world-player-ovr-info:focus-visible{outline:2px solid rgba(72,215,255,.7);outline-offset:2px}
      @media(max-width:420px){
        .rp-world-player-sort{gap:5px;padding:6px;margin-top:6px;scroll-padding-inline:6px}
        .rp-world-player-sort button{flex-basis:calc((100% - 20px)/5);min-height:42px;padding-inline:2px;font-size:.42rem;letter-spacing:.018em}
        .rp-world-player-rank-badge{min-width:34px;font-size:1.08rem}
        .rp-world-player-row{min-height:56px}
        .rp-world-player-filter-stat strong{font-size:.82rem}
        .rp-world-player-filter-stat small{font-size:.34rem}
      }
      @media(max-width:360px){
        .rp-world-player-sort{gap:4px;padding:5px;scroll-padding-inline:5px}
        .rp-world-player-sort button{flex-basis:calc((100% - 16px)/5);font-size:.38rem;letter-spacing:.01em}
        .rp-world-player-ovr-info{width:34px;height:34px}.rp-world-player-rank-badge{min-width:31px;font-size:1rem}
      }
    `;
    document.head.appendChild(style);
  }

  function retryAfterMs(response) {
    const raw = String(response?.headers?.get?.('Retry-After') || '').trim();
    if (!raw) return DEFAULT_429_BACKOFF_MS;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) return Math.max(DEFAULT_429_BACKOFF_MS, seconds * 1000);
    const date = new Date(raw);
    const delta = date.getTime() - Date.now();
    return Number.isFinite(delta) && delta > 0 ? Math.max(DEFAULT_429_BACKOFF_MS, delta) : DEFAULT_429_BACKOFF_MS;
  }

  function absorbRankAuthority(data) {
    const nextByPlayer = new Map();
    const nextByAccount = new Map();
    const nextPlayers = new Map();

    (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
      const playerId = String(player?.playerId ?? player?.userId ?? '').trim();
      const accountUserId = String(player?.accountUserId ?? '').trim();
      const rank = Number(player?.rank);
      if (playerId) nextPlayers.set(playerId, player);
      if (accountUserId && !nextPlayers.has(accountUserId)) nextPlayers.set(accountUserId, player);
      if (!Number.isFinite(rank) || rank <= 0) return;
      if (playerId) nextByPlayer.set(playerId, rank);
      if (accountUserId) nextByAccount.set(accountUserId, rank);
    });

    authorityPlayerById = nextPlayers;
    rankByUserId = nextByPlayer;
    rankByAccountUserId = nextByAccount;
    ownWorldPlayerId = String(data?.meUserId ?? '').trim();
    ownAccountUserId = String(data?.meAccountUserId ?? '').trim();
    rankAuthorityReady = true;
    rankAuthorityAt = Date.now();
    rankBackoffUntil = 0;
  }

  async function fetchAuthority(url, accessToken = '') {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, {
      method: 'POST', headers, body: JSON.stringify({ action: 'players' }), cache: 'no-store',
    });
  }

  async function refreshRankAuthority(force = false) {
    const now = Date.now();
    if (now < rankBackoffUntil) return;
    if (!force && rankAuthorityReady && now - rankAuthorityAt < RANK_AUTHORITY_TTL_MS) return;
    if (rankRefreshPromise) return rankRefreshPromise;

    rankRefreshPromise = (async () => {
      try {
        const accessToken = localStorage.getItem(TOKEN_KEY) || '';
        let response = await fetchAuthority(accessToken ? COMMUNITY_URL : PUBLIC_COMMUNITY_URL, accessToken);
        if (response.status === 401 || response.status === 403) {
          response = await fetchAuthority(PUBLIC_COMMUNITY_URL);
        }
        if (response.status === 429) {
          rankBackoffUntil = Date.now() + retryAfterMs(response);
          return;
        }
        if (!response.ok) return;
        absorbRankAuthority(await response.json().catch(() => ({})));
      } catch (_error) {
        // Keep last known authority if the network is temporarily unavailable.
      } finally {
        rankRefreshPromise = null;
      }
    })();
    return rankRefreshPromise;
  }

  function ownRankFromAuthority() {
    if (!rankAuthorityReady) return null;
    if (ownWorldPlayerId && rankByUserId.has(ownWorldPlayerId)) return rankByUserId.get(ownWorldPlayerId);
    if (ownAccountUserId && rankByAccountUserId.has(ownAccountUserId)) return rankByAccountUserId.get(ownAccountUserId);
    return null;
  }

  function renderAuthoritativeProfileRank(rank) {
    const numericRank = Number(rank);
    const hasRank = Number.isFinite(numericRank) && numericRank > 0;
    const ownProfile = document.querySelector('.rp-profile.open:not(.rp-public-player-profile)');
    if (!ownProfile) return;
    ownProfile.querySelectorAll('.rp-profile-rank').forEach((node) => {
      const strong = node.querySelector('strong');
      const small = node.querySelector('small');
      if (!strong) return;
      const nextStrong = hasRank ? `#${numericRank}` : '—';
      const nextSmall = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
      if (strong.textContent !== nextStrong) strong.textContent = nextStrong;
      if (small && small.textContent !== nextSmall) small.textContent = nextSmall;
    });
  }

  function publicRankFromAuthority(profile, player) {
    if (!rankAuthorityReady) return null;
    const playerId = String(player?.playerId ?? profile?.dataset?.rpPublicPlayerId ?? player?.userId ?? '').trim();
    const accountUserId = String(player?.accountUserId ?? '').trim();
    if (playerId && rankByUserId.has(playerId)) return rankByUserId.get(playerId);
    if (accountUserId && rankByAccountUserId.has(accountUserId)) return rankByAccountUserId.get(accountUserId);
    return null;
  }

  function enforcePublicProfileRank() {
    if (!rankAuthorityReady) return;
    document.querySelectorAll('.rp-public-player-profile').forEach((profile) => {
      const player = profile.__realPlayPublicPlayer || null;
      if (!player) return;
      const numericRank = Number(publicRankFromAuthority(profile, player));
      const hasRank = Number.isFinite(numericRank) && numericRank > 0;
      profile.querySelectorAll('.rp-profile-rank').forEach((node) => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (!strong) return;
        const nextStrong = hasRank ? `#${numericRank}` : '—';
        const nextSmall = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
        if (strong.textContent !== nextStrong) strong.textContent = nextStrong;
        if (small && small.textContent !== nextSmall) small.textContent = nextSmall;
      });
    });
  }

  function applyCachedRankAuthority() {
    if (!rankAuthorityReady) return;
    enforcePublicProfileRank();
    renderAuthoritativeProfileRank(ownRankFromAuthority());
  }

  async function enforceRankAuthority(force = false) {
    await refreshRankAuthority(force);
    applyCachedRankAuthority();
    scheduleSort();
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function pickNumber(...values) {
    for (const value of values) {
      const parsed = finiteOrNull(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function recognitionValue(player, type, metricKey) {
    const source = Array.isArray(player?.badges) ? player.badges : Array.isArray(player?.recognitions) ? player.recognitions : [];
    const badge = source.find((item) => String(item?.type || '').toLowerCase() === type);
    return pickNumber(badge?.metrics?.[metricKey], badge?.count, badge?.value);
  }

  function rowMeta(row) {
    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || '').trim();
    const jerseyText = String(row.querySelector('.rp-world-player-name b')?.textContent || '').trim();
    const jerseyMatch = jerseyText.match(/#\s*(\d{1,2})/);
    const jersey = jerseyMatch ? Number(jerseyMatch[1]) : null;
    const ovrNode = row.querySelector('.rp-world-player-ovr');
    const ovrText = String(ovrNode?.textContent || '').trim();
    const missingOvr = !ovrNode || ovrNode.classList.contains('unranked') || /UNRANKED/i.test(ovrText);
    const ovr = missingOvr ? null : Number.parseFloat(ovrText.replace(/[^0-9.\-]/g, ''));
    const winRateNode = row.querySelector('.rp-world-player-winrate');
    const winRateText = String(winRateNode?.textContent || '').trim();
    const missingWinRate = !winRateNode || winRateNode.classList.contains('empty') || /^—/.test(winRateText);
    const winrate = missingWinRate ? null : Number.parseFloat(winRateText.replace(/[^0-9.\-]/g, ''));
    const userId = String(row.dataset.worldPlayerId || '').trim();
    const player = authorityPlayerById.get(userId) || null;
    const stats = player?.leaderboardStats || {};
    const career = player?.careerStats || {};
    const games = pickNumber(stats.games, stats.gamesPlayed, player?.games, player?.gamesPlayed, career.games, career.gamesPlayed) ?? 0;
    const points = pickNumber(stats.points, career.points, career.pts);
    const assistsTotal = pickNumber(stats.assists, career.assists, career.ast);
    const reboundsTotal = pickNumber(stats.rebounds, career.rebounds, career.reb);
    const stealsTotal = pickNumber(stats.steals, career.steals, career.stl);
    const blocksTotal = pickNumber(stats.blocks, career.blocks, career.blk);
    const madeShots = pickNumber(stats.madeShots, career.madeShots, career.fgm);
    const attempts = pickNumber(stats.attempts, career.attempts, career.fga,
      madeShots !== null ? madeShots + (pickNumber(stats.missedShots, career.missedShots) ?? 0) : null);
    let fieldGoalPct = pickNumber(stats.fieldGoalPct, career.fieldGoalPct, career.fgPct, career.shootingPct);
    if (fieldGoalPct !== null && fieldGoalPct > 0 && fieldGoalPct <= 1) fieldGoalPct *= 100;

    const scoring = pickNumber(stats.pointsPerGame, career.pointsPerGame, career.ppg,
      games > 0 && points !== null ? points / games : null);
    const assists = pickNumber(stats.assistsPerGame, career.assistsPerGame, career.apg,
      games > 0 && assistsTotal !== null ? assistsTotal / games : null);
    const rebounding = pickNumber(stats.reboundsPerGame, career.reboundsPerGame, career.rpg,
      games > 0 && reboundsTotal !== null ? reboundsTotal / games : null);
    const steals = pickNumber(stats.stealsPerGame, career.stealsPerGame, career.spg,
      games > 0 && stealsTotal !== null ? stealsTotal / games : null);
    const blocks = pickNumber(stats.blocksPerGame, career.blocksPerGame, career.bpg,
      games > 0 && blocksTotal !== null ? blocksTotal / games : null);
    const overallmvp = pickNumber(stats.overallMvpCount, recognitionValue(player, 'most_overall_mvp', 'overallMvpCount')) ?? 0;
    const teammvp = pickNumber(stats.teamMvpCount, recognitionValue(player, 'most_team_mvp', 'teamMvpCount')) ?? 0;
    const shootingQualified = stats.shootingQualified === true || (stats.shootingQualified !== false && games >= 3 && (attempts ?? 0) >= 10);
    const reboundQualified = stats.reboundQualified === true || (stats.reboundQualified !== false && games >= 3);
    const ranked = rankAuthorityReady ? rankByUserId.has(userId) : false;

    return {
      row, name, userId, player,
      jersey: Number.isFinite(jersey) ? jersey : null,
      ovr: Number.isFinite(ovr) ? ovr : null,
      winrate: Number.isFinite(winrate) ? winrate : null,
      rank: rankByUserId.get(userId) ?? null,
      ranked, games, overallmvp, teammvp, shooting: fieldGoalPct,
      rebounding, scoring, assists, steals, blocks, shootingQualified, reboundQualified,
    };
  }

  function renderRowRank(meta) {
    const nameNode = meta?.row?.querySelector('.rp-world-player-name');
    if (!nameNode) return;
    let badge = nameNode.querySelector('.rp-world-player-rank-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-world-player-rank-badge';
      badge.setAttribute('aria-hidden', 'true');
      nameNode.prepend(badge);
    }
    const numericRank = Number(meta.rank);
    const hasOfficialRank = Number.isSafeInteger(numericRank) && numericRank > 0;
    badge.textContent = hasOfficialRank ? `#${numericRank}` : '';
    badge.classList.toggle('is-visible', filterMode === 'ranked' && hasOfficialRank);
    meta.row.dataset.officialRank = hasOfficialRank ? String(numericRank) : '';
  }

  function metricPresentation(meta) {
    const value = meta?.[sortKey];
    if (sortKey === 'overallmvp') return [value ?? 0, 'MVP'];
    if (sortKey === 'teammvp') return [value ?? 0, 'TMVP'];
    if (sortKey === 'shooting') return [value === null ? '—' : Number(value).toFixed(1), value === null ? '' : '%FG'];
    if (sortKey === 'rebounding') return [value === null ? '—' : Number(value).toFixed(1), 'RPG'];
    if (sortKey === 'scoring') return [value === null ? '—' : Number(value).toFixed(1), 'PPG'];
    if (sortKey === 'assists') return [value === null ? '—' : Number(value).toFixed(1), 'APG'];
    if (sortKey === 'steals') return [value === null ? '—' : Number(value).toFixed(1), 'SPG'];
    if (sortKey === 'blocks') return [value === null ? '—' : Number(value).toFixed(1), 'BPG'];
    if (sortKey === 'games') return [Math.round(value ?? 0), 'GP'];
    return ['', ''];
  }

  function renderRowMetric(meta) {
    const metrics = meta?.row?.querySelector('.rp-world-player-metrics');
    if (!metrics) return;
    let node = metrics.querySelector('.rp-world-player-filter-stat');
    if (!node) {
      node = document.createElement('span');
      node.className = 'rp-world-player-filter-stat';
      metrics.appendChild(node);
    }
    const [value, label] = metricPresentation(meta);
    node.innerHTML = `<strong>${value}</strong>${label ? `<small>${label}</small>` : ''}`;
  }

  function compareName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  }

  function compareNullableNumber(a, b, key, direction) {
    const av = a[key];
    const bv = b[key];
    const aMissing = av === null || av === undefined || Number.isNaN(av);
    const bMissing = bv === null || bv === undefined || Number.isNaN(bv);
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (aMissing && bMissing) return compareName(a, b);
    if (av === bv) return compareName(a, b);
    return direction === 'asc' ? av - bv : bv - av;
  }

  function matchesFilter(meta) {
    if (filterMode === 'ranked') return !rankAuthorityReady || meta.ranked;
    if (filterMode === 'unranked') return !rankAuthorityReady || !meta.ranked;
    if (sortKey === 'shooting') return meta.shootingQualified;
    if (sortKey === 'rebounding') return meta.reboundQualified;
    if (GAME_STAT_KEYS.has(sortKey)) return Number(meta.games || 0) > 0;
    return true;
  }

  function visibleRows() {
    if (!list) return [];
    return [...list.querySelectorAll('.rp-world-player-row')].map(rowMeta).filter(matchesFilter);
  }

  function sortedRows() {
    const rows = visibleRows();
    const direction = directions[sortKey] || 'desc';
    rows.sort((a, b) => {
      if (sortKey === 'name') {
        const result = compareName(a, b);
        return direction === 'asc' ? result : -result;
      }
      return compareNullableNumber(a, b, sortKey, direction);
    });
    return rows.map((item) => item.row);
  }

  function updateVisibility() {
    if (!list) return;
    [...list.querySelectorAll('.rp-world-player-row')].forEach((row) => {
      const meta = rowMeta(row);
      renderRowRank(meta);
      renderRowMetric(meta);
      const visible = matchesFilter(meta);
      row.hidden = !visible;
      row.setAttribute('aria-hidden', String(!visible));
      if (visible) row.style.removeProperty('display');
      else row.style.setProperty('display', 'none', 'important');
    });
  }

  function observeList() {
    if (!listObserver || !list) return;
    listObserver.observe(list, { childList: true });
  }

  function applySort() {
    scheduled = false;
    if (!list) return;
    updateVisibility();
    const allRows = [...list.querySelectorAll('.rp-world-player-row')];
    const nextVisible = sortedRows();
    if (!allRows.length) return;
    const hiddenRows = allRows.filter((row) => row.hidden);
    const ordered = [...nextVisible, ...hiddenRows];
    const alreadyOrdered = allRows.length === ordered.length && allRows.every((row, index) => row === ordered[index]);
    if (!alreadyOrdered) {
      listObserver?.disconnect();
      const fragment = document.createDocumentFragment();
      ordered.forEach((row) => fragment.appendChild(row));
      list.appendChild(fragment);
      observeList();
    }
    const count = panel?.querySelector('[data-world-player-count]');
    if (count) {
      const visibleCount = nextVisible.length;
      count.textContent = `${visibleCount} PLAYER${visibleCount === 1 ? '' : 'S'}`;
    }
  }

  function scheduleSort() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      applySort();
      applyCachedRankAuthority();
    });
  }

  function directionArrow(key) {
    if (key === 'ranked' || key === 'unranked') {
      if (filterMode !== key) return '';
      return directions.ovr === 'asc' ? '↑' : '↓';
    }
    if (filterMode !== 'all' || key !== sortKey) return '';
    return directions[key] === 'asc' ? '↑' : '↓';
  }

  function renderControls() {
    if (!controls) return;
    controls.querySelectorAll('[data-player-sort]').forEach((button) => {
      const key = button.dataset.playerSort;
      const active = key === filterMode || (filterMode === 'all' && key === sortKey);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const arrow = button.querySelector('b');
      if (arrow) arrow.textContent = directionArrow(key);
    });
    const winRateMode = filterMode === 'all' && sortKey === 'winrate';
    const statMode = filterMode === 'all' && CUSTOM_STAT_KEYS.has(sortKey);
    panel?.classList.toggle('rp-world-winrate-mode', winRateMode);
    panel?.classList.toggle('rp-world-stat-mode', statMode);
  }

  function selectControl(key) {
    if (!FILTERS.some(([filterKey]) => filterKey === key)) return;

    if (key === 'ranked' || key === 'unranked') {
      if (filterMode === key) directions.ovr = directions.ovr === 'desc' ? 'asc' : 'desc';
      else directions.ovr = 'desc';
      filterMode = key;
      sortKey = 'ovr';
      refreshRankAuthority(false).then(scheduleSort);
    } else {
      filterMode = 'all';
      const defaultDirection = key === 'name' || key === 'jersey' ? 'asc' : 'desc';
      if (sortKey === key) directions[key] = directions[key] === 'desc' ? 'asc' : 'desc';
      else {
        sortKey = key;
        directions[key] = defaultDirection;
      }
    }

    renderControls();
    scheduleSort();
  }

  function ensureOvrInfoButton(playersView) {
    const header = playersView?.querySelector('.rp-world-player-directory-head');
    if (!header || header.querySelector('[data-world-ovr-simulator]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-world-player-ovr-info';
    button.dataset.worldOvrSimulator = 'true';
    button.setAttribute('aria-label', 'Open OVR simulator and calculation guide');
    button.title = 'How OVR works';
    button.textContent = 'i';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = 'ovr-simulator.html';
    });
    header.appendChild(button);
  }

  function controlsMarkup() {
    return FILTERS.map(([key, label]) => (
      `<button type="button" data-player-sort="${key}" aria-pressed="false"><span>${label}</span><b></b></button>`
    )).join('');
  }

  function install() {
    panel = document.querySelector('[data-rp-world]');
    if (!panel) return false;
    const playersView = panel.querySelector('[data-world-view="players"]');
    list = playersView?.querySelector('[data-world-player-list]') || null;
    const status = playersView?.querySelector('[data-world-player-status]') || null;
    if (!playersView || !list || !status) return false;

    ensureOvrInfoButton(playersView);
    controls = playersView.querySelector('[data-world-player-sort]');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'rp-world-player-sort';
      controls.dataset.worldPlayerSort = 'true';
      controls.setAttribute('aria-label', 'Filter and sort players. Swipe horizontally for more filters.');
      status.insertAdjacentElement('beforebegin', controls);
    }
    if (!controls.querySelector('[data-player-sort="overallmvp"]')) controls.innerHTML = controlsMarkup();
    if (!controls.dataset.filterClickBound) {
      controls.dataset.filterClickBound = '1';
      controls.addEventListener('click', (event) => {
        const button = event.target.closest('[data-player-sort]');
        if (!button) return;
        selectControl(button.dataset.playerSort);
      });
    }

    renderControls();
    if (listObserver) listObserver.disconnect();
    listObserver = new MutationObserver(() => scheduleSort());
    observeList();
    scheduleSort();
    enforceRankAuthority(false);
    return true;
  }

  installStyles();
  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('realplay:public-profile-loaded', () => {
    applyCachedRankAuthority();
    refreshRankAuthority(false).then(applyCachedRankAuthority);
  });

  const profileObserver = new MutationObserver(() => {
    window.clearTimeout(window.__rpRankAuthorityRenderTimer);
    window.__rpRankAuthorityRenderTimer = window.setTimeout(applyCachedRankAuthority, 60);
  });
  profileObserver.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
})();
