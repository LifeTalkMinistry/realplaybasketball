(() => {
  if (window.__realPlayIPhoneHighlightOrientationInstalled) return;
  window.__realPlayIPhoneHighlightOrientationInstalled = true;

  const ua = String(navigator.userAgent || '');
  const isIPhone = /iPhone|iPod/i.test(ua);
  if (!isIPhone) return;

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

  function landscape() {
    const legacy = Number(window.orientation);
    if (Number.isFinite(legacy) && Math.abs(legacy) === 90) return true;
    if (window.matchMedia) {
      try { return window.matchMedia('(orientation: landscape)').matches; } catch (_) {}
    }
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

  function finishHighlightReturn(root) {
    endingHighlight = true;
    landscapeDismissed = true;
    requestPortraitWhenPossible();
    exitNativeVideo();
    exitDocumentFullscreen();
    root?.classList.add('rp-ios-highlight-return');

    // The native player is gone; the normal Real Play shell owns the completed
    // highlight again and keeps NEXT HIGHLIGHT under the player's control.
    window.setTimeout(() => {
      const current = viewer();
      if (!current) return;
      current.classList.add('rp-ios-highlight-return');
      const end = current.querySelector('[data-rp-highlight-end]');
      if (end && !end.hidden) end.scrollIntoView?.({ block: 'center', inline: 'center' });
    }, 80);
  }

  function bindVideo(video) {
    if (!video || video === activeVideo) return;
    activeVideo = video;
    nativeFullscreen = false;

    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

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
      // If the player manually dismisses native fullscreen while still holding
      // the phone sideways, do not trap them by immediately reopening it.
      if (landscape()) landscapeDismissed = true;
    });

    video.addEventListener('play', () => {
      if (landscape() && !endingHighlight && !landscapeDismissed) {
        window.setTimeout(syncOrientation, 0);
      }
    });
  }

  function enterNativeVideo(video, root) {
    if (!video || !root || endingHighlight || highlightComplete(root) || !landscape() || landscapeDismissed) return false;
    if (video.webkitDisplayingFullscreen || nativeFullscreen) return true;

    handoffTime = Math.max(0, Number(video.currentTime) || 0);
    handoffWasPlaying = !video.paused;

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
    return false;
  }

  function enterYouTubeFullscreen(frame, root) {
    if (!frame || !root || endingHighlight || highlightComplete(root) || !landscape() || landscapeDismissed || iframeFullscreenPending) return false;
    if (document.fullscreenElement || document.webkitFullscreenElement) return true;

    // Keep the exact same iframe/player instance. If iOS allows iframe
    // fullscreen here, playback continues at the current YouTube timestamp
    // instead of rebuilding or restarting the video.
    frame.setAttribute('allowfullscreen', '');
    const previousAllow = String(frame.getAttribute('allow') || '');
    if (!/fullscreen/i.test(previousAllow)) {
      frame.setAttribute('allow', `${previousAllow}${previousAllow ? '; ' : ''}autoplay; fullscreen; picture-in-picture`);
    }

    iframeFullscreenPending = true;
    try {
      const request = frame.requestFullscreen?.() || frame.webkitRequestFullscreen?.();
      if (request?.then) request.catch(() => {}).finally(() => { iframeFullscreenPending = false; });
      else window.setTimeout(() => { iframeFullscreenPending = false; }, 300);
      return Boolean(request || document.fullscreenElement || document.webkitFullscreenElement);
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
      root.classList.remove('rp-ios-highlight-return');
    }

    if (!landscape()) {
      landscapeDismissed = false;
      if (!complete) endingHighlight = false;
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
    if (frame) enterYouTubeFullscreen(frame, root);
  }

  function scheduleOrientationSync() {
    if (orientationTimer) window.clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(() => {
      orientationTimer = 0;
      syncOrientation();
    }, 120);
  }

  function installStyle() {
    if (document.querySelector('[data-rp-ios-highlight-orientation-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpIosHighlightOrientationStyle = '1';
    style.textContent = `
      @media (orientation:landscape){
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
    if (document.body) observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
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