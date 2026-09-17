(() => {
  if (window.__realPlayReplaySafariCoverV3Installed) return;
  window.__realPlayReplaySafariCoverV3Installed = true;

  const ua = String(navigator.userAgent || '');
  const isIPhoneFamily = /iPhone|iPod/i.test(ua);
  if (!isIPhoneFamily) return;

  const PSEUDO_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const snapshots = new WeakMap();
  let activeStage = null;
  let raf = 0;

  function remember(node) {
    if (!node || snapshots.has(node)) return;
    snapshots.set(node, node.getAttribute('style'));
  }

  function restore(node) {
    if (!node || !snapshots.has(node)) return;
    const original = snapshots.get(node);
    if (original === null) node.removeAttribute('style');
    else node.setAttribute('style', original);
    snapshots.delete(node);
  }

  function setImportant(node, property, value) {
    if (!node) return;
    remember(node);
    node.style.setProperty(property, value, 'important');
  }

  function currentStage() {
    return document.querySelector(`[data-rp-career-replay-stage].${PSEUDO_CLASS}`);
  }

  function restoreStage(stage) {
    if (!stage) return;
    const media = stage.querySelector('[data-rp-career-replay-media]');
    const child = media?.firstElementChild || null;
    const iframe = media?.querySelector('iframe') || null;
    const video = media?.querySelector('video') || null;
    const nodes = [...new Set([video, iframe, child, media].filter(Boolean))];
    nodes.forEach(restore);
  }

  function coverStageMedia(stage) {
    if (!stage?.isConnected || !stage.classList.contains(PSEUDO_CLASS)) return;

    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Number(rect.width || window.visualViewport?.width || window.innerWidth || 1));
    const height = Math.max(1, Number(rect.height || window.visualViewport?.height || window.innerHeight || 1));

    const media = stage.querySelector('[data-rp-career-replay-media]');
    if (!media) return;

    const child = media.firstElementChild || null;
    const iframe = media.querySelector('iframe');
    const video = media.querySelector('video');
    const target = video || iframe;
    if (!target) return;

    // The base replay stylesheet intentionally uses width/height:100%!important.
    // On iPhone pseudo-fullscreen that keeps a 16:9 YouTube iframe letterboxed
    // inside the very wide landscape viewport. Use inline !important dimensions
    // only AFTER pseudo-fullscreen is active so the media behaves like cover.
    const aspect = 16 / 9;
    let mediaWidth = width;
    let mediaHeight = width / aspect;
    if (mediaHeight < height) {
      mediaHeight = height;
      mediaWidth = height * aspect;
    }

    setImportant(media, 'position', 'absolute');
    setImportant(media, 'inset', '0');
    setImportant(media, 'width', '100%');
    setImportant(media, 'height', '100%');
    setImportant(media, 'overflow', 'hidden');
    setImportant(media, 'background', '#000');

    if (child && child !== target) {
      setImportant(child, 'position', 'absolute');
      setImportant(child, 'inset', '0');
      setImportant(child, 'width', '100%');
      setImportant(child, 'height', '100%');
      setImportant(child, 'overflow', 'hidden');
      setImportant(child, 'background', '#000');
    }

    setImportant(target, 'position', 'absolute');
    setImportant(target, 'left', '50%');
    setImportant(target, 'top', '50%');
    setImportant(target, 'right', 'auto');
    setImportant(target, 'bottom', 'auto');
    setImportant(target, 'inset', 'auto');
    setImportant(target, 'width', `${Math.ceil(mediaWidth)}px`);
    setImportant(target, 'height', `${Math.ceil(mediaHeight)}px`);
    setImportant(target, 'min-width', '0');
    setImportant(target, 'min-height', '0');
    setImportant(target, 'max-width', 'none');
    setImportant(target, 'max-height', 'none');
    setImportant(target, 'margin', '0');
    setImportant(target, 'border', '0');
    setImportant(target, 'transform', 'translate3d(-50%,-50%,0)');
    setImportant(target, '-webkit-transform', 'translate3d(-50%,-50%,0)');
    setImportant(target, 'background', '#000');

    if (video) setImportant(video, 'object-fit', 'cover');
  }

  function syncNow() {
    raf = 0;
    const nextStage = currentStage();

    if (activeStage && activeStage !== nextStage) {
      restoreStage(activeStage);
      activeStage = null;
    }

    if (!nextStage) return;
    activeStage = nextStage;
    coverStageMedia(nextStage);
  }

  function scheduleSync() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncNow);
  }

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', () => {
    scheduleSync();
    window.setTimeout(scheduleSync, 100);
    window.setTimeout(scheduleSync, 300);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList' || record.type === 'attributes')) {
      scheduleSync();
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-rp-career-replay-pseudo-fullscreen'],
  });

  scheduleSync();
})();
