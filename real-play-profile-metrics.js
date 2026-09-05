(() => {
  if (window.__realPlayProfileMetricsInstalled) return;
  window.__realPlayProfileMetricsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let profileCache = null;
  let gameCache = null;
  let cacheAt = 0;
  let loading = null;
  let scheduled = false;
  let openMetricKey = null;
  let selectedMode = 'OPEN_RANKING';
  let selectedGameFormat = 'ALL';
  let selectedPlayerFormat = 'ALL';
  let selectedSeason = 'BETA_SEASON';
  let selectedWindow = 'ALL';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function oneDecimal(value) {
    if (!Number.isFinite(Number(value))) return '—';
    return Number(value).toFixed(1);
  }

  function percent(value) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
    const rounded = Math.round(Number(value) * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
  }

  function perGame(total, games) {
    return games > 0 ? total / games : 0;
  }

  function ratioPercent(made, attempts) {
    return attempts > 0 ? (made / attempts) * 100 : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function api(path) {
    const auth = token();
    if (!auth) return null;
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch (_) {
      return null;
    }
  }

  async function fetchData() {
    const now = Date.now();
    if (profileCache && gameCache && now - cacheAt < 5000) {
      return { profile: profileCache, metricGames: gameCache };
    }
    if (loading) return loading;

    loading = Promise.all([
      api('/api/real-play/me'),
      api('/api/real-play/career/metrics'),
    ]).then(([profile, metricGames]) => {
      if (profile) profileCache = profile;
      if (metricGames) gameCache = metricGames;
      if (profile || metricGames) cacheAt = Date.now();
      return { profile: profileCache, metricGames: gameCache };
    }).finally(() => { loading = null; });

    return loading;
  }

  function statsFrom(data) {
    return data?.careerStats || data?.career?.stats || data?.career || {};
  }

  function buildSummaryMetrics(data) {
    const stats = statsFrom(data);
    const games = Math.max(0, number(stats.games ?? stats.gamesPlayed));
    const pts = number(stats.pts ?? stats.points);
    const ast = number(stats.ast ?? stats.assists);
    const reb = number(stats.reb ?? stats.rebounds);
    const stl = number(stats.stl ?? stats.steals);
    const blk = number(stats.blk ?? stats.blocks);
    const tov = number(stats.tov ?? stats.to ?? stats.turnovers);
    const foul = number(stats.foul ?? stats.fouls);
    const oneMade = number(stats.onePtMade ?? stats.one_point_makes);
    const oneMiss = number(stats.onePtMiss ?? stats.one_point_misses);
    const twoMade = number(stats.twoPtMade ?? stats.two_point_makes);
    const twoMiss = number(stats.twoPtMiss ?? stats.two_point_misses);
    const made = number(stats.madeShots, oneMade + twoMade);
    const missed = number(stats.missedShots, oneMiss + twoMiss);
    const attempts = made + missed;
    const oneAttempts = oneMade + oneMiss;
    const twoAttempts = twoMade + twoMiss;

    return [
      { key: 'ppg', label: 'PPG', short: 'POINTS / GAME', title: 'POINTS PER GAME', value: oneDecimal(stats.ppg ?? perGame(pts, games)) },
      { key: 'apg', label: 'APG', short: 'ASSISTS / GAME', title: 'ASSISTS PER GAME', value: oneDecimal(stats.apg ?? perGame(ast, games)) },
      { key: 'rpg', label: 'RPG', short: 'REBOUNDS / GAME', title: 'REBOUNDS PER GAME', value: oneDecimal(stats.rpg ?? perGame(reb, games)) },
      { key: 'spg', label: 'SPG', short: 'STEALS / GAME', title: 'STEALS PER GAME', value: oneDecimal(stats.spg ?? perGame(stl, games)) },
      { key: 'bpg', label: 'BPG', short: 'BLOCKS / GAME', title: 'BLOCKS PER GAME', value: oneDecimal(stats.bpg ?? perGame(blk, games)) },
      { key: 'topg', label: 'TOPG', short: 'TURNOVERS / GAME', title: 'TURNOVERS PER GAME', value: oneDecimal(stats.topg ?? perGame(tov, games)) },
      { key: 'fpg', label: 'FPG', short: 'FOULS / GAME', title: 'FOULS PER GAME', value: oneDecimal(stats.fpg ?? perGame(foul, games)) },
      { key: 'shooting', label: 'SHOOTING %', short: 'ALL SHOTS', title: 'SHOOTING PERCENTAGE', value: percent(stats.shootingPct ?? ratioPercent(made, attempts)) },
      { key: 'onept', label: '1PT %', short: 'INSIDE ARC', title: '1PT PERCENTAGE', value: percent(stats.onePtPct ?? ratioPercent(oneMade, oneAttempts)) },
      { key: 'twopt', label: '2PT %', short: 'OUTSIDE ARC', title: '2PT PERCENTAGE', value: percent(stats.twoPtPct ?? ratioPercent(twoMade, twoAttempts)) },
    ];
  }

  function metricCard(metric) {
    return `<button type="button" class="rp-profile-metric-card" data-rp-career-metric="${metric.key}">
      <strong>${metric.value}</strong>
      <span>${metric.label}</span>
      <small>${metric.short}</small>
    </button>`;
  }

  function modeKey(game) {
    return String(game?.competitionContext || 'open_ranking').toUpperCase();
  }

  function gameFormatKey(game) {
    if (game?.rulesetFamily === 'standard') return String(game.standardPreset || 'standard_3v3').toUpperCase();
    if (game?.rulesetFamily === 'race_to') return `RACE_${number(game.targetScore)}`;
    return 'LEGACY';
  }

  function playerFormatKey(game) {
    return String(game?.playerFormat || 'LEGACY').toUpperCase();
  }

  function gameFormatLabel(key) {
    if (key === 'STANDARD_3V3') return 'STANDARD 3V3';
    if (key === 'RACE_8') return 'RACE TO 8';
    if (key === 'RACE_16') return 'RACE TO 16';
    if (key === 'RACE_21') return 'RACE TO 21';
    if (key === 'LEGACY') return 'LEGACY';
    return 'ALL';
  }

  function modeLabel(key) {
    if (key === 'OPEN_RANKING') return 'OPEN RANKING';
    if (key === 'LEAGUE') return 'LEAGUE';
    return key.replaceAll('_', ' ');
  }

  function baseGames(metricGames) {
    let games = Array.isArray(metricGames?.games) ? [...metricGames.games] : [];
    if (selectedSeason === 'BETA_SEASON') games = games.filter((game) => !game.season || game.season === 'BETA_SEASON');
    return games;
  }

  function selectedGames(metricGames) {
    let games = baseGames(metricGames);
    if (selectedMode !== 'ALL') games = games.filter((game) => modeKey(game) === selectedMode);
    if (selectedGameFormat !== 'ALL') games = games.filter((game) => gameFormatKey(game) === selectedGameFormat);
    if (selectedPlayerFormat !== 'ALL') games = games.filter((game) => playerFormatKey(game) === selectedPlayerFormat);
    if (selectedWindow === 'LAST_5') return games.slice(0, 5);
    if (selectedWindow === 'LAST_10') return games.slice(0, 10);
    return games;
  }

  function availableOptions(metricGames) {
    const games = baseGames(metricGames);
    const modes = [...new Set(games.map(modeKey))];
    if (!modes.includes('OPEN_RANKING')) modes.unshift('OPEN_RANKING');
    const scopedMode = selectedMode === 'ALL' ? games : games.filter((game) => modeKey(game) === selectedMode);
    const formats = [...new Set(scopedMode.map(gameFormatKey))];
    const scopedFormat = selectedGameFormat === 'ALL' ? scopedMode : scopedMode.filter((game) => gameFormatKey(game) === selectedGameFormat);
    const playerFormats = [...new Set(scopedFormat.map(playerFormatKey).filter((value) => value !== 'LEGACY'))];
    return { modes, formats, playerFormats };
  }

  function sum(games, key) {
    return games.reduce((total, game) => total + number(game?.[key]), 0);
  }

  function metricResult(key, games) {
    const count = games.length;
    const totals = {
      pts: sum(games, 'pts'), ast: sum(games, 'ast'), reb: sum(games, 'reb'),
      stl: sum(games, 'stl'), blk: sum(games, 'blk'), tov: sum(games, 'tov'), foul: sum(games, 'foul'),
      made: sum(games, 'madeShots'), attempts: sum(games, 'shotAttempts'),
      oneMade: sum(games, 'onePtMade'), oneAttempts: sum(games, 'onePtAttempts'),
      twoMade: sum(games, 'twoPtMade'), twoAttempts: sum(games, 'twoPtAttempts'),
    };

    const config = {
      ppg: { title: 'POINTS PER GAME', value: oneDecimal(perGame(totals.pts, count)), rawLabel: 'TOTAL POINTS', raw: totals.pts, gameKey: 'pts', gameSuffix: ' PTS' },
      apg: { title: 'ASSISTS PER GAME', value: oneDecimal(perGame(totals.ast, count)), rawLabel: 'TOTAL ASSISTS', raw: totals.ast, gameKey: 'ast', gameSuffix: ' AST' },
      rpg: { title: 'REBOUNDS PER GAME', value: oneDecimal(perGame(totals.reb, count)), rawLabel: 'TOTAL REBOUNDS', raw: totals.reb, gameKey: 'reb', gameSuffix: ' REB' },
      spg: { title: 'STEALS PER GAME', value: oneDecimal(perGame(totals.stl, count)), rawLabel: 'TOTAL STEALS', raw: totals.stl, gameKey: 'stl', gameSuffix: ' STL' },
      bpg: { title: 'BLOCKS PER GAME', value: oneDecimal(perGame(totals.blk, count)), rawLabel: 'TOTAL BLOCKS', raw: totals.blk, gameKey: 'blk', gameSuffix: ' BLK' },
      topg: { title: 'TURNOVERS PER GAME', value: oneDecimal(perGame(totals.tov, count)), rawLabel: 'TOTAL TURNOVERS', raw: totals.tov, gameKey: 'tov', gameSuffix: ' TO' },
      fpg: { title: 'FOULS PER GAME', value: oneDecimal(perGame(totals.foul, count)), rawLabel: 'TOTAL FOULS', raw: totals.foul, gameKey: 'foul', gameSuffix: ' FOUL' },
      shooting: { title: 'SHOOTING PERCENTAGE', value: percent(ratioPercent(totals.made, totals.attempts)), rawLabel: 'MADE / ATTEMPTS', raw: `${totals.made} / ${totals.attempts}`, shot: 'all' },
      onept: { title: '1PT PERCENTAGE', value: percent(ratioPercent(totals.oneMade, totals.oneAttempts)), rawLabel: '1PT MADE / ATTEMPTS', raw: `${totals.oneMade} / ${totals.oneAttempts}`, shot: 'one' },
      twopt: { title: '2PT PERCENTAGE', value: percent(ratioPercent(totals.twoMade, totals.twoAttempts)), rawLabel: '2PT MADE / ATTEMPTS', raw: `${totals.twoMade} / ${totals.twoAttempts}`, shot: 'two' },
    };
    return { ...(config[key] || config.ppg), count, totals };
  }

  function formatDate(value) {
    if (!value) return 'FINALIZED GAME';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'FINALIZED GAME';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date).toUpperCase();
  }

  function gameMetricValue(game, result) {
    if (result.gameKey) return `${number(game?.[result.gameKey])}${result.gameSuffix}`;
    if (result.shot === 'one') return `${number(game?.onePtMade)}/${number(game?.onePtAttempts)} · ${percent(ratioPercent(number(game?.onePtMade), number(game?.onePtAttempts)))}`;
    if (result.shot === 'two') return `${number(game?.twoPtMade)}/${number(game?.twoPtAttempts)} · ${percent(ratioPercent(number(game?.twoPtMade), number(game?.twoPtAttempts)))}`;
    return `${number(game?.madeShots)}/${number(game?.shotAttempts)} · ${percent(ratioPercent(number(game?.madeShots), number(game?.shotAttempts)))}`;
  }

  function metricPage(profile) {
    let page = profile.querySelector('[data-rp-metric-page]');
    if (page) return page;
    page = document.createElement('section');
    page.className = 'rp-profile-metric-page';
    page.dataset.rpMetricPage = 'true';
    page.setAttribute('aria-hidden', 'true');
    page.innerHTML = `<div class="rp-profile-metric-page-shell">
      <header class="rp-profile-metric-page-topbar">
        <button type="button" data-rp-metric-back aria-label="Back to profile">←</button>
        <div><strong data-rp-metric-page-title>METRIC</strong><span>REAL PLAY CAREER ANALYTICS</span></div>
      </header>
      <main data-rp-metric-page-body></main>
    </div>`;
    profile.appendChild(page);
    page.querySelector('[data-rp-metric-back]')?.addEventListener('click', closeMetricPage);
    return page;
  }

  function filterButtons(options, selected, dataName, labeler) {
    return options.map((key) => `<button type="button" data-${dataName}="${escapeHtml(key)}" class="${selected === key ? 'active' : ''}">${escapeHtml(labeler(key))}</button>`).join('');
  }

  function renderMetricPage() {
    const profile = document.querySelector('.rp-profile.open');
    const page = profile?.querySelector('[data-rp-metric-page]');
    if (!profile || !page || !openMetricKey) return;
    const options = availableOptions(gameCache);
    if (selectedMode !== 'ALL' && !options.modes.includes(selectedMode)) selectedMode = options.modes[0] || 'OPEN_RANKING';
    if (selectedGameFormat !== 'ALL' && !options.formats.includes(selectedGameFormat)) selectedGameFormat = 'ALL';
    if (selectedPlayerFormat !== 'ALL' && !options.playerFormats.includes(selectedPlayerFormat)) selectedPlayerFormat = 'ALL';

    const games = selectedGames(gameCache);
    const result = metricResult(openMetricKey, games);
    const title = page.querySelector('[data-rp-metric-page-title]');
    const body = page.querySelector('[data-rp-metric-page-body]');
    if (title) title.textContent = result.title;
    if (!body) return;

    const seasonLabel = selectedSeason === 'CAREER' ? 'CAREER / ALL TIME' : (gameCache?.seasonLabel || 'BETA SEASON');
    const windowLabel = selectedWindow === 'LAST_5' ? 'LAST 5 GAMES' : selectedWindow === 'LAST_10' ? 'LAST 10 GAMES' : 'ALL GAMES';
    const modeText = selectedMode === 'ALL' ? 'ALL MODES' : modeLabel(selectedMode);
    const gameFormatText = selectedGameFormat === 'ALL' ? 'ALL GAME FORMATS' : gameFormatLabel(selectedGameFormat);
    const playerFormatText = selectedPlayerFormat === 'ALL' ? 'ALL PLAYER FORMATS' : selectedPlayerFormat;
    const heroContext = [modeText, gameFormatText, selectedPlayerFormat === 'ALL' ? null : playerFormatText].filter(Boolean).join(' · ');
    const extraShooting = openMetricKey === 'shooting'
      ? `<div class="rp-profile-metric-page-substats"><div><span>1PT</span><strong>${result.totals.oneMade}/${result.totals.oneAttempts}</strong><small>${percent(ratioPercent(result.totals.oneMade, result.totals.oneAttempts))}</small></div><div><span>2PT</span><strong>${result.totals.twoMade}/${result.totals.twoAttempts}</strong><small>${percent(ratioPercent(result.totals.twoMade, result.totals.twoAttempts))}</small></div></div>`
      : '';

    body.innerHTML = `<section class="rp-profile-metric-page-hero">
        <small>${escapeHtml(heroContext)}</small>
        <strong>${result.value}</strong>
        <span>${result.title}</span>
      </section>
      <section class="rp-profile-metric-filters">
        <div><label>MODE</label><div class="rp-profile-metric-segment context">
          ${filterButtons(options.modes, selectedMode, 'rp-mode', modeLabel)}
        </div></div>
        <div><label>GAME FORMAT</label><div class="rp-profile-metric-segment context">
          <button type="button" data-rp-game-format="ALL" class="${selectedGameFormat === 'ALL' ? 'active' : ''}">ALL</button>
          ${filterButtons(options.formats, selectedGameFormat, 'rp-game-format', gameFormatLabel)}
        </div></div>
        ${options.playerFormats.length ? `<div><label>PLAYER FORMAT</label><div class="rp-profile-metric-segment context">
          <button type="button" data-rp-player-format="ALL" class="${selectedPlayerFormat === 'ALL' ? 'active' : ''}">ALL</button>
          ${filterButtons(options.playerFormats, selectedPlayerFormat, 'rp-player-format', (key) => key)}
        </div></div>` : ''}
        <div><label>TIMEFRAME</label><div class="rp-profile-metric-segment">
          <button type="button" data-rp-season="BETA_SEASON" class="${selectedSeason === 'BETA_SEASON' ? 'active' : ''}">BETA SEASON</button>
          <button type="button" data-rp-season="CAREER" class="${selectedSeason === 'CAREER' ? 'active' : ''}">CAREER</button>
        </div></div>
        <div><label>GAME WINDOW</label><div class="rp-profile-metric-segment three">
          <button type="button" data-rp-window="ALL" class="${selectedWindow === 'ALL' ? 'active' : ''}">ALL</button>
          <button type="button" data-rp-window="LAST_5" class="${selectedWindow === 'LAST_5' ? 'active' : ''}">LAST 5</button>
          <button type="button" data-rp-window="LAST_10" class="${selectedWindow === 'LAST_10' ? 'active' : ''}">LAST 10</button>
        </div></div>
      </section>
      <section class="rp-profile-metric-page-context">
        <div><span>MODE</span><strong>${escapeHtml(modeText)}</strong></div>
        <div><span>GAME FORMAT</span><strong>${escapeHtml(gameFormatText)}</strong></div>
        <div><span>GAMES USED</span><strong>${result.count}</strong></div>
        <div><span>${result.rawLabel}</span><strong>${result.raw}</strong></div>
        <div><span>TIMEFRAME</span><strong>${escapeHtml(seasonLabel)}</strong></div>
        <div><span>WINDOW</span><strong>${windowLabel}</strong></div>
      </section>
      ${extraShooting}
      <section class="rp-profile-metric-game-list">
        <header><small>GAME-BY-GAME</small><strong>${result.count} OFFICIAL GAME${result.count === 1 ? '' : 'S'}</strong></header>
        ${games.length ? games.map((game) => `<article><div><strong>${escapeHtml(game.label || `RANKING GAME #${game.sessionId}`)}</strong><span>${escapeHtml(game.rulesLabel || 'LEGACY / UNSPECIFIED')} · ${formatDate(game.finalizedAt || game.startsAt)}</span></div><b>${escapeHtml(gameMetricValue(game, result))}</b></article>`).join('') : '<div class="rp-profile-metric-no-games">NO OFFICIAL GAMES IN THIS FILTER.</div>'}
      </section>`;

    body.querySelectorAll('[data-rp-mode]').forEach((button) => button.addEventListener('click', () => {
      selectedMode = button.dataset.rpMode;
      selectedGameFormat = 'ALL';
      selectedPlayerFormat = 'ALL';
      renderMetricPage();
    }));
    body.querySelectorAll('[data-rp-game-format]').forEach((button) => button.addEventListener('click', () => {
      selectedGameFormat = button.dataset.rpGameFormat;
      selectedPlayerFormat = 'ALL';
      renderMetricPage();
    }));
    body.querySelectorAll('[data-rp-player-format]').forEach((button) => button.addEventListener('click', () => {
      selectedPlayerFormat = button.dataset.rpPlayerFormat;
      renderMetricPage();
    }));
    body.querySelectorAll('[data-rp-season]').forEach((button) => button.addEventListener('click', () => {
      selectedSeason = button.dataset.rpSeason;
      renderMetricPage();
    }));
    body.querySelectorAll('[data-rp-window]').forEach((button) => button.addEventListener('click', () => {
      selectedWindow = button.dataset.rpWindow;
      renderMetricPage();
    }));
  }

  function openMetricPage(key) {
    const profile = document.querySelector('.rp-profile.open');
    if (!profile || !gameCache) return;
    openMetricKey = key;
    const allGames = Array.isArray(gameCache?.games) ? gameCache.games : [];
    const modes = [...new Set(allGames.map(modeKey))];
    selectedMode = modes.includes('OPEN_RANKING') ? 'OPEN_RANKING' : (modes[0] || 'OPEN_RANKING');
    selectedGameFormat = 'ALL';
    selectedPlayerFormat = 'ALL';
    selectedSeason = 'BETA_SEASON';
    selectedWindow = 'ALL';
    const page = metricPage(profile);
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    page.scrollTop = 0;
    renderMetricPage();
  }

  function closeMetricPage() {
    const page = document.querySelector('.rp-profile [data-rp-metric-page]');
    if (!page) return;
    page.classList.remove('open');
    page.setAttribute('aria-hidden', 'true');
    openMetricKey = null;
  }

  async function enhanceProfile() {
    const profile = document.querySelector('.rp-profile.open');
    const grid = profile?.querySelector('.rp-profile-stat-grid');
    if (!profile || !grid || grid.dataset.rpMetricsReplaced === 'true') return;
    const section = grid.closest('.rp-profile-section');
    if (!section) return;
    grid.dataset.rpMetricsReplaced = 'true';

    const { profile: data, metricGames } = await fetchData();
    if (!data || !metricGames || !profile.classList.contains('open') || !grid.isConnected) {
      grid.dataset.rpMetricsReplaced = 'false';
      return;
    }

    const metrics = buildSummaryMetrics(data);
    section.querySelector('.rp-profile-section-head small')?.replaceChildren(document.createTextNode('CAREER METRICS'));
    section.querySelector('.rp-profile-section-head h2')?.replaceChildren(document.createTextNode('THE COURT KEEPS THE RECEIPTS.'));

    let shell = section.querySelector('[data-rp-metrics-shell]');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'rp-profile-metrics-shell';
      shell.dataset.rpMetricsShell = 'true';
      grid.insertAdjacentElement('afterend', shell);
    }

    shell.innerHTML = `<div class="rp-profile-metrics-hint"><span>SWIPE METRICS</span><span>TAP TO OPEN →</span></div>
      <div class="rp-profile-metrics-carousel">${metrics.map(metricCard).join('')}</div>`;

    shell.querySelectorAll('[data-rp-career-metric]').forEach((card) => {
      card.addEventListener('click', () => openMetricPage(card.dataset.rpCareerMetric));
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceProfile();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]')) {
      profileCache = null;
      gameCache = null;
      cacheAt = 0;
      setTimeout(schedule, 0);
    }
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openMetricKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeMetricPage();
  }, true);

  window.addEventListener('focus', () => {
    if (document.querySelector('.rp-profile.open')) {
      profileCache = null;
      gameCache = null;
      cacheAt = 0;
      schedule();
    }
  });

  schedule();
})();
