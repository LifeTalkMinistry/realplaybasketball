(() => {
  if (window.__realPlayReplayAdminEditRootInstalled) return;
  window.__realPlayReplayAdminEditRootInstalled = true;

  // Retire the old Settings-click bridge if an older cached compatibility file
  // tries to load it later. The root flow below owns replay-admin preparation.
  window.__realPlayReplayAdminEditBridgeInstalled = true;

  const handoffClicks = new WeakSet();
  let preparing = false;
  let playerCorrectionRuntimePromise = null;

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

    /* Full-game replay audit stamp filter. SCORE is intentionally the default. */
    .rp-career-audit-filterbar{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:7px;
      margin:0 0 7px;
      min-height:30px;
    }
    .rp-career-audit-filterbar>span{
      color:#7092a1;
      font:900 .48rem/1 system-ui,sans-serif;
      letter-spacing:.1em;
      white-space:nowrap;
    }
    .rp-career-audit-filter-select{
      min-width:126px;
      height:30px;
      box-sizing:border-box;
      padding:0 28px 0 10px;
      border:1px solid rgba(55,199,232,.3);
      border-radius:9px;
      background:#061722;
      color:#dff9ff;
      font:950 .52rem/1 system-ui,sans-serif;
      letter-spacing:.07em;
      text-transform:uppercase;
      cursor:pointer;
      outline:none;
    }
    .rp-career-audit-filter-select:hover,
    .rp-career-audit-filter-select:focus-visible{
      border-color:rgba(59,220,249,.68);
      box-shadow:0 0 0 2px rgba(38,190,222,.09);
    }
    .rp-career-audit-filter-select option{
      background:#071824;
      color:#eefcff;
    }
    [data-rp-career-audit-filter-hidden]{display:none!important}
    @media(max-width:620px){
      .rp-career-audit-filterbar{
        gap:6px;
        margin-bottom:6px;
        min-height:28px;
      }
      .rp-career-audit-filterbar>span{font-size:.44rem}
      .rp-career-audit-filter-select{
        min-width:118px;
        height:28px;
        padding-left:9px;
        font-size:.48rem;
        border-radius:8px;
      }
    }
  `;
  document.head.appendChild(style);

  const AUDIT_FILTERS = [
    ['score', '🏀 SCORE'],
    ['to', 'TO · TURNOVER'],
    ['miss', '× MISS'],
    ['ast', 'A · ASSIST'],
    ['reb', 'R · REBOUND'],
    ['stl', 'S · STEAL'],
    ['blk', 'B · BLOCK'],
    ['foul', 'F · FOUL'],
    ['all', 'ALL STAMPS'],
  ];

  let replayAuditFilter = 'score';
  let replayAuditEnhanceTimer = 0;

  function replayAuditRoot() {
    return document.querySelector('[data-rp-career-replay].open');
  }

  function auditKind(marker) {
    const explicit = String(marker?.dataset?.rpCareerAuditKind || '').trim().toLowerCase();
    // The base replay's original made-basket markers do not carry the audit
    // kind attribute, so they are treated as SCORE until the persisted audit
    // timeline enhancement replaces them.
    return explicit || 'score';
  }

  function auditCounts(root) {
    const counts = Object.fromEntries(AUDIT_FILTERS.map(([key]) => [key, 0]));
    const markers = [...root.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]')];
    markers.forEach((marker) => {
      const kind = auditKind(marker);
      if (Object.prototype.hasOwnProperty.call(counts, kind)) counts[kind] += 1;
      counts.all += 1;
    });
    return counts;
  }

  function applyReplayAuditFilter(root = replayAuditRoot()) {
    if (!root) return;
    const markers = root.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]');
    markers.forEach((marker) => {
      const visible = replayAuditFilter === 'all' || auditKind(marker) === replayAuditFilter;
      if (visible) marker.removeAttribute('data-rp-career-audit-filter-hidden');
      else marker.setAttribute('data-rp-career-audit-filter-hidden', '1');
    });

    const select = root.querySelector('[data-rp-career-audit-filter]');
    if (!select) return;
    if (select.value !== replayAuditFilter) select.value = replayAuditFilter;

    const counts = auditCounts(root);
    [...select.options].forEach((option) => {
      const base = option.dataset.rpAuditBase || option.textContent.replace(/\s*\(\d+\)\s*$/, '');
      option.dataset.rpAuditBase = base;
      const count = Number(counts[option.value] || 0);
      const next = `${base} (${count})`;
      if (option.textContent !== next) option.textContent = next;
    });
  }

  function ensureReplayAuditFilter() {
    const root = replayAuditRoot();
    if (!root) return;
    const timeline = root.querySelector('.rp-career-replay-timeline');
    const wrap = root.querySelector('.rp-career-replay-timeline-wrap');
    if (!timeline || !wrap) return;

    let bar = wrap.querySelector('[data-rp-career-audit-filterbar]');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'rp-career-audit-filterbar';
      bar.dataset.rpCareerAuditFilterbar = '1';
      bar.innerHTML = `<span>SHOW STAMPS</span><select class="rp-career-audit-filter-select" data-rp-career-audit-filter aria-label="Choose which audit stamps are visible">${AUDIT_FILTERS.map(([key, label]) => `<option value="${key}" data-rp-audit-base="${label}">${label}</option>`).join('')}</select>`;
      wrap.insertBefore(bar, timeline);

      const select = bar.querySelector('[data-rp-career-audit-filter]');
      select.value = replayAuditFilter;
      select.addEventListener('change', () => {
        const requested = String(select.value || 'score').toLowerCase();
        replayAuditFilter = AUDIT_FILTERS.some(([key]) => key === requested) ? requested : 'score';
        applyReplayAuditFilter(root);
      });
    }

    applyReplayAuditFilter(root);
  }

  function scheduleReplayAuditFilter(delay = 20) {
    if (replayAuditEnhanceTimer) clearTimeout(replayAuditEnhanceTimer);
    replayAuditEnhanceTimer = setTimeout(() => {
      replayAuditEnhanceTimer = 0;
      ensureReplayAuditFilter();
    }, delay);
  }

  // Every newly opened replay starts cleanly on SCORE, while the user's choice
  // remains active for the rest of that open replay.
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-rp-career-replay-session]')) {
      replayAuditFilter = 'score';
      scheduleReplayAuditFilter(80);
      setTimeout(() => scheduleReplayAuditFilter(20), 260);
    }
    if (event.target?.closest?.('[data-rp-career-replay-close]')) {
      replayAuditFilter = 'score';
    }
  }, true);

  const replayAuditObserver = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return nodes.some((node) => node.nodeType === 1 && (
        node.matches?.('[data-rp-career-replay], [data-rp-career-replay-timeline-markers], [data-rp-career-replay-marker]')
        || node.querySelector?.('[data-rp-career-replay], [data-rp-career-replay-timeline-markers], [data-rp-career-replay-marker]')
      ));
    });
    if (relevant) scheduleReplayAuditFilter(10);
  });
  replayAuditObserver.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleReplayAuditFilter(0), { once: true });
  } else {
    scheduleReplayAuditFilter(0);
  }
})();