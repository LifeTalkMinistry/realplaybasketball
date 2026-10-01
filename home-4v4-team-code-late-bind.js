(() => {
  if (window.__realPlay4v4TeamCodeLateBindInstalled) return;
  window.__realPlay4v4TeamCodeLateBindInstalled = true;

  let boundPanel = null;
  let queued = false;
  let retries = 0;
  let retryTimer = 0;
  let replayPending = false;

  function panel() {
    return document.querySelector('.rp-4v4-preference-panel');
  }

  function sync() {
    queued = false;
    const current = panel();
    if (!current) return false;
    if (current === boundPanel) return true;
    if (window.__realPlay4v4TeamCodeBetaInstalled !== true) return false;

    // If no 4v4-open event was actually missed, the Team Code runtime either
    // already handled the real event or discovered this panel during its boot.
    // Mark the panel as known without replaying the event and causing a second
    // /4v4/me request.
    if (!replayPending) {
      boundPanel = current;
      return true;
    }

    boundPanel = current;
    replayPending = false;
    window.dispatchEvent(new CustomEvent('realplay:4v4-open', {
      detail: { source: 'team-code-late-bind' },
    }));
    return true;
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(sync);
  }

  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) return;
    if (boundPanel?.isConnected) return;
    boundPanel = null;
    if (replayPending) queueSync();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function retryUntilReady() {
    window.clearTimeout(retryTimer);
    if (!replayPending) return;
    if (sync()) return;
    retries += 1;
    if (retries >= 100) return;
    retryTimer = window.setTimeout(retryUntilReady, 100);
  }

  window.addEventListener('realplay:4v4-open', (event) => {
    // Ignore our own replay. The normal Team Code listener receives the same
    // event and owns the actual panel bind/load.
    if (event?.detail?.source === 'team-code-late-bind') {
      const current = panel();
      if (current) boundPanel = current;
      replayPending = false;
      return;
    }

    const current = panel();
    if (current && window.__realPlay4v4TeamCodeBetaInstalled === true) {
      boundPanel = current;
      replayPending = false;
      return;
    }

    // The real open event arrived before either the panel or Team Code runtime
    // was ready. Replay exactly once when both become available.
    replayPending = true;
    retries = 0;
    retryUntilReady();
  });

  // Do not replay merely because a panel already exists at startup. Team Code's
  // own boot path discovers an existing panel. The bridge only replays when it
  // has positively observed a missed realplay:4v4-open event.
  const current = panel();
  if (current && window.__realPlay4v4TeamCodeBetaInstalled === true) boundPanel = current;
})();
