(() => {
  if (window.__realPlayProfileShareInstalled) return;
  window.__realPlayProfileShareInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_APP_URL = 'https://joinrealplay.com/';
  const TOKEN_KEY = 'real_play_access_token';
  const LONG_PRESS_MS = 620;
  const MOVE_CANCEL_PX = 14;
  const MIN_CAPTURE_SCALE = 2;
  const MAX_CAPTURE_SCALE = 4;
  const HTML2CANVAS_SOURCES = [
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
  ];
  const IGNORE_CAPTURE_SELECTOR = [
    '[data-rp-profile-art-edit]',
    '.rp-profile-art-edit-button',
    '[data-rp-profile-share-ignore]',
  ].join(',');

  const prepared = new WeakMap();
  const preparing = new WeakMap();
  const captureCache = new WeakMap();
  let html2canvasPromise = null;
  let press = null;
  let deepLinkHandled = false;
  let captureSerial = 0;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const clean = (value) => String(value ?? '').trim();
  const upper = (value) => clean(value).toUpperCase();
  const normalizeName = (value) => upper(value).replace(/\s+/g, ' ');
  const textOf = (root, selector) => clean(root?.querySelector(selector)?.textContent);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function installStyles() {
    if (document.querySelector('[data-rp-profile-share-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileShareStyles = '1';
    style.textContent = `
      .rp-profile.open .rp-profile-hero{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
      .rp-profile.has-rp-premium-profile-art .rp-profile-name>h1{max-width:min(69vw,350px)!important}
      .rp-profile.rp-profile-share-armed .rp-profile-hero{box-shadow:0 0 0 2px rgba(68,218,255,.72),0 18px 48px rgba(0,0,0,.48)!important}
      .rp-profile.rp-profile-share-armed .rp-profile-hero::after{content:'RELEASE TO SHARE PROFILE';position:absolute;z-index:30;left:50%;bottom:12px;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(78,220,255,.35);border-radius:999px;color:#76e7ff;background:rgba(1,7,13,.88);font:900 .46rem/1 Arial,sans-serif;letter-spacing:.12em;white-space:nowrap;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.38)}
      .rp-profile-share-toast{position:fixed;z-index:2147483000;left:50%;bottom:calc(86px + env(safe-area-inset-bottom));transform:translate(-50%,12px);max-width:min(88vw,420px);padding:11px 14px;border:1px solid rgba(71,216,255,.28);border-radius:13px;color:#dff7ff;background:rgba(2,8,14,.94);font:900 .58rem/1.25 Arial,sans-serif;letter-spacing:.055em;text-align:center;opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease;box-shadow:0 18px 46px rgba(0,0,0,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      .rp-profile-share-toast.open{opacity:1;transform:translate(-50%,0)}
    `;
    document.head.appendChild(style);
  }

  function toast(message, duration = 1800) {
    let node = document.querySelector('[data-rp-profile-share-toast]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'rp-profile-share-toast';
      node.dataset.rpProfileShareToast = '1';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = String(message || '');
    node.classList.add('open');
    clearTimeout(node.__rpShareTimer);
    node.__rpShareTimer = setTimeout(() => node.classList.remove('open'), duration);
  }

  function recordStats(recordText) {
    const match = String(recordText || '').match(/(\d+)\s*-\s*(\d+)/);
    const wins = match ? Number(match[1]) : 0;
    const losses = match ? Number(match[2]) : 0;
    const games = wins + losses;
    return { wins, losses, games, winRate: games > 0 ? `${Math.round((wins / games) * 100)}%` : '—' };
  }

  function panelData(panel) {
    const hero = panel?.querySelector('.rp-profile-hero');
    const record = textOf(hero, '.rp-profile-record strong') || '0-0';
    const recordMeta = recordStats(record);
    const source = panel?.__realPlayPublicPlayer || panel?.__realPlayProfileState || {};
    const profile = source?.profile || source?.player || source || {};
    const isVisitorPublic = Boolean(panel?.matches('[data-rp-visitor-public-profile]'));
    const isPublic = Boolean(panel?.matches('.rp-public-player-profile,[data-rp-public-profile],[data-rp-visitor-public-profile]'));
    const canonicalSourceId = positiveId(
      source?.playerId ?? source?.player_id ?? source?.publicPlayerId ?? source?.public_player_id ?? profile?.playerId ?? profile?.player_id
    );
    const directPublicId = isPublic
      ? (canonicalSourceId || (isVisitorPublic ? positiveId(panel?.dataset?.rpPublicPlayerId) : null))
      : null;
    const accountUserId = positiveId(
      source?.accountUserId ?? source?.account_user_id ?? source?.userId ?? source?.user_id ??
      source?.profile?.user_id ?? source?.profile?.userId ?? source?.profile?.id ??
      profile?.accountUserId ?? profile?.account_user_id ?? (!isPublic ? panel?.dataset?.rpProfilePlayerId : null)
    );
    const jerseyText = textOf(hero, '.rp-profile-number strong') || '#—';
    const jerseyMatch = jerseyText.match(/\d+/);
    const jerseyNumber = jerseyMatch ? Number(jerseyMatch[0]) : null;
    const passLabel = textOf(hero, '.rp-profile-identity-line b') || 'PLAYER PROFILE';
    const gamesText = textOf(hero, '.rp-profile-record small') || `${recordMeta.games} GAMES`;
    return {
      panel,
      hero,
      source,
      isPublic,
      directPublicId,
      accountUserId,
      playerName: textOf(hero, '.rp-profile-name h1') || 'REAL PLAY PLAYER',
      jerseyText,
      jerseyNumber,
      ovr: textOf(hero, '.rp-profile-ovr strong') || '—',
      rank: textOf(hero, '.rp-profile-rank strong') || '—',
      record,
      gamesText,
      winRate: recordMeta.winRate,
      passLabel,
    };
  }

  async function communityPlayers() {
    const accessToken = token();
    const url = accessToken
      ? `${API_BASE_URL}/api/real-play/community`
      : `${API_BASE_URL}/api/real-play/public/community`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ action: 'players' }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not resolve the public player profile.');
    return Array.isArray(data?.players) ? data.players : [];
  }

  async function resolvePublicPlayerId(data) {
    if (data.directPublicId) return data.directPublicId;
    try {
      const players = await communityPlayers();
      let match = null;
      if (data.accountUserId) {
        match = players.find((player) => positiveId(player?.accountUserId ?? player?.account_user_id) === data.accountUserId) || null;
      }
      if (!match) {
        const wantedName = normalizeName(data.playerName);
        match = players.find((player) => {
          const sameName = normalizeName(player?.playerName ?? player?.player_name) === wantedName;
          const rawNumber = player?.playerNumber ?? player?.player_number;
          const sameNumber = data.jerseyNumber === null || rawNumber === null || rawNumber === undefined
            ? true
            : Number(rawNumber) === data.jerseyNumber;
          return sameName && sameNumber;
        }) || null;
      }
      return positiveId(match?.playerId ?? match?.player_id ?? match?.userId ?? match?.user_id);
    } catch (_error) {
      return null;
    }
  }

  function shareUrl(publicPlayerId) {
    const url = new URL(PUBLIC_APP_URL);
    url.hash = '';
    url.search = '';
    if (publicPlayerId) url.searchParams.set('player', String(publicPlayerId));
    return url.toString();
  }

  function socialShareUrl(shareId) {
    return `${API_BASE_URL}/api/real-play/profile-share/${encodeURIComponent(shareId)}`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src === src);
      if (existing) {
        if (typeof window.html2canvas === 'function') return resolve(window.html2canvas);
        existing.addEventListener('load', () => resolve(window.html2canvas), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.rpHtml2canvasLoader = '1';
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.addEventListener('load', () => {
        if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
        else reject(new Error('DOM capture library did not initialize.'));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('DOM capture library could not load.')), { once: true });
      document.head.appendChild(script);
    });
  }

  function ensureHtml2Canvas() {
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = (async () => {
      let lastError = null;
      for (const src of HTML2CANVAS_SOURCES) {
        try {
          const capture = await loadScript(src);
          if (typeof capture === 'function') return capture;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('DOM capture library is unavailable.');
    })().catch((error) => {
      html2canvasPromise = null;
      throw error;
    });
    return html2canvasPromise;
  }

  async function waitForFonts() {
    const ready = document.fonts?.ready;
    if (!ready || typeof ready.then !== 'function') return;
    await Promise.race([ready.catch(() => {}), delay(3000)]);
  }

  async function waitForImage(image, timeoutMs = 4500) {
    if (!(image instanceof HTMLImageElement)) return;
    const loaded = () => image.complete && image.naturalWidth > 0;
    if (!loaded()) {
      await Promise.race([
        new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }),
        delay(timeoutMs),
      ]);
    }
    if (loaded() && typeof image.decode === 'function') {
      await Promise.race([image.decode().catch(() => {}), delay(1600)]);
    }
  }

  function isSameOriginImage(src) {
    if (!src || /^(?:data|blob):/i.test(src)) return true;
    try { return new URL(src, window.location.href).origin === window.location.origin; } catch (_error) { return true; }
  }

  async function prepareCrossOriginImages(hero) {
    const replacements = new Map();
    const cleanup = [];
    const images = Array.from(hero.querySelectorAll('img'));
    await Promise.all(images.map(async (image) => {
      await waitForImage(image);
      const src = image.currentSrc || image.src || '';
      if (!src || isSameOriginImage(src)) return;
      try {
        const response = await fetch(src, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: { Accept: 'image/png,image/webp,image/*,*/*' },
        });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob.size) return;
        const objectUrl = URL.createObjectURL(blob);
        const key = `rp-share-image-${Date.now()}-${++captureSerial}`;
        image.dataset.rpShareCaptureImage = key;
        replacements.set(key, objectUrl);
        cleanup.push(() => {
          delete image.dataset.rpShareCaptureImage;
          URL.revokeObjectURL(objectUrl);
        });
      } catch (_error) {}
    }));
    return {
      replacements,
      cleanup: () => cleanup.forEach((fn) => { try { fn(); } catch (_error) {} }),
    };
  }

  async function waitForHeroReady(hero) {
    await Promise.all([ensureHtml2Canvas(), waitForFonts()]);
    const artImage = hero.querySelector('.rp-premium-profile-art img');
    if (artImage && !isSameOriginImage(artImage.currentSrc || artImage.src || '')) {
      const deadline = Date.now() + 2200;
      while (Date.now() < deadline) {
        if (isSameOriginImage(artImage.currentSrc || artImage.src || '')) break;
        if (artImage.dataset.rpShareCanvasReady === 'ready') break;
        await delay(60);
      }
    }
    await Promise.all(Array.from(hero.querySelectorAll('img')).map((image) => waitForImage(image)));
    await nextFrame();
  }

  function captureScale(hero) {
    let scale = Math.min(MAX_CAPTURE_SCALE, Math.max(MIN_CAPTURE_SCALE, Number(window.devicePixelRatio) || 1));
    const rect = hero.getBoundingClientRect();
    const maxPixels = 24000000;
    if (rect.width > 0 && rect.height > 0 && rect.width * rect.height * scale * scale > maxPixels) {
      scale = Math.max(MIN_CAPTURE_SCALE, Math.min(scale, Math.sqrt(maxPixels / (rect.width * rect.height))));
    }
    return scale;
  }

  function captureSignature(data) {
    const hero = data.hero;
    const rect = hero?.getBoundingClientRect();
    const art = hero?.querySelector('.rp-premium-profile-art');
    const artStyle = art ? getComputedStyle(art) : null;
    return [
      data.playerName,
      data.jerseyText,
      data.ovr,
      data.rank,
      data.record,
      data.winRate,
      clean(hero?.innerText).replace(/\s+/g, ' '),
      hero?.getAttribute('style') || '',
      rect ? `${Math.round(rect.width * 10) / 10}x${Math.round(rect.height * 10) / 10}` : '',
      artStyle?.getPropertyValue('--rp-art-x') || '',
      artStyle?.getPropertyValue('--rp-art-y') || '',
      artStyle?.getPropertyValue('--rp-art-scale') || '',
      artStyle?.getPropertyValue('--rp-art-opacity') || '',
      Array.from(hero?.querySelectorAll('img') || []).map((image) => image.currentSrc || image.src || '').join('~'),
    ].join('|');
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create profile PNG.')), 'image/png', 1);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function captureHeroDom(panel) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) throw new Error('Player profile is not open.');
    const data = panelData(panel);
    const hero = data.hero;
    if (!hero) throw new Error('Profile hero is unavailable.');
    await waitForHeroReady(hero);
    const localized = await prepareCrossOriginImages(hero);
    const captureId = `rp-profile-capture-${Date.now()}-${++captureSerial}`;
    hero.dataset.rpProfileShareCaptureTarget = captureId;
    try {
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(hero, {
        scale: captureScale(hero),
        backgroundColor: null,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 12000,
        removeContainer: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        ignoreElements: (element) => Boolean(element?.matches?.(IGNORE_CAPTURE_SELECTOR)),
        onclone: (clonedDocument) => {
          const cloneHero = clonedDocument.querySelector(`[data-rp-profile-share-capture-target="${captureId}"]`);
          const clonePanel = cloneHero?.closest('.rp-profile');
          // The hold prompt is interaction feedback only. It must never become
          // part of the shared profile image, even if capture finishes while held.
          clonePanel?.classList.remove('rp-profile-share-armed');
          cloneHero?.querySelectorAll(IGNORE_CAPTURE_SELECTOR).forEach((node) => node.remove());
          localized.replacements.forEach((objectUrl, key) => {
            const cloneImage = cloneHero?.querySelector(`img[data-rp-share-capture-image="${key}"]`);
            if (cloneImage) cloneImage.src = objectUrl;
          });
        },
      });
      const blob = await canvasToBlob(canvas);
      return { blob, width: canvas.width, height: canvas.height };
    } finally {
      delete hero.dataset.rpProfileShareCaptureTarget;
      localized.cleanup();
    }
  }

  function metadataSignature(data) {
    return [data.playerName, data.jerseyText, data.ovr, data.rank, data.record, data.winRate, data.directPublicId, data.accountUserId].join('|');
  }

  async function preparePanel(panel, force = false) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return null;
    const data = panelData(panel);
    if (!data.hero) return null;
    const sig = metadataSignature(data);
    const current = prepared.get(panel);
    if (!force && current?.signature === sig) return current;
    const active = preparing.get(panel);
    if (!force && active?.signature === sig) return active.promise;
    const promise = (async () => {
      ensureHtml2Canvas().catch(() => {});
      waitForFonts().catch(() => {});
      const publicPlayerId = await resolvePublicPlayerId(data);
      const url = shareUrl(publicPlayerId);
      const safeName = normalizeName(data.playerName).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'player';
      const title = `${data.jerseyText} ${data.playerName} | Real Play Basketball`;
      const text = `${data.jerseyText} ${data.playerName}\nOVR ${data.ovr} · RANK ${data.rank} · ${data.record} · ${data.winRate} WIN RATE\nLess Screen. Real Points.`;
      const result = {
        signature: sig,
        data,
        publicPlayerId,
        url,
        filename: `real-play-${safeName}-profile.png`,
        title,
        text,
      };
      prepared.set(panel, result);
      preparing.delete(panel);
      return result;
    })().catch((error) => {
      preparing.delete(panel);
      throw error;
    });
    preparing.set(panel, { signature: sig, promise });
    return promise;
  }

  async function primeCapture(panel) {
    const data = panelData(panel);
    if (!data.hero) return null;
    const initialSig = captureSignature(data);
    const current = captureCache.get(panel);
    if (current?.signature === initialSig && current?.blob) return current;
    if (current?.signature === initialSig && current?.promise) return current.promise;
    const promise = captureHeroDom(panel)
      .then((capture) => {
        const finalSig = captureSignature(panelData(panel));
        const result = { signature: finalSig, ...capture };
        captureCache.set(panel, result);
        return result;
      })
      .catch((error) => {
        captureCache.delete(panel);
        throw error;
      });
    captureCache.set(panel, { signature: initialSig, promise });
    return promise;
  }

  async function deriveShareId(publicPlayerId, blob) {
    if (!publicPlayerId || !blob || !window.crypto?.subtle || typeof TextEncoder !== 'function') return null;
    try {
      const prefix = new TextEncoder().encode(`${publicPlayerId}\0`);
      const image = new Uint8Array(await blob.arrayBuffer());
      const bytes = new Uint8Array(prefix.length + image.length);
      bytes.set(prefix, 0);
      bytes.set(image, prefix.length);
      const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes));
      return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40);
    } catch (_error) {
      return null;
    }
  }

  async function createSharePackage(item, capture) {
    if (!item || !capture?.blob) return { item, capture, socialUrl: null, publishPromise: null };
    const shareId = await deriveShareId(item.publicPlayerId, capture.blob);
    const packageData = {
      item,
      capture,
      shareId,
      socialUrl: shareId ? socialShareUrl(shareId) : null,
      publishPromise: null,
      published: false,
    };
    return packageData;
  }

  function publishSharePackage(packageData) {
    if (!packageData?.shareId || !packageData?.item?.publicPlayerId || !packageData?.capture?.blob) return null;
    if (packageData.publishPromise) return packageData.publishPromise;
    const params = new URLSearchParams({
      player: String(packageData.item.publicPlayerId),
      name: packageData.item.data.playerName,
      jersey: packageData.item.data.jerseyText,
      width: String(packageData.capture.width || ''),
      height: String(packageData.capture.height || ''),
    });
    packageData.publishPromise = fetch(`${API_BASE_URL}/api/real-play/profile-share-snapshots?${params.toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'image/png',
      },
      body: packageData.capture.blob,
      cache: 'no-store',
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.message || 'Could not publish profile snapshot.');
        packageData.published = true;
        if (result?.share?.shareUrl) packageData.socialUrl = result.share.shareUrl;
        return result;
      })
      .catch((error) => {
        packageData.published = false;
        packageData.publishError = error;
        return null;
      });
    return packageData.publishPromise;
  }

  function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'real-play-profile.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function copyLink(url) {
    if (!url) return;
    navigator.clipboard?.writeText?.(url).catch(() => {});
  }

  function makeFile(blob, filename) {
    if (!blob || typeof File !== 'function') return null;
    return new File([blob], filename || 'real-play-profile.png', { type: 'image/png', lastModified: Date.now() });
  }

  function sharePreparedPackageNow(packageData) {
    const item = packageData?.item;
    const capture = packageData?.capture;
    const data = item?.data || panelData(packageData?.panel);
    const url = packageData?.socialUrl || item?.url || shareUrl(item?.publicPlayerId || data?.directPublicId);
    const title = item?.title || 'Real Play Basketball';
    const text = item?.text || `${data?.jerseyText || ''} ${data?.playerName || 'REAL PLAY PLAYER'}\nLess Screen. Real Points.`;
    const filename = item?.filename || 'real-play-profile.png';
    const blob = capture?.blob || null;
    const file = makeFile(blob, filename);

    if (navigator.share) {
      const canShareFile = Boolean(file && navigator.canShare && (() => {
        try { return navigator.canShare({ files: [file] }); } catch (_error) { return false; }
      })());
      const payload = canShareFile ? { title, text, url, files: [file] } : { title, text, url };
      navigator.share(payload).catch((error) => {
        if (error?.name === 'AbortError') return;
        copyLink(url);
        if (blob) downloadBlob(blob, filename);
        toast(blob ? 'SHARE SHEET BLOCKED · PROFILE PNG SAVED + LINK COPIED.' : 'SHARE COULD NOT OPEN · PROFILE LINK COPIED.', 2800);
      });
      return;
    }

    copyLink(url);
    if (blob) downloadBlob(blob, filename);
    toast(blob ? 'PROFILE PNG SAVED · LINK COPIED.' : 'PROFILE LINK COPIED.', 2400);
  }

  async function prepareSharePackage(panel) {
    const [item, capture] = await Promise.all([preparePanel(panel), primeCapture(panel)]);
    const packageData = await createSharePackage(item, capture);
    publishSharePackage(packageData);
    return packageData;
  }

  async function nativeShareNow(panel, primedPackage = null) {
    try {
      const packageData = primedPackage || await prepareSharePackage(panel);
      sharePreparedPackageNow(packageData);
    } catch (_error) {
      const data = panelData(panel);
      const fallbackUrl = shareUrl(data.directPublicId);
      if (navigator.share) {
        navigator.share({
          title: 'Real Play Basketball',
          text: `${data.jerseyText} ${data.playerName}\nLess Screen. Real Points.`,
          url: fallbackUrl,
        }).catch((error) => {
          if (error?.name !== 'AbortError') {
            copyLink(fallbackUrl);
            toast('PROFILE LINK COPIED.');
          }
        });
      } else {
        copyLink(fallbackUrl);
        toast('PROFILE LINK COPIED.');
      }
    }
  }

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    press.panel?.classList.remove('rp-profile-share-armed');
    press = null;
  }

  function beginPress(event, hero) {
    const panel = hero?.closest('.rp-profile.open');
    if (!panel || panel.classList.contains('rp-profile-art-editing')) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('button,a,input,textarea,select,[role="button"]')) return;

    cancelPress();
    const nextPress = {
      panel,
      hero,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      itemPromise: preparePanel(panel),
      capturePromise: primeCapture(panel),
      packagePromise: null,
      packageResult: null,
      timer: null,
    };

    // Start the real hero snapshot BEFORE the visual hold prompt is added. That
    // guarantees the PNG is the normal profile hero, not the temporary share UI.
    Promise.all([nextPress.itemPromise, nextPress.capturePromise])
      .then(([item, capture]) => createSharePackage(item, capture))
      .then((packageData) => {
        nextPress.packageResult = packageData;
        if (nextPress.armed) publishSharePackage(packageData);
        return packageData;
      })
      .catch(() => null);

    nextPress.timer = setTimeout(() => {
      if (press !== nextPress) return;
      nextPress.armed = true;
      panel.classList.add('rp-profile-share-armed');
      if (nextPress.packageResult) {
        publishSharePackage(nextPress.packageResult);
      } else {
        nextPress.packagePromise = Promise.all([nextPress.itemPromise, nextPress.capturePromise])
          .then(([item, capture]) => createSharePackage(item, capture))
          .then((packageData) => {
            nextPress.packageResult = packageData;
            publishSharePackage(packageData);
            return packageData;
          })
          .catch(() => null);
      }
      try { navigator.vibrate?.(18); } catch (_error) {}
    }, LONG_PRESS_MS);
    press = nextPress;
  }

  function movePress(event) {
    if (!press || event.pointerId !== press.pointerId || press.armed) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (distance > MOVE_CANCEL_PX) cancelPress();
  }

  function finishDelayedShare(current) {
    const promise = current.packagePromise
      || Promise.all([current.itemPromise, current.capturePromise])
        .then(([item, capture]) => createSharePackage(item, capture));
    promise
      .then((packageData) => {
        if (!packageData) throw new Error('Share package unavailable.');
        publishSharePackage(packageData);
        sharePreparedPackageNow(packageData);
      })
      .catch(() => nativeShareNow(current.panel));
  }

  function endPress(event) {
    if (!press || event.pointerId !== press.pointerId) return;
    const current = press;
    const armed = current.armed;
    clearTimeout(current.timer);
    current.panel.classList.remove('rp-profile-share-armed');
    press = null;
    if (!armed) return;

    event.preventDefault();
    event.stopPropagation();

    // If preparation finished during the hold, navigator.share is called in the
    // pointer-up task itself so iPhone/Safari keeps the native user activation.
    if (current.packageResult) {
      publishSharePackage(current.packageResult);
      sharePreparedPackageNow(current.packageResult);
      return;
    }

    finishDelayedShare(current);
  }

  function bindLongPress() {
    document.addEventListener('pointerdown', (event) => {
      const hero = event.target.closest?.('.rp-profile.open .rp-profile-hero');
      if (hero) beginPress(event, hero);
    }, true);
    document.addEventListener('pointermove', movePress, true);
    document.addEventListener('pointerup', endPress, true);
    document.addEventListener('pointercancel', cancelPress, true);
    window.addEventListener('blur', cancelPress);
    document.addEventListener('contextmenu', (event) => {
      if (press?.armed && event.target.closest?.('.rp-profile.open .rp-profile-hero')) event.preventDefault();
    }, true);
  }

  function warmOpenProfiles() {
    document.querySelectorAll('.rp-profile.open').forEach((panel) => {
      setTimeout(() => {
        preparePanel(panel, true).catch(() => {});
        const hero = panel.querySelector('.rp-profile-hero');
        if (hero) waitForHeroReady(hero).catch(() => {});
      }, 120);
    });
  }

  async function openVisitorDeepLink(playerId) {
    window.RealPlayVisitor?.enter?.();
    window.RealPlayWorld?.open?.();
    document.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === 'players';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    const playersTab = document.querySelector('[data-rp-world] [data-world-tab="players"]');
    playersTab?.click();
    const deadline = Date.now() + 5500;
    while (Date.now() < deadline) {
      const row = document.querySelector(`[data-world-player-id="${playerId}"]`);
      if (row) {
        row.click();
        return true;
      }
      await delay(120);
    }
    return false;
  }

  async function handleDeepLink() {
    if (deepLinkHandled) return;
    const playerId = positiveId(new URL(window.location.href).searchParams.get('player'));
    if (!playerId) return;
    deepLinkHandled = true;
    try {
      if (token() && window.RealPlayPlayers?.openProfile) {
        window.RealPlayPlayers.openProfile(playerId);
        return;
      }
      const opened = await openVisitorDeepLink(playerId);
      if (!opened) toast('PLAYER PROFILE COULD NOT OPEN.', 2400);
    } catch (_error) {
      toast('PLAYER PROFILE COULD NOT OPEN.', 2400);
    }
  }

  installStyles();
  bindLongPress();
  ensureHtml2Canvas().catch(() => {});
  window.addEventListener('realplay:profile-loaded', warmOpenProfiles);
  window.addEventListener('realplay:public-profile-loaded', warmOpenProfiles);
  window.addEventListener('realplay:profile-art-updated', warmOpenProfiles);
  window.addEventListener('realplay:app-ready', () => {
    warmOpenProfiles();
    setTimeout(handleDeepLink, 80);
  });
  if (document.documentElement.classList.contains('rp-shell-ready')) {
    warmOpenProfiles();
    setTimeout(handleDeepLink, 80);
  }

  window.RealPlayProfileShare = {
    prepare: warmOpenProfiles,
    shareOpenProfile: async () => {
      const panel = document.querySelector('.rp-profile.open');
      if (!panel) return;
      try {
        await nativeShareNow(panel);
      } catch (_error) {
        toast('PROFILE SHARE IS NOT READY YET.');
      }
    },
    captureOpenHero: async () => {
      const panel = document.querySelector('.rp-profile.open');
      if (!panel) return null;
      const result = await primeCapture(panel);
      return result?.blob || null;
    },
  };
})();