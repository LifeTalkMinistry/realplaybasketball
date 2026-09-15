(() => {
  if (window.__realPlayRecordedYouTubeKeyboardInstalled) return;
  window.__realPlayRecordedYouTubeKeyboardInstalled = true;

  const SCORING_SHELL = '.rp-youtube-player-shell[data-rp-youtube-player-shell="scoring"]';
  const SCORING_SCREEN = '.rp-admin-control .rp-video-scoring-screen';

  const isTextEntry = (target) => {
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) {
      return true;
    }
    if (!(target instanceof HTMLInputElement)) return false;

    // Space is a global scorer transport shortcut. Range/button-like inputs do
    // not contain typed text and must not suppress play/pause just because they
    // currently own focus (for example after scrubbing the video timeline).
    const type = String(target.type || 'text').toLowerCase();
    return !['range', 'button', 'checkbox', 'radio', 'submit', 'reset'].includes(type);
  };

  function scoringPlayerShell() {
    const shell = document.querySelector(SCORING_SHELL);
    return shell?.isConnected ? shell : null;
  }

  function restoreKeyboardFocusFromYouTubeIframe() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLIFrameElement)) return;
      if (!active.closest(SCORING_SHELL)) return;

      const scoring = document.querySelector(SCORING_SCREEN);
      if (!scoring?.isConnected) return;

      // Clicking the cross-origin YouTube iframe transfers keyboard focus away
      // from the parent document. Return focus to the scoring workspace after
      // the click has been delivered so Space/C continue to belong to Real Play.
      if (!scoring.hasAttribute('tabindex')) scoring.setAttribute('tabindex', '-1');
      try { scoring.focus({ preventScroll: true }); } catch (_) { scoring.focus(); }
    }, 0);
  }

  function togglePlaybackDirectly(playerShell) {
    const playback = playerShell.querySelector('[data-rp-recorded-video]');
    if (!playback) return false;

    try {
      if (playback.paused) playback.play?.();
      else playback.pause?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleKeydown(event) {
    if (event.repeat || isTextEntry(event.target)) return;

    const playerShell = scoringPlayerShell();
    if (!playerShell) return;

    const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (isSpace) {
      // Space belongs exclusively to scorer video transport. Do not route it
      // through playButton.click(): a synthetic click can collide with the
      // focused button's native Space activation and can be less reliable for
      // iframe-hosted media. Call the existing playback proxy directly instead.
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePlaybackDirectly(playerShell);
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
  }

  document.addEventListener('keydown', handleKeydown, true);

  // A cross-origin iframe gets its own keyboard event stream once clicked.
  // Detect that focus handoff and immediately restore parent scoring focus.
  window.addEventListener('blur', restoreKeyboardFocusFromYouTubeIframe);
})();
