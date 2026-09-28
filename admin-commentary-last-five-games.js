(() => {
  if (window.__realPlayCommentaryLastFiveGamesInstalled) return;
  window.__realPlayCommentaryLastFiveGamesInstalled = true;

  const API = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const cache = new Map();
  const pending = new Map();
  const errors = new Map();
  const selectedByPlayer = new Map();
  let scheduled = false;

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function playerIdFromViewer(viewer) {
    const key = String(viewer?.querySelector('.rp-cv2-player.active[data-cv2-select]')?.dataset.cv2Select || '');
    const match = key.match(/^id:(\d+)$/);
    const id = Number(match?.[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function gameLabel(game) {
    const direct = pick(game?.displayLabel, game?.officialGameId, game?.official_game_id);
    if (direct) return String(direct);
    const openRankNumber = Number(pick(game?.openRankNumber, game?.open_rank_number));
    if (Number.isSafeInteger(openRankNumber) && openRankNumber > 0) {
      return `OPEN RANK #${String(openRankNumber).padStart(3, '0')}`;
    }
    return String(pick(game?.label, game?.title, 'OFFICIAL GAME'));
  }

  function resultOf(game) {
    return String(pick(game?.result, 'FINAL')).toUpperCase();
  }

  function resultShort(game) {
    const result = resultOf(game);
    if (result === 'WIN') return 'W';
    if (result === 'LOSS') return 'L';
    return result;
  }

  function numberOrDash(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : '—';
  }

  function scoreValue(game, side) {
    return numberOrDash(side === 'east'
      ? pick(game?.eastScore, game?.east_score)
      : pick(game?.westScore, game?.west_score));
  }

  function sideLabel(game, side) {
    return String((game?.teamLabels || game?.team_labels || {})[side] || side).toUpperCase();
  }

  function scoreLine(game) {
    const east = scoreValue(game, 'east');
    const west = scoreValue(game, 'west');
    if (east === '—' && west === '—') return 'FINAL SCORE UNAVAILABLE';
    return `${sideLabel(game, 'east')} ${east}–${west} ${sideLabel(game, 'west')}`;
  }

  function stat(game, ...keys) {
    return numberOrDash(pick(...keys.map((key) => game?.[key])));
  }

  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function textValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function contextLabel(game) {
    const parts = [];
    const mode = textValue(pick(game?.competitionContext, game?.competition_context, game?.mode, game?.gameMode, game?.game_mode));
    if (mode) parts.push(mode.replaceAll('_', ' ').replaceAll('-', ' ').toUpperCase());

    const family = textValue(pick(game?.rulesetFamily, game?.ruleset_family, game?.ruleset, game?.gameType, game?.game_type));
    const target = Number(pick(game?.targetScore, game?.target_score));
    if (family) {
      const normalized = family.replaceAll('_', ' ').replaceAll('-', ' ').toUpperCase();
      if (normalized.includes('RACE') && Number.isFinite(target)) parts.push(`RACE TO ${Math.round(target)}`);
      else parts.push(normalized);
    } else if (Number.isFinite(target)) {
      parts.push(`RACE TO ${Math.round(target)}`);
    }

    const format = textValue(pick(game?.playerFormat, game?.player_format, game?.format));
    if (format && !parts.some((part) => part === format.toUpperCase())) parts.push(format.toUpperCase());
    return [...new Set(parts)].join(' · ');
  }

  function metaLine(game) {
    return [
      dateLabel(pick(game?.finalizedAt, game?.finalized_at, game?.startsAt, game?.starts_at)),
      textValue(pick(game?.locationName, game?.location_name)).toUpperCase(),
      contextLabel(game),
    ].filter(Boolean).join(' · ');
  }

  async function loadGames(playerId) {
    if (cache.has(playerId)) return cache.get(playerId);
    if (pending.has(playerId)) return pending.get(playerId);

    const request = (async () => {
      const auth = token();
      if (!auth) throw new Error('Admin session is not available.');
      const response = await fetch(`${API}/api/real-play/community`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ action: 'player_profile', playerId }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load recent games.');
      const raw = Array.isArray(data?.player?.recentGames)
        ? data.player.recentGames
        : Array.isArray(data?.player?.recent_games)
          ? data.player.recent_games
          : [];
      const games = raw.slice(0, 5);
      cache.set(playerId, games);
      errors.delete(playerId);
      return games;
    })().finally(() => pending.delete(playerId));

    pending.set(playerId, request);
    return request;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-cv2-last-five-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCv2LastFiveStyles = '1';
    style.textContent = `
      .rp-cv2-recent-wrap{min-width:0}
      .rp-cv2-recent-track{display:flex;gap:9px;overflow-x:auto;padding:1px 2px 8px;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:#183246 transparent}
      .rp-cv2-recent-track::-webkit-scrollbar{height:5px}.rp-cv2-recent-track::-webkit-scrollbar-thumb{background:#183246;border-radius:20px}
      .rp-cv2-game-card{scroll-snap-align:start;flex:0 0 min(238px,78%);min-width:0;padding:12px;border:1px solid rgba(103,163,192,.14);border-radius:15px;background:linear-gradient(155deg,#07131e,#050d15);color:#eef8fe;text-align:left;cursor:pointer;transition:border-color .16s ease,transform .16s ease,background .16s ease}
      .rp-cv2-game-card:hover,.rp-cv2-game-card:focus-visible{border-color:rgba(49,219,248,.46);outline:none;transform:translateY(-1px)}
      .rp-cv2-game-card.active{border-color:rgba(49,219,248,.62);background:linear-gradient(155deg,rgba(8,38,52,.98),#050d15);box-shadow:inset 0 0 0 1px rgba(49,219,248,.08)}
      .rp-cv2-game-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .rp-cv2-game-card-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.61rem;font-weight:950;letter-spacing:.02em}
      .rp-cv2-game-result{display:grid;place-items:center;min-width:28px;height:25px;padding:0 7px;border:1px solid rgba(79,226,249,.24);border-radius:999px;color:#54e5fc;background:rgba(18,83,99,.24);font-size:.53rem;font-weight:1000}
      .rp-cv2-game-result.loss{border-color:rgba(255,124,139,.2);color:#ff9da9;background:rgba(97,22,34,.24)}
      .rp-cv2-game-score{display:block;margin-top:9px;color:#dcebf4;font-size:.57rem;font-weight:900}
      .rp-cv2-game-meta{display:block;min-height:1.2em;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#607d91;font-size:.42rem;font-weight:800}
      .rp-cv2-game-line{display:block;margin-top:9px;color:#8ba3b4;font-size:.48rem;font-weight:900;letter-spacing:.025em}
      .rp-cv2-game-hint{display:block;margin-top:8px;color:#3ccfe9;font-size:.41rem;font-weight:950;letter-spacing:.09em}
      .rp-cv2-game-snapshot{margin-top:10px;padding:13px;border:1px solid rgba(49,219,248,.18);border-radius:15px;background:radial-gradient(circle at 100% 0,rgba(49,219,248,.08),transparent 44%),#050e17}
      .rp-cv2-game-snapshot-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}
      .rp-cv2-game-snapshot-head strong{display:block;font-size:.66rem;font-weight:950}.rp-cv2-game-snapshot-head small{display:block;margin-top:4px;color:#617d91;font-size:.43rem;font-weight:800;line-height:1.45}
      .rp-cv2-game-snapshot-head b{color:#54e5fc;font-size:.65rem}.rp-cv2-game-snapshot-head b.loss{color:#ff9da9}
      .rp-cv2-game-snapshot-score{margin-top:10px;color:#dcebf4;font-size:.56rem;font-weight:950}
      .rp-cv2-game-snapshot-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}
      .rp-cv2-game-snapshot-stat{padding:9px 5px;border:1px solid rgba(103,163,192,.1);border-radius:11px;background:#040b12;text-align:center}
      .rp-cv2-game-snapshot-stat strong{display:block;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.95rem}.rp-cv2-game-snapshot-stat span{display:block;margin-top:3px;color:#607d91;font-size:.38rem;font-weight:950;letter-spacing:.08em}
      .rp-cv2-game-empty{padding:19px 12px;border:1px solid rgba(103,163,192,.11);border-radius:14px;background:#050e17;color:#607d91;text-align:center;font-size:.5rem;font-weight:850;letter-spacing:.04em}
      @media(max-width:640px){.rp-cv2-game-card{flex-basis:82%}.rp-cv2-game-snapshot-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function snapshotMarkup(game) {
    const result = resultOf(game);
    const resultClass = result === 'LOSS' ? 'loss' : '';
    const metrics = [
      ['PTS', stat(game, 'pts', 'points')],
      ['AST', stat(game, 'ast', 'assists')],
      ['REB', stat(game, 'reb', 'rebounds')],
      ['TO', stat(game, 'tov', 'to', 'turnovers')],
      ['STL', stat(game, 'stl', 'steals')],
      ['BLK', stat(game, 'blk', 'blocks')],
      ['FOUL', stat(game, 'foul', 'fouls')],
    ];
    return `
      <div class="rp-cv2-game-snapshot">
        <div class="rp-cv2-game-snapshot-head">
          <div><strong>${esc(gameLabel(game))}</strong><small>${esc(metaLine(game) || 'FINALIZED OFFICIAL GAME')}</small></div>
          <b class="${resultClass}">${esc(result)}</b>
        </div>
        <div class="rp-cv2-game-snapshot-score">${esc(scoreLine(game))}</div>
        <div class="rp-cv2-game-snapshot-stats">
          ${metrics.map(([label, value]) => `<div class="rp-cv2-game-snapshot-stat"><strong>${esc(value)}</strong><span>${label}</span></div>`).join('')}
        </div>
      </div>`;
  }

  function sectionMarkup(playerId, games, loading = false, error = '') {
    if (loading) {
      return `<div class="rp-cv2-section-title"><strong>LAST 5 GAMES</strong><span>LOADING HISTORY…</span></div><div class="rp-cv2-game-empty">LOADING RECENT OFFICIAL GAMES…</div>`;
    }
    if (error) {
      return `<div class="rp-cv2-section-title"><strong>LAST 5 GAMES</strong><span>RECENT HISTORY</span></div><div class="rp-cv2-game-empty">${esc(error)}</div>`;
    }
    if (!games.length) {
      return `<div class="rp-cv2-section-title"><strong>LAST 5 GAMES</strong><span>FINALIZED</span></div><div class="rp-cv2-game-empty">NO FINALIZED GAMES YET.</div>`;
    }

    const selected = selectedByPlayer.has(playerId) ? selectedByPlayer.get(playerId) : null;
    return `
      <div class="rp-cv2-section-title"><strong>LAST 5 GAMES</strong><span>${games.length} RECENT · TAP FOR SNAPSHOT</span></div>
      <div class="rp-cv2-recent-wrap">
        <div class="rp-cv2-recent-track" role="list" aria-label="Last ${games.length} games">
          ${games.map((game, index) => {
            const result = resultOf(game);
            const resultClass = result === 'LOSS' ? 'loss' : '';
            return `<button type="button" role="listitem" class="rp-cv2-game-card${selected === index ? ' active' : ''}" data-rp-cv2-recent-game="${index}" data-rp-cv2-player-id="${playerId}">
              <span class="rp-cv2-game-card-head"><strong>${esc(gameLabel(game))}</strong><b class="rp-cv2-game-result ${resultClass}">${esc(resultShort(game))}</b></span>
              <span class="rp-cv2-game-score">${esc(scoreLine(game))}</span>
              <span class="rp-cv2-game-meta">${esc(metaLine(game) || 'OFFICIAL FINALIZED GAME')}</span>
              <span class="rp-cv2-game-line">${stat(game, 'pts', 'points')} PTS · ${stat(game, 'ast', 'assists')} AST · ${stat(game, 'reb', 'rebounds')} REB</span>
              <span class="rp-cv2-game-hint">QUICK SNAPSHOT ›</span>
            </button>`;
          }).join('')}
        </div>
        ${selected !== null && games[selected] ? snapshotMarkup(games[selected]) : ''}
      </div>`;
  }

  function findNamedSection(focus, name) {
    return [...focus.querySelectorAll(':scope > .rp-cv2-section')].find((section) =>
      String(section.querySelector('.rp-cv2-section-title strong')?.textContent || '').trim().toUpperCase() === name
    ) || null;
  }

  function renderSection(section, playerId, state, games = [], error = '') {
    const selected = selectedByPlayer.has(playerId) ? selectedByPlayer.get(playerId) : 'none';
    const signature = `${playerId}:${state}:${games.length}:${selected}:${error}`;
    if (section.dataset.rpCv2Last5State === signature) return;
    section.dataset.rpCv2Last5State = signature;
    section.innerHTML = sectionMarkup(playerId, games, state === 'loading', error);
  }

  function patchViewer() {
    scheduled = false;
    installStyles();
    const viewer = document.querySelector('.rp-commentary-viewer-v2:not([hidden])');
    if (!viewer) return;
    const focus = viewer.querySelector('.rp-cv2-focus');
    if (!focus) return;

    const currentSection = findNamedSection(focus, 'CURRENT GAME') || focus.querySelector('[data-rp-cv2-last5-state]');
    if (!currentSection) return;

    const oldLastGame = findNamedSection(focus, 'LAST GAME');
    if (oldLastGame && !oldLastGame.hidden) oldLastGame.hidden = true;

    const playerId = playerIdFromViewer(viewer);
    if (!playerId) {
      renderSection(currentSection, 0, 'error', [], 'RECENT GAMES ARE AVAILABLE AFTER A PLAYER PROFILE IS LINKED.');
      return;
    }

    if (cache.has(playerId)) {
      renderSection(currentSection, playerId, 'ready', cache.get(playerId));
      return;
    }
    if (errors.has(playerId)) {
      renderSection(currentSection, playerId, 'error', [], errors.get(playerId));
      return;
    }

    renderSection(currentSection, playerId, 'loading');
    loadGames(playerId)
      .then(() => schedulePatch())
      .catch((error) => {
        const message = error?.message || 'COULD NOT LOAD RECENT GAMES.';
        errors.set(playerId, message);
        renderSection(currentSection, playerId, 'error', [], message);
        window.setTimeout(() => { errors.delete(playerId); schedulePatch(); }, 10000);
      });
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(patchViewer);
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-rp-cv2-recent-game]');
    if (!card) return;
    const playerId = Number(card.dataset.rpCv2PlayerId);
    const index = Number(card.dataset.rpCv2RecentGame);
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || !Number.isSafeInteger(index)) return;
    selectedByPlayer.set(playerId, index);
    const viewer = card.closest('.rp-commentary-viewer-v2');
    const focus = card.closest('.rp-cv2-focus');
    const section = focus?.querySelector('[data-rp-cv2-last5-state]') || (focus ? findNamedSection(focus, 'LAST 5 GAMES') : null);
    const games = cache.get(playerId) || [];
    if (section) {
      delete section.dataset.rpCv2Last5State;
      renderSection(section, playerId, 'ready', games);
      const active = section.querySelector(`[data-rp-cv2-recent-game="${index}"]`);
      active?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else if (viewer) {
      schedulePatch();
    }
  });

  const observer = new MutationObserver(schedulePatch);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:commentary-open', schedulePatch);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch, { once: true });
  else schedulePatch();
})();
