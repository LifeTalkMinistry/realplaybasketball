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
  let revealFallbackTimer = null;
  let rulesTimer = null;
  let rulesLoadPromise = null;
  let savedRaceRules = null;

  function installDesktopBootStyle() {
    if (document.querySelector('[data-rp-recorded-desktop-boot-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpRecordedDesktopBootStyle = '1';
    style.textContent = `
      @media (min-width:700px){
        .rp-admin-control.rp-recorded-desktop-pending .rp-video-scoring-screen{
          visibility:hidden!important;
        }
        .rp-admin-control.rp-recorded-desktop-pending .rp-video-scoring-screen.rp-video-desktop-ready{
          visibility:visible!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function raceForm() {
    return root()?.querySelector('[data-rp-video-race-form]') || null;
  }

  function setDesktopPending(adminRoot, pending) {
    if (!adminRoot) return;
    adminRoot.classList.toggle('rp-recorded-desktop-pending', Boolean(pending));
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer);
      revealFallbackTimer = null;
    }
    if (pending) {
      // Never allow a failed enhancement to leave the scoring screen hidden.
      revealFallbackTimer = setTimeout(() => {
        adminRoot.classList.remove('rp-recorded-desktop-pending');
        revealFallbackTimer = null;
      }, 700);
    }
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
    if (![8, 12, 16, 21].includes(target) || !['3v3', '4v4', '5v5'].includes(format)) return null;

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

  function restoreMobileLayout(adminRoot, scoring) {
    setDesktopPending(adminRoot, false);
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
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    const rosters = scoring.querySelector('.rp-video-score-rosters');
    const selectedPanel = scoring.querySelector('[data-rp-video-selected-panel]');
    const reviewActions = scoring.querySelector('.rp-video-review-actions');

    const anchor = grids[0];
    [playerWrap, autoNote, draftBanner, cancelCard, scoreboard, rosters, selectedPanel, reviewActions]
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

    moveIfNeeded(scoring.querySelector('.rp-video-scoreboard'), right);
    moveIfNeeded(scoring.querySelector('.rp-video-score-rosters'), right);
    moveIfNeeded(scoring.querySelector('[data-rp-video-selected-panel]'), right);
    moveIfNeeded(scoring.querySelector('.rp-video-review-actions'), right);

    return { left, right };
  }

  function settleDesktopOwnership(scoring, grid) {
    const adminRoot = root();
    const columns = syncDesktopColumns(scoring, grid);
    if (!columns) return false;

    // There must only ever be one desktop workspace. If a stale duplicate grid
    // exists, move the known scoring nodes into the active grid first, then remove it.
    [...scoring.querySelectorAll(':scope > [data-rp-video-desktop-grid]')]
      .filter((candidate) => candidate !== grid)
      .forEach((candidate) => candidate.remove());

    const playerWrap = scoring.querySelector('.rp-video-player-wrap');
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    const stable = Boolean(
      playerWrap
      && scoreboard
      && playerWrap.parentElement === columns.left
      && scoreboard.parentElement === columns.right
    );
    scoring.dataset.rpDesktopOwnershipStable = stable ? '1' : '0';

    if (!stable) {
      if (playerWrap && playerWrap.parentElement !== columns.left) columns.left.appendChild(playerWrap);
      if (scoreboard && scoreboard.parentElement !== columns.right) columns.right.appendChild(scoreboard);
    }

    const finalStable = Boolean(
      playerWrap
      && scoreboard
      && playerWrap.parentElement === columns.left
      && scoreboard.parentElement === columns.right
    );
    scoring.dataset.rpDesktopOwnershipStable = finalStable ? '1' : '0';
    if (finalStable) {
      scoring.classList.add('rp-video-desktop-ready');
      setDesktopPending(adminRoot, false);
    }
    return finalStable;
  }

  function applyDesktopLayout() {
    const adminRoot = root();
    const scoring = screen();

    syncScoringChrome(adminRoot, scoring);

    if (!adminRoot || !scoring) {
      setDesktopPending(adminRoot, false);
      adminRoot?.classList.remove('rp-recorded-desktop-mode');
      return;
    }

    if (!window.matchMedia(DESKTOP_MEDIA).matches) {
      restoreMobileLayout(adminRoot, scoring);
      return;
    }

    adminRoot.classList.add('rp-recorded-desktop-mode');

    let grid = scoring.querySelector(':scope > [data-rp-video-desktop-grid]');
    if (grid) {
      if (!settleDesktopOwnership(scoring, grid)) setDesktopPending(adminRoot, true);
      return;
    }

    const playerWrap = scoring.querySelector('.rp-video-player-wrap');
    const scoreboard = scoring.querySelector('.rp-video-scoreboard');
    if (!playerWrap || !scoreboard) {
      scoring.classList.remove('rp-video-desktop-ready');
      setDesktopPending(adminRoot, true);
      return;
    }

    setDesktopPending(adminRoot, true);

    grid = document.createElement('div');
    grid.className = 'rp-video-desktop-grid';
    grid.dataset.rpVideoDesktopGrid = '1';

    const left = document.createElement('section');
    left.className = 'rp-video-desktop-left';
    left.dataset.rpVideoDesktopLeft = '1';

    const right = document.createElement('section');
    right.className = 'rp-video-desktop-right';
    right.dataset.rpVideoDesktopRight = '1';

    playerWrap.insertAdjacentElement('beforebegin', grid);
    grid.append(left, right);
    settleDesktopOwnership(scoring, grid);
  }

  function scheduleLayout() {
    // First pass is synchronous so wide screens never sit in the temporary
    // stacked/mobile structure while waiting for a debounce timer.
    applyDesktopLayout();

    if (layoutTimer) clearTimeout(layoutTimer);
    window.requestAnimationFrame(applyDesktopLayout);
    layoutTimer = setTimeout(() => {
      layoutTimer = null;
      applyDesktopLayout();
    }, 45);
    scheduleRulesSync(false);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-rp-video-race-form]');
    if (!form) return;

    const target = Number(form.querySelector('select[name="target"]')?.value || 0);
    const format = String(form.querySelector('select[name="format"]')?.value || '').trim().toLowerCase();
    if ([8, 12, 16, 21].includes(target) && ['3v3', '4v4', '5v5'].includes(format)) {
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

  installDesktopBootStyle();

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type !== 'childList') return false;
      return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
        node.nodeType === 1 && (
          node.matches?.('.rp-video-scoring-screen,.rp-video-player-wrap,.rp-video-scoreboard,.rp-video-score-rosters,[data-rp-video-selected-panel],.rp-video-review-actions,[data-rp-draft-banner]')
          || node.querySelector?.('.rp-video-scoring-screen,.rp-video-player-wrap,.rp-video-scoreboard,.rp-video-score-rosters,[data-rp-video-selected-panel],.rp-video-review-actions,[data-rp-draft-banner]')
        )
      ));
    });
    if (relevant) scheduleLayout();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', () => {
    scheduleLayout();
    scheduleRulesSync(true);
  });
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('focus', () => {
    scheduleLayout();
    scheduleRulesSync(true);
  });

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
