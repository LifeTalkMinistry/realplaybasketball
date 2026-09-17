(() => {
  // Deprecated compatibility shell.
  // Overall MVP is rendered by career-game-replay-stats.js from the verified
  // game recognition calculation. Keep this file inert so older cached app
  // loaders cannot install a second fetch/DOM authority.
  window.__realPlayReplayOfficialMvpInstalled = true;

  // Load the Safari/iPhone immersive replay refinement after the main replay
  // fullscreen layer. This keeps the normal fullscreen path untouched while
  // making the iPhone pseudo-fullscreen fallback cover the usable viewport.
  if (!window.__realPlayReplaySafariImmersiveRequested) {
    window.__realPlayReplaySafariImmersiveRequested = true;
    const immersive = document.createElement('script');
    immersive.src = 'career-game-replay-safari-immersive.js?v=20260917-safari-immersive-v1';
    immersive.async = false;
    document.head.appendChild(immersive);
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
