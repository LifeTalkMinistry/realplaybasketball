(() => {
  if (window.__realPlayProfileLinkedShareInstalledV113) return;
  window.__realPlayProfileLinkedShareInstalledV113 = true;

  const PUBLIC_APP_URL = 'https://joinrealplay.com/';
  const PROFILE_SHARE_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share\/[a-f0-9]{40}(?:[?#].*)?$/i;
  const DIRECT_PROFILE_URL = /^https:\/\/joinrealplay\.com\/(?:\?player=\d+)?(?:#.*)?$/i;
  const SNAPSHOT_UPLOAD_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share-snapshots(?:\?|$)/i;
  const QR_SCRIPT_URL = 'profile-share-qr.js?v=20260920-profile-share-story-qr-v1';
  const PLAYER_MEMORY_MS = 15000;

  let latestSharePlayerId = null;
  let latestSharePlayerAt = 0;
  let qrPromise = null;
  let activeChooser = null;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  function directProfileUrl(playerId) {
    const id = positiveId(playerId);
    if (!id) return PUBLIC_APP_URL;
    const url = new URL(PUBLIC_APP_URL);
    url.searchParams.set('player', String(id));
    return url.toString();
  }

  function rememberSnapshotPlayer(input) {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input?.url || '';
    if (!SNAPSHOT_UPLOAD_URL.test(String(raw))) return;
    try {
      const id = positiveId(new URL(raw, window.location.href).searchParams.get('player'));
      if (!id) return;
      latestSharePlayerId = id;
      latestSharePlayerAt = Date.now();
    } catch (_error) {}
  }

  if (typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function realPlayShareDomainFetch(input, init) {
      rememberSnapshotPlayer(input);
      return nativeFetch(input, init);
    };
  }

  const nativeShare = typeof navigator.share === 'function' ? navigator.share.bind(navigator) : null;
  const nativeCanShare = typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : null;

  function isProfileImage(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type === 'image/png' && (name.startsWith('real-play-') || name === 'real-play-profile.png');
  }

  function currentPublicPlayerId() {
    const panel = document.querySelector('.rp-profile.open');
    if (!panel) return null;
    const source = panel.__realPlayPublicPlayer || panel.__realPlayProfileState || {};
    const profile = source?.profile || source?.player || source || {};
    return positiveId(
      panel.dataset?.rpPublicPlayerId ??
      source?.playerId ?? source?.player_id ?? source?.publicPlayerId ?? source?.public_player_id ??
      profile?.playerId ?? profile?.player_id
    );
  }

  function rememberedPlayerId() {
    if (latestSharePlayerId && Date.now() - latestSharePlayerAt <= PLAYER_MEMORY_MS) {
      return latestSharePlayerId;
    }
    return currentPublicPlayerId();
  }

  function profileFiles(payload) {
    return Array.isArray(payload?.files) ? payload.files.filter(isProfileImage) : [];
  }

  function shouldRewrite(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!profileFiles(payload).length) return false;
    const url = String(payload.url || '').trim();
    return PROFILE_SHARE_URL.test(url) || DIRECT_PROFILE_URL.test(url);
  }

  function directUrlFor(payload) {
    const suppliedUrl = String(payload?.url || '').trim();
    if (DIRECT_PROFILE_URL.test(suppliedUrl)) return suppliedUrl;
    return directProfileUrl(rememberedPlayerId());
  }

  function directPlayerId(url) {
    try {
      return positiveId(new URL(url, PUBLIC_APP_URL).searchParams.get('player'));
    } catch (_error) {
      return null;
    }
  }

  function copyProfileLink(url) {
    if (!url) return;
    window.__realPlayLastSharedProfileUrl = url;
    try {
      const result = navigator.clipboard?.writeText?.(url);
      result?.catch?.(() => {});
    } catch (_error) {}
  }

  function downloadFile(file) {
    if (!file) return;
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = file.name || 'real-play-profile.png';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }

  function installChooserStyles() {
    if (document.getElementById('rp-profile-share-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'rp-profile-share-mode-styles';
    style.textContent = `
      .rp-profile-share-mode-layer{
        position:fixed;inset:0;z-index:2147483200;display:grid;place-items:end center;
        padding:18px max(14px,env(safe-area-inset-right)) max(18px,calc(14px + env(safe-area-inset-bottom))) max(14px,env(safe-area-inset-left));
        background:rgba(0,3,8,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)
      }
      .rp-profile-share-mode-card{
        width:min(360px,100%);padding:14px;border:1px solid rgba(80,220,255,.28);border-radius:18px;
        background:linear-gradient(180deg,rgba(8,19,27,.98),rgba(2,7,12,.99));box-shadow:0 24px 70px rgba(0,0,0,.55),0 0 32px rgba(38,207,255,.08);
        color:#f4fbff;font-family:Arial,sans-serif
      }
      .rp-profile-share-mode-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 11px}
      .rp-profile-share-mode-head div{display:grid;gap:2px}
      .rp-profile-share-mode-head small{font-size:9px;font-weight:900;letter-spacing:.16em;color:#48d9ff}
      .rp-profile-share-mode-head strong{font-size:15px;font-weight:950;letter-spacing:.03em}
      .rp-profile-share-mode-status{font-size:9px;font-weight:850;letter-spacing:.08em;color:rgba(225,241,248,.54);text-align:right}
      .rp-profile-share-mode-actions{display:grid;gap:8px}
      .rp-profile-share-mode-actions button{
        min-height:48px;border:1px solid rgba(93,221,255,.25);border-radius:13px;background:rgba(9,27,37,.92);
        color:#f7fcff;font:900 12px/1 Arial,sans-serif;letter-spacing:.075em;text-align:left;padding:0 15px;cursor:pointer
      }
      .rp-profile-share-mode-actions button:not(:disabled):active{transform:scale(.992);background:rgba(16,47,62,.96)}
      .rp-profile-share-mode-actions button[data-rp-share-mode="story"]{border-color:rgba(63,222,255,.48);box-shadow:inset 3px 0 0 #42dcff}
      .rp-profile-share-mode-actions button[data-rp-share-mode="cancel"]{min-height:42px;text-align:center;border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:rgba(235,245,249,.66)}
      .rp-profile-share-mode-actions button:disabled{cursor:default;opacity:.43}
    `;
    document.head.appendChild(style);
  }

  function ensureQr() {
    if (window.RealPlayProfileQr?.draw) return Promise.resolve(window.RealPlayProfileQr);
    if (qrPromise) return qrPromise;
    qrPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rp-profile-share-qr]');
      const finish = () => {
        if (window.RealPlayProfileQr?.draw) resolve(window.RealPlayProfileQr);
        else reject(new Error('Local QR encoder did not initialize.'));
      };
      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', () => reject(new Error('Local QR encoder failed to load.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.rpProfileShareQr = 'true';
      script.src = QR_SCRIPT_URL;
      script.async = true;
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error('Local QR encoder failed to load.')), { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      qrPromise = null;
      throw error;
    });
    return qrPromise;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const href = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(href);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(href);
        reject(new Error('Captured profile PNG could not be decoded.'));
      };
      image.src = href;
    });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Story PNG could not be generated.')), 'image/png', 1);
    });
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  async function createStoryFile(baseFile, directUrl) {
    if (!isProfileImage(baseFile)) throw new Error('Captured profile PNG is unavailable.');
    if (!directPlayerId(directUrl)) throw new Error('Public player link is unavailable.');

    const [qr, image] = await Promise.all([ensureQr(), loadImage(baseFile)]);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('Captured profile PNG has no dimensions.');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, 0, 0, width, height);

    const shortSide = Math.min(width, height);
    const desiredQrSize = Math.max(123, Math.min(300, Math.round(shortSide * 0.19)));
    const qrCanvas = document.createElement('canvas');
    qr.draw(qrCanvas, directUrl, { size: desiredQrSize, quietZoneModules: 4 });

    const pad = Math.max(7, Math.round(qrCanvas.width * 0.055));
    const margin = Math.max(12, Math.round(shortSide * 0.022));
    const boxSize = qrCanvas.width + pad * 2;
    const x = Math.max(margin, width - boxSize - margin);
    const y = Math.max(margin, height - boxSize - margin);

    ctx.save();
    roundedRect(ctx, x, y, boxSize, boxSize, Math.max(12, Math.round(boxSize * 0.085)));
    ctx.fillStyle = 'rgba(2, 10, 16, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(65, 220, 255, 0.55)';
    ctx.lineWidth = Math.max(2, Math.round(shortSide * 0.0025));
    ctx.stroke();
    ctx.drawImage(qrCanvas, x + pad, y + pad);
    ctx.restore();

    const blob = await canvasBlob(canvas);
    const baseName = String(baseFile.name || 'real-play-profile.png').replace(/\.png$/i, '');
    if (typeof File === 'function') return new File([blob], `${baseName}-story.png`, { type: 'image/png' });
    blob.name = `${baseName}-story.png`;
    return blob;
  }

  function nativeFileShareAvailable(file) {
    if (!nativeShare || !file) return false;
    if (!nativeCanShare) return true;
    try {
      return Boolean(nativeCanShare({ files: [file] }));
    } catch (_error) {
      return false;
    }
  }

  async function sharePost(payload, directUrl) {
    const files = profileFiles(payload);
    const file = files[0] || null;
    copyProfileLink(directUrl);

    if (nativeFileShareAvailable(file)) {
      return nativeShare({ files: [file] });
    }

    if (nativeShare) {
      return nativeShare({
        title: payload?.title || 'Real Play Basketball',
        text: payload?.text || 'View this Real Play player profile.',
        url: directUrl,
      });
    }

    if (file) downloadFile(file);
    return undefined;
  }

  async function shareStory(storyFile, directUrl) {
    if (nativeFileShareAvailable(storyFile)) {
      try {
        return await nativeShare({ files: [storyFile] });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
    }
    downloadFile(storyFile);
    copyProfileLink(directUrl);
    return undefined;
  }

  function cancelError() {
    try {
      return new DOMException('Profile share cancelled.', 'AbortError');
    } catch (_error) {
      const error = new Error('Profile share cancelled.');
      error.name = 'AbortError';
      return error;
    }
  }

  function showShareChooser(payload) {
    installChooserStyles();
    activeChooser?.cancel?.();

    const directUrl = directUrlFor(payload);
    const baseFile = profileFiles(payload)[0] || null;
    const playerId = directPlayerId(directUrl);

    const layer = document.createElement('div');
    layer.className = 'rp-profile-share-mode-layer';
    layer.innerHTML = `
      <section class="rp-profile-share-mode-card" role="dialog" aria-modal="true" aria-label="Choose profile share type">
        <header class="rp-profile-share-mode-head">
          <div><small>REAL PLAY PROFILE</small><strong>CHOOSE SHARE TYPE</strong></div>
          <span class="rp-profile-share-mode-status" data-rp-share-status>${playerId ? 'STORY QR PREPARING' : 'PLAYER LINK UNAVAILABLE'}</span>
        </header>
        <div class="rp-profile-share-mode-actions">
          <button type="button" data-rp-share-mode="post">SHARE POST / MESSAGE</button>
          <button type="button" data-rp-share-mode="story" disabled>SHARE STORY / MY DAY</button>
          <button type="button" data-rp-share-mode="cancel">CANCEL</button>
        </div>
      </section>`;
    document.body.appendChild(layer);

    const postButton = layer.querySelector('[data-rp-share-mode="post"]');
    const storyButton = layer.querySelector('[data-rp-share-mode="story"]');
    const cancelButton = layer.querySelector('[data-rp-share-mode="cancel"]');
    const status = layer.querySelector('[data-rp-share-status]');

    let settled = false;
    let storyFile = null;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (activeChooser?.layer === layer) activeChooser = null;
        document.removeEventListener('keydown', onKeydown, true);
        layer.remove();
      };
      const finish = (action) => {
        if (settled) return;
        settled = true;
        cleanup();
        Promise.resolve()
          .then(action)
          .then(resolve)
          .catch(reject);
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(cancelError());
      };
      const onKeydown = (event) => {
        if (event.key === 'Escape') cancel();
      };

      activeChooser = { layer, cancel };
      document.addEventListener('keydown', onKeydown, true);
      layer.addEventListener('click', (event) => {
        if (event.target === layer) cancel();
      });
      cancelButton?.addEventListener('click', cancel);
      postButton?.addEventListener('click', () => finish(() => sharePost(payload, directUrl)));
      storyButton?.addEventListener('click', () => {
        if (!storyFile) return;
        finish(() => shareStory(storyFile, directUrl));
      });

      if (baseFile && playerId) {
        createStoryFile(baseFile, directUrl)
          .then((file) => {
            if (settled) return;
            storyFile = file;
            storyButton.disabled = false;
            status.textContent = 'STORY QR READY';
          })
          .catch(() => {
            if (settled) return;
            status.textContent = 'STORY QR UNAVAILABLE';
          });
      }

      setTimeout(() => postButton?.focus({ preventScroll: true }), 0);
    });
  }

  function share(payload) {
    if (!shouldRewrite(payload)) {
      if (nativeShare) return nativeShare(payload);
      return Promise.reject(new Error('Native sharing is unavailable.'));
    }
    return showShareChooser(payload);
  }

  function canShare(payload) {
    if (profileFiles(payload).length) return true;
    if (!nativeCanShare) return false;
    try { return Boolean(nativeCanShare(payload)); } catch (_error) { return false; }
  }

  function installNavigatorMethod(name, value) {
    let installed = false;
    try {
      Object.defineProperty(navigator, name, {
        configurable: true,
        writable: true,
        value,
      });
      installed = navigator[name] === value;
    } catch (_error) {}

    if (!installed && typeof Navigator !== 'undefined') {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, name);
        if (!descriptor || descriptor.configurable) {
          Object.defineProperty(Navigator.prototype, name, {
            configurable: true,
            writable: true,
            value,
          });
          installed = navigator[name] === value;
        }
      } catch (_error) {}
    }
    return installed;
  }

  installNavigatorMethod('canShare', canShare);
  installNavigatorMethod('share', share);
  ensureQr().catch(() => {});
})();
