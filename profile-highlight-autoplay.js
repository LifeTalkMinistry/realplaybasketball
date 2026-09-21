(() => {
  if (window.__realPlayHighlightAutoplayInstalled) return;
  window.__realPlayHighlightAutoplayInstalled = true;

  const ua = String(navigator.userAgent || '');
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobileAutoplayRestricted = isIOS || isAndroid;

  let intentId = 0;
  let intentUntil = 0;
  let timers = [];
  const youtubePlaying = new WeakSet();
  const watchedMedia = new WeakSet();

  function loadConsistencyLayer() {
    if (window.__realPlayHighlightConsistencyInstalled || document.querySelector('script[data-rp-highlight-consistency-loader]')) return;
    const script = document.createElement('script');
    script.src = 'profile-highlight-consistency.js?v=20260921-canonical-highlight-v2';
    script.async = false;
    script.dataset.rpHighlightConsistencyLoader = '1';
    script.onerror = () => console.warn('[Real Play] Highlight consistency layer could not load.');
    document.head.appendChild(script);
  }

  function installLoadingFadeStyle() {
    if (document.querySelector('[data-rp-highlight-loading-fade-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHighlightLoadingFadeStyle = '1';
    style.textContent = `
      .rp-highlight-loading{
        opacity:1;
        transition:opacity .18s ease,visibility .18s ease;
        pointer-events:none!important;
      }
      .rp-highlight-loading.rp-highlight-loading-fade{
        opacity:0!important;
        visibility:hidden!important;
      }
      .rp-highlight-loading[hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  }

  function viewer() {
    return document.querySelector('.rp-highlight-viewer.open');
  }

  function loadingNode(root = viewer()) {
    return root?.querySelector('[data-rp-highlight-loading]') || null;
  }

  function resetLoading(root = viewer()) {
    const loading = loadingNode(root);
    if (!loading) return;
    loading.classList.remove('rp-highlight-loading-fade');
    loading.style.removeProperty('display');
  }

  function fadeLoading(root = viewer()) {
    const loading = loadingNode(root);
    if (!loading || loading.hidden || loading.classList.contains('rp-highlight-loading-fade')) return;
    loading.classList.add('rp-highlight-loading-fade');
    window.setTimeout(() => {
      if (!loading.isConnected) return;
      loading.hidden = true;
      loading.style.display = 'none';
    }, 200);
  }

  function highlightIsPlayable(root) {
    if (!root || root.classList.contains('choosing')) return false;
    const end = root.querySelector('[data-rp-highlight-end]');
    if (end && !end.hidden) return false;
    return true;
  }

  function seekReady(root) {
    return Boolean(root && root.dataset.rpHighlightSeekReady === '1');
  }

  function youtubeFrame(root) {
    const frame = root?.querySelector('[data-rp-highlight-media] iframe');
    if (!frame) return null;
    const src = String(frame.getAttribute('src') || '');
    return /youtube(?:-nocookie)?\.com|youtu\.be/i.test(src) ? frame : null;
  }

  function watchMountedMedia(root = viewer()) {
    if (!root) return;

    const video = root.querySelector('[data-rp-highlight-media] video');
    if (video && !watchedMedia.has(video)) {
      watchedMedia.add(video);
      video.addEventListener('seeking', () => {
        root.dataset.rpHighlightSeekReady = '0';
      });
      video.addEventListener('seeked', () => {
        root.dataset.rpHighlightSeekReady = '1';
        try {
          window.dispatchEvent(new CustomEvent('realplay:highlight-seek-ready', {
            detail: { targetSeconds: Math.max(0, Number(video.currentTime) || 0) }
          }));
        } catch (_) {}
      });
      const ready = () => {
        if (seekReady(root)) fadeLoading(root);
      };
      video.addEventListener('loadeddata', ready, { once: true });
      video.addEventListener('canplay', ready, { once: true });
      video.addEventListener('playing', ready, { once: true });
      if (video.readyState >= 2 && seekReady(root)) fadeLoading(root);
    }

    const frame = youtubeFrame(root);
    if (frame && !watchedMedia.has(frame)) {
      watchedMedia.add(frame);
      frame.addEventListener('load', () => {
        window.setTimeout(() => {
          if (seekReady(root)) fadeLoading(root);
        }, 180);
      }, { once: true });
    }
  }

  function sendYouTube(frame, func, args = []) {
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func,
        args,
      }), '*');
    } catch (_) {}
  }

  function ensureAutoplayPermission(frame) {
    if (!frame) return;
    const allow = String(frame.getAttribute('allow') || '');
    const tokens = allow.split(';').map((value) => value.trim()).filter(Boolean);
    ['autoplay', 'fullscreen', 'picture-in-picture'].forEach((token) => {
      if (!tokens.some((value) => value.toLowerCase() === token)) tokens.push(token);
    });
    frame.setAttribute('allow', tokens.join('; '));
    frame.setAttribute('allowfullscreen', '');
  }

  function attemptDirectVideo(video, fallbackMuted) {
    if (!video || !video.paused || video.ended) return true;
    try {
      const promise = video.play();
      if (promise?.catch) {
        promise.catch(() => {
          if (!fallbackMuted || !video.isConnected || !video.paused) return;
          try {
            video.muted = true;
            video.setAttribute('muted', '');
            video.play().catch(() => {});
          } catch (_) {}
        });
      }
      return !video.paused;
    } catch (_) {
      if (!fallbackMuted) return false;
      try {
        video.muted = true;
        video.setAttribute('muted', '');
        video.play().catch(() => {});
      } catch (_) {}
      return false;
    }
  }

  function attemptAutoplay(id, attempt) {
    if (id !== intentId || Date.now() > intentUntil) return;
    const root = viewer();
    if (!highlightIsPlayable(root)) return;

    watchMountedMedia(root);

    // Autoplay waits until the selected highlight timestamp is confirmed.
    // The canonical seek layer owns pre-seek blocking; this helper must never
    // force-pause a user's playback after they press Play.
    if (!seekReady(root)) return;

    const video = root.querySelector('[data-rp-highlight-media] video');
    if (video) {
      attemptDirectVideo(video, isMobileAutoplayRestricted && attempt >= 2);
      if (!video.paused) {
        fadeLoading(root);
        return;
      }
    }

    const frame = youtubeFrame(root);
    if (frame) {
      ensureAutoplayPermission(frame);
      if (youtubePlaying.has(frame)) {
        fadeLoading(root);
        return;
      }

      if (isMobileAutoplayRestricted && attempt >= 2) sendYouTube(frame, 'mute');
      sendYouTube(frame, 'playVideo');
    }
  }

  function requestAutoplay() {
    const root = viewer();
    if (root) root.dataset.rpHighlightSeekReady = '0';

    const id = ++intentId;
    intentUntil = Date.now() + 8000;
    clearTimers();
    resetLoading(root);

    [0, 80, 180, 360, 700, 1200, 2000, 3200, 5000, 7000].forEach((delay, index) => {
      timers.push(window.setTimeout(() => attemptAutoplay(id, index), delay));
    });
  }

  function parseMessage(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (_) { return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  window.addEventListener('message', (event) => {
    const root = viewer();
    const frame = youtubeFrame(root);
    if (!frame || frame.contentWindow !== event.source) return;
    const data = parseMessage(event.data);
    const playerState = data?.info?.playerState ?? (data?.event === 'onStateChange' ? data?.info : undefined);

    if (Number(playerState) === 1) {
      // Do not send pauseVideo here. A PLAYING message can race with the final
      // seek-ready flag, and force-pausing at this layer made the visible Play
      // button immediately pause again. The canonical seek wrapper already
      // prevents playback before the target timestamp is ready.
      if (!seekReady(root)) return;
      youtubePlaying.add(frame);
      fadeLoading(root);
    } else if (Number.isFinite(Number(playerState))) {
      youtubePlaying.delete(frame);
    }
  });

  window.addEventListener('realplay:highlight-seek-ready', () => {
    if (Date.now() <= intentUntil) attemptAutoplay(intentId, 0);
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(
      '[data-rp-highlight-filter], [data-rp-highlight-next], [data-rp-highlight-replay]'
    );
    if (!trigger) return;
    requestAutoplay();
  }, true);

  const observer = new MutationObserver(() => {
    const root = viewer();
    if (root) watchMountedMedia(root);
    if (Date.now() <= intentUntil) attemptAutoplay(intentId, 1);
  });

  function start() {
    loadConsistencyLayer();
    installLoadingFadeStyle();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    watchMountedMedia();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();