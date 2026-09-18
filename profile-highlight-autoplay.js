(() => {
  if (window.__realPlayHighlightAutoplayInstalled) return;
  window.__realPlayHighlightAutoplayInstalled = true;

  const ua = String(navigator.userAgent || '');
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1);

  let intentId = 0;
  let intentUntil = 0;
  let timers = [];
  const youtubePlaying = new WeakSet();

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  }

  function viewer() {
    return document.querySelector('.rp-highlight-viewer.open');
  }

  function highlightIsPlayable(root) {
    if (!root || root.classList.contains('choosing')) return false;
    const end = root.querySelector('[data-rp-highlight-end]');
    if (end && !end.hidden) return false;
    return true;
  }

  function youtubeFrame(root) {
    const frame = root?.querySelector('[data-rp-highlight-media] iframe');
    if (!frame) return null;
    const src = String(frame.getAttribute('src') || '');
    return /youtube(?:-nocookie)?\.com|youtu\.be/i.test(src) ? frame : null;
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

    const video = root.querySelector('[data-rp-highlight-media] video');
    if (video) {
      attemptDirectVideo(video, isIOS && attempt >= 2);
      if (!video.paused) return;
    }

    const frame = youtubeFrame(root);
    if (frame) {
      ensureAutoplayPermission(frame);
      if (youtubePlaying.has(frame)) return;

      // First preserve sound and ask YouTube to play. iPhone Safari can reject
      // that after the async iframe/player setup, so the later attempts fall
      // back to muted autoplay rather than making the player tap Play again.
      if (isIOS && attempt >= 2) sendYouTube(frame, 'mute');
      sendYouTube(frame, 'playVideo');
    }
  }

  function requestAutoplay() {
    const id = ++intentId;
    intentUntil = Date.now() + 6500;
    clearTimers();

    [0, 80, 180, 360, 700, 1200, 2000, 3200, 5000].forEach((delay, index) => {
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
    if (Number(playerState) === 1) youtubePlaying.add(frame);
    else if (Number.isFinite(Number(playerState))) youtubePlaying.delete(frame);
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(
      '[data-rp-highlight-filter], [data-rp-highlight-next], [data-rp-highlight-replay]'
    );
    if (!trigger) return;
    requestAutoplay();
  }, true);

  // Media is mounted asynchronously after the category tap. Keep watching only
  // during the short autoplay intent window so a deliberate later pause is not
  // overridden.
  const observer = new MutationObserver(() => {
    if (Date.now() <= intentUntil) attemptAutoplay(intentId, 1);
  });

  function start() {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();