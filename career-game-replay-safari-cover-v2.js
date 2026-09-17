(() => {
  if (window.__realPlayReplaySafariCoverV2Installed) return;
  window.__realPlayReplaySafariCoverV2Installed = true;

  const ua = String(navigator.userAgent || '');
  const isAppleTouchSafari = /iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  if (!isAppleTouchSafari) return;

  const PSEUDO_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const snapshots = new WeakMap();
  let activeStage = null;
  let raf = 0;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function currentStage() {
    const native = fullscreenElement();
    if (native?.matches?.('[data-rp-career-replay-stage]')) return native;
    return document.querySelector(`[data-rp-career-replay-stage].${PSEUDO_CLASS}`);
  }

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

  function restoreStage(stage) {
    if (!stage) return;
    const host = stage.querySelector('[data-rp-career-replay-media]');
    const hostChild = host?.firstElementChild || null;
    const iframe = host?.querySelector('iframe');
    const video = host?.querySelector('video');
    [video, iframe, hostChild, host].forEach(restore);
  }

  function cover(stage) {
    if (!stage?.isConnected) return;

    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Number(rect.width || window.visualViewport?.width || window.innerWidth || 1));
    const height = Math.max(1, Number(rect.height || window.visualViewport?.height || window.innerHeight || 1));
    const mediaAspect = 16 / 9;
    const stageAspect = width / height;

    let mediaWidth;
    let mediaHeight;
    if (stageAspect >= mediaAspect) {
      mediaWidth = width;
      mediaHeight = width / mediaAspect;
    } else {
      mediaHeight = height;
      mediaWidth = height * mediaAspect;
    }

    const host = stage.querySelector('[data-rp-career-replay-media]');
    if (!host) return;
    const hostChild = host.firstElementChild;
    const iframe = host.querySelector('iframe');
    const video = host.querySelector('video');
    const target = video || iframe;
    if (!target) return;

    remember(host);
    remember(hostChild);
    remember(target);

    Object.assign(host.style, {
      position: 'absolute',
      inset: '0px',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000',
    });

    if (hostChild && hostChild !== target) {
      Object.assign(hostChild.style, {
        position: 'absolute',
        inset: '0px',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
      });
    }

    Object.assign(target.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      width: `${Math.ceil(mediaWidth)}px`,
      height: `${Math.ceil(mediaHeight)}px`,
      minWidth: '0px',
      minHeight: '0px',
      maxWidth: 'none',
      maxHeight: 'none',
      margin: '0px',
      border: '0px',
      transform: 'translate3d(-50%, -50%, 0)',
      WebkitTransform: 'translate3d(-50%, -50%, 0)',
      background: '#000',
    });

    if (video) video.style.objectFit = 'cover';
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
    cover(nextStage);
  }

  function scheduleSync() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncNow);
  }

  document.addEventListener('fullscreenchange', scheduleSync, true);
  document.addEventListener('webkitfullscreenchange', scheduleSync, true);
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', () => {
    scheduleSync();
    window.setTimeout(scheduleSync, 120);
    window.setTimeout(scheduleSync, 360);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'attributes' || record.type === 'childList')) {
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
