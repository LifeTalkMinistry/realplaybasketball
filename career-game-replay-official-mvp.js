(() => {
  // Deprecated compatibility shell.
  // Overall MVP is rendered by career-game-replay-stats.js from the verified
  // game recognition calculation. Keep this file inert so older cached app
  // loaders cannot install a second fetch/DOM authority.
  window.__realPlayReplayOfficialMvpInstalled = true;

  // Recorded Game Audit should behave as one continuous scroll surface.
  // The replay page itself already owns vertical scrolling; remove the sticky
  // header behavior so the back/title/admin row scrolls away with the score,
  // video, timeline, stats, and comments instead of remaining pinned above them.
  if (!document.getElementById('rp-career-replay-scrollable-header-fix')) {
    const scrollableHeaderStyle = document.createElement('style');
    scrollableHeaderStyle.id = 'rp-career-replay-scrollable-header-fix';
    scrollableHeaderStyle.textContent = `
      .rp-career-replay-topbar{
        position:relative!important;
        top:auto!important;
      }
    `;
    document.head.appendChild(scrollableHeaderStyle);
  }

  // iPhone replay coverage refinement.
  // IMPORTANT: this layer does NOT own, replace, or intercept the fullscreen
  // button. The existing fullscreen-back layer remains the sole click authority.
  // This script only resizes the media after pseudo-fullscreen is already active.
  if (!window.__realPlayReplaySafariCoverV3Requested) {
    window.__realPlayReplaySafariCoverV3Requested = true;
    const safariCover = document.createElement('script');
    safariCover.src = 'career-game-replay-safari-cover-v3.js?v=20260917-safari-cover-v3';
    safariCover.async = false;
    document.head.appendChild(safariCover);
  }

  // iPhone native fullscreen cannot display Real Play HTML overlays. Keep the
  // working native fullscreen button and provide a second GAME SKIPS control.
  // Tapping a basket reuses the official seven-second marker, then immediately
  // opens the selected play in the same native fullscreen path.
  if (!window.__realPlayIPhoneGameSkipsRequested) {
    window.__realPlayIPhoneGameSkipsRequested = true;
    const gameSkips = document.createElement('script');
    gameSkips.src = 'career-game-replay-iphone-game-skips.js?v=20260917-iphone-game-skips-v1';
    gameSkips.async = false;
    document.head.appendChild(gameSkips);
  }

  // Load the replay-admin bridge after the existing replay editor has installed.
  // This keeps the pencil responsive even when the heavy Admin/Game Control
  // bundle has not been opened yet in the current browser session.
  const loadBridge = () => {
    if (window.__realPlayReplayAdminEditBridgeInstalled) return;
    if (!window.__realPlayReplayAdminEditInstalled) {
      window.setTimeout(loadBridge, 120);
      return;
    }
    const script = document.createElement('script');
    script.src = 'career-game-replay-admin-edit-bridge.js?v=20260915-replay-edit-bridge-v1';
    script.async = false;
    document.head.appendChild(script);
  };
  loadBridge();
})();
