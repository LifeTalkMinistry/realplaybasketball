(() => {
  if (window.__realPlayReplayAdminEditBridgeInstalled) return;
  window.__realPlayReplayAdminEditBridgeInstalled = true;

  let replayingClick = false;
  let preparing = false;

  function waitFor(selector, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const node = document.querySelector(selector);
        if (node) {
          window.clearInterval(timer);
          resolve(node);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 60);
    });
  }

  function waitForAdminApi(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const ready = typeof window.__realPlayOpenAdminGameControl === 'function'
          && typeof window.__realPlayRefreshAdminGameControl === 'function';
        if (ready) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 60);
    });
  }

  async function ensureAdminEditorReady() {
    if (typeof window.__realPlayOpenAdminGameControl === 'function'
      && typeof window.__realPlayRefreshAdminGameControl === 'function') {
      return true;
    }

    // The replay pencil can be used before the heavy admin bundle has ever been
    // opened in this browser session. Reuse the official Settings > Admin entry
    // to load that bundle, then hand the click back to the replay editor.
    window.dispatchEvent(new CustomEvent('realplay:settings-open'));
    const adminRow = await waitFor('[data-rp-settings-action="admin"]', 3000);
    if (!adminRow) {
      throw new Error('Real Play Admin tools are not ready yet. Please try again.');
    }

    adminRow.click();
    const ready = await waitForAdminApi(8000);
    if (!ready) {
      throw new Error('The Game Control editor could not finish loading. Please try again.');
    }
    return true;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-rp-replay-admin-edit]');
    if (!button || replayingClick) return;

    // Capture the first click before any lower replay layer can swallow it.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (preparing) return;

    preparing = true;
    const previousOpacity = button.style.opacity;
    const previousPointerEvents = button.style.pointerEvents;
    button.setAttribute('aria-busy', 'true');
    button.style.opacity = '.55';
    button.style.pointerEvents = 'none';

    try {
      await ensureAdminEditorReady();
      button.style.pointerEvents = previousPointerEvents;
      replayingClick = true;
      button.click();
    } catch (error) {
      window.alert(error?.message || 'Unable to open the official game editor.');
    } finally {
      replayingClick = false;
      preparing = false;
      button.removeAttribute('aria-busy');
      button.style.opacity = previousOpacity;
      button.style.pointerEvents = previousPointerEvents;
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{
      position:relative!important;
      z-index:20!important;
      pointer-events:auto!important;
      touch-action:manipulation;
    }
    .rp-replay-admin-edit[aria-busy="true"]{cursor:wait!important}
  `;
  document.head.appendChild(style);
})();
