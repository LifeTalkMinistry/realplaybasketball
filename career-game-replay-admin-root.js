(() => {
  if (window.__realPlayReplayAdminEditRootInstalled) return;
  window.__realPlayReplayAdminEditRootInstalled = true;

  // Retire the old Settings-click bridge if an older cached compatibility file
  // tries to load it later. The root flow below owns replay-admin preparation.
  window.__realPlayReplayAdminEditBridgeInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const handoffClicks = new WeakSet();
  let preparing = false;
  let playerCorrectionRuntimePromise = null;
  let currentReplaySessionId = 0;
  let currentReplayOpenRankNumber = 0;
  let sessionResolvePromise = null;
  let lastResolveKey = '';
  let lastResolveAt = 0;

  function positiveId(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  function positiveOpenRankNumber(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  function replayOpenRankNumber(viewer) {
    const title = String(
      viewer?.querySelector('[data-rp-career-replay-title]')?.textContent
      || viewer?.querySelector('.rp-career-replay-gamehead h2')?.textContent
      || ''
    );
    const match = title.match(/OPEN\s+RANK(?:ING(?:\s+SESSION)?)?\s*#\s*(\d+)/i);
    return positiveOpenRankNumber(match?.[1]);
  }

  function sessionIdFromSource(value) {
    const direct = positiveId(
      value?.metadata?.sessionId
      ?? value?.metadata?.session_id
      ?? value?.sessionId
      ?? value?.session_id
    );
    if (direct) return direct;

    const candidates = [
      value?.id,
      value?.source_key,
      value?.sourceKey,
      value?.metadata?.source_key,
      value?.metadata?.sourceKey,
    ];
    for (const candidate of candidates) {
      const match = String(candidate || '').match(/(?:^|\b)career-(\d+)-result(?:\b|$)/i);
      const id = positiveId(match?.[1]);
      if (id) return id;
    }
    return 0;
  }

  function openRankNumberFromUpdate(update) {
    const candidates = [
      update?.metadata?.openRankNumber,
      update?.metadata?.open_rank_number,
      update?.openRankNumber,
      update?.open_rank_number,
    ];
    for (const candidate of candidates) {
      const number = positiveOpenRankNumber(candidate);
      if (number) return number;
    }

    const gameIds = [
      update?.metadata?.officialGameId,
      update?.metadata?.official_game_id,
      update?.officialGameId,
      update?.official_game_id,
      update?.title,
    ];
    for (const value of gameIds) {
      const match = String(value || '').match(/OPEN\s+RANK(?:ING(?:\s+SESSION)?)?\s*#\s*(\d+)/i);
      const number = positiveOpenRankNumber(match?.[1]);
      if (number) return number;
    }
    return 0;
  }

  function sessionIdFromRenderedResults(openRankNumber) {
    if (!openRankNumber) return 0;
    const cards = document.querySelectorAll('[data-update-id]');
    for (const card of cards) {
      const cardNumber = positiveOpenRankNumber(card.dataset.rpOfficialOpenRankNumber);
      if (cardNumber !== openRankNumber) continue;
      const match = String(card.dataset.updateId || '').match(/^career-(\d+)-result$/i);
      const id = positiveId(match?.[1]);
      if (id) return id;
    }
    return 0;
  }

  async function resolveReplaySessionId(viewer) {
    if (currentReplaySessionId > 0) return currentReplaySessionId;
    if (!viewer?.classList.contains('open') || window.__realPlayAdminVerified !== true) return 0;

    const openRankNumber = replayOpenRankNumber(viewer);
    if (!openRankNumber) return 0;
    currentReplayOpenRankNumber = openRankNumber;

    const renderedId = sessionIdFromRenderedResults(openRankNumber);
    if (renderedId) {
      currentReplaySessionId = renderedId;
      return renderedId;
    }

    const resolveKey = String(openRankNumber);
    const now = Date.now();
    if (sessionResolvePromise) return sessionResolvePromise;
    if (lastResolveKey === resolveKey && now - lastResolveAt < 10000) return 0;
    lastResolveKey = resolveKey;
    lastResolveAt = now;

    sessionResolvePromise = (async () => {
      try {
        const response = await fetch(PUBLIC_UPDATES_URL, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) return 0;
        const data = await response.json().catch(() => ({}));
        const updates = Array.isArray(data?.updates) ? data.updates : [];
        const match = updates.find((item) =>
          String(item?.category || '').toLowerCase() === 'result'
          && openRankNumberFromUpdate(item) === openRankNumber
        );
        const sessionId = sessionIdFromSource(match);
        if (sessionId && replayOpenRankNumber(viewer) === openRankNumber) {
          currentReplaySessionId = sessionId;
          return sessionId;
        }
        return 0;
      } catch (_) {
        return 0;
      } finally {
        sessionResolvePromise = null;
      }
    })();

    return sessionResolvePromise;
  }

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

  function restoreAdminActions(topbar) {
    if (!topbar) return;
    const wrap = topbar.querySelector('[data-rp-replay-admin-actions]');
    if (!wrap) {
      topbar.classList.remove('rp-replay-admin-actions-visible');
      return;
    }
    const pencil = wrap.querySelector('[data-rp-replay-admin-edit]');
    if (pencil) topbar.appendChild(pencil);
    wrap.remove();
    topbar.classList.remove('rp-replay-admin-actions-visible');
  }

  async function syncFullGameDataButton() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) {
      currentReplaySessionId = 0;
      currentReplayOpenRankNumber = 0;
      lastResolveKey = '';
      return;
    }

    const topbar = viewer.querySelector('.rp-career-replay-topbar');
    if (!topbar) return;

    const visibleOpenRankNumber = replayOpenRankNumber(viewer);
    if (visibleOpenRankNumber
      && currentReplayOpenRankNumber
      && visibleOpenRankNumber !== currentReplayOpenRankNumber) {
      currentReplaySessionId = 0;
      lastResolveKey = '';
    }
    if (visibleOpenRankNumber) currentReplayOpenRankNumber = visibleOpenRankNumber;

    if (window.__realPlayAdminVerified === true && currentReplaySessionId < 1) {
      await resolveReplaySessionId(viewer);
    }

    const shouldShow = window.__realPlayAdminVerified === true && currentReplaySessionId > 0;
    if (!shouldShow) {
      restoreAdminActions(topbar);
      return;
    }

    let wrap = topbar.querySelector('[data-rp-replay-admin-actions]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'rp-replay-admin-actions';
      wrap.dataset.rpReplayAdminActions = '1';
      topbar.appendChild(wrap);
    }

    const pencil = topbar.querySelector('[data-rp-replay-admin-edit]');
    if (pencil && pencil.parentElement !== wrap) wrap.appendChild(pencil);

    let button = wrap.querySelector('[data-rp-full-game-data]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-replay-full-game-data';
      button.dataset.rpFullGameData = '1';
      button.textContent = 'FULL GAME DATA';
      button.setAttribute('aria-label', 'Open full finalized game data');
      button.setAttribute('title', 'Open read-only full finalized game data');
      wrap.appendChild(button);
    }

    topbar.classList.add('rp-replay-admin-actions-visible');
  }

  async function openFullGameData() {
    if (window.__realPlayAdminVerified !== true) return;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (currentReplaySessionId < 1) await resolveReplaySessionId(viewer);
    if (currentReplaySessionId < 1) {
      window.alert('Unable to resolve this finalized Game ID. Close and reopen the game, then try again.');
      return;
    }
    window.location.href = `full-game-data.html?game=${encodeURIComponent(currentReplaySessionId)}`;
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
      const sessionId = positiveId(replayTrigger.dataset.rpCareerReplaySession);
      if (sessionId) {
        currentReplaySessionId = sessionId;
        currentReplayOpenRankNumber = 0;
        lastResolveKey = '';
        window.setTimeout(() => syncFullGameDataButton().catch(() => {}), 120);
      }
      return;
    }

    if (event.target?.closest?.('[data-rp-full-game-data]')) {
      event.preventDefault();
      event.stopPropagation();
      openFullGameData().catch(() => {});
    }
  }, true);

  const observer = new MutationObserver(() => {
    syncFullGameDataButton().catch(() => {});
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('storage', (event) => {
    if (event.key !== 'real_play_access_token') return;
    currentReplaySessionId = 0;
    currentReplayOpenRankNumber = 0;
    lastResolveKey = '';
    syncFullGameDataButton().catch(() => {});
  });

  window.setTimeout(() => syncFullGameDataButton().catch(() => {}), 0);

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
    .rp-career-replay-topbar.rp-replay-admin-actions-visible{
      grid-template-columns:42px minmax(0,1fr) auto!important;
    }
    .rp-replay-admin-actions{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:7px;
      min-width:0;
      justify-self:end;
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
      .rp-career-replay-topbar.rp-replay-admin-actions-visible{gap:6px!important;padding-left:10px!important;padding-right:10px!important}
      .rp-replay-admin-actions{gap:5px}
      .rp-replay-full-game-data{padding:0 8px;font-size:.47rem;letter-spacing:.045em}
      .rp-replay-admin-actions .rp-replay-admin-edit{width:36px;height:36px;flex:0 0 36px}
    }
    @media(prefers-reduced-motion:reduce){
      .rp-replay-admin-edit.rp-replay-admin-edit-loading svg{animation:none}
    }
  `;
  document.head.appendChild(style);
})();