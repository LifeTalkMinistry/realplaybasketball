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
      return;
    }

    screen.classList.toggle('rp-mobile-player-workspace', hasPlayer);

    // Keep the live score immediately above the video on mobile. This uses the
    // existing scoreboard node, so all score updates continue to hit one source.
    if (scoreboard && playerWrap && scoreboard.nextElementSibling !== playerWrap) {
      playerWrap.insertAdjacentElement('beforebegin', scoreboard);
    }

    // Player selection and selected-player controls share the same workspace
    // below the video/timeline. The selected panel must no longer use the
    // scoreboard as its anchor now that the scoreboard lives above the video.
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
