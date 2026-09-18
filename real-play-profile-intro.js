(() => {
  if (window.__realPlayPremiumProfileArtInstalled) return;
  window.__realPlayPremiumProfileArtInstalled = true;
  // Preserve the legacy guard because this script still occupies that loader slot.
  window.__realPlayProfileIntroInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const REGISTRY_URL = 'assets/profile-art/registry.json';
  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
  const DEFAULT_ART = Object.freeze({
    positionX: 72,
    positionY: 44,
    scale: 1.15,
    opacity: 1,
    enabled: true,
  });

  let registry = [];
  let registryPromise = null;
  let adminPromise = null;
  let adminAccess = null;
  let scheduled = false;
  const panelStates = new WeakMap();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  function normalizeName(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function firstPositiveInteger(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function firstJerseyNumber(...values) {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      const match = String(value).match(/-?\d+/);
      if (!match) continue;
      const parsed = Number(match[0]);
      if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 99) return parsed;
    }
    return null;
  }

  function finite(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function cloneArt(art) {
    return art ? { ...art } : null;
  }

  function normalizeArt(raw, options = {}) {
    if (!raw || typeof raw !== 'object' || !String(raw.src || '').trim()) return null;
    return {
      playerId: firstPositiveInteger(raw.playerId, raw.player_id),
      src: String(raw.src || '').trim(),
      sourceType: String(raw.sourceType || raw.source_type || options.sourceType || 'asset').trim().toLowerCase(),
      positionX: clamp(finite(raw.positionX ?? raw.position_x, DEFAULT_ART.positionX), -50, 150),
      positionY: clamp(finite(raw.positionY ?? raw.position_y, DEFAULT_ART.positionY), -50, 150),
      scale: clamp(finite(raw.scale, DEFAULT_ART.scale), 0.4, 4),
      opacity: clamp(finite(raw.opacity, DEFAULT_ART.opacity), 0, 1),
      enabled: raw.enabled !== false,
      updatedAt: raw.updatedAt || raw.updated_at || null,
      originalName: raw.originalName || raw.original_name || null,
      isFallback: Boolean(options.isFallback),
      backendAuthoritative: Boolean(options.backendAuthoritative),
    };
  }

  function stateFor(panel) {
    let state = panelStates.get(panel);
    if (!state) {
      state = {
        playerId: null,
        loaded: false,
        loading: false,
        art: null,
        draft: null,
        editorOpen: false,
        busy: false,
        pointers: new Map(),
        pinch: null,
        dragLast: null,
      };
      panelStates.set(panel, state);
    }
    return state;
  }

  function panelSource(panel) {
    if (!panel) return null;
    return panel.classList.contains('rp-public-player-profile')
      ? panel.__realPlayPublicPlayer
      : panel.__realPlayProfileState;
  }

  function panelIdentity(panel) {
    const source = panelSource(panel) || {};
    const profile = source?.profile || source?.player || source || {};
    const playerId = firstPositiveInteger(
      panel?.dataset?.rpPublicPlayerId,
      panel?.dataset?.rpProfilePlayerId,
      source?.playerId,
      source?.userId,
      source?.id,
      source?.player?.playerId,
      source?.player?.userId,
      source?.player?.id,
      source?.profile?.playerId,
      source?.profile?.player_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      source?.profile?.id,
      profile?.playerId,
      profile?.player_id,
      profile?.userId,
      profile?.user_id,
      profile?.id
    );

    const visibleName = panel?.querySelector('.rp-profile-name h1')?.textContent;
    const playerName = normalizeName(
      source?.playerName || source?.player_name || profile?.playerName ||
      profile?.player_name || profile?.name || visibleName
    );

    const visibleNumber = panel?.querySelector('.rp-profile-number strong')?.textContent;
    const jerseyNumber = firstJerseyNumber(
      source?.playerNumber,
      source?.player_number,
      source?.currentNumber?.number,
      source?.current_number?.number,
      profile?.playerNumber,
      profile?.player_number,
      visibleNumber
    );

    return { playerId, playerName, jerseyNumber };
  }

  function registryEntryMatches(entry, identity) {
    const configuredId = firstPositiveInteger(entry?.playerId, entry?.player_id, entry?.userId, entry?.user_id);
    if (configuredId !== null) return identity.playerId !== null && configuredId === identity.playerId;
    const configuredName = normalizeName(entry?.playerName || entry?.player_name || entry?.name);
    if (!configuredName || configuredName !== identity.playerName) return false;
    const configuredJersey = firstJerseyNumber(entry?.jerseyNumber, entry?.jersey_number, entry?.playerNumber, entry?.player_number);
    return configuredJersey === null || configuredJersey === identity.jerseyNumber;
  }

  function registryArt(identity) {
    const entry = registry.find((candidate) => registryEntryMatches(candidate, identity));
    return normalizeArt(entry, { sourceType: 'asset', isFallback: true });
  }

  async function loadRegistry(force = false) {
    if (registryPromise) return registryPromise;
    if (!force && registry.length) return registry;
    registryPromise = (async () => {
      try {
        const response = await fetch(`${REGISTRY_URL}?v=20260918-profile-art-studio-v1`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Registry returned ${response.status}.`);
        const data = await response.json();
        registry = Array.isArray(data?.players) ? data.players : [];
      } catch (error) {
        registry = [];
        console.warn('[Real Play] Premium profile art fallback registry could not be loaded.', error);
      } finally {
        registryPromise = null;
      }
      return registry;
    })();
    return registryPromise;
  }

  async function checkAdminAccess(force = false) {
    if (!force && adminAccess !== null) return adminAccess;
    if (adminPromise) return adminPromise;
    const accessToken = token();
    if (!accessToken) {
      adminAccess = false;
      return false;
    }

    adminPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art/access`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        adminAccess = response.ok;
      } catch (_error) {
        adminAccess = false;
      } finally {
        adminPromise = null;
      }
      scheduleRender();
      return adminAccess;
    })();
    return adminPromise;
  }

  function resolveArtSrc(art) {
    const src = String(art?.src || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/api/')) return `${API_BASE_URL}${src}`;
    return src;
  }

  async function loadPanelArt(panel, force = false) {
    const identity = panelIdentity(panel);
    const state = stateFor(panel);
    if (!identity.playerId) return;

    if (state.playerId !== identity.playerId) {
      state.playerId = identity.playerId;
      state.loaded = false;
      state.art = null;
      state.draft = null;
      state.editorOpen = false;
      panel.classList.remove('rp-profile-art-editing');
      panel.querySelector('[data-rp-profile-art-editor]')?.remove();
    }
    if (state.loading || (state.loaded && !force)) return;

    state.loading = true;
    await loadRegistry();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/real-play/profile-art?playerId=${encodeURIComponent(identity.playerId)}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Profile art API returned ${response.status}.`);
      const data = await response.json();
      // A backend row, including enabled=false, is authoritative and suppresses
      // the old static registry fallback.
      if (data && Object.prototype.hasOwnProperty.call(data, 'art') && data.art !== null) {
        state.art = normalizeArt(data.art, { backendAuthoritative: true });
      } else {
        state.art = registryArt(identity);
      }
    } catch (_error) {
      // During backend rollout or temporary outages, current static art keeps
      // rendering instead of disappearing.
      state.art = registryArt(identity);
    } finally {
      state.loaded = true;
      state.loading = false;
      if (!state.editorOpen) state.draft = cloneArt(state.art);
      scheduleRender();
    }
  }

  function setEditorStatus(panel, message = '', type = '') {
    const node = panel.querySelector('[data-rp-profile-art-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function updateEditorReadout(panel) {
    const state = stateFor(panel);
    const art = state.draft || state.art;
    const zoom = panel.querySelector('[data-rp-profile-art-zoom-value]');
    if (zoom) zoom.textContent = `${Math.round(finite(art?.scale, DEFAULT_ART.scale) * 100)}%`;
  }

  function applyLayerTransform(layer, art) {
    if (!layer || !art) return;
    layer.style.setProperty('--rp-art-x', `${clamp(finite(art.positionX, DEFAULT_ART.positionX), -50, 150)}%`);
    layer.style.setProperty('--rp-art-y', `${clamp(finite(art.positionY, DEFAULT_ART.positionY), -50, 150)}%`);
    layer.style.setProperty('--rp-art-scale', String(clamp(finite(art.scale, DEFAULT_ART.scale), 0.4, 4)));
    layer.style.setProperty('--rp-art-opacity', String(clamp(finite(art.opacity, DEFAULT_ART.opacity), 0, 1)));
  }

  function removeArtLayer(panel) {
    panel.querySelector('[data-rp-premium-profile-art]')?.remove();
    panel.classList.remove('has-rp-premium-profile-art');
  }

  function renderArtLayer(panel) {
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return;
    const state = stateFor(panel);
    const art = state.editorOpen ? (state.draft || state.art) : state.art;
    if (!art || art.enabled === false || !String(art.src || '').trim()) {
      removeArtLayer(panel);
      return;
    }

    let layer = hero.querySelector('[data-rp-premium-profile-art]');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rp-premium-profile-art';
      layer.dataset.rpPremiumProfileArt = 'true';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<img alt="" draggable="false" /><span class="rp-premium-profile-art-atmosphere"></span>';
      hero.insertBefore(layer, hero.firstChild);
    }

    applyLayerTransform(layer, art);
    const image = layer.querySelector('img');
    const src = resolveArtSrc(art);
    if (image && image.dataset.src !== src) {
      image.dataset.src = src;
      layer.classList.remove('is-ready');
      image.onload = () => {
        if (image.dataset.src !== src) return;
        layer.classList.add('is-ready');
        panel.classList.add('has-rp-premium-profile-art');
      };
      image.onerror = () => {
        if (image.dataset.src !== src) return;
        layer.classList.remove('is-ready');
        console.warn(`[Real Play] Premium profile art could not be loaded: ${src}`);
      };
      image.src = src;
      if (image.complete && image.naturalWidth > 0) image.onload();
    } else if (layer.classList.contains('is-ready')) {
      panel.classList.add('has-rp-premium-profile-art');
    }
  }

  function cameraSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 5.2 9.7 3.5h4.6l1.3 1.7H19a2.5 2.5 0 0 1 2.5 2.5v9.8A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5V7.7A2.5 2.5 0 0 1 5 5.2h3.4Zm3.6 3A4.4 4.4 0 1 0 12 17a4.4 4.4 0 0 0 0-8.8Zm0 2A2.4 2.4 0 1 1 12 15a2.4 2.4 0 0 1 0-4.8Z"/></svg>';
  }

  function ensureAdminButton(panel) {
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return;
    let button = hero.querySelector('[data-rp-profile-art-edit]');
    if (!adminAccess) {
      button?.remove();
      return;
    }
    if (button) return;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-profile-art-edit-button';
    button.dataset.rpProfileArtEdit = 'true';
    button.setAttribute('aria-label', 'Edit premium player artwork');
    button.title = 'Edit premium player artwork';
    button.innerHTML = cameraSvg();
    hero.appendChild(button);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEditor(panel);
    });
  }

  function editorMarkup(hasArt) {
    return `
      <section class="rp-profile-art-editor" data-rp-profile-art-editor>
        <input type="file" accept="image/png,image/webp" data-rp-profile-art-file hidden />
        <div class="rp-profile-art-editor-head">
          <div><small>ADMIN · PREMIUM PROFILE</small><strong>PROFILE ART STUDIO</strong></div>
          <span>DRAG / PINCH ON CARD</span>
        </div>
        <div class="rp-profile-art-editor-row rp-profile-art-upload-row">
          <button type="button" data-rp-profile-art-action="upload">${cameraSvg()}<span>${hasArt ? 'UPLOAD / REPLACE' : 'UPLOAD ART'}</span></button>
          <div class="rp-profile-art-zoom">
            <button type="button" data-rp-profile-art-action="zoom-out" aria-label="Zoom out">−</button>
            <output data-rp-profile-art-zoom-value>115%</output>
            <button type="button" data-rp-profile-art-action="zoom-in" aria-label="Zoom in">+</button>
          </div>
        </div>
        <div class="rp-profile-art-nudge" aria-label="Move portrait precisely">
          <button type="button" data-rp-profile-art-action="up" aria-label="Move up">↑</button>
          <button type="button" data-rp-profile-art-action="left" aria-label="Move left">←</button>
          <button type="button" data-rp-profile-art-action="down" aria-label="Move down">↓</button>
          <button type="button" data-rp-profile-art-action="right" aria-label="Move right">→</button>
        </div>
        <p class="rp-profile-art-editor-help">The whole profile header is your canvas. Drag the player anywhere, pinch or use − / + to zoom, then save.</p>
        <p class="rp-profile-art-editor-status" data-rp-profile-art-status aria-live="polite"></p>
        <div class="rp-profile-art-editor-actions">
          <button type="button" data-rp-profile-art-action="reset">RESET</button>
          ${hasArt ? '<button type="button" class="danger" data-rp-profile-art-action="remove">REMOVE</button>' : ''}
          <button type="button" data-rp-profile-art-action="cancel">CANCEL</button>
          <button type="button" class="primary" data-rp-profile-art-action="save">SAVE</button>
        </div>
      </section>`;
  }

  function ensureEditor(panel) {
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return null;
    let editor = panel.querySelector('[data-rp-profile-art-editor]');
    if (editor) return editor;
    const state = stateFor(panel);
    hero.insertAdjacentHTML('afterend', editorMarkup(Boolean(state.art && state.art.enabled !== false)));
    editor = panel.querySelector('[data-rp-profile-art-editor]');
    if (!editor) return null;

    editor.addEventListener('click', (event) => {
      const action = event.target.closest('[data-rp-profile-art-action]')?.dataset?.rpProfileArtAction;
      if (!action) return;
      event.preventDefault();
      handleEditorAction(panel, action);
    });

    editor.querySelector('[data-rp-profile-art-file]')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0] || null;
      if (file) uploadArt(panel, file);
      event.target.value = '';
    });
    return editor;
  }

  function closeEditor(panel, { restore = true } = {}) {
    const state = stateFor(panel);
    if (restore) state.draft = cloneArt(state.art);
    state.editorOpen = false;
    state.pointers.clear();
    state.pinch = null;
    state.dragLast = null;
    panel.classList.remove('rp-profile-art-editing');
    panel.querySelector('[data-rp-profile-art-editor]')?.remove();
    renderArtLayer(panel);
  }

  function openEditor(panel) {
    if (!adminAccess) return;
    const state = stateFor(panel);
    if (!state.playerId) state.playerId = panelIdentity(panel).playerId;
    if (!state.playerId) return;
    state.editorOpen = true;
    state.draft = cloneArt(state.art) || {
      ...DEFAULT_ART,
      playerId: state.playerId,
      src: '',
      sourceType: 'upload',
      isFallback: false,
      backendAuthoritative: true,
    };
    panel.classList.add('rp-profile-art-editing');
    ensureEditor(panel);
    bindHeroGestures(panel);
    updateEditorReadout(panel);
    renderArtLayer(panel);
    if (!state.art) {
      window.setTimeout(() => panel.querySelector('[data-rp-profile-art-file]')?.click(), 60);
    }
  }

  function adjustDraft(panel, changes = {}) {
    const state = stateFor(panel);
    if (!state.editorOpen || !state.draft) return;
    if (changes.positionX !== undefined) state.draft.positionX = clamp(finite(changes.positionX, state.draft.positionX), -50, 150);
    if (changes.positionY !== undefined) state.draft.positionY = clamp(finite(changes.positionY, state.draft.positionY), -50, 150);
    if (changes.scale !== undefined) state.draft.scale = clamp(finite(changes.scale, state.draft.scale), 0.4, 4);
    renderArtLayer(panel);
    updateEditorReadout(panel);
  }

  function bindHeroGestures(panel) {
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero || hero.__rpProfileArtGesturesBound) return;
    hero.__rpProfileArtGesturesBound = true;

    hero.addEventListener('pointerdown', (event) => {
      const state = stateFor(panel);
      if (!state.editorOpen || event.target.closest('[data-rp-profile-art-edit]')) return;
      event.preventDefault();
      try { hero.setPointerCapture(event.pointerId); } catch (_error) {}
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size === 1) {
        state.dragLast = { x: event.clientX, y: event.clientY };
        state.pinch = null;
      } else if (state.pointers.size === 2) {
        const points = [...state.pointers.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        state.pinch = { distance: Math.max(1, distance), scale: state.draft?.scale || DEFAULT_ART.scale };
        state.dragLast = null;
      }
    });

    hero.addEventListener('pointermove', (event) => {
      const state = stateFor(panel);
      if (!state.editorOpen || !state.pointers.has(event.pointerId)) return;
      event.preventDefault();
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (state.pointers.size >= 2) {
        const points = [...state.pointers.values()].slice(0, 2);
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (!state.pinch) {
          state.pinch = { distance: Math.max(1, distance), scale: state.draft?.scale || DEFAULT_ART.scale };
        } else {
          adjustDraft(panel, { scale: state.pinch.scale * (distance / state.pinch.distance) });
        }
        return;
      }

      if (state.dragLast) {
        const dx = event.clientX - state.dragLast.x;
        const dy = event.clientY - state.dragLast.y;
        state.dragLast = { x: event.clientX, y: event.clientY };
        adjustDraft(panel, {
          positionX: (state.draft?.positionX || DEFAULT_ART.positionX) + (dx / rect.width) * 100,
          positionY: (state.draft?.positionY || DEFAULT_ART.positionY) + (dy / rect.height) * 100,
        });
      }
    });

    const release = (event) => {
      const state = stateFor(panel);
      state.pointers.delete(event.pointerId);
      state.pinch = null;
      const remaining = [...state.pointers.values()];
      state.dragLast = remaining.length === 1 ? { ...remaining[0] } : null;
    };
    hero.addEventListener('pointerup', release);
    hero.addEventListener('pointercancel', release);

    hero.addEventListener('wheel', (event) => {
      const state = stateFor(panel);
      if (!state.editorOpen || !state.draft) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.06 : 0.06;
      adjustDraft(panel, { scale: state.draft.scale + delta });
    }, { passive: false });
  }

  async function uploadArt(panel, file) {
    const state = stateFor(panel);
    if (state.busy || !state.playerId) return;
    if (!['image/png', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
      setEditorStatus(panel, 'Use a transparent PNG or WebP image.', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setEditorStatus(panel, 'Image must be 15 MB or smaller.', 'error');
      return;
    }
    const accessToken = token();
    if (!accessToken) {
      setEditorStatus(panel, 'Admin session expired. Log in again.', 'error');
      return;
    }

    state.busy = true;
    setEditorStatus(panel, 'UPLOADING PREMIUM ART…');
    try {
      const query = new URLSearchParams({
        playerId: String(state.playerId),
        positionX: String(DEFAULT_ART.positionX),
        positionY: String(DEFAULT_ART.positionY),
        scale: String(DEFAULT_ART.scale),
        opacity: String(DEFAULT_ART.opacity),
      });
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art/upload?${query}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': file.type,
          'X-File-Name': encodeURIComponent(file.name || 'premium-profile-art'),
        },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Upload failed.');
      const art = normalizeArt(data?.art, { backendAuthoritative: true });
      if (!art) throw new Error('The uploaded artwork was not returned by the server.');
      state.art = art;
      state.draft = cloneArt(art);
      state.loaded = true;
      renderArtLayer(panel);
      updateEditorReadout(panel);
      setEditorStatus(panel, 'IMAGE UPLOADED · DRAG / ZOOM, THEN SAVE POSITION.', 'success');
      refreshEditorButtons(panel);
    } catch (error) {
      setEditorStatus(panel, error.message || 'Upload failed.', 'error');
    } finally {
      state.busy = false;
    }
  }

  function refreshEditorButtons(panel) {
    const state = stateFor(panel);
    const oldEditor = panel.querySelector('[data-rp-profile-art-editor]');
    if (!oldEditor || !state.editorOpen) return;
    const status = oldEditor.querySelector('[data-rp-profile-art-status]')?.textContent || '';
    const statusType = oldEditor.querySelector('[data-rp-profile-art-status]')?.classList.contains('error') ? 'error'
      : oldEditor.querySelector('[data-rp-profile-art-status]')?.classList.contains('success') ? 'success' : '';
    oldEditor.remove();
    ensureEditor(panel);
    updateEditorReadout(panel);
    if (status) setEditorStatus(panel, status, statusType);
  }

  async function saveArt(panel) {
    const state = stateFor(panel);
    if (state.busy || !state.playerId || !state.draft || !state.art) {
      if (!state.art) setEditorStatus(panel, 'Upload an image first.', 'error');
      return;
    }
    const accessToken = token();
    if (!accessToken) return setEditorStatus(panel, 'Admin session expired. Log in again.', 'error');

    state.busy = true;
    setEditorStatus(panel, 'SAVING POSITION…');
    try {
      const body = {
        playerId: state.playerId,
        positionX: state.draft.positionX,
        positionY: state.draft.positionY,
        scale: state.draft.scale,
        opacity: state.draft.opacity,
        enabled: true,
      };
      if (state.art.sourceType === 'asset') body.assetPath = state.art.src;
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Could not save profile art.');
      state.art = normalizeArt(data?.art, { backendAuthoritative: true });
      state.draft = cloneArt(state.art);
      state.loaded = true;
      closeEditor(panel, { restore: false });
      try {
        window.dispatchEvent(new CustomEvent('realplay:profile-art-updated', {
          detail: { playerId: state.playerId, art: cloneArt(state.art) },
        }));
      } catch (_error) {}
    } catch (error) {
      setEditorStatus(panel, error.message || 'Could not save profile art.', 'error');
    } finally {
      state.busy = false;
    }
  }

  async function removeArt(panel) {
    const state = stateFor(panel);
    if (state.busy || !state.playerId || !state.art) return;
    if (!window.confirm('Remove this player’s premium profile art?')) return;
    const accessToken = token();
    if (!accessToken) return setEditorStatus(panel, 'Admin session expired. Log in again.', 'error');

    state.busy = true;
    setEditorStatus(panel, 'REMOVING ART…');
    try {
      // A static fallback needs an authoritative disabled backend record so the
      // old registry art does not immediately reappear after removal.
      if (state.art.sourceType === 'asset') {
        const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            playerId: state.playerId,
            assetPath: state.art.src,
            positionX: state.art.positionX,
            positionY: state.art.positionY,
            scale: state.art.scale,
            opacity: state.art.opacity,
            enabled: false,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || data?.error || 'Could not remove profile art.');
        state.art = normalizeArt(data?.art, { backendAuthoritative: true });
      } else {
        const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art?playerId=${encodeURIComponent(state.playerId)}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || data?.error || 'Could not remove profile art.');
        state.art = null;
      }
      state.draft = cloneArt(state.art);
      state.loaded = true;
      closeEditor(panel, { restore: false });
      removeArtLayer(panel);
    } catch (error) {
      setEditorStatus(panel, error.message || 'Could not remove profile art.', 'error');
    } finally {
      state.busy = false;
    }
  }

  function handleEditorAction(panel, action) {
    const state = stateFor(panel);
    if (state.busy && !['cancel'].includes(action)) return;
    switch (action) {
      case 'upload':
        panel.querySelector('[data-rp-profile-art-file]')?.click();
        break;
      case 'zoom-in':
        if (state.draft) adjustDraft(panel, { scale: state.draft.scale + 0.05 });
        break;
      case 'zoom-out':
        if (state.draft) adjustDraft(panel, { scale: state.draft.scale - 0.05 });
        break;
      case 'left':
        if (state.draft) adjustDraft(panel, { positionX: state.draft.positionX - 1 });
        break;
      case 'right':
        if (state.draft) adjustDraft(panel, { positionX: state.draft.positionX + 1 });
        break;
      case 'up':
        if (state.draft) adjustDraft(panel, { positionY: state.draft.positionY - 1 });
        break;
      case 'down':
        if (state.draft) adjustDraft(panel, { positionY: state.draft.positionY + 1 });
        break;
      case 'reset':
        if (state.draft) adjustDraft(panel, {
          positionX: DEFAULT_ART.positionX,
          positionY: DEFAULT_ART.positionY,
          scale: DEFAULT_ART.scale,
        });
        break;
      case 'cancel':
        closeEditor(panel);
        break;
      case 'save':
        saveArt(panel);
        break;
      case 'remove':
        removeArt(panel);
        break;
      default:
        break;
    }
  }

  function renderPanel(panel) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return;
    const identity = panelIdentity(panel);
    if (!identity.playerId) return;
    const state = stateFor(panel);
    if (state.playerId !== identity.playerId || !state.loaded) loadPanelArt(panel);
    renderArtLayer(panel);
    ensureAdminButton(panel);
    if (state.editorOpen) {
      ensureEditor(panel);
      updateEditorReadout(panel);
    }
  }

  function renderAll() {
    scheduled = false;
    document.querySelectorAll('.rp-profile.open').forEach(renderPanel);
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderAll);
  }

  function refreshOpenProfiles() {
    document.querySelectorAll('.rp-profile.open').forEach((panel) => loadPanelArt(panel, true));
    scheduleRender();
  }

  window.addEventListener('realplay:profile-loaded', refreshOpenProfiles);
  window.addEventListener('realplay:public-profile-loaded', refreshOpenProfiles);
  window.addEventListener('realplay:app-ready', () => {
    loadRegistry().finally(scheduleRender);
    checkAdminAccess().finally(scheduleRender);
  });
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) {
      adminAccess = null;
      checkAdminAccess(true).finally(scheduleRender);
    }
  });

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') {
        return mutation.target instanceof HTMLElement && mutation.target.classList.contains('rp-profile');
      }
      return [...mutation.addedNodes].some((node) => (
        node instanceof HTMLElement &&
        (node.matches?.('.rp-profile, .rp-profile-hero') || node.querySelector?.('.rp-profile, .rp-profile-hero'))
      ));
    });
    if (relevant) scheduleRender();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.RealPlayPremiumProfileArt = {
    refresh: refreshOpenProfiles,
    reloadRegistry: async () => {
      registry = [];
      await loadRegistry(true);
      refreshOpenProfiles();
    },
    editOpenProfile: () => {
      const panel = document.querySelector('.rp-profile.open');
      if (panel) openEditor(panel);
    },
  };

  loadRegistry().finally(scheduleRender);
  checkAdminAccess().finally(scheduleRender);
})();
