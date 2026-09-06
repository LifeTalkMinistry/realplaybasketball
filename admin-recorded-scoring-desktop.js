(() => {
  if (window.__realPlayRecordedDesktopInstalled) return;
  window.__realPlayRecordedDesktopInstalled = true;

  let layoutTimer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function panelTitleHtml() {
    return `
      <div class="rp-video-desktop-panel-title" data-rp-video-desktop-panel-title>
        <span>DRAFT SCORE SHEET</span>
        <strong>SCORE DESK</strong>
        <small>Select a player, then record the event without losing sight of the game.</small>
      </div>`;
  }

  function applyDesktopLayout() {
    const adminRoot = root();
    const scoring = screen();

    if (!adminRoot || !scoring) {
      adminRoot?.classList.remove('rp-recorded-desktop-mode');
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
  }

  const observer = new MutationObserver(scheduleLayout);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', scheduleLayout);
  window.addEventListener('resize', scheduleLayout);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleLayout, { once: true });
  } else {
    scheduleLayout();
  }
})();