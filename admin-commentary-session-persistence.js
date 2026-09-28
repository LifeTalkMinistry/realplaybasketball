(() => {
  if (window.__realPlayCommentarySessionPersistenceInstalled) return;
  window.__realPlayCommentarySessionPersistenceInstalled = true;

  const STORAGE_KEY = 'real_play_commentary_session_v1';
  let restoring = false;
  let scheduled = false;
  let lastHydratedSignature = '';

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.west) || !Array.isArray(parsed.east)) return null;
      return {
        west: parsed.west.filter(Boolean),
        east: parsed.east.filter(Boolean),
        mode: parsed.mode === 'live' ? 'live' : 'setup',
        selectedKey: typeof parsed.selectedKey === 'string' ? parsed.selectedKey : null,
        updatedAt: parsed.updatedAt || null,
      };
    } catch (_error) {
      return null;
    }
  }

  function writeState(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        west: Array.isArray(next.west) ? next.west : [],
        east: Array.isArray(next.east) ? next.east : [],
        mode: next.mode === 'live' ? 'live' : 'setup',
        selectedKey: next.selectedKey || null,
        updatedAt: new Date().toISOString(),
      }));
    } catch (_error) {}
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_error) {}
    lastHydratedSignature = '';
  }

  function viewer() {
    return document.querySelector('.rp-commentary-viewer-v2:not([hidden])');
  }

  function currentMode(root) {
    if (!root) return 'setup';
    if (root.querySelector('.rp-cv2-live')) return 'live';
    return 'setup';
  }

  function captureSetup(root) {
    if (!root || !root.querySelector('.rp-cv2-sides')) return null;
    const west = [];
    const east = [];
    root.querySelectorAll('[data-cv2-remove]').forEach((button) => {
      const key = String(button.dataset.cv2Remove || '').trim();
      const side = String(button.dataset.side || '').trim().toLowerCase();
      if (!key) return;
      if (side === 'west') west.push(key);
      if (side === 'east') east.push(key);
    });
    return { west, east, mode: 'setup', selectedKey: null };
  }

  function captureLive(root) {
    if (!root || !root.querySelector('.rp-cv2-live')) return null;
    const sides = [...root.querySelectorAll('.rp-cv2-live-side')];
    const keysFromSide = (sideNode) => [...(sideNode?.querySelectorAll('[data-cv2-select]') || [])]
      .map((button) => String(button.dataset.cv2Select || '').trim())
      .filter(Boolean);
    const selected = root.querySelector('[data-cv2-select].active');
    return {
      west: keysFromSide(sides[0]),
      east: keysFromSide(sides[1]),
      mode: 'live',
      selectedKey: selected ? String(selected.dataset.cv2Select || '').trim() : null,
    };
  }

  function capture(root = viewer()) {
    if (!root || restoring) return;
    const snapshot = currentMode(root) === 'live' ? captureLive(root) : captureSetup(root);
    if (!snapshot) return;
    writeState(snapshot);
  }

  function playerButtonByKey(root, key) {
    return [...root.querySelectorAll('[data-cv2-pick]')]
      .find((button) => String(button.dataset.cv2Pick || '') === key) || null;
  }

  function sideAlreadyHas(root, side, key) {
    return [...root.querySelectorAll(`[data-cv2-remove][data-side="${side}"]`)]
      .some((button) => String(button.dataset.cv2Remove || '') === key);
  }

  function addKey(root, side, key) {
    if (!root || !key || sideAlreadyHas(root, side, key)) return true;
    const add = root.querySelector(`[data-cv2-add="${side}"]`);
    if (!add) return false;
    add.click();
    const picker = root.querySelector('[data-cv2-picker]');
    if (!picker) return false;
    const pick = playerButtonByKey(root, key);
    if (!pick) {
      root.querySelector('[data-cv2-picker-close]')?.click();
      return false;
    }
    pick.click();
    return true;
  }

  function restoreSelected(root, key) {
    if (!key) return;
    const button = [...root.querySelectorAll('[data-cv2-select]')]
      .find((item) => String(item.dataset.cv2Select || '') === key);
    button?.click();
  }

  function hydrateSetup(root, state) {
    if (!root?.querySelector('.rp-cv2-sides') || !state) return false;
    const signature = JSON.stringify([state.west, state.east, state.mode, state.selectedKey]);
    const current = captureSetup(root);
    const currentSignature = current ? JSON.stringify([current.west, current.east, 'setup', null]) : '';

    if (current && (current.west.length || current.east.length)) {
      if (currentSignature !== JSON.stringify([state.west, state.east, 'setup', null])) {
        writeState({ ...current, mode: state.mode === 'live' ? 'live' : 'setup', selectedKey: state.selectedKey });
      }
      return true;
    }

    if (lastHydratedSignature === signature && !state.west.length && !state.east.length) return true;

    restoring = true;
    try {
      state.west.forEach((key) => addKey(root, 'west', key));
      state.east.forEach((key) => addKey(root, 'east', key));
      lastHydratedSignature = signature;

      if (state.mode === 'live') {
        const begin = root.querySelector('[data-cv2-begin]');
        if (begin && !begin.disabled && (state.west.length || state.east.length)) {
          begin.click();
          const liveRoot = viewer();
          restoreSelected(liveRoot, state.selectedKey);
        }
      }
    } finally {
      restoring = false;
    }
    return true;
  }

  function ensureResumeCopy(root, state) {
    const start = root?.querySelector('[data-cv2-start]');
    if (!start) return;
    const hasDraft = Boolean(state && (state.west.length || state.east.length));
    if (hasDraft) {
      start.textContent = state.mode === 'live' ? 'RESUME COMMENTARY' : 'RESUME SETUP';
      start.dataset.rpCommentaryResume = '1';
    } else if (start.dataset.rpCommentaryResume === '1') {
      start.textContent = 'START COMMENTARY';
      delete start.dataset.rpCommentaryResume;
    }
  }

  function ensureFinishButton(root) {
    if (!root?.querySelector('.rp-cv2-live')) return;
    if (root.querySelector('[data-rp-commentary-finish]')) return;

    let actions = root.querySelector('[data-rp-commentary-persistence-actions]');
    if (!actions) {
      actions = document.createElement('div');
      actions.dataset.rpCommentaryPersistenceActions = '1';
      actions.className = 'rp-cv2-persistence-actions';
      actions.innerHTML = `
        <button type="button" class="rp-cv2-finish-commentary" data-rp-commentary-finish>
          FINISH COMMENTARY
        </button>
        <span>Clears the saved West/East commentary lineup.</span>`;
      root.querySelector('.rp-cv2-body')?.appendChild(actions);
    }
  }

  function installStyles() {
    if (document.querySelector('[data-rp-commentary-persistence-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCommentaryPersistenceStyles = '1';
    style.textContent = `
      .rp-cv2-persistence-actions{display:grid;gap:8px;width:min(520px,100%);margin:20px auto 8px;padding:0 16px 20px;box-sizing:border-box;text-align:center}
      .rp-cv2-finish-commentary{min-height:50px;border:1px solid rgba(255,110,125,.34);border-radius:14px;background:rgba(72,14,24,.28);color:#ff9ca8;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.65rem;font-weight:950;letter-spacing:.08em;cursor:pointer}
      .rp-cv2-finish-commentary:hover,.rp-cv2-finish-commentary:focus-visible{border-color:rgba(255,110,125,.72);background:rgba(92,18,30,.42);outline:none}
      .rp-cv2-persistence-actions span{color:#5f7f92;font-size:.43rem;font-weight:800;letter-spacing:.04em}
    `;
    document.head.appendChild(style);
  }

  function removeAllPlayers(root) {
    let guard = 0;
    while (guard < 50) {
      const button = root?.querySelector('[data-cv2-remove]');
      if (!button) break;
      button.click();
      root = viewer();
      guard += 1;
    }
  }

  function finishCommentary(root) {
    const ok = window.confirm('Finish commentary and clear the saved West/East lineup?');
    if (!ok) return;

    restoring = true;
    try {
      clearState();
      const edit = root.querySelector('[data-cv2-edit]');
      edit?.click();
      const setup = viewer();
      removeAllPlayers(setup);
      clearState();
    } finally {
      restoring = false;
    }
    scheduleSync();
  }

  function sync() {
    scheduled = false;
    installStyles();
    const root = viewer();
    if (!root) return;

    const state = readState();
    ensureResumeCopy(root, state);

    if (root.querySelector('.rp-cv2-sides') && state && (state.west.length || state.east.length)) {
      hydrateSetup(root, state);
    }

    ensureFinishButton(root);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    const finish = event.target.closest?.('[data-rp-commentary-finish]');
    if (finish) {
      event.preventDefault();
      finishCommentary(finish.closest('.rp-commentary-viewer-v2') || viewer());
      return;
    }

    const target = event.target.closest?.(
      '[data-cv2-pick],[data-cv2-remove],[data-cv2-begin],[data-cv2-select],[data-cv2-edit],[data-cv2-exit]'
    );
    if (!target) return;

    if (target.matches('[data-cv2-begin]')) {
      const root = target.closest('.rp-commentary-viewer-v2');
      const setup = captureSetup(root);
      if (setup) writeState({ ...setup, mode: 'live' });
    } else if (target.matches('[data-cv2-exit]')) {
      capture(target.closest('.rp-commentary-viewer-v2'));
    }

    queueMicrotask(() => {
      capture();
      scheduleSync();
    });
  });

  window.addEventListener('beforeunload', () => capture());
  window.addEventListener('pagehide', () => capture());

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  else scheduleSync();
})();
