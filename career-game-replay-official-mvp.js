(() => {
  // Deprecated compatibility shell.
  // Overall MVP is rendered by career-game-replay-stats.js from the verified
  // game recognition calculation. Keep this file inert so older cached app
  // loaders cannot install a second fetch/DOM authority.
  window.__realPlayReplayOfficialMvpInstalled = true;

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
