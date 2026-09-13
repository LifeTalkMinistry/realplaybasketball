(() => {
  if (window.__realPlayRecordedYouTubeKeyboardInstalled) return;
  window.__realPlayRecordedYouTubeKeyboardInstalled = true;

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement ||
      target?.isContentEditable
    ) return;

    const playerShell = document.querySelector(
      '.rp-youtube-player-shell[data-rp-youtube-player-shell="scoring"]'
    );
    if (!playerShell?.isConnected) return;

    if (event.code === 'Space') {
      const playButton = playerShell.querySelector('[data-rp-youtube-play]');
      if (!playButton || playButton.disabled) return;

      event.preventDefault();
      playButton.click();
      return;
    }

    if (event.code === 'KeyC') {
      const cancelButton = document.querySelector('[data-rp-video-close-player]');
      if (!cancelButton || cancelButton.disabled) return;

      event.preventDefault();
      cancelButton.click();
    }
  });
})();
