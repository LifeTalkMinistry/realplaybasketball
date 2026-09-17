(() => {
  // Deprecated compatibility shell.
  // Overall MVP is rendered by career-game-replay-stats.js from the verified
  // game recognition calculation. Keep this file inert so older cached app
  // loaders cannot install a second fetch/DOM authority.
  window.__realPlayReplayOfficialMvpInstalled = true;

  // Safari/iPad/iPhone replay coverage refinement.
  // IMPORTANT: this layer does NOT own or intercept the fullscreen button.
  // It only resizes the replay media after the existing fullscreen system has
  // already entered native or pseudo fullscreen, preserving the working click.
  if (!window.__realPlayReplaySafariCoverV2Requested) {
    window.__realPlayReplaySafariCoverV2Requested = true;
    const safariCover = document.createElement('script');
    safariCover.src = 'career-game-replay-safari-cover-v2.js?v=20260917-safari-cover-v2';
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
