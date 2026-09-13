(() => {
  if (window.__realPlayRecordedYouTubeKeyboardInstalled) return;
  window.__realPlayRecordedYouTubeKeyboardInstalled = true;

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;

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

    const playButton = playerShell.querySelector('[data-rp-youtube-play]');
    if (!playButton || playButton.disabled) return;

    event.preventDefault();
    playButton.click();
  });
})();
