(() => {
  if (window.__realPlayAdminGameRecapRecognitionsInstalled) return;
  window.__realPlayAdminGameRecapRecognitionsInstalled = true;

  const PANEL_ATTR = 'data-rp-recap-recognitions';
  const STYLE_ATTR = 'data-rp-recap-recognition-styles';
  const SYNC_MS = 700;
  let lastScreen = null;
  let lastSignature = '';

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const num = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function recapScreen() {
    return adminRoot()?.querySelector('[data-admin-body] .rp-video-sheet-review') || null;
  }

  function valueFromStat(span) {
    const first = span?.firstChild?.textContent ?? span?.textContent ?? '';
    const parsed = Number(String(first).trim().match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseShooting(row) {
    const text = String(row.children?.[0]?.querySelector('small')?.textContent || '');
    const one = text.match(/(\d+)\s*\/\s*(\d+)\s*1PT/i);
    const two = text.match(/(\d+)\s*\/\s*(\d+)\s*2PT/i);
    const oneMade = one ? num(one[1]) : 0;
    const oneAttempts = one ? num(one[2]) : 0;
    const twoMade = two ? num(two[1]) : 0;
    const twoAttempts = two ? num(two[2]) : 0;
    const made = oneMade + twoMade;
    const attempts = oneAttempts + twoAttempts;
    return {
      oneMade,
      oneAttempts,
      twoMade,
      twoAttempts,
      made,
      attempts,
      misses: Math.max(0, attempts - made),
      fgPct: attempts > 0 ? made / attempts : 0,
    };
  }

  function parsePlayerRow(row, team) {
    const label = String(row.querySelector(':scope > div:first-child > strong')?.textContent || '').trim();
    const name = label.replace(/^#(?:--|—|\d+)\s+/i, '').trim() || 'REAL PLAY PLAYER';
    const stats = { pts: 0, ast: 0, reb: 0, tov: 0, stl: 0, blk: 0, foul: 0 };
    row.querySelectorAll('.rp-video-sheet-line > span').forEach((span) => {
      const key = String(span.querySelector('small')?.textContent || '').trim().toUpperCase();
      const value = valueFromStat(span);
      if (key === 'PTS') stats.pts = value;
      else if (key === 'AST') stats.ast = value;
      else if (key === 'REB') stats.reb = value;
      else if (key === 'TO' || key === 'TOV') stats.tov = value;
      else if (key === 'STL') stats.stl = value;
      else if (key === 'BLK') stats.blk = value;
      else if (key === 'FOUL' || key === 'FOULS') stats.foul = value;
    });
    return { name, team, stats, shooting: parseShooting(row) };
  }

  function parsePlayers(screen) {
    const players = [];
    screen.querySelectorAll(':scope > .rp-video-sheet-teams > .rp-video-sheet-team').forEach((teamSection) => {
      const team = String(teamSection.querySelector(':scope > header strong')?.textContent || '').trim().toLowerCase();
      if (!['west', 'east'].includes(team)) return;
      teamSection.querySelectorAll(':scope > .rp-video-sheet-player').forEach((row) => {
        players.push(parsePlayerRow(row, team));
      });
    });
    return players;
  }

  function impactScore(player) {
    const s = player.shooting;
    const st = player.stats;
    const score = st.pts
      + (st.reb * 1.2)
      + (st.ast * 1.5)
      + (st.stl * 2)
      + (st.blk * 2)
      - (st.tov * 1.5)
      - (s.misses * 0.5)
      - (st.foul * 0.25);
    return Math.round(score * 100) / 100;
  }

  function compareMvp(a, b) {
    const impactDiff = impactScore(b) - impactScore(a);
    if (Math.abs(impactDiff) > 0.0001) return impactDiff;
    if (b.shooting.fgPct !== a.shooting.fgPct) return b.shooting.fgPct - a.shooting.fgPct;
    if (b.stats.pts !== a.stats.pts) return b.stats.pts - a.stats.pts;
    if (a.stats.tov !== b.stats.tov) return a.stats.tov - b.stats.tov;
    return a.name.localeCompare(b.name);
  }

  function leaders(players, valueFn, eligibleFn = () => true) {
    const eligible = players.filter(eligibleFn);
    if (!eligible.length) return [];
    const best = Math.max(...eligible.map(valueFn));
    if (!Number.isFinite(best) || best <= 0) return [];
    return eligible.filter((player) => Math.abs(valueFn(player) - best) < 0.0001);
  }

  function samePlayer(a, b) {
    if (!a || !b) return false;
    return normalizeName(a.name) === normalizeName(b.name);
  }

  function names(players) {
    return players.map((player) => player.name).join(' · ');
  }

  function fgText(player) {
    return player.shooting.attempts > 0
      ? `${Math.round(player.shooting.fgPct * 100)}% FG`
      : 'FG —';
  }

  function makeAward(type, title, icon, players, metric) {
    if (!players?.length) return null;
    return { type, title, icon, players, metric };
  }

  function officialMvpPlayer(screen, players) {
    const name = String(screen.querySelector(':scope > .rp-recap-mvp h3')?.textContent || '').trim();
    if (!name) return null;
    return players.find((player) => normalizeName(player.name) === normalizeName(name)) || { name, team: '', stats: {}, shooting: { attempts: 0, fgPct: 0 } };
  }

  function buildAwards(screen, players) {
    if (!players.length) return [];
    const final = screen.matches('[data-rp-official-recap]');
    const localOverall = [...players].sort(compareMvp)[0] || null;
    const officialOverall = final ? officialMvpPlayer(screen, players) : null;
    const overallForSuppression = officialOverall || localOverall;
    const awards = [];

    if (final && officialOverall) {
      const full = players.find((player) => samePlayer(player, officialOverall)) || officialOverall;
      const st = full.stats || {};
      awards.push(makeAward(
        'overall_mvp',
        'OVERALL MVP',
        '👑',
        [full],
        `${num(st.pts)} PTS · ${num(st.reb)} REB · ${num(st.ast)} AST · ${num(st.stl)} STL`
      ));
    } else if (localOverall) {
      const st = localOverall.stats;
      awards.push(makeAward(
        'mvp_preview',
        'MVP PREVIEW',
        '👑',
        [localOverall],
        `${st.pts} PTS · ${st.reb} REB · ${st.ast} AST · ${st.stl} STL`
      ));
    }

    for (const team of ['west', 'east']) {
      const teamPlayers = players.filter((player) => player.team === team);
      const winner = [...teamPlayers].sort(compareMvp)[0] || null;
      if (!winner || samePlayer(winner, overallForSuppression)) continue;
      awards.push(makeAward(
        'team_mvp',
        `${team.toUpperCase()} TEAM MVP`,
        '⭐',
        [winner],
        `${winner.stats.pts} PTS · ${winner.stats.reb} REB · ${impactScore(winner).toFixed(1)} IMPACT`
      ));
    }

    const lethal = leaders(players, (player) => player.shooting.fgPct, (player) => player.shooting.attempts >= 3);
    if (lethal.length) {
      const first = lethal[0];
      awards.push(makeAward(
        'lethal_shooter',
        'LETHAL SHOOTER',
        '🎯',
        lethal,
        `${first.shooting.made}/${first.shooting.attempts} FG · ${fgText(first)}`
      ));
    }

    const buckets = leaders(players, (player) => player.stats.pts);
    if (buckets.length) {
      const first = buckets[0];
      awards.push(makeAward(
        'bucket_getter',
        'BUCKET GETTER',
        '🔥',
        buckets,
        `${first.stats.pts} PTS · ${first.shooting.made}/${first.shooting.attempts} FG`
      ));
    }

    const floor = leaders(players, (player) => player.stats.ast);
    if (floor.length) {
      const first = floor[0];
      awards.push(makeAward(
        'floor_general',
        'FLOOR GENERAL',
        '🧠',
        floor,
        `${first.stats.ast} AST · ${first.stats.tov} TO`
      ));
    }

    const glass = leaders(players, (player) => player.stats.reb);
    if (glass.length) {
      const first = glass[0];
      awards.push(makeAward('glass_cleaner', 'GLASS CLEANER', '🧹', glass, `${first.stats.reb} REB`));
    }

    const steals = leaders(players, (player) => player.stats.stl);
    if (steals.length) {
      const first = steals[0];
      awards.push(makeAward('pickpocket', 'PICKPOCKET', '🥷', steals, `${first.stats.stl} STL`));
    }

    const blocks = leaders(players, (player) => player.stats.blk);
    if (blocks.length) {
      const first = blocks[0];
      awards.push(makeAward('rim_protector', 'RIM PROTECTOR', '🛡️', blocks, `${first.stats.blk} BLK`));
    }

    return awards.filter(Boolean).slice(0, 5);
  }

  function awardHtml(award) {
    return `<article class="rp-recap-recognition-card rp-recap-recognition-${esc(award.type)}">
      <div class="rp-recap-recognition-icon" aria-hidden="true">${award.icon}</div>
      <div class="rp-recap-recognition-copy">
        <small>${esc(award.title)}</small>
        <strong>${esc(names(award.players))}</strong>
        <span>${esc(award.metric)}</span>
      </div>
    </article>`;
  }

  function panelHtml(screen, awards) {
    const final = screen.matches('[data-rp-official-recap]');
    return `<section class="rp-recap-panel rp-recap-recognitions-panel" ${PANEL_ATTR}>
      <header class="rp-recap-panel-head">
        <small>${final ? 'OFFICIAL GAME AWARDS' : 'CURRENT GAME · PRE-FINAL'}</small>
        <strong>GAME RECOGNITION</strong>
      </header>
      <div class="rp-recap-recognition-grid">${awards.map(awardHtml).join('')}</div>
    </section>`;
  }

  function signatureFor(screen, players, awards) {
    return JSON.stringify({
      final: screen.matches('[data-rp-official-recap]'),
      official: String(screen.querySelector(':scope > .rp-recap-mvp h3')?.textContent || ''),
      players: players.map((player) => ({
        n: player.name,
        t: player.team,
        s: player.stats,
        sh: player.shooting,
      })),
      awards: awards.map((award) => [award.type, award.title, names(award.players), award.metric]),
    });
  }

  function render(screen) {
    const players = parsePlayers(screen);
    if (!players.length) return;
    const awards = buildAwards(screen, players);
    if (!awards.length) return;
    const signature = signatureFor(screen, players, awards);
    const existing = screen.querySelector(`[${PANEL_ATTR}]`);
    if (screen === lastScreen && signature === lastSignature && existing) return;

    existing?.remove();
    const host = screen.querySelector('[data-rp-review-enrichment]') || screen;
    const leadersPanel = host.querySelector(':scope > .rp-recap-panel:has(.rp-recap-leaders)');
    if (leadersPanel) leadersPanel.insertAdjacentHTML('afterend', panelHtml(screen, awards));
    else {
      const summary = host.querySelector(':scope > .rp-recap-summary');
      if (summary) summary.insertAdjacentHTML('afterend', panelHtml(screen, awards));
      else host.insertAdjacentHTML('afterbegin', panelHtml(screen, awards));
    }

    lastScreen = screen;
    lastSignature = signature;
  }

  function sync() {
    const screen = recapScreen();
    if (!screen) {
      lastScreen = null;
      lastSignature = '';
      return;
    }
    render(screen);
  }

  function installStyles() {
    if (document.querySelector(`[${STYLE_ATTR}]`)) return;
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, '1');
    style.textContent = `
      .rp-recap-recognitions-panel{padding:11px!important}
      .rp-recap-recognition-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
      .rp-recap-recognition-card{min-width:0;display:grid;grid-template-columns:28px minmax(0,1fr);gap:7px;align-items:center;min-height:72px;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:#080e17}
      .rp-recap-recognition-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:rgba(73,211,255,.08);font-size:16px}
      .rp-recap-recognition-copy{min-width:0;display:grid;gap:3px}
      .rp-recap-recognition-copy small{color:#48d7ff;font-size:.44rem;font-weight:950;letter-spacing:.055em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rp-recap-recognition-copy strong{color:#f0f7ff;font-size:.58rem;font-weight:950;line-height:1.12;white-space:normal;overflow-wrap:anywhere}
      .rp-recap-recognition-copy span{color:#71869a;font-size:.43rem;font-weight:850;line-height:1.25;white-space:normal}
      .rp-recap-recognition-overall_mvp,.rp-recap-recognition-mvp_preview{border-color:rgba(255,203,67,.18);background:linear-gradient(145deg,rgba(255,190,35,.055),#080e17 58%)}
      .rp-recap-recognition-team_mvp{border-color:rgba(142,179,255,.15)}
      .rp-recap-official-screen:has(.rp-recap-recognitions-panel) > .rp-recap-mvp{display:none!important}

      @media(min-width:1100px){
        .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-recognitions-panel{grid-column:1 / 3!important;grid-row:2!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-panel:has(.rp-recap-comparison){grid-column:3!important;grid-row:1 / span 2!important;align-self:stretch!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-panel:has(.rp-recap-career-list){grid-column:1 / -1!important;grid-row:3!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-recognitions-panel{grid-column:2!important;grid-row:1!important;align-self:stretch!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-leaders){grid-column:1 / -1!important;grid-row:2!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-career-list){grid-column:1 / -1!important;grid-row:3!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-comparison){grid-column:3!important;grid-row:1!important}
        .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-summary{grid-column:1!important;grid-row:1!important}
        .rp-recap-official-screen .rp-recap-recognition-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .rp-recap-official-screen .rp-recap-recognition-card{min-height:58px}
      }

      @media(min-width:700px) and (max-width:1099px){
        .rp-recap-recognition-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      }

      @media(max-width:699px){
        .rp-recap-recognition-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .rp-recap-recognition-card{min-height:68px}
        .rp-recap-recognition-grid .rp-recap-recognition-card:last-child:nth-child(odd){grid-column:1 / -1}
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  sync();
  const timer = window.setInterval(sync, SYNC_MS);
  window.addEventListener('realplay:admin-render', () => window.setTimeout(sync, 0));
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
