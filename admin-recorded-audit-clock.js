(() => {
  if (window.__realPlayRecordedAuditClockInstalled) return;
  window.__realPlayRecordedAuditClockInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DEFAULT_DURATION_MS = 15 * 60 * 1000;

  let sessionId = 0;
  let recording = null;
  let loading = false;
  let saving = false;
  let refreshTimer = null;
  let tickTimer = null;
  let screenRef = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function correctionAuditState() {
    const scoring = screen();
    if (!scoring?.matches?.('[data-rp-replay-correction-mode]')) return null;
    try {
      const state = window.__realPlayReplayCorrectionAuditState?.();
      return state?.active ? state : null;
    } catch (_) {
      return null;
    }
  }

  function activeRecording() {
    return correctionAuditState()?.recording || recording;
  }

  function media() {
    return screen()?.querySelector('[data-rp-recorded-video]') || null;
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

  function formatTime(ms, tenths = false) {
    const value = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.floor(value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (!tenths) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    const tenth = Math.floor((value % 1000) / 100);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenth}`;
  }

  function anchorMs() {
    const value = Number(activeRecording()?.auditClockEndVideoMs);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function durationMs() {
    const value = Number(activeRecording()?.auditClockDurationMs || DEFAULT_DURATION_MS);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_DURATION_MS;
  }

  function currentVideoMs() {
    const correction = correctionAuditState();
    const correctionMs = Number(correction?.currentVideoMs);
    if (Number.isFinite(correctionMs) && correctionMs >= 0) {
      return Math.max(0, Math.round(correctionMs));
    }

    const node = media();
    if (!node) return 0;
    return Math.max(0, Math.round(Number(node.currentTime || 0) * 1000));
  }

  function clockState(videoMs = currentVideoMs()) {
    const end = anchorMs();
    const duration = durationMs();
    if (end === null) {
      return { remainingMs: duration, phase: 'unsynced', anchored: false };
    }
    const raw = end - Number(videoMs || 0);
    if (raw > duration) return { remainingMs: duration, phase: 'before', anchored: true };
    if (raw < 0) return { remainingMs: 0, phase: 'after', anchored: true };
    return { remainingMs: Math.max(0, Math.min(duration, Math.round(raw))), phase: 'game', anchored: true };
  }

  function clockLabel(videoMs) {
    const state = clockState(videoMs);
    return state.anchored ? formatTime(state.remainingMs) : null;
  }

  window.__realPlayAuditClockRemainingMs = (videoMs) => {
    const state = clockState(videoMs);
    return state.anchored ? state.remainingMs : null;
  };
  window.__realPlayAuditClockLabel = clockLabel;

  function clockStatus(state) {
    if (!state.anchored) return 'UNSYNCED';
    if (state.phase === 'before') return 'BEFORE START';
    if (state.phase === 'after') return 'AFTER END';
    return 'END-SYNCED';
  }

  function ensureScoreClock(scoring) {
    const scoreboard = scoring?.querySelector('.rp-video-scoreboard');
    const center = scoreboard?.querySelector(':scope > span');
    if (!center) return null;
    center.classList.add('rp-audit-clock-center');
    center.dataset.rpAuditClockCenter = '1';
    if (!center.querySelector('[data-rp-audit-clock-value]')) {
      center.innerHTML = '<small>AUDIT CLOCK</small><strong data-rp-audit-clock-value>15:00</strong><em data-rp-audit-clock-phase>UNSYNCED</em>';
    }
    return center;
  }

  function ensureSyncControl(scoring) {
    const wrap = scoring?.querySelector('.rp-video-player-wrap');
    if (!wrap) return null;
    let node = wrap.querySelector('[data-rp-audit-clock-sync]');
    if (!node) {
      node = document.createElement('section');
      node.className = 'rp-audit-clock-sync';
      node.dataset.rpAuditClockSync = '1';
      const timebar = wrap.querySelector('.rp-video-timebar');
      if (timebar) timebar.insertAdjacentElement('afterend', node);
      else wrap.prepend(node);
    }
    return node;
  }

  function render() {
    const scoring = screen();
    if (!scoring) return;

    const state = clockState();
    const center = ensureScoreClock(scoring);
    if (center) {
      const value = center.querySelector('[data-rp-audit-clock-value]');
      const phase = center.querySelector('[data-rp-audit-clock-phase]');
      if (value) value.textContent = formatTime(state.remainingMs);
      if (phase) phase.textContent = clockStatus(state);
      center.classList.toggle('synced', state.anchored);
      center.classList.toggle('before', state.phase === 'before');
      center.classList.toggle('after', state.phase === 'after');
    }

    const control = ensureSyncControl(scoring);
    if (!control) return;
    const end = anchorMs();
    const current = currentVideoMs();
    const correction = correctionAuditState();
    const recordingState = activeRecording();
    const signature = [
      end ?? 'none',
      current,
      saving ? 1 : 0,
      recordingState?.auditClockSetAt || '',
      correction?.sessionId || 0,
    ].join(':');
    if (control.dataset.rpAuditClockSignature === signature) return;
    control.dataset.rpAuditClockSignature = signature;

    const correctionControl = correction
      ? `<button type="button" disabled>${end === null ? 'NO SAVED GAME-END ANCHOR' : 'ORIGINAL AUDIT ANCHOR'}</button>`
      : `<button type="button" data-rp-audit-clock-set ${saving ? 'disabled' : ''}>${saving ? 'SAVING…' : end === null ? 'SET CURRENT FRAME = 0:00' : 'RE-SET GAME END'}</button>`;

    control.innerHTML = `
      <div class="rp-audit-clock-sync-copy">
        <span>END-ANCHOR SYNC · 15:00 AUDIT WINDOW</span>
        <strong>${end === null ? (correction ? 'This game has no saved Audit Clock end anchor.' : 'Find the exact final frame, then set it as 0:00.') : `GAME END · VIDEO ${formatTime(end, true)} → 0:00`}</strong>
        <small>${end === null ? `Current video frame: ${formatTime(current, true)}` : correction ? 'Using this finalized game’s original saved Audit Clock anchor during the second-pass audit.' : 'Raw video timestamps remain unchanged. This clock is derived backward from the saved end anchor.'}</small>
      </div>
      ${correctionControl}
    `;
  }

  async function refreshState() {
    if (!screen() || loading) return;

    const correction = correctionAuditState();
    if (correction) {
      sessionId = Number(correction.sessionId || 0);
      recording = correction.recording || null;
      render();
      return;
    }

    loading = true;
    try {
      const controlData = await api('/api/real-play/admin/career/control');
      const nextSessionId = Number(controlData?.control?.session?.id || 0);
      if (!Number.isSafeInteger(nextSessionId) || nextSessionId < 1) {
        sessionId = 0;
        recording = null;
        render();
        return;
      }
      const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(nextSessionId)}`);
      sessionId = nextSessionId;
      recording = state?.recording || null;
      render();
    } catch (_) {
      // During staggered frontend/backend deployment, keep Audit usable and
      // simply leave the clock unsynced until the server exposes the anchor.
      render();
    } finally {
      loading = false;
    }
  }

  async function saveAnchor(button) {
    if (saving) return;
    const scoring = screen();
    const node = media();
    if (!scoring || !node) return;

    try { node.pause?.(); } catch (_) {}
    const endVideoMs = currentVideoMs();
    const existing = anchorMs();
    if (existing !== null && Math.abs(existing - endVideoMs) > 250) {
      const confirmed = window.confirm(
        `Move the saved game end from video ${formatTime(existing, true)} to ${formatTime(endVideoMs, true)}?\n\nThe 15:00 Audit Clock will be recalculated backward from the new 0:00 anchor.`
      );
      if (!confirmed) return;
    }

    saving = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'SAVING…';
    }

    try {
      const data = await api('/api/real-play/admin/recorded-scoring/audit-clock-anchor', {
        method: 'POST',
        json: {
          session_id: sessionId,
          end_video_ms: endVideoMs,
          duration_ms: DEFAULT_DURATION_MS,
        },
      });
      recording = data?.recording || recording;
      render();
      try {
        window.dispatchEvent(new CustomEvent('realplay:audit-clock-anchor', {
          detail: { sessionId, endVideoMs, durationMs: DEFAULT_DURATION_MS },
        }));
      } catch (_) {}
    } catch (error) {
      window.alert(error?.message || 'Could not save the Audit Clock game-end anchor.');
    } finally {
      saving = false;
      render();
    }
  }

  function bindMedia(scoring) {
    const node = scoring?.querySelector('[data-rp-recorded-video]');
    if (!node || node.dataset.rpAuditClockBound === '1') return;
    node.dataset.rpAuditClockBound = '1';
    ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'play', 'pause'].forEach((name) => {
      node.addEventListener(name, render);
    });
  }

  function tick() {
    const scoring = screen();
    if (!scoring) {
      screenRef = null;
      return;
    }
    if (scoring !== screenRef) {
      screenRef = scoring;
      sessionId = 0;
      recording = null;
      refreshState();
    }
    bindMedia(scoring);
    render();
  }

  function scheduleRefresh(delay = 40) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      tick();
      refreshState();
    }, delay);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-audit-clock-set]');
    if (!button || !screen()?.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveAnchor(button);
  }, true);

  window.addEventListener('realplay:admin-render', () => scheduleRefresh(0));
  window.addEventListener('realplay:replay-correction-audit-state', () => scheduleRefresh(0));
  window.addEventListener('realplay:recorded-scoring-cancelled', () => {
    sessionId = 0;
    recording = null;
    scheduleRefresh(0);
  });
  window.addEventListener('focus', () => scheduleRefresh(0));

  new MutationObserver((mutations) => {
    if (!screen()) return;
    const relevant = mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
      node.nodeType === 1 && (
        node.matches?.('.rp-video-scoring-screen,.rp-video-scoreboard,.rp-video-player-wrap,[data-rp-recorded-video]')
        || node.querySelector?.('.rp-video-scoring-screen,.rp-video-scoreboard,.rp-video-player-wrap,[data-rp-recorded-video]')
      )
    )));
    if (relevant) scheduleRefresh(20);
  }).observe(document.documentElement, { childList: true, subtree: true });

  tickTimer = setInterval(tick, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleRefresh(0), { once: true });
  } else {
    scheduleRefresh(0);
  }
})();
