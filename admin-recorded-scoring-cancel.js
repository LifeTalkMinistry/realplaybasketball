(() => {
  if (window.__realPlayRecordedScoringCancelInstalled) return;
  window.__realPlayRecordedScoringCancelInstalled = true;

  let injectTimer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function installStyle() {
    if (document.getElementById('rp-recorded-cancel-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-recorded-cancel-style';
    style.textContent = `
      .rp-video-scoring-exit-row{display:flex;align-items:center;justify-content:flex-start;min-height:34px}
      .rp-video-scoring-exit{min-height:34px;padding:0 12px;border:1px solid rgba(112,163,190,.28);border-radius:9px;background:rgba(6,20,31,.92);color:#9fc9d9;font:950 8px/1 system-ui,sans-serif;letter-spacing:.09em;white-space:nowrap;cursor:pointer}
      .rp-video-scoring-exit:hover,.rp-video-scoring-exit:focus-visible{border-color:rgba(67,232,255,.5);color:#dffaff;background:rgba(8,38,50,.96);outline:none}
      @media(max-width:560px){.rp-video-scoring-exit-row{min-height:32px}.rp-video-scoring-exit{min-height:32px;padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function injectButton() {
    installStyle();
    const screen = scoringScreen();
    if (!screen || screen.querySelector('[data-rp-exit-scoring]')) return;

    const row = document.createElement('div');
    row.className = 'rp-video-scoring-exit-row';
    row.dataset.rpScoringExitRow = '1';
    row.innerHTML = '<button type="button" class="rp-video-scoring-exit" data-rp-exit-scoring>← EXIT SCORING</button>';
    screen.prepend(row);
  }

  function exitScoring() {
    const adminRoot = root();
    if (!adminRoot) return;

    const setupTab = adminRoot.querySelector('[data-admin-tab="session"]') || adminRoot.querySelector('[data-admin-tab]');
    if (setupTab) {
      setupTab.click();
      return;
    }

    window.location.reload();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-exit-scoring]');
    if (!button || !root()?.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitScoring();
  }, true);

  function scheduleInject() {
    if (injectTimer) clearTimeout(injectTimer);
    injectTimer = setTimeout(injectButton, 30);
  }

  const observer = new MutationObserver(scheduleInject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', scheduleInject);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInject, { once: true });
  else scheduleInject();
})();
