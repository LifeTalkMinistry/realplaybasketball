(() => {
  if (window.__realPlayGameEntryModeInstalled) return;
  window.__realPlayGameEntryModeInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CONTROL_PATH = '/api/real-play/admin/career/control';
  const SESSION_PATH = '/api/real-play/admin/career/session';

  // New games do not silently default to LIVE. The admin must make an
  // explicit GAME TYPE choice before the session request is sent.
  let selectedMode = '';
  let currentMode = null;
  let currentSessionId = 0;
  let currentReplayCompleted = false;
  let currentWestScore = 0;
  let currentEastScore = 0;
  let finalizeBusy = false;
  let creating = false;
  let loadTimer = null;

  function normalizeMode(value, fallback = '') {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'live' || mode === 'replay') return mode;
    return fallback;
  }

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

  function ensureStyles() {
    if (document.querySelector('[data-rp-entry-mode-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpEntryModeStyles = '1';
    style.textContent = `
      .rp-entry-mode-field{display:grid;gap:9px;margin:0 0 2px;padding:13px;border:1px solid rgba(118,164,190,.24);border-radius:13px;background:rgba(5,18,29,.82)}
      .rp-entry-mode-label{color:#8fb9cf;font:900 9px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-entry-mode-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rp-entry-mode-option{min-height:46px;padding:7px 8px;border:1px solid rgba(118,164,190,.25);border-radius:11px;background:#081724;color:#86abc0;font:900 9px/1.25 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;touch-action:manipulation;cursor:pointer}
      .rp-entry-mode-option.active{border-color:rgba(32,218,255,.72);background:rgba(8,48,64,.94);color:#4be8ff;box-shadow:0 0 0 1px rgba(32,218,255,.08) inset}
      .rp-entry-mode-help{margin:0;color:#7198ad;font:650 10px/1.45 system-ui,sans-serif}
      .rp-entry-mode-status{margin:0;color:#ff9b9b;font:750 9px/1.4 system-ui,sans-serif}
      .rp-entry-mode-status.success{color:#75f2c6}
      .rp-entry-mode-status:empty{display:none}
      .rp-entry-mode-badge{display:inline-flex;align-items:center;width:max-content;min-height:24px;padding:0 8px;border:1px solid rgba(32,218,255,.25);border-radius:999px;background:#081724;color:#76dff1;font:900 8px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
      .rp-entry-mode-badge.replay{border-color:rgba(255,93,111,.35);background:rgba(48,11,20,.45);color:#ff9aaa}
      [data-admin-tab="live"][hidden],[data-rp-video-tab][hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function modeCopy() {
    if (selectedMode === 'replay') return 'Replay game: VIDEO scoring only. LIVE will never be activated.';
    if (selectedMode === 'live') return 'Future game: LIVE scoring only. VIDEO upload stays disabled.';
    return 'Choose the scoring workflow for this game. Real Play will not guess or default the type.';
  }

  function setFormStatus(form, message = '', success = false) {
    const node = form?.querySelector('[data-rp-entry-mode-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('success', Boolean(success));
  }

  function syncSelector(wrap) {
    if (!wrap) return;
    wrap.querySelectorAll('[data-rp-entry-mode]').forEach((button) => {
      const active = button.dataset.rpEntryMode === selectedMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const hidden = wrap.querySelector('[data-rp-entry-mode-value]');
    if (hidden) hidden.value = selectedMode;
    const help = wrap.querySelector('[data-rp-entry-mode-help]');
    if (help && help.textContent !== modeCopy()) help.textContent = modeCopy();

    const submit = wrap.closest('form')?.querySelector('button[type="submit"]');
    if (submit && !submit.disabled) {
      const label = creating
        ? 'CREATING…'
        : selectedMode === 'replay'
          ? 'CREATE REPLAY GAME'
          : selectedMode === 'live'
            ? 'OPEN FUTURE GAME'
            : 'CHOOSE GAME TYPE FIRST';
      if (submit.textContent !== label) submit.textContent = label;
    }
  }

  function mountSelector() {
    const form = root()?.querySelector('[data-new-session-form]');
    if (!form) return;

    let wrap = form.querySelector('[data-rp-entry-mode-wrap]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'rp-entry-mode-field';
      wrap.dataset.rpEntryModeWrap = '1';
      wrap.innerHTML = `
        <span class="rp-entry-mode-label">GAME TYPE</span>
        <div class="rp-entry-mode-options" role="group" aria-label="Game type">
          <button type="button" class="rp-entry-mode-option" data-rp-entry-mode="live" aria-pressed="false">FUTURE<br>LIVE</button>
          <button type="button" class="rp-entry-mode-option" data-rp-entry-mode="replay" aria-pressed="false">REPLAY<br>RECORDED</button>
        </div>
        <input type="hidden" name="gameEntryMode" data-rp-entry-mode-value value="">
        <p class="rp-entry-mode-help" data-rp-entry-mode-help></p>
        <p class="rp-entry-mode-status" data-rp-entry-mode-status></p>`;

      const firstVisibleLabel = [...form.querySelectorAll('label')]
        .find((label) => !label.classList.contains('rp-admin-hidden-field'));
      if (firstVisibleLabel) form.insertBefore(wrap, firstVisibleLabel);
      else form.prepend(wrap);

      wrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-rp-entry-mode]');
        if (!button) return;
        selectedMode = normalizeMode(button.dataset.rpEntryMode);
        setFormStatus(form, '');
        syncSelector(wrap);
        // Let the date picker update past/future constraints from the same
        // explicit GAME TYPE choice.
        window.requestAnimationFrame(() => {
          button.dispatchEvent(new CustomEvent('realplay:game-type-selected', { bubbles: true }));
        });
      });

      form.addEventListener('reset', () => {
        selectedMode = '';
        creating = false;
        window.requestAnimationFrame(() => {
          setFormStatus(form, '');
          syncSelector(wrap);
        });
      });
    }
    syncSelector(wrap);
  }

  function rememberControl(control) {
    const session = control?.session || null;
    currentSessionId = Number(session?.id || 0);
    currentMode = session ? normalizeMode(session.gameEntryMode || session.game_entry_mode, null) : null;
    currentReplayCompleted = Boolean(session?.recordedScoring?.reviewCompleted);
    currentWestScore = Number(session?.westScore || 0);
    currentEastScore = Number(session?.eastScore || 0);
    syncTabs();
    syncSessionBadge();
    syncReplayFinalize();
    window.dispatchEvent(new CustomEvent('realplay:entry-mode-state', {
      detail: { mode: currentMode, sessionId: currentSessionId, control },
    }));
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
    const replay = currentMode === 'replay';
    badge.classList.toggle('replay', replay);
    const text = replay ? 'REPLAY · VIDEO' : 'FUTURE · LIVE';
    if (badge.textContent !== text) badge.textContent = text;
  }

  function syncTabs() {
    const adminRoot = root();
    if (!adminRoot) return;
    const liveTab = adminRoot.querySelector('[data-admin-tab="live"]');
    const videoTab = adminRoot.querySelector('[data-rp-video-tab]');
    const hasSession = currentSessionId > 0 && Boolean(currentMode);
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

    if (!allowLive && liveTab?.classList.contains('active')) {
      if (allowVideo) window.setTimeout(() => videoTab?.click(), 0);
      else window.setTimeout(() => adminRoot.querySelector('[data-admin-tab="session"]')?.click(), 0);
    }
    if (!allowVideo && videoTab?.classList.contains('active')) {
      window.setTimeout(() => adminRoot.querySelector('[data-admin-tab="session"]')?.click(), 0);
    }
  }

  function syncReplayFinalize() {
    if (currentMode !== 'replay') return;
    const button = root()?.querySelector('[data-control-action="finalize"]');
    if (!button) return;
    const tie = currentWestScore === currentEastScore;
    button.disabled = finalizeBusy || !currentReplayCompleted || tie;
    if (!currentReplayCompleted) button.title = 'Verify and submit the recorded score sheet first.';
    else if (tie) button.title = 'A Real Play game cannot be finalized as a tie.';
    else button.removeAttribute('title');
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

    // Own this one submit explicitly. The base admin form used to omit GAME
    // TYPE and a separate global fetch hook tried to inject it later. That is
    // the bug that allowed a visible REPLAY choice to be saved as LIVE.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (creating) return;

    const mode = normalizeMode(form.querySelector('[data-rp-entry-mode-value]')?.value || selectedMode);
    if (!mode) {
      setFormStatus(form, 'Choose FUTURE LIVE or REPLAY RECORDED first.');
      form.querySelector('[data-rp-entry-mode-wrap]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

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
      gameEntryMode: mode,
    };

    creating = true;
    setFormStatus(form, mode === 'replay' ? 'Creating replay game…' : 'Creating future live game…');
    syncSelector(form.querySelector('[data-rp-entry-mode-wrap]'));

    try {
      await api(SESSION_PATH, { method: 'POST', body: payload });
      selectedMode = '';
      form.reset();
      await loadControl();
      await window.__realPlayRefreshAdminGameControl?.();
      const setup = root()?.querySelector('[data-admin-tab="session"]');
      setup?.click();
      if (mode === 'replay') {
        window.setTimeout(() => root()?.querySelector('[data-rp-video-tab]')?.click(), 120);
      }
    } catch (error) {
      setFormStatus(form, error.message || 'Unable to create the Real Play game.');
    } finally {
      creating = false;
      syncSelector(form.querySelector('[data-rp-entry-mode-wrap]'));
    }
  }

  async function finalizeReplay() {
    if (finalizeBusy || currentMode !== 'replay' || !currentReplayCompleted) return;
    if (currentWestScore === currentEastScore) return;
    if (!window.confirm('Confirm the FINAL RESULT for this recorded replay game? This will lock the verified score and stats.')) return;

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
      window.alert(error.message || 'Unable to finalize the replay game.');
    } finally {
      finalizeBusy = false;
      syncReplayFinalize();
    }
  }

  function apply() {
    ensureStyles();
    mountSelector();
    syncTabs();
    syncSessionBadge();
    syncReplayFinalize();
  }

  document.addEventListener('submit', createSession, true);

  document.addEventListener('click', (event) => {
    const live = event.target.closest?.('[data-admin-tab="live"]');
    if (live && currentMode === 'replay') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const video = event.target.closest?.('[data-rp-video-tab]');
    if (video && currentMode === 'live') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const finalize = event.target.closest?.('[data-control-action="finalize"]');
    if (finalize && currentMode === 'replay') {
      event.preventDefault();
      event.stopImmediatePropagation();
      finalizeReplay();
    }
  }, true);

  // Explicit render/state events only. No document-wide MutationObserver and
  // no window.fetch replacement, so this layer cannot trigger itself forever.
  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(apply);
    scheduleLoad();
  });

  window.addEventListener('realplay:entry-mode-control', (event) => {
    if (event.detail?.control) rememberControl(event.detail.control);
    window.requestAnimationFrame(apply);
  });

  window.addEventListener('focus', scheduleLoad);

  window.__realPlayGameEntryModeApplyControl = (control) => {
    rememberControl(control || { session: null, players: [] });
    window.requestAnimationFrame(apply);
  };
  window.__realPlayGameEntryModeCurrentMode = () => currentMode;

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
