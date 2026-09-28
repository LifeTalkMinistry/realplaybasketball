(() => {
  if (window.__realPlayRecordedDesktopInstalled) return;
  window.__realPlayRecordedDesktopInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  // Treat any genuinely wide browser workspace as desktop. This keeps the
  // video-left / score-right layout active even when Windows display scaling
  // or browser zoom reduces the CSS viewport more than expected.
  const DESKTOP_MEDIA = '(min-width:700px)';

  let layoutTimer = null;
  let rulesTimer = null;
  let rulesLoadPromise = null;
  let savedRaceRules = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function raceForm() {
    return root()?.querySelector('[data-rp-video-race-form]') || null;
  }

  function syncScoringChrome(adminRoot, scoring) {
    if (!adminRoot) return;
    const active = Boolean(scoring);
    adminRoot.classList.toggle('rp-recorded-scoring-mode', active);

    ['.rp-admin-topbar', '.rp-admin-livebar', '.rp-admin-tabs'].forEach((selector) => {
      const node = adminRoot.querySelector(selector);
      if (!node) return;
      if (active) node.style.setProperty('display', 'none', 'important');
      else node.style.removeProperty('display');
    });

    const adminBody = adminRoot.querySelector('.rp-admin-body');
    if (adminBody) {
      if (active) adminBody.style.setProperty('padding-top', '0', 'important');
      else adminBody.style.removeProperty('padding-top');
    }
  }

  function normalizeRaceRules(control) {
    const session = control?.session || null;
    const rules = session?.rules || null;
    if (!session?.id || rules?.rulesetFamily !== 'race_to') return null;

    const target = Number(rules.targetScore || 0);
    const format = String(rules.playerFormat || '').trim().toLowerCase();
    if (![8, 16, 21].includes(target) || !['3v3', '4v4', '5v5'].includes(format)) return null;

    return {
      sessionId: Number(session.id),
      target,
      format,
      signature: `${Number(session.id)}:${target}:${format}`,
    };
  }

  async function fetchControl() {
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return null;
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data?.control || null;
  }

  async function refreshSavedRaceRules() {
    if (rulesLoadPromise) return rulesLoadPromise;
    rulesLoadPromise = fetchControl()
      .then((control) => {
        savedRaceRules = normalizeRaceRules(control);
        return savedRaceRules;
      })
      .catch(() => savedRaceRules)
      .finally(() => { rulesLoadPromise = null; });
    return rulesLoadPromise;
  }

  function bindRaceForm(form) {
    if (!form || form.dataset.rpRaceRulesStateBound === '1') return;
    form.dataset.rpRaceRulesStateBound = '1';
    form.dataset.rpRaceRulesUserDirty = '0';

    form.addEventListener('change', (event) => {
      const select = event.target.closest('select[name="target"], select[name="format"]');
      if (!select) return;
      form.dataset.rpRaceRulesUserDirty = '1';
    });
  }

  function applySavedRaceRules() {
    const form = raceForm();
    if (!form) return;
    bindRaceForm(form);

    if (!savedRaceRules || form.dataset.rpRaceRulesUserDirty === '1') return;
    if (form.dataset.rpRaceRulesSignature === savedRaceRules.signature) return;

    const target = form.querySelector('select[name="target"]');
    const format = form.querySelector('select[name="format"]');
    if (target) target.value = String(savedRaceRules.target);
    if (format) format.value = savedRaceRules.format;
    form.dataset.rpRaceRulesSignature = savedRaceRules.signature;
  }

  async function syncSavedRaceRules(force = false) {
    const form = raceForm();
    if (!form) return;
    bindRaceForm(form);
    if (force || !savedRaceRules) await refreshSavedRaceRules();
    applySavedRaceRules();
  }

  function scheduleRulesSync(force = false) {
    if (rulesTimer) clearTimeout(rulesTimer);
    rulesTimer = setTimeout(() => syncSavedRaceRules(force), 20);
  }

  function panelTitleHtml() {
    return `
      <div class="rp-video-desktop-panel-title" data-rp-video-desktop-panel-title>
        <span>DRAFT SCORE SHEET</span>
        <strong>SCORE DESK</strong>
        <small>Select a player, then record the event without losing sight of the game.</small>
      </div>`;
  }

  function restoreMobileLayout(adminRoot, scoring) {
    adminRoot?.classList.remove('rp-recorded-desktop-mode');
    scoring?.classList.remove('rp-video-desktop-ready');
    scoring?.removeAttribute('data-rp-desktop-ownership-stable');
    if (!scoring) return;

    const grids = [...scoring.querySelectorAll(':scope > [data-rp-video-desktop-grid]')];
    if (!grids.length) return;

    const playerWrap = scoring.querySelector('.rp-video-player-wrap');
    const autoNote = scoring.querySelector('.rp-video-auto-note');
    const draftBanner = scoring.querySelector('[data-rp-draft-banner]');
    const cancelCard = scoring.querySelector('[data-rp-cancel-video-card]');
    const correction = scoring.querySelector('[data-rp-race-target-correction]');
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    const rosters = scoring.querySelector('.rp-video-score-rosters');
    const selectedPanel = scoring.querySelector('[data-rp-video-selected-panel]');
    const reviewActions = scoring.querySelector('.rp-video-review-actions');

    const anchor = grids[0];
    [playerWrap, autoNote, draftBanner, cancelCard, correction, scoreboard, rosters, selectedPanel, reviewActions]
      .filter(Boolean)
      .forEach((node) => scoring.insertBefore(node, anchor));

    grids.forEach((grid) => grid.remove());
  }

  function syncDesktopColumns(scoring, grid) {
    const left = grid?.querySelector('[data-rp-video-desktop-left]');
    const right = grid?.querySelector('[data-rp-video-desktop-right]');
    if (!left || !right) return null;

    const moveIfNeeded = (node, target) => {
      if (node && node.parentElement !== target) target.appendChild(node);
    };

    moveIfNeeded(scoring.querySelector('.rp-video-player-wrap'), left);
    moveIfNeeded(scoring.querySelector('.rp-video-auto-note'), left);
    moveIfNeeded(scoring.querySelector('[data-rp-draft-banner]'), left);
    moveIfNeeded(scoring.querySelector('[data-rp-cancel-video-card]'), left);

    moveIfNeeded(scoring.querySelector('[data-rp-race-target-correction]'), right);
    moveIfNeeded(scoring.querySelector('.rp-video-scoreboard'), right);
    moveIfNeeded(scoring.querySelector('.rp-video-score-rosters'), right);
    moveIfNeeded(scoring.querySelector('[data-rp-video-selected-panel]'), right);
    moveIfNeeded(scoring.querySelector('.rp-video-review-actions'), right);

    return { left, right };
  }

  function settleDesktopOwnership(scoring, grid) {
    const columns = syncDesktopColumns(scoring, grid);
    if (!columns) return;

    // There must only ever be one desktop workspace. If a stale duplicate grid
    // exists, move the known scoring nodes into the active grid first, then remove it.
    [...scoring.querySelectorAll(':scope > [data-rp-video-desktop-grid]')]
      .filter((candidate) => candidate !== grid)
      .forEach((candidate) => candidate.remove());

    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    const stable = !scoreboard || scoreboard.parentElement === columns.right;
    scoring.dataset.rpDesktopOwnershipStable = stable ? '1' : '0';

    // Regression safeguard: desktop owns the scoreboard parent. This is normally
    // a no-op because syncDesktopColumns is idempotent, but it reclaims ownership
    // immediately if another renderer ever moves the node unexpectedly.
    if (!stable && scoreboard) {
      columns.right.appendChild(scoreboard);
      scoring.dataset.rpDesktopOwnershipStable = '1';
    }
  }

  function applyDesktopLayout() {
    const adminRoot = root();
    const scoring = screen();

    syncScoringChrome(adminRoot, scoring);

    if (!adminRoot || !scoring) {
      adminRoot?.classList.remove('rp-recorded-desktop-mode');
      return;
    }

    if (!window.matchMedia(DESKTOP_MEDIA).matches) {
      restoreMobileLayout(adminRoot, scoring);
      return;
    }

    adminRoot.classList.add('rp-recorded-desktop-mode');
    scoring.classList.add('rp-video-desktop-ready');

    let grid = scoring.querySelector(':scope > [data-rp-video-desktop-grid]');
    if (grid) {
      settleDesktopOwnership(scoring, grid);
      return;
    }

    const playerWrap = scoring.querySelector('.rp-video-player-wrap');
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    if (!playerWrap || !scoreboard) return;

    grid = document.createElement('div');
    grid.className = 'rp-video-desktop-grid';
    grid.dataset.rpVideoDesktopGrid = '1';

    const left = document.createElement('section');
    left.className = 'rp-video-desktop-left';
    left.dataset.rpVideoDesktopLeft = '1';

    const right = document.createElement('section');
    right.className = 'rp-video-desktop-right';
    right.dataset.rpVideoDesktopRight = '1';
    right.insertAdjacentHTML('afterbegin', panelTitleHtml());

    playerWrap.insertAdjacentElement('beforebegin', grid);
    grid.append(left, right);
    settleDesktopOwnership(scoring, grid);
  }

  function scheduleLayout() {
    if (layoutTimer) clearTimeout(layoutTimer);
    layoutTimer = setTimeout(applyDesktopLayout, 35);
    scheduleRulesSync(false);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-rp-video-race-form]');
    if (!form) return;

    const target = Number(form.querySelector('select[name="target"]')?.value || 0);
    const format = String(form.querySelector('select[name="format"]')?.value || '').trim().toLowerCase();
    if ([8, 16, 21].includes(target) && ['3v3', '4v4', '5v5'].includes(format)) {
      const sessionId = Number(savedRaceRules?.sessionId || 0);
      savedRaceRules = {
        sessionId,
        target,
        format,
        signature: `${sessionId}:${target}:${format}`,
      };
      form.dataset.rpRaceRulesUserDirty = '0';
      form.dataset.rpRaceRulesSignature = savedRaceRules.signature;
    }

    window.setTimeout(() => scheduleRulesSync(true), 180);
  }, true);

  window.addEventListener('realplay:entry-mode-state', (event) => {
    if (event.detail?.control) {
      savedRaceRules = normalizeRaceRules(event.detail.control);
      window.requestAnimationFrame(applySavedRaceRules);
    }
  });

  const observer = new MutationObserver(scheduleLayout);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', () => {
    scheduleLayout();
    scheduleRulesSync(true);
  });
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('focus', () => scheduleRulesSync(true));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleLayout();
      scheduleRulesSync(true);
    }, { once: true });
  } else {
    scheduleLayout();
    scheduleRulesSync(true);
  }
})();

