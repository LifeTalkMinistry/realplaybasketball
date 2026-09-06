(() => {
  if (window.__realPlayRecordedDraftGuardInstalled) return;
  window.__realPlayRecordedDraftGuardInstalled = true;

  const selector = '[data-rp-video-shot], [data-rp-video-stat], [data-rp-video-undo], [data-rp-video-finish]';
  let retrying = false;

  function scoringScreen() {
    return document.querySelector('.rp-admin-control [data-admin-body] .rp-video-scoring-screen');
  }

  function replayTarget(original) {
    const screen = scoringScreen();
    if (!screen) return null;
    if (original.matches('[data-rp-video-shot]')) {
      return screen.querySelector(`[data-rp-video-shot][data-value="${original.dataset.value}"][data-result="${original.dataset.result}"]`);
    }
    if (original.matches('[data-rp-video-stat]')) {
      return screen.querySelector(`[data-rp-video-stat="${original.dataset.rpVideoStat}"]`);
    }
    if (original.matches('[data-rp-video-undo]')) return screen.querySelector('[data-rp-video-undo]');
    if (original.matches('[data-rp-video-finish]')) return screen.querySelector('[data-rp-video-finish]');
    return null;
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest(selector);
    if (!target || !scoringScreen() || window.__realPlayRecordedScoringDraftActive) return;

    // Fail closed: while the local score sheet is booting, never allow a tap
    // to fall through to the retired per-event backend scorer.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (retrying) return;
    retrying = true;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.__realPlayRecordedScoringDraftActive) {
        window.clearInterval(timer);
        retrying = false;
        const next = replayTarget(target);
        next?.click();
        return;
      }
      if (attempts >= 30 || !scoringScreen()) {
        window.clearInterval(timer);
        retrying = false;
      }
    }, 50);
  }, true);
})();
