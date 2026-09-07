(() => {
  if (window.__realPlayCareerReplayStatsInstalled) return;
  window.__realPlayCareerReplayStatsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const TOKEN_KEY = 'real_play_access_token';
  const ROSTER_CACHE_MS = 30000;
  let requestSequence = 0;
  let currentReplayData = null;
  let lastPlayerTrigger = null;
  let rosterCache = null;
  let rosterCacheAt = 0;
  let currentSessionId = 0;
  let commentsRequestId = 0;
  let currentRecognitions = new Map();

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

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(num(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function pct(made, attempts) {
    return attempts > 0 ? `${Math.round((made / attempts) * 100)}%` : '—';
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  const RECOGNITION_META = {
    overall_mvp: { icon: '👑', title: 'OVERALL MVP', rank: 100 },
    team_mvp: { icon: '⭐', title: 'TEAM MVP', rank: 90 },
    lethal_shooter: { icon: '🎯', title: 'LETHAL SHOOTER', rank: 70 },
    bucket_getter: { icon: '🔥', title: 'BUCKET GETTER', rank: 65 },
    floor_general: { icon: '🧠', title: 'FLOOR GENERAL', rank: 60 },
    glass_cleaner: { icon: '🧹', title: 'GLASS CLEANER', rank: 55 },
    pickpocket: { icon: '🥷', title: 'PICKPOCKET', rank: 50 },
    rim_protector: { icon: '🛡️', title: 'RIM PROTECTOR', rank: 45 },
  };

  function playerKey(player) {
    const id = player?.playerId ?? player?.player_id ?? player?.userId ?? player?.user_id ?? player?.id;
    if (id !== null && id !== undefined && id !== '') return `id:${String(id)}`;
    return `name:${normalizeName(player?.playerName ?? player?.player_name)}`;
  }

  function shotSummary(player) {
    const oneMade = num(player?.onePtMade);
    const oneMiss = num(player?.onePtMiss);
    const twoMade = num(player?.twoPtMade);
    const twoMiss = num(player?.twoPtMiss);
    const made = oneMade + twoMade;
    const attempts = made + oneMiss + twoMiss;
    return {
      oneMade,
      oneMiss,
      twoMade,
      twoMiss,
      made,
      attempts,
      fgPct: attempts > 0 ? made / attempts : 0,
      misses: oneMiss + twoMiss,
    };
  }

  function impactScore(player) {
    const shooting = shotSummary(player);
    return num(player?.pts)
      + (num(player?.reb) * 1.2)
      + (num(player?.ast) * 1.5)
      + (num(player?.stl) * 2)
      + (num(player?.blk) * 2)
      - (num(player?.tov) * 1.5)
      - (shooting.misses * 0.5)
      - (num(player?.foul) * 0.25);
  }

  function compareMvp(a, b) {
    const impactDiff = impactScore(b) - impactScore(a);
    if (Math.abs(impactDiff) > 0.0001) return impactDiff;
    const aShot = shotSummary(a);
    const bShot = shotSummary(b);
    if (bShot.fgPct !== aShot.fgPct) return bShot.fgPct - aShot.fgPct;
    if (num(b?.pts) !== num(a?.pts)) return num(b?.pts) - num(a?.pts);
    if (num(a?.tov) !== num(b?.tov)) return num(a?.tov) - num(b?.tov);
    return playerLabel(a).localeCompare(playerLabel(b));
  }

  function leaders(players, valueFn, eligibleFn = () => true) {
    const eligible = players.filter(eligibleFn);
    if (!eligible.length) return [];
    const best = Math.max(...eligible.map(valueFn));
    if (!Number.isFinite(best) || best <= 0) return [];
    return eligible.filter((player) => Math.abs(valueFn(player) - best) < 0.0001);
  }

  function addRecognition(map, player, type, details) {
    const key = playerKey(player);
    if (!key) return;
    const list = map.get(key) || [];
    list.push({ type, ...(RECOGNITION_META[type] || {}), details });
    map.set(key, list);
  }

  function buildRecognitions(players) {
    const map = new Map();
    const valid = players.filter((player) => ['west', 'east'].includes(String(player?.team || '').toLowerCase()));
    if (!valid.length) return map;

    const overall = [...valid].sort(compareMvp)[0];
    if (overall) {
      const s = shotSummary(overall);
      addRecognition(map, overall, 'overall_mvp', {
        headline: `Great job for being the Overall MVP, ${overall.playerName || 'player'}.`,
        explanation: `You produced the strongest all-around performance in this game across scoring, playmaking, rebounding, defense, efficiency, and ball security.`,
        metrics: [
          ['PTS', num(overall.pts)],
          ['REB', num(overall.reb)],
          ['AST', num(overall.ast)],
          ['STL', num(overall.stl)],
          ['BLK', num(overall.blk)],
          ['FG%', s.attempts ? `${Math.round(s.fgPct * 100)}%` : '—'],
          ['IMPACT', impactScore(overall).toFixed(1)],
        ],
        note: `Highest overall game-impact score among all ${valid.length} players, regardless of which team won.`,
      });
    }

    for (const team of ['west', 'east']) {
      const teamPlayers = valid.filter((player) => String(player.team || '').toLowerCase() === team);
      const winner = [...teamPlayers].sort(compareMvp)[0];
      if (!winner || playerKey(winner) === playerKey(overall)) continue;
      const s = shotSummary(winner);
      addRecognition(map, winner, 'team_mvp', {
        headline: `Great job for being ${team.toUpperCase()} Team MVP.`,
        explanation: `You delivered the strongest overall performance among your teammates in this game.`,
        metrics: [
          ['PTS', num(winner.pts)],
          ['REB', num(winner.reb)],
          ['AST', num(winner.ast)],
          ['STL', num(winner.stl)],
          ['BLK', num(winner.blk)],
          ['FG%', s.attempts ? `${Math.round(s.fgPct * 100)}%` : '—'],
          ['IMPACT', impactScore(winner).toFixed(1)],
        ],
        note: `Highest game-impact score among ${team.toUpperCase()} players.`,
      });
    }

    const minShooterAttempts = 3;
    leaders(valid, (player) => shotSummary(player).fgPct, (player) => shotSummary(player).attempts >= minShooterAttempts)
      .forEach((player) => {
        const s = shotSummary(player);
        addRecognition(map, player, 'lethal_shooter', {
          headline: `Lethal shooting performance.`,
          explanation: `You had the highest qualified field-goal percentage in the game.`,
          metrics: [
            ['FG', `${s.made}/${s.attempts}`],
            ['FG%', `${Math.round(s.fgPct * 100)}%`],
            ['PTS', num(player.pts)],
            ['1PT', `${s.oneMade}/${s.oneMade + s.oneMiss}`],
            ['2PT', `${s.twoMade}/${s.twoMade + s.twoMiss}`],
          ],
          note: `Qualification requires at least ${minShooterAttempts} shot attempts so a single make does not automatically win the award.`,
        });
      });

    leaders(valid, (player) => num(player.pts)).forEach((player) => {
      addRecognition(map, player, 'bucket_getter', {
        headline: `You were the game's Bucket Getter.`,
        explanation: `You finished with the highest scoring total in this game.`,
        metrics: [['PTS', num(player.pts)], ['FG', `${shotSummary(player).made}/${shotSummary(player).attempts}`], ['FG%', shotSummary(player).attempts ? `${Math.round(shotSummary(player).fgPct * 100)}%` : '—']],
        note: `Highest point total among all players in this game.`,
      });
    });

    leaders(valid, (player) => num(player.ast)).forEach((player) => {
      addRecognition(map, player, 'floor_general', {
        headline: `You ran the offense as the Floor General.`,
        explanation: `You created the most verified scoring opportunities for teammates through assists.`,
        metrics: [['AST', num(player.ast)], ['TO', num(player.tov)], ['AST/TO', num(player.tov) ? (num(player.ast) / num(player.tov)).toFixed(2) : (num(player.ast) ? 'NO TO' : '—')]],
        note: `Highest assist total in the game.`,
      });
    });

    leaders(valid, (player) => num(player.reb)).forEach((player) => {
      addRecognition(map, player, 'glass_cleaner', {
        headline: `You owned the glass.`,
        explanation: `You collected more rebounds than any other player in this game.`,
        metrics: [['REB', num(player.reb)], ['PTS', num(player.pts)], ['AST', num(player.ast)]],
        note: `Highest rebound total in the game.`,
      });
    });

    leaders(valid, (player) => num(player.stl)).forEach((player) => {
      addRecognition(map, player, 'pickpocket', {
        headline: `You earned the Pickpocket recognition.`,
        explanation: `You disrupted possessions with the highest steal total in the game.`,
        metrics: [['STL', num(player.stl)], ['TO', num(player.tov)], ['PTS', num(player.pts)]],
        note: `Highest verified steal total in the game.`,
      });
    });

    leaders(valid, (player) => num(player.blk)).forEach((player) => {
      addRecognition(map, player, 'rim_protector', {
        headline: `You protected the rim.`,
        explanation: `You recorded the most blocked shots in the game.`,
        metrics: [['BLK', num(player.blk)], ['REB', num(player.reb)], ['STL', num(player.stl)]],
        note: `Highest verified block total in the game.`,
      });
    });

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (b.rank || 0) - (a.rank || 0));
      map.set(key, list);
    }
    return map;
  }

  function recognitionBadgesHtml(player) {
    const list = currentRecognitions.get(playerKey(player)) || [];
    if (!list.length) return '';
    return `<span class="rp-career-replay-recognition-badges" aria-label="Player recognitions">${list.map((award) =>
      `<span class="rp-career-replay-recognition-badge rp-recognition-${esc(award.type)}" data-rp-career-recognition="${esc(award.type)}" data-rp-career-recognition-player="${esc(playerKey(player))}" title="${esc(award.title)}">${award.icon}</span>`
    ).join('')}</span>`;
  }

  function closeRecognitionModal() {
    document.querySelector('[data-rp-career-recognition-modal]')?.remove();
  }

  function openRecognitionModal(playerKeyValue, type) {
    closeRecognitionModal();
    const player = (currentReplayData?.playerStats || []).find((candidate) => playerKey(candidate) === playerKeyValue);
    const award = (currentRecognitions.get(playerKeyValue) || []).find((item) => item.type === type);
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!player || !award || !viewer) return;

    const metrics = Array.isArray(award.details?.metrics) ? award.details.metrics : [];
    const modal = document.createElement('div');
    modal.className = 'rp-career-recognition-modal';
    modal.dataset.rpCareerRecognitionModal = '1';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', `${award.title} recognition details`);
    modal.innerHTML = `
      <div class="rp-career-recognition-backdrop" data-rp-career-recognition-close></div>
      <section class="rp-career-recognition-card">
        <button type="button" class="rp-career-recognition-close" data-rp-career-recognition-close aria-label="Close recognition details">×</button>
        <div class="rp-career-recognition-icon">${award.icon}</div>
        <small>GAME RECOGNITION</small>
        <h2>${esc(award.title)}</h2>
        <h3>${esc(playerLabel(player))}</h3>
        <p class="rp-career-recognition-headline">${esc(award.details?.headline || '')}</p>
        <p class="rp-career-recognition-copy">${esc(award.details?.explanation || '')}</p>
        <div class="rp-career-recognition-metrics">
          ${metrics.map(([label, value]) => `<span><b>${esc(value)}</b><small>${esc(label)}</small></span>`).join('')}
        </div>
        <p class="rp-career-recognition-note">${esc(award.details?.note || '')}</p>
      </section>`;
    viewer.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));
    modal.querySelector('[data-rp-career-recognition-close]')?.focus({ preventScroll: true });
  }

  function ensureProfileLinkStyles() {
    if (document.querySelector('[data-rp-breakdown-profile-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpBreakdownProfileStyles = '1';
    style.textContent = `
      .rp-career-player-detail-head{gap:8px}
      .rp-career-player-detail-head>div:first-child{flex:1 1 auto;min-width:0}
      .rp-career-player-detail-profile{flex:0 0 auto!important;width:auto!important;min-width:88px!important;height:36px!important;padding:0 10px!important;border:1px solid rgba(64,215,245,.28)!important;border-radius:10px!important;background:rgba(25,119,151,.12)!important;color:#65e4fa!important;font-family:var(--rp-display,Arial,sans-serif)!important;font-size:.43rem!important;font-style:italic!important;font-weight:950!important;letter-spacing:.08em!important;white-space:nowrap!important;cursor:pointer}
      .rp-career-player-detail-profile:hover,.rp-career-player-detail-profile:focus-visible{border-color:rgba(90,229,250,.5)!important;background:rgba(30,148,184,.18)!important;outline:none}
      .rp-career-player-detail-profile:disabled{opacity:.58;cursor:wait}
      body.rp-career-replay-open .rp-profile.open{z-index:780!important}
      @media(max-width:390px){.rp-career-player-detail-profile{min-width:78px!important;padding-inline:8px!important;font-size:.39rem!important}.rp-career-player-detail-head{gap:6px}}
    `;
    document.head.appendChild(style);
  }

  async function loadCommunityPlayers() {
    if (rosterCache && Date.now() - rosterCacheAt < ROSTER_CACHE_MS) return rosterCache;
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) throw new Error('Please log in to view player profiles.');

    const response = await fetch(COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action: 'players' }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not find this player profile.');

    rosterCache = {
      players: Array.isArray(data?.players) ? data.players : [],
      meUserId: Number(data?.meUserId || 0) || null,
    };
    rosterCacheAt = Date.now();
    return rosterCache;
  }

  function findDirectoryPlayer(players, player) {
    const targetName = normalizeName(player?.playerName ?? player?.player_name);
    const targetNumberRaw = player?.playerNumber ?? player?.player_number;
    const targetNumber = targetNumberRaw === null || targetNumberRaw === undefined || targetNumberRaw === ''
      ? null
      : Number(targetNumberRaw);
    if (!targetName) return null;

    const exactName = players.filter((candidate) => normalizeName(candidate?.playerName ?? candidate?.player_name) === targetName);
    if (targetNumber !== null && Number.isFinite(targetNumber)) {
      const exactIdentity = exactName.find((candidate) => Number(candidate?.playerNumber ?? candidate?.player_number) === targetNumber);
      if (exactIdentity) return exactIdentity;
    }
    return exactName[0] || null;
  }

  function directoryPlayerForStat(players, player) {
    if (!Array.isArray(players) || !player) return null;

    const targetIds = [
      player?.userId,
      player?.user_id,
      player?.playerId,
      player?.player_id,
      player?.id,
    ].filter((value) => value !== null && value !== undefined && value !== '').map(String);

    if (targetIds.length) {
      const idMatch = players.find((candidate) => {
        const candidateIds = [
          candidate?.userId,
          candidate?.user_id,
          candidate?.playerId,
          candidate?.player_id,
          candidate?.id,
        ].filter((value) => value !== null && value !== undefined && value !== '').map(String);
        return candidateIds.some((value) => targetIds.includes(value));
      });
      if (idMatch) return idMatch;
    }

    return findDirectoryPlayer(players, player);
  }

  async function hydrateReplayPlayerNumbers(data) {
    const stats = Array.isArray(data?.playerStats) ? data.playerStats : [];
    if (!stats.length) return data;

    const missingNumber = stats.some((player) => {
      const value = player?.playerNumber ?? player?.player_number;
      return value === null || value === undefined || value === '';
    });
    if (!missingNumber) return data;

    try {
      const directory = await loadCommunityPlayers();
      const players = Array.isArray(directory?.players) ? directory.players : [];
      stats.forEach((player) => {
        const current = player?.playerNumber ?? player?.player_number;
        if (current !== null && current !== undefined && current !== '') return;

        const match = directoryPlayerForStat(players, player);
        const resolved = match?.playerNumber ?? match?.player_number;
        if (resolved === null || resolved === undefined || resolved === '') return;

        player.playerNumber = resolved;
      });
    } catch (error) {
      console.warn('[Real Play] Could not resolve replay jersey numbers from player profiles.', error);
    }

    return data;
  }

  async function openPlayerProfile(player, button) {
    if (!player || !button || button.disabled) return;
    const originalText = 'VIEW PROFILE';
    button.disabled = true;
    button.textContent = 'OPENING…';

    try {
      const directory = await loadCommunityPlayers();
      const match = findDirectoryPlayer(directory.players, player);
      const userId = Number(match?.userId ?? match?.user_id ?? 0);
      if (!match || !Number.isSafeInteger(userId) || userId < 1) {
        throw new Error('No Real Play profile is attached to this player yet.');
      }

      if (directory.meUserId && userId === directory.meUserId && window.RealPlayProfile?.open) {
        window.RealPlayProfile.open();
      } else if (window.RealPlayPlayers?.openProfile) {
        await window.RealPlayPlayers.openProfile(userId);
      } else {
        throw new Error('Player profiles are still loading.');
      }

      button.disabled = false;
      button.textContent = originalText;
    } catch (error) {
      button.textContent = 'NO PROFILE';
      window.setTimeout(() => {
        if (!button.isConnected) return;
        button.disabled = false;
        button.textContent = originalText;
      }, 1800);
      console.warn('[Real Play] Could not open player profile from game breakdown.', error);
    }
  }

  function statIdentityHtml(player) {
    const rawNumber = player?.playerNumber ?? player?.player_number;
    const number = rawNumber === null || rawNumber === undefined || rawNumber === '' ? '#--' : `#${Number(rawNumber)}`;
    const name = String(player?.playerName ?? player?.player_name ?? 'REAL PLAY PLAYER');
    return `<span class="rp-career-replay-stat-number">${esc(number)}</span><span class="rp-career-replay-stat-player-name" title="${esc(name)}">${esc(name)}</span>${recognitionBadgesHtml(player)}`;
  }

  function statRow(player, index) {
    return `<button type="button" class="rp-career-replay-stat-player" data-rp-career-stat-player="${index}" aria-label="View detailed stats for ${esc(playerLabel(player))}">
      <span class="rp-career-replay-stat-identity">${statIdentityHtml(player)}</span>
      <span class="rp-career-replay-stat-value"><b>${num(player.pts)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.ast)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.reb)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.tov)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.stl)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.blk)}</b></span>
      <span class="rp-career-replay-stat-value"><b>${num(player.foul)}</b></span>
    </button>`;
  }

  function statHeaderRow() {
    return `<div class="rp-career-replay-stat-grid-head" aria-hidden="true">
      <span class="rp-career-replay-stat-identity">PLAYER</span>
      <span>PTS</span>
      <span>AST</span>
      <span>REB</span>
      <span>TO</span>
      <span>STL</span>
      <span>BLK</span>
      <span>FOUL</span>
    </div>`;
  }

  function teamBlock(team, players, active = false) {
    const rows = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => String(player.team || '').toLowerCase() === team);
    return `<section class="rp-career-replay-stat-team" data-rp-career-stat-panel="${team}"${active ? '' : ' hidden'}>
      <div class="rp-career-replay-stat-scroll" tabindex="0" aria-label="${team.toUpperCase()} player statistics. Swipe horizontally for more categories.">
        <div class="rp-career-replay-stat-grid">
          ${statHeaderRow()}
          ${rows.length ? rows.map(({ player, index }) => statRow(player, index)).join('') : '<p class="rp-career-replay-stat-empty">No verified player stats.</p>'}
        </div>
      </div>
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

  function commentTime(value) {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function commentsHtml(comments) {
    if (!comments.length) {
      return '<div class="rp-career-replay-comments-empty">NO COMMENTS YET.<br><span>BE THE FIRST TO JOIN THE GAME DISCUSSION.</span></div>';
    }
    return comments.map((comment) => `
      <article class="rp-career-replay-comment">
        <div class="rp-career-replay-comment-head">
          <strong>${esc(comment.playerName || 'REAL PLAY USER')}</strong>
          <time>${esc(commentTime(comment.createdAt))}</time>
        </div>
        <p>${esc(comment.body || '')}</p>
      </article>`).join('');
  }

  async function loadComments(section, sessionId = currentSessionId) {
    const id = Number(sessionId || 0);
    if (!section || !Number.isSafeInteger(id) || id < 1) return;
    const list = section.querySelector('[data-rp-career-comments-list]');
    if (!list) return;
    const requestId = ++commentsRequestId;
    list.innerHTML = '<div class="rp-career-replay-comments-loading">LOADING COMMENTS…</div>';

    try {
      const auth = localStorage.getItem(TOKEN_KEY) || '';
      if (!auth) throw new Error('Sign in to view comments.');
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(id)}/comments`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Comments could not load.');
      if (requestId !== commentsRequestId || !list.isConnected) return;
      const comments = Array.isArray(data?.comments) ? data.comments : [];
      list.innerHTML = commentsHtml(comments);
      list.scrollTop = list.scrollHeight;
    } catch (error) {
      if (requestId !== commentsRequestId || !list.isConnected) return;
      list.innerHTML = `<div class="rp-career-replay-comments-error">${esc(error.message || 'Comments could not load.')}</div>`;
    }
  }

  function setMainStatsView(section, view) {
    if (!section || !['stats', 'comments'].includes(view)) return;
    section.querySelectorAll('[data-rp-career-main-tab]').forEach((button) => {
      const active = button.dataset.rpCareerMainTab === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    section.querySelectorAll('[data-rp-career-main-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.rpCareerMainPanel !== view;
    });
    if (view === 'comments') loadComments(section).catch(() => {});
  }

  async function submitComment(section, form) {
    if (!section || !form || form.dataset.submitting === '1') return;
    const input = form.querySelector('[data-rp-career-comment-input]');
    const button = form.querySelector('[data-rp-career-comment-submit]');
    const body = String(input?.value || '').trim();
    if (!body) return;

    form.dataset.submitting = '1';
    if (button) {
      button.disabled = true;
      button.textContent = 'SENDING…';
    }

    try {
      const auth = localStorage.getItem(TOKEN_KEY) || '';
      if (!auth) throw new Error('Sign in to comment.');
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(currentSessionId)}/comments`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Comment could not be posted.');
      if (input) input.value = '';
      await loadComments(section);
    } catch (error) {
      const list = section.querySelector('[data-rp-career-comments-list]');
      if (list) list.insertAdjacentHTML('beforeend', `<div class="rp-career-replay-comments-error">${esc(error.message || 'Comment could not be posted.')}</div>`);
    } finally {
      delete form.dataset.submitting;
      if (button) {
        button.disabled = false;
        button.textContent = 'SEND';
      }
      input?.focus({ preventScroll: true });
    }
  }

  function markerBelongsToPlayer(marker, player) {
    const markerId = marker?.playerId ?? marker?.player_id ?? null;
    const playerId = player?.playerId ?? player?.player_id ?? player?.id ?? null;
    if (markerId !== null && playerId !== null && String(markerId) === String(playerId)) return true;
    return normalizeName(marker?.playerName ?? marker?.player_name) === normalizeName(player?.playerName);
  }

  function timelineHtml(player, markers) {
    const playerMarkers = markers
      .filter((marker) => markerBelongsToPlayer(marker, player))
      .sort((a, b) => num(a.videoTimestampMs) - num(b.videoTimestampMs));
    if (!playerMarkers.length) {
      return '<p class="rp-career-player-detail-empty">No made-basket timestamps were recorded for this player.</p>';
    }
    return playerMarkers.map((marker) => {
      const shotValue = num(marker.shotValue) || 1;
      const timestamp = num(marker.videoTimestampMs);
      const replayStart = num(marker.replayStartMs);
      return `<button type="button" class="rp-career-player-detail-marker" data-rp-player-marker="${replayStart}">
        <span><b>🏀 ${shotValue}PT MADE</b><small>${formatTime(timestamp)} · replay from ${formatTime(replayStart)}</small></span>
        <strong>WATCH ›</strong>
      </button>`;
    }).join('');
  }

  function closeBreakdown(restoreFocus = true) {
    const detail = document.querySelector('[data-rp-career-player-detail]');
    if (!detail) return;
    detail.remove();
    if (restoreFocus && lastPlayerTrigger?.isConnected) lastPlayerTrigger.focus({ preventScroll: true });
    lastPlayerTrigger = null;
  }

  function openBreakdown(player, trigger) {
    closeBreakdown(false);
    lastPlayerTrigger = trigger || null;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) return;

    const oneMade = num(player.onePtMade);
    const oneMiss = num(player.onePtMiss);
    const twoMade = num(player.twoPtMade);
    const twoMiss = num(player.twoPtMiss);
    const oneAttempts = oneMade + oneMiss;
    const twoAttempts = twoMade + twoMiss;
    const totalMade = oneMade + twoMade;
    const totalMiss = oneMiss + twoMiss;
    const totalAttempts = oneAttempts + twoAttempts;
    const points = num(player.pts);
    const onePoints = oneMade;
    const twoPoints = twoMade * 2;
    const scoringPoints = onePoints + twoPoints;
    const oneMix = scoringPoints > 0 ? Math.round((onePoints / scoringPoints) * 100) : 0;
    const twoMix = scoringPoints > 0 ? 100 - oneMix : 0;
    const ast = num(player.ast);
    const tov = num(player.tov);
    const astTo = tov > 0 ? (ast / tov).toFixed(2) : (ast > 0 ? 'NO TO' : '—');
    const pointsPerAttempt = totalAttempts > 0 ? (points / totalAttempts).toFixed(2) : '—';
    const markers = Array.isArray(currentReplayData?.markers) ? currentReplayData.markers : [];
    const team = String(player.team || '').toUpperCase() || 'TEAM';

    const detail = document.createElement('div');
    detail.className = 'rp-career-player-detail';
    detail.dataset.rpCareerPlayerDetail = '1';
    detail._rpPlayer = player;
    detail.setAttribute('role', 'dialog');
    detail.setAttribute('aria-modal', 'true');
    detail.setAttribute('aria-label', `${playerLabel(player)} game breakdown`);
    detail.innerHTML = `
      <div class="rp-career-player-detail-backdrop" data-rp-career-player-detail-close></div>
      <section class="rp-career-player-detail-sheet">
        <header class="rp-career-player-detail-head">
          <div><small>${esc(team)} · GAME BREAKDOWN</small><strong>${esc(playerLabel(player))}</strong></div>
          <button type="button" class="rp-career-player-detail-profile" data-rp-career-player-profile aria-label="View ${esc(player?.playerName || 'player')} profile">VIEW PROFILE</button>
          <button type="button" data-rp-career-player-detail-close aria-label="Close player breakdown">×</button>
        </header>

        <div class="rp-career-player-detail-hero">
          <span><b>${points}</b><small>PTS</small></span>
          <span><b>${pct(totalMade, totalAttempts)}</b><small>FG%</small></span>
          <span><b>${pct(oneMade, oneAttempts)}</b><small>1PT%</small></span>
          <span><b>${pct(twoMade, twoAttempts)}</b><small>2PT%</small></span>
        </div>

        <section class="rp-career-player-detail-section">
          <div class="rp-career-player-detail-title"><strong>SHOOTING</strong><span>${totalMade}/${totalAttempts} TOTAL FG</span></div>
          <div class="rp-career-player-detail-shooting">
            <span><b>${oneMade}/${oneAttempts}</b><small>1PT MADE / ATT</small></span>
            <span><b>${twoMade}/${twoAttempts}</b><small>2PT MADE / ATT</small></span>
            <span><b>${totalMiss}</b><small>MISSED SHOTS</small></span>
            <span><b>${totalAttempts}</b><small>SHOT ATTEMPTS</small></span>
            <span><b>${pointsPerAttempt}</b><small>PTS / ATTEMPT</small></span>
            <span><b>${astTo}</b><small>AST / TO</small></span>
          </div>
        </section>

        <section class="rp-career-player-detail-section">
          <div class="rp-career-player-detail-title"><strong>SCORING MIX</strong><span>${scoringPoints} VERIFIED PTS FROM MADE SHOTS</span></div>
          <div class="rp-career-player-detail-mix">
            <div><span>1PT</span><i><b style="width:${oneMix}%"></b></i><strong>${oneMix}%</strong></div>
            <div><span>2PT</span><i><b style="width:${twoMix}%"></b></i><strong>${twoMix}%</strong></div>
          </div>
        </section>

        <section class="rp-career-player-detail-section">
          <div class="rp-career-player-detail-title"><strong>GAME STATS</strong><span>VIDEO-VERIFIED</span></div>
          <div class="rp-career-player-detail-stats">
            <span><b>${num(player.ast)}</b><small>AST</small></span>
            <span><b>${num(player.reb)}</b><small>REB</small></span>
            <span><b>${num(player.tov)}</b><small>TO</small></span>
            <span><b>${num(player.stl)}</b><small>STL</small></span>
            <span><b>${num(player.blk)}</b><small>BLK</small></span>
            <span><b>${num(player.foul)}</b><small>FOUL</small></span>
          </div>
        </section>

        <section class="rp-career-player-detail-section">
          <div class="rp-career-player-detail-title"><strong>MADE BASKETS</strong><span>TAP TO REPLAY</span></div>
          <div class="rp-career-player-detail-timeline">${timelineHtml(player, markers)}</div>
        </section>
      </section>`;

    viewer.appendChild(detail);
    requestAnimationFrame(() => detail.classList.add('open'));
    detail.querySelector('button[data-rp-career-player-detail-close]')?.focus({ preventScroll: true });
  }

  function installStats(data, sequence, attempt = 0) {
    if (sequence !== requestSequence) return;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    const main = viewer?.querySelector('[data-rp-career-replay-main]');
    if (!main || !main.querySelector('[data-rp-career-replay-stage]')) {
      if (attempt < 20) setTimeout(() => installStats(data, sequence, attempt + 1), 150);
      return;
    }

    closeBreakdown(false);
    currentReplayData = data;
    main.querySelector('[data-rp-career-replay-stats]')?.remove();
    const stats = Array.isArray(data?.playerStats) ? data.playerStats : [];
    currentRecognitions = buildRecognitions(stats);
    const section = document.createElement('section');
    section.className = 'rp-career-replay-stats';
    section.dataset.rpCareerReplayStats = '1';
    currentSessionId = Number(data?.game?.sessionId || 0);
    section.innerHTML = `
      <div class="rp-career-replay-main-tabs" role="tablist" aria-label="Game information">
        <button type="button" class="active" role="tab" aria-selected="true" data-rp-career-main-tab="stats">PLAYER STATS</button>
        <button type="button" role="tab" aria-selected="false" data-rp-career-main-tab="comments">COMMENTS</button>
      </div>

      <div data-rp-career-main-panel="stats">
        <div class="rp-career-replay-stat-tabs" role="tablist" aria-label="Choose team stats">
          <button type="button" class="active" role="tab" aria-selected="true" data-rp-career-stat-team="west">WEST</button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-rp-career-stat-team="east">EAST</button>
        </div>
        <div class="rp-career-replay-stat-teams">${teamBlock('west', stats, true)}${teamBlock('east', stats, false)}</div>
      </div>

      <div class="rp-career-replay-comments-panel" data-rp-career-main-panel="comments" hidden>
        <div class="rp-career-replay-comments-list" data-rp-career-comments-list>
          <div class="rp-career-replay-comments-loading">LOADING COMMENTS…</div>
        </div>
        <form class="rp-career-replay-comment-form" data-rp-career-comment-form>
          <textarea maxlength="500" rows="2" placeholder="Add a comment…" aria-label="Add a game comment" data-rp-career-comment-input></textarea>
          <button type="submit" data-rp-career-comment-submit>SEND</button>
        </form>
      </div>`;
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
      await hydrateReplayPlayerNumbers(data);
      if (sequence !== requestSequence) return;
      installStats(data, sequence);
    } catch (_) {}
  }

  ensureProfileLinkStyles();

  document.addEventListener('click', (event) => {
    const recognitionClose = event.target.closest('[data-rp-career-recognition-close]');
    if (recognitionClose) {
      event.preventDefault();
      event.stopPropagation();
      closeRecognitionModal();
      return;
    }

    const recognition = event.target.closest('[data-rp-career-recognition]');
    if (recognition) {
      event.preventDefault();
      event.stopPropagation();
      openRecognitionModal(recognition.dataset.rpCareerRecognitionPlayer, recognition.dataset.rpCareerRecognition);
      return;
    }

    const profileButton = event.target.closest('[data-rp-career-player-profile]');
    if (profileButton) {
      event.preventDefault();
      event.stopPropagation();
      const detail = profileButton.closest('[data-rp-career-player-detail]');
      if (detail?._rpPlayer) openPlayerProfile(detail._rpPlayer, profileButton);
      return;
    }

    const close = event.target.closest('[data-rp-career-player-detail-close]');
    if (close) {
      closeBreakdown(true);
      return;
    }

    const detailMarker = event.target.closest('[data-rp-player-marker]');
    if (detailMarker) {
      const replayStart = detailMarker.dataset.rpPlayerMarker;
      const candidates = [...document.querySelectorAll('[data-rp-career-replay-marker]')];
      const sourceMarker = candidates.find((marker) => marker.dataset.rpCareerReplayMarker === replayStart);
      if (sourceMarker) {
        closeBreakdown(false);
        sourceMarker.click();
      }
      return;
    }

    const playerButton = event.target.closest('[data-rp-career-stat-player]');
    if (playerButton) {
      const index = Number(playerButton.dataset.rpCareerStatPlayer);
      const player = Array.isArray(currentReplayData?.playerStats) ? currentReplayData.playerStats[index] : null;
      if (player) openBreakdown(player, playerButton);
      return;
    }

    const mainTab = event.target.closest('[data-rp-career-main-tab]');
    if (mainTab) {
      const section = mainTab.closest('[data-rp-career-replay-stats]');
      setMainStatsView(section, mainTab.dataset.rpCareerMainTab);
      return;
    }

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

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-rp-career-comment-form]');
    if (!form) return;
    event.preventDefault();
    const section = form.closest('[data-rp-career-replay-stats]');
    submitComment(section, form).catch(() => {});
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('[data-rp-career-recognition-modal]')) {
      event.preventDefault();
      event.stopPropagation();
      closeRecognitionModal();
      return;
    }
    if (!document.querySelector('[data-rp-career-player-detail]')) return;
    event.preventDefault();
    event.stopPropagation();
    closeBreakdown(true);
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    rosterCache = null;
    rosterCacheAt = 0;
  });
})();
