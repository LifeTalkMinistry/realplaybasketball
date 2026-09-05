(() => {
  if (window.__realPlayProfileMetricsInstalled) return;
  window.__realPlayProfileMetricsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let cache = null;
  let cacheAt = 0;
  let loading = null;
  let scheduled = false;

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

  async function fetchProfile() {
    const now = Date.now();
    if (cache && now - cacheAt < 5000) return cache;
    if (loading) return loading;
    const auth = token();
    if (!auth) return null;

    loading = fetch(`${API_BASE_URL}/api/real-play/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => null);
        if (!data) return null;
        cache = data;
        cacheAt = Date.now();
        return data;
      })
      .catch(() => null)
      .finally(() => { loading = null; });

    return loading;
  }

  function statsFrom(data) {
    return data?.careerStats || data?.career?.stats || data?.career || {};
  }

  function receipt(label, value) {
    return `<div><span>${label}</span><b>${value}</b></div>`;
  }

  function metricCard(metric) {
    return `<button type="button" class="rp-profile-metric-card" data-rp-career-metric="${metric.key}" aria-expanded="false">
      <strong>${metric.value}</strong>
      <span>${metric.label}</span>
      <small>${metric.short}</small>
    </button>`;
  }

  function buildMetrics(data) {
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

    const shootingPct = stats.shootingPct ?? ratioPercent(made, attempts);
    const onePct = stats.onePtPct ?? ratioPercent(oneMade, oneAttempts);
    const twoPct = stats.twoPtPct ?? ratioPercent(twoMade, twoAttempts);

    return [
      {
        key: 'ppg', label: 'PPG', short: 'POINTS / GAME', value: oneDecimal(stats.ppg ?? perGame(pts, games)),
        title: 'POINTS PER GAME', description: 'Average points scored across official ranked games.',
        receipts: [receipt('TOTAL POINTS', pts), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${pts} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'apg', label: 'APG', short: 'ASSISTS / GAME', value: oneDecimal(stats.apg ?? perGame(ast, games)),
        title: 'ASSISTS PER GAME', description: 'Average verified assists across official ranked games.',
        receipts: [receipt('TOTAL ASSISTS', ast), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${ast} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'rpg', label: 'RPG', short: 'REBOUNDS / GAME', value: oneDecimal(stats.rpg ?? perGame(reb, games)),
        title: 'REBOUNDS PER GAME', description: 'Average verified rebounds across official ranked games.',
        receipts: [receipt('TOTAL REBOUNDS', reb), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${reb} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'spg', label: 'SPG', short: 'STEALS / GAME', value: oneDecimal(stats.spg ?? perGame(stl, games)),
        title: 'STEALS PER GAME', description: 'Average verified steals across official ranked games.',
        receipts: [receipt('TOTAL STEALS', stl), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${stl} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'bpg', label: 'BPG', short: 'BLOCKS / GAME', value: oneDecimal(stats.bpg ?? perGame(blk, games)),
        title: 'BLOCKS PER GAME', description: 'Average verified blocks across official ranked games.',
        receipts: [receipt('TOTAL BLOCKS', blk), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${blk} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'topg', label: 'TOPG', short: 'TURNOVERS / GAME', value: oneDecimal(stats.topg ?? perGame(tov, games)),
        title: 'TURNOVERS PER GAME', description: 'Average turnovers recorded across official ranked games.',
        receipts: [receipt('TOTAL TURNOVERS', tov), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${tov} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'fpg', label: 'FPG', short: 'FOULS / GAME', value: oneDecimal(stats.fpg ?? perGame(foul, games)),
        title: 'FOULS PER GAME', description: 'Average fouls recorded across official ranked games.',
        receipts: [receipt('TOTAL FOULS', foul), receipt('OFFICIAL GAMES', games), receipt('CALCULATION', games ? `${foul} ÷ ${games}` : 'NO GAMES YET')],
      },
      {
        key: 'shooting', label: 'SHOOTING %', short: 'ALL SHOTS', value: percent(shootingPct),
        title: 'SHOOTING PERCENTAGE', description: 'All made 1PT and 2PT shots divided by all shot attempts.',
        receipts: [receipt('MADE / ATTEMPTS', `${made} / ${attempts}`), receipt('1PT', `${oneMade}/${oneAttempts} · ${percent(onePct)}`), receipt('2PT', `${twoMade}/${twoAttempts} · ${percent(twoPct)}`)],
      },
      {
        key: 'onept', label: '1PT %', short: 'INSIDE ARC', value: percent(onePct),
        title: '1PT PERCENTAGE', description: 'Inside-arc makes divided by inside-arc attempts.',
        receipts: [receipt('1PT MADE', oneMade), receipt('1PT ATTEMPTS', oneAttempts), receipt('RAW', `${oneMade} / ${oneAttempts}`)],
      },
      {
        key: 'twopt', label: '2PT %', short: 'OUTSIDE ARC', value: percent(twoPct),
        title: '2PT PERCENTAGE', description: 'Outside-arc makes divided by outside-arc attempts.',
        receipts: [receipt('2PT MADE', twoMade), receipt('2PT ATTEMPTS', twoAttempts), receipt('RAW', `${twoMade} / ${twoAttempts}`)],
      },
    ];
  }

  function renderDetail(shell, metric) {
    const detail = shell.querySelector('[data-rp-metric-detail]');
    if (!detail) return;
    shell.querySelectorAll('[data-rp-career-metric]').forEach((card) => {
      card.setAttribute('aria-expanded', card.dataset.rpCareerMetric === metric.key ? 'true' : 'false');
    });
    detail.hidden = false;
    detail.innerHTML = `<div class="rp-profile-metric-detail-head">
      <div><small>METRIC BREAKDOWN</small><strong>${metric.title}</strong></div>
      <div class="rp-profile-metric-detail-value">${metric.value}</div>
    </div>
    <p>${metric.description}</p>
    <div class="rp-profile-metric-receipts">${metric.receipts.join('')}</div>`;
  }

  async function enhanceProfile() {
    const profile = document.querySelector('.rp-profile.open');
    const grid = profile?.querySelector('.rp-profile-stat-grid');
    if (!profile || !grid || grid.dataset.rpMetricsReplaced === 'true') return;

    const section = grid.closest('.rp-profile-section');
    if (!section) return;
    grid.dataset.rpMetricsReplaced = 'true';

    const data = await fetchProfile();
    if (!data || !profile.classList.contains('open') || !grid.isConnected) {
      grid.dataset.rpMetricsReplaced = 'false';
      return;
    }

    const metrics = buildMetrics(data);
    section.querySelector('.rp-profile-section-head small')?.replaceChildren(document.createTextNode('CAREER METRICS'));
    section.querySelector('.rp-profile-section-head h2')?.replaceChildren(document.createTextNode('THE COURT KEEPS THE RECEIPTS.'));

    let shell = section.querySelector('[data-rp-metrics-shell]');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'rp-profile-metrics-shell';
      shell.dataset.rpMetricsShell = 'true';
      grid.insertAdjacentElement('afterend', shell);
    }

    shell.innerHTML = `<div class="rp-profile-metrics-hint"><span>SWIPE METRICS</span><span>TAP FOR BREAKDOWN →</span></div>
      <div class="rp-profile-metrics-carousel">${metrics.map(metricCard).join('')}</div>
      <div class="rp-profile-metric-detail" data-rp-metric-detail hidden></div>`;

    shell.querySelectorAll('[data-rp-career-metric]').forEach((card) => {
      card.addEventListener('click', () => {
        const metric = metrics.find((item) => item.key === card.dataset.rpCareerMetric);
        if (metric) renderDetail(shell, metric);
      });
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
      cache = null;
      cacheAt = 0;
      setTimeout(schedule, 0);
    }
  }, true);
  window.addEventListener('focus', () => {
    if (document.querySelector('.rp-profile.open')) {
      cache = null;
      cacheAt = 0;
      schedule();
    }
  });
  schedule();
})();
