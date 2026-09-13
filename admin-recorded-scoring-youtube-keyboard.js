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

    const playerShell = document.querySelector(
      '.rp-youtube-player-shell[data-rp-youtube-player-shell="scoring"]'
    );
    if (!playerShell?.isConnected) return;

    if (event.code === 'Space') {
      const playButton = playerShell.querySelector('[data-rp-youtube-play]');
      if (!playButton || playButton.disabled) return;

      // Space is a dedicated scoring shortcut. Capture it before a focused
      // button can receive the browser's native Space activation (which could
      // otherwise repeat the last scoring action).
      event.preventDefault();
      event.stopPropagation();
      playButton.click();
      return;
    }

    if (event.code === 'KeyC') {
      // The player controls and the local score sheet are sibling sections;
      // the cancel button is therefore not inside the YouTube player shell.
      // Target the actual score-card close control in the scoring screen.
      const cancelButton = document.querySelector(
        '.rp-video-scoring-screen [data-rp-video-close-player]'
      );
      if (!cancelButton || cancelButton.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      cancelButton.click();
    }
  }, true);
})();
