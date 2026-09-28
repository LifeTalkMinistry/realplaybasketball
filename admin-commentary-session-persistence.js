(() => {
  if (window.__realPlayCommentarySessionPersistenceInstalledV2) return;
  window.__realPlayCommentarySessionPersistenceInstalledV2 = true;

  const STORAGE_KEY = 'real_play_commentary_session_v1';
  let restoring = false;
  let hydrating = false;
  let scheduled = false;
  let retryTimer = null;

  const cleanKeys = (values) => Array.isArray(values)
    ? [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    : [];

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed) return null;
      return {
        west: cleanKeys(parsed.west),
        east: cleanKeys(parsed.east),
        mode: parsed.mode === 'live' ? 'live' : 'setup',
        selectedKey: typeof parsed.selectedKey === 'string' ? parsed.selectedKey : null,
      };
    } catch (_error) {
      return null;
    }
  }

  function writeState(state) {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        west: cleanKeys(state.west),
        east: cleanKeys(state.east),
        mode: state.mode === 'live' ? 'live' : 'setup',
        selectedKey: state.selectedKey || null,
        updatedAt: new Date().toISOString(),
      }));
    } catch (_error) {}
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_error) {}
    hydrating = false;
  }

  function viewer() {
    return document.querySelector('.rp-commentary-viewer-v2:not([hidden])');
  }

  function setupSnapshot(root) {
    if (!root?.querySelector('.rp-cv2-sides')) return null;
    const west = [];
    const east = [];
    root.querySelectorAll('[data-cv2-remove]').forEach((button) => {
      const key = String(button.dataset.cv2Remove || '').trim();
      const side = String(button.dataset.side || '').trim().toLowerCase();
      if (!key) return;
      if (side === 'west') west.push(key);
      else if (side === 'east') east.push(key);
    });
    return { west, east, mode: 'setup', selectedKey: null };
  }

  function liveSnapshot(root) {
    if (!root?.querySelector('.rp-cv2-live')) return null;
    const sides = [...root.querySelectorAll('.rp-cv2-live-side')];
    const sideKeys = (node) => [...(node?.querySelectorAll('[data-cv2-select]') || [])]
      .map((button) => String(button.dataset.cv2Select || '').trim())
      .filter(Boolean);
    const selected = root.querySelector('[data-cv2-select].active');
    return {
      west: sideKeys(sides[0]),
      east: sideKeys(sides[1]),
      mode: 'live',
      selectedKey: selected ? String(selected.dataset.cv2Select || '').trim() : null,
    };
  }

  function currentSnapshot(root = viewer()) {
    if (!root) return null;
    return root.querySelector('.rp-cv2-live') ? liveSnapshot(root) : setupSnapshot(root);
  }

  function hasPlayers(state) {
    return Boolean(state && (state.west.length || state.east.length));
  }

  function sameLineup(a, b) {
    return JSON.stringify([cleanKeys(a?.west), cleanKeys(a?.east)]) === JSON.stringify([cleanKeys(b?.west), cleanKeys(b?.east)]);
  }

  function scheduleRetry(delay = 250) {
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      scheduleSync();
    }, delay);
  }

  function findPickerPlayer(root, key) {
    return [...(root?.querySelectorAll('[data-cv2-pick]') || [])]
      .find((button) => String(button.dataset.cv2Pick || '') === key) || null;
  }

  function restoreOneMissing(root, state) {
    const current = setupSnapshot(root);
    if (!current) return false;
    const desired = [
      ...state.west.map((key) => ({ side: 'west', key })),
      ...state.east.map((key) => ({ side: 'east', key })),
    ];
    const existing = new Set([...current.west, ...current.east]);
    const missing = desired.find((item) => !existing.has(item.key));
    if (!missing) return false;

    const add = root.querySelector(`[data-cv2-add="${missing.side}"]`);
    if (!add) {
      scheduleRetry();
      return true;
    }

    restoring = true;
    try {
      add.click();
      const liveRoot = viewer();
      const pick = findPickerPlayer(liveRoot, missing.key);
      if (!pick) {
        liveRoot?.querySelector('[data-cv2-picker-close]')?.click();
        scheduleRetry(350);
        return true;
      }
      pick.click();
    } finally {
      restoring = false;
    }
    scheduleRetry(50);
    return true;
  }

  function restoreSelected(root, key) {
    if (!key || !root) return;
    const button = [...root.querySelectorAll('[data-cv2-select]')]
      .find((item) => String(item.dataset.cv2Select || '') === key);
    button?.click();
  }

  function finishHydration(root, state) {
    hydrating = false;
    if (state.mode !== 'live') return;
    const begin = root.querySelector('[data-cv2-begin]');
    if (!begin || begin.disabled) return;
    restoring = true;
    try { begin.click(); } finally { restoring = false; }
    window.setTimeout(() => {
      restoreSelected(viewer(), state.selectedKey);
      scheduleSync();
    }, 30);
  }

  function restoreSavedSetup(root, state) {
    if (!root?.querySelector('.rp-cv2-sides') || !hasPlayers(state)) return;
    const current = setupSnapshot(root);
    if (!current) return;

    if (sameLineup(current, state)) {
      if (hydrating) finishHydration(root, state);
      return;
    }

    if (!hasPlayers(current)) hydrating = true;

    if (hydrating) {
      if (!restoreOneMissing(root, state)) finishHydration(root, state);
      return;
    }

    writeState({ ...current, mode: state.mode, selectedKey: state.selectedKey });
  }

  function ensureResumeLabel(root, state) {
    const start = root?.querySelector('[data-cv2-start]');
    if (!start) return;
    if (hasPlayers(state)) {
      start.textContent = state.mode === 'live' ? 'RESUME COMMENTARY' : 'RESUME SETUP';
      start.dataset.rpCommentaryResume = '1';
    }
  }

  function ensureSavedBadge(root, state) {
    const head = root?.querySelector('.rp-cv2-head');
    if (!head) return;
    let badge = head.querySelector('[data-rp-commentary-saved]');
    if (!hasPlayers(state)) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.rpCommentarySaved = '1';
      badge.className = 'rp-cv2-saved-badge';
      head.appendChild(badge);
    }
    const total = state.west.length + state.east.length;
    badge.textContent = `LINEUP SAVED · ${total} PLAYER${total === 1 ? '' : 'S'}`;
  }

  function ensureFinishButton(root) {
    if (!root?.querySelector('.rp-cv2-live') || root.querySelector('[data-rp-commentary-finish]')) return;
    const actions = document.createElement('div');
    actions.className = 'rp-cv2-persistence-actions';
    actions.dataset.rpCommentaryPersistenceActions = '1';
    actions.innerHTML = '<button type="button" class="rp-cv2-finish-commentary" data-rp-commentary-finish>FINISH COMMENTARY</button><span>This is the only action that clears the saved West/East lineup.</span>';
    root.querySelector('.rp-cv2-body')?.appendChild(actions);
  }

  function installStyles() {
    if (document.querySelector('[data-rp-commentary-persistence-styles-v2]')) return;
    const style = document.createElement('style');
    style.dataset.rpCommentaryPersistenceStylesV2 = '1';
    style.textContent = `
      .rp-cv2-saved-badge{display:inline-flex;width:max-content;margin-top:9px;padding:6px 9px;border:1px solid rgba(50,225,247,.2);border-radius:999px;color:#4ae5fa;background:rgba(23,103,120,.14);font-size:.43rem;font-weight:950;letter-spacing:.08em}
      .rp-cv2-persistence-actions{display:grid;gap:8px;width:min(520px,100%);margin:20px auto 8px;padding:0 16px 20px;box-sizing:border-box;text-align:center}
      .rp-cv2-finish-commentary{min-height:50px;border:1px solid rgba(255,110,125,.34);border-radius:14px;background:rgba(72,14,24,.28);color:#ff9ca8;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.65rem;font-weight:950;letter-spacing:.08em;cursor:pointer}
      .rp-cv2-persistence-actions span{color:#5f7f92;font-size:.43rem;font-weight:800;letter-spacing:.04em}
    `;
    document.head.appendChild(style);
  }

  function removeKeyImmediately(button) {
    const key = String(button?.dataset.cv2Remove || '').trim();
    const side = String(button?.dataset.side || '').trim().toLowerCase();
    if (!key || !['west', 'east'].includes(side)) return;
    const state = readState() || { west: [], east: [], mode: 'setup', selectedKey: null };
    state[side] = state[side].filter((item) => item !== key);
    if (state.selectedKey === key) state.selectedKey = null;
    hydrating = false;
    writeState(state);
  }

  function finishCommentary(root) {
    if (!window.confirm('Finish commentary and clear the saved West/East lineup?')) return;
    restoring = true;
    hydrating = false;
    try {
      clearState();
      root?.querySelector('[data-cv2-edit]')?.click();
      let setup = viewer();
      let guard = 0;
      while (setup?.querySelector('[data-cv2-remove]') && guard < 50) {
        setup.querySelector('[data-cv2-remove]').click();
        setup = viewer();
        guard += 1;
      }
      clearState();
    } finally {
      restoring = false;
    }
    scheduleSync();
  }

  function reconcile() {
    scheduled = false;
    installStyles();
    const root = viewer();
    if (!root) return;

    const state = readState();
    ensureResumeLabel(root, state);
    ensureSavedBadge(root, state);

    if (root.querySelector('.rp-cv2-sides')) {
      const current = setupSnapshot(root);
      if (hasPlayers(state)) {
        restoreSavedSetup(root, state);
      } else if (!restoring && hasPlayers(current)) {
        writeState(current);
      }
    } else if (root.querySelector('.rp-cv2-live')) {
      const current = liveSnapshot(root);
      if (!restoring && hasPlayers(current)) writeState(current);
    }

    ensureFinishButton(root);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(reconcile);
  }

  document.addEventListener('click', (event) => {
    const finish = event.target.closest?.('[data-rp-commentary-finish]');
    if (finish) {
      event.preventDefault();
      event.stopPropagation();
      finishCommentary(finish.closest('.rp-commentary-viewer-v2') || viewer());
      return;
    }

    const remove = event.target.closest?.('[data-cv2-remove]');
    if (remove) removeKeyImmediately(remove);

    const begin = event.target.closest?.('[data-cv2-begin]');
    if (begin) {
      const snapshot = setupSnapshot(begin.closest('.rp-commentary-viewer-v2'));
      if (snapshot) {
        hydrating = false;
        writeState({ ...snapshot, mode: 'live' });
      }
    }

    const exit = event.target.closest?.('[data-cv2-exit]');
    if (exit) {
      const snapshot = currentSnapshot(exit.closest('.rp-commentary-viewer-v2'));
      if (hasPlayers(snapshot)) writeState(snapshot);
    }

    window.setTimeout(scheduleSync, 0);
  }, true);

  window.addEventListener('beforeunload', () => {
    const snapshot = currentSnapshot();
    if (!restoring && !hydrating && hasPlayers(snapshot)) writeState(snapshot);
  });
  window.addEventListener('pagehide', () => {
    const snapshot = currentSnapshot();
    if (!restoring && !hydrating && hasPlayers(snapshot)) writeState(snapshot);
  });

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  else scheduleSync();
})();
