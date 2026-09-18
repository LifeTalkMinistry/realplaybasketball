(() => {
  if (window.__realPlayReservationSnapshotInstalled) return;
  window.__realPlayReservationSnapshotInstalled = true;

  const HOLD_MS = 850;
  const MOVE_TOLERANCE = 14;
  const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const STYLE_ID = 'rp-reservation-snapshot-style';
  const LIB_ID = 'rp-reservation-snapshot-html2canvas';

  let trigger = null;
  let holdTimer = 0;
  let holdStart = null;
  let holdCompleted = false;
  let generating = false;
  let previewUrl = '';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-spot-priority-trigger.rp-snapshot-holding{
        border-color:rgba(83,229,255,.78)!important;
        background:linear-gradient(180deg,rgba(10,49,67,.98),rgba(4,20,31,.99))!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 0 4px rgba(68,207,242,.08),0 8px 24px rgba(0,0,0,.28)!important;
      }
      .rp-snapshot-toast{
        position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));z-index:2147483600;
        max-width:min(88vw,360px);padding:10px 14px;border:1px solid rgba(75,218,250,.26);border-radius:999px;
        background:rgba(3,12,19,.94);color:#dff8ff;box-shadow:0 10px 30px rgba(0,0,0,.38);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transform:translateX(-50%);
        font:900 .58rem/1.2 Arial,sans-serif;letter-spacing:.08em;text-align:center;text-transform:uppercase;
        pointer-events:none;
      }
      .rp-snapshot-preview{
        position:fixed;inset:0;z-index:2147483601;display:flex;align-items:flex-end;justify-content:center;
        padding:16px 12px 0;box-sizing:border-box;background:rgba(0,3,7,.82);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      }
      .rp-snapshot-preview-sheet{
        width:min(100%,460px);max-height:calc(100dvh - 18px);overflow:auto;box-sizing:border-box;
        padding:10px 14px calc(16px + env(safe-area-inset-bottom));border:1px solid rgba(65,200,238,.30);
        border-bottom:0;border-radius:24px 24px 0 0;background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -20px 60px rgba(0,0,0,.58);scrollbar-width:none;
      }
      .rp-snapshot-preview-sheet::-webkit-scrollbar{display:none}
      .rp-snapshot-grab{width:50px;height:4px;margin:1px auto 9px;border-radius:999px;background:rgba(146,171,190,.34)}
      .rp-snapshot-preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 1px 10px}
      .rp-snapshot-preview-head div{min-width:0}
      .rp-snapshot-preview-head small{display:block;margin-bottom:4px;color:#60d9f2;font:950 .44rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-snapshot-preview-head strong{display:block;color:#f7fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.2rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1;text-transform:uppercase}
      .rp-snapshot-preview-close{flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.035);color:#b6c6d3;font:800 1rem/1 Arial,sans-serif;cursor:pointer}
      .rp-snapshot-preview-image{overflow:hidden;border:1px solid rgba(73,205,239,.18);border-radius:16px;background:#02070b}
      .rp-snapshot-preview-image img{display:block;width:100%;height:auto}
      .rp-snapshot-preview-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}
      .rp-snapshot-preview-actions button{min-height:42px;padding:0 10px;border:1px solid rgba(80,144,180,.18);border-radius:12px;background:rgba(4,13,21,.86);color:#d8e5ee;font:950 .54rem/1 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
      .rp-snapshot-preview-actions button.primary{border-color:rgba(73,216,249,.42);background:linear-gradient(180deg,rgba(11,55,73,.82),rgba(5,26,38,.92));color:#76e6fc}
      .rp-snapshot-export-stage{position:fixed!important;left:-10000px!important;top:0!important;z-index:-1!important;pointer-events:none!important;overflow:visible!important}
      .rp-snapshot-export-card{box-sizing:border-box!important;margin:0!important}
      .rp-snapshot-export-card [data-rp-ranking-secured-list],
      .rp-snapshot-export-card [data-rp-ranking-standby-list]{max-height:none!important;overflow:visible!important}
      .rp-snapshot-export-card [data-rp-ranking-secured],
      .rp-snapshot-export-card [data-rp-ranking-standby-roster]{max-height:none!important;overflow:visible!important}
      .rp-snapshot-export-card .rp-ranking-secured-player{pointer-events:none!important}
      .rp-snapshot-export-brand{padding:15px 14px 11px;text-align:center;color:#f4f9fd;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1rem;font-style:italic;font-weight:950;letter-spacing:.055em;line-height:1;text-transform:uppercase}
      .rp-snapshot-export-footer{padding:13px 12px 4px;color:#60778a;font:900 .45rem/1 Arial,sans-serif;letter-spacing:.12em;text-align:center;text-transform:uppercase}
      @media(min-width:700px){
        .rp-snapshot-preview{align-items:center;padding:18px}
        .rp-snapshot-preview-sheet{border-bottom:1px solid rgba(65,200,238,.30);border-radius:24px}
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message, duration = 1500) {
    document.querySelector('.rp-snapshot-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'rp-snapshot-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function cleanupHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdStart = null;
    trigger?.classList.remove('rp-snapshot-holding');
  }

  function suppressNextClick() {
    const block = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.removeEventListener('click', block, true);
    };
    window.addEventListener('click', block, true);
    window.setTimeout(() => window.removeEventListener('click', block, true), 800);
  }

  function loadHtml2Canvas() {
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);

    return new Promise((resolve, reject) => {
      const existing = document.getElementById(LIB_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.html2canvas), { once:true });
        existing.addEventListener('error', () => reject(new Error('Snapshot renderer could not load.')), { once:true });
        return;
      }

      const script = document.createElement('script');
      script.id = LIB_ID;
      script.src = HTML2CANVAS_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', () => {
        if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
        else reject(new Error('Snapshot renderer is unavailable.'));
      }, { once:true });
      script.addEventListener('error', () => reject(new Error('Snapshot renderer could not load.')), { once:true });
      document.head.appendChild(script);
    });
  }

  function removeExportOnlyControls(root) {
    [
      '[data-rp-spot-priority]',
      '[data-rp-ranking-cancel]',
      '[data-rp-snapshot-exclude]',
      '.rp-snapshot-toast',
      '.rp-snapshot-preview'
    ].forEach((selector) => root.querySelectorAll(selector).forEach((node) => node.remove()));

    root.querySelectorAll('button').forEach((button) => {
      const text = String(button.textContent || '').trim().toUpperCase();
      if (text.includes('CANCEL SPOT')) button.remove();
    });
  }

  function buildStage() {
    const card = document.querySelector('[data-rp-ranking-session]');
    if (!card) throw new Error('Open Rank reservation is not available.');

    const rect = card.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || card.offsetWidth || 360));

    const stage = document.createElement('div');
    stage.className = 'rp-snapshot-export-stage';
    stage.style.width = `${width}px`;

    const brand = document.createElement('div');
    brand.className = 'rp-snapshot-export-brand';
    brand.textContent = 'REAL PLAY BASKETBALL · OPEN RANK';

    const clone = card.cloneNode(true);
    clone.classList.add('rp-snapshot-export-card');
    clone.style.width = `${width}px`;
    clone.style.maxWidth = 'none';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    removeExportOnlyControls(clone);

    const footer = document.createElement('div');
    footer.className = 'rp-snapshot-export-footer';
    footer.textContent = 'LESS SCREEN. REAL POINTS.';

    stage.append(brand, clone, footer);
    document.body.appendChild(stage);
    return stage;
  }

  async function renderSnapshot() {
    const html2canvas = await loadHtml2Canvas();
    const stage = buildStage();

    try {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready.catch(() => undefined),
          new Promise((resolve) => window.setTimeout(resolve, 900)),
        ]);
      }
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

      const canvas = await html2canvas(stage, {
        backgroundColor: '#02070b',
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(document.documentElement.clientWidth, stage.scrollWidth),
        windowHeight: Math.max(document.documentElement.clientHeight, stage.scrollHeight),
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
      if (!blob) throw new Error('The reservation image could not be created.');
      return blob;
    } finally {
      stage.remove();
    }
  }

  function closePreview() {
    document.querySelector('.rp-snapshot-preview')?.remove();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
  }

  function fileName() {
    const stamp = new Date();
    const date = [
      stamp.getFullYear(),
      String(stamp.getMonth() + 1).padStart(2, '0'),
      String(stamp.getDate()).padStart(2, '0')
    ].join('-');
    return `real-play-open-rank-${date}.png`;
  }

  function saveBlob(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function shareBlob(blob) {
    if (!navigator.share) return false;
    const file = new File([blob], fileName(), { type:'image/png' });
    const payload = {
      title:'Real Play Open Rank',
      text:'Current Real Play Open Rank reservation.',
      files:[file],
    };
    if (navigator.canShare && !navigator.canShare({ files:[file] })) return false;
    await navigator.share(payload);
    return true;
  }

  function openPreview(blob) {
    closePreview();
    previewUrl = URL.createObjectURL(blob);

    const overlay = document.createElement('div');
    overlay.className = 'rp-snapshot-preview';
    overlay.innerHTML = `
      <section class="rp-snapshot-preview-sheet" role="dialog" aria-modal="true" aria-label="Open Rank reservation snapshot">
        <div class="rp-snapshot-grab" aria-hidden="true"></div>
        <header class="rp-snapshot-preview-head">
          <div><small>READY TO SHARE</small><strong>RESERVATION SNAPSHOT</strong></div>
          <button class="rp-snapshot-preview-close" type="button" aria-label="Close snapshot">×</button>
        </header>
        <div class="rp-snapshot-preview-image"><img src="${previewUrl}" alt="Current Open Rank reservation snapshot"></div>
        <div class="rp-snapshot-preview-actions">
          <button class="primary" type="button" data-rp-snapshot-share>SHARE IMAGE</button>
          <button type="button" data-rp-snapshot-save>SAVE IMAGE</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target === overlay || target.closest('.rp-snapshot-preview-close')) {
        closePreview();
        return;
      }
      if (target.closest('[data-rp-snapshot-save]')) {
        saveBlob(blob);
        showToast('Reservation image saved.');
        return;
      }
      if (target.closest('[data-rp-snapshot-share]')) {
        const button = target.closest('[data-rp-snapshot-share]');
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'OPENING SHARE…';
        try {
          const shared = await shareBlob(blob);
          if (!shared) {
            saveBlob(blob);
            showToast('Sharing is unavailable here · image saved instead.', 2200);
          }
        } catch (error) {
          if (error?.name !== 'AbortError') {
            saveBlob(blob);
            showToast('Share failed · image saved instead.', 2200);
          }
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  }

  async function createSnapshot() {
    if (generating) return;
    generating = true;
    showToast('Creating clean reservation snapshot…', 1800);
    try {
      const blob = await renderSnapshot();
      openPreview(blob);
    } catch (error) {
      console.error('[Real Play] Reservation snapshot failed.', error);
      showToast(error?.message || 'Unable to create reservation snapshot.', 2600);
    } finally {
      generating = false;
    }
  }

  function bindTrigger(node) {
    if (!node || node.dataset.rpReservationSnapshotBound === '1') return;
    node.dataset.rpReservationSnapshotBound = '1';
    node.setAttribute('aria-label', 'Session guide. Press and hold to create reservation snapshot.');
    node.title = 'Tap for session guide · Hold for reservation snapshot';

    node.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      holdCompleted = false;
      holdStart = { x:event.clientX, y:event.clientY };
      trigger = node;
      node.classList.add('rp-snapshot-holding');

      holdTimer = window.setTimeout(() => {
        holdTimer = 0;
        holdCompleted = true;
        node.classList.remove('rp-snapshot-holding');
        suppressNextClick();
        if (navigator.vibrate) {
          try { navigator.vibrate(25); } catch (_error) {}
        }
        createSnapshot();
      }, HOLD_MS);
    });

    node.addEventListener('pointermove', (event) => {
      if (!holdTimer || !holdStart) return;
      if (Math.abs(event.clientX - holdStart.x) > MOVE_TOLERANCE || Math.abs(event.clientY - holdStart.y) > MOVE_TOLERANCE) {
        cleanupHold();
      }
    });

    const finish = () => {
      if (!holdCompleted) cleanupHold();
      else {
        holdStart = null;
        trigger = null;
      }
    };

    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', finish);
    node.addEventListener('lostpointercapture', finish);
  }

  function mount() {
    installStyles();
    const node = document.querySelector('[data-rp-spot-priority]');
    if (!node) return false;
    bindTrigger(node);
    return true;
  }

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  window.addEventListener('beforeunload', closePreview);
})();
