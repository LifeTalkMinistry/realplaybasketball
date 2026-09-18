(() => {
  if (window.__realPlayReservationSnapshotInstalled) return;
  window.__realPlayReservationSnapshotInstalled = true;

  const HOLD_MS = 850;
  const MOVE_TOLERANCE = 14;
  const DOM_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.6.0/dist/dom-to-image-more.min.js';
  const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const STYLE_ID = 'rp-reservation-snapshot-style';
  const DOM_LIB_ID = 'rp-reservation-snapshot-domtoimage';
  const FALLBACK_LIB_ID = 'rp-reservation-snapshot-html2canvas';
  const SOURCE_ATTR = 'data-rp-reservation-snapshot-source';

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
        font:900 .58rem/1.2 Arial,sans-serif;letter-spacing:.08em;text-align:center;text-transform:uppercase;pointer-events:none;
      }
      .rp-snapshot-preview{
        position:fixed;inset:0;z-index:2147483601;display:flex;align-items:flex-end;justify-content:center;
        padding:16px 12px 0;box-sizing:border-box;background:rgba(0,3,7,.84);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      }
      .rp-snapshot-preview-sheet{
        width:min(100%,480px);max-height:calc(100dvh - 18px);overflow:auto;box-sizing:border-box;
        padding:10px 14px calc(16px + env(safe-area-inset-bottom));border:1px solid rgba(65,200,238,.30);
        border-bottom:0;border-radius:24px 24px 0 0;background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -20px 60px rgba(0,0,0,.58);scrollbar-width:none;
      }
      .rp-snapshot-preview-sheet::-webkit-scrollbar{display:none}
      .rp-snapshot-grab{width:50px;height:4px;margin:1px auto 9px;border-radius:999px;background:rgba(146,171,190,.34)}
      .rp-snapshot-preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 1px 10px}
      .rp-snapshot-preview-head div{min-width:0}
      .rp-snapshot-preview-head small{display:block;margin-bottom:4px;color:#60d9f2;font:950 .44rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-snapshot-preview-head strong{display:block;color:#f7fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.18rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1;text-transform:uppercase}
      .rp-snapshot-preview-close{flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.035);color:#b6c6d3;font:800 1rem/1 Arial,sans-serif;cursor:pointer}
      .rp-snapshot-preview-image{
        width:100%;max-height:66dvh;overflow:auto;border:1px solid rgba(73,205,239,.18);border-radius:16px;
        background:#02070b;scrollbar-width:thin;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
        touch-action:pan-x pan-y pinch-zoom;
      }
      .rp-snapshot-preview-image img{display:block;width:100%;height:auto;max-width:none;image-rendering:auto}
      .rp-snapshot-preview-hint{margin:8px 4px 0;color:#6f8497;font:800 .49rem/1.4 Arial,sans-serif;letter-spacing:.055em;text-align:center;text-transform:uppercase}
      .rp-snapshot-preview-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}
      .rp-snapshot-preview-actions button{
        min-height:42px;padding:0 10px;border:1px solid rgba(80,144,180,.18);border-radius:12px;background:rgba(4,13,21,.86);
        color:#d8e5ee;font:950 .54rem/1 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;
      }
      .rp-snapshot-preview-actions button.primary{
        border-color:rgba(73,216,249,.42);background:linear-gradient(180deg,rgba(11,55,73,.82),rgba(5,26,38,.92));color:#76e6fc;
      }

      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source{
        box-sizing:border-box!important;height:auto!important;max-height:none!important;overflow:visible!important;transform:none!important;
      }
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-spot-priority],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-cancel],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-session-action],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-snapshot-exclude]{
        display:none!important;
      }
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source .rp-ranking-access-summary-head span{
        display:none!important;
      }
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source .rp-ranking-access-summary-head{
        justify-content:flex-end!important;
      }
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-secured],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-standby-roster],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-secured-list],
      [data-rp-reservation-snapshot-source="true"].rp-snapshot-exact-source [data-rp-ranking-standby-list]{
        height:auto!important;max-height:none!important;overflow:visible!important;
      }
      .rp-snapshot-capture-mode [data-rp-spot-priority],
      .rp-snapshot-capture-mode [data-rp-ranking-cancel],
      .rp-snapshot-capture-mode [data-rp-ranking-session-action],
      .rp-snapshot-capture-mode [data-rp-snapshot-exclude]{
        display:none!important;
      }
      .rp-snapshot-capture-mode .rp-ranking-access-summary-head span{
        display:none!important;
      }
      .rp-snapshot-capture-mode .rp-ranking-access-summary-head{
        justify-content:flex-end!important;
      }
      .rp-snapshot-capture-mode [data-rp-ranking-secured] > .rp-ranking-secured-head,
      .rp-snapshot-capture-mode [data-rp-ranking-standby-roster] > .rp-ranking-secured-head{
        justify-content:center!important;
        margin-bottom:14px!important;
        text-align:center!important;
      }
      .rp-snapshot-capture-mode [data-rp-ranking-secured] > .rp-ranking-secured-head > span,
      .rp-snapshot-capture-mode [data-rp-ranking-standby-roster] > .rp-ranking-secured-head > span{
        display:none!important;
      }
      .rp-snapshot-capture-mode [data-rp-ranking-secured] > .rp-ranking-secured-head > strong,
      .rp-snapshot-capture-mode [data-rp-ranking-standby-roster] > .rp-ranking-secured-head > strong{
        width:100%!important;
        text-align:center!important;
        text-transform:none!important;
      }
      .rp-snapshot-capture-mode .rp-ranking-secured-name,
      .rp-snapshot-capture-mode .rp-ranking-secured-value,
      .rp-snapshot-capture-mode .rp-ranking-secured-rank,
      .rp-snapshot-capture-mode .rp-ranking-secured-label{
        overflow:visible!important;
        text-overflow:clip!important;
        line-height:1.22!important;
      }
      .rp-snapshot-capture-mode .rp-ranking-secured-player{
        overflow:hidden!important;
      }
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

  function loadScriptLibrary(id, src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (ready()) return resolve();
        existing.addEventListener('load', () => ready() ? resolve() : reject(new Error('Snapshot renderer is unavailable.')), { once:true });
        existing.addEventListener('error', () => reject(new Error('Snapshot renderer could not load.')), { once:true });
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', () => ready() ? resolve() : reject(new Error('Snapshot renderer is unavailable.')), { once:true });
      script.addEventListener('error', () => reject(new Error('Snapshot renderer could not load.')), { once:true });
      document.head.appendChild(script);
    });
  }

  async function loadPrimaryRenderer() {
    await loadScriptLibrary(
      DOM_LIB_ID,
      DOM_TO_IMAGE_URL,
      () => Boolean(window.domtoimage && typeof window.domtoimage.toBlob === 'function')
    );
    return window.domtoimage;
  }

  async function loadFallbackRenderer() {
    await loadScriptLibrary(
      FALLBACK_LIB_ID,
      HTML2CANVAS_URL,
      () => typeof window.html2canvas === 'function'
    );
    return window.html2canvas;
  }

  function sourceNode() {
    return document.querySelector('[data-rp-ranking-games] .rp-ranking-next')
      || document.querySelector('[data-rp-ranking-session]');
  }

  function snapshotInteger(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  function prepareSnapshotRosterHeaders(source) {
    const restores = [];

    const replaceText = (node, nextText) => {
      if (!node || !nextText) return;
      const previous = node.textContent;
      restores.push(() => { node.textContent = previous; });
      node.textContent = nextText;
    };

    const tokenCount = source.querySelector('[data-rp-ranking-secured] [data-rp-ranking-secured-count]');
    if (tokenCount) {
      const parts = String(tokenCount.textContent || '').match(/\d+/g) || [];
      const current = snapshotInteger(parts[0]);
      const capacity = snapshotInteger(parts[1]);
      if (current !== null) {
        const paddedCurrent = String(current).padStart(2, '0');
        replaceText(
          tokenCount,
          capacity !== null ? `${paddedCurrent}/${capacity} Token Users` : `${paddedCurrent} Token Users`
        );
      }
    }

    const standbyCount = source.querySelector('[data-rp-ranking-standby-roster] [data-rp-ranking-standby-count]');
    if (standbyCount) {
      const match = String(standbyCount.textContent || '').match(/\d+/);
      const count = snapshotInteger(match?.[0]);
      if (count !== null) replaceText(standbyCount, `Standby ${count}`);
    }

    return () => {
      for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]();
    };
  }

  async function waitForStableFonts() {
    if (!document.fonts?.ready) return;
    await Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise((resolve) => window.setTimeout(resolve, 1200)),
    ]);
  }

  function captureFilter(node) {
    if (!(node instanceof Element)) return true;
    return !(
      node.matches?.('[data-rp-spot-priority]')
      || node.matches?.('[data-rp-ranking-cancel]')
      || node.matches?.('[data-rp-ranking-session-action]')
      || node.matches?.('[data-rp-snapshot-exclude]')
      || node.matches?.('.rp-snapshot-toast')
      || node.matches?.('.rp-snapshot-preview')
    );
  }

  async function renderWithDomToImage(source, width, height) {
    const domtoimage = await loadPrimaryRenderer();

    // Render at native CSS width, but rasterize the browser-rendered DOM at a
    // larger pixel ratio. This preserves the exact mobile layout instead of
    // reflowing it into a fake poster width.
    const maxScaleByHeight = 12000 / Math.max(1, height);
    const scale = Math.max(1.75, Math.min(3, maxScaleByHeight));

    return domtoimage.toBlob(source, {
      bgcolor: '#020306',
      cacheBust: true,
      filter: captureFilter,
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      style: {
        transform: 'scale(' + scale + ')',
        transformOrigin: 'top left',
        width: width + 'px',
        height: height + 'px',
        margin: '0',
      },
    });
  }

  async function renderWithHtml2Canvas(source, width, height) {
    const html2canvas = await loadFallbackRenderer();
    const canvas = await html2canvas(source, {
      backgroundColor: '#020306',
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      allowTaint: false,
      logging: false,
      width,
      height,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: Math.max(document.documentElement.clientWidth, width),
      windowHeight: Math.max(document.documentElement.clientHeight, height),
      onclone: (clonedDocument) => {
        const clone = clonedDocument.querySelector('[data-rp-reservation-snapshot-source="true"]');
        if (!clone) return;

        clone.classList.add('rp-snapshot-exact-source', 'rp-snapshot-capture-mode');
        clone.style.setProperty('width', String(width) + 'px', 'important');
        clone.style.setProperty('min-width', String(width) + 'px', 'important');
        clone.style.setProperty('max-width', String(width) + 'px', 'important');
        clone.style.setProperty('height', 'auto', 'important');
        clone.style.setProperty('max-height', 'none', 'important');
        clone.style.setProperty('overflow', 'visible', 'important');
        clone.style.setProperty('margin', '0', 'important');

        clone.querySelectorAll('[data-rp-spot-priority], [data-rp-ranking-cancel], [data-rp-ranking-session-action], [data-rp-snapshot-exclude]').forEach((node) => {
          node.style.setProperty('display', 'none', 'important');
        });
        clone.querySelectorAll('.rp-ranking-access-summary-head span').forEach((node) => {
          node.style.setProperty('display', 'none', 'important');
        });
        clone.querySelectorAll('.rp-ranking-access-summary-head').forEach((node) => {
          node.style.setProperty('justify-content', 'flex-end', 'important');
        });

        clone.querySelectorAll(
          '[data-rp-ranking-secured], [data-rp-ranking-standby-roster], [data-rp-ranking-secured-list], [data-rp-ranking-standby-list]'
        ).forEach((node) => {
          node.style.setProperty('height', 'auto', 'important');
          node.style.setProperty('max-height', 'none', 'important');
          node.style.setProperty('overflow', 'visible', 'important');
        });
      },
    });

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  }

  async function renderSnapshot() {
    const source = sourceNode();
    if (!source) throw new Error('Open Rank reservation is not available.');

    await waitForStableFonts();

    // Capture mode changes only export-only details: it removes utility
    // controls, formats the roster headers, and gives the display font enough
    // line box to avoid clipped glyphs. The live Open Rank UI is restored after capture.
    const restoreSnapshotHeaders = prepareSnapshotRosterHeaders(source);
    source.classList.add('rp-snapshot-capture-mode');
    source.setAttribute(SOURCE_ATTR, 'true');

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

      const rect = source.getBoundingClientRect();
      const width = Math.max(300, Math.ceil(rect.width || source.offsetWidth || 360));
      const height = Math.max(1, Math.ceil(source.scrollHeight || rect.height || source.offsetHeight || 1));

      try {
        const blob = await renderWithDomToImage(source, width, height);
        if (blob) return blob;
      } catch (primaryError) {
        console.warn('[Real Play] Browser-native reservation renderer failed; using compatibility renderer.', primaryError);
      }

      const fallbackBlob = await renderWithHtml2Canvas(source, width, height);
      if (!fallbackBlob) throw new Error('The reservation image could not be created.');
      return fallbackBlob;
    } finally {
      source.classList.remove('rp-snapshot-capture-mode');
      source.removeAttribute(SOURCE_ATTR);
      restoreSnapshotHeaders();
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
    if (navigator.canShare && !navigator.canShare({ files:[file] })) return false;
    await navigator.share({
      title:'Real Play Open Rank',
      text:'Current Real Play Open Rank reservation.',
      files:[file],
    });
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
          <div><small>EXACT LIVE CARD</small><strong>RESERVATION SNAPSHOT</strong></div>
          <button class="rp-snapshot-preview-close" type="button" aria-label="Close snapshot">×</button>
        </header>
        <div class="rp-snapshot-preview-image">
          <img src="${previewUrl}" alt="Current Open Rank reservation snapshot">
        </div>
        <p class="rp-snapshot-preview-hint">Scroll the preview to inspect the full roster · saved image stays full resolution</p>
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
            showToast('Sharing unavailable here · image saved instead.', 2200);
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
    showToast('Capturing exact live reservation…', 1800);
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
      if (
        Math.abs(event.clientX - holdStart.x) > MOVE_TOLERANCE
        || Math.abs(event.clientY - holdStart.y) > MOVE_TOLERANCE
      ) cleanupHold();
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