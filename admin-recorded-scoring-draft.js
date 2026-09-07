(() => {
  if (window.__realPlayRecordedDraftInstalled) return;
  window.__realPlayRecordedDraftInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_VERSION = 2;

  let active = false;
  let loading = false;
  let reviewMode = false;
  let submitting = false;
  let control = { session: null, players: [] };
  let recording = null;
  let draftEvents = [];
  let storageKey = '';
  let recoveryAnnounced = false;
  let detectTimer = null;
  let activeScreen = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function scoringScreen() {
    return body()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
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

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function playerById(playerId) {
    return (control.players || []).find((player) => Number(player.userId) === Number(playerId)) || null;
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function playingPlayers(team = null) {
    return (control.players || []).filter((player) => {
      if (!player.checkedIn || !player.team) return false;
      return team ? String(player.team).toLowerCase() === team : true;
    });
  }

  function normalizeServerEvent(event) {
    const eventType = String(event?.eventType || '').toLowerCase();
    if (!['shot', 'stat'].includes(eventType)) return null;
    return {
      localId: `server-${Number(event.id || 0)}-${makeId()}`,
      playerId: Number(event.playerId),
      eventType,
      statKey: eventType === 'stat' ? String(event.statKey || '').toLowerCase() : null,
      shotValue: eventType === 'shot' ? Number(event.shotValue) : null,
      shotResult: eventType === 'shot' ? String(event.shotResult || '').toLowerCase() : null,
      videoTimestampMs: Number(event.videoTimestampMs || 0),
      replayStartMs: eventType === 'shot' && String(event.shotResult) === 'make'
        ? Number(event.replayStartMs ?? Math.max(0, Number(event.videoTimestampMs || 0) - 5000))
        : null,
    };
  }

  function draftKey(sessionId, uploadedAt) {
    return `rp-recorded-score-sheet:v${DRAFT_VERSION}:${Number(sessionId)}:${String(uploadedAt || 'video')}`;
  }

  function saveDraft() {
    if (!storageKey || !control.session?.id || !recording) return;
    const payload = {
      version: DRAFT_VERSION,
      sessionId: Number(control.session.id),
      uploadedAt: recording.uploadedAt || null,
      updatedAt: new Date().toISOString(),
      events: draftEvents,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {
      // Scoring still works if browser storage is unavailable; it simply loses
      // crash recovery for this device.
    }
  }

  function loadLocalDraft() {
    if (!storageKey) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!parsed || parsed.version !== DRAFT_VERSION || Number(parsed.sessionId) !== Number(control.session?.id)) return null;
      return Array.isArray(parsed.events) ? parsed.events : [];
    } catch (_) {
      return null;
    }
  }

  function clearDraft() {
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch (_) {}
    }
    draftEvents = [];
  }

  function activePlayerId() {
    const button = scoringScreen()?.querySelector('.rp-video-score-player.active[data-rp-video-select-player]');
    const id = Number(button?.dataset.rpVideoSelectPlayer || 0);
    return Number.isSafeInteger(id) && id !== 0 ? id : null;
  }

  function videoTimestamp() {
    const video = scoringScreen()?.querySelector('[data-rp-recorded-video]');
    if (!video) throw new Error('Game video is not ready.');
    return Math.max(0, Math.round(Number(video.currentTime || 0) * 1000));
  }

  function summaryForPlayer(playerId) {
    const summary = {
      pts: 0,
      ast: 0,
      reb: 0,
      tov: 0,
      stl: 0,
      blk: 0,
      foul: 0,
      make: 0,
      miss: 0,
      onePtMade: 0,
      onePtMiss: 0,
      twoPtMade: 0,
      twoPtMiss: 0,
    };

    for (const event of draftEvents) {
      if (Number(event.playerId) !== Number(playerId)) continue;
      if (event.eventType === 'shot') {
        const made = event.shotResult === 'make';
        if (made) {
          summary.make += 1;
          summary.pts += Number(event.shotValue || 0);
          if (Number(event.shotValue) === 1) summary.onePtMade += 1;
          if (Number(event.shotValue) === 2) summary.twoPtMade += 1;
        } else {
          summary.miss += 1;
          if (Number(event.shotValue) === 1) summary.onePtMiss += 1;
          if (Number(event.shotValue) === 2) summary.twoPtMiss += 1;
        }
      } else if (event.eventType === 'stat') {
        const key = String(event.statKey || '').toLowerCase();
        if (['ast', 'assists'].includes(key)) summary.ast += 1;
        else if (['reb', 'rebounds'].includes(key)) summary.reb += 1;
        else if (['to', 'tov', 'turnovers'].includes(key)) summary.tov += 1;
        else if (['stl', 'steal', 'steals'].includes(key)) summary.stl += 1;
        else if (['blk', 'block', 'blocks'].includes(key)) summary.blk += 1;
        else if (['foul', 'fouls'].includes(key)) summary.foul += 1;
      }
    }
    return summary;
  }

  function teamScore(team) {
    return playingPlayers(team).reduce((total, player) => total + summaryForPlayer(player.userId).pts, 0);
  }

  function statCount(playerId, stat) {
    const key = String(stat || '').toLowerCase();
    const summary = summaryForPlayer(playerId);
    if (['ast', 'assists'].includes(key)) return summary.ast;
    if (['reb', 'rebounds'].includes(key)) return summary.reb;
    if (['to', 'tov', 'turnovers'].includes(key)) return summary.tov;
    if (['stl', 'steal', 'steals'].includes(key)) return summary.stl;
    if (['blk', 'block', 'blocks'].includes(key)) return summary.blk;
    if (['foul', 'fouls'].includes(key)) return summary.foul;
    return 0;
  }

  function shotCount(playerId, value, result) {
    return draftEvents.filter((event) => (
      Number(event.playerId) === Number(playerId)
      && event.eventType === 'shot'
      && Number(event.shotValue) === Number(value)
      && event.shotResult === result
    )).length;
  }

  function removeLatest(predicate) {
    for (let index = draftEvents.length - 1; index >= 0; index -= 1) {
      if (predicate(draftEvents[index])) {
        draftEvents.splice(index, 1);
        saveDraft();
        patchScoringUI();
        return true;
      }
    }
    return false;
  }

  function addShot(playerId, shotValue, shotResult) {
    const timestamp = videoTimestamp();
    draftEvents.push({
      localId: makeId(),
      playerId: Number(playerId),
      eventType: 'shot',
      statKey: null,
      shotValue: Number(shotValue),
      shotResult,
      videoTimestampMs: timestamp,
      replayStartMs: shotResult === 'make' ? Math.max(0, timestamp - 5000) : null,
    });
    saveDraft();
    patchScoringUI();
  }

  function addStat(playerId, statKey) {
    draftEvents.push({
      localId: makeId(),
      playerId: Number(playerId),
      eventType: 'stat',
      statKey: String(statKey || '').toLowerCase(),
      shotValue: null,
      shotResult: null,
      videoTimestampMs: videoTimestamp(),
      replayStartMs: null,
    });
    saveDraft();
    patchScoringUI();
  }

  function markerHtml() {
    const duration = Number(recording?.durationMs || 0);
    if (!duration) return '';
    return draftEvents
      .filter((event) => event.eventType === 'shot' && event.shotResult === 'make')
      .map((event) => {
        const left = Math.max(0, Math.min(100, Number(event.videoTimestampMs || 0) / duration * 100));
        const replay = Number(event.replayStartMs ?? Math.max(0, Number(event.videoTimestampMs || 0) - 5000));
        return `<button type="button" class="rp-video-marker" style="left:${left}%" data-rp-video-marker="${replay}" title="${Number(event.shotValue)}PT make at ${formatTime(event.videoTimestampMs)}">🏀</button>`;
      }).join('');
  }

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

  function selectedPanelHtml(playerId) {
    const player = playerById(playerId);
    if (!player) return '<div class="rp-video-select-prompt">SELECT A PLAYER TO SCORE AN EVENT</div>';
    const stats = summaryForPlayer(playerId);
    return `<section class="rp-video-player-panel rp-video-draft-panel" data-rp-draft-player-id="${Number(playerId)}">
      <div class="rp-video-player-panel-head"><div><small>${esc(String(player.team || '').toUpperCase())} · LOCAL SCORE SHEET</small><strong>${esc(playerLabel(player))}</strong></div><button type="button" data-rp-video-close-player>×</button></div>
      <div class="rp-video-player-line">${playerSummaryLine(stats)}</div>
      <div class="rp-video-shot-grid rp-video-draft-shot-grid">
        ${shotCell(playerId, 1, 'miss', '1PT MISS')}
        ${shotCell(playerId, 1, 'make', '1PT MAKE')}
        ${shotCell(playerId, 2, 'miss', '2PT MISS')}
        ${shotCell(playerId, 2, 'make', '2PT MAKE')}
      </div>
      <div class="rp-video-draft-stat-grid">
        ${statCell(playerId, 'ast', 'AST')}
        ${statCell(playerId, 'reb', 'REB')}
        ${statCell(playerId, 'to', 'TO')}
        ${statCell(playerId, 'stl', 'STL')}
        ${statCell(playerId, 'blk', 'BLK')}
        ${statCell(playerId, 'foul', 'FOUL')}
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
    if (headSmall && player) headSmall.textContent = `${String(player.team || '').toUpperCase()} · LOCAL SCORE SHEET`;
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

  function ensureDraftBanner() {
    const screen = scoringScreen();
    if (!screen) return null;
    let banner = screen.querySelector('[data-rp-draft-banner]');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'rp-video-draft-banner';
      banner.dataset.rpDraftBanner = '1';
      const auto = screen.querySelector('.rp-video-auto-note');
      if (auto) auto.insertAdjacentElement('afterend', banner);
      else screen.prepend(banner);
    }
    return banner;
  }

  function patchScoringUI() {
    if (!active || reviewMode) return;
    const screen = scoringScreen();
    if (!screen) return;

    const west = screen.querySelector('[data-rp-video-score-west]');
    const east = screen.querySelector('[data-rp-video-score-east]');
    if (west) west.textContent = String(teamScore('west'));
    if (east) east.textContent = String(teamScore('east'));

    const markers = screen.querySelector('[data-rp-video-markers]');
    if (markers) {
      const nextMarkers = markerHtml();
      if (markers.innerHTML !== nextMarkers) markers.innerHTML = nextMarkers;
    }

    const selected = activePlayerId();
    patchSelectedPanel(screen.querySelector('[data-rp-video-selected-panel]'), selected);

    const banner = ensureDraftBanner();
    if (banner) {
      const nextBanner = `<div><strong>DRAFT SCORE SHEET</strong><span>${draftEvents.length} EVENTS · SAVED ON THIS DEVICE</span></div><small>Nothing is official until VERIFY &amp; SUBMIT.</small>`;
      if (banner.innerHTML !== nextBanner) banner.innerHTML = nextBanner;
    }

    const finish = screen.querySelector('[data-rp-video-finish]');
    if (finish) finish.textContent = 'REVIEW SCORE SHEET';
    const undo = screen.querySelector('[data-rp-video-undo]');
    if (undo) {
      undo.textContent = 'UNDO LAST DRAFT EVENT';
      undo.disabled = draftEvents.length === 0;
    }
  }

  function reviewPlayerRow(player) {
    const stats = summaryForPlayer(player.userId);
    const shots = `${stats.onePtMade}/${stats.onePtMade + stats.onePtMiss} 1PT · ${stats.twoPtMade}/${stats.twoPtMade + stats.twoPtMiss} 2PT`;
    return `<article class="rp-video-sheet-player">
      <div><strong>${esc(playerLabel(player))}</strong><small>${shots}</small></div>
      <div class="rp-video-sheet-line"><span>${stats.pts}<small>PTS</small></span><span>${stats.ast}<small>AST</small></span><span>${stats.reb}<small>REB</small></span><span>${stats.tov}<small>TO</small></span><span>${stats.stl}<small>STL</small></span><span>${stats.blk}<small>BLK</small></span><span>${stats.foul}<small>FOUL</small></span></div>
    </article>`;
  }

  function reviewTeam(team) {
    const players = playingPlayers(team);
    return `<section class="rp-video-sheet-team"><header><strong>${team.toUpperCase()}</strong><b>${teamScore(team)}</b></header>${players.map(reviewPlayerRow).join('')}</section>`;
  }

  function showReview(message = '', error = false) {
    if (!active) return;
    reviewMode = true;
    const adminBody = body();
    if (!adminBody) return;
    const made = draftEvents.filter((event) => event.eventType === 'shot' && event.shotResult === 'make').length;
    adminBody.innerHTML = `<div class="rp-video-screen rp-video-sheet-review">
      <div class="rp-admin-title"><span class="rp-admin-kicker">DRAFT SCORE SHEET</span><h1>REVIEW BEFORE SUBMIT</h1><p>These numbers are still local. Verify them before they become the official game record.</p></div>
      ${message ? `<div class="rp-video-notice ${error ? 'error' : 'success'}">${esc(message)}</div>` : ''}
      <div class="rp-video-scoreboard"><div><small>WEST</small><strong>${teamScore('west')}</strong></div><span>—</span><div><small>EAST</small><strong>${teamScore('east')}</strong></div></div>
      <div class="rp-video-sheet-meta"><span>${draftEvents.length}<small>TOTAL EVENTS</small></span><span>${made}<small>SCORING MARKERS</small></span><span>${draftEvents.filter((event) => event.eventType === 'stat').length}<small>STAT EVENTS</small></span></div>
      <div class="rp-video-sheet-teams">${reviewTeam('west')}${reviewTeam('east')}</div>
      <div class="rp-video-auto-note"><strong>ONE OFFICIAL WRITE</strong><span>VERIFY &amp; SUBMIT sends this complete sheet to Real Play in one transaction. Until then, you can go back and change anything.</span></div>
      <div class="rp-video-sheet-actions">
        <button type="button" data-rp-draft-back ${submitting ? 'disabled' : ''}>BACK TO SCORING</button>
        <button type="button" data-rp-draft-submit ${submitting ? 'disabled' : ''}>${submitting ? 'SUBMITTING…' : 'VERIFY & SUBMIT'}</button>
      </div>
    </div>`;
  }

  async function submitDraft() {
    if (submitting || !active || !control.session?.id) return;
    if (!window.confirm('Verify and submit this score sheet as the official recorded-game stats?')) return;
    submitting = true;
    showReview();
    try {
      const result = await api('/api/real-play/admin/recorded-scoring/submit-draft', {
        method: 'POST',
        json: {
          session_id: Number(control.session.id),
          duration_ms: recording?.durationMs ?? null,
          events: draftEvents.map((event) => ({
            playerId: Number(event.playerId),
            eventType: event.eventType,
            statKey: event.statKey,
            shotValue: event.shotValue,
            shotResult: event.shotResult,
            videoTimestampMs: Number(event.videoTimestampMs || 0),
          })),
        },
      });
      clearDraft();
      active = false;
      activeScreen = null;
      reviewMode = false;
      window.__realPlayRecordedScoringDraftActive = false;
      submitting = false;
      await window.__realPlayRefreshAdminGameControl?.();
      const finalize = root()?.querySelector('[data-admin-tab="finalize"]');
      if (finalize) finalize.click();
      else window.alert(`Recorded score sheet verified: WEST ${Number(result.westScore || 0)} – ${Number(result.eastScore || 0)} EAST.`);
    } catch (error) {
      submitting = false;
      showReview(error.message || 'Could not submit the recorded score sheet.', true);
    }
  }

  function restoreScoring() {
    reviewMode = false;
    activeScreen = null;
    const tab = root()?.querySelector('[data-rp-video-tab]');
    if (tab) tab.click();
  }

  async function activateForCurrentScreen() {
    const screenAtStart = scoringScreen();
    if (loading || reviewMode || !screenAtStart) return;
    if (active && activeScreen === screenAtStart) return;

    loading = true;
    try {
      const controlData = await api('/api/real-play/admin/career/control');
      const nextControl = controlData?.control || { session: null, players: [] };
      const sessionId = Number(nextControl?.session?.id || 0);
      if (!sessionId || nextControl?.session?.scoringAuthority !== 'video') {
        active = false;
        activeScreen = null;
        window.__realPlayRecordedScoringDraftActive = false;
        return;
      }
      const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
      if (!state?.recording?.reviewStartedAt || state?.recording?.reviewCompletedAt) {
        active = false;
        activeScreen = null;
        window.__realPlayRecordedScoringDraftActive = false;
        return;
      }

      const previousKey = storageKey;
      control = nextControl;
      recording = state.recording;
      storageKey = draftKey(sessionId, recording.uploadedAt);

      if (!active || previousKey !== storageKey) {
        const local = loadLocalDraft();
        if (local !== null) {
          draftEvents = local;
          if (draftEvents.length && !recoveryAnnounced) {
            recoveryAnnounced = true;
            setTimeout(() => {
              const banner = ensureDraftBanner();
              if (banner) banner.classList.add('recovered');
            }, 0);
          }
        } else {
          draftEvents = (Array.isArray(state.events) ? state.events : [])
            .map(normalizeServerEvent)
            .filter(Boolean);
          saveDraft();
        }
      }

      const currentScreen = scoringScreen();
      if (!currentScreen) {
        active = false;
        activeScreen = null;
        window.__realPlayRecordedScoringDraftActive = false;
        return;
      }

      active = true;
      activeScreen = currentScreen;
      window.__realPlayRecordedScoringDraftActive = true;
      patchScoringUI();
    } catch (error) {
      console.error('[Real Play] Unable to activate local recorded score sheet.', error);
    } finally {
      loading = false;
    }
  }

  function scheduleDetect() {
    if (detectTimer) clearTimeout(detectTimer);
    detectTimer = setTimeout(() => {
      if (reviewMode) return;

      const screen = scoringScreen();
      if (screen) {
        // DOM mutations inside an already-active scorer must never trigger
        // another backend activation or rebuild. Only a genuinely new scoring
        // screen (for example after changing tabs and coming back) reactivates.
        if (!active || screen !== activeScreen) activateForCurrentScreen();
        return;
      }

      if (active) {
        active = false;
        activeScreen = null;
        window.__realPlayRecordedScoringDraftActive = false;
      }
    }, 40);
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    if (event.target.closest('[data-rp-draft-back]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreScoring();
      return;
    }

    if (event.target.closest('[data-rp-draft-submit]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitDraft();
      return;
    }

    if (!active || reviewMode || !scoringScreen()) return;

    const shot = event.target.closest('[data-rp-video-shot]');
    if (shot) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const playerId = activePlayerId();
      if (playerId) addShot(playerId, Number(shot.dataset.value), String(shot.dataset.result || ''));
      return;
    }

    const stat = event.target.closest('[data-rp-video-stat]');
    if (stat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const playerId = activePlayerId();
      if (playerId) addStat(playerId, stat.dataset.rpVideoStat);
      return;
    }

    const minusShot = event.target.closest('[data-rp-draft-remove-shot]');
    if (minusShot) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const playerId = activePlayerId();
      if (playerId) {
        removeLatest((item) => Number(item.playerId) === playerId
          && item.eventType === 'shot'
          && Number(item.shotValue) === Number(minusShot.dataset.value)
          && item.shotResult === minusShot.dataset.result);
      }
      return;
    }

    const minusStat = event.target.closest('[data-rp-draft-remove-stat]');
    if (minusStat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const playerId = activePlayerId();
      const target = String(minusStat.dataset.rpDraftRemoveStat || '').toLowerCase();
      const equivalents = {
        ast: ['ast', 'assists'],
        reb: ['reb', 'rebounds'],
        to: ['to', 'tov', 'turnovers'],
        stl: ['stl', 'steal', 'steals'],
        blk: ['blk', 'block', 'blocks'],
        foul: ['foul', 'fouls'],
      }[target] || [target];
      if (playerId) removeLatest((item) => Number(item.playerId) === playerId && item.eventType === 'stat' && equivalents.includes(String(item.statKey || '').toLowerCase()));
      return;
    }

    if (event.target.closest('[data-rp-video-undo]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (draftEvents.length) {
        draftEvents.pop();
        saveDraft();
        patchScoringUI();
      }
      return;
    }

    if (event.target.closest('[data-rp-video-finish]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showReview();
      return;
    }

    if (event.target.closest('[data-rp-video-select-player], [data-rp-video-close-player]')) {
      setTimeout(patchScoringUI, 0);
    }
  }, true);

  window.addEventListener('storage', (event) => {
    if (!active || event.key !== storageKey || !event.newValue) return;
    const local = loadLocalDraft();
    if (local !== null) {
      draftEvents = local;
      patchScoringUI();
    }
  });

  const observer = new MutationObserver(scheduleDetect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', scheduleDetect);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleDetect, { once: true });
  else scheduleDetect();
})();
