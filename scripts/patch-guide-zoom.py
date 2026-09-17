from pathlib import Path

path = Path('ranking-spot-priority.js')
text = path.read_text(encoding='utf-8')
marker = '__realPlayPriorityGuideZoomInstalled'

if marker in text:
    raise SystemExit(0)

text += r'''

(() => {
  if (window.__realPlayPriorityGuideZoomInstalled) return;
  window.__realPlayPriorityGuideZoomInstalled = true;

  const STYLE_ID = 'rp-priority-guide-zoom-style';
  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function installZoomStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-priority-guide-shell[data-rp-zoom-ready="true"]{overflow:hidden!important}
      .rp-priority-guide-shell[data-rp-zoom-ready="true"] .rp-priority-guide-close{
        position:absolute!important;top:10px!important;right:10px!important;float:none!important;margin:0!important;z-index:8!important;
      }
      .rp-priority-guide-zoom-viewport{
        width:100%;max-height:94dvh;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
        touch-action:pan-x pan-y;scrollbar-width:none;background:#020306;
      }
      .rp-priority-guide-zoom-viewport::-webkit-scrollbar{display:none}
      .rp-priority-guide-zoom-viewport .rp-priority-guide-image{
        display:block!important;width:100%;max-width:none!important;height:auto!important;margin:0;transform:none!important;
        transform-origin:top left;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;
      }
      .rp-priority-guide-zoom-controls{
        position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));z-index:9;display:flex;align-items:center;gap:6px;
        padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(2,8,12,.86);
        box-shadow:0 8px 30px rgba(0,0,0,.38);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);transform:translateX(-50%);
      }
      .rp-priority-guide-zoom-button,.rp-priority-guide-zoom-readout{
        height:34px;min-width:38px;padding:0 10px;border:1px solid rgba(93,216,246,.24);border-radius:999px;
        background:rgba(8,31,43,.88);color:#eaf9fd;font:900 .7rem/1 Arial,sans-serif;appearance:none;-webkit-appearance:none;cursor:pointer;
      }
      .rp-priority-guide-zoom-button{width:38px;padding:0;font-size:1.05rem}
      .rp-priority-guide-zoom-readout{min-width:64px;color:#74e6fb}
      .rp-priority-guide-zoom-button:focus-visible,.rp-priority-guide-zoom-readout:focus-visible{
        outline:2px solid rgba(103,229,252,.55);outline-offset:2px;
      }
      .rp-priority-guide-zoom-hint{
        position:absolute;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 50px);z-index:8;padding:5px 9px;
        border-radius:999px;background:rgba(2,8,12,.72);color:#8296a7;font:800 .52rem/1 Arial,sans-serif;
        letter-spacing:.05em;text-transform:uppercase;pointer-events:none;transform:translateX(-50%);
      }
      @media(max-width:390px){
        .rp-priority-guide-zoom-controls{bottom:max(9px,env(safe-area-inset-bottom));padding:5px}
        .rp-priority-guide-zoom-button,.rp-priority-guide-zoom-readout{height:32px}
        .rp-priority-guide-zoom-button{width:36px;min-width:36px}
        .rp-priority-guide-zoom-readout{min-width:58px;padding:0 8px}
        .rp-priority-guide-zoom-hint{bottom:calc(max(9px,env(safe-area-inset-bottom)) + 46px);font-size:.48rem}
      }
    `;
    document.head.appendChild(style);
  }

  function touchDistance(a, b) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function touchMidpoint(a, b, rect) {
    return {
      x: ((a.clientX + b.clientX) / 2) - rect.left,
      y: ((a.clientY + b.clientY) / 2) - rect.top,
    };
  }

  function enhanceGuideOverlay() {
    const overlay = document.querySelector('[data-rp-priority-guide-overlay]');
    const shell = overlay?.querySelector('.rp-priority-guide-shell');
    const image = overlay?.querySelector('[data-rp-priority-guide-image]');
    if (!overlay || !shell || !image) return false;
    if (shell.dataset.rpZoomReady === 'true') return true;

    installZoomStyles();
    shell.dataset.rpZoomReady = 'true';

    const viewport = document.createElement('div');
    viewport.className = 'rp-priority-guide-zoom-viewport';
    viewport.setAttribute('aria-label', 'Zoomable priority guide image');
    image.parentNode.insertBefore(viewport, image);
    viewport.appendChild(image);

    const controls = document.createElement('div');
    controls.className = 'rp-priority-guide-zoom-controls';
    controls.setAttribute('aria-label', 'Image zoom controls');
    controls.innerHTML = `
      <button class="rp-priority-guide-zoom-button" type="button" data-rp-guide-zoom-out aria-label="Zoom out">−</button>
      <button class="rp-priority-guide-zoom-readout" type="button" data-rp-guide-zoom-reset aria-label="Reset zoom">100%</button>
      <button class="rp-priority-guide-zoom-button" type="button" data-rp-guide-zoom-in aria-label="Zoom in">+</button>
    `;

    const hint = document.createElement('div');
    hint.className = 'rp-priority-guide-zoom-hint';
    hint.textContent = 'Pinch or use + / −';
    shell.appendChild(hint);
    shell.appendChild(controls);

    const readout = controls.querySelector('[data-rp-guide-zoom-reset]');
    const zoomIn = controls.querySelector('[data-rp-guide-zoom-in]');
    const zoomOut = controls.querySelector('[data-rp-guide-zoom-out]');

    let scale = 1;
    let pinch = null;
    let gestureStartScale = 1;

    function updateReadout() {
      if (readout) readout.textContent = `${Math.round(scale * 100)}%`;
      shell.classList.toggle('is-zoomed', scale > 1.001);
    }

    function setScale(nextScale, anchor = null) {
      const next = clamp(Number(nextScale) || 1, MIN_SCALE, MAX_SCALE);
      const old = scale;
      if (Math.abs(next - old) < 0.001) return;

      const x = anchor?.x ?? (viewport.clientWidth / 2);
      const y = anchor?.y ?? (viewport.clientHeight / 2);
      const oldLeft = viewport.scrollLeft;
      const oldTop = viewport.scrollTop;

      scale = next;
      image.style.width = `${scale * 100}%`;
      updateReadout();

      window.requestAnimationFrame(() => {
        const ratio = scale / old;
        viewport.scrollLeft = Math.max(0, ((oldLeft + x) * ratio) - x);
        viewport.scrollTop = Math.max(0, ((oldTop + y) * ratio) - y);
      });
    }

    function resetZoom(scrollTop = true) {
      scale = 1;
      image.style.width = '100%';
      updateReadout();
      viewport.scrollLeft = 0;
      if (scrollTop) viewport.scrollTop = 0;
    }

    zoomIn?.addEventListener('click', () => setScale(scale + 0.5));
    zoomOut?.addEventListener('click', () => setScale(scale - 0.5));
    readout?.addEventListener('click', () => resetZoom(false));

    viewport.addEventListener('dblclick', (event) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      setScale(scale > 1.01 ? 1 : 2, { x:event.clientX - rect.left, y:event.clientY - rect.top });
    });

    viewport.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      setScale(scale * (event.deltaY < 0 ? 1.18 : 0.84), { x:event.clientX - rect.left, y:event.clientY - rect.top });
    }, { passive:false });

    viewport.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return;
      pinch = {
        distance:touchDistance(event.touches[0], event.touches[1]),
        scale,
      };
    }, { passive:true });

    viewport.addEventListener('touchmove', (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const currentDistance = touchDistance(event.touches[0], event.touches[1]);
      if (!currentDistance || !pinch.distance) return;
      const rect = viewport.getBoundingClientRect();
      const center = touchMidpoint(event.touches[0], event.touches[1], rect);
      setScale(pinch.scale * (currentDistance / pinch.distance), center);
    }, { passive:false });

    viewport.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) pinch = null;
    }, { passive:true });
    viewport.addEventListener('touchcancel', () => { pinch = null; }, { passive:true });

    viewport.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      gestureStartScale = scale;
    }, { passive:false });
    viewport.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      setScale(gestureStartScale * Number(event.scale || 1));
    }, { passive:false });
    viewport.addEventListener('gestureend', (event) => event.preventDefault(), { passive:false });

    overlay.querySelector('.rp-priority-guide-close')?.addEventListener('click', () => resetZoom(true));

    const overlayObserver = new MutationObserver(() => {
      if (!overlay.classList.contains('is-open')) resetZoom(true);
    });
    overlayObserver.observe(overlay, { attributes:true, attributeFilter:['class'] });

    updateReadout();
    return true;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-spot-priority-more]')) return;
    window.setTimeout(enhanceGuideOverlay, 0);
  }, true);

  const observer = new MutationObserver(() => enhanceGuideOverlay());
  observer.observe(document.documentElement, { childList:true, subtree:true });
  enhanceGuideOverlay();
})();
'''

path.write_text(text, encoding='utf-8')
