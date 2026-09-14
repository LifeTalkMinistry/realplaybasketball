(() => {
  if (window.__realPlayRecordedYouTubeKeyboardInstalled) return;
  window.__realPlayRecordedYouTubeKeyboardInstalled = true;

  const isTextEntry = (target) => (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable
  );

  document.addEventListener('keydown', (event) => {
    if (event.repeat || isTextEntry(event.target)) return;

    // C controls the local score card. Keep this independent from the
    // YouTube player shell because the score card is a separate mobile/desktop
    // section and can be rendered outside the player shell.
    if (event.key?.toLowerCase() === 'c') {
      const scoringScreen = document.querySelector('.rp-video-scoring-screen');
      if (!scoringScreen?.isConnected) return;

      const cancelButton = scoringScreen.querySelector('[data-rp-video-close-player]');
      if (!cancelButton || cancelButton.disabled) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      cancelButton.click();
      return;
    }

    if (event.code !== 'Space') return;

    const playerShell = document.querySelector(
      '.rp-youtube-player-shell[data-rp-youtube-player-shell="scoring"]'
    );
    if (!playerShell?.isConnected) return;

    const playButton = playerShell.querySelector('[data-rp-youtube-play]');
    if (!playButton || playButton.disabled) return;

    // Space is a dedicated scoring shortcut. Capture it before a focused
    // button can receive the browser's native Space activation (which could
    // otherwise repeat the last scoring action).
    event.preventDefault();
    event.stopImmediatePropagation();
    playButton.click();
  }, true);
})();
