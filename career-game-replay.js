(() => {
  if (window.__realPlayCareerReplayInstalled) return;
  window.__realPlayCareerReplayInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SCORE_POP_MS = 1800;

  let viewer = null;
  let replay = null;
  let directVideo = null;
  let youtubePlayer = null;
  let ticker = null;
  let loadingSessionId = 0;
  let lastCurrentMs = 0;
  let lastDurationMs = 0;
  let lastPlaying = false;
  let lastMuted = false;
  let activeMarkerId = null;
  let decorateTimer = null;
  let stateCache = null;
  let stateCacheAt = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  async function api(path) {
    const auth = token();
    if (!auth) throw new Error('Sign in to Real Play to watch this game.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Replay request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function ensureViewer() {
    if (viewer?.isConnected) return viewer;
    viewer = document.createElement('section');
    viewer.className = 'rp-career-replay';
    viewer.dataset.rpCareerReplay = '1';
    viewer.setAttribute('aria-hidden', 'true');
    viewer.innerHTML = `
      <div class="rp-career-replay-shell">
        <header class="rp-career-replay-topbar">
          <button type="button" class="rp-career-replay-back" data-rp-career-replay-close aria-label="Back to Career">←</button>
          <div class="rp-career-replay-title"><small>FULL GAME REPLAY</small><strong data-rp-career-replay-title>REAL PLAY GAME</strong></div>
          <span class="rp-career-replay-verified">VERIFIED</span>
        </header>
        <main class="rp-career-replay-main" data-rp-career-replay-main>
          <div class="rp-career-replay-loading">SELECT A VERIFIED GAME TO WATCH.</div>
        </main>
      </div>`;
    document.body.appendChild(viewer);
    return viewer;
  }

  function openViewerShell(title = 'REAL PLAY GAME') {
    const root = ensureViewer();
    const titleNode = root.querySelector('[data-rp-career-replay-title]');
    if (titleNode) titleNode.textContent = title;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-career-replay-open');
    root.scrollTop = 0;
  }

  function destroyPlayback() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    if (directVideo) {
      try { directVideo.pause(); } catch (_) {}
      directVideo.removeAttribute('src');
      try { directVideo.load(); } catch (_) {}
      directVideo = null;
    }
    if (youtubePlayer) {
      try { youtubePlayer.destroy(); } catch (_) {}
      youtubePlayer = null;
    }
    lastCurrentMs = 0;
    lastDurationMs = 0;
    lastPlaying = false;
    lastMuted = false;
    activeMarkerId = null;
  }

  function closeViewer() {
    destroyPlayback();
    replay = null;
    loadingSessionId = 0;
    const root = ensureViewer();
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-career-replay-open');
  }

  function recentGamesFromState(state) {
    const career = state?.career || state?.careerSummary || state?.career_summary || state?.profile?.career || {};
    const rows = state?.recentGames || state?.recent_games || career?.recentGames || career?.recent_games || state?.games;
    return Array.isArray(rows) ? rows : [];
  }

  async function getMeState() {
    if (stateCache && Date.now() - stateCacheAt < 5000) return stateCache;
    stateCache = await api('/api/real-play/me');
    stateCacheAt = Date.now();
    return stateCache;
  }

  async function decorateRecentGames() {
    const career = document.querySelector('[data-rp-career-beta]');
    if (!career) return;
    const host = career.querySelector('[data-career-game-list]');
    if (!host) return;
    const rows = [...host.querySelectorAll('.rp-game-row')];
    if (!rows.length) return;

    let games;
    try {
      games = recentGamesFromState(await getMeState());
    } catch (_) {
      return;
    }

    rows.forEach((row, index) => {
      const game = games[index];
      const sessionId = Number(game?.sessionId ?? game?.id ?? 0);
      if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;
      row.classList.add('rp-game-row-has-replay');
      let button = row.querySelector('[data-rp-career-replay-session]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'rp-game-replay-button';
        row.appendChild(button);
      }
      button.dataset.rpCareerReplaySession = String(sessionId);
      button.textContent = 'WATCH FULL GAME  ▶';
    });
  }

  function scheduleDecorate() {
    if (decorateTimer) clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => decorateRecentGames().catch(() => {}), 120);
  }

  function timelineMarkersHtml(markers) {
    if (!markers.length) return '';
    return markers.map((marker) => {
      const stamp = Math.max(0, Number(marker.videoTimestampMs || 0));
      return `<button type="button" class="rp-career-replay-timeline-marker" data-rp-career-replay-marker="${Number(marker.replayStartMs || 0)}" data-rp-career-marker-stamp="${stamp}" aria-label="Jump to made basket at ${formatTime(stamp)}" title="${formatTime(stamp)}">🏀</button>`;
    }).join('');
  }

  function renderReplay(data) {
    replay = data;
    const main = ensureViewer().querySelector('[data-rp-career-replay-main]');
    if (!main) return;
    const game = data?.game || {};
    const markers = Array.isArray(data?.markers)
      ? [...data.markers].sort((a, b) => Number(a.videoTimestampMs || 0) - Number(b.videoTimestampMs || 0))
      : [];
    const sourceType = data?.recording?.sourceType === 'youtube' ? 'youtube' : 'uploaded';
    main.innerHTML = `
      <div class="rp-career-replay-gamehead">
        <div><small>OFFICIAL CAREER FOOTAGE</small><h2>${esc(game.title || 'REAL PLAY GAME')}</h2></div>
        <div class="rp-career-replay-score"><b>${Number(game.westScore || 0)}</b><span>WEST — EAST</span><b>${Number(game.eastScore || 0)}</b></div>
      </div>
      <div class="rp-career-replay-stage" data-rp-career-replay-stage>
        <div data-rp-career-replay-media></div>
        <div class="rp-career-replay-score-pop" data-rp-career-score-pop aria-live="polite">
          <small>SCORE CONFIRMED</small>
          <div>
            <strong data-rp-career-score-name>PLAYER</strong>
            <p data-rp-career-score-detail>2PT MADE</p>
          </div>
          <b data-rp-career-score-value>+2</b>
        </div>
        <div class="rp-career-replay-video-controls" data-rp-career-replay-video-controls>
          <button type="button" data-rp-career-replay-play aria-label="Play or pause">▶</button>
          <div class="rp-career-replay-video-controls-right">
            <button type="button" data-rp-career-replay-mute aria-label="Mute or unmute">🔊</button>
            <button type="button" data-rp-career-replay-fullscreen aria-label="Fullscreen">⛶</button>
          </div>
        </div>
      </div>
      <div class="rp-career-replay-timeline-wrap">
        <div class="rp-career-replay-timeline">
          <input type="range" min="0" max="1000" step="1" value="0" data-rp-career-replay-seek aria-label="Video position">
          <div class="rp-career-replay-timeline-markers" data-rp-career-replay-timeline-markers>${timelineMarkersHtml(markers)}</div>
        </div>
        <span class="rp-career-replay-clock" data-rp-career-replay-clock>0:00 / 0:00</span>
      </div>
      <div class="rp-career-replay-hostnote">${sourceType === 'youtube' ? 'VIDEO HOSTED BY YOUTUBE · OFFICIAL REAL PLAY GAME DATA' : 'VIDEO HOSTED BY REAL PLAY · OFFICIAL REAL PLAY GAME DATA'}</div>`;

    const titleNode = ensureViewer().querySelector('[data-rp-career-replay-title]');
    if (titleNode) titleNode.textContent = game.title || 'REAL PLAY GAME';
    bindControls();
    if (sourceType === 'youtube') mountYouTube(data.recording?.youtubeVideoId);
    else mountDirect(data.streamUrl);
  }

  function renderReplayError(message) {
    const main = ensureViewer().querySelector('[data-rp-career-replay-main]');
    if (main) main.innerHTML = `<div class="rp-career-replay-error">${esc(message || 'This full-game replay is not available yet.')}</div>`;
  }

  async function openReplay(sessionId, button = null) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id < 1 || loadingSessionId) return;
    loadingSessionId = id;
    if (button) {
      button.disabled = true;
      button.textContent = 'LOADING REPLAY…';
    }
    destroyPlayback();
    openViewerShell();
    const main = ensureViewer().querySelector('[data-rp-career-replay-main]');
    if (main) main.innerHTML = '<div class="rp-career-replay-loading">LOADING VERIFIED FULL GAME…</div>';
    try {
      const data = await api(`/api/real-play/career/games/${encodeURIComponent(id)}/replay`);
      renderReplay(data);
    } catch (error) {
      renderReplayError(error.message || 'This full-game replay is not available yet.');
    } finally {
      loadingSessionId = 0;
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = 'WATCH FULL GAME  ▶';
      }
    }
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__realPlayReplayYouTubePromise) return window.__realPlayReplayYouTubePromise;
    window.__realPlayReplayYouTubePromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch (_) {}
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube player could not initialize.'));
      };
      let script = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('YouTube player could not load.'));
        document.head.appendChild(script);
      }
      const started = Date.now();
      const poll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          resolve(window.YT);
        } else if (Date.now() - started > 12000) {
          clearInterval(poll);
          reject(new Error('YouTube player took too long to load.'));
        }
      }, 120);
    });
    return window.__realPlayReplayYouTubePromise;
  }

  async function mountYouTube(videoId) {
    const media = ensureViewer().querySelector('[data-rp-career-replay-media]');
    if (!media || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) {
      renderReplayError('This YouTube replay source is invalid.');
      return;
    }
    media.innerHTML = '<div class="rp-career-replay-yt-host" data-rp-career-replay-yt></div>';
    try {
      await loadYouTubeApi();
      if (!media.isConnected || !viewer?.classList.contains('open')) return;
      const host = media.querySelector('[data-rp-career-replay-yt]');
      const hostId = `rp-career-replay-yt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      host.id = hostId;
      youtubePlayer = new window.YT.Player(hostId, {
        videoId: String(videoId),
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            const duration = Number(event.target.getDuration?.());
            if (Number.isFinite(duration) && duration > 0) lastDurationMs = Math.round(duration * 1000);
            startTicker();
            updatePlaybackUi();
          },
          onStateChange: (event) => {
            lastPlaying = event.data === window.YT.PlayerState.PLAYING;
            if (event.data === window.YT.PlayerState.ENDED) lastPlaying = false;
            updatePlaybackUi();
          },
          onError: () => renderReplayError('YouTube could not play this verified game inside Real Play.'),
        },
      });
    } catch (error) {
      renderReplayError(error.message || 'YouTube replay could not initialize.');
    }
  }

  function mountDirect(streamUrl) {
    const media = ensureViewer().querySelector('[data-rp-career-replay-media]');
    if (!media || !streamUrl) {
      renderReplayError('The game video stream is unavailable.');
      return;
    }
    const video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = String(streamUrl).startsWith('http') ? String(streamUrl) : `${API_BASE_URL}${streamUrl}`;
    media.replaceChildren(video);
    directVideo = video;
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) lastDurationMs = Math.round(video.duration * 1000);
      startTicker();
      updatePlaybackUi();
    });
    video.addEventListener('play', () => { lastPlaying = true; updatePlaybackUi(); });
    video.addEventListener('pause', () => { lastPlaying = false; updatePlaybackUi(); });
    video.addEventListener('ended', () => { lastPlaying = false; updatePlaybackUi(); });
    video.addEventListener('error', () => renderReplayError('The verified game video could not be loaded.'));
    startTicker();
  }

  function currentTimeMs() {
    if (directVideo) return Math.max(0, Math.round(Number(directVideo.currentTime || 0) * 1000));
    if (youtubePlayer) {
      try {
        const value = Number(youtubePlayer.getCurrentTime?.());
        if (Number.isFinite(value) && value >= 0) return Math.round(value * 1000);
      } catch (_) {}
    }
    return lastCurrentMs;
  }

  function durationMs() {
    if (directVideo && Number.isFinite(directVideo.duration) && directVideo.duration > 0) return Math.round(directVideo.duration * 1000);
    if (youtubePlayer) {
      try {
        const value = Number(youtubePlayer.getDuration?.());
        if (Number.isFinite(value) && value > 0) return Math.round(value * 1000);
      } catch (_) {}
    }
    return lastDurationMs;
  }

  function isPlaying() {
    if (directVideo) return !directVideo.paused && !directVideo.ended;
    return lastPlaying;
  }

  function seekToMs(ms, autoplay = false) {
    const seconds = Math.max(0, Number(ms || 0) / 1000);
    lastCurrentMs = Math.round(seconds * 1000);
    if (directVideo) {
      directVideo.currentTime = seconds;
      if (autoplay) directVideo.play().catch(() => {});
    } else if (youtubePlayer) {
      try {
        youtubePlayer.seekTo(seconds, true);
        if (autoplay) youtubePlayer.playVideo();
      } catch (_) {}
    }
    if (autoplay) lastPlaying = true;
    updatePlaybackUi();
  }

  function togglePlay() {
    if (directVideo) {
      if (directVideo.paused) directVideo.play().catch(() => {});
      else directVideo.pause();
      return;
    }
    if (!youtubePlayer) return;
    try {
      if (lastPlaying) youtubePlayer.pauseVideo();
      else youtubePlayer.playVideo();
    } catch (_) {}
  }

  function toggleMute() {
    if (directVideo) {
      directVideo.muted = !directVideo.muted;
      lastMuted = directVideo.muted;
    } else if (youtubePlayer) {
      try {
        if (lastMuted) youtubePlayer.unMute();
        else youtubePlayer.mute();
        lastMuted = !lastMuted;
      } catch (_) {}
    }
    updatePlaybackUi();
  }

  function updateScorePop(currentMs) {
    const pop = ensureViewer().querySelector('[data-rp-career-score-pop]');
    if (!pop || !replay) return;
    const markers = Array.isArray(replay.markers) ? replay.markers : [];
    let hit = null;
    for (const marker of markers) {
      const stamp = Number(marker.videoTimestampMs || 0);
      if (currentMs >= stamp && currentMs < stamp + SCORE_POP_MS) hit = marker;
      if (stamp > currentMs) break;
    }
    if (!hit) {
      activeMarkerId = null;
      pop.classList.remove('show');
      return;
    }
    const id = Number(hit.eventId || 0);
    if (activeMarkerId !== id) {
      activeMarkerId = id;
      const name = pop.querySelector('[data-rp-career-score-name]');
      const detail = pop.querySelector('[data-rp-career-score-detail]');
      const value = pop.querySelector('[data-rp-career-score-value]');
      if (name) name.textContent = hit.playerName || 'REAL PLAY PLAYER';
      if (detail) detail.textContent = `${String(hit.team || '').toUpperCase()} · ${Number(hit.shotValue || 0)}PT MADE · ${formatTime(hit.videoTimestampMs)}`;
      if (value) value.textContent = `+${Number(hit.shotValue || 0)}`;
    }
    pop.classList.add('show');
  }

  function updatePlaybackUi() {
    if (!viewer?.classList.contains('open')) return;
    lastCurrentMs = currentTimeMs();
    const nextDuration = durationMs();
    if (nextDuration > 0) lastDurationMs = nextDuration;
    lastPlaying = isPlaying();
    if (directVideo) lastMuted = Boolean(directVideo.muted);

    const seek = viewer.querySelector('[data-rp-career-replay-seek]');
    if (seek && lastDurationMs > 0 && document.activeElement !== seek) {
      seek.value = String(Math.max(0, Math.min(1000, Math.round(lastCurrentMs / lastDurationMs * 1000))));
    }
    const clock = viewer.querySelector('[data-rp-career-replay-clock]');
    if (clock) clock.textContent = `${formatTime(lastCurrentMs)} / ${formatTime(lastDurationMs)}`;
    const play = viewer.querySelector('[data-rp-career-replay-play]');
    if (play) play.textContent = lastPlaying ? '❚❚' : '▶';
    const mute = viewer.querySelector('[data-rp-career-replay-mute]');
    if (mute) mute.textContent = lastMuted ? '🔇' : '🔊';

    const markerLayer = viewer.querySelector('[data-rp-career-replay-timeline-markers]');
    if (markerLayer && lastDurationMs > 0) {
      markerLayer.querySelectorAll('[data-rp-career-marker-stamp]').forEach((marker) => {
        const stamp = Number(marker.dataset.rpCareerMarkerStamp || 0);
        marker.style.left = `${Math.max(0, Math.min(100, stamp / lastDurationMs * 100))}%`;
        marker.classList.toggle('active', Math.abs(lastCurrentMs - stamp) < 1600);
      });
    }

    // Keep the original in-video scoring recognition alive. The assist
    // recognition scripts intentionally listen for this popup's show/hide
    // sequence, so it must remain independent from the new timeline markers.
    updateScorePop(lastCurrentMs);
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(updatePlaybackUi, 100);
  }

  function bindControls() {
    const root = ensureViewer();
    const stage = root.querySelector('[data-rp-career-replay-stage]');
    const overlay = root.querySelector('[data-rp-career-replay-video-controls]');
    let controlsTimer = null;

    const showControls = () => {
      if (!overlay) return;
      overlay.classList.add('show');
      if (controlsTimer) clearTimeout(controlsTimer);
      controlsTimer = setTimeout(() => overlay.classList.remove('show'), 2600);
    };

    stage?.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      showControls();
    });

    root.querySelector('[data-rp-career-replay-play]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePlay();
      showControls();
    });
    root.querySelector('[data-rp-career-replay-mute]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMute();
      showControls();
    });
    root.querySelector('[data-rp-career-replay-seek]')?.addEventListener('input', (event) => {
      if (!lastDurationMs) return;
      seekToMs(lastDurationMs * (Number(event.target.value || 0) / 1000), false);
    });
    root.querySelector('[data-rp-career-replay-fullscreen]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      stage?.requestFullscreen?.().catch?.(() => {});
      showControls();
    });
    root.querySelectorAll('[data-rp-career-replay-marker]').forEach((button) => {
      button.addEventListener('click', () => seekToMs(Number(button.dataset.rpCareerReplayMarker || 0), true));
    });
    showControls();
  }

  document.addEventListener('click', (event) => {
    const replayButton = event.target.closest('[data-rp-career-replay-session]');
    if (replayButton) {
      event.preventDefault();
      event.stopPropagation();
      openReplay(replayButton.dataset.rpCareerReplaySession, replayButton);
      return;
    }
    if (event.target.closest('[data-rp-career-replay-close]')) {
      event.preventDefault();
      closeViewer();
    }
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && viewer?.classList.contains('open')) closeViewer();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    stateCache = null;
    stateCacheAt = 0;
    if (viewer?.classList.contains('open')) closeViewer();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-select-mode="Career Mode"], [data-rp-nav="career"]')) {
      stateCache = null;
      stateCacheAt = 0;
      setTimeout(scheduleDecorate, 300);
    }
  }, true);

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleDecorate, { once: true });
  else scheduleDecorate();
})();
