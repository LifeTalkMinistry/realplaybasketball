(() => {
  if (window.__realPlayReplayAdminEditInstalled) return;
  window.__realPlayReplayAdminEditInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STATS = [
    { key: 'ast', label: 'AST', aliases: ['ast', 'assist', 'assists'] },
    { key: 'reb', label: 'REB', aliases: ['reb', 'rebound', 'rebounds'] },
    { key: 'to', label: 'TO', aliases: ['to', 'tov', 'turnover', 'turnovers'] },
    { key: 'stl', label: 'STL', aliases: ['stl', 'steal', 'steals'] },
    { key: 'blk', label: 'BLK', aliases: ['blk', 'block', 'blocks'] },
    { key: 'foul', label: 'FOUL', aliases: ['foul', 'fouls'] },
  ];

  let currentSessionId = 0;
  let correctionActive = false;
  let reviewMode = false;
  let context = null;
  let draftEvents = [];
  let selectedPlayerId = null;
  let busy = false;
  let playheadMs = 0;
  let streamUrl = '';
  let youtubeId = '';
  let youtubePlayer = null;
  let mediaDurationMs = 0;
  let clockTimer = null;
  let notice = '';
  let noticeError = false;
  let lastAuditScoreTapId = '';
  let lastAuditScoreTapAt = 0;
  let activeAuditScoreCorrectionId = '';
  const AUDIT_SCORE_DOUBLE_TAP_MS = 430;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const adminVerified = () => window.__realPlayAdminVerified === true;
  const viewer = () => document.querySelector('[data-rp-career-replay].open');
  const adminRoot = () => document.querySelector('.rp-admin-control');
  const adminBody = () => adminRoot()?.querySelector('[data-admin-body]') || null;

  function correctionAuditState() {
    if (!correctionActive || !context?.session?.id) return null;
    return {
      active: true,
      sessionId: Number(context.session.id),
      recording: context.recording ? { ...context.recording, durationMs: effectiveMediaDurationMs() || context.recording.durationMs || null } : null,
      players: Array.isArray(context.players) ? context.players : [],
      events: draftEvents,
      moments: Array.isArray(context.moments) ? context.moments : [],
      participation: Array.isArray(context.participation) ? context.participation : [],
      currentVideoMs: currentVideoTimestamp(),
    };
  }

  window.__realPlayReplayCorrectionAuditState = correctionAuditState;

  function notifyCorrectionAuditState() {
    try {
      window.dispatchEvent(new CustomEvent('realplay:replay-correction-audit-state', {
        detail: { sessionId: Number(context?.session?.id || 0), active: Boolean(correctionActive) },
      }));
    } catch (_) {}
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function replayClockMs() {
    const text = String(viewer()?.querySelector('[data-rp-career-replay-clock]')?.textContent || '').split('/')[0].trim();
    const parts = text.split(':').map(Number);
    if (!text || parts.some((value) => !Number.isFinite(value))) return 0;
    if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
    return Math.round((parts[0] || 0) * 1000);
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function normalizeEvent(event, index) {
    return {
      localId: `event-${Number(event?.id || 0)}-${index}`,
      eventId: Number(event?.id || 0) || null,
      assistsScoreEventId: Number(event?.assistsScoreEventId ?? event?.assists_score_event_id ?? 0) || null,
      playerId: Number(event?.playerId ?? event?.player_id),
      eventType: String(event?.eventType ?? event?.event_type ?? '').toLowerCase(),
      statKey: event?.statKey ?? event?.stat_key ?? null,
      shotValue: event?.shotValue ?? event?.shot_value ?? null,
      shotResult: event?.shotResult ?? event?.shot_result ?? null,
      videoTimestampMs: Number(event?.videoTimestampMs ?? event?.video_timestamp_ms ?? 0),
    };
  }

  function playerById(playerId) {
    return (context?.players || []).find((player) => Number(player.playerId) === Number(playerId)) || null;
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function playersForTeam(team) {
    return (context?.players || []).filter((player) => String(player.team || '').toLowerCase() === team);
  }

  function teamDisplayName(team) {
    const side = String(team || '').trim().toLowerCase();
    const declared = side === 'east'
      ? context?.session?.eastTeamName
      : context?.session?.westTeamName;
    return String(declared || (side === 'east' ? 'EAST' : 'WEST')).trim().toUpperCase();
  }

  function playerEvents(playerId) {
    return draftEvents.filter((event) => Number(event.playerId) === Number(playerId));
  }

  function shotCount(playerId, value, result) {
    return playerEvents(playerId).filter((event) => event.eventType === 'shot'
      && Number(event.shotValue) === Number(value)
      && String(event.shotResult || '').toLowerCase() === result).length;
  }

  function statCount(playerId, stat) {
    const item = STATS.find((entry) => entry.key === stat);
    const aliases = item?.aliases || [stat];
    return playerEvents(playerId).filter((event) => event.eventType === 'stat'
      && aliases.includes(String(event.statKey || '').toLowerCase())).length;
  }

  function summaryForPlayer(playerId) {
    const onePtMade = shotCount(playerId, 1, 'make');
    const onePtMiss = shotCount(playerId, 1, 'miss');
    const twoPtMade = shotCount(playerId, 2, 'make');
    const twoPtMiss = shotCount(playerId, 2, 'miss');
    return {
      pts: onePtMade + twoPtMade * 2,
      ast: statCount(playerId, 'ast'),
      reb: statCount(playerId, 'reb'),
      tov: statCount(playerId, 'to'),
      stl: statCount(playerId, 'stl'),
      blk: statCount(playerId, 'blk'),
      foul: statCount(playerId, 'foul'),
      onePtMade,
      onePtMiss,
      twoPtMade,
      twoPtMiss,
    };
  }

  function teamScore(team) {
    return playersForTeam(team).reduce((total, player) => total + summaryForPlayer(player.playerId).pts, 0);
  }

  function currentVideoTimestamp() {
    if (youtubePlayer?.getCurrentTime) {
      const value = Number(youtubePlayer.getCurrentTime());
      if (Number.isFinite(value)) return Math.max(0, Math.round(value * 1000));
    }
    const video = adminBody()?.querySelector('[data-rp-recorded-video]');
    if (video) return Math.max(0, Math.round(Number(video.currentTime || 0) * 1000));
    return Math.max(0, Number(playheadMs || 0));
  }

  function rememberPlayhead() {
    playheadMs = currentVideoTimestamp();
  }

  function removeLatest(predicate) {
    for (let index = draftEvents.length - 1; index >= 0; index -= 1) {
      if (predicate(draftEvents[index])) {
        draftEvents.splice(index, 1);
        return true;
      }
    }
    return false;
  }


  function isMadeShotEvent(event) {
    return event?.eventType === 'shot' && String(event?.shotResult || '').toLowerCase() === 'make';
  }

  function isAssistEvent(event) {
    if (event?.eventType !== 'stat') return false;
    return ['ast', 'assist', 'assists'].includes(String(event?.statKey || '').toLowerCase());
  }

  function draftEventIndex(localId) {
    return draftEvents.findIndex((event) => String(event?.localId || '') === String(localId || ''));
  }

  function linkedAssistIndexForScore(scoreIndex) {
    const score = draftEvents[scoreIndex];
    if (!isMadeShotEvent(score)) return -1;

    const eventId = Number(score.eventId || 0);
    if (Number.isSafeInteger(eventId) && eventId > 0) {
      const linked = draftEvents.findIndex((event) => Number(event?.assistsScoreEventId || 0) === eventId);
      if (linked >= 0) return linked;
    }

    const next = draftEvents[scoreIndex + 1];
    if (!next) return -1;
    return isAssistEvent(next)
      && Number(next.videoTimestampMs || 0) === Number(score.videoTimestampMs || 0)
      ? scoreIndex + 1
      : -1;
  }

  function addShot(playerId, value, result) {
    const timestamp = currentVideoTimestamp();
    draftEvents.push({
      localId: `new-${Date.now()}-${Math.random()}`,
      eventId: null,
      assistsScoreEventId: null,
      playerId: Number(playerId),
      eventType: 'shot',
      statKey: null,
      shotValue: Number(value),
      shotResult: result,
      videoTimestampMs: timestamp,
    });
  }

  function addStat(playerId, stat) {
    draftEvents.push({
      localId: `new-${Date.now()}-${Math.random()}`,
      eventId: null,
      assistsScoreEventId: null,
      playerId: Number(playerId),
      eventType: 'stat',
      statKey: stat,
      shotValue: null,
      shotResult: null,
      videoTimestampMs: currentVideoTimestamp(),
    });
  }

  // Keep the Second-Pass Audit scorer structurally aligned with the live
  // recorded-scoring draft UI. The only important difference is initialization:
  // first-pass starts from a fresh/unfinished draft, while re-audit hydrates the
  // already-certified events into draftEvents as the assumed starting record.
  function shotCell(playerId, value, result, label) {
    const count = shotCount(playerId, value, result);
    return `<div class="rp-video-draft-shot" data-rp-draft-shot-cell="${value}:${result}">
      <button type="button" class="rp-video-draft-minus" data-rp-draft-remove-shot data-value="${value}" data-result="${result}" ${count ? '' : 'disabled'}>−</button>
      <button type="button" class="${result === 'make' ? 'make' : ''}" data-rp-video-shot data-value="${value}" data-result="${result}"><span>${label}</span><b data-rp-draft-shot-count>${count}</b></button>
    </div>`;
  }

  function statCell(playerId, stat, label) {
    const count = statCount(playerId, stat);
    return `<div class="rp-video-draft-stat" data-rp-draft-stat-cell="${stat}">
      <span>${label}</span>
      <div><button type="button" data-rp-draft-remove-stat="${stat}" ${count ? '' : 'disabled'}>−</button><strong data-rp-draft-stat-count>${count}</strong><button type="button" data-rp-video-stat="${stat}">+</button></div>
    </div>`;
  }

  function playerSummaryLine(stats) {
    return `${stats.pts} PTS · ${stats.ast} AST · ${stats.reb} REB · ${stats.stl} STL · ${stats.blk} BLK · ${stats.tov} TO · ${stats.foul} FOUL`;
  }

  function selectedPanelHtml(playerId = selectedPlayerId) {
    const player = playerById(playerId);
    if (!player) return '<div class="rp-video-select-prompt">SELECT A PLAYER TO SCORE AN EVENT</div>';
    const stats = summaryForPlayer(player.playerId);
    return `<section class="rp-video-player-panel rp-video-draft-panel" data-rp-draft-player-id="${Number(player.playerId)}">
      <div class="rp-video-player-panel-head"><div><small>${esc(teamDisplayName(player.team))} · LOCAL SCORE SHEET</small><strong>${esc(playerLabel(player))}</strong></div><button type="button" data-rp-video-close-player>×</button></div>
      <div class="rp-video-player-line">${playerSummaryLine(stats)}</div>
      <div class="rp-video-shot-grid rp-video-draft-shot-grid">
        ${shotCell(player.playerId, 1, 'miss', '1PT MISS')}
        ${shotCell(player.playerId, 1, 'make', '1PT MAKE')}
        ${shotCell(player.playerId, 2, 'miss', '2PT MISS')}
        ${shotCell(player.playerId, 2, 'make', '2PT MAKE')}
      </div>
      <div class="rp-video-draft-stat-grid">
        ${statCell(player.playerId, 'ast', 'AST')}
        ${statCell(player.playerId, 'reb', 'REB')}
        ${statCell(player.playerId, 'to', 'TO')}
        ${statCell(player.playerId, 'stl', 'STL')}
        ${statCell(player.playerId, 'blk', 'BLK')}
        ${statCell(player.playerId, 'foul', 'FOUL')}
      </div>
    </section>`;
  }

  function patchSelectedPanel(panel, playerId) {
    if (!panel) return;

    if (!playerId) {
      if (!panel.querySelector('.rp-video-select-prompt')) {
        panel.innerHTML = '<div class="rp-video-select-prompt">SELECT A PLAYER TO SCORE AN EVENT</div>';
      }
      return;
    }

    const current = panel.querySelector('.rp-video-draft-panel[data-rp-draft-player-id]');
    if (!current || Number(current.dataset.rpDraftPlayerId) !== Number(playerId)) {
      panel.innerHTML = selectedPanelHtml(playerId);
      return;
    }

    const player = playerById(playerId);
    const stats = summaryForPlayer(playerId);
    const line = current.querySelector('.rp-video-player-line');
    if (line) line.textContent = playerSummaryLine(stats);

    const headSmall = current.querySelector('.rp-video-player-panel-head small');
    const headName = current.querySelector('.rp-video-player-panel-head strong');
    if (headSmall && player) headSmall.textContent = `${teamDisplayName(player.team)} · LOCAL SCORE SHEET`;
    if (headName && player) headName.textContent = playerLabel(player);

    current.querySelectorAll('[data-rp-video-shot]').forEach((button) => {
      const value = Number(button.dataset.value || 0);
      const result = String(button.dataset.result || '');
      const count = shotCount(playerId, value, result);
      const cell = button.closest('.rp-video-draft-shot');
      const countNode = button.querySelector('[data-rp-draft-shot-count]') || button.querySelector('b');
      const minus = cell?.querySelector('[data-rp-draft-remove-shot]');
      if (countNode) countNode.textContent = String(count);
      if (minus) minus.disabled = count === 0;
    });

    current.querySelectorAll('[data-rp-video-stat]').forEach((button) => {
      const stat = String(button.dataset.rpVideoStat || '').toLowerCase();
      const count = statCount(playerId, stat);
      const cell = button.closest('.rp-video-draft-stat');
      const countNode = cell?.querySelector('[data-rp-draft-stat-count]') || cell?.querySelector('strong');
      const minus = cell?.querySelector('[data-rp-draft-remove-stat]');
      if (countNode) countNode.textContent = String(count);
      if (minus) minus.disabled = count === 0;
    });
  }

  function rosterHtml(team) {
    const players = playersForTeam(team);
    return `<section class="rp-video-score-team"><div class="rp-video-score-team-head"><strong>${esc(teamDisplayName(team))}</strong><span>${players.length}</span></div>${players.map((player) => `<button type="button" class="rp-video-score-player ${Number(selectedPlayerId) === Number(player.playerId) ? 'active' : ''}" data-rp-video-select-player="${Number(player.playerId)}">${esc(playerLabel(player))}</button>`).join('')}</section>`;
  }

  function auditMarkerCategory(event) {
    const type = String(event?.eventType || event?.momentKind || '').toLowerCase();
    if (type === 'highlight') return 'highlight';
    if (type === 'incident') return 'incident';
    if (type === 'shot') {
      return String(event?.shotResult || '').toLowerCase() === 'make' ? 'score' : 'miss';
    }
    if (type !== 'stat') return null;
    const key = String(event?.statKey || '').toLowerCase();
    if (['ast', 'assist', 'assists'].includes(key)) return 'ast';
    if (['reb', 'rebound', 'rebounds'].includes(key)) return 'reb';
    if (['to', 'tov', 'turnover', 'turnovers'].includes(key)) return 'to';
    if (['stl', 'steal', 'steals'].includes(key)) return 'stl';
    if (['blk', 'block', 'blocks'].includes(key)) return 'blk';
    if (['foul', 'fouls'].includes(key)) return 'foul';
    return null;
  }

  function auditMarkerText(category) {
    return {
      score: '🏀',
      miss: '×',
      ast: 'A',
      reb: 'R',
      to: 'TO',
      stl: 'S',
      blk: 'B',
      foul: 'F',
      highlight: '★',
      incident: '!',
    }[category] || '•';
  }

  function auditMarkerTitle(category) {
    return {
      score: 'Score',
      miss: 'Miss',
      ast: 'Assist',
      reb: 'Rebound',
      to: 'Turnover',
      stl: 'Steal',
      blk: 'Block',
      foul: 'Foul',
      highlight: 'Highlight',
      incident: 'Game Incident',
    }[category] || 'Audit event';
  }

  function auditFilter() {
    const value = String(window.__realPlayAuditStampFilter || 'all').toLowerCase();
    return ['all', 'score', 'miss', 'ast', 'reb', 'to', 'stl', 'blk', 'foul', 'highlight', 'incident'].includes(value)
      ? value
      : 'all';
  }

  function correctionTimelineEvents() {
    const moments = Array.isArray(context?.moments)
      ? context.moments.map((moment) => ({
          ...moment,
          eventType: moment?.eventType || moment?.momentKind || 'highlight',
        }))
      : [];
    return [...draftEvents, ...moments];
  }

  function effectiveMediaDurationMs() {
    const recorded = Number(context?.recording?.durationMs || 0);
    if (Number.isFinite(recorded) && recorded > 0) return Math.round(recorded);
    return Number.isFinite(mediaDurationMs) && mediaDurationMs > 0 ? Math.round(mediaDurationMs) : 0;
  }

  function adoptMediaDuration(value) {
    const next = Math.round(Number(value || 0));
    if (!Number.isSafeInteger(next) || next <= 0 || next === mediaDurationMs) return;
    mediaDurationMs = next;
    if (correctionActive && !reviewMode) patchScoringUI();
  }

  function markerButtons() {
    const duration = effectiveMediaDurationMs();
    if (!duration) return '';
    const filter = auditFilter();

    return correctionTimelineEvents()
      .map((event) => ({ event, category: auditMarkerCategory(event) }))
      .filter(({ category }) => category && (filter === 'all' || category === filter))
      .map(({ event, category }) => {
        const stamp = Math.max(0, Number(event?.videoTimestampMs || 0));
        const left = Math.max(0, Math.min(100, stamp / duration * 100));
        const replayStart = Number(event?.replayStartMs ?? (
          category === 'score' || category === 'highlight' || category === 'incident'
            ? Math.max(0, stamp - 7000)
            : Math.max(0, stamp - 5000)
        ));
        const editableScore = category === 'score' && event?.localId;
        const instruction = editableScore ? ' · Tap to replay; double-tap to correct score' : '';
        const title = auditMarkerTitle(category) + ' · Video ' + formatTime(stamp) + instruction;
        const eventAttr = editableScore ? ' data-rp-audit-score-event="' + esc(event.localId) + '"' : '';
        return '<button type="button" class="rp-video-marker rp-audit-stamp-marker" style="left:' + left + '%" data-rp-audit-category="' + category + '" data-rp-video-marker="' + replayStart + '"' + eventAttr + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + auditMarkerText(category) + '</button>';
      }).join('');
  }

  function markerKeyHtml() {
    const filter = auditFilter();
    const labels = {
      all: 'ALL STAMPS',
      score: 'SCORE',
      miss: 'MISS',
      ast: 'ASSIST',
      reb: 'REBOUND',
      to: 'TURNOVER',
      stl: 'STEAL',
      blk: 'BLOCK',
      foul: 'FOUL',
      highlight: 'HIGHLIGHT',
      incident: 'INCIDENT',
    };
    const count = correctionTimelineEvents()
      .map(auditMarkerCategory)
      .filter((category) => category && (filter === 'all' || category === filter))
      .length;
    return `<span>${count} ${labels[filter] || 'ALL STAMPS'} · AUDIT STAMPS</span><small>Tap a stamp to replay. Double-tap a 🏀 score stamp to correct it.</small>`;
  }


  function scoreCorrectionPlayerGroup(team, currentPlayerId) {
    const players = playersForTeam(team).filter((player) => Number(player.playerId) !== Number(currentPlayerId));
    if (!players.length) return '';
    const buttons = players.map((player) => (
      '<button type="button" data-rp-audit-reassign-score="' + Number(player.playerId) + '">' + esc(playerLabel(player)) + '</button>'
    )).join('');
    return '<section class="rp-audit-score-correction-team"><small>' + esc(teamDisplayName(team)) + '</small><div>' + buttons + '</div></section>';
  }

  function scoreCorrectionHtml(event) {
    const player = playerById(event?.playerId);
    const value = Number(event?.shotValue || 0);
    const timestamp = Number(event?.videoTimestampMs || 0);
    return '<div class="rp-audit-score-correction-overlay" data-rp-audit-score-correction role="dialog" aria-modal="true" aria-label="Correct score stamp">'
      + '<section class="rp-audit-score-correction-card">'
      + '<header><div><small>SECOND-PASS AUDIT</small><strong>CORRECT SCORE STAMP</strong></div><button type="button" data-rp-audit-score-correction-close aria-label="Close score correction">×</button></header>'
      + '<div class="rp-audit-score-correction-current"><small>SELECTED SCORE · VIDEO ' + formatTime(timestamp) + '</small><strong>' + value + 'PT MAKE</strong><span>Currently assigned to ' + esc(playerLabel(player)) + '</span></div>'
      + '<button type="button" class="rp-audit-score-remove" data-rp-audit-remove-score>REMOVE THIS SCORE</button>'
      + '<div class="rp-audit-score-correction-assign"><div><strong>ASSIGN TO ANOTHER PLAYER</strong><small>Choose the player who actually made this basket.</small></div>'
      + scoreCorrectionPlayerGroup('west', event?.playerId)
      + scoreCorrectionPlayerGroup('east', event?.playerId)
      + '</div>'
      + '<p>Working copy only. The official game changes only after REVIEW RE-AUDIT and final submit.</p>'
      + '</section></div>';
  }

  function closeScoreCorrection() {
    activeAuditScoreCorrectionId = '';
    adminBody()?.querySelector('[data-rp-audit-score-correction]')?.remove();
  }

  function openScoreCorrection(localId) {
    const index = draftEventIndex(localId);
    const event = index >= 0 ? draftEvents[index] : null;
    if (!isMadeShotEvent(event)) return false;

    // A score stamp and the player panel must visibly point to the same event.
    // Double-tapping an assumed score therefore selects the player currently
    // owning that basket before the correction sheet opens.
    selectedPlayerId = Number(event.playerId);
    patchScoringUI();
    closeScoreCorrection();
    const screen = adminBody()?.querySelector('[data-rp-replay-correction-mode]');
    if (!screen) return false;
    activeAuditScoreCorrectionId = String(localId);
    screen.insertAdjacentHTML('beforeend', scoreCorrectionHtml(event));
    screen.querySelector('[data-rp-audit-score-correction-close]')?.focus({ preventScroll: true });
    return true;
  }

  function removeScoreCorrection(localId) {
    const scoreIndex = draftEventIndex(localId);
    if (scoreIndex < 0 || !isMadeShotEvent(draftEvents[scoreIndex])) return false;
    const assistIndex = linkedAssistIndexForScore(scoreIndex);
    const indexes = [scoreIndex, assistIndex]
      .filter((value, index, all) => value >= 0 && all.indexOf(value) === index)
      .sort((a, b) => b - a);
    indexes.forEach((index) => draftEvents.splice(index, 1));
    closeScoreCorrection();
    patchScoringUI();
    return true;
  }

  function reassignScoreCorrection(localId, targetPlayerId) {
    const scoreIndex = draftEventIndex(localId);
    const score = scoreIndex >= 0 ? draftEvents[scoreIndex] : null;
    const target = playerById(targetPlayerId);
    if (!isMadeShotEvent(score) || !target) return false;

    const assistIndex = linkedAssistIndexForScore(scoreIndex);
    const assist = assistIndex >= 0 ? draftEvents[assistIndex] : null;
    score.playerId = Number(target.playerId);

    if (assist) {
      const assister = playerById(assist.playerId);
      const selfAssist = Number(assist.playerId) === Number(target.playerId);
      const crossTeamAssist = assister
        && String(assister.team || '').toLowerCase() !== String(target.team || '').toLowerCase();
      if (selfAssist || crossTeamAssist) {
        const currentAssistIndex = draftEvents.indexOf(assist);
        if (currentAssistIndex >= 0) draftEvents.splice(currentAssistIndex, 1);
      }
    }

    selectedPlayerId = Number(target.playerId);
    closeScoreCorrection();
    patchScoringUI();
    return true;
  }

  function videoPlayerHtml() {
    const media = youtubeId
      ? '<div class="rp-correction-youtube-host" data-rp-correction-youtube></div>'
      : streamUrl
        ? `<video data-rp-recorded-video src="${esc(streamUrl)}" controls playsinline preload="metadata"></video>`
        : '<div class="rp-video-player-unavailable">VIDEO STREAM IS PREPARING…</div>';
    return `<div class="rp-video-player-wrap">
      ${media}
      <div class="rp-video-timebar"><span>VIDEO TIME</span><strong data-rp-video-time>${formatTime(playheadMs)}</strong></div>
      <div class="rp-video-marker-rail"><i></i><div data-rp-replay-audit-markers>${markerButtons()}</div></div>
      <div class="rp-video-marker-key" data-rp-replay-audit-marker-key>${markerKeyHtml()}</div>
    </div>`;
  }

  function noticeHtml() {
    if (!notice) return '';
    return `<div class="rp-video-notice ${noticeError ? 'error' : 'success'}">${esc(notice)}</div>`;
  }

  function renderScoring() {
    if (!correctionActive || reviewMode || !context) return;
    const body = adminBody();
    if (!body) return;
    body.innerHTML = `<div class="rp-video-screen rp-video-scoring-screen" data-rp-replay-correction-mode>
      <div class="rp-admin-title"><span class="rp-admin-kicker">RECORDED SCORING</span><h1>WATCH &amp; SCORE</h1><p>Watch the full game continuously. Tap the event at the exact moment it happens.</p></div>
      ${noticeHtml()}
      ${videoPlayerHtml()}
      <div class="rp-video-auto-note"><strong>REVIEW LEAD-IN IS AUTOMATIC</strong><span>Every audited event has an exact video timestamp. Filter the stamps above, then tap one to replay the moment from just before it happens.</span></div>
      <div class="rp-video-scoreboard"><div><small>${esc(teamDisplayName('west'))}</small><strong data-rp-video-score-west>${teamScore('west')}</strong></div><span>—</span><div><small>${esc(teamDisplayName('east'))}</small><strong data-rp-video-score-east>${teamScore('east')}</strong></div></div>
      <div class="rp-video-score-rosters">${rosterHtml('west')}${rosterHtml('east')}</div>
      <div data-rp-video-selected-panel>${selectedPanelHtml()}</div>
      <div class="rp-video-draft-banner" data-rp-draft-banner="1"><div><strong>DRAFT SCORE SHEET</strong><span>${draftEvents.length} EVENTS</span></div><small>Nothing changes until VERIFY &amp; SUBMIT.</small></div>
      <div class="rp-video-review-actions">
        <button type="button" class="rp-video-undo" data-rp-video-undo ${draftEvents.length ? '' : 'disabled'}>UNDO LAST DRAFT EVENT</button>
        <button type="button" class="rp-video-finish" data-rp-video-finish>REVIEW SCORE SHEET</button>
      </div>
    </div>`;
    mountPlayback();
  }

  function patchScoringUI() {
    if (!correctionActive || reviewMode) return;
    const body = adminBody();
    if (!body) return;
    const west = body.querySelector('[data-rp-video-score-west]');
    const east = body.querySelector('[data-rp-video-score-east]');
    if (west) west.textContent = String(teamScore('west'));
    if (east) east.textContent = String(teamScore('east'));
    body.querySelectorAll('[data-rp-video-select-player]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.rpVideoSelectPlayer) === Number(selectedPlayerId));
    });
    const panel = body.querySelector('[data-rp-video-selected-panel]');
    patchSelectedPanel(panel, selectedPlayerId);
    const markers = body.querySelector('[data-rp-replay-audit-markers]');
    if (markers) markers.innerHTML = markerButtons();
    const markerKey = body.querySelector('[data-rp-replay-audit-marker-key]');
    if (markerKey) markerKey.innerHTML = markerKeyHtml();
    const undo = body.querySelector('[data-rp-video-undo]');
    if (undo) undo.disabled = draftEvents.length === 0;
    const banner = body.querySelector('.rp-video-draft-banner span');
    if (banner) banner.textContent = `${draftEvents.length} EVENTS`;
    notifyCorrectionAuditState();
  }

  function reviewPlayerRow(player) {
    const stats = summaryForPlayer(player.playerId);
    const shots = `${stats.onePtMade}/${stats.onePtMade + stats.onePtMiss} 1PT · ${stats.twoPtMade}/${stats.twoPtMade + stats.twoPtMiss} 2PT`;
    const participation = typeof window.__realPlayRecordedParticipationPayload === 'function'
      ? window.__realPlayRecordedParticipationPayload(context?.session?.id)
      : [];
    const didNotPlay = Array.isArray(participation)
      && participation.some((row) => Number(row?.playerId) === Number(player.playerId) && row?.didNotPlay === true);
    const status = didNotPlay ? 'DNP · DID NOT PLAY' : shots;
    return `<article class="rp-video-sheet-player ${didNotPlay ? 'rp-recap-dnp-player' : ''}"><div><strong>${esc(playerLabel(player))}</strong><small>${esc(status)}</small></div><div class="rp-video-sheet-line"><span>${stats.pts}<small>PTS</small></span><span>${stats.ast}<small>AST</small></span><span>${stats.reb}<small>REB</small></span><span>${stats.tov}<small>TO</small></span><span>${stats.stl}<small>STL</small></span><span>${stats.blk}<small>BLK</small></span><span>${stats.foul}<small>FOUL</small></span></div></article>`;
  }

  function reviewTeam(team) {
    return `<section class="rp-video-sheet-team"><header><strong>${esc(teamDisplayName(team))}</strong><b>${teamScore(team)}</b></header>${playersForTeam(team).map(reviewPlayerRow).join('')}</section>`;
  }

  function renderReview() {
    rememberPlayhead();
    destroyPlayback();
    reviewMode = true;
    const body = adminBody();
    if (!body) return;
    const made = draftEvents.filter((event) => event.eventType === 'shot' && event.shotResult === 'make').length;
    const moments = Array.isArray(context?.moments) ? context.moments : [];
    const highlights = moments.filter((event) => String(event?.momentKind || event?.eventType || '').toLowerCase() === 'highlight').length;
    const incidents = moments.filter((event) => String(event?.momentKind || event?.eventType || '').toLowerCase() === 'incident').length;
    body.innerHTML = `<div class="rp-video-screen rp-video-sheet-review" data-rp-replay-correction-mode>
      <div class="rp-admin-title"><span class="rp-admin-kicker">DRAFT SCORE SHEET</span><h1>REVIEW BEFORE SUBMIT</h1><p>Verify the corrected score sheet before it replaces the current official game stats.</p></div>
      ${noticeHtml()}
      <div class="rp-video-scoreboard"><div><small>${esc(teamDisplayName('west'))}</small><strong>${teamScore('west')}</strong></div><span>—</span><div><small>${esc(teamDisplayName('east'))}</small><strong>${teamScore('east')}</strong></div></div>
      <div class="rp-video-sheet-meta"><span>${draftEvents.length + moments.length}<small>TOTAL EVENTS</small></span><span>${made}<small>SCORING MARKERS</small></span><span>${draftEvents.filter((event) => event.eventType === 'stat').length}<small>STAT EVENTS</small></span><span>${highlights}<small>HIGHLIGHTS</small></span><span>${incidents}<small>INCIDENTS</small></span></div>
      <div class="rp-video-sheet-teams">${reviewTeam('west')}${reviewTeam('east')}</div>
      <div class="rp-video-auto-note"><strong>ONE OFFICIAL WRITE</strong><span>VERIFY &amp; SUBMIT replaces this game's official recorded score sheet in one transaction.</span></div>
      <div class="rp-video-sheet-actions"><button type="button" data-rp-draft-back ${busy ? 'disabled' : ''}>BACK TO SCORING</button><button type="button" data-rp-draft-submit ${busy ? 'disabled' : ''}>${busy ? 'SUBMITTING…' : 'VERIFY & SUBMIT'}</button></div>
    </div>`;
  }

  function ensureYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 6000) {
          clearInterval(timer);
          reject(new Error('YouTube player could not be loaded.'));
        }
      }, 80);
    });
  }

  function destroyPlayback() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    if (youtubePlayer) {
      try { youtubePlayer.destroy(); } catch (_) {}
      youtubePlayer = null;
    }
    const video = adminBody()?.querySelector('[data-rp-recorded-video]');
    try { video?.pause(); } catch (_) {}
  }

  async function mountPlayback() {
    const body = adminBody();
    if (!body || reviewMode || !correctionActive) return;
    const time = body.querySelector('[data-rp-video-time]');
    if (youtubeId) {
      const host = body.querySelector('[data-rp-correction-youtube]');
      if (!host) return;
      try {
        await ensureYouTubeApi();
        if (!correctionActive || reviewMode || !host.isConnected) return;
        youtubePlayer = new window.YT.Player(host, {
          videoId: youtubeId,
          playerVars: { controls: 1, playsinline: 1, rel: 0, start: Math.floor(playheadMs / 1000) },
          events: {
            onReady: (event) => {
              const durationSeconds = Number(event.target.getDuration?.());
              if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                adoptMediaDuration(durationSeconds * 1000);
              }
              if (playheadMs > 0) event.target.seekTo(playheadMs / 1000, true);
            },
          },
        });
        clockTimer = setInterval(() => {
          if (!youtubePlayer?.getCurrentTime) return;
          const seconds = Number(youtubePlayer.getCurrentTime());
          if (!Number.isFinite(seconds)) return;
          playheadMs = Math.round(seconds * 1000);
          if (time) time.textContent = formatTime(playheadMs);
        }, 250);
      } catch (_) {
        host.innerHTML = '<div class="rp-video-player-unavailable">YOUTUBE PLAYER IS UNAVAILABLE.</div>';
      }
      return;
    }

    const video = body.querySelector('[data-rp-recorded-video]');
    if (!video) return;
    const restore = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0) {
        adoptMediaDuration(duration * 1000);
        if (playheadMs > 0) video.currentTime = Math.min(duration, playheadMs / 1000);
      }
    };
    video.addEventListener('loadedmetadata', restore, { once: true });
    if (video.readyState >= 1) restore();
    video.addEventListener('timeupdate', () => {
      playheadMs = Math.round(Number(video.currentTime || 0) * 1000);
      if (time) time.textContent = formatTime(playheadMs);
    });
  }

  function seekPlayback(ms) {
    playheadMs = Math.max(0, Number(ms || 0));
    if (youtubePlayer?.seekTo) {
      youtubePlayer.seekTo(playheadMs / 1000, true);
      return;
    }
    const video = adminBody()?.querySelector('[data-rp-recorded-video]');
    if (video) video.currentTime = playheadMs / 1000;
  }

  async function prepareMedia() {
    const recording = context?.recording || {};
    const match = String(recording.originalName || '').match(/^YOUTUBE_([A-Za-z0-9_-]{11})\.mp4$/i);
    youtubeId = match?.[1] || '';
    streamUrl = '';
    if (youtubeId) return;
    const data = await api('/api/real-play/admin/recorded-scoring/stream-access', {
      method: 'POST',
      json: { session_id: Number(context.session.id) },
    });
    streamUrl = data?.stream_url ? `${API_BASE_URL}${data.stream_url}` : '';
  }

  function waitFor(selector, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const node = document.querySelector(selector);
        if (node) {
          clearInterval(timer);
          resolve(node);
        } else if (Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 60);
    });
  }

  async function openAdminDashboard() {
    if (window.__realPlayOpenAdminGameControl) {
      await window.__realPlayRefreshAdminGameControl?.();
      if (window.__realPlayOpenAdminGameControl()) return waitFor('.rp-admin-control.open [data-admin-body]');
    }

    window.dispatchEvent(new CustomEvent('realplay:settings-open'));
    const row = await waitFor('[data-rp-settings-action="admin"]', 3000);
    if (!row) throw new Error('Real Play Admin tools are not ready. Open Settings > Admin once and try again.');
    row.click();
    const body = await waitFor('.rp-admin-control.open [data-admin-body]', 6000);
    if (!body) throw new Error('Unable to open Real Play Game Control.');
    return body;
  }

  async function openExistingScorer(requestedSessionId = null) {
    const requested = Number(requestedSessionId || 0);
    if (Number.isSafeInteger(requested) && requested > 0) currentSessionId = requested;
    if (!currentSessionId || busy || !adminVerified()) return false;

    const sessionId = currentSessionId;
    playheadMs = replayClockMs();
    busy = true;
    let openedAdmin = false;

    try {
      const body = await openAdminDashboard();
      openedAdmin = true;

      body.innerHTML = '<div class="rp-video-screen"><div class="rp-video-loading">LOADING OFFICIAL SCORE SHEET…</div></div>';

      const nextContext = await api(`/api/real-play/admin/replay-corrections/${encodeURIComponent(sessionId)}`);
      const nextDraftEvents = (Array.isArray(nextContext.events) ? nextContext.events : []).map(normalizeEvent);

      context = nextContext;
      const storedDuration = Math.round(Number(context?.recording?.durationMs || 0));
      mediaDurationMs = Number.isSafeInteger(storedDuration) && storedDuration > 0 ? storedDuration : 0;
      // Re-audit uses the certified audit as assumed starting data, but player
      // selection behaves like the live scorer: nothing is implicitly selected.
      draftEvents = nextDraftEvents;
      selectedPlayerId = null;
      notice = '';
      noticeError = false;
      correctionActive = true;
      reviewMode = false;

      await prepareMedia();

      const root = adminRoot();
      root?.querySelectorAll('.rp-admin-tab').forEach((tab) => tab.classList.remove('active'));
      root?.querySelector('[data-rp-video-tab]')?.classList.add('active');

      renderScoring();
      notifyCorrectionAuditState();

      const scoring = body.querySelector('[data-rp-replay-correction-mode]');
      if (!scoring) throw new Error('Second-Pass Audit could not mount.');

      const closeReplay = viewer()?.querySelector('[data-rp-career-replay-close]');
      closeReplay?.click();
      return true;
    } catch (error) {
      console.error('[Real Play Replay Edit] Unable to open Second-Pass Audit.', error);
      correctionActive = false;
      reviewMode = false;
      context = null;
      mediaDurationMs = 0;
      draftEvents = [];
      selectedPlayerId = null;
      if (openedAdmin) adminRoot()?.querySelector('[data-admin-exit]')?.click();
      window.alert(error?.message || 'Unable to open the recorded scoring editor.');
      return false;
    } finally {
      busy = false;
    }
  }

  window.__realPlayOpenReplayCorrection = (sessionId) => openExistingScorer(sessionId);

  async function saveCorrection() {
    if (busy || !context?.session?.id) return;
    const west = teamScore('west');
    const east = teamScore('east');
    if (west === east) {
      notice = 'A finalized Career game cannot be saved as a tie.';
      noticeError = true;
      renderReview();
      return;
    }
    const westName = teamDisplayName('west');
    const eastName = teamDisplayName('east');
    if (!window.confirm(`Verify and submit this corrected score sheet? ${westName} ${west} – ${east} ${eastName}.`)) return;
    busy = true;
    renderReview();
    try {
      const ordered = draftEvents.map((event, index) => ({ ...event, submitOrder: index }))
        .sort((a, b) => Number(a.videoTimestampMs || 0) - Number(b.videoTimestampMs || 0) || a.submitOrder - b.submitOrder);
      const result = await api(`/api/real-play/admin/replay-corrections/${encodeURIComponent(context.session.id)}`, {
        method: 'POST',
        json: {
          events: ordered.map((event) => ({
            playerId: Number(event.playerId),
            eventType: event.eventType,
            statKey: event.statKey,
            shotValue: event.shotValue,
            shotResult: event.shotResult,
            videoTimestampMs: Number(event.videoTimestampMs || 0),
          })),
          participation: typeof window.__realPlayRecordedParticipationPayload === 'function'
            ? window.__realPlayRecordedParticipationPayload(context.session.id)
            : null,
        },
      });
      const id = Number(context.session.id);
      window.__realPlayRecordedParticipationClear?.(id);
      notice = `Official score sheet saved. ${teamDisplayName('west')} ${Number(result.westScore || 0)} – ${Number(result.eastScore || 0)} ${teamDisplayName('east')}.`;
      noticeError = false;
      busy = false;
      renderReview();
      setTimeout(() => {
        correctionActive = false;
        reviewMode = false;
        adminRoot()?.querySelector('[data-admin-exit]')?.click();
        const trigger = document.querySelector(`[data-rp-career-replay-session="${id}"]`);
        if (trigger) trigger.click();
        else window.location.reload();
      }, 650);
    } catch (error) {
      busy = false;
      notice = error.message || 'Unable to save the official score sheet.';
      noticeError = true;
      renderReview();
    }
  }

  function returnToReplay({ confirmDiscard = false } = {}) {
    if (!correctionActive) return false;
    const sessionId = Number(context?.session?.id || currentSessionId || 0);
    if (confirmDiscard && !window.confirm(
      'Cancel this re-audit?\n\nThe working changes will be discarded and the existing certified game record will stay unchanged.'
    )) return false;

    if (confirmDiscard) window.__realPlayRecordedParticipationClear?.(sessionId);
    deactivateCorrection();
    adminRoot()?.querySelector('[data-admin-exit]')?.click();

    window.setTimeout(() => {
      const trigger = document.querySelector(`[data-rp-career-replay-session="${sessionId}"]`);
      if (trigger) trigger.click();
      else window.location.reload();
    }, 80);
    return true;
  }

  function deactivateCorrection() {
    if (!correctionActive) return;
    rememberPlayhead();
    destroyPlayback();
    correctionActive = false;
    reviewMode = false;
    context = null;
    mediaDurationMs = 0;
    draftEvents = [];
    selectedPlayerId = null;
    notice = '';
    noticeError = false;
    activeAuditScoreCorrectionId = '';
    lastAuditScoreTapId = '';
    lastAuditScoreTapAt = 0;
    notifyCorrectionAuditState();
  }

  document.addEventListener('click', (event) => {
    if (!correctionActive) return;
    const target = event.target;

    if (target.closest('[data-admin-exit], [data-admin-tab], [data-rp-video-tab]')) {
      deactivateCorrection();
      return;
    }

    const root = adminRoot();
    if (!root?.contains(target)) return;

    const exitScoring = target.closest('[data-rp-exit-scoring]');
    const cancelAudit = target.closest('[data-rp-cancel-audit]');
    const select = target.closest('[data-rp-video-select-player]');
    const closePlayer = target.closest('[data-rp-video-close-player]');
    const shot = target.closest('[data-rp-video-shot]');
    const stat = target.closest('[data-rp-video-stat]');
    const minusShot = target.closest('[data-rp-draft-remove-shot]');
    const minusStat = target.closest('[data-rp-draft-remove-stat]');
    const undo = target.closest('[data-rp-video-undo]');
    const finish = target.closest('[data-rp-video-finish]');
    const back = target.closest('[data-rp-draft-back]');
    const submit = target.closest('[data-rp-draft-submit]');
    const marker = target.closest('[data-rp-video-marker]');
    const closeScoreCorrectionButton = target.closest('[data-rp-audit-score-correction-close]');
    const removeScoreCorrectionButton = target.closest('[data-rp-audit-remove-score]');
    const reassignScoreCorrectionButton = target.closest('[data-rp-audit-reassign-score]');
    if (!(exitScoring || cancelAudit || select || closePlayer || shot || stat || minusShot || minusStat || undo || finish || back || submit || marker || closeScoreCorrectionButton || removeScoreCorrectionButton || reassignScoreCorrectionButton)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (cancelAudit) {
      returnToReplay({ confirmDiscard: true });
      return;
    }
    if (exitScoring) {
      returnToReplay();
      return;
    }
    if (closeScoreCorrectionButton) {
      closeScoreCorrection();
      return;
    }
    if (removeScoreCorrectionButton) {
      removeScoreCorrection(activeAuditScoreCorrectionId);
      return;
    }
    if (reassignScoreCorrectionButton) {
      reassignScoreCorrection(activeAuditScoreCorrectionId, Number(reassignScoreCorrectionButton.dataset.rpAuditReassignScore || 0));
      return;
    }
    if (select) {
      selectedPlayerId = Number(select.dataset.rpVideoSelectPlayer);
      patchScoringUI();
      return;
    }
    if (closePlayer) {
      selectedPlayerId = null;
      patchScoringUI();
      return;
    }
    if (marker) {
      const localId = String(marker.dataset.rpAuditScoreEvent || '');
      const now = Date.now();
      const doubleTap = Boolean(localId) && localId === lastAuditScoreTapId && now - lastAuditScoreTapAt <= AUDIT_SCORE_DOUBLE_TAP_MS;
      if (doubleTap) {
        lastAuditScoreTapId = '';
        lastAuditScoreTapAt = 0;
        openScoreCorrection(localId);
        return;
      }
      lastAuditScoreTapId = localId;
      lastAuditScoreTapAt = localId ? now : 0;
      seekPlayback(Number(marker.dataset.rpVideoMarker || 0));
      return;
    }
    if (finish) {
      renderReview();
      return;
    }
    if (back) {
      reviewMode = false;
      renderScoring();
      return;
    }
    if (submit) {
      saveCorrection();
      return;
    }
    if (!selectedPlayerId || reviewMode || busy) return;

    if (shot) {
      addShot(selectedPlayerId, Number(shot.dataset.value), String(shot.dataset.result || ''));
      patchScoringUI();
      return;
    }
    if (stat) {
      addStat(selectedPlayerId, String(stat.dataset.rpVideoStat || '').toLowerCase());
      patchScoringUI();
      return;
    }
    if (minusShot) {
      removeLatest((item) => Number(item.playerId) === Number(selectedPlayerId)
        && item.eventType === 'shot'
        && Number(item.shotValue) === Number(minusShot.dataset.value)
        && String(item.shotResult || '') === String(minusShot.dataset.result || ''));
      patchScoringUI();
      return;
    }
    if (minusStat) {
      const key = String(minusStat.dataset.rpDraftRemoveStat || '').toLowerCase();
      const aliases = STATS.find((item) => item.key === key)?.aliases || [key];
      removeLatest((item) => Number(item.playerId) === Number(selectedPlayerId)
        && item.eventType === 'stat'
        && aliases.includes(String(item.statKey || '').toLowerCase()));
      patchScoringUI();
      return;
    }
    if (undo && draftEvents.length) {
      draftEvents.pop();
      patchScoringUI();
    }
  }, true);

  const pencilSvg = () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19.6 8.6a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Zm11-13 2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function syncPencil() {
    const root = viewer();
    if (!root) return;
    const replaySessionId = Number(root.dataset.rpCareerReplayActiveSession || 0);
    if (Number.isSafeInteger(replaySessionId) && replaySessionId > 0) {
      currentSessionId = replaySessionId;
    }
    const topbar = root.querySelector('.rp-career-replay-topbar');
    if (!topbar) return;
    let button = topbar.querySelector('[data-rp-replay-admin-edit]');
    const shouldShow = adminVerified() && currentSessionId > 0;
    if (!shouldShow) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-replay-admin-edit';
      button.dataset.rpReplayAdminEdit = '1';
      button.setAttribute('aria-label', 'Edit official game stats');
      button.innerHTML = pencilSvg();
      topbar.appendChild(button);
      button.addEventListener('click', openExistingScorer);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{width:38px;height:38px;display:grid;place-items:center;justify-self:end;border:1px solid rgba(85,197,229,.22);border-radius:11px;background:#061722;color:#a7edf6;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.2)}
    .rp-replay-admin-edit:hover{border-color:rgba(85,224,245,.5);background:#082331;color:#d9fbff}.rp-replay-admin-edit:active{transform:scale(.96)}.rp-replay-admin-edit svg{width:17px;height:17px}
    .rp-correction-youtube-host{width:100%;aspect-ratio:16/9;background:#000;overflow:hidden;border-radius:inherit}.rp-correction-youtube-host iframe{display:block;width:100%!important;height:100%!important;border:0}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-career-replay-session]');
    if (!trigger) return;
    const id = Number(trigger.dataset.rpCareerReplaySession || 0);
    if (Number.isSafeInteger(id) && id > 0) {
      currentSessionId = id;
      setTimeout(syncPencil, 120);
    }
  }, true);

  const observer = new MutationObserver(() => {
    syncPencil();
    if (correctionActive && !reviewMode) {
      const body = adminBody();
      if (body && !body.querySelector('[data-rp-replay-correction-mode]')) renderScoring();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setInterval(syncPencil, 700);

  window.addEventListener('realplay:audit-stamp-filter-change', () => {
    if (correctionActive && !reviewMode) patchScoringUI();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    currentSessionId = 0;
    deactivateCorrection();
    syncPencil();
  });
})();