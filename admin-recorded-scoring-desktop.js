(() => {
  if (window.__realPlayRecordedDesktopInstalled) return;
  window.__realPlayRecordedDesktopInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DESKTOP_MEDIA = '(min-width:1100px)';

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
    if (!scoring) return;

    const grid = scoring.querySelector('[data-rp-video-desktop-grid]');
    if (!grid) return;

    const playerWrap = grid.querySelector('.rp-video-player-wrap');
    const autoNote = grid.querySelector('.rp-video-auto-note');
    const draftBanner = grid.querySelector('[data-rp-draft-banner]');
    const cancelCard = grid.querySelector('[data-rp-cancel-video-card]');
    const scoreboard = grid.querySelector('.rp-video-scoreboard');
    const rosters = grid.querySelector('.rp-video-score-rosters');
    const selectedPanel = grid.querySelector('[data-rp-video-selected-panel]');
    const reviewActions = grid.querySelector('.rp-video-review-actions');

    const anchor = grid;
    [playerWrap, autoNote, draftBanner, cancelCard, scoreboard, rosters, selectedPanel, reviewActions]
      .filter(Boolean)
      .forEach((node) => scoring.insertBefore(node, anchor));

    grid.remove();
  }

  function applyDesktopLayout() {
    const adminRoot = root();
    const scoring = screen();

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

    const existing = scoring.querySelector('[data-rp-video-desktop-grid]');
    if (existing) return;

    const playerWrap = scoring.querySelector('.rp-video-player-wrap');
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    const rosters = scoring.querySelector('.rp-video-score-rosters');
    const selectedPanel = scoring.querySelector('[data-rp-video-selected-panel]');
    const reviewActions = scoring.querySelector('.rp-video-review-actions');

    if (!playerWrap || !scoreboard || !rosters || !selectedPanel || !reviewActions) return;

    const grid = document.createElement('div');
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

    left.appendChild(playerWrap);

    const autoNote = scoring.querySelector('.rp-video-auto-note');
    if (autoNote) left.appendChild(autoNote);

    const draftBanner = scoring.querySelector('[data-rp-draft-banner]');
    if (draftBanner) left.appendChild(draftBanner);

    const cancelCard = scoring.querySelector('[data-rp-cancel-video-card]');
    if (cancelCard) left.appendChild(cancelCard);

    right.append(scoreboard, rosters, selectedPanel, reviewActions);
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