(() => {
  if (window.__realPlayRecordedScoringCancelInstalled) return;
  window.__realPlayRecordedScoringCancelInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_PREFIX = 'rp-recorded-score-sheet:v2:';

  let injectTimer = null;
  let cancelBusy = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function installStyle() {
    if (document.getElementById('rp-recorded-cancel-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-recorded-cancel-style';
    style.textContent = `
      .rp-video-scoring-exit-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;width:100%}
      .rp-video-scoring-exit,.rp-video-scoring-cancel{min-height:34px;padding:0 12px;border-radius:9px;font:950 8px/1 system-ui,sans-serif;letter-spacing:.09em;white-space:nowrap;cursor:pointer}
      .rp-video-scoring-exit{border:1px solid rgba(112,163,190,.28);background:rgba(6,20,31,.92);color:#9fc9d9}
      .rp-video-scoring-exit:hover,.rp-video-scoring-exit:focus-visible{border-color:rgba(67,232,255,.5);color:#dffaff;background:rgba(8,38,50,.96);outline:none}
      .rp-video-scoring-cancel{border:1px solid rgba(255,91,104,.58);background:rgba(64,11,19,.9);color:#ffb3ba}
      .rp-video-scoring-cancel:hover,.rp-video-scoring-cancel:focus-visible{border-color:rgba(255,104,117,.9);background:rgba(94,14,25,.96);color:#fff1f3;outline:none}
      .rp-video-scoring-cancel:disabled{opacity:.52;cursor:wait}
      @media(max-width:560px){.rp-video-scoring-exit-row{min-height:32px}.rp-video-scoring-exit,.rp-video-scoring-cancel{min-height:32px;padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function injectButtons() {
    installStyle();
    const screen = scoringScreen();
    if (!screen) return;

    let row = screen.querySelector('[data-rp-scoring-exit-row]');
    if (!row) {
      row = document.createElement('div');
      row.className = 'rp-video-scoring-exit-row';
      row.dataset.rpScoringExitRow = '1';
      screen.prepend(row);
    }

    if (!row.querySelector('[data-rp-exit-scoring]')) {
      const exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'rp-video-scoring-exit';
      exit.dataset.rpExitScoring = '1';
      exit.textContent = '← EXIT SCORING';
      row.appendChild(exit);
    }

    if (!row.querySelector('[data-rp-cancel-audit]')) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'rp-video-scoring-cancel';
      cancel.dataset.rpCancelAudit = '1';
      cancel.textContent = cancelBusy ? 'CANCELLING…' : 'CANCEL AUDIT';
      cancel.disabled = cancelBusy;
      cancel.setAttribute('aria-label', 'Cancel this recorded game audit and return the game to setup');
      row.appendChild(cancel);
    }
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

  function clearLocalDrafts(sessionId) {
    const prefix = `${DRAFT_PREFIX}${Number(sessionId)}:`;
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(prefix)) localStorage.removeItem(key);
      }
    } catch (_) {}
    try { window.__realPlayRecordedScoringDraftActive = false; } catch (_) {}
  }

  async function cancelAudit(button) {
    if (cancelBusy) return;

    const confirmed = window.confirm(
      'Cancel this game audit?\n\nThis will discard the current draft score sheet and Real Play recording source, reset the game back to setup, and let you correct the roster sides or rules. Nothing from this audit will become official.'
    );
    if (!confirmed) return;

    cancelBusy = true;
    button.disabled = true;
    button.textContent = 'CANCELLING…';

    try {
      const controlData = await api('/api/real-play/admin/career/control');
      const sessionId = Number(controlData?.control?.session?.id || 0);
      if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
        throw new Error('There is no active Real Play game to cancel.');
      }

      await api('/api/real-play/admin/recorded-scoring/cancel', {
        method: 'POST',
        json: { session_id: sessionId },
      });

      clearLocalDrafts(sessionId);
      try {
        window.dispatchEvent(new CustomEvent('realplay:recorded-scoring-cancelled', {
          detail: { sessionId },
        }));
      } catch (_) {}

      window.alert('Audit cancelled. The game is back in setup so you can correct the roster, sides, rules, or recording source.');
      exitScoring();
    } catch (error) {
      window.alert(error?.message || 'The game audit could not be cancelled.');
      cancelBusy = false;
      button.disabled = false;
      button.textContent = 'CANCEL AUDIT';
    }
  }

  document.addEventListener('click', (event) => {
    const exitButton = event.target.closest('[data-rp-exit-scoring]');
    if (exitButton && root()?.contains(exitButton)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exitScoring();
      return;
    }

    const cancelButton = event.target.closest('[data-rp-cancel-audit]');
    if (!cancelButton || !root()?.contains(cancelButton)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelAudit(cancelButton);
  }, true);

  function scheduleInject() {
    if (injectTimer) clearTimeout(injectTimer);
    injectTimer = setTimeout(injectButtons, 30);
  }

  const observer = new MutationObserver(scheduleInject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', scheduleInject);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInject, { once: true });
  else scheduleInject();
})();
