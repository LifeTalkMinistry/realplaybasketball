(() => {
  if (window.__realPlayRecordedDraftGuardInstalled) return;
  window.__realPlayRecordedDraftGuardInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_PREFIX = 'rp-recorded-score-sheet:v2:';
  const selector = '[data-rp-video-shot], [data-rp-video-stat], [data-rp-video-undo], [data-rp-video-finish]';

  let retrying = false;
  let fallbackBusy = false;
  let fallbackContext = null;

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

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function replayTarget(original) {
    const screen = scoringScreen();
    if (!screen) return null;
    if (original.matches('[data-rp-video-shot]')) {
      return screen.querySelector(`[data-rp-video-shot][data-value="${original.dataset.value}"][data-result="${original.dataset.result}"]`);
    }
    if (original.matches('[data-rp-video-stat]')) {
      return screen.querySelector(`[data-rp-video-stat="${original.dataset.rpVideoStat}"]`);
    }
    if (original.matches('[data-rp-video-undo]')) return screen.querySelector('[data-rp-video-undo]');
    if (original.matches('[data-rp-video-finish]')) return screen.querySelector('[data-rp-video-finish]');
    return null;
  }

  function draftStorageKey(sessionId, uploadedAt) {
    return `${DRAFT_PREFIX}${Number(sessionId)}:${String(uploadedAt || 'video')}`;
  }

  function readDraft(key, sessionId) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed || Number(parsed.sessionId) !== Number(sessionId) || !Array.isArray(parsed.events)) return null;
      return parsed.events;
    } catch (_) {
      return null;
    }
  }

  function emptyStats() {
    return {
      pts: 0, ast: 0, reb: 0, tov: 0, stl: 0, blk: 0, foul: 0,
      onePtMade: 0, onePtMiss: 0, twoPtMade: 0, twoPtMiss: 0,
    };
  }

  function summarize(events, playerId) {
    const stats = emptyStats();
    for (const event of events) {
      if (Number(event?.playerId) !== Number(playerId)) continue;
      const type = String(event?.eventType || '').toLowerCase();
      if (type === 'shot') {
        const value = Number(event?.shotValue || 0);
        const made = String(event?.shotResult || '').toLowerCase() === 'make';
        if (made) stats.pts += value;
        if (value === 1 && made) stats.onePtMade += 1;
        if (value === 1 && !made) stats.onePtMiss += 1;
        if (value === 2 && made) stats.twoPtMade += 1;
        if (value === 2 && !made) stats.twoPtMiss += 1;
        continue;
      }
      if (type !== 'stat') continue;
      const key = String(event?.statKey || '').toLowerCase();
      if (['ast', 'assist', 'assists'].includes(key)) stats.ast += 1;
      else if (['reb', 'rebound', 'rebounds'].includes(key)) stats.reb += 1;
      else if (['to', 'tov', 'turnover', 'turnovers'].includes(key)) stats.tov += 1;
      else if (['stl', 'steal', 'steals'].includes(key)) stats.stl += 1;
      else if (['blk', 'block', 'blocks'].includes(key)) stats.blk += 1;
      else if (['foul', 'fouls'].includes(key)) stats.foul += 1;
    }
    return stats;
  }

  function playingPlayers(control, team = null) {
    return (control?.players || []).filter((player) => {
      if (!player?.checkedIn || !player?.team) return false;
      return team ? String(player.team).toLowerCase() === team : true;
    });
  }

  function teamScore(control, events, team) {
    return playingPlayers(control, team).reduce((total, player) => total + summarize(events, player.userId).pts, 0);
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function playerRow(player, events) {
    const stats = summarize(events, player.userId);
    const oneAttempts = stats.onePtMade + stats.onePtMiss;
    const twoAttempts = stats.twoPtMade + stats.twoPtMiss;
    return `<article class="rp-video-sheet-player">
      <div><strong>${esc(playerLabel(player))}</strong><small>${stats.onePtMade}/${oneAttempts} 1PT · ${stats.twoPtMade}/${twoAttempts} 2PT</small></div>
      <div class="rp-video-sheet-line"><span>${stats.pts}<small>PTS</small></span><span>${stats.ast}<small>AST</small></span><span>${stats.reb}<small>REB</small></span><span>${stats.tov}<small>TO</small></span><span>${stats.stl}<small>STL</small></span><span>${stats.blk}<small>BLK</small></span><span>${stats.foul}<small>FOUL</small></span></div>
    </article>`;
  }

  function teamSection(control, events, team) {
    const players = playingPlayers(control, team);
    return `<section class="rp-video-sheet-team"><header><strong>${team.toUpperCase()}</strong><b>${teamScore(control, events, team)}</b></header>${players.map((player) => playerRow(player, events)).join('')}</section>`;
  }

  function renderFallbackReview(message = '', isError = false) {
    if (!fallbackContext) return;
    const adminBody = body();
    if (!adminBody) return;
    const { control, events } = fallbackContext;
    const west = teamScore(control, events, 'west');
    const east = teamScore(control, events, 'east');
    const made = events.filter((event) => String(event?.eventType || '').toLowerCase() === 'shot' && String(event?.shotResult || '').toLowerCase() === 'make').length;
    const statEvents = events.filter((event) => String(event?.eventType || '').toLowerCase() === 'stat').length;

    adminBody.innerHTML = `<div class="rp-video-screen rp-video-sheet-review">
      <div class="rp-admin-title"><span class="rp-admin-kicker">DRAFT RECOVERY</span><h1>REVIEW BEFORE SUBMIT</h1><p>Your local score sheet was recovered. Nothing becomes official until you verify and submit it.</p></div>
      ${message ? `<div class="rp-video-notice ${isError ? 'error' : 'success'}">${esc(message)}</div>` : ''}
      <div class="rp-video-scoreboard"><div><small>WEST</small><strong>${west}</strong></div><span>—</span><div><small>EAST</small><strong>${east}</strong></div></div>
      <div class="rp-video-sheet-meta"><span>${events.length}<small>TOTAL EVENTS</small></span><span>${made}<small>SCORING MARKERS</small></span><span>${statEvents}<small>STAT EVENTS</small></span></div>
      <div class="rp-video-sheet-teams">${teamSection(control, events, 'west')}${teamSection(control, events, 'east')}</div>
      <div class="rp-video-auto-note"><strong>RECOVERED LOCAL DRAFT</strong><span>VERIFY &amp; SUBMIT sends this full recovered score sheet to Real Play in one official write. The old FINISH SCORING path is blocked.</span></div>
      <div class="rp-video-sheet-actions">
        <button type="button" data-rp-fallback-back ${fallbackBusy ? 'disabled' : ''}>BACK TO SCORING</button>
        <button type="button" data-rp-fallback-submit ${fallbackBusy ? 'disabled' : ''}>${fallbackBusy ? 'SUBMITTING…' : 'VERIFY & SUBMIT'}</button>
      </div>
    </div>`;
  }

  async function loadFallbackContext() {
    const controlData = await api('/api/real-play/admin/career/control');
    const control = controlData?.control || null;
    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId) throw new Error('There is no active recorded game to submit.');
    if (String(control?.session?.scoringAuthority || '').toLowerCase() !== 'video') {
      throw new Error('This game is not using recorded-video scoring authority.');
    }

    const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
    const recording = state?.recording || null;
    if (!recording) throw new Error('The recorded game could not be loaded.');

    const key = draftStorageKey(sessionId, recording.uploadedAt);
    const events = readDraft(key, sessionId);
    if (events === null) {
      throw new Error('The draft score sheet is still loading or is not available on this device. Re-open VIDEO and try again. No official stats were changed.');
    }

    fallbackContext = { control, recording, events, key, sessionId };
    return fallbackContext;
  }

  async function openFallbackReview() {
    if (fallbackBusy) return;
    fallbackBusy = true;
    try {
      await loadFallbackContext();
      fallbackBusy = false;
      renderFallbackReview();
    } catch (error) {
      fallbackBusy = false;
      window.alert(error?.message || 'Could not recover the draft score sheet.');
    }
  }

  async function submitFallbackDraft() {
    if (fallbackBusy || !fallbackContext) return;
    if (!window.confirm('Verify and submit this recovered score sheet as the official recorded-game stats?')) return;

    fallbackBusy = true;
    renderFallbackReview();
    try {
      const { sessionId, recording, events, key } = fallbackContext;
      const result = await api('/api/real-play/admin/recorded-scoring/submit-draft', {
        method: 'POST',
        json: {
          session_id: Number(sessionId),
          duration_ms: recording?.durationMs ?? null,
          events: events.map((event) => ({
            playerId: Number(event.playerId),
            eventType: event.eventType,
            statKey: event.statKey ?? null,
            shotValue: event.shotValue ?? null,
            shotResult: event.shotResult ?? null,
            videoTimestampMs: Number(event.videoTimestampMs || 0),
          })),
        },
      });

      try { localStorage.removeItem(key); } catch (_) {}
      window.__realPlayRecordedScoringDraftActive = false;
      fallbackBusy = false;
      fallbackContext = null;
      await window.__realPlayRefreshAdminGameControl?.();
      const finalize = root()?.querySelector('[data-admin-tab="finalize"]');
      if (finalize) finalize.click();
      else window.alert(`Recorded score sheet verified: WEST ${Number(result?.westScore || 0)} – ${Number(result?.eastScore || 0)} EAST.`);
    } catch (error) {
      fallbackBusy = false;
      renderFallbackReview(error?.message || 'Could not submit the recorded score sheet.', true);
    }
  }

  function retryUntilDraftReady(original, onTimeout = null) {
    if (retrying) return;
    retrying = true;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.__realPlayRecordedScoringDraftActive) {
        window.clearInterval(timer);
        retrying = false;
        const next = replayTarget(original);
        next?.click();
        return;
      }
      if (attempts >= 30 || !scoringScreen()) {
        window.clearInterval(timer);
        retrying = false;
        if (typeof onTimeout === 'function') onTimeout();
      }
    }, 50);
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const back = event.target.closest('[data-rp-fallback-back]');
    if (back) {
      event.preventDefault();
      event.stopImmediatePropagation();
      fallbackContext = null;
      adminRoot.querySelector('[data-rp-video-tab]')?.click();
      return;
    }

    const submit = event.target.closest('[data-rp-fallback-submit]');
    if (submit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitFallbackDraft();
      return;
    }

    const target = event.target.closest(selector);
    if (!target || !scoringScreen() || window.__realPlayRecordedScoringDraftActive) return;

    // Fail closed while the local draft scorer is booting. Never let a click
    // fall through to the retired per-event/complete-review scorer.
    event.preventDefault();
    event.stopImmediatePropagation();

    if (target.matches('[data-rp-video-finish]')) {
      retryUntilDraftReady(target, openFallbackReview);
      return;
    }

    retryUntilDraftReady(target, () => {
      window.alert('The draft score sheet is still loading. Your tap was not sent to the old scorer. Please try again in a moment.');
    });
  }, true);
})();
