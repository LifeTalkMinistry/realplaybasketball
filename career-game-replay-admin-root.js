(() => {
  if (window.__realPlayReplayAdminEditRootInstalled) return;
  window.__realPlayReplayAdminEditRootInstalled = true;

  // Retire the old Settings-click bridge if an older cached compatibility file
  // tries to load it later. The root flow below owns replay-admin preparation.
  window.__realPlayReplayAdminEditBridgeInstalled = true;

  const handoffClicks = new WeakSet();
  let preparing = false;
  let playerCorrectionRuntimePromise = null;
  let currentReplaySessionId = 0;

  function ensurePlayerCorrectionRuntime() {
    if (window.__realPlayReplayPlayerCorrectionInstalled) return Promise.resolve(true);
    if (playerCorrectionRuntimePromise) return playerCorrectionRuntimePromise;

    playerCorrectionRuntimePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rp-replay-player-correction-runtime]');
      if (existing) {
        const started = Date.now();
        const timer = setInterval(() => {
          if (window.__realPlayReplayPlayerCorrectionInstalled) {
            clearInterval(timer);
            resolve(true);
          } else if (Date.now() - started > 5000) {
            clearInterval(timer);
            reject(new Error('Recorded player-correction controls did not initialize.'));
          }
        }, 60);
        return;
      }

      const script = document.createElement('script');
      script.src = 'career-game-replay-player-correction.js?v=20260923-identity-fix';
      script.async = true;
      script.dataset.rpReplayPlayerCorrectionRuntime = '1';
      script.onload = () => {
        if (window.__realPlayReplayPlayerCorrectionInstalled) resolve(true);
        else reject(new Error('Recorded player-correction controls did not initialize.'));
      };
      script.onerror = () => reject(new Error('Unable to load recorded player-correction controls.'));
      document.head.appendChild(script);
    }).catch((error) => {
      playerCorrectionRuntimePromise = null;
      throw error;
    });

    return playerCorrectionRuntimePromise;
  }

  async function ensureReplayEditorRuntime() {
    const ensureAdmin = window.__realPlayEnsureAdminLoaded;
    if (typeof ensureAdmin !== 'function') {
      throw new Error('Real Play Admin runtime is not ready. Refresh the app and try again.');
    }

    await ensureAdmin();

    if (typeof window.__realPlayOpenAdminGameControl !== 'function'
      || typeof window.__realPlayRefreshAdminGameControl !== 'function') {
      throw new Error('Game Control did not initialize correctly.');
    }

    await window.__realPlayRefreshAdminGameControl();
    await ensurePlayerCorrectionRuntime();
    return true;
  }

  function setPreparingState(button, active) {
    if (!button) return;
    button.classList.toggle('rp-replay-admin-edit-loading', active);
    if (active) {
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('title', 'Loading official score-sheet editor…');
    } else {
      button.removeAttribute('aria-busy');
      button.setAttribute('title', 'Edit official game stats');
    }
  }

  function syncFullGameDataButton() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    const topbar = viewer?.querySelector('.rp-career-replay-topbar');
    if (!topbar) return;

    let button = topbar.querySelector('[data-rp-full-game-data]');
    const shouldShow = window.__realPlayAdminVerified === true && currentReplaySessionId > 0;
    if (!shouldShow) {
      button?.remove();
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-replay-full-game-data';
      button.dataset.rpFullGameData = '1';
      button.textContent = 'FULL GAME DATA';
      button.setAttribute('aria-label', 'Open full finalized game data');
      button.setAttribute('title', 'Open read-only full finalized game data');
      topbar.appendChild(button);
    }
  }

  function openFullGameData() {
    if (window.__realPlayAdminVerified !== true || currentReplaySessionId < 1) return;
    const url = `full-game-data.html?game=${encodeURIComponent(currentReplaySessionId)}`;
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) window.location.href = url;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-rp-replay-admin-edit]');
    if (!button) return;

    // The second click is the intentional handoff to the original replay editor
    // after Game Control has been prepared. Let its native listener run normally.
    if (handoffClicks.has(button)) {
      handoffClicks.delete(button);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (preparing) return;
    preparing = true;
    setPreparingState(button, true);

    try {
      await ensureReplayEditorRuntime();
      if (!button.isConnected) throw new Error('The replay closed before the editor was ready.');

      handoffClicks.add(button);
      button.click();
    } catch (error) {
      console.error('[Real Play Replay Edit] Unable to open editor.', error);
      window.alert(error?.message || 'Unable to open the official score-sheet editor.');
    } finally {
      preparing = false;
      if (button.isConnected) setPreparingState(button, false);
    }
  }, true);

  document.addEventListener('click', (event) => {
    const replayTrigger = event.target?.closest?.('[data-rp-career-replay-session]');
    if (replayTrigger) {
      const sessionId = Number(replayTrigger.dataset.rpCareerReplaySession || 0);
      if (Number.isSafeInteger(sessionId) && sessionId > 0) {
        currentReplaySessionId = sessionId;
        window.setTimeout(syncFullGameDataButton, 120);
      }
      return;
    }

    if (event.target?.closest?.('[data-rp-full-game-data]')) {
      event.preventDefault();
      event.stopPropagation();
      openFullGameData();
    }
  }, true);

  const observer = new MutationObserver(syncFullGameDataButton);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('storage', (event) => {
    if (event.key !== 'real_play_access_token') return;
    currentReplaySessionId = 0;
    syncFullGameDataButton();
  });

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{
      position:relative!important;
      z-index:30!important;
      pointer-events:auto!important;
      touch-action:manipulation;
    }
    .rp-replay-admin-edit.rp-replay-admin-edit-loading{
      opacity:.62!important;
      cursor:wait!important;
      box-shadow:0 0 0 1px rgba(84,217,255,.18),0 0 20px rgba(84,217,255,.18)!important;
    }
    .rp-replay-admin-edit.rp-replay-admin-edit-loading svg{
      animation:rpReplayEditPulse .7s ease-in-out infinite alternate;
    }
    .rp-replay-full-game-data{
      min-height:38px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:0 13px;
      border:1px solid rgba(85,197,229,.28);
      border-radius:11px;
      background:#071a26;
      color:#dffaff;
      font:900 .56rem/1 Arial,sans-serif;
      letter-spacing:.09em;
      white-space:nowrap;
      cursor:pointer;
      touch-action:manipulation;
      box-shadow:0 8px 22px rgba(0,0,0,.2);
    }
    .rp-replay-full-game-data:hover{border-color:rgba(85,224,245,.58);background:#0a2837;color:#fff}
    .rp-replay-full-game-data:active{transform:scale(.97)}
    @keyframes rpReplayEditPulse{
      from{opacity:.35;transform:scale(.92)}
      to{opacity:1;transform:scale(1)}
    }
    @media(max-width:520px){
      .rp-replay-full-game-data{padding:0 9px;font-size:.49rem;letter-spacing:.06em}
    }
    @media(prefers-reduced-motion:reduce){
      .rp-replay-admin-edit.rp-replay-admin-edit-loading svg{animation:none}
    }
  `;
  document.head.appendChild(style);
})();