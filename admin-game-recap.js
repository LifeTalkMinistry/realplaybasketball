(() => {
  if (window.__realPlayAdminGameRecapInstalled) return;
  window.__realPlayAdminGameRecapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const REVIEW_SELECTOR = '.rp-video-sheet-review';
  const FINAL_SUCCESS_PATTERN = /final result confirmed/i;

  let reviewRequestId = 0;
  let finalizeSessionId = 0;
  let primePromise = null;
  let finalizeAwaiting = false;
  let recapLoading = false;
  let officialRecap = null;
  let officialRecapSessionId = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function adminBody() {
    return adminRoot()?.querySelector('[data-admin-body]') || null;
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
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function community(action, payload = {}) {
    return request('/api/real-play/community', {
      method: 'POST',
      json: { action, ...payload },
    });
  }

  function normalizeTeam(value) {
    const team = String(value || '').trim().toLowerCase();
    return team === 'west' || team === 'east' ? team : '';
  }

  function labelValue(span) {
    const first = span?.firstChild?.textContent ?? span?.textContent ?? '';
    const parsed = Number(String(first).trim().match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function reAuditReviewState(review) {
    if (!review?.matches?.('[data-rp-replay-correction-mode]')) return null;
    try {
      const state = window.__realPlayReplayCorrectionAuditState?.();
      return state?.active ? state : null;
    } catch (_) {
      return null;
    }
  }

  function reAuditStatsForPlayer(playerId, events = []) {
    const stats = {
      points: 0,
      assists: 0,
      rebounds: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
      onePtMade: 0,
      onePtAttempts: 0,
      twoPtMade: 0,
      twoPtAttempts: 0,
      madeShots: 0,
      shotAttempts: 0,
    };
    const id = Number(playerId);
    (Array.isArray(events) ? events : []).forEach((event) => {
      if (Number(event?.playerId) !== id) return;
      const type = String(event?.eventType || '').toLowerCase();
      if (type === 'shot') {
        const value = Number(event?.shotValue || 0);
        const result = String(event?.shotResult || '').toLowerCase();
        if (value === 1) {
          stats.onePtAttempts += 1;
          if (result === 'make') {
            stats.onePtMade += 1;
            stats.points += 1;
          }
        } else if (value === 2) {
          stats.twoPtAttempts += 1;
          if (result === 'make') {
            stats.twoPtMade += 1;
            stats.points += 2;
          }
        }
        return;
      }
      if (type !== 'stat') return;
      const key = String(event?.statKey || '').toLowerCase();
      if (['ast', 'assist', 'assists'].includes(key)) stats.assists += 1;
      else if (['reb', 'rebound', 'rebounds'].includes(key)) stats.rebounds += 1;
      else if (['to', 'tov', 'turnover', 'turnovers'].includes(key)) stats.turnovers += 1;
      else if (['stl', 'steal', 'steals'].includes(key)) stats.steals += 1;
      else if (['blk', 'block', 'blocks'].includes(key)) stats.blocks += 1;
      else if (['foul', 'fouls'].includes(key)) stats.fouls += 1;
    });
    stats.madeShots = stats.onePtMade + stats.twoPtMade;
    stats.shotAttempts = stats.onePtAttempts + stats.twoPtAttempts;
    return stats;
  }

  function reAuditPlayersForReview(state) {
    const participation = Array.isArray(state?.participation) ? state.participation : [];
    return (Array.isArray(state?.players) ? state.players : []).map((player) => {
      const playerId = Number(player?.playerId ?? player?.userId);
      const status = participation.find((row) => Number(row?.playerId) === playerId) || null;
      return {
        playerId,
        playerName: player?.playerName || 'REAL PLAY PLAYER',
        jerseyNumber: player?.playerNumber ?? null,
        team: normalizeTeam(player?.team),
        didNotPlay: Boolean(status?.didNotPlay),
        gameStats: reAuditStatsForPlayer(playerId, state?.events),
      };
    }).filter((player) => player.playerId && player.team);
  }

  function statsFromReviewRow(row) {
    const stats = {
      points: 0,
      assists: 0,
      rebounds: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
      onePtMade: 0,
      onePtAttempts: 0,
      twoPtMade: 0,
      twoPtAttempts: 0,
      madeShots: 0,
      shotAttempts: 0,
    };

    row.querySelectorAll('.rp-video-sheet-line > span').forEach((span) => {
      const label = String(span.querySelector('small')?.textContent || '').trim().toUpperCase();
      const value = labelValue(span);
      if (label === 'PTS') stats.points = value;
      else if (label === 'AST') stats.assists = value;
      else if (label === 'REB') stats.rebounds = value;
      else if (label === 'TO' || label === 'TOV') stats.turnovers = value;
      else if (label === 'STL') stats.steals = value;
      else if (label === 'BLK') stats.blocks = value;
      else if (label === 'FOUL' || label === 'FOULS') stats.fouls = value;
    });

    const shootingText = String(row.children?.[0]?.querySelector('small')?.textContent || '');
    const one = shootingText.match(/(\d+)\s*\/\s*(\d+)\s*1PT/i);
    const two = shootingText.match(/(\d+)\s*\/\s*(\d+)\s*2PT/i);
    if (one) {
      stats.onePtMade = num(one[1]);
      stats.onePtAttempts = num(one[2]);
    }
    if (two) {
      stats.twoPtMade = num(two[1]);
      stats.twoPtAttempts = num(two[2]);
    }
    stats.madeShots = stats.onePtMade + stats.twoPtMade;
    stats.shotAttempts = stats.onePtAttempts + stats.twoPtAttempts;
    return stats;
  }

  function fallbackNameFromReview(row) {
    const label = String(row.querySelector('strong')?.textContent || '').trim();
    return label.replace(/^#(?:--|—|\d+)\s+/i, '').trim() || 'REAL PLAY PLAYER';
  }

  function extractReviewPlayers(review, control) {
    const players = [];
    review.querySelectorAll('.rp-video-sheet-team').forEach((teamSection) => {
      const team = normalizeTeam(teamSection.querySelector('header strong')?.textContent);
      if (!team) return;
      const roster = (control?.players || []).filter((player) => (
        player?.checkedIn && normalizeTeam(player?.team) === team
      ));
      [...teamSection.querySelectorAll('.rp-video-sheet-player')].forEach((row, index) => {
        const controlPlayer = roster[index] || null;
        players.push({
          playerId: Number.isFinite(Number(controlPlayer?.userId)) ? Number(controlPlayer.userId) : null,
          playerName: controlPlayer?.playerName || fallbackNameFromReview(row),
          jerseyNumber: controlPlayer?.playerNumber ?? null,
          team,
          gameStats: statsFromReviewRow(row),
        });
      });
    });
    return players;
  }

  function reviewScores(review) {
    const scoreboard = review.querySelector('.rp-video-scoreboard');
    const scores = scoreboard ? [...scoreboard.querySelectorAll('div strong')].map((node) => num(node.textContent)) : [];
    if (scores.length >= 2) return { west: scores[0], east: scores[1] };

    const teamScores = {};
    review.querySelectorAll('.rp-video-sheet-team').forEach((teamSection) => {
      const team = normalizeTeam(teamSection.querySelector('header strong')?.textContent);
      if (team) teamScores[team] = num(teamSection.querySelector('header b')?.textContent);
    });
    return { west: num(teamScores.west), east: num(teamScores.east) };
  }

  function authorityPlayerFor(gamePlayer, authorityPlayers) {
    const playerId = Number(gamePlayer?.playerId);
    if (!Number.isSafeInteger(playerId) || playerId === 0) return null;
    if (playerId > 0) {
      return authorityPlayers.find((player) => Number(player?.accountUserId) === playerId) || null;
    }
    const manualId = Math.abs(playerId);
    return authorityPlayers.find((player) => Number(player?.playerId ?? player?.userId) === manualId) || null;
  }

  function careerFromAuthority(player) {
    if (!player) return null;
    const ranking = player.ranking || {};
    const ranked = Boolean(
      player.officialRankingEligible
      ?? player.rankingEligible
      ?? ranking.officialRankingEligible
      ?? ranking.rankingEligible
      ?? ranking.ranked
      ?? false
    );
    const stats = player.careerStats || player.career?.stats || {};
    const record = player.record || {};
    const verifiedRaw = player.games ?? player.gamesPlayed ?? record.games ?? stats.games ?? stats.gamesPlayed;
    const verifiedGames = Number.isFinite(Number(verifiedRaw)) ? Math.max(0, Number(verifiedRaw)) : null;
    const winsRaw = player.wins ?? record.wins ?? stats.wins;
    const lossesRaw = player.losses ?? record.losses ?? stats.losses;
    const wins = Number.isFinite(Number(winsRaw)) ? Math.max(0, Number(winsRaw)) : null;
    const losses = Number.isFinite(Number(lossesRaw)) ? Math.max(0, Number(lossesRaw)) : null;
    const wrRaw = player.winRate ?? record.winRate;
    const winRate = Number.isFinite(Number(wrRaw))
      ? Math.round(Number(wrRaw))
      : (wins !== null && losses !== null && wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null);
    const requiredRaw = ranking.requiredGames
      ?? player.rankingGamesRequired
      ?? player.officialRankingGamesRequired
      ?? player.placementGamesRequired;
    const completedRaw = ranking.completedGames
      ?? player.rankingGamesCompleted
      ?? player.placementGamesCompleted;
    const requiredGames = Number.isSafeInteger(Number(requiredRaw)) && Number(requiredRaw) > 0 ? Number(requiredRaw) : null;
    const completedGames = Number.isFinite(Number(completedRaw)) ? Math.max(0, Number(completedRaw)) : null;
    const rawBadges = Array.isArray(player.recognitions)
      ? player.recognitions
      : Array.isArray(player.badges)
        ? player.badges
        : [];
    const recognitions = [...rawBadges]
      .filter((badge) => badge && badge.title)
      .sort((left, right) => num(right.priority) - num(left.priority))
      .slice(0, 2);
    const rawOvr = player.ovr ?? player.rating ?? ranking.ovr;
    const rawRank = player.rank ?? ranking.rank;
    return {
      ranked,
      officialOvr: ranked && Number.isFinite(Number(rawOvr)) ? Number(rawOvr) : null,
      officialRank: ranked && Number.isSafeInteger(Number(rawRank)) && Number(rawRank) > 0 ? Number(rawRank) : null,
      verifiedGames,
      wins,
      losses,
      winRate,
      qualification: requiredGames === null ? null : {
        requiredGames,
        completedGames: completedGames === null ? null : Math.min(completedGames, requiredGames),
      },
      recognitions,
    };
  }

  function withCareer(players, authorityPlayers) {
    return players.map((player) => ({
      ...player,
      career: careerFromAuthority(authorityPlayerFor(player, authorityPlayers)),
    }));
  }

  function deriveGameLeaders(players) {
    const categories = [
      ['points', 'PTS'],
      ['assists', 'AST'],
      ['rebounds', 'REB'],
      ['steals', 'STL'],
      ['blocks', 'BLK'],
    ];
    return categories.map(([key, label]) => {
      const highest = Math.max(0, ...players.map((player) => num(player?.gameStats?.[key])));
      return {
        key,
        label,
        value: highest,
        leaders: highest > 0
          ? players.filter((player) => num(player?.gameStats?.[key]) === highest)
          : [],
      };
    });
  }

  function deriveTeamComparison(players) {
    const initial = () => ({
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      madeShots: 0,
      shotAttempts: 0,
    });
    const totals = { west: initial(), east: initial() };
    players.forEach((player) => {
      const team = normalizeTeam(player.team);
      if (!team) return;
      const stats = player.gameStats || {};
      Object.keys(totals[team]).forEach((key) => {
        totals[team][key] += num(stats[key]);
      });
    });
    return totals;
  }

  function winnerLabel(west, east, final = false) {
    if (west === east) return final ? 'FINAL SCORE' : 'TIED';
    const winner = west > east ? 'WEST' : 'EAST';
    return final ? `${winner} WINS` : `${winner} LEADS`;
  }

  function ruleLabel(session) {
    if (session?.rulesLabel) return String(session.rulesLabel);
    const rules = session?.rules || null;
    if (!rules) return 'RULES NOT AVAILABLE';
    if (String(rules.rulesetFamily || '').toLowerCase() === 'standard') {
      return `STANDARD · ${String(rules.playerFormat || '3v3').toUpperCase()}`;
    }
    if (String(rules.rulesetFamily || '').toLowerCase() === 'race_to') {
      return `RACE TO ${num(rules.targetScore)} · ${String(rules.playerFormat || '').toUpperCase()}`;
    }
    return 'RULES NOT AVAILABLE';
  }

  function gameIdentity(session) {
    if (session?.officialGameId) return String(session.officialGameId);
    const rankNumber = Number(session?.openRankNumber);
    if (Number.isSafeInteger(rankNumber) && rankNumber > 0) {
      return `OPEN RANK #${String(rankNumber).padStart(3, '0')}`;
    }
    return String(session?.title || 'OPEN RANKING');
  }

  function recognitionHtml(recognitions = []) {
    if (!Array.isArray(recognitions) || !recognitions.length) return '';
    return `<div class="rp-recap-badges">${recognitions.slice(0, 2).map((badge) => (
      `<span title="${esc(badge.reason || badge.title || '')}">${esc(badge.title || 'RECOGNITION')}</span>`
    )).join('')}</div>`;
  }

  function playerCareerHtml(player) {
    const career = player.career;
    const jersey = player.jerseyNumber === null || player.jerseyNumber === undefined ? '#—' : `#${Number(player.jerseyNumber)}`;
    if (!career) {
      return `<article class="rp-recap-career-player">
        <div class="rp-recap-career-name"><small>${esc(String(player.team || '').toUpperCase())} · ${esc(jersey)}</small><strong>${esc(player.playerName)}</strong></div>
        <div class="rp-recap-career-status muted"><b>CAREER DATA UNAVAILABLE</b><span>Game scoring remains unaffected.</span></div>
      </article>`;
    }

    const status = career.ranked
      ? [
          career.officialRank ? `RANK #${career.officialRank}` : 'RANKED',
          career.officialOvr !== null ? `${career.officialOvr} OVR` : null,
        ].filter(Boolean).join(' · ')
      : 'UNRANKED';
    const qualification = career.qualification?.requiredGames
      ? `${career.qualification.completedGames ?? '—'}/${career.qualification.requiredGames} VERIFIED GAMES`
      : career.verifiedGames !== null
        ? `${career.verifiedGames} VERIFIED GAME${career.verifiedGames === 1 ? '' : 'S'}`
        : 'VERIFIED GAMES —';
    const record = career.wins !== null && career.losses !== null
      ? `${career.wins}-${career.losses}`
      : '—';
    const wr = career.winRate !== null ? `${career.winRate}% WR` : 'WR —';

    return `<article class="rp-recap-career-player">
      <div class="rp-recap-career-name"><small>${esc(String(player.team || '').toUpperCase())} · ${esc(jersey)}</small><strong>${esc(player.playerName)}</strong>${recognitionHtml(career.recognitions)}</div>
      <div class="rp-recap-career-status"><b>${esc(status)}</b><span>${esc(qualification)} · ${esc(record)} · ${esc(wr)}</span></div>
    </article>`;
  }

  function gameLeadersHtml(players) {
    const leaders = deriveGameLeaders(players);
    return `<section class="rp-recap-panel">
      <header class="rp-recap-panel-head"><small>THIS GAME</small><strong>GAME LEADERS</strong></header>
      <div class="rp-recap-leaders">${leaders.map((leader) => {
        const names = leader.leaders.length
          ? leader.leaders.map((player) => player.playerName).join(' · ')
          : '—';
        return `<article><small>${leader.label}</small><strong>${esc(names)}</strong><b>${leader.leaders.length ? leader.value : '—'}</b></article>`;
      }).join('')}</div>
    </section>`;
  }

  function careerContextHtml(players, title = 'CURRENT PLAYER STANDING') {
    return `<section class="rp-recap-panel">
      <header class="rp-recap-panel-head"><small>CANONICAL CAREER STATE</small><strong>${esc(title)}</strong></header>
      <div class="rp-recap-career-list">${players.map(playerCareerHtml).join('')}</div>
    </section>`;
  }

  function comparisonHtml(players, scores) {
    const totals = deriveTeamComparison(players);
    const rows = [
      ['PTS', 'points'],
      ['REB', 'rebounds'],
      ['AST', 'assists'],
      ['STL', 'steals'],
      ['BLK', 'blocks'],
      ['TO', 'turnovers'],
    ];
    const fg = (team) => `${totals[team].madeShots}/${totals[team].shotAttempts}`;
    const mismatch = totals.west.points !== num(scores.west) || totals.east.points !== num(scores.east);
    return `<section class="rp-recap-panel">
      <header class="rp-recap-panel-head"><small>WEST VS EAST</small><strong>TEAM COMPARISON</strong></header>
      <div class="rp-recap-comparison">
        <div class="rp-recap-comparison-head"><b>WEST</b><span>STAT</span><b>EAST</b></div>
        ${rows.map(([label, key]) => `<div><b>${totals.west[key]}</b><span>${label}</span><b>${totals.east[key]}</b></div>`).join('')}
        <div><b>${fg('west')}</b><span>FG</span><b>${fg('east')}</b></div>
      </div>
      ${mismatch ? '<div class="rp-recap-warning">DO NOT SUBMIT YET: player PTS totals do not reconcile with the displayed team score. Review the score sheet before continuing.</div>' : ''}
    </section>`;
  }

  function summaryHtml({ session, scores, final = false }) {
    return `<section class="rp-recap-summary ${final ? 'official' : ''}">
      <div class="rp-recap-summary-kicker"><span>${final ? 'OFFICIAL FINAL' : 'SCORE BEFORE FINALIZATION'}</span><b>${esc(gameIdentity(session))}</b></div>
      <div class="rp-recap-score"><div><small>WEST</small><strong>${num(scores.west)}</strong></div><i>—</i><div><small>EAST</small><strong>${num(scores.east)}</strong></div></div>
      <div class="rp-recap-result">${esc(winnerLabel(num(scores.west), num(scores.east), final))}</div>
      <div class="rp-recap-rule">${esc(ruleLabel(session))}</div>
    </section>`;
  }

  function reviewEnrichmentHtml({ session, players, scores, careerAvailable }) {
    return `<div class="rp-recap-review-enrichment" data-rp-review-enrichment>
      ${summaryHtml({ session, scores, final: false })}
      ${gameLeadersHtml(players)}
      ${careerAvailable
        ? careerContextHtml(players)
        : '<section class="rp-recap-panel"><div class="rp-recap-unavailable"><strong>PLAYER STANDING UNAVAILABLE</strong><span>The score sheet can still be verified and submitted normally.</span></div></section>'}
      ${comparisonHtml(players, scores)}
      <div class="rp-recap-original-label"><span>OFFICIAL SCORE SHEET</span><small>Existing raw game data below</small></div>
    </div>`;
  }

  async function enrichCurrentReview() {
    const review = adminBody()?.querySelector(REVIEW_SELECTOR);
    if (!review) return;
    review.querySelector('[data-rp-review-enrichment]')?.remove();
    const requestId = ++reviewRequestId;

    // A Second-Pass Audit may be reviewing an older finalized game while Admin
    // Control points at another session. Its summary must come from the exact
    // working events that VERIFY & SUBMIT will write.
    const reAuditState = reAuditReviewState(review);
    if (reAuditState) {
      const players = reAuditPlayersForReview(reAuditState).map((player) => ({
        ...player,
        career: null,
      }));
      const scores = reviewScores(review);
      const teamsNode = review.querySelector('.rp-video-sheet-teams');
      if (!teamsNode) return;
      teamsNode.insertAdjacentHTML('beforebegin', reviewEnrichmentHtml({
        session: reAuditState.session || { title: 'RE-AUDIT' },
        players,
        scores,
        careerAvailable: false,
      }));
      return;
    }

    const [controlResult, playersResult] = await Promise.allSettled([
      request('/api/real-play/admin/career/control'),
      community('players'),
    ]);

    const currentReview = adminBody()?.querySelector(REVIEW_SELECTOR);
    if (requestId !== reviewRequestId || !currentReview) return;

    const control = controlResult.status === 'fulfilled'
      ? controlResult.value?.control || { session: null, players: [] }
      : { session: null, players: [] };
    const authorityPlayers = playersResult.status === 'fulfilled' && Array.isArray(playersResult.value?.players)
      ? playersResult.value.players
      : [];

    const sessionId = Number(control?.session?.id || 0);
    if (Number.isSafeInteger(sessionId) && sessionId > 0) finalizeSessionId = sessionId;

    let players = extractReviewPlayers(currentReview, control);
    const careerAvailable = playersResult.status === 'fulfilled';
    if (careerAvailable) players = withCareer(players, authorityPlayers);
    else players = players.map((player) => ({ ...player, career: null }));
    const scores = reviewScores(currentReview);

    const teamsNode = currentReview.querySelector('.rp-video-sheet-teams');
    if (!teamsNode) return;
    teamsNode.insertAdjacentHTML('beforebegin', reviewEnrichmentHtml({
      session: control.session || {},
      players,
      scores,
      careerAvailable,
    }));
  }

  function finalizedPlayerHtml(player) {
    const stats = player.gameStats || {};
    const shots = `${num(stats.onePtMade)}/${num(stats.onePtAttempts)} 1PT · ${num(stats.twoPtMade)}/${num(stats.twoPtAttempts)} 2PT`;
    const participation = player?.didNotPlay ? 'DNP · DID NOT PLAY' : shots;
    const jersey = player.jerseyNumber === null || player.jerseyNumber === undefined ? '#—' : `#${Number(player.jerseyNumber)}`;
    return `<article class="rp-video-sheet-player rp-recap-final-player ${player?.didNotPlay ? 'rp-recap-dnp-player' : ''}">
      <div><strong>${esc(`${jersey} ${player.playerName || 'REAL PLAY PLAYER'}`)}</strong><small>${esc(participation)}</small></div>
      <div class="rp-video-sheet-line"><span>${num(stats.points)}<small>PTS</small></span><span>${num(stats.assists)}<small>AST</small></span><span>${num(stats.rebounds)}<small>REB</small></span><span>${num(stats.turnovers)}<small>TO</small></span><span>${num(stats.steals)}<small>STL</small></span><span>${num(stats.blocks)}<small>BLK</small></span><span>${num(stats.fouls)}<small>FOUL</small></span></div>
    </article>`;
  }

  function finalizedTeamHtml(team, players, score) {
    const roster = players.filter((player) => normalizeTeam(player.team) === team);
    return `<section class="rp-video-sheet-team"><header><strong>${team.toUpperCase()}</strong><b>${num(score)}</b></header>${roster.map(finalizedPlayerHtml).join('')}</section>`;
  }

  function mvpHtml(mvp) {
    if (!mvp) return '';
    const attempts = num(mvp.madeShots) + num(mvp.missedShots);
    const fg = attempts > 0 ? `${num(mvp.madeShots)}/${attempts} FG` : 'FG —';
    return `<section class="rp-recap-mvp">
      <small>OFFICIAL GAME RECOGNITION</small><div class="rp-recap-mvp-crown">👑</div><h2>OVERALL MVP</h2><h3>${esc(mvp.playerName || 'REAL PLAY PLAYER')}</h3>
      <div class="rp-recap-mvp-line"><span><b>${num(mvp.points)}</b> PTS</span><span><b>${num(mvp.rebounds)}</b> REB</span><span><b>${num(mvp.assists)}</b> AST</span><span><b>${num(mvp.steals)}</b> STL</span><span><b>${num(mvp.blocks)}</b> BLK</span><span><b>${esc(fg)}</b></span></div>
    </section>`;
  }

  function eventSummaryHtml(summary = {}) {
    return `<div class="rp-video-sheet-meta rp-recap-event-summary"><span>${num(summary.totalEvents)}<small>TOTAL EVENTS</small></span><span>${num(summary.scoringMarkers)}<small>SCORING MARKERS</small></span><span>${num(summary.statEvents)}<small>STAT EVENTS</small></span></div>`;
  }

  function officialRecapHtml(recap) {
    const session = recap?.session || {};
    const players = Array.isArray(recap?.players) ? recap.players : [];
    const scores = { west: num(session.westScore), east: num(session.eastScore) };
    const enrichedPlayers = players.map((player) => ({
      ...player,
      career: player.career || null,
    }));
    return `<div class="rp-video-screen rp-video-sheet-review rp-recap-official-screen" data-rp-official-recap>
      <div class="rp-admin-title"><span class="rp-admin-kicker">OFFICIAL GAME RECAP</span><h1>THE FULL GAME, BY DATA.</h1><p>Finalized Real Play results and current canonical player standing.</p></div>
      ${summaryHtml({ session, scores, final: true })}
      ${mvpHtml(recap?.gameMvp || null)}
      ${gameLeadersHtml(enrichedPlayers)}
      ${careerContextHtml(enrichedPlayers, 'PLAYER RESULTS / CURRENT STANDING')}
      ${comparisonHtml(enrichedPlayers, scores)}
      ${eventSummaryHtml(recap?.eventSummary || {})}
      <div class="rp-recap-original-label"><span>OFFICIAL SCORE SHEET</span><small>Finalized player game data</small></div>
      <div class="rp-video-sheet-teams">${finalizedTeamHtml('west', enrichedPlayers, scores.west)}${finalizedTeamHtml('east', enrichedPlayers, scores.east)}</div>
    </div>`;
  }

  function renderOfficialRecap() {
    if (!officialRecap || !adminBody()) return;
    adminBody().innerHTML = officialRecapHtml(officialRecap);
  }

  function showOfficialRecapError(message) {
    const target = adminBody();
    if (!target) return;
    target.insertAdjacentHTML('afterbegin', `<div class="rp-recap-fetch-error" data-rp-recap-fetch-error><strong>OFFICIAL RECAP UNAVAILABLE</strong><span>${esc(message || 'The game is final. Retry only the read-only recap.')}</span><button type="button" data-rp-recap-retry>RETRY RECAP</button></div>`);
  }

  async function fetchOfficialRecap(sessionId) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id < 1 || recapLoading) return;
    recapLoading = true;
    adminBody()?.querySelector('[data-rp-recap-fetch-error]')?.remove();
    try {
      const data = await community('official_game_recap', { sessionId: id });
      if (!data?.recap?.session || Number(data.recap.session.id) !== id) {
        throw new Error('The finalized game recap returned an unexpected game.');
      }
      officialRecap = data.recap;
      officialRecapSessionId = id;
      finalizeAwaiting = false;
      renderOfficialRecap();
    } catch (error) {
      finalizeAwaiting = false;
      showOfficialRecapError(error.message || 'Could not load the finalized recap.');
    } finally {
      recapLoading = false;
    }
  }

  async function primeFinalizeSession() {
    if (primePromise || finalizeAwaiting || officialRecap) return primePromise;
    primePromise = request('/api/real-play/admin/career/control')
      .then((data) => {
        const id = Number(data?.control?.session?.id || 0);
        if (Number.isSafeInteger(id) && id > 0) finalizeSessionId = id;
        return id;
      })
      .catch(() => 0)
      .finally(() => { primePromise = null; });
    return primePromise;
  }

  function clearOfficialRecap() {
    reviewRequestId += 1;
    finalizeAwaiting = false;
    recapLoading = false;
    officialRecap = null;
    officialRecapSessionId = 0;
    finalizeSessionId = 0;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-game-recap-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpGameRecapStyles = '1';
    style.textContent = `
      .rp-recap-review-enrichment,.rp-recap-official-screen{display:grid;gap:12px;margin:14px 0 18px}
      .rp-recap-summary,.rp-recap-panel,.rp-recap-mvp{border:1px solid rgba(73,211,255,.16);border-radius:18px;background:#050a11;box-shadow:0 14px 32px rgba(0,0,0,.18)}
      .rp-recap-summary{padding:16px;overflow:hidden}.rp-recap-summary.official{border-color:rgba(73,211,255,.28)}
      .rp-recap-summary-kicker{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#5f748a;font-size:.52rem;font-weight:950;letter-spacing:.1em}.rp-recap-summary-kicker span{color:#48d7ff}.rp-recap-summary-kicker b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rp-recap-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-top:12px;text-align:center}.rp-recap-score div{display:grid;gap:2px}.rp-recap-score small{color:#60758b;font-size:.58rem;font-weight:950;letter-spacing:.12em}.rp-recap-score strong{font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:2.35rem;font-style:italic;line-height:1}.rp-recap-score i{color:#314254;font-style:normal;font-weight:950}
      .rp-recap-result{margin-top:10px;color:#f2f8ff;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:1.15rem;font-style:italic;font-weight:950;text-align:center;letter-spacing:.05em}.rp-recap-rule{margin-top:4px;color:#48d7ff;font-size:.58rem;font-weight:950;text-align:center;letter-spacing:.08em}
      .rp-recap-panel{padding:14px}.rp-recap-panel-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:10px}.rp-recap-panel-head small{color:#48d7ff;font-size:.48rem;font-weight:950;letter-spacing:.11em}.rp-recap-panel-head strong{color:#eaf4ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.82rem;font-style:italic;font-weight:950}
      .rp-recap-leaders{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.rp-recap-leaders article{min-width:0;display:grid;gap:4px;padding:10px 8px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:#080e17}.rp-recap-leaders small{color:#64778b;font-size:.46rem;font-weight:950}.rp-recap-leaders strong{overflow:hidden;color:#edf6ff;font-size:.57rem;font-weight:950;text-overflow:ellipsis;white-space:nowrap}.rp-recap-leaders b{color:#48d7ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.05rem;font-weight:950}
      .rp-recap-career-list{display:grid;gap:7px}.rp-recap-career-player{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.055);border-radius:12px;background:#070d15}.rp-recap-career-name{min-width:0;display:grid;gap:2px}.rp-recap-career-name>small{color:#63778d;font-size:.44rem;font-weight:900;letter-spacing:.08em}.rp-recap-career-name>strong{overflow:hidden;color:#eef7ff;font-size:.68rem;font-weight:950;text-overflow:ellipsis;white-space:nowrap}.rp-recap-career-status{display:grid;justify-items:end;gap:2px;text-align:right}.rp-recap-career-status b{color:#48d7ff;font-size:.58rem;font-weight:950}.rp-recap-career-status span{color:#7b8ea1;font-size:.46rem;font-weight:850}.rp-recap-career-status.muted b{color:#697b8d}
      .rp-recap-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.rp-recap-badges span{max-width:100%;padding:3px 6px;border:1px solid rgba(73,211,255,.15);border-radius:999px;color:#a9dff0;background:rgba(73,211,255,.045);font-size:.38rem;font-weight:950;letter-spacing:.04em}
      .rp-recap-comparison{display:grid;gap:0;border:1px solid rgba(255,255,255,.055);border-radius:12px;overflow:hidden}.rp-recap-comparison>div{display:grid;grid-template-columns:1fr 72px 1fr;align-items:center;min-height:34px;border-top:1px solid rgba(255,255,255,.045);text-align:center}.rp-recap-comparison>div:first-child{border-top:0}.rp-recap-comparison span{color:#65798e;font-size:.47rem;font-weight:950;letter-spacing:.08em}.rp-recap-comparison b{color:#eaf4ff;font-size:.65rem;font-weight:950}.rp-recap-comparison-head{background:#080f18}.rp-recap-comparison-head b{color:#48d7ff!important;font-size:.52rem!important;letter-spacing:.09em}
      .rp-recap-warning{margin-top:8px;padding:8px 10px;border:1px solid rgba(255,170,76,.28);border-radius:10px;color:#ffcb8b;background:rgba(255,170,76,.06);font-size:.49rem;font-weight:850;line-height:1.5}
      .rp-recap-original-label{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:4px 2px -4px}.rp-recap-original-label span{color:#eef7ff;font-size:.62rem;font-weight:950;letter-spacing:.08em}.rp-recap-original-label small{color:#62768b;font-size:.44rem;font-weight:850}
      .rp-recap-mvp{display:grid;justify-items:center;padding:18px 14px;text-align:center}.rp-recap-mvp>small{color:#6d8196;font-size:.46rem;font-weight:950;letter-spacing:.11em}.rp-recap-mvp-crown{margin-top:6px;font-size:1.55rem}.rp-recap-mvp h2{margin:3px 0 0;color:#48d7ff;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:1.2rem;font-style:italic;letter-spacing:.06em}.rp-recap-mvp h3{margin:4px 0 9px;color:#f2f8ff;font-size:.82rem;font-weight:950}.rp-recap-mvp-line{display:flex;justify-content:center;flex-wrap:wrap;gap:6px}.rp-recap-mvp-line span{padding:5px 7px;border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#8194a8;font-size:.48rem;font-weight:900}.rp-recap-mvp-line b{color:#eaf6ff}
      .rp-recap-event-summary{margin:0!important}.rp-recap-final-player{margin:0}.rp-recap-unavailable{display:grid;gap:3px;color:#74879b}.rp-recap-unavailable strong{font-size:.57rem}.rp-recap-unavailable span{font-size:.48rem}
      .rp-recap-fetch-error{display:grid;gap:7px;margin-bottom:12px;padding:12px;border:1px solid rgba(255,97,115,.28);border-radius:14px;color:#ff9cab;background:rgba(255,50,75,.06)}.rp-recap-fetch-error strong{font-size:.6rem}.rp-recap-fetch-error span{font-size:.5rem}.rp-recap-fetch-error button{justify-self:start;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#eef6ff;background:#0c131d;font-size:.48rem;font-weight:950}
      @media(max-width:640px){.rp-recap-leaders{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-recap-leaders article:last-child{grid-column:span 2}.rp-recap-career-player{grid-template-columns:1fr}.rp-recap-career-status{justify-items:start;text-align:left}.rp-recap-career-name>strong{white-space:normal}.rp-recap-summary-kicker{align-items:start;flex-direction:column}.rp-recap-summary-kicker b{max-width:100%}.rp-recap-original-label{align-items:start;flex-direction:column;gap:2px}.rp-recap-comparison>div{grid-template-columns:1fr 58px 1fr}}
      @media(max-width:390px){.rp-recap-score strong{font-size:2rem}.rp-recap-panel{padding:11px}.rp-recap-leaders{gap:5px}.rp-recap-mvp-line{gap:4px}}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('click', (event) => {
    const root = adminRoot();
    if (!root || !root.contains(event.target)) return;

    const retry = event.target.closest('[data-rp-recap-retry]');
    if (retry) {
      event.preventDefault();
      event.stopPropagation();
      if (officialRecapSessionId || finalizeSessionId) fetchOfficialRecap(officialRecapSessionId || finalizeSessionId);
      return;
    }

    const tab = event.target.closest('[data-admin-tab]');
    if (tab) {
      const nextTab = String(tab.dataset.adminTab || '');
      if (nextTab !== 'finalize') clearOfficialRecap();
      else window.setTimeout(primeFinalizeSession, 0);
      return;
    }

    if (event.target.closest('[data-rp-video-finish]')) {
      window.setTimeout(enrichCurrentReview, 0);
      return;
    }

    if (event.target.closest('[data-control-action="finalize"]')) {
      finalizeAwaiting = true;
      officialRecap = null;
      officialRecapSessionId = 0;
      return;
    }
  }, true);

  window.addEventListener('realplay:admin-render', (event) => {
    const tab = String(event?.detail?.tab || '');
    if (tab !== 'finalize') return;

    if (officialRecap) {
      window.setTimeout(renderOfficialRecap, 0);
      return;
    }

    if (!finalizeAwaiting) {
      window.setTimeout(primeFinalizeSession, 0);
      return;
    }

    window.setTimeout(() => {
      const text = String(adminBody()?.textContent || '');
      if (!FINAL_SUCCESS_PATTERN.test(text)) return;
      const id = finalizeSessionId;
      if (Number.isSafeInteger(id) && id > 0) fetchOfficialRecap(id);
      else {
        finalizeAwaiting = false;
        showOfficialRecapError('The game is final, but its previous session identity was not available for recap loading.');
      }
    }, 0);
  });

  installStyles();
})();
