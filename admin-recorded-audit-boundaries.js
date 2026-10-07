(() => {
  if (window.__realPlayRecordedAuditBoundariesInstalled) return;
  window.__realPlayRecordedAuditBoundariesInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DEFAULT_DURATION_MS = 15 * 60 * 1000;

  let sessionId = 0;
  let recording = null;
  let loading = false;
  let refreshTimer = 0;
  let lastSignature = '';

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function media() {
    return screen()?.querySelector('[data-rp-recorded-video]') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function correctionState() {
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
    return correctionState()?.recording || recording;
  }

  async function api(path) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function endMs() {
    return numberOrNull(activeRecording()?.auditClockEndVideoMs);
  }

  function auditDurationMs() {
    const value = Number(activeRecording()?.auditClockDurationMs || DEFAULT_DURATION_MS);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_DURATION_MS;
  }

  function videoDurationMs() {
    const node = media();
    const fromMedia = Number(node?.duration || 0) * 1000;
    const fromRecording = Number(activeRecording()?.durationMs || 0);
    if (Number.isFinite(fromMedia) && fromMedia > 0) return Math.round(fromMedia);
    if (Number.isFinite(fromRecording) && fromRecording > 0) return Math.round(fromRecording);
    return 0;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function boundaryState() {
    const end = endMs();
    const videoDuration = videoDurationMs();
    if (end === null || !videoDuration) return null;
    const start = Math.max(0, end - auditDurationMs());
    return {
      startMs: start,
      endMs: Math.min(end, videoDuration),
      videoDurationMs: videoDuration,
    };
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-audit-boundary-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpAuditBoundaryStyles = '1';
    style.textContent = `
      .rp-video-marker-rail [data-rp-audit-boundaries]{position:absolute;inset:0;z-index:8;pointer-events:none}
      .rp-audit-boundary-stamp{position:absolute;top:0;height:28px;min-width:28px;padding:0 7px;border:1px solid rgba(126,231,255,.62);border-radius:999px;background:#06131e;color:#bff6ff;box-shadow:0 0 0 2px rgba(2,9,15,.8),0 0 15px rgba(30,211,244,.16);font:950 7px/1 system-ui,sans-serif;letter-spacing:.08em;display:flex;align-items:center;gap:4px;white-space:nowrap;pointer-events:auto;cursor:pointer;z-index:9}
      .rp-audit-boundary-stamp::after{content:'';position:absolute;top:25px;width:2px;height:8px;background:#44daf7;opacity:.95}
      .rp-audit-boundary-stamp.start{transform:translateX(-2px)}
      .rp-audit-boundary-stamp.start::after{left:4px}
      .rp-audit-boundary-stamp.end{transform:translateX(calc(-100% + 2px));border-color:rgba(255,110,121,.68);color:#ffd8dc;box-shadow:0 0 0 2px rgba(2,9,15,.8),0 0 15px rgba(255,64,83,.14)}
      .rp-audit-boundary-stamp.end::after{right:4px;background:#ff6575}
      .rp-audit-boundary-stamp b{font-size:9px;line-height:1}
      .rp-audit-boundary-stamp small{font:900 6px/1 system-ui,sans-serif;letter-spacing:.04em;opacity:.72}
      .rp-video-marker-key.rp-audit-boundary-key{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .rp-video-marker-key.rp-audit-boundary-key [data-rp-boundary-key]{display:inline-flex;align-items:center;gap:8px;color:#84b8c8;font:800 7px/1.25 system-ui,sans-serif;letter-spacing:.07em}
      .rp-video-marker-key.rp-audit-boundary-key [data-rp-boundary-key] b{color:#6ee5fb;font-weight:950}.rp-video-marker-key.rp-audit-boundary-key [data-rp-boundary-key] em{color:#ff8995;font-style:normal;font-weight:950}
    `;
    document.head.appendChild(style);
  }

  function ensureLayer(rail) {
    let layer = rail?.querySelector('[data-rp-audit-boundaries]');
    if (!layer && rail) {
      layer = document.createElement('div');
      layer.dataset.rpAuditBoundaries = '1';
      rail.appendChild(layer);
    }
    return layer;
  }

  function seekTo(ms) {
    const node = media();
    if (!node) return;
    try { node.pause?.(); } catch (_) {}
    try { node.currentTime = Math.max(0, Number(ms || 0)) / 1000; } catch (_) {}
  }

  function render() {
    ensureStyles();
    const scoring = screen();
    const rail = scoring?.querySelector('.rp-video-marker-rail');
    if (!scoring || !rail) return;

    const layer = ensureLayer(rail);
    const state = boundaryState();
    if (!state) {
      if (layer) layer.innerHTML = '';
      const key = scoring.querySelector('.rp-video-marker-key');
      key?.classList.remove('rp-audit-boundary-key');
      key?.querySelector('[data-rp-boundary-key]')?.remove();
      lastSignature = '';
      return;
    }

    const startPct = Math.max(0, Math.min(100, state.startMs / state.videoDurationMs * 100));
    const endPct = Math.max(0, Math.min(100, state.endMs / state.videoDurationMs * 100));
    const signature = `${state.startMs}:${state.endMs}:${state.videoDurationMs}`;
    if (signature !== lastSignature || !layer?.querySelector('[data-rp-audit-boundary="start"]')) {
      lastSignature = signature;
      layer.innerHTML = `
        <button type="button" class="rp-audit-boundary-stamp start" data-rp-audit-boundary="start" data-ms="${state.startMs}" style="left:${startPct}%" title="Game start · video ${formatTime(state.startMs)}"><b>▶</b><span>START</span><small>${formatTime(state.startMs)}</small></button>
        <button type="button" class="rp-audit-boundary-stamp end" data-rp-audit-boundary="end" data-ms="${state.endMs}" style="left:${endPct}%" title="Game end · video ${formatTime(state.endMs)}"><b>■</b><span>END</span><small>${formatTime(state.endMs)}</small></button>`;
    }

    const key = scoring.querySelector('.rp-video-marker-key');
    if (key) {
      key.classList.add('rp-audit-boundary-key');
      let info = key.querySelector('[data-rp-boundary-key]');
      if (!info) {
        info = document.createElement('span');
        info.dataset.rpBoundaryKey = '1';
        key.appendChild(info);
      }
      info.innerHTML = `<b>▶ START ${formatTime(state.startMs)}</b><span>·</span><em>■ END ${formatTime(state.endMs)}</em>`;
    }
  }

  async function refreshState() {
    if (!screen() || loading) return;
    const correction = correctionState();
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
      render();
    } finally {
      loading = false;
    }
  }

  function scheduleRefresh(delay = 20) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = 0;
      refreshState();
      render();
    }, delay);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-audit-boundary]');
    if (!button || !screen()?.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    seekTo(Number(button.dataset.ms || 0));
  }, true);

  window.addEventListener('realplay:audit-clock-anchor', () => scheduleRefresh(0));
  window.addEventListener('realplay:admin-render', () => scheduleRefresh(20));
  window.addEventListener('realplay:replay-correction-audit-state', () => scheduleRefresh(20));
  window.addEventListener('focus', () => scheduleRefresh(20));

  document.addEventListener('loadedmetadata', (event) => {
    if (event.target?.matches?.('[data-rp-recorded-video]')) scheduleRefresh(0);
  }, true);

  new MutationObserver((mutations) => {
    if (!screen()) return;
    const relevant = mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
      node.nodeType === 1 && (
        node.matches?.('.rp-video-marker-rail,.rp-video-marker-key,[data-rp-recorded-video]')
        || node.querySelector?.('.rp-video-marker-rail,.rp-video-marker-key,[data-rp-recorded-video]')
      )
    )));
    if (relevant) scheduleRefresh(20);
  }).observe(document.documentElement, { childList: true, subtree: true });

  scheduleRefresh(0);
})();
