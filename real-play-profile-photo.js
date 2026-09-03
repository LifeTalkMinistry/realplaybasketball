(() => {
  if (window.__realPlayProfilePhotoInstalled) return;
  window.__realPlayProfilePhotoInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const PHOTO_KEY_PREFIX = 'real_play_profile_photo_v1:';

  let profileState = null;
  let stableKey = 'player';
  let activePhoto = '';
  let editor = null;
  let fileInput = null;
  let sourceImage = null;
  let objectUrl = '';
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragStart = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function safeKey(value) {
    return String(value || 'player').trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, '-').slice(0, 160) || 'player';
  }

  function photoStorageKey() {
    return `${PHOTO_KEY_PREFIX}${stableKey}`;
  }

  function playerInitials() {
    const name = String(
      profileState?.profile?.player_name ||
      profileState?.profile?.playerName ||
      profileState?.profile?.name ||
      document.querySelector('.rp-profile-name h1')?.textContent ||
      'RP'
    ).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
  }

  async function loadIdentity() {
    const accessToken = token();
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      profileState = await response.json().catch(() => ({}));
      const profile = profileState?.profile || {};
      stableKey = safeKey(
        profile.user_id || profile.userId || profile.id || profile.email ||
        `${profile.player_name || profile.playerName || profile.name || 'player'}-${profileState?.currentNumber?.number ?? ''}`
      );
      const localPhoto = localStorage.getItem(photoStorageKey()) || '';
      const serverPhoto = String(profile.avatar_url || profile.avatarUrl || '').trim();
      activePhoto = localPhoto || serverPhoto;
      mountPhoto();
    } catch (_error) {
      // Profile remains usable even if identity refresh is temporarily unavailable.
    }
  }

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
    fileInput.className = 'rp-profile-photo-input';
    fileInput.setAttribute('aria-label', 'Choose player profile photo');
    fileInput.addEventListener('change', handleFile);
    document.body.appendChild(fileInput);
    return fileInput;
  }

  function photoMarkup() {
    if (activePhoto) {
      return `
        <img src="${activePhoto}" alt="Player profile photo" data-rp-player-photo-img />
        <span class="rp-profile-photo-shade" aria-hidden="true"></span>
        <span class="rp-profile-photo-edit" aria-hidden="true">✎</span>
        <span class="sr-only">Change player photo</span>`;
    }
    return `
      <span class="rp-profile-photo-placeholder" aria-hidden="true">
        <b>${playerInitials()}</b>
        <i>＋</i>
      </span>
      <strong>ADD PHOTO</strong>`;
  }

  function mountPhoto() {
    const panel = document.querySelector('[data-rp-profile]');
    const player = panel?.querySelector('.rp-profile-player');
    if (!panel || !player) return;

    let button = player.querySelector('[data-rp-player-photo]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-profile-photo';
      button.dataset.rpPlayerPhoto = 'true';
      button.setAttribute('aria-label', 'Add player profile photo');
      button.addEventListener('click', () => ensureFileInput().click());
      player.appendChild(button);
    }

    player.classList.add('rp-profile-player-with-photo');
    button.classList.toggle('has-photo', Boolean(activePhoto));
    button.setAttribute('aria-label', activePhoto ? 'Change player profile photo' : 'Add player profile photo');
    button.innerHTML = photoMarkup();
  }

  function createEditor() {
    if (editor) return editor;
    editor = document.createElement('div');
    editor.className = 'rp-profile-photo-editor';
    editor.hidden = true;
    editor.innerHTML = `
      <section class="rp-profile-photo-editor-card" role="dialog" aria-modal="true" aria-labelledby="rp-photo-editor-title">
        <header>
          <div><small>PLAYER IDENTITY</small><h2 id="rp-photo-editor-title">SET YOUR PHOTO.</h2></div>
          <button type="button" data-rp-photo-cancel aria-label="Close photo editor">×</button>
        </header>
        <div class="rp-profile-crop" data-rp-photo-crop>
          <img alt="Photo crop preview" data-rp-photo-preview draggable="false" />
          <span class="rp-profile-crop-frame" aria-hidden="true"></span>
        </div>
        <p>Drag to reposition. Use the slider to zoom.</p>
        <label class="rp-profile-photo-zoom">
          <span>ZOOM</span>
          <input type="range" min="1" max="2.5" step="0.01" value="1" data-rp-photo-zoom />
        </label>
        <div class="rp-profile-photo-editor-actions">
          <button type="button" class="secondary" data-rp-photo-cancel>NOT YET</button>
          <button type="button" class="primary" data-rp-photo-save>SAVE PHOTO</button>
        </div>
      </section>`;
    document.body.appendChild(editor);

    editor.querySelectorAll('[data-rp-photo-cancel]').forEach((button) => button.addEventListener('click', closeEditor));
    editor.addEventListener('click', (event) => { if (event.target === editor) closeEditor(); });
    editor.querySelector('[data-rp-photo-save]')?.addEventListener('click', saveCrop);
    editor.querySelector('[data-rp-photo-zoom]')?.addEventListener('input', (event) => {
      zoom = Number(event.target.value || 1);
      constrainOffsets();
      renderPreview();
    });

    const crop = editor.querySelector('[data-rp-photo-crop]');
    crop?.addEventListener('pointerdown', startDrag);
    crop?.addEventListener('pointermove', moveDrag);
    crop?.addEventListener('pointerup', endDrag);
    crop?.addEventListener('pointercancel', endDrag);
    return editor;
  }

  function cropMetrics() {
    const crop = editor?.querySelector('[data-rp-photo-crop]');
    if (!crop || !sourceImage) return null;
    const width = crop.clientWidth;
    const height = crop.clientHeight;
    const base = Math.max(width / sourceImage.naturalWidth, height / sourceImage.naturalHeight);
    const scale = base * zoom;
    const displayWidth = sourceImage.naturalWidth * scale;
    const displayHeight = sourceImage.naturalHeight * scale;
    return {
      width, height, base, scale, displayWidth, displayHeight,
      maxX: Math.max(0, (displayWidth - width) / 2),
      maxY: Math.max(0, (displayHeight - height) / 2),
    };
  }

  function constrainOffsets() {
    const metrics = cropMetrics();
    if (!metrics) return;
    offsetX = clamp(offsetX, -metrics.maxX, metrics.maxX);
    offsetY = clamp(offsetY, -metrics.maxY, metrics.maxY);
  }

  function renderPreview() {
    const preview = editor?.querySelector('[data-rp-photo-preview]');
    const metrics = cropMetrics();
    if (!preview || !metrics) return;
    preview.style.width = `${metrics.displayWidth}px`;
    preview.style.height = `${metrics.displayHeight}px`;
    preview.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
  }

  function startDrag(event) {
    if (!sourceImage) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
  }

  function moveDrag(event) {
    if (!dragStart) return;
    offsetX = dragStart.offsetX + (event.clientX - dragStart.x);
    offsetY = dragStart.offsetY + (event.clientY - dragStart.y);
    constrainOffsets();
    renderPreview();
  }

  function endDrag() {
    dragStart = null;
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) {
      setProfileStatus('Choose a JPG, PNG, WEBP, or phone photo.', true);
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setProfileStatus('That photo is too large. Choose an image under 12 MB.', true);
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      sourceImage = image;
      zoom = 1;
      offsetX = 0;
      offsetY = 0;
      openEditor();
    };
    image.onerror = () => setProfileStatus('That photo could not be opened. Try another image.', true);
    image.src = objectUrl;
  }

  function openEditor() {
    createEditor();
    const preview = editor.querySelector('[data-rp-photo-preview]');
    const slider = editor.querySelector('[data-rp-photo-zoom]');
    preview.src = objectUrl;
    slider.value = '1';
    editor.hidden = false;
    document.body.classList.add('rp-profile-photo-editing');
    requestAnimationFrame(() => {
      constrainOffsets();
      renderPreview();
    });
  }

  function closeEditor() {
    if (!editor) return;
    editor.hidden = true;
    document.body.classList.remove('rp-profile-photo-editing');
    sourceImage = null;
    dragStart = null;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
  }

  function setProfileStatus(message, error = false) {
    const node = document.querySelector('[data-rp-profile-status]');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', error);
    node.classList.toggle('success', Boolean(message) && !error);
    if (message && !error) setTimeout(() => {
      if (node.textContent === message) {
        node.textContent = '';
        node.classList.remove('success');
      }
    }, 1800);
  }

  function saveCrop() {
    if (!sourceImage) return;
    const metrics = cropMetrics();
    if (!metrics) return;

    const sourceWidth = metrics.width / metrics.scale;
    const sourceHeight = metrics.height / metrics.scale;
    let sourceX = ((metrics.displayWidth - metrics.width) / 2 - offsetX) / metrics.scale;
    let sourceY = ((metrics.displayHeight - metrics.height) / 2 - offsetY) / metrics.scale;
    sourceX = clamp(sourceX, 0, Math.max(0, sourceImage.naturalWidth - sourceWidth));
    sourceY = clamp(sourceY, 0, Math.max(0, sourceImage.naturalHeight - sourceHeight));

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    context.drawImage(
      sourceImage,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    try {
      localStorage.setItem(photoStorageKey(), dataUrl);
      activePhoto = dataUrl;
      mountPhoto();
      closeEditor();
      setProfileStatus('PLAYER PHOTO SAVED.');
      window.dispatchEvent(new CustomEvent('realplay:profile-photo-changed', { detail: { photo: dataUrl, key: stableKey } }));
    } catch (_error) {
      setProfileStatus('Your browser could not save this photo. Try a smaller image.', true);
    }
  }

  function observeProfile() {
    const observer = new MutationObserver(() => {
      const panel = document.querySelector('[data-rp-profile]');
      if (!panel) return;
      if (panel.classList.contains('open')) {
        mountPhoto();
        if (!profileState) loadIdentity();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]')) return;
    setTimeout(() => {
      profileState = null;
      loadIdentity();
      mountPhoto();
    }, 120);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && editor && !editor.hidden) {
      event.preventDefault();
      closeEditor();
    }
  });

  observeProfile();
  ensureFileInput();
  createEditor();
  loadIdentity();
})();