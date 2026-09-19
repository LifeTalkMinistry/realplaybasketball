(() => {
  if (window.__realPlayProfileShareInstalled) return;
  window.__realPlayProfileShareInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const LONG_PRESS_MS = 620;
  const MOVE_CANCEL_PX = 14;
  const CARD_WIDTH = 1080;
  const CARD_HEIGHT = 1350;
  const prepared = new WeakMap();
  const preparing = new WeakMap();
  let press = null;
  let deepLinkHandled = false;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const clean = (value) => String(value ?? '').trim();
  const upper = (value) => clean(value).toUpperCase();
  const normalizeName = (value) => upper(value).replace(/\s+/g, ' ');
  const textOf = (root, selector) => clean(root?.querySelector(selector)?.textContent);

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function installStyles() {
    if (document.querySelector('[data-rp-profile-share-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileShareStyles = '1';
    style.textContent = `
      .rp-profile.open .rp-profile-hero{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
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
    return {
      wins,
      losses,
      games,
      winRate: games > 0 ? `${Math.round((wins / games) * 100)}%` : '—',
    };
  }

  function panelData(panel) {
    const hero = panel?.querySelector('.rp-profile-hero');
    const record = textOf(hero, '.rp-profile-record strong') || '0-0';
    const recordMeta = recordStats(record);
    const source = panel?.__realPlayPublicPlayer || panel?.__realPlayProfileState || {};
    const profile = source?.profile || source?.player || source || {};
    const isPublic = Boolean(panel?.matches('.rp-public-player-profile,[data-rp-public-profile],[data-rp-visitor-public-profile]'));
    const directPublicId = isPublic ? positiveId(
      panel?.dataset?.rpPublicPlayerId || source?.playerId || source?.userId
    ) : null;
    const accountUserId = positiveId(
      source?.accountUserId ?? source?.account_user_id ??
      source?.profile?.user_id ?? source?.profile?.userId ??
      source?.profile?.id ?? profile?.accountUserId ?? profile?.account_user_id
    );
    const jerseyText = textOf(hero, '.rp-profile-number strong') || '#—';
    const jerseyMatch = jerseyText.match(/\d+/);
    const jerseyNumber = jerseyMatch ? Number(jerseyMatch[0]) : null;
    const artLayer = hero?.querySelector('.rp-premium-profile-art.is-ready') || hero?.querySelector('.rp-premium-profile-art');
    const artImage = artLayer?.querySelector('img');
    const badgeImage = hero?.querySelector('.rp-profile-badges img, .rp-profile-badge img');
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
      artLayer,
      artSrc: artImage?.currentSrc || artImage?.src || '',
      badgeSrc: badgeImage?.currentSrc || badgeImage?.src || '',
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
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    if (publicPlayerId) url.searchParams.set('player', String(publicPlayerId));
    return url.toString();
  }

  function roundedPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawRoundedFill(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
    roundedPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  async function loadImage(src) {
    const value = clean(src);
    if (!value) return null;
    let url = value;
    try { url = new URL(value, window.location.href).href; } catch (_error) {}
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      if (!/^data:|^blob:/i.test(url)) image.crossOrigin = 'anonymous';
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      const timer = setTimeout(() => finish(null), 3200);
      image.src = url;
      if (image.complete && image.naturalWidth > 0) finish(image);
    });
  }

  function fitDisplayFont(ctx, text, maxWidth, startSize, minSize = 38) {
    let size = startSize;
    while (size > minSize) {
      ctx.font = `italic 950 ${size}px Impact, Arial Narrow, Arial, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 2;
    }
    ctx.font = `italic 950 ${minSize}px Impact, Arial Narrow, Arial, sans-serif`;
    return minSize;
  }

  function drawMetric(ctx, x, y, w, label, value, sub, accent = '#eef7ff') {
    drawRoundedFill(ctx, x, y, w, 216, 30, 'rgba(3,9,16,.92)', 'rgba(91,216,255,.18)', 2);
    ctx.fillStyle = '#74879a';
    ctx.font = '900 21px Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(label, x + 30, y + 42);
    ctx.fillStyle = accent;
    ctx.font = '950 56px Impact, Arial Narrow, Arial, sans-serif';
    ctx.fillText(value, x + 30, y + 113);
    ctx.fillStyle = '#64778a';
    ctx.font = '900 17px Arial, sans-serif';
    ctx.fillText(sub, x + 30, y + 164);
  }

  function artTransform(data) {
    const style = data.artLayer ? getComputedStyle(data.artLayer) : null;
    const number = (name, fallback) => {
      const parsed = parseFloat(style?.getPropertyValue(name));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    return {
      x: number('--rp-art-x', 72),
      y: number('--rp-art-y', 44),
      scale: number('--rp-art-scale', 1.15),
      opacity: number('--rp-art-opacity', 1),
    };
  }

  async function renderCard(data, includeImages = true) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');

    const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bg.addColorStop(0, '#02070d');
    bg.addColorStop(.52, '#03070c');
    bg.addColorStop(1, '#070309');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    const cyanGlow = ctx.createRadialGradient(130, 220, 20, 130, 220, 520);
    cyanGlow.addColorStop(0, 'rgba(22,183,255,.17)');
    cyanGlow.addColorStop(1, 'rgba(22,183,255,0)');
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    const redGlow = ctx.createRadialGradient(1000, 360, 20, 1000, 360, 520);
    redGlow.addColorStop(0, 'rgba(255,34,74,.17)');
    redGlow.addColorStop(1, 'rgba(255,34,74,0)');
    ctx.fillStyle = redGlow;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    const cardX = 54;
    const cardY = 52;
    const cardW = 972;
    const cardH = 1170;
    drawRoundedFill(ctx, cardX, cardY, cardW, cardH, 52, 'rgba(3,8,14,.84)', 'rgba(70,210,255,.48)', 3);

    ctx.save();
    roundedPath(ctx, cardX, cardY, cardW, cardH, 52);
    ctx.clip();

    if (includeImages && data.artSrc) {
      const art = await loadImage(data.artSrc);
      if (art) {
        const t = artTransform(data);
        const targetW = cardW * .72 * t.scale;
        const targetH = targetW * (art.naturalHeight / Math.max(1, art.naturalWidth));
        const centerX = cardX + cardW * (t.x / 100);
        const centerY = cardY + cardH * (t.y / 100);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity));
        ctx.drawImage(art, centerX - targetW / 2, centerY - targetH / 2, targetW, targetH);
        ctx.restore();
      }
    }

    const leftShade = ctx.createLinearGradient(cardX, 0, cardX + cardW * .72, 0);
    leftShade.addColorStop(0, 'rgba(2,7,13,.98)');
    leftShade.addColorStop(.30, 'rgba(2,7,13,.82)');
    leftShade.addColorStop(.58, 'rgba(2,7,13,.32)');
    leftShade.addColorStop(1, 'rgba(2,7,13,0)');
    ctx.fillStyle = leftShade;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    const bottomShade = ctx.createLinearGradient(0, cardY + cardH * .52, 0, cardY + cardH);
    bottomShade.addColorStop(0, 'rgba(2,7,13,0)');
    bottomShade.addColorStop(.52, 'rgba(2,7,13,.60)');
    bottomShade.addColorStop(1, 'rgba(2,7,13,.99)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    ctx.fillStyle = '#4cdcff';
    ctx.font = '900 22px Arial, sans-serif';
    ctx.fillText('REAL PLAY PLAYER', 92, 110);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#718295';
    ctx.font = '900 18px Arial, sans-serif';
    ctx.fillText(upper(data.passLabel), 986, 110);
    ctx.textAlign = 'left';

    if (includeImages && data.badgeSrc) {
      const badge = await loadImage(data.badgeSrc);
      if (badge) {
        const maxW = 270;
        const maxH = 150;
        const scale = Math.min(maxW / badge.naturalWidth, maxH / badge.naturalHeight, 1.7);
        const w = badge.naturalWidth * scale;
        const h = badge.naturalHeight * scale;
        ctx.drawImage(badge, 86, 206, w, h);
      }
    }

    const name = upper(data.playerName);
    const jersey = upper(data.jerseyText || '#—');
    const nameLine = `${jersey}  ${name}`;
    fitDisplayFont(ctx, nameLine, 835, 78, 44);
    ctx.fillStyle = '#f7fbff';
    ctx.fillText(nameLine, 86, 720);

    const jerseyWidth = ctx.measureText(`${jersey}  `).width;
    ctx.fillStyle = '#45dcff';
    ctx.fillText(jersey, 86, 720);
    ctx.fillStyle = '#f7fbff';
    const nameOnlyX = 86 + Math.max(0, jerseyWidth - ctx.measureText(jersey).width + ctx.measureText(jersey).width);
    ctx.fillText(name, nameOnlyX, 720);

    ctx.fillStyle = '#75879a';
    ctx.font = '900 20px Arial, sans-serif';
    ctx.fillText('LESS SCREEN. REAL POINTS.', 90, 766);

    const metricY = 840;
    const metricW = 215;
    const gap = 18;
    const metricX = 84;
    drawMetric(ctx, metricX, metricY, metricW, 'OVR', data.ovr, 'OFFICIAL RATING', '#49ddff');
    drawMetric(ctx, metricX + (metricW + gap), metricY, metricW, 'RANK', data.rank, 'OFFICIAL RANK');
    drawMetric(ctx, metricX + 2 * (metricW + gap), metricY, metricW, 'RECORD', data.record, data.gamesText);
    drawMetric(ctx, metricX + 3 * (metricW + gap), metricY, metricW, 'WIN RATE', data.winRate, 'CAREER', '#4ce0ff');

    ctx.fillStyle = '#f1f7fc';
    ctx.font = 'italic 950 40px Impact, Arial Narrow, Arial, sans-serif';
    ctx.fillText('REAL PLAY BASKETBALL', 84, 1274);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4bdcff';
    ctx.font = '900 20px Arial, sans-serif';
    ctx.fillText('JOINREALPLAY.COM', 996, 1270);
    ctx.textAlign = 'left';

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create share image.')), 'image/png', .96);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function makeShareImage(data) {
    try {
      return await canvasToBlob(await renderCard(data, true));
    } catch (_error) {
      return canvasToBlob(await renderCard(data, false));
    }
  }

  function signature(data) {
    return [data.playerName, data.jerseyText, data.ovr, data.rank, data.record, data.winRate, data.artSrc, data.badgeSrc].join('|');
  }

  async function preparePanel(panel, force = false) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return null;
    const data = panelData(panel);
    if (!data.hero) return null;
    const sig = signature(data);
    const current = prepared.get(panel);
    if (!force && current?.signature === sig) return current;
    const active = preparing.get(panel);
    if (!force && active?.signature === sig) return active.promise;

    const promise = (async () => {
      const [publicPlayerId, blob] = await Promise.all([
        resolvePublicPlayerId(data),
        makeShareImage(data),
      ]);
      const url = shareUrl(publicPlayerId);
      const safeName = normalizeName(data.playerName).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'player';
      const file = typeof File === 'function'
        ? new File([blob], `real-play-${safeName}.png`, { type: 'image/png', lastModified: Date.now() })
        : null;
      const title = `${data.jerseyText} ${data.playerName} | Real Play Basketball`;
      const text = `${data.jerseyText} ${data.playerName}\nOVR ${data.ovr} · RANK ${data.rank} · ${data.record} · ${data.winRate} WIN RATE\nLess Screen. Real Points.`;
      const result = { signature: sig, data, publicPlayerId, url, blob, file, title, text };
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

  function nativeShareNow(panel) {
    const item = prepared.get(panel);
    if (!item) {
      const data = panelData(panel);
      const fallbackId = data.directPublicId;
      const url = shareUrl(fallbackId);
      if (navigator.share) {
        navigator.share({ title: 'Real Play Basketball', text: `${data.jerseyText} ${data.playerName}\nLess Screen. Real Points.`, url })
          .catch((error) => { if (error?.name !== 'AbortError') toast('SHARE COULD NOT OPEN. TRY AGAIN.'); });
      } else {
        copyLink(url);
        toast('PROFILE LINK COPIED.');
      }
      preparePanel(panel).catch(() => {});
      return;
    }

    if (navigator.share) {
      const canShareFile = Boolean(item.file && navigator.canShare && (() => {
        try { return navigator.canShare({ files: [item.file] }); } catch (_error) { return false; }
      })());
      const payload = canShareFile
        ? { title: item.title, text: item.text, url: item.url, files: [item.file] }
        : { title: item.title, text: item.text, url: item.url };
      navigator.share(payload).catch((error) => {
        if (error?.name === 'AbortError') return;
        copyLink(item.url);
        if (item.blob) downloadBlob(item.blob, item.file?.name || 'real-play-profile.png');
        toast('SHARE SHEET BLOCKED · CARD SAVED + LINK COPIED.', 2600);
      });
      return;
    }

    copyLink(item.url);
    downloadBlob(item.blob, item.file?.name || 'real-play-profile.png');
    toast('PROFILE CARD SAVED · LINK COPIED.', 2400);
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
    preparePanel(panel).catch(() => {});
    press = {
      panel,
      hero,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      timer: setTimeout(() => {
        if (!press || press.panel !== panel) return;
        press.armed = true;
        panel.classList.add('rp-profile-share-armed');
        try { navigator.vibrate?.(18); } catch (_error) {}
      }, LONG_PRESS_MS),
    };
  }

  function movePress(event) {
    if (!press || event.pointerId !== press.pointerId || press.armed) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (distance > MOVE_CANCEL_PX) cancelPress();
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
    nativeShareNow(current.panel);
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
      setTimeout(() => preparePanel(panel, true).catch(() => {}), 120);
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
      await new Promise((resolve) => setTimeout(resolve, 120));
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
    shareOpenProfile: () => {
      const panel = document.querySelector('.rp-profile.open');
      if (panel) {
        preparePanel(panel).then(() => nativeShareNow(panel)).catch(() => toast('PROFILE SHARE IS NOT READY YET.'));
      }
    },
  };
})();
