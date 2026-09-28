(() => {
  if (window.__realPlayRaceTargetCorrectionInstalled) return;
  window.__realPlayRaceTargetCorrectionInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CONTROL_SELECTOR = '[data-rp-race-target-control]';
  const DIALOG_SELECTOR = '[data-rp-race-target-dialog]';

  let busy = false;
  let syncTimer = null;
  let activeSessionId = 0;
  let activeContext = null;

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

  function scoringScreen() {
    return document.querySelector('.rp-video-scoring-screen');
  }

  function scoreboard() {
    return scoringScreen()?.querySelector('.rp-video-scoreboard') || null;
  }

  function correction() {
    return activeContext?.corrections?.raceTarget || null;
  }

  function formatTimestamp(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function makeDetail(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'rp-race-target-detail';
    const small = document.createElement('small');
    small.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value ?? '—';
    wrap.append(small, strong);
    return wrap;
  }

  function buildControl() {
    const wrap = document.createElement('section');
    wrap.className = 'rp-race-target-control';
    wrap.dataset.rpRaceTargetControl = '1';

    const label = document.createElement('div');
    label.className = 'rp-race-target-current';
    const kicker = document.createElement('small');
    kicker.textContent = 'SCORE DESK TARGET';
    const current = document.createElement('strong');
    current.dataset.rpRaceTargetValue = '1';
    label.append(kicker, current);

    const actions = document.createElement('div');
    actions.className = 'rp-race-target-actions';
    const status = document.createElement('span');
    status.dataset.rpRaceTargetStatus = '1';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rpRaceTargetEdit = '1';
    button.textContent = 'EDIT TARGET';
    actions.append(status, button);

    wrap.append(label, actions);
    return wrap;
  }

  function placeControl() {
    const board = scoreboard();
    if (!board || !activeContext?.correctionAllowed || activeContext?.originalRules?.rulesetFamily !== 'race_to') {
      document.querySelector(CONTROL_SELECTOR)?.remove();
      return;
    }

    let control = document.querySelector(CONTROL_SELECTOR);
    if (!control) control = buildControl();

    // Always follow the actual scoreboard. The desktop scoring module reparents
    // the scoreboard into its right rail; this sibling follows it without
    // changing or owning that layout's DOM moves.
    if (control.nextElementSibling !== board || control.parentElement !== board.parentElement) {
      board.parentElement?.insertBefore(control, board);
    }

    const target = Number(activeContext.effectiveTarget || activeContext.effectiveRules?.targetScore || 0);
    const current = control.querySelector('[data-rp-race-target-value]');
    if (current) current.textContent = `RACE TO ${target}`;

    const hasCorrection = Boolean(correction());
    const status = control.querySelector('[data-rp-race-target-status]');
    if (status) {
      status.textContent = hasCorrection ? 'CORRECTED' : 'LOCKED RULE';
      status.classList.toggle('corrected', hasCorrection);
    }
    const edit = control.querySelector('[data-rp-race-target-edit]');
    if (edit) edit.textContent = hasCorrection ? 'EDIT CORRECTION' : 'EDIT TARGET';
  }

  function closeDialog() {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.remove();
  }

  function openDialog() {
    closeDialog();
    if (!activeContext?.correctionAllowed) return;

    const prior = correction();
    const dialog = document.createElement('dialog');
    dialog.className = 'rp-race-target-dialog';
    dialog.dataset.rpRaceTargetDialog = '1';

    const form = document.createElement('form');
    form.method = 'dialog';
    form.dataset.rpRaceTargetForm = '1';

    const head = document.createElement('div');
    head.className = 'rp-race-target-dialog-head';
    const titleWrap = document.createElement('div');
    const kicker = document.createElement('small');
    kicker.textContent = 'ADMIN · AUDITED RULE CORRECTION';
    const title = document.createElement('h2');
    title.textContent = 'ADJUST RACE TARGET';
    titleWrap.append(kicker, title);
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.rpRaceTargetCancel = '1';
    close.textContent = '×';
    head.append(titleWrap, close);

    const facts = document.createElement('div');
    facts.className = 'rp-race-target-facts';
    facts.append(
      makeDetail('ORIGINAL TARGET', String(activeContext.originalTarget ?? '—')),
      makeDetail(prior ? 'CURRENT CORRECTED TARGET' : 'CURRENT TARGET', String(activeContext.effectiveTarget ?? '—'))
    );

    if (prior) {
      facts.append(
        makeDetail('CORRECTED BY', `ADMIN #${prior.correctedByUserId}`),
        makeDetail('CORRECTED AT', formatTimestamp(prior.correctedAt))
      );
    }

    const targetLabel = document.createElement('label');
    targetLabel.className = 'rp-race-target-field';
    const targetText = document.createElement('span');
    targetText.textContent = prior ? 'NEW CORRECTED TARGET' : 'CORRECTED TARGET';
    const targetInput = document.createElement('input');
    targetInput.type = 'number';
    targetInput.name = 'targetScore';
    targetInput.min = '1';
    targetInput.max = '100';
    targetInput.step = '1';
    targetInput.required = true;
    targetInput.value = String(activeContext.effectiveTarget || '');
    targetLabel.append(targetText, targetInput);

    const reasonLabel = document.createElement('label');
    reasonLabel.className = 'rp-race-target-field';
    const reasonText = document.createElement('span');
    reasonText.textContent = 'REASON';
    const reasonInput = document.createElement('textarea');
    reasonInput.name = 'reason';
    reasonInput.minLength = 3;
    reasonInput.maxLength = 500;
    reasonInput.required = true;
    reasonInput.rows = 3;
    reasonInput.placeholder = 'Example: Actual recorded game was played Race to 9';
    reasonLabel.append(reasonText, reasonInput);

    if (prior?.reason) {
      const previous = document.createElement('div');
      previous.className = 'rp-race-target-previous-reason';
      const previousLabel = document.createElement('small');
      previousLabel.textContent = 'CURRENT CORRECTION REASON';
      const previousText = document.createElement('p');
      previousText.textContent = prior.reason;
      previous.append(previousLabel, previousText);
      form.append(head, facts, previous, targetLabel, reasonLabel);
    } else {
      form.append(head, facts, targetLabel, reasonLabel);
    }

    const error = document.createElement('div');
    error.className = 'rp-race-target-error';
    error.dataset.rpRaceTargetError = '1';
    error.hidden = true;

    const buttons = document.createElement('div');
    buttons.className = 'rp-race-target-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.rpRaceTargetCancel = '1';
    cancel.textContent = 'CANCEL';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'primary';
    save.dataset.rpRaceTargetSave = '1';
    save.textContent = 'SAVE CORRECTION';
    buttons.append(cancel, save);

    form.append(error, buttons);
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    targetInput.focus();
    targetInput.select();
  }

  async function getCurrentSessionId() {
    const data = await api('/api/real-play/admin/career/control');
    return Number(data?.control?.session?.id || 0);
  }

  async function loadContext(sessionId) {
    const data = await api(`/api/real-play/admin/games/${encodeURIComponent(sessionId)}/race-target-correction`);
    activeSessionId = sessionId;
    activeContext = data;
    return data;
  }

  async function sync() {
    if (busy) return;
    const screen = scoringScreen();
    const board = scoreboard();
    if (!screen || !board || !token()) {
      document.querySelector(CONTROL_SELECTOR)?.remove();
      activeSessionId = 0;
      activeContext = null;
      return;
    }

    // If the control survived a desktop/mobile reparent, only move it next to
    // the scoreboard; do not refetch or touch scoring state.
    if (activeContext && activeSessionId && document.querySelector(CONTROL_SELECTOR)) {
      placeControl();
      return;
    }

    busy = true;
    try {
      const sessionId = await getCurrentSessionId();
      if (!sessionId) return;
      await loadContext(sessionId);
      placeControl();
    } catch (_) {
      document.querySelector(CONTROL_SELECTOR)?.remove();
    } finally {
      busy = false;
    }
  }

  async function saveCorrection(form) {
    if (busy || !activeSessionId) return;
    const formData = new FormData(form);
    const targetScore = Number(formData.get('targetScore'));
    const reason = String(formData.get('reason') || '').trim();
    const errorBox = form.querySelector('[data-rp-race-target-error]');
    const save = form.querySelector('[data-rp-race-target-save]');

    if (!Number.isSafeInteger(targetScore) || targetScore < 1 || targetScore > 100) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = 'Enter a whole-number Race To target from 1 to 100.';
      }
      return;
    }
    if (reason.length < 3) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = 'Enter a correction reason of at least 3 characters.';
      }
      return;
    }

    busy = true;
    if (save) save.disabled = true;
    if (errorBox) errorBox.hidden = true;
    try {
      await api(`/api/real-play/admin/games/${encodeURIComponent(activeSessionId)}/race-target-correction`, {
        method: 'POST',
        json: { targetScore, reason },
      });
      await loadContext(activeSessionId);
      placeControl();
      closeDialog();
      document.dispatchEvent(new CustomEvent('realplay:race-target-corrected', {
        detail: {
          sessionId: activeSessionId,
          originalTarget: activeContext?.originalTarget,
          effectiveTarget: activeContext?.effectiveTarget,
        },
      }));
    } catch (error) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = error.message || 'Could not save the Race To correction.';
      }
      if (save) save.disabled = false;
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-race-target-edit]')) {
      event.preventDefault();
      event.stopPropagation();
      openDialog();
      return;
    }
    if (event.target.closest('[data-rp-race-target-cancel]')) {
      event.preventDefault();
      closeDialog();
    }
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-rp-race-target-form]');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    saveCorrection(form);
  }, true);

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 90);
  }

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleSync, { passive: true });
  document.addEventListener('realplay:recorded-scoring-rendered', scheduleSync);
  scheduleSync();
})();
