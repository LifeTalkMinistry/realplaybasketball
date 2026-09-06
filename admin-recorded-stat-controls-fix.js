(() => {
  if (window.__realPlayRecordedStatControlsFixInstalled) return;
  window.__realPlayRecordedStatControlsFixInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_VERSION = 2;

  let cachedContext = null;
  let mutationQueue = Promise.resolve();

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return adminRoot()?.querySelector('[data-admin-body] .rp-video-scoring-screen') || null;
  }

  function activePlayerId() {
    const button = scoringScreen()?.querySelector('.rp-video-score-player.active[data-rp-video-select-player]');
    const id = Number(button?.dataset.rpVideoSelectPlayer || 0);
    return Number.isSafeInteger(id) && id !== 0 ? id : null;
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
      replayStartMs: eventType === 'shot' && String(event.shotResult || '').toLowerCase() === 'make'
        ? Number(event.replayStartMs ?? Math.max(0, Number(event.videoTimestampMs || 0) - 5000))
        : null,
    };
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseClockLabel(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 3) return Math.max(0, Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000));
    if (parts.length === 2) return Math.max(0, Math.round((parts[0] * 60 + parts[1]) * 1000));
    return Math.max(0, Math.round(parts[0] * 1000));
  }

  function videoTimestampMs() {
    const screen = scoringScreen();
    const video = screen?.querySelector('[data-rp-recorded-video]');
    const seconds = Number(video?.currentTime);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    return parseClockLabel(screen?.querySelector('[data-rp-video-time]')?.textContent);
  }

  async function api(path) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function draftKey(sessionId, uploadedAt) {
    return `rp-recorded-score-sheet:v${DRAFT_VERSION}:${Number(sessionId)}:${String(uploadedAt || 'video')}`;
  }

  async function resolveContext() {
    if (cachedContext?.key && localStorage.getItem(cachedContext.key)) return cachedContext;

    const controlData = await api('/api/real-play/admin/career/control');
    const control = controlData?.control || null;
    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId || control?.session?.scoringAuthority !== 'video') {
      throw new Error('Recorded scoring is not active for this game.');
    }

    const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
    const recording = state?.recording || null;
    if (!recording?.reviewStartedAt || recording?.reviewCompletedAt) {
      throw new Error('Recorded score sheet is not open.');
    }

    const key = draftKey(sessionId, recording.uploadedAt);
    if (!localStorage.getItem(key)) {
      const events = (Array.isArray(state?.events) ? state.events : []).map(normalizeServerEvent).filter(Boolean);
      localStorage.setItem(key, JSON.stringify({
        version: DRAFT_VERSION,
        sessionId,
        uploadedAt: recording.uploadedAt || null,
        updatedAt: new Date().toISOString(),
        events,
      }));
    }

    cachedContext = { key, sessionId, uploadedAt: recording.uploadedAt || null };
    return cachedContext;
  }

  function readDraft(context) {
    const parsed = JSON.parse(localStorage.getItem(context.key) || 'null');
    if (!parsed || parsed.version !== DRAFT_VERSION || Number(parsed.sessionId) !== Number(context.sessionId)) {
      throw new Error('Recorded score sheet could not be recovered.');
    }
    parsed.events = Array.isArray(parsed.events) ? parsed.events : [];
    return parsed;
  }

  function publishDraft(context, draft) {
    draft.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(draft);
    localStorage.setItem(context.key, serialized);

    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: context.key,
        newValue: serialized,
        storageArea: localStorage,
      }));
    } catch (_) {
      const fallback = new Event('storage');
      Object.defineProperties(fallback, {
        key: { value: context.key },
        newValue: { value: serialized },
      });
      window.dispatchEvent(fallback);
    }

    window.dispatchEvent(new CustomEvent('realplay:admin-render', { detail: { source: 'recorded-stat-controls-fix' } }));
  }

  function statAliases(stat) {
    return {
      ast: ['ast', 'assists'],
      reb: ['reb', 'rebounds'],
      to: ['to', 'tov', 'turnovers'],
      stl: ['stl', 'steal', 'steals'],
      blk: ['blk', 'block', 'blocks'],
      foul: ['foul', 'fouls'],
    }[stat] || [stat];
  }

  async function mutateStat(playerId, stat, delta) {
    const context = await resolveContext();
    const draft = readDraft(context);
    const key = String(stat || '').toLowerCase();

    if (delta > 0) {
      draft.events.push({
        localId: makeId(),
        playerId: Number(playerId),
        eventType: 'stat',
        statKey: key,
        shotValue: null,
        shotResult: null,
        videoTimestampMs: videoTimestampMs(),
        replayStartMs: null,
      });
    } else {
      const aliases = statAliases(key);
      for (let index = draft.events.length - 1; index >= 0; index -= 1) {
        const event = draft.events[index];
        if (Number(event.playerId) === Number(playerId)
          && String(event.eventType || '').toLowerCase() === 'stat'
          && aliases.includes(String(event.statKey || '').toLowerCase())) {
          draft.events.splice(index, 1);
          break;
        }
      }
    }

    publishDraft(context, draft);
  }

  function queueMutation(playerId, stat, delta) {
    mutationQueue = mutationQueue
      .then(() => mutateStat(playerId, stat, delta))
      .catch((error) => {
        console.error('[Real Play] Recorded stat control failed.', error);
        cachedContext = null;
      });
  }

  document.addEventListener('click', (event) => {
    const screen = scoringScreen();
    if (!screen || !screen.contains(event.target)) return;

    const plus = event.target.closest('.rp-video-draft-panel [data-rp-video-stat]');
    const minus = event.target.closest('.rp-video-draft-panel [data-rp-draft-remove-stat]');
    const button = plus || minus;
    if (!button || button.disabled) return;

    const playerId = activePlayerId();
    if (!playerId) return;

    const stat = plus
      ? String(plus.dataset.rpVideoStat || '').toLowerCase()
      : String(minus.dataset.rpDraftRemoveStat || '').toLowerCase();
    if (!stat) return;

    // Own only the six local recorded-score-sheet stat buttons. This runs
    // before the older delegated scorer listeners and prevents a visible tap
    // from becoming a no-op or falling through to the retired per-event path.
    event.preventDefault();
    event.stopImmediatePropagation();
    queueMutation(playerId, stat, plus ? 1 : -1);
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    if (!scoringScreen()) cachedContext = null;
  });
})();
