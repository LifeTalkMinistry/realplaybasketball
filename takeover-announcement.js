(() => {
  if (window.__realPlayTakeoverInstalled) return;
  window.__realPlayTakeoverInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_ENDPOINT = `${API_BASE_URL}/api/real-play/public/takeover`;
  const ADMIN_ENDPOINT = `${API_BASE_URL}/api/real-play/admin/takeover`;
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-takeover-styles';

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.rp-takeover-open{overflow:hidden!important;touch-action:none!important}
    .rp-takeover{position:fixed;inset:0;z-index:2147483600;display:none;background:#020306;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .rp-takeover.open{display:block}
    .rp-takeover::before,.rp-takeover::after{content:"";position:absolute;inset:auto;pointer-events:none;filter:blur(70px);opacity:.28}
    .rp-takeover::before{width:42vw;height:42vw;max-width:520px;max-height:520px;left:-16vw;top:-12vw;background:#176bff;border-radius:50%}
    .rp-takeover::after{width:46vw;height:46vw;max-width:560px;max-height:560px;right:-18vw;bottom:-15vw;background:#ff294d;border-radius:50%}
    .rp-takeover-canvas{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:rgba(2,3,6,.46)}
    .rp-takeover-media{position:relative;z-index:1;display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:var(--rp-takeover-fit,contain);object-position:center;background:transparent}
    .rp-takeover-cta:focus-visible{outline:3px solid #42d8ff;outline-offset:3px}
    .rp-takeover-label{position:absolute;z-index:3;left:max(14px,env(safe-area-inset-left));top:max(18px,env(safe-area-inset-top));max-width:calc(100vw - 90px);padding:8px 12px;border-radius:999px;background:rgba(2,3,6,.64);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rp-takeover-label[hidden]{display:none!important}
    .rp-takeover-cta{position:absolute;z-index:5;left:50%;bottom:max(22px,calc(env(safe-area-inset-bottom) + 16px));transform:translateX(-50%);width:min(360px,calc(100vw - 36px));min-height:52px;padding:13px 22px;border:1px solid rgba(255,255,255,.34);border-radius:14px;background:linear-gradient(135deg,#176bff,#42d8ff);color:#03101b;font:inherit;font-size:.9rem;font-weight:950;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;box-shadow:0 14px 38px rgba(0,0,0,.42);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
    .rp-takeover-cta[hidden]{display:none!important}
    .rp-takeover-cta:active{transform:translateX(-50%) translateY(1px)}
    .rp-takeover-fallback{position:relative;z-index:2;display:none;text-align:center;padding:28px;max-width:520px}
    .rp-takeover-fallback.show{display:block}
    .rp-takeover-fallback strong{display:block;font-size:clamp(1.7rem,7vw,3rem);font-style:italic;letter-spacing:.02em}
    .rp-takeover-fallback span{display:block;margin-top:8px;color:#aab5c9;font-size:.85rem;letter-spacing:.08em}

    .rp-takeover-admin{position:fixed;inset:0;z-index:2147483590;display:none;background:#020306;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto}
    .rp-takeover-admin.open{display:block}
    .rp-takeover-admin-shell{width:min(760px,100%);min-height:100dvh;margin:0 auto;padding:max(18px,env(safe-area-inset-top)) 18px max(32px,env(safe-area-inset-bottom));box-sizing:border-box;background:linear-gradient(180deg,rgba(14,20,34,.98),rgba(3,5,10,.99))}
    .rp-takeover-admin-head{display:flex;align-items:center;gap:14px;margin-bottom:22px}
    .rp-takeover-admin-back{width:42px;height:42px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:#0b111d;color:#fff;font-size:22px;cursor:pointer}
    .rp-takeover-admin-head small{display:block;color:#42d8ff;font-size:10px;font-weight:900;letter-spacing:.18em}
    .rp-takeover-admin-head h2{margin:2px 0 0;font-size:clamp(1.6rem,6vw,2.4rem);font-style:italic;line-height:1}
    .rp-takeover-admin-note{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(66,216,255,.2);border-radius:14px;background:rgba(66,216,255,.06);color:#b8c8da;font-size:.8rem;line-height:1.5}
    .rp-takeover-admin-form{display:grid;gap:14px}
    .rp-takeover-field{display:grid;gap:7px}
    .rp-takeover-field>span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#aeb9ca;text-transform:uppercase}
    .rp-takeover-field input[type="text"],.rp-takeover-field input[type="url"],.rp-takeover-field input[type="file"],.rp-takeover-field select{width:100%;min-height:46px;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#090e18;color:#fff;padding:11px 12px;font:inherit}
    .rp-takeover-field input[type="file"]{padding:9px}
    .rp-takeover-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .rp-takeover-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 14px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:#090e18}
    .rp-takeover-toggle span{font-size:.82rem;font-weight:800}
    .rp-takeover-toggle input{width:20px;height:20px;accent-color:#42d8ff}
    .rp-takeover-preview-box{position:relative;min-height:180px;aspect-ratio:16/9;border:1px dashed rgba(255,255,255,.2);border-radius:16px;overflow:hidden;background:#05080e;display:grid;place-items:center}
    .rp-takeover-preview-box img,.rp-takeover-preview-box video{width:100%;height:100%;object-fit:contain;display:block}
    .rp-takeover-preview-empty{color:#64748b;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-align:center;padding:20px}
    .rp-takeover-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
    .rp-takeover-actions button{min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.16);font:inherit;font-size:.82rem;font-weight:950;letter-spacing:.06em;cursor:pointer}
    .rp-takeover-preview-btn{background:#0c1725;color:#fff}
    .rp-takeover-publish-btn{background:linear-gradient(135deg,#176bff,#42d8ff);color:#03101b;border-color:transparent!important}
    .rp-takeover-deactivate-btn{grid-column:1/-1;background:rgba(255,41,77,.08);color:#ff7187;border-color:rgba(255,41,77,.28)!important}
    .rp-takeover-status{min-height:20px;margin:2px 0 0;color:#9aa9bc;font-size:.76rem;line-height:1.45}
    .rp-takeover-status.ok{color:#6ee7b7}.rp-takeover-status.error{color:#ff8798}
    @media(max-width:560px){.rp-takeover-grid,.rp-takeover-actions{grid-template-columns:1fr}.rp-takeover-deactivate-btn{grid-column:auto}.rp-takeover-cta{bottom:max(16px,calc(env(safe-area-inset-bottom) + 12px));min-height:50px}}
  `;
  document.head.appendChild(style);

  let current = null;
  let currentPreview = false;
  let previousFocus = null;
  let localPreviewUrl = '';
  let adminRowWatch = null;

  const takeover = document.createElement('div');
  takeover.className = 'rp-takeover';
  takeover.dataset.rpTakeover = 'true';
  takeover.setAttribute('aria-hidden', 'true');
  takeover.innerHTML = `
    <div class="rp-takeover-canvas" role="dialog" aria-modal="true" aria-label="Real Play announcement">
      <span class="rp-takeover-label" data-rp-takeover-label hidden></span>
      <button class="rp-takeover-cta" type="button" data-rp-takeover-cta>I Understand</button>
      <div class="rp-takeover-fallback" data-rp-takeover-fallback><strong>REAL PLAY</strong><span>ANNOUNCEMENT MEDIA UNAVAILABLE</span></div>
    </div>
  `;
  document.body.appendChild(takeover);

  const canvas = takeover.querySelector('.rp-takeover-canvas');
  const ctaButton = takeover.querySelector('[data-rp-takeover-cta]');
  const labelNode = takeover.querySelector('[data-rp-takeover-label]');
  const fallbackNode = takeover.querySelector('[data-rp-takeover-fallback]');

  const admin = document.createElement('div');
  admin.className = 'rp-takeover-admin';
  admin.dataset.rpTakeoverAdmin = 'true';
  admin.setAttribute('aria-hidden', 'true');
  admin.innerHTML = `
    <div class="rp-takeover-admin-shell">
      <header class="rp-takeover-admin-head">
        <button class="rp-takeover-admin-back" type="button" data-rp-takeover-admin-back aria-label="Back to settings">←</button>
        <div><small>ADMIN · FULL-SCREEN CANVAS</small><h2>TAKEOVER ANNOUNCEMENT</h2></div>
      </header>
      <p class="rp-takeover-admin-note">Upload the announcement creative, choose how it fits the screen, and set the acknowledgement button text shown at the bottom.</p>
      <form class="rp-takeover-admin-form" data-rp-takeover-form>
        <label class="rp-takeover-field"><span>Campaign / Version ID</span><input type="text" data-rp-takeover-id placeholder="example: september-special-01" maxlength="120"></label>
        <div class="rp-takeover-grid">
          <label class="rp-takeover-field"><span>Media Type</span><select data-rp-takeover-type><option value="image">Image</option><option value="video">Video</option></select></label>
          <label class="rp-takeover-field"><span>Screen Fit</span><select data-rp-takeover-fit><option value="contain">Show full creative</option><option value="cover">Fill entire screen</option></select></label>
        </div>
        <label class="rp-takeover-field"><span>Upload Photo or Video</span><input type="file" data-rp-takeover-file accept="image/*,video/*"></label>
        <label class="rp-takeover-field"><span>Or Media URL</span><input type="url" data-rp-takeover-url placeholder="https://..."></label>
        <label class="rp-takeover-field"><span>Small Label (optional)</span><input type="text" data-rp-takeover-label-input placeholder="ANNOUNCEMENT" maxlength="60"></label>
        <label class="rp-takeover-field"><span>Accessibility Description</span><input type="text" data-rp-takeover-alt placeholder="Describe the announcement image or video" maxlength="180"></label>
        <label class="rp-takeover-field"><span>CTA Button Text</span><input type="text" data-rp-takeover-cta-input placeholder="I Understand" maxlength="80"></label>
        <div class="rp-takeover-grid">
          <label class="rp-takeover-toggle"><span>Active</span><input type="checkbox" data-rp-takeover-active checked></label>
          <label class="rp-takeover-toggle"><span>Loop Video</span><input type="checkbox" data-rp-takeover-loop checked></label>
        </div>
        <div class="rp-takeover-preview-box" data-rp-takeover-preview-box><div class="rp-takeover-preview-empty">SELECT A PHOTO OR VIDEO TO PREVIEW</div></div>
        <div class="rp-takeover-actions">
          <button class="rp-takeover-preview-btn" type="button" data-rp-takeover-preview>FULL-SCREEN PREVIEW</button>
          <button class="rp-takeover-publish-btn" type="submit">PUBLISH</button>
          <button class="rp-takeover-deactivate-btn" type="button" data-rp-takeover-deactivate>DEACTIVATE CURRENT TAKEOVER</button>
        </div>
        <p class="rp-takeover-status" data-rp-takeover-status aria-live="polite"></p>
      </form>
    </div>
  `;
  document.body.appendChild(admin);

  const form = admin.querySelector('[data-rp-takeover-form]');
  const idInput = admin.querySelector('[data-rp-takeover-id]');
  const typeInput = admin.querySelector('[data-rp-takeover-type]');
  const fitInput = admin.querySelector('[data-rp-takeover-fit]');
  const fileInput = admin.querySelector('[data-rp-takeover-file]');
  const urlInput = admin.querySelector('[data-rp-takeover-url]');
  const labelInput = admin.querySelector('[data-rp-takeover-label-input]');
  const altInput = admin.querySelector('[data-rp-takeover-alt]');
  const ctaInput = admin.querySelector('[data-rp-takeover-cta-input]');
  const activeInput = admin.querySelector('[data-rp-takeover-active]');
  const loopInput = admin.querySelector('[data-rp-takeover-loop]');
  const previewBox = admin.querySelector('[data-rp-takeover-preview-box]');
  const statusNode = admin.querySelector('[data-rp-takeover-status]');

  function clean(value, max = 500) {
    return String(value ?? '').trim().slice(0, max);
  }

  function bool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
    return Boolean(value);
  }

  function hash(value) {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function normalize(payload) {
    const source = payload?.takeover ?? payload?.announcement ?? payload?.data ?? payload ?? {};
    const mediaUrl = clean(source.mediaUrl ?? source.media_url ?? source.url, 1600);
    const campaignId = clean(source.campaignId ?? source.campaign_id ?? source.version ?? source.id, 160) || (mediaUrl ? `media-${hash(mediaUrl)}` : '');
    const mediaTypeRaw = clean(source.mediaType ?? source.media_type ?? source.type, 20).toLowerCase();
    const inferredVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl);
    const mediaType = mediaTypeRaw === 'video' || (!mediaTypeRaw && inferredVideo) ? 'video' : 'image';
    return {
      campaignId,
      active: bool(source.active ?? source.enabled, false),
      mediaType,
      mediaUrl,
      posterUrl: clean(source.posterUrl ?? source.poster_url, 1600),
      fit: clean(source.fit ?? source.objectFit, 20).toLowerCase() === 'cover' ? 'cover' : 'contain',
      label: clean(source.label ?? source.kicker, 60),
      alt: clean(source.alt ?? source.description, 180) || 'Real Play announcement',
      loop: bool(source.loop, true),
      ctaText: clean(source.ctaText ?? source.cta_text, 80) || 'I Understand',
    };
  }

  function dismissalKey(item) {
    return item?.campaignId ? `real_play_takeover_seen:${item.campaignId}` : '';
  }

  function isDismissed(item) {
    const key = dismissalKey(item);
    return key ? Boolean(window.localStorage.getItem(key)) : false;
  }

  function markDismissed(item) {
    const key = dismissalKey(item);
    if (!key) return;
    try { window.localStorage.setItem(key, String(Date.now())); } catch (_error) {}
  }

  function clearMedia() {
    canvas.querySelectorAll('.rp-takeover-media').forEach((node) => node.remove());
    fallbackNode?.classList.remove('show');
  }

  function buildMedia(item) {
    clearMedia();
    const media = document.createElement(item.mediaType === 'video' ? 'video' : 'img');
    media.className = 'rp-takeover-media';
    media.style.setProperty('--rp-takeover-fit', item.fit || 'contain');
    media.setAttribute('aria-label', item.alt || 'Real Play announcement');

    if (item.mediaType === 'video') {
      media.src = item.mediaUrl;
      if (item.posterUrl) media.poster = item.posterUrl;
      media.autoplay = true;
      media.muted = true;
      media.playsInline = true;
      media.loop = item.loop !== false;
      media.preload = 'auto';
      media.setAttribute('playsinline', '');
      media.setAttribute('muted', '');
      media.addEventListener('canplay', () => media.play().catch(() => {}), { once: true });
    } else {
      media.src = item.mediaUrl;
      media.alt = item.alt || 'Real Play announcement';
      media.decoding = 'async';
    }

    media.addEventListener('error', () => {
      media.remove();
      fallbackNode?.classList.add('show');
    }, { once: true });

    canvas.insertBefore(media, fallbackNode);
    return media;
  }

  function show(itemInput, options = {}) {
    const item = normalize(itemInput);
    const preview = Boolean(options.preview);
    const ignoreDismissal = Boolean(options.ignoreDismissal || preview);
    if (!item.mediaUrl) return false;
    if (!preview && !item.active) return false;
    if (!ignoreDismissal && isDismissed(item)) return false;

    previousFocus = document.activeElement;
    current = item;
    currentPreview = preview;
    buildMedia(item);
    if (labelNode) {
      labelNode.textContent = item.label || '';
      labelNode.hidden = !item.label;
    }
    if (ctaButton) {
      ctaButton.textContent = item.ctaText || 'I Understand';
      ctaButton.hidden = false;
    }
    takeover.classList.add('open');
    takeover.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-takeover-open');
    window.requestAnimationFrame(() => ctaButton?.focus({ preventScroll: true }));
    return true;
  }

  function close() {
    if (!takeover.classList.contains('open')) return;
    const item = current;
    const preview = currentPreview;
    takeover.classList.remove('open');
    takeover.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-takeover-open');
    clearMedia();
    current = null;
    currentPreview = false;
    if (!preview && item) markDismissed(item);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus({ preventScroll: true }); } catch (_error) {}
    }
    previousFocus = null;
  }

  ctaButton?.addEventListener('click', close);
  takeover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      ctaButton?.focus({ preventScroll: true });
    }
  });
  takeover.addEventListener('pointerdown', (event) => {
    if (event.target === takeover || event.target === canvas) event.preventDefault();
  });

  async function loadPublic({ force = false } = {}) {
    try {
      const response = await fetch(PUBLIC_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      const item = normalize(data);
      if (item.active && item.mediaUrl) show(item, { ignoreDismissal: force });
      return item;
    } catch (_error) {
      return null;
    }
  }

  function setStatus(message, kind = '') {
    if (!statusNode) return;
    statusNode.textContent = message || '';
    statusNode.className = `rp-takeover-status${kind ? ` ${kind}` : ''}`;
  }

  function revokeLocalPreview() {
    if (!localPreviewUrl) return;
    try { URL.revokeObjectURL(localPreviewUrl); } catch (_error) {}
    localPreviewUrl = '';
  }

  function draftFromForm() {
    const file = fileInput?.files?.[0] || null;
    let url = clean(urlInput?.value, 1600);
    if (file) {
      revokeLocalPreview();
      localPreviewUrl = URL.createObjectURL(file);
      url = localPreviewUrl;
    }
    return {
      campaignId: clean(idInput?.value, 160) || `announcement-${Date.now()}`,
      active: Boolean(activeInput?.checked),
      mediaType: file?.type?.startsWith('video/') ? 'video' : clean(typeInput?.value, 20) === 'video' ? 'video' : 'image',
      mediaUrl: url,
      fit: clean(fitInput?.value, 20) === 'cover' ? 'cover' : 'contain',
      label: clean(labelInput?.value, 60),
      alt: clean(altInput?.value, 180) || 'Real Play announcement',
      loop: Boolean(loopInput?.checked),
      ctaText: clean(ctaInput?.value, 80) || 'I Understand',
    };
  }

  function renderInlinePreview() {
    if (!previewBox) return;
    const draft = draftFromForm();
    previewBox.innerHTML = '';
    if (!draft.mediaUrl) {
      previewBox.innerHTML = '<div class="rp-takeover-preview-empty">SELECT A PHOTO OR VIDEO TO PREVIEW</div>';
      return;
    }
    const node = document.createElement(draft.mediaType === 'video' ? 'video' : 'img');
    node.src = draft.mediaUrl;
    if (draft.mediaType === 'video') {
      node.muted = true;
      node.playsInline = true;
      node.loop = draft.loop;
      node.autoplay = true;
      node.addEventListener('canplay', () => node.play().catch(() => {}), { once: true });
    } else {
      node.alt = draft.alt;
    }
    node.style.objectFit = draft.fit;
    previewBox.appendChild(node);
  }

  function fillForm(itemInput) {
    const item = normalize(itemInput);
    if (idInput) idInput.value = item.campaignId || '';
    if (typeInput) typeInput.value = item.mediaType || 'image';
    if (fitInput) fitInput.value = item.fit || 'contain';
    if (urlInput) urlInput.value = item.mediaUrl || '';
    if (labelInput) labelInput.value = item.label || '';
    if (altInput) altInput.value = item.alt === 'Real Play announcement' ? '' : item.alt || '';
    if (ctaInput) ctaInput.value = item.ctaText || 'I Understand';
    if (activeInput) activeInput.checked = item.active !== false;
    if (loopInput) loopInput.checked = item.loop !== false;
    if (fileInput) fileInput.value = '';
    renderInlinePreview();
  }

  async function loadAdminCurrent() {
    setStatus('Loading current takeover…');
    try {
      const response = await fetch(PUBLIC_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) {
        if (idInput && !idInput.value) idInput.value = `announcement-${new Date().toISOString().slice(0,10)}`;
        if (ctaInput && !ctaInput.value) ctaInput.value = 'I Understand';
        setStatus('Unable to load the current takeover. You can still prepare and preview the creative here.');
        renderInlinePreview();
        return;
      }
      const data = await response.json().catch(() => ({}));
      fillForm(data);
      setStatus('Current takeover loaded.', 'ok');
    } catch (_error) {
      if (ctaInput && !ctaInput.value) ctaInput.value = 'I Understand';
      setStatus('Unable to load the current takeover right now. The editor and preview are still available.');
    }
  }

  function openAdmin() {
    admin.classList.add('open');
    admin.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-takeover-open');
    loadAdminCurrent();
    admin.querySelector('[data-rp-takeover-admin-back]')?.focus({ preventScroll: true });
  }

  function closeAdmin() {
    admin.classList.remove('open');
    admin.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-takeover-open');
    revokeLocalPreview();
    const settings = document.querySelector('.rp-settings-overlay');
    if (settings?.classList.contains('open')) {
      settings.querySelector('[data-rp-settings-action="takeover"]')?.focus({ preventScroll: true });
    }
  }

  admin.querySelector('[data-rp-takeover-admin-back]')?.addEventListener('click', closeAdmin);
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file && typeInput) typeInput.value = file.type.startsWith('video/') ? 'video' : 'image';
    renderInlinePreview();
  });
  urlInput?.addEventListener('input', renderInlinePreview);
  typeInput?.addEventListener('change', renderInlinePreview);
  fitInput?.addEventListener('change', renderInlinePreview);
  loopInput?.addEventListener('change', renderInlinePreview);

  admin.querySelector('[data-rp-takeover-preview]')?.addEventListener('click', () => {
    const draft = draftFromForm();
    if (!draft.mediaUrl) {
      setStatus('Choose a photo/video or paste a media URL first.', 'error');
      return;
    }
    show({ ...draft, active: true }, { preview: true, ignoreDismissal: true });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      setStatus('Admin sign-in is required before publishing.', 'error');
      return;
    }
    const draft = draftFromForm();
    const file = fileInput?.files?.[0] || null;
    if (!file && !clean(urlInput?.value, 1600)) {
      setStatus('Choose a photo/video or provide a media URL.', 'error');
      return;
    }

    const body = new FormData();
    body.set('campaignId', draft.campaignId);
    body.set('active', draft.active ? 'true' : 'false');
    body.set('mediaType', draft.mediaType);
    body.set('fit', draft.fit);
    body.set('label', draft.label);
    body.set('alt', draft.alt);
    body.set('loop', draft.loop ? 'true' : 'false');
    body.set('ctaText', draft.ctaText);
    if (file) body.set('media', file, file.name);
    else body.set('mediaUrl', clean(urlInput.value, 1600));

    setStatus('Publishing…');
    try {
      const response = await fetch(ADMIN_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          setStatus('Takeover publishing endpoint is unavailable right now.', 'error');
          return;
        }
        throw new Error(data?.message || `Publish failed (${response.status}).`);
      }
      fillForm(data?.takeover ?? data);
      setStatus('Takeover published. A new campaign/version will show again to everyone.', 'ok');
    } catch (error) {
      setStatus(error?.message || 'Unable to publish takeover right now.', 'error');
    }
  });

  admin.querySelector('[data-rp-takeover-deactivate]')?.addEventListener('click', async () => {
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      setStatus('Admin sign-in is required before deactivating.', 'error');
      return;
    }
    const body = new FormData();
    body.set('campaignId', clean(idInput?.value, 160));
    body.set('active', 'false');
    setStatus('Deactivating…');
    try {
      const response = await fetch(ADMIN_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body,
      });
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          setStatus('Takeover deactivation endpoint is unavailable right now.', 'error');
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || `Deactivate failed (${response.status}).`);
      }
      if (activeInput) activeInput.checked = false;
      setStatus('Takeover deactivated.', 'ok');
    } catch (error) {
      setStatus(error?.message || 'Unable to deactivate takeover right now.', 'error');
    }
  });

  function installAdminRow() {
    const list = document.querySelector('.rp-settings-overlay .rp-settings-list');
    if (!list) return false;
    const verified = window.__realPlayAdminVerified === true || window.RealPlayServerGate?.isAdminBypass?.() === true;
    if (!verified) return false;
    let row = list.querySelector('[data-rp-settings-action="takeover"]');
    if (!row) {
      row = document.createElement('button');
      row.type = 'button';
      row.className = 'rp-settings-row rp-settings-takeover-row';
      row.dataset.rpSettingsAction = 'takeover';
      row.innerHTML = '<span><strong>FULL-SCREEN ANNOUNCEMENT</strong><small>Photo/video takeover shown when the app opens</small></span><b>→</b>';
      row.addEventListener('click', openAdmin);
      const adminRow = list.querySelector('[data-rp-settings-action="admin"]');
      if (adminRow?.nextSibling) list.insertBefore(row, adminRow.nextSibling);
      else list.appendChild(row);
    }
    return true;
  }

  function watchAdminRow() {
    if (installAdminRow()) return;
    if (adminRowWatch) adminRowWatch.disconnect();
    const list = document.querySelector('.rp-settings-overlay .rp-settings-list');
    if (!list) return;
    adminRowWatch = new MutationObserver(() => {
      if (installAdminRow()) {
        adminRowWatch?.disconnect();
        adminRowWatch = null;
      }
    });
    adminRowWatch.observe(list, { childList: true, subtree: false });
    [250, 700, 1400, 2400].forEach((delay) => window.setTimeout(installAdminRow, delay));
    window.setTimeout(() => {
      adminRowWatch?.disconnect();
      adminRowWatch = null;
    }, 3200);
  }

  window.addEventListener('realplay:settings-open', watchAdminRow);
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) watchAdminRow();
  });

  window.RealPlayTakeover = Object.freeze({
    show,
    close,
    preview: (item) => show(item, { preview: true, ignoreDismissal: true }),
    load: loadPublic,
    openAdmin,
    normalize,
    isDismissed,
  });

  const start = () => window.setTimeout(() => loadPublic(), 160);
  if (document.documentElement.classList.contains('rp-shell-ready')) start();
  else window.addEventListener('realplay:app-ready', start, { once: true });
})();