(() => {
  if (window.__realPlayRaceTargetCorrectionInstalled) return;
  window.__realPlayRaceTargetCorrectionInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let current = null;
  let currentSessionId = 0;
  let timer = null;
  let loading = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

  function scoring() { return document.querySelector('.rp-admin-control .rp-video-scoring-screen'); }

  async function request(path, options = {}) {
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json', Authorization: `Bearer ${auth}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function removeControl() {
    document.querySelectorAll('[data-rp-race-target-correction]').forEach((node) => node.remove());
  }

  function renderControl() {
    const screen = scoring();
    if (!screen || !current) return removeControl();
    let node = screen.querySelector('[data-rp-race-target-correction]');
    if (!node) {
      node = document.createElement('section');
      node.className = 'rp-race-target-correction';
      node.dataset.rpRaceTargetCorrection = '1';
      const scoreboard = screen.querySelector('.rp-video-scoreboard');
      scoreboard?.insertAdjacentElement('beforebegin', node);
    }
    const original = Number(current.originalRules?.targetScore || 0);
    const effective = Number(current.effectiveRules?.targetScore || original || 0);
    const corrected = Boolean(current.correction && effective !== original);
    const signature = `${original}:${effective}:${corrected ? 1 : 0}`;
    if (node.dataset.rpRaceTargetSignature === signature) return;
    node.innerHTML = `<div class="rp-race-target-label"><span>RACE TARGET</span><strong>RACE TO ${effective}</strong><small>${corrected ? 'CORRECTED' : 'LOCKED RULE'}</small></div><button type="button" data-rp-race-target-edit>${corrected ? 'CORRECTED · EDIT' : 'EDIT TARGET'}</button>`;
    node.dataset.rpRaceTargetSignature = signature;
  }

  async function refresh() {
    if (!scoring() || loading) return;
    loading = true;
    try {
      const controlData = await request('/api/real-play/admin/career/control');
      const id = Number(controlData?.control?.session?.id || 0);
      if (!id) throw new Error('No active game.');
      const [rulesData, recordingData] = await Promise.all([
        request(`/api/real-play/admin/games/${id}/race-target-correction`),
        request(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(id)}`),
      ]);
      const allowed = Boolean(rulesData?.originalRules?.rulesetFamily === 'race_to'
        && rulesData?.gameRulesLockedAt && rulesData?.gamePhase === 'video_review'
        && rulesData?.gameStatus !== 'final' && !recordingData?.recording?.reviewCompletedAt);
      currentSessionId = id;
      current = allowed ? rulesData : null;
      renderControl();
    } catch (_) {
      current = null;
      removeControl();
    } finally {
      loading = false;
    }
  }

  function modal() {
    let node = document.querySelector('[data-rp-race-target-modal]');
    if (node) return node;
    node = document.createElement('div');
    node.className = 'rp-race-target-modal';
    node.dataset.rpRaceTargetModal = '1';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<div class="rp-race-target-backdrop" data-rp-race-target-cancel></div><section class="rp-race-target-dialog" role="dialog" aria-modal="true"><div class="rp-race-target-dialog-head"><div><span>ADMIN RULE CORRECTION</span><h2>ADJUST RACE TARGET</h2></div><button type="button" data-rp-race-target-cancel>×</button></div><div data-rp-race-target-modal-body></div></section>';
    document.body.appendChild(node);
    return node;
  }

  function closeModal() {
    const node = document.querySelector('[data-rp-race-target-modal]');
    node?.classList.remove('open');
    node?.setAttribute('aria-hidden', 'true');
  }

  function openModal() {
    if (!current) return;
    const node = modal();
    const body = node.querySelector('[data-rp-race-target-modal-body]');
    const original = Number(current.originalRules?.targetScore || 0);
    const effective = Number(current.effectiveRules?.targetScore || original || 0);
    const correction = current.correction || null;
    const at = correction?.correctedAt ? new Date(correction.correctedAt).toLocaleString() : '—';
    body.innerHTML = `<div class="rp-race-target-audit-grid"><div><span>ORIGINAL TARGET</span><strong>${original}</strong></div><div><span>${correction ? 'CURRENT CORRECTED TARGET' : 'CURRENT TARGET'}</span><strong>${effective}</strong></div></div>${correction ? `<div class="rp-race-target-existing"><p><span>CORRECTED BY</span><strong>${correction.correctedByUserId ? `ADMIN #${Number(correction.correctedByUserId)}` : 'REAL PLAY ADMIN'}</strong></p><p><span>CORRECTED AT</span><strong>${esc(at)}</strong></p><p class="wide"><span>REASON</span><strong>${esc(correction.reason || '—')}</strong></p></div>` : ''}<form data-rp-race-target-form><label>CORRECTED TARGET<input name="targetScore" type="number" inputmode="numeric" min="1" max="100" step="1" value="${effective}" required></label><label>REASON<textarea name="reason" maxlength="500" required placeholder="Actual recorded game was played Race to 9"></textarea></label><p class="rp-race-target-form-status" data-rp-race-target-status></p><div class="rp-race-target-actions"><button type="button" data-rp-race-target-cancel>CANCEL</button><button type="submit" class="save">SAVE CORRECTION</button></div></form>`;
    node.classList.add('open');
    node.setAttribute('aria-hidden', 'false');
  }

  async function save(form) {
    const data = new FormData(form);
    const status = form.querySelector('[data-rp-race-target-status]');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Saving audited correction…';
    try {
      await request(`/api/real-play/admin/games/${currentSessionId}/race-target-correction`, {
        method: 'POST',
        body: { targetScore: Number(data.get('targetScore')), reason: String(data.get('reason') || '').trim() },
      });
      await refresh();
      closeModal();
      renderControl();
    } catch (error) {
      if (status) status.textContent = error.message || 'Could not save correction.';
      if (submit) submit.disabled = false;
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (current) renderControl();
      else refresh();
    }, 90);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-race-target-edit]')) return openModal();
    if (event.target.closest('[data-rp-race-target-cancel]')) closeModal();
  }, true);
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-rp-race-target-form]');
    if (!form) return;
    event.preventDefault();
    save(form);
  }, true);

  window.addEventListener('realplay:admin-render', refresh);
  window.addEventListener('focus', refresh);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
