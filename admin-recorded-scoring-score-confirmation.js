(() => {
  if (window.__realPlayScoreConfirmationInstalled) return;
  window.__realPlayScoreConfirmationInstalled = true;

  let hideTimer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('[data-admin-body] .rp-video-scoring-screen') || null;
  }

  function activePlayerButton() {
    return scoringScreen()?.querySelector('.rp-video-score-player.active[data-rp-video-select-player]') || null;
  }

  function playerName() {
    const button = activePlayerButton();
    return String(button?.textContent || '').trim().replace(/\s+/g, ' ');
  }

  function playerTeam() {
    const button = activePlayerButton();
    const team = String(button?.closest('.rp-video-score-team')?.querySelector('.rp-video-score-team-head strong')?.textContent || '').trim().toLowerCase();
    return team === 'east' ? 'east' : 'west';
  }

  function currentTimeLabel() {
    return String(scoringScreen()?.querySelector('[data-rp-video-time]')?.textContent || '').trim();
  }

  function overlayHost() {
    const screen = scoringScreen();
    if (!screen) return null;

    const youtubeStage = screen.querySelector('.rp-youtube-stage');
    if (youtubeStage) {
      youtubeStage.classList.add('rp-score-confirm-host');
      return youtubeStage;
    }

    const video = screen.querySelector('video[data-rp-recorded-video]');
    if (!video) return null;
    const existing = video.closest('.rp-score-confirm-stage');
    if (existing) return existing;

    const wrapper = document.createElement('div');
    wrapper.className = 'rp-score-confirm-stage rp-score-confirm-host';
    video.parentNode?.insertBefore(wrapper, video);
    wrapper.appendChild(video);
    return wrapper;
  }

  function ensureOverlay() {
    const host = overlayHost();
    if (!host) return null;
    let overlay = host.querySelector(':scope > [data-rp-score-confirmation]');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'rp-score-confirm-overlay';
    overlay.dataset.rpScoreConfirmation = '1';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <span class="rp-score-confirm-kicker">SCORE CONFIRMED</span>
      <strong class="rp-score-confirm-name" data-rp-score-confirm-name></strong>
      <div class="rp-score-confirm-meta">
        <span><i data-rp-score-confirm-shot></i><i class="rp-score-confirm-time" data-rp-score-confirm-time></i></span>
        <b data-rp-score-confirm-points></b>
      </div>`;
    host.appendChild(overlay);
    return overlay;
  }

  function hideConfirmation() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const overlay = scoringScreen()?.querySelector('[data-rp-score-confirmation]');
    overlay?.classList.remove('show');
  }

  function showConfirmation(shotValue) {
    if (!window.__realPlayRecordedScoringDraftActive) return;
    const name = playerName();
    if (!name) return;

    const overlay = ensureOverlay();
    if (!overlay) return;

    const value = Number(shotValue) === 2 ? 2 : 1;
    overlay.dataset.team = playerTeam();
    const nameNode = overlay.querySelector('[data-rp-score-confirm-name]');
    const shotNode = overlay.querySelector('[data-rp-score-confirm-shot]');
    const pointsNode = overlay.querySelector('[data-rp-score-confirm-points]');
    const timeNode = overlay.querySelector('[data-rp-score-confirm-time]');

    if (nameNode) nameNode.textContent = name;
    if (shotNode) shotNode.textContent = `${value}PT MADE`;
    if (pointsNode) pointsNode.textContent = `+${value}`;
    const time = currentTimeLabel();
    if (timeNode) timeNode.textContent = time ? `· ${time}` : '';

    if (hideTimer) clearTimeout(hideTimer);
    overlay.classList.remove('show');
    void overlay.offsetWidth;
    overlay.classList.add('show');
    hideTimer = window.setTimeout(() => {
      overlay.classList.remove('show');
      hideTimer = null;
    }, 1700);
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target) || !scoringScreen()) return;

    const shot = event.target.closest('[data-rp-video-shot]');
    if (shot && String(shot.dataset.result || '').toLowerCase() === 'make' && window.__realPlayRecordedScoringDraftActive) {
      const value = Number(shot.dataset.value || 1);
      window.setTimeout(() => showConfirmation(value), 0);
      return;
    }

    if (event.target.closest('[data-rp-video-undo], [data-rp-draft-remove-shot]')) {
      hideConfirmation();
    }
  }, true);

  const observer = new MutationObserver(() => {
    const overlay = document.querySelector('[data-rp-score-confirmation]');
    if (overlay && !overlay.isConnected) hideConfirmation();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
