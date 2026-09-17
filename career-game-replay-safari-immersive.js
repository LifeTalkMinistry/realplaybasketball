(() => {
  if (window.__realPlayReplaySafariImmersiveInstalled) return;
  window.__realPlayReplaySafariImmersiveInstalled = true;

  const ua = String(navigator.userAgent || '');
  const isIPhoneFamily = /iPhone|iPod/i.test(ua);
  if (!isIPhoneFamily) return;

  const PSEUDO_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const OPEN_CLASS = 'rp-career-replay-ios-immersive-open';
  const ACTIVE_CLASS = 'rp-career-replay-ios-immersive';
  let activeStage = null;
  let raf = 0;

  const style = document.createElement('style');
  style.id = 'rp-career-replay-safari-immersive-style';
  style.textContent = `
    html.${OPEN_CLASS},
    body.${OPEN_CLASS}{
      width:100%!important;
      height:100%!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      overscroll-behavior:none!important;
      background:#000!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS}{
      position:fixed!important;
      z-index:2147483646!important;
      left:var(--rp-replay-vv-left,0px)!important;
      top:var(--rp-replay-vv-top,0px)!important;
      right:auto!important;
      bottom:auto!important;
      width:var(--rp-replay-vv-width,100vw)!important;
      height:var(--rp-replay-vv-height,100dvh)!important;
      min-width:0!important;
      min-height:0!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      aspect-ratio:auto!important;
      overflow:hidden!important;
      background:#000!important;
      box-shadow:none!important;
      transform:none!important;
      -webkit-transform:none!important;
      contain:layout paint!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS} [data-rp-career-replay-media],
    .rp-career-replay-stage.${ACTIVE_CLASS} [data-rp-career-replay-media] > div,
    .rp-career-replay-stage.${ACTIVE_CLASS} .rp-career-replay-yt-host{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      background:#000!important;
    }

    /* Safari on iPhone cannot give a normal HTML container true browser-level
       fullscreen. In the in-page fallback, make the 16:9 replay COVER every
       pixel of Safari's usable visual viewport instead of leaving side bars. */
    .rp-career-replay-stage.${ACTIVE_CLASS} iframe,
    .rp-career-replay-stage.${ACTIVE_CLASS} video{
      position:absolute!important;
      left:50%!important;
      top:50%!important;
      right:auto!important;
      bottom:auto!important;
      width:var(--rp-replay-media-width,100vw)!important;
      height:var(--rp-replay-media-height,100dvh)!important;
      min-width:100%!important;
      min-height:100%!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      border:0!important;
      transform:translate3d(-50%,-50%,0)!important;
      -webkit-transform:translate3d(-50%,-50%,0)!important;
      background:#000!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS} video{
      object-fit:cover!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS} .rp-career-replay-fullscreen-back{
      top:max(10px,env(safe-area-inset-top))!important;
      left:max(10px,env(safe-area-inset-left))!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS} .rp-career-replay-expand-fixed{
      top:max(8px,env(safe-area-inset-top))!important;
      right:max(8px,env(safe-area-inset-right))!important;
    }

    .rp-career-replay-stage.${ACTIVE_CLASS} .rp-career-replay-fullscreen-marker-rail{
      bottom:max(10px,env(safe-area-inset-bottom))!important;
    }
  `;
  document.head.appendChild(style);

  function viewportBox() {
    const vv = window.visualViewport;
    const width = Math.max(1, Number(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Number(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const left = Math.max(0, Number(vv?.offsetLeft || 0));
    const top = Math.max(0, Number(vv?.offsetTop || 0));
    return { width, height, left, top };
  }

  function syncGeometry() {
    raf = 0;
    if (!activeStage || !activeStage.isConnected || !activeStage.classList.contains(PSEUDO_CLASS)) {
      deactivate();
      return;
    }

    const { width, height, left, top } = viewportBox();
    const aspect = 16 / 9;
    let mediaWidth = width;
    let mediaHeight = width / aspect;
    if (mediaHeight < height) {
      mediaHeight = height;
      mediaWidth = height * aspect;
    }

    activeStage.style.setProperty('--rp-replay-vv-width', `${Math.ceil(width)}px`);
    activeStage.style.setProperty('--rp-replay-vv-height', `${Math.ceil(height)}px`);
    activeStage.style.setProperty('--rp-replay-vv-left', `${Math.floor(left)}px`);
    activeStage.style.setProperty('--rp-replay-vv-top', `${Math.floor(top)}px`);
    activeStage.style.setProperty('--rp-replay-media-width', `${Math.ceil(mediaWidth)}px`);
    activeStage.style.setProperty('--rp-replay-media-height', `${Math.ceil(mediaHeight)}px`);
  }

  function scheduleSync() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncGeometry);
  }

  function activate(stage) {
    if (!stage) return;
    if (activeStage && activeStage !== stage) deactivate();
    activeStage = stage;
    stage.classList.add(ACTIVE_CLASS);
    document.documentElement.classList.add(OPEN_CLASS);
    document.body.classList.add(OPEN_CLASS);
    scheduleSync();
    window.setTimeout(scheduleSync, 60);
    window.setTimeout(scheduleSync, 260);
  }

  function deactivate() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (activeStage) {
      activeStage.classList.remove(ACTIVE_CLASS);
      activeStage.style.removeProperty('--rp-replay-vv-width');
      activeStage.style.removeProperty('--rp-replay-vv-height');
      activeStage.style.removeProperty('--rp-replay-vv-left');
      activeStage.style.removeProperty('--rp-replay-vv-top');
      activeStage.style.removeProperty('--rp-replay-media-width');
      activeStage.style.removeProperty('--rp-replay-media-height');
    }
    activeStage = null;
    document.documentElement.classList.remove(OPEN_CLASS);
    document.body.classList.remove(OPEN_CLASS);
  }

  function inspect() {
    const stage = document.querySelector(`.rp-career-replay-stage.${PSEUDO_CLASS}`);
    if (stage) activate(stage);
    else if (activeStage) deactivate();
  }

  const observer = new MutationObserver(inspect);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-rp-career-replay-pseudo-fullscreen'],
  });

  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', () => {
    scheduleSync();
    window.setTimeout(scheduleSync, 120);
    window.setTimeout(scheduleSync, 420);
  }, { passive: true });

  inspect();
})();
