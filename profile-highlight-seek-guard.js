(() => {
  if (window.__realPlayHighlightSeekGuardInstalled) return;
  window.__realPlayHighlightSeekGuardInstalled = true;

  function viewer() {
    return document.querySelector('.rp-highlight-viewer.open');
  }

  function setSeekReady(ready, targetSeconds) {
    const root = viewer();
    if (!root) return;
    root.dataset.rpHighlightSeekReady = ready ? '1' : '0';
    if (Number.isFinite(Number(targetSeconds))) {
      root.dataset.rpHighlightTargetMs = String(Math.max(0, Math.round(Number(targetSeconds) * 1000)));
    }
  }

  function patchPlayer() {
    if (!window.YT?.Player) return false;
    if (window.YT.Player.__realPlaySeekGuardWrapped) return true;

    const OriginalPlayer = window.YT.Player;

    function GuardedPlayer(...args) {
      const player = new OriginalPlayer(...args);
      let pendingPlay = false;
      let seekGeneration = 0;

      const originalSeekTo = typeof player.seekTo === 'function' ? player.seekTo.bind(player) : null;
      const originalPlayVideo = typeof player.playVideo === 'function' ? player.playVideo.bind(player) : null;
      const originalPauseVideo = typeof player.pauseVideo === 'function' ? player.pauseVideo.bind(player) : null;
      const originalGetCurrentTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime.bind(player) : null;

      // The iframe can appear before the official highlight timestamp has been
      // applied. Block every play request until Real Play has actually sought to
      // the selected highlight start.
      setSeekReady(false, 0);

      if (originalPlayVideo) {
        player.playVideo = function guardedPlayVideo() {
          const root = viewer();
          if (root?.dataset?.rpHighlightSeekReady === '0') {
            pendingPlay = true;
            return;
          }
          pendingPlay = false;
          return originalPlayVideo();
        };
      }

      if (originalPauseVideo) {
        player.pauseVideo = function guardedPauseVideo() {
          pendingPlay = false;
          return originalPauseVideo();
        };
      }

      if (originalSeekTo) {
        player.seekTo = function guardedSeekTo(seconds, allowSeekAhead) {
          const target = Math.max(0, Number(seconds) || 0);
          const generation = ++seekGeneration;
          setSeekReady(false, target);

          // If an autoplay attempt started the iframe at 0:00, stop it before
          // applying the authoritative highlight timestamp.
          try { originalPauseVideo?.(); } catch (_) {}

          const result = originalSeekTo(target, allowSeekAhead);
          const startedAt = Date.now();

          const confirmSeek = () => {
            if (generation !== seekGeneration) return;
            let current = NaN;
            try { current = Number(originalGetCurrentTime?.()); } catch (_) {}

            const closeEnough = Number.isFinite(current) && Math.abs(current - target) <= 1.1;
            const timedOut = Date.now() - startedAt >= 1600;
            if (!closeEnough && !timedOut) {
              window.setTimeout(confirmSeek, 45);
              return;
            }

            setSeekReady(true, target);
            if (pendingPlay) {
              pendingPlay = false;
              try { originalPlayVideo?.(); } catch (_) {}
            }

            try {
              window.dispatchEvent(new CustomEvent('realplay:highlight-seek-ready', {
                detail: { targetSeconds: target }
              }));
            } catch (_) {}
          };

          window.setTimeout(confirmSeek, 35);
          return result;
        };
      }

      return player;
    }

    try { Object.setPrototypeOf(GuardedPlayer, OriginalPlayer); } catch (_) {}
    try { GuardedPlayer.prototype = OriginalPlayer.prototype; } catch (_) {}
    try { Object.defineProperty(GuardedPlayer, '__realPlaySeekGuardWrapped', { value: true }); } catch (_) {
      GuardedPlayer.__realPlaySeekGuardWrapped = true;
    }

    window.YT.Player = GuardedPlayer;
    return true;
  }

  function install() {
    if (patchPlayer()) return;

    // Real Play's YouTube loader preserves any previous iframe-ready callback,
    // so installing this first guarantees the constructor is wrapped before the
    // highlight player is created.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { patchPlayer(); } catch (_) {}
      try { previous?.(); } catch (_) {}
    };

    const started = Date.now();
    const poll = window.setInterval(() => {
      if (patchPlayer() || Date.now() - started > 15000) window.clearInterval(poll);
    }, 50);
  }

  install();
})();