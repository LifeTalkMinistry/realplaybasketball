(() => {
  if (window.__realPlayRecordedScoringLockInstalled) return;
  window.__realPlayRecordedScoringLockInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let probeSequence = 0;
  let videoAuthority = false;
  let reviewCompleted = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  async function fetchControl() {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return null;
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data?.control || null;
  }

  function renderLiveLock(control) {
    const adminBody = body();
    if (!adminBody) return;
    const title = control?.session?.title || 'THIS GAME';
    adminBody.innerHTML = `
      <div class="rp-admin-title">
        <span class="rp-admin-kicker">RECORDED SCORING ACTIVE</span>
        <h1>LIVE SCORER LOCKED</h1>
        <p>${String(title).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')} is being scored from its continuous game recording.</p>
      </div>
      <div class="rp-admin-success">VIDEO is now the official scoring authority. Live stat, shot, clock and timeout controls are disabled for this game.</div>
      <div class="rp-admin-card soft">
        <button type="button" class="rp-admin-primary" data-rp-open-video-scoring>CONTINUE VIDEO SCORING</button>
      </div>`;
  }

  function renderFinalizeLock() {
    const adminBody = body();
    if (!adminBody) return;
    const button = adminBody.querySelector('[data-control-action="finalize"]');
    if (button) button.disabled = true;
    if (adminBody.querySelector('[data-rp-video-finalize-lock]')) return;
    const lock = document.createElement('div');
    lock.className = 'rp-admin-alert';
    lock.dataset.rpVideoFinalizeLock = '1';
    lock.textContent = 'Finish the full recorded-video review before confirming the final result.';
    const card = button?.closest('.rp-admin-card') || button?.parentElement || adminBody;
    card.insertAdjacentElement('beforebegin', lock);
  }

  async function sync() {
    const adminRoot = root();
    if (!adminRoot?.classList.contains('open')) return;
    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';
    if (!['live', 'finalize'].includes(active)) return;

    const sequence = ++probeSequence;
    const control = await fetchControl();
    if (sequence !== probeSequence || !control?.session) return;

    videoAuthority = control.session.scoringAuthority === 'video';
    reviewCompleted = Boolean(control.session.recordedScoring?.reviewCompleted);

    if (!videoAuthority) return;
    if (active === 'live' && control.session.gameStatus === 'live') {
      renderLiveLock(control);
      return;
    }
    if (active === 'finalize' && control.session.gameStatus === 'live' && !reviewCompleted) {
      renderFinalizeLock();
    }
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const openVideo = event.target.closest('[data-rp-open-video-scoring]');
    if (openVideo) {
      event.preventDefault();
      event.stopPropagation();
      adminRoot.querySelector('[data-rp-video-tab]')?.click();
      return;
    }

    if (!videoAuthority) return;
    const liveMutation = event.target.closest(
      '[data-rp-shot-action], [data-control-action="stat"], [data-control-action="shot"], [data-control-action="undo-shot"], [data-rp-game-rule-action]'
    );
    if (liveMutation) {
      event.preventDefault();
      event.stopImmediatePropagation();
      adminRoot.querySelector('[data-rp-video-tab]')?.click();
    }
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(sync);
  });

  window.addEventListener('focus', sync);
})();
