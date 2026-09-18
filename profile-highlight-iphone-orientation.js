(() => {
  if (window.__realPlayIPhoneHighlightOrientationInstalled) return;
  window.__realPlayIPhoneHighlightOrientationInstalled = true;

  const ua = String(navigator.userAgent || '');
  const platform = String(navigator.platform || '');
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const isTouchIOS = /iPhone|iPod|iPad/i.test(ua)
    || ((/Macintosh/i.test(ua) || platform === 'MacIntel') && touchPoints > 1);
  if (!isTouchIOS) return;

  let orientationTimer = 0;
  let activeVideo = null;
  let nativeFullscreen = false;
  let handoffTime = 0;
  let handoffWasPlaying = false;
  let landscapeDismissed = false;
  let endVisible = false;
  let endingHighlight = false;
  let iframeFullscreenPending = false;

  function viewer() {
    return document.querySelector('.rp-highlight-viewer.open');
  }

  function isLandscape() {
    const legacy = Number(window.orientation);
    if (Number.isFinite(legacy) && Math.abs(legacy) === 90) return true;
    try {
      if (window.matchMedia) return window.matchMedia('(orientation: landscape)').matches;
    } catch (_) {}
    return window.innerWidth > window.innerHeight;
  }

  function highlightComplete(root) {
    const end = root?.querySelector('[data-rp-highlight-end]');
    return Boolean(end && !end.hidden);
  }

  function currentVideo(root) {
    return root?.querySelector('[data-rp-highlight-media] video') || null;
  }

  function currentYouTubeFrame(root) {
    const frame = root?.querySelector('[data-rp-highlight-media] iframe');
    if (!frame) return null;
    const src = String(frame.getAttribute('src') || '');
    return /youtube(?:-nocookie)?\.com|youtu\.be/i.test(src) ? frame : null;
  }

  function setVideoInline(video, inline) {
    if (!video) return;
    try { video.playsInline = Boolean(inline); } catch (_) {}
    if (inline) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.controls = false;
      video.removeAttribute('controls');
    } else {
      video.removeAttribute('playsinline');
      video.removeAttribute('webkit-playsinline');
      video.controls = true;
      video.setAttribute('controls', '');
    }
  }

  function requestPortraitWhenPossible() {
    try {
      const lock = window.screen?.orientation?.lock;
      if (typeof lock === 'function') {
        Promise.resolve(lock.call(window.screen.orientation, 'portrait')).catch(() => {});
      }
    } catch (_) {}
  }

  function exitDocumentFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        Promise.resolve(document.exitFullscreen()).catch(() => {});
        return;
      }
      if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (_) {}
  }

  function exitNativeVideo(video = activeVideo) {
    if (!video) return;
    try {
      if (video.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === 'function') {
        video.webkitExitFullscreen();
      }
    } catch (_) {}
  }

  function enterVideoOnlyMode(root, video) {
    if (!root) return;
    root.classList.add('rp-ios-video-only');
    root.classList.remove('rp-ios-highlight-return');
    document.documentElement.classList.add('rp-ios-highlight-video-only');
    document.body?.classList.add('rp-ios-highlight-video-only');
    if (video) setVideoInline(video, false);
  }

  function leaveVideoOnlyMode(root, video) {
    if (!root) return;
    root.classList.remove('rp-ios-video-only');
    document.documentElement.classList.remove('rp-ios-highlight-video-only');
    document.body?.classList.remove('rp-ios-highlight-video-only');
    if (video) setVideoInline(video, true);
  }

  function finishHighlightReturn(root) {
    if (!root) return;
    endingHighlight = true;
    landscapeDismissed = true;

    const video = currentVideo(root) || activeVideo;
    leaveVideoOnlyMode(root, video);
    requestPortraitWhenPossible();
    exitNativeVideo(video);
    exitDocumentFullscreen();
    root.classList.remove('rp-ios-highlight-landscape');
    root.classList.add('rp-ios-highlight-return');

    window.setTimeout(() => {
      const current = viewer();
      if (!current) return;
      current.classList.remove('rp-ios-video-only', 'rp-ios-highlight-landscape');
      current.classList.add('rp-ios-highlight-return');
      document.documentElement.classList.remove('rp-ios-highlight-video-only');
      document.body?.classList.remove('rp-ios-highlight-video-only');
      const end = current.querySelector('[data-rp-highlight-end]');
      if (end && !end.hidden) end.scrollIntoView?.({ block: 'center', inline: 'center' });
    }, 60);
  }

  function bindVideo(video) {
    if (!video || video === activeVideo) return;
    activeVideo = video;
    nativeFullscreen = false;
    setVideoInline(video, true);

    video.addEventListener('webkitbeginfullscreen', () => {
      nativeFullscreen = true;
      landscapeDismissed = false;
      const expected = Math.max(0, Number(handoffTime) || 0);
      window.setTimeout(() => {
        if (activeVideo !== video) return;
        try {
          if (Math.abs(Number(video.currentTime || 0) - expected) > 0.35) video.currentTime = expected;
        } catch (_) {}
        if (handoffWasPlaying && !endingHighlight) {
          try { video.play().catch(() => {}); } catch (_) {}
        }
      }, 0);
    });

    video.addEventListener('webkitendfullscreen', () => {
      nativeFullscreen = false;
      if (endingHighlight) return;
      if (isLandscape()) landscapeDismissed = true;
    });

    video.addEventListener('play', () => {
      if (isLandscape() && !endingHighlight && !landscapeDismissed) {
        window.setTimeout(syncOrientation, 0);
      }
    });
  }

  function enterNativeVideo(video, root) {
    if (!video || !root || endingHighlight || highlightComplete(root) || !isLandscape()) return false;
    if (video.webkitDisplayingFullscreen || nativeFullscreen) return true;

    handoffTime = Math.max(0, Number(video.currentTime) || 0);
    handoffWasPlaying = !video.paused;
    enterVideoOnlyMode(root, video);

    try {
      if (typeof video.webkitEnterFullscreen === 'function') {
        video.webkitEnterFullscreen();
        return true;
      }
      if (typeof video.webkitEnterFullScreen === 'function') {
        video.webkitEnterFullScreen();
        return true;
      }
    } catch (_) {}

    try {
      if (typeof video.requestFullscreen === 'function') {
        Promise.resolve(video.requestFullscreen()).catch(() => {});
        return true;
      }
    } catch (_) {}

    try {
      if (handoffWasPlaying && video.paused) video.play().catch(() => {});
    } catch (_) {}
    return false;
  }

  function enterYouTubeFullscreen(frame, root) {
    if (!frame || !root || endingHighlight || highlightComplete(root) || !isLandscape()) return false;

    // The YouTube iframe hides its underlying HTML5 video from the parent page,
    // so iOS will not let Real Play directly call webkitEnterFullscreen on that
    // hidden video. The guaranteed fallback is a true video-only landscape view:
    // no Real Play chrome, same iframe instance, same current timeline.
    enterVideoOnlyMode(root, null);
    frame.setAttribute('allowfullscreen', '');
    const previousAllow = String(frame.getAttribute('allow') || '');
    if (!/fullscreen/i.test(previousAllow)) {
      frame.setAttribute('allow', `${previousAllow}${previousAllow ? '; ' : ''}autoplay; fullscreen; picture-in-picture`);
    }

    if (document.fullscreenElement || document.webkitFullscreenElement || iframeFullscreenPending) return true;
    iframeFullscreenPending = true;
    try {
      const request = frame.requestFullscreen?.() || frame.webkitRequestFullscreen?.();
      if (request?.then) {
        request.catch(() => {}).finally(() => { iframeFullscreenPending = false; });
      } else {
        window.setTimeout(() => { iframeFullscreenPending = false; }, 350);
      }
      return true;
    } catch (_) {
      iframeFullscreenPending = false;
      return false;
    }
  }

  function syncOrientation() {
    const root = viewer();
    if (!root || root.classList.contains('choosing')) return;

    const video = currentVideo(root);
    if (video) bindVideo(video);

    const complete = highlightComplete(root);
    if (complete && !endVisible) {
      endVisible = true;
      finishHighlightReturn(root);
      return;
    }

    if (!complete && endVisible) {
      endVisible = false;
      endingHighlight = false;
      landscapeDismissed = false;
      root.classList.remove('rp-ios-highlight-return');
    }

    if (!isLandscape()) {
      landscapeDismissed = false;
      if (!complete) endingHighlight = false;
      leaveVideoOnlyMode(root, video);
      exitNativeVideo(video);
      exitDocumentFullscreen();
      root.classList.remove('rp-ios-highlight-landscape');
      return;
    }

    if (complete) return;
    root.classList.add('rp-ios-highlight-landscape');

    if (video) {
      enterNativeVideo(video, root);
      return;
    }

    const frame = currentYouTubeFrame(root);
    if (frame) {
      enterYouTubeFullscreen(frame, root);
      return;
    }

    // If Safari changes the YouTube iframe URL shape or mounts media a frame
    // later, still remove the app shell immediately on rotation. The observer
    // will sync again as soon as the media element appears.
    enterVideoOnlyMode(root, null);
  }

  function scheduleOrientationSync() {
    if (orientationTimer) window.clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(() => {
      orientationTimer = 0;
      syncOrientation();
    }, 60);
  }

  function installStyle() {
    if (document.querySelector('[data-rp-ios-highlight-orientation-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpIosHighlightOrientationStyle = '1';
    style.textContent = `
      html.rp-ios-highlight-video-only,
      html.rp-ios-highlight-video-only body{
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
        background:#000!important;
      }
      html.rp-ios-highlight-video-only body>*:not(.rp-highlight-viewer){
        visibility:hidden!important;
        pointer-events:none!important;
      }
      .rp-highlight-viewer.rp-ios-video-only{
        display:block!important;
        position:fixed!important;
        inset:0!important;
        width:100vw!important;
        height:100dvh!important;
        margin:0!important;
        padding:0!important;
        background:#000!important;
        z-index:2147483646!important;
      }
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-stage{
        position:fixed!important;
        inset:0!important;
        width:100vw!important;
        height:100dvh!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
        background:#000!important;
      }
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-stage::after,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-topbar,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-event,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-play,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-end,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-empty,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-loading,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-picker{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media>div,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media video,
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media iframe{
        display:block!important;
        visibility:visible!important;
        position:fixed!important;
        inset:0!important;
        width:100vw!important;
        height:100dvh!important;
        max-width:none!important;
        max-height:none!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:#000!important;
        transform:none!important;
      }
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media video{
        object-fit:contain!important;
      }
      .rp-highlight-viewer.rp-ios-video-only .rp-highlight-media iframe{
        pointer-events:auto!important;
      }
      @media (orientation:landscape){
        html.rp-ios-highlight-video-only .rp-highlight-viewer.open:not(.choosing){
          background:#000!important;
        }
        .rp-highlight-viewer.rp-ios-highlight-return .rp-highlight-end{
          left:50%!important;
          top:50%!important;
          bottom:auto!important;
          width:min(430px,78vw)!important;
          transform:translate(-50%,-50%)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const observer = new MutationObserver(() => scheduleOrientationSync());

  function start() {
    installStyle();
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
      });
    }
    scheduleOrientationSync();
  }

  window.addEventListener('orientationchange', scheduleOrientationSync, true);
  window.addEventListener('resize', scheduleOrientationSync, true);
  window.addEventListener('pageshow', scheduleOrientationSync, true);
  document.addEventListener('fullscreenchange', scheduleOrientationSync, true);
  document.addEventListener('webkitfullscreenchange', scheduleOrientationSync, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();