(() => {
  if (window.__realPlayGameEntryModeInstalled) return;
  window.__realPlayGameEntryModeInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CONTROL_PATH = '/api/real-play/admin/career/control';
  const SESSION_PATH = '/api/real-play/admin/career/session';
  const RECORDED_MODE = 'replay';

  let currentSessionId = 0;
  let currentReplayCompleted = false;
  let currentWestScore = 0;
  let currentEastScore = 0;
  let finalizeBusy = false;
  let creating = false;
  let loadTimer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
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
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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

  function removeRetiredLiveUi() {
    const adminRoot = root();
    if (!adminRoot) return;

    adminRoot.querySelectorAll([
      '[data-admin-tab="live"]',
      '[data-rp-entry-mode-wrap]',
      '[data-rp-entry-mode-badge]',
      '[data-rp-game-type-switch]',
      '.rp-game-type-switch',
      '.rp-entry-mode-badge',
    ].join(',')).forEach((node) => node.remove());
  }

  function setFormStatus(form, message = '') {
    let node = form?.querySelector('[data-rp-recorded-only-status]');
    if (!node && form) {
      node = document.createElement('p');
      node.dataset.rpRecordedOnlyStatus = '1';
      node.style.cssText = 'margin:7px 0 0;color:#ff9b9b;font:750 10px/1.4 system-ui,sans-serif;';
      form.appendChild(node);
    }
    if (node) node.textContent = message;
  }

  function syncTabs() {
    const adminRoot = root();
    if (!adminRoot) return;
    removeRetiredLiveUi();

    const videoTab = adminRoot.querySelector('[data-rp-video-tab]');
    if (!videoTab) return;

    const hasSession = currentSessionId > 0;
    videoTab.hidden = !hasSession;
    videoTab.setAttribute('aria-hidden', hasSession ? 'false' : 'true');
    videoTab.tabIndex = hasSession ? 0 : -1;
  }

  function syncReplayFinalize() {
    const button = root()?.querySelector('[data-control-action="finalize"]');
    if (!button || !currentSessionId) return;
    const tie = currentWestScore === currentEastScore;
    button.disabled = finalizeBusy || !currentReplayCompleted || tie;
    if (!currentReplayCompleted) button.title = 'Verify and submit the recorded score sheet first.';
    else if (tie) button.title = 'A Real Play game cannot be finalized as a tie.';
    else button.removeAttribute('title');
  }

  function rememberControl(control) {
    const session = control?.session || null;
    currentSessionId = Number(session?.id || 0);
    currentReplayCompleted = Boolean(session?.recordedScoring?.reviewCompleted);
    currentWestScore = Number(session?.westScore || 0);
    currentEastScore = Number(session?.eastScore || 0);

    removeRetiredLiveUi();
    syncTabs();
    syncReplayFinalize();

    window.dispatchEvent(new CustomEvent('realplay:entry-mode-state', {
      detail: {
        mode: currentSessionId ? RECORDED_MODE : null,
        sessionId: currentSessionId,
        control,
      },
    }));
  }

  async function loadControl() {
    if (!token()) return null;
    try {
      const data = await api(CONTROL_PATH);
      const control = data?.control || { session: null, players: [] };
      rememberControl(control);
      return control;
    } catch (_) {
      return null;
    }
  }

  function scheduleLoad() {
    if (loadTimer) return;
    loadTimer = window.setTimeout(async () => {
      loadTimer = null;
      await loadControl();
    }, 60);
  }

  async function createSession(event) {
    const form = event.target.closest?.('[data-new-session-form]');
    if (!form) return;

    // Recorded scoring is the only game workflow now. Own the submit so old
    // cached admin code cannot silently recreate a FUTURE/LIVE session.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (creating) return;

    if (!currentSessionId) await loadControl();
    if (currentSessionId && !window.confirm('Opening a new session will close the current session. Continue?')) return;

    const data = new FormData(form);
    const localStartsAt = String(data.get('startsAt') || '').trim();
    let startsAt = null;
    if (localStartsAt) {
      const parsed = new Date(localStartsAt);
      if (Number.isNaN(parsed.getTime())) {
        setFormStatus(form, 'Choose a valid game date and time.');
        return;
      }
      startsAt = parsed.toISOString();
    }

    const capacityRaw = String(data.get('capacity') || '').trim();
    const payload = {
      title: String(data.get('title') || '').trim(),
      locationName: String(data.get('locationName') || '').trim(),
      startsAt,
      capacity: capacityRaw ? Number(capacityRaw) : null,
      gameEntryMode: RECORDED_MODE,
    };

    creating = true;
    setFormStatus(form, 'Creating recorded game…');

    try {
      await api(SESSION_PATH, { method: 'POST', body: payload });
      form.reset();
      setFormStatus(form, '');
      await loadControl();
      await window.__realPlayRefreshAdminGameControl?.();
      removeRetiredLiveUi();
      root()?.querySelector('[data-admin-tab="session"]')?.click();
      window.setTimeout(() => root()?.querySelector('[data-rp-video-tab]')?.click(), 120);
    } catch (error) {
      setFormStatus(form, error.message || 'Unable to create the Real Play game.');
    } finally {
      creating = false;
    }
  }

  async function finalizeReplay() {
    if (finalizeBusy || !currentSessionId || !currentReplayCompleted) return;
    if (currentWestScore === currentEastScore) return;
    if (!window.confirm('Confirm the FINAL RESULT for this recorded game? This will lock the verified score and stats.')) return;

    finalizeBusy = true;
    syncReplayFinalize();
    try {
      const data = await api(CONTROL_PATH, {
        method: 'POST',
        body: { action: 'finalize' },
      });
      rememberControl(data?.control || { session: null, players: [] });
      await window.__realPlayRefreshAdminGameControl?.();
      root()?.querySelector('[data-admin-tab="finalize"]')?.click();
    } catch (error) {
      window.alert(error.message || 'Unable to finalize the recorded game.');
    } finally {
      finalizeBusy = false;
      syncReplayFinalize();
    }
  }

  function apply() {
    removeRetiredLiveUi();
    syncTabs();
    syncReplayFinalize();
  }

  document.addEventListener('submit', createSession, true);

  document.addEventListener('click', (event) => {
    const liveTab = event.target.closest?.('[data-admin-tab="live"]');
    if (liveTab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      liveTab.remove();
      return;
    }

    const finalize = event.target.closest?.('[data-control-action="finalize"]');
    if (!finalize || !currentSessionId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void finalizeReplay();
  }, true);

  window.addEventListener('realplay:admin-control-render', () => {
    apply();
    scheduleLoad();
  });

  window.addEventListener('realplay:recorded-scoring-state', scheduleLoad);
  window.addEventListener('realplay:recorded-score-sheet-submitted', scheduleLoad);
  window.addEventListener('realplay:recorded-score-sheet-state', scheduleLoad);

  // Compatibility API used by the recorded-scoring modules.
  window.__realPlayGameEntryModeApplyControl = rememberControl;
  window.__realPlayGameEntryModeCurrentMode = () => (currentSessionId ? RECORDED_MODE : null);

  apply();
  scheduleLoad();

  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
