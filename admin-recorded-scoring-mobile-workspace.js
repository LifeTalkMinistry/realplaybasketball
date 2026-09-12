(() => {
  if (window.__realPlayRecordedMobileWorkspaceInstalled) return;
  window.__realPlayRecordedMobileWorkspaceInstalled = true;

  const MOBILE_MEDIA = '(max-width:1099px)';
  let syncTimer = 0;

  function scoringScreen() {
    return document.querySelector('.rp-admin-control .rp-video-scoring-screen');
  }

  function scheduleSync() {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncWorkspace, 0);
  }

  function clearInline(node, property) {
    if (!node) return;
    node.style.removeProperty(property);
    if (!node.getAttribute('style')) node.removeAttribute('style');
  }

  function findExitScoring(screen) {
    return [...screen.querySelectorAll('button')].find((button) => (
      String(button.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase().includes('EXIT SCORING')
    )) || null;
  }

  function restoreScoreboardStyle(scoreboard) {
    if (!scoreboard) return;
    ['width','min-width','max-width','height','min-height','padding','margin','gap','border-radius','align-self','box-sizing'].forEach((property) => clearInline(scoreboard, property));
    scoreboard.querySelectorAll('small').forEach((node) => {
      ['font-size','letter-spacing'].forEach((property) => clearInline(node, property));
    });
    scoreboard.querySelectorAll('strong').forEach((node) => {
      ['font-size','line-height'].forEach((property) => clearInline(node, property));
    });
    const dash = scoreboard.querySelector(':scope > span');
    if (dash) ['font-size','margin'].forEach((property) => clearInline(dash, property));
  }

  function restoreDesktopTopRow(screen, scoreboard) {
    const row = screen.querySelector('[data-rp-mobile-score-row]');
    if (!row) {
      restoreScoreboardStyle(scoreboard);
      return;
    }

    const exitButton = findExitScoring(screen);
    const playerWrap = screen.querySelector('.rp-video-player-wrap');

    if (exitButton) row.insertAdjacentElement('beforebegin', exitButton);
    if (scoreboard && playerWrap) playerWrap.insertAdjacentElement('afterend', scoreboard);
    row.remove();
    restoreScoreboardStyle(scoreboard);
  }

  function ensureCompactTopRow(screen, scoreboard, playerWrap) {
    const exitButton = findExitScoring(screen);
    if (!exitButton || !scoreboard || !playerWrap) return;

    let row = screen.querySelector('[data-rp-mobile-score-row]');
    if (!row) {
      row = document.createElement('div');
      row.dataset.rpMobileScoreRow = '1';
      playerWrap.insertAdjacentElement('beforebegin', row);
    }

    row.style.setProperty('display', 'grid', 'important');
    row.style.setProperty('grid-template-columns', 'minmax(0, 1fr) minmax(150px, .95fr)', 'important');
    row.style.setProperty('align-items', 'stretch', 'important');
    row.style.setProperty('gap', '10px', 'important');
    row.style.setProperty('width', '100%', 'important');
    row.style.setProperty('box-sizing', 'border-box', 'important');

    if (exitButton.parentElement !== row) row.appendChild(exitButton);
    if (scoreboard.parentElement !== row) row.appendChild(scoreboard);

    // The scoreboard is intentionally compact here: same live data, reduced chrome.
    scoreboard.style.setProperty('width', '100%', 'important');
    scoreboard.style.setProperty('min-width', '0', 'important');
    scoreboard.style.setProperty('max-width', 'none', 'important');
    scoreboard.style.setProperty('height', 'auto', 'important');
    scoreboard.style.setProperty('min-height', '58px', 'important');
    scoreboard.style.setProperty('padding', '8px 10px', 'important');
    scoreboard.style.setProperty('margin', '0', 'important');
    scoreboard.style.setProperty('gap', '5px', 'important');
    scoreboard.style.setProperty('border-radius', '12px', 'important');
    scoreboard.style.setProperty('align-self', 'stretch', 'important');
    scoreboard.style.setProperty('box-sizing', 'border-box', 'important');

    scoreboard.querySelectorAll('small').forEach((node) => {
      node.style.setProperty('font-size', '6px', 'important');
      node.style.setProperty('letter-spacing', '.1em', 'important');
    });
    scoreboard.querySelectorAll('strong').forEach((node) => {
      node.style.setProperty('font-size', '24px', 'important');
      node.style.setProperty('line-height', '.9', 'important');
    });
    const dash = scoreboard.querySelector(':scope > span');
    if (dash) {
      dash.style.setProperty('font-size', '12px', 'important');
      dash.style.setProperty('margin', '0 1px', 'important');
    }

    // Keep the exit button naturally sized while filling the same row height.
    exitButton.style.setProperty('width', '100%', 'important');
    exitButton.style.setProperty('margin', '0', 'important');
    exitButton.style.setProperty('align-self', 'stretch', 'important');
  }

  function syncWorkspace() {
    syncTimer = 0;
    const screen = scoringScreen();
    if (!screen) return;

    const playerWrap = screen.querySelector('.rp-video-player-wrap');
    const rosters = screen.querySelector('.rp-video-score-rosters');
    const selectedPanel = screen.querySelector('[data-rp-video-selected-panel]');
    const scoreboard = screen.querySelector('.rp-video-scoreboard');
    const activeButton = screen.querySelector('.rp-video-score-player.active[data-rp-video-select-player]');
    const selectedDraft = selectedPanel?.querySelector('.rp-video-draft-panel[data-rp-draft-player-id]');
    const hasPlayer = Boolean(activeButton || selectedDraft);

    if (!window.matchMedia(MOBILE_MEDIA).matches) {
      screen.classList.remove('rp-mobile-player-workspace');
      clearInline(rosters, 'display');
      clearInline(selectedPanel, 'display');
      restoreDesktopTopRow(screen, scoreboard);
      return;
    }

    screen.classList.toggle('rp-mobile-player-workspace', hasPlayer);

    // Mobile top bar: Exit Scoring on the left, compact live score on the right.
    ensureCompactTopRow(screen, scoreboard, playerWrap);

    // Player selection and selected-player controls share the same workspace
    // below the video/timeline.
    if (selectedPanel && rosters && selectedPanel.previousElementSibling !== rosters) {
      rosters.insertAdjacentElement('afterend', selectedPanel);
    }

    if (hasPlayer) {
      rosters?.style.setProperty('display', 'none', 'important');
      selectedPanel?.style.removeProperty('display');
      if (selectedPanel && !selectedPanel.getAttribute('style')) selectedPanel.removeAttribute('style');
    } else {
      clearInline(rosters, 'display');
      selectedPanel?.style.setProperty('display', 'none', 'important');
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-video-select-player], [data-rp-video-close-player]')) return;
    window.requestAnimationFrame(() => {
      scheduleSync();
      window.setTimeout(scheduleSync, 40);
    });
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (!scoringScreen()) return;
    if (mutations.some((mutation) => (
      mutation.type === 'childList'
      || mutation.type === 'attributes'
    ))) scheduleSync();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.addEventListener('resize', scheduleSync);
  window.addEventListener('realplay:admin-render', scheduleSync);
  scheduleSync();
})();
