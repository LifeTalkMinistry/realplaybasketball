(() => {
  if (window.__realPlayGameEntryModeInstalled) return;
  window.__realPlayGameEntryModeInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SESSION_PATH = '/api/real-play/admin/career/session';
  const CONTROL_PATH = '/api/real-play/admin/career/control';
  const nativeFetch = window.fetch.bind(window);

  let selectedMode = 'live';
  let currentMode = null;
  let currentSessionId = 0;
  let currentReplayCompleted = false;
  let currentWestScore = 0;
  let currentEastScore = 0;
  let finalizeBusy = false;
  let loadTimer = null;

  function normalizeMode(value) {
    return String(value || '').trim().toLowerCase() === 'replay' ? 'replay' : 'live';
  }

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function pathnameOf(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      return new URL(raw, window.location.href).pathname;
    } catch (_) {
      return '';
    }
  }

  function methodOf(input, init = {}) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  function rememberControl(data) {
    const session = data?.control?.session || null;
    currentSessionId = Number(session?.id || 0);
    currentMode = session ? normalizeMode(session.gameEntryMode || session.game_entry_mode || 'live') : null;
    currentReplayCompleted = Boolean(session?.recordedScoring?.reviewCompleted);
    currentWestScore = Number(session?.westScore || 0);
    currentEastScore = Number(session?.eastScore || 0);
    window.requestAnimationFrame(() => {
      syncTabs();
      syncSessionBadge();
      syncReplayFinalize();
    });
  }

  function inspectResponse(response, path) {
    if (!response?.ok) return;
    response.clone().json().then((data) => {
      if (path === CONTROL_PATH) {
        rememberControl(data);
      } else if (path === SESSION_PATH && data?.session?.id) {
        currentSessionId = Number(data.session.id);
        currentMode = normalizeMode(data.session.gameEntryMode || data.session.game_entry_mode || selectedMode);
        currentReplayCompleted = false;
        currentWestScore = 0;
        currentEastScore = 0;
        selectedMode = 'live';
        window.requestAnimationFrame(apply);
      }
    }).catch(() => {});
  }

  window.fetch = async function realPlayGameEntryModeFetch(input, init = {}) {
    const path = pathnameOf(input);
    const method = methodOf(input, init);
    let nextInit = init;

    if (path === SESSION_PATH && method === 'POST' && typeof init?.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          payload.gameEntryMode = selectedMode;
          nextInit = { ...init, body: JSON.stringify(payload) };
        }
      } catch (_) {
        // Leave non-JSON requests untouched.
      }
    }

    const response = await nativeFetch(input, nextInit);
    if (path === CONTROL_PATH || path === SESSION_PATH) inspectResponse(response, path);
    return response;
  };

  function ensureStyles() {
    if (document.querySelector('[data-rp-entry-mode-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpEntryModeStyles = '1';
    style.textContent = `
      .rp-entry-mode-field{display:grid;gap:9px;margin:0 0 2px;padding:13px;border:1px solid rgba(118,164,190,.24);border-radius:13px;background:rgba(5,18,29,.82)}
      .rp-entry-mode-label{color:#8fb9cf;font:900 9px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-entry-mode-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rp-entry-mode-option{min-height:46px;padding:7px 8px;border:1px solid rgba(118,164,190,.25);border-radius:11px;background:#081724;color:#86abc0;font:900 9px/1.25 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;touch-action:manipulation}
      .rp-entry-mode-option.active{border-color:rgba(32,218,255,.72);background:rgba(8,48,64,.94);color:#4be8ff;box-shadow:0 0 0 1px rgba(32,218,255,.08) inset}
      .rp-entry-mode-help{margin:0;color:#7198ad;font:650 10px/1.45 system-ui,sans-serif}
      .rp-entry-mode-badge{display:inline-flex;align-items:center;width:max-content;min-height:24px;padding:0 8px;border:1px solid rgba(32,218,255,.25);border-radius:999px;background:#081724;color:#76dff1;font:900 8px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
      .rp-entry-mode-badge.replay{border-color:rgba(255,93,111,.35);background:rgba(48,11,20,.45);color:#ff9aaa}
      [data-admin-tab="live"][hidden],[data-rp-video-tab][hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function modeCopy() {
    return selectedMode === 'replay'
      ? 'Replay game: VIDEO scoring only. LIVE will never be activated.'
      : 'Future game: LIVE scoring only. VIDEO upload stays disabled.';
  }

  function syncSelector(wrap) {
    if (!wrap) return;
    wrap.querySelectorAll('[data-rp-entry-mode]').forEach((button) => {
      const active = button.dataset.rpEntryMode === selectedMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const help = wrap.querySelector('[data-rp-entry-mode-help]');
    if (help) help.textContent = modeCopy();

    const form = wrap.closest('form');
    const submit = form?.querySelector('button[type="submit"]');
    if (submit && !submit.disabled) {
      submit.textContent = selectedMode === 'replay' ? 'CREATE REPLAY GAME' : 'OPEN FUTURE GAME';
    }
  }

  function mountSelector() {
    const adminRoot = root();
    const form = adminRoot?.querySelector('[data-new-session-form]');
    if (!form) return;

    let wrap = form.querySelector('[data-rp-entry-mode-wrap]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'rp-entry-mode-field';
      wrap.dataset.rpEntryModeWrap = '1';
      wrap.innerHTML = `
        <span class="rp-entry-mode-label">GAME TYPE</span>
        <div class="rp-entry-mode-options" role="group" aria-label="Game type">
          <button type="button" class="rp-entry-mode-option" data-rp-entry-mode="live">FUTURE<br>LIVE</button>
          <button type="button" class="rp-entry-mode-option" data-rp-entry-mode="replay">REPLAY<br>RECORDED</button>
        </div>
        <p class="rp-entry-mode-help" data-rp-entry-mode-help></p>`;

      const firstVisibleLabel = [...form.querySelectorAll('label')]
        .find((label) => !label.classList.contains('rp-admin-hidden-field'));
      if (firstVisibleLabel) form.insertBefore(wrap, firstVisibleLabel);
      else form.prepend(wrap);

      wrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-rp-entry-mode]');
        if (!button) return;
        selectedMode = normalizeMode(button.dataset.rpEntryMode);
        syncSelector(wrap);
      });
    }
    syncSelector(wrap);
  }

  function syncSessionBadge() {
    const adminRoot = root();
    if (!adminRoot || !currentSessionId || !currentMode) return;
    const sessionCard = adminRoot.querySelector('.rp-admin-session-summary');
    if (!sessionCard) return;
    let badge = sessionCard.querySelector('[data-rp-entry-mode-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-entry-mode-badge';
      badge.dataset.rpEntryModeBadge = '1';
      const head = sessionCard.querySelector('.rp-admin-card-head');
      const manage = head?.querySelector('[data-admin-session-manage-toggle]');
      if (head) head.insertBefore(badge, manage || null);
    }
    badge.classList.toggle('replay', currentMode === 'replay');
    badge.textContent = currentMode === 'replay' ? 'REPLAY · VIDEO' : 'FUTURE · LIVE';
  }

  function syncReplayFinalize() {
    if (currentMode !== 'replay') return;
    const button = root()?.querySelector('[data-control-action="finalize"]');
    if (!button) return;
    const tie = currentWestScore === currentEastScore;
    button.disabled = finalizeBusy || !currentReplayCompleted || tie;
    if (!currentReplayCompleted) {
      button.title = 'Verify and submit the recorded score sheet first.';
    } else if (tie) {
      button.title = 'A Real Play game cannot be finalized as a tie.';
    } else {
      button.removeAttribute('title');
    }
  }

  function syncTabs() {
    const adminRoot = root();
    if (!adminRoot) return;
    const liveTab = adminRoot.querySelector('[data-admin-tab="live"]');
    const videoTab = adminRoot.querySelector('[data-rp-video-tab]');
    const hasSession = currentSessionId > 0;
    const allowLive = hasSession && currentMode === 'live';
    const allowVideo = hasSession && currentMode === 'replay';

    if (liveTab) {
      liveTab.hidden = !allowLive;
      liveTab.setAttribute('aria-hidden', allowLive ? 'false' : 'true');
      liveTab.tabIndex = allowLive ? 0 : -1;
    }
    if (videoTab) {
      videoTab.hidden = !allowVideo;
      videoTab.setAttribute('aria-hidden', allowVideo ? 'false' : 'true');
      videoTab.tabIndex = allowVideo ? 0 : -1;
    }

    const wrongLive = !allowLive && liveTab?.classList.contains('active');
    const wrongVideo = !allowVideo && videoTab?.classList.contains('active');
    if (wrongLive || wrongVideo) {
      const setup = adminRoot.querySelector('[data-admin-tab="session"]');
      if (setup && !setup.classList.contains('active')) setup.click();
    }
  }

  async function loadControl() {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    try {
      const response = await nativeFetch(`${API_BASE_URL}${CONTROL_PATH}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      rememberControl(data);
    } catch (_) {}
  }

  async function finalizeReplay() {
    if (finalizeBusy || currentMode !== 'replay' || !currentReplayCompleted) return;
    if (currentWestScore === currentEastScore) return;
    if (!window.confirm('Confirm the FINAL RESULT for this recorded replay game? This will lock the verified score and stats.')) return;

    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      window.alert('Admin session is not available. Log in again.');
      return;
    }

    finalizeBusy = true;
    syncReplayFinalize();
    try {
      const response = await window.fetch(`${API_BASE_URL}${CONTROL_PATH}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'finalize' }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      rememberControl(data);
      await window.__realPlayRefreshAdminGameControl?.();
    } catch (error) {
      window.alert(error.message || 'Unable to finalize the replay game.');
    } finally {
      finalizeBusy = false;
      window.requestAnimationFrame(() => {
        syncReplayFinalize();
        syncTabs();
      });
    }
  }

  function scheduleLoad() {
    if (loadTimer) return;
    loadTimer = window.setTimeout(() => {
      loadTimer = null;
      loadControl();
    }, 80);
  }

  function apply() {
    ensureStyles();
    mountSelector();
    syncTabs();
    syncSessionBadge();
    syncReplayFinalize();
    if (currentMode === null) scheduleLoad();
  }

  document.addEventListener('click', (event) => {
    const live = event.target.closest('[data-admin-tab="live"]');
    if (live && currentMode === 'replay') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const video = event.target.closest('[data-rp-video-tab]');
    if (video && currentMode === 'live') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const finalize = event.target.closest('[data-control-action="finalize"]');
    if (finalize && currentMode === 'replay') {
      event.preventDefault();
      event.stopImmediatePropagation();
      finalizeReplay();
    }
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(apply);
    scheduleLoad();
  });

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      mountSelector();
      syncTabs();
      syncSessionBadge();
      syncReplayFinalize();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      scheduleLoad();
    }, { once: true });
  } else {
    apply();
    scheduleLoad();
  }
})();
