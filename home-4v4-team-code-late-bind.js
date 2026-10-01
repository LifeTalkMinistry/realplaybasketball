(() => {
  if (window.__realPlay4v4TeamCodeLateBindInstalled) return;
  window.__realPlay4v4TeamCodeLateBindInstalled = true;

  let boundPanel = null;
  let queued = false;
  let retries = 0;
  let retryTimer = 0;

  function panel() {
    return document.querySelector('.rp-4v4-preference-panel');
  }

  function sync() {
    queued = false;
    const current = panel();
    if (!current) return false;
    if (current === boundPanel) return true;
    if (window.__realPlay4v4TeamCodeBetaInstalled !== true) return false;

    boundPanel = current;
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
    queueSync();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function retryUntilReady() {
    window.clearTimeout(retryTimer);
    if (sync()) return;
    retries += 1;
    if (retries >= 100) return;
    retryTimer = window.setTimeout(retryUntilReady, 100);
  }

  window.addEventListener('realplay:4v4-open', () => {
    const current = panel();
    if (current && window.__realPlay4v4TeamCodeBetaInstalled === true) boundPanel = current;
    else retryUntilReady();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', retryUntilReady, { once: true });
  } else {
    retryUntilReady();
  }
})();
