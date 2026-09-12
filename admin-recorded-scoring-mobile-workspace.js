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
    return screen.querySelector('[data-rp-exit-scoring]') || [...screen.querySelectorAll('button')].find((button) => (
      String(button.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase().includes('EXIT SCORING')
    )) || null;
  }

  function restoreScoreboardStyle(scoreboard) {
    if (!scoreboard) return;
    ['width','min-width','max-width','height','min-height','padding','margin','gap','border-radius','align-self','box-sizing','flex'].forEach((property) => clearInline(scoreboard, property));
    scoreboard.querySelectorAll('small').forEach((node) => {
      ['font-size','letter-spacing'].forEach((property) => clearInline(node, property));
    });
    scoreboard.querySelectorAll('strong').forEach((node) => {
      ['font-size','line-height'].forEach((property) => clearInline(node, property));
    });
    const dash = scoreboard.querySelector(':scope > span');
    if (dash) ['font-size','margin'].forEach((property) => clearInline(dash, property));
  }

  function restoreTopRowStyle(row, exitButton) {
    if (row) {
      ['display','grid-template-columns','align-items','justify-content','gap','width','box-sizing','min-height'].forEach((property) => clearInline(row, property));
      row.removeAttribute('data-rp-mobile-score-row');
    }
    if (exitButton) {
      ['width','margin','align-self','flex'].forEach((property) => clearInline(exitButton, property));
    }
  }

  function restoreDesktopTopRow(screen, scoreboard) {
    const exitButton = findExitScoring(screen);
    const exitRow = screen.querySelector('.rp-video-scoring-exit-row');
    const legacyRow = screen.querySelector('[data-rp-mobile-score-row]:not(.rp-video-scoring-exit-row)');
    const playerWrap = screen.querySelector('.rp-video-player-wrap');

    // Clean up the older temporary mobile row if it exists from a cached render.
    if (legacyRow) {
      if (exitButton && exitRow && exitButton.parentElement !== exitRow) exitRow.appendChild(exitButton);
      legacyRow.remove();
    }

    if (scoreboard && playerWrap) playerWrap.insertAdjacentElement('afterend', scoreboard);
    restoreTopRowStyle(exitRow, exitButton);
    restoreScoreboardStyle(scoreboard);
  }

  function ensureCompactTopRow(screen, scoreboard) {
    const exitButton = findExitScoring(screen);
    const exitRow = exitButton?.closest('.rp-video-scoring-exit-row') || screen.querySelector('.rp-video-scoring-exit-row');
    if (!exitButton || !exitRow || !scoreboard) return;

    // The existing EXIT SCORING row is the mobile top bar. Keep it at the very
    // top of the scoring screen and put the live score directly beside it.
    if (screen.firstElementChild !== exitRow) screen.prepend(exitRow);
    exitRow.dataset.rpMobileScoreRow = '1';
    exitRow.style.setProperty('display', 'grid', 'important');
    exitRow.style.setProperty('grid-template-columns', 'auto minmax(132px, 1fr)', 'important');
    exitRow.style.setProperty('align-items', 'stretch', 'important');
    exitRow.style.setProperty('justify-content', 'stretch', 'important');
    exitRow.style.setProperty('gap', '8px', 'important');
    exitRow.style.setProperty('width', '100%', 'important');
    exitRow.style.setProperty('min-height', '34px', 'important');
    exitRow.style.setProperty('box-sizing', 'border-box', 'important');

    if (exitButton.parentElement !== exitRow) exitRow.prepend(exitButton);
    if (scoreboard.parentElement !== exitRow) exitRow.appendChild(scoreboard);

    // Compact score: same live score data, but sized like a top-bar control.
    scoreboard.style.setProperty('width', '100%', 'important');
    scoreboard.style.setProperty('min-width', '0', 'important');
    scoreboard.style.setProperty('max-width', 'none', 'important');
    scoreboard.style.setProperty('height', '34px', 'important');
    scoreboard.style.setProperty('min-height', '34px', 'important');
    scoreboard.style.setProperty('padding', '3px 9px', 'important');
    scoreboard.style.setProperty('margin', '0', 'important');
    scoreboard.style.setProperty('gap', '5px', 'important');
    scoreboard.style.setProperty('border-radius', '9px', 'important');
    scoreboard.style.setProperty('align-self', 'stretch', 'important');
    scoreboard.style.setProperty('box-sizing', 'border-box', 'important');
    scoreboard.style.setProperty('flex', '1 1 auto', 'important');

    scoreboard.querySelectorAll('small').forEach((node) => {
      node.style.setProperty('font-size', '6px', 'important');
      node.style.setProperty('letter-spacing', '.09em', 'important');
    });
    scoreboard.querySelectorAll('strong').forEach((node) => {
      node.style.setProperty('font-size', '18px', 'important');
      node.style.setProperty('line-height', '.9', 'important');
    });
    const dash = scoreboard.querySelector(':scope > span');
    if (dash) {
      dash.style.setProperty('font-size', '10px', 'important');
      dash.style.setProperty('margin', '0', 'important');
    }

    // Exit stays small; it should not expand to half of the screen.
    exitButton.style.setProperty('width', 'auto', 'important');
    exitButton.style.setProperty('margin', '0', 'important');
    exitButton.style.setProperty('align-self', 'stretch', 'important');
    exitButton.style.setProperty('flex', '0 0 auto', 'important');
  }

  function syncWorkspace() {
    syncTimer = 0;
    const screen = scoringScreen();
    if (!screen) return;

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

    // Mobile top bar: Exit Scoring on the left, compact live score immediately beside it.
    ensureCompactTopRow(screen, scoreboard);

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
