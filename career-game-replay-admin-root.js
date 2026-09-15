(() => {
  if (window.__realPlayReplayAdminEditRootInstalled) return;
  window.__realPlayReplayAdminEditRootInstalled = true;

  // Retire the old Settings-click bridge if an older cached compatibility file
  // tries to load it later. The root flow below owns replay-admin preparation.
  window.__realPlayReplayAdminEditBridgeInstalled = true;

  const handoffClicks = new WeakSet();
  let preparing = false;

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
    @keyframes rpReplayEditPulse{
      from{opacity:.35;transform:scale(.92)}
      to{opacity:1;transform:scale(1)}
    }
    @media(prefers-reduced-motion:reduce){
      .rp-replay-admin-edit.rp-replay-admin-edit-loading svg{animation:none}
    }
  `;
  document.head.appendChild(style);
})();