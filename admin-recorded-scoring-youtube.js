(() => {
  if (window.__realPlayRecordedYouTubeInstalled) return;
  window.__realPlayRecordedYouTubeInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const REF_PREFIX = 'YOUTUBE_';
  const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

  let enhanceTimer = null;
  let enhancing = false;
  let sourceBusy = false;
  let cachedSessionId = 0;
  let cachedRecording = null;
  let player = null;
  let playerShell = null;
  let playerSignature = '';
  let ticker = null;
  let lastCurrentMs = 0;
  let lastDurationMs = 0;
  let lastPlaying = false;
  let lastMuted = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function adminBody() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function parseYouTubeId(value) {
    const raw = String(value || '').trim();
    if (YT_ID_RE.test(raw)) return raw;
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch (_) {
      return null;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      id = url.searchParams.get('v') || '';
      if (!id) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
      }
    }
    return YT_ID_RE.test(id) ? id : null;
  }

  function recordingYouTubeId(recording) {
    const name = String(recording?.originalName || '');
    const match = name.match(/^YOUTUBE_([A-Za-z0-9_-]{11})\.mp4$/i);
    return match?.[1] || null;
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

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__realPlayYouTubeApiPromise) return window.__realPlayYouTubeApiPromise;

    window.__realPlayYouTubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch (_) {}
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube player API did not initialize.'));
      };

      let script = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('YouTube player API could not be loaded.'));
        document.head.appendChild(script);
      }

      const started = Date.now();
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          resolve(window.YT);
        } else if (Date.now() - started > 12000) {
          clearInterval(poll);
          reject(new Error('YouTube player took too long to load.'));
        }
      }, 120);
    });
    return window.__realPlayYouTubeApiPromise;
  }

  async function fetchState() {
    const controlData = await api('/api/real-play/admin/career/control');
    const sessionId = Number(controlData?.control?.session?.id || 0);
    cachedSessionId = sessionId;
    if (!sessionId) {
      cachedRecording = null;
      return { sessionId: 0, control: controlData?.control || null, recording: null };
    }
    const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
    cachedRecording = state?.recording || null;
    return { sessionId, control: controlData?.control || null, recording: cachedRecording };
  }

  function setSourceStatus(message, error = false) {
    const node = adminBody()?.querySelector('[data-rp-youtube-source-status]');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', Boolean(error));
  }

  async function saveYouTubeReference(urlValue) {
    if (sourceBusy) return;
    const videoId = parseYouTubeId(urlValue);
    if (!videoId) {
      setSourceStatus('Paste a valid YouTube watch, youtu.be, Shorts, Live, or Embed link.', true);
      return;
    }

    sourceBusy = true;
    setSourceStatus('Saving YouTube game source…');
    const state = await fetchState();
    if (!state.sessionId) {
      sourceBusy = false;
      setSourceStatus('Open a Real Play game first.', true);
      return;
    }
    if (state.control?.session?.gameStatus !== 'setup') {
      sourceBusy = false;
      setSourceStatus('The video source is locked after scoring starts.', true);
      return;
    }

    try {
      const name = `${REF_PREFIX}${videoId}.mp4`;
      const start = await api('/api/real-play/admin/recorded-scoring/uploads', {
        method: 'POST',
        json: {
          session_id: state.sessionId,
          mime_type: 'video/mp4',
          original_name: name,
          size_bytes: 1,
        },
      });
      const oneByte = new Uint8Array([0]);
      await api(`/api/real-play/admin/recorded-scoring/uploads/${start.upload_id}/chunks/0`, {
        method: 'PUT',
        body: oneByte,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      await api(`/api/real-play/admin/recorded-scoring/uploads/${start.upload_id}/complete`, {
        method: 'POST',
        json: { duration_ms: null },
      });
      setSourceStatus('YouTube source saved. Checking playback…');
      const tab = root()?.querySelector('[data-rp-video-tab]');
      if (tab) tab.click();
    } catch (error) {
      setSourceStatus(error.message || 'Could not save that YouTube video.', true);
    } finally {
      sourceBusy = false;
    }
  }

  function injectSourceChoice() {
    const body = adminBody();
    if (!body || body.querySelector('[data-rp-youtube-source-card]')) return;
    const uploadBox = body.querySelector('.rp-video-upload-box');
    if (!uploadBox) return;

    const card = document.createElement('div');
    card.className = 'rp-youtube-source-card';
    card.dataset.rpYoutubeSourceCard = '1';
    card.innerHTML = `
      <div class="rp-youtube-source-head">
        <span>RECOMMENDED</span>
        <strong>USE YOUTUBE VIDEO</strong>
        <small>Upload the full game to YouTube as Unlisted, paste the link here, and YouTube handles the large video file and streaming.</small>
      </div>
      <form data-rp-youtube-source-form>
        <input type="url" name="youtubeUrl" placeholder="Paste YouTube link" inputmode="url" autocomplete="off" required>
        <button type="submit">USE YOUTUBE VIDEO</button>
      </form>
      <div class="rp-youtube-source-status" data-rp-youtube-source-status></div>
      <div class="rp-youtube-source-note">The scoring sheet, exact timestamps, 5-second replay lead-ins, stats, and verification still belong to Real Play.</div>`;
    uploadBox.insertAdjacentElement('beforebegin', card);

    const divider = document.createElement('div');
    divider.className = 'rp-youtube-source-divider';
    divider.textContent = 'OR UPLOAD DIRECTLY TO REAL PLAY';
    uploadBox.insertAdjacentElement('beforebegin', divider);
  }

  function decorateYouTubeSetup(videoId) {
    const body = adminBody();
    if (!body) return;
    const uploaded = body.querySelector('.rp-video-uploaded');
    if (uploaded && !uploaded.dataset.rpYoutubeDecorated) {
      uploaded.dataset.rpYoutubeDecorated = '1';
      uploaded.classList.add('youtube');
      uploaded.innerHTML = `<span>YOUTUBE VIDEO READY</span><strong>UNLISTED / LINK VIDEO</strong><small>Video ID · ${esc(videoId)} · YouTube handles video storage and streaming</small>`;
    }

    const step = uploaded?.closest('.rp-video-step');
    const headStrong = step?.querySelector('.rp-video-step-head strong');
    const headSmall = step?.querySelector('.rp-video-step-head small');
    if (headStrong) headStrong.textContent = 'GAME VIDEO SOURCE';
    if (headSmall) headSmall.textContent = 'YouTube-hosted continuous full-game recording.';

    const replace = step?.querySelector('.rp-video-replace');
    if (replace) {
      replace.style.display = 'none';
    }

    if (step && !step.querySelector('[data-rp-youtube-preview]')) {
      const preview = document.createElement('div');
      preview.className = 'rp-youtube-preview';
      preview.dataset.rpYoutubePreview = '1';
      preview.innerHTML = '<div class="rp-youtube-preview-label"><strong>PLAYBACK CHECK</strong><small>Press play once before starting scoring. If YouTube blocks embedding, Real Play will keep START VIDEO SCORING disabled.</small></div><div data-rp-youtube-preview-slot></div><button type="button" class="rp-youtube-remove-source" data-rp-youtube-remove-source>REMOVE YOUTUBE LINK</button>';
      const anchor = uploaded || step.querySelector('.rp-video-step-head');
      anchor?.insertAdjacentElement('afterend', preview);
      mountPlayer(preview.querySelector('[data-rp-youtube-preview-slot]'), videoId, 'setup');
    }
  }

  function setSetupReady(ready, message = '') {
    const body = adminBody();
    const start = body?.querySelector('[data-rp-video-start]');
    const rosterReady = Boolean(body?.querySelector('.rp-video-roster-check.ready'));
    if (start) start.disabled = !(ready && rosterReady);
    const preview = body?.querySelector('[data-rp-youtube-preview]');
    if (preview) {
      preview.classList.toggle('ready', ready);
      preview.classList.toggle('error', !ready && Boolean(message));
      const label = preview.querySelector('.rp-youtube-preview-label small');
      if (label && message) label.textContent = message;
    }
  }

  function buildPlayerShell(context) {
    const shell = document.createElement('div');
    shell.className = `rp-youtube-player-shell ${context === 'setup' ? 'setup' : 'scoring'}`;
    shell.dataset.rpYoutubePlayerShell = context;
    shell.innerHTML = `
      <div class="rp-youtube-stage"><div data-rp-youtube-host></div></div>
      <div class="rp-youtube-controls">
        <button type="button" data-rp-youtube-play aria-label="Play or pause">▶</button>
        <input type="range" min="0" max="1000" value="0" step="1" data-rp-youtube-seek aria-label="Video position">
        <span data-rp-youtube-clock>0:00 / 0:00</span>
        <button type="button" data-rp-youtube-mute aria-label="Mute or unmute">🔊</button>
        <button type="button" data-rp-youtube-fullscreen aria-label="Fullscreen">⛶</button>
      </div>
      ${context === 'scoring' ? '<div data-rp-recorded-video hidden aria-hidden="true"></div>' : ''}
      <div class="rp-youtube-host-note">VIDEO HOSTED BY YOUTUBE · REAL PLAY CONTROLS</div>`;
    return shell;
  }

  function destroyPlayer() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    if (player) {
      try { player.destroy(); } catch (_) {}
    }
    player = null;
    playerShell = null;
    playerSignature = '';
  }

  function definePlaybackProxy(proxy) {
    if (!proxy || proxy.dataset.rpYoutubeProxyReady === '1') return;
    proxy.dataset.rpYoutubeProxyReady = '1';
    try {
      Object.defineProperties(proxy, {
        currentTime: {
          configurable: true,
          get: () => Math.max(0, Number(lastCurrentMs || 0) / 1000),
          set: (seconds) => {
            const value = Math.max(0, Number(seconds || 0));
            lastCurrentMs = Math.round(value * 1000);
            try { player?.seekTo(value, true); } catch (_) {}
          },
        },
        duration: {
          configurable: true,
          get: () => Math.max(0, Number(lastDurationMs || 0) / 1000),
        },
        paused: {
          configurable: true,
          get: () => !lastPlaying,
        },
        ended: {
          configurable: true,
          get: () => Boolean(lastDurationMs && lastCurrentMs >= lastDurationMs - 250),
        },
      });
    } catch (_) {}
    proxy.play = () => {
      try { player?.playVideo(); } catch (_) {}
      lastPlaying = true;
      return Promise.resolve();
    };
    proxy.pause = () => {
      try { player?.pauseVideo(); } catch (_) {}
      lastPlaying = false;
    };
    proxy.load = () => {};
  }

  function updateYouTubeUi() {
    if (!player || !playerShell?.isConnected) return;
    let seconds = lastCurrentMs / 1000;
    let duration = lastDurationMs / 1000;
    try {
      const nextSeconds = Number(player.getCurrentTime?.());
      const nextDuration = Number(player.getDuration?.());
      if (Number.isFinite(nextSeconds) && nextSeconds >= 0) seconds = nextSeconds;
      if (Number.isFinite(nextDuration) && nextDuration > 0) duration = nextDuration;
    } catch (_) {}
    lastCurrentMs = Math.round(seconds * 1000);
    if (duration > 0) lastDurationMs = Math.round(duration * 1000);

    const seek = playerShell.querySelector('[data-rp-youtube-seek]');
    if (seek && lastDurationMs > 0 && document.activeElement !== seek) {
      seek.value = String(Math.max(0, Math.min(1000, Math.round(lastCurrentMs / lastDurationMs * 1000))));
    }
    const clock = playerShell.querySelector('[data-rp-youtube-clock]');
    if (clock) clock.textContent = `${formatTime(lastCurrentMs)} / ${formatTime(lastDurationMs)}`;
    const play = playerShell.querySelector('[data-rp-youtube-play]');
    if (play) play.textContent = lastPlaying ? '❚❚' : '▶';
    const mute = playerShell.querySelector('[data-rp-youtube-mute]');
    if (mute) mute.textContent = lastMuted ? '🔇' : '🔊';

    const externalTime = adminBody()?.querySelector('[data-rp-video-time]');
    if (externalTime) externalTime.textContent = formatTime(lastCurrentMs);
    patchDraftMarkers();
  }

  function bindShellControls(shell) {
    shell.querySelector('[data-rp-youtube-play]')?.addEventListener('click', () => {
      if (!player) return;
      if (lastPlaying) player.pauseVideo();
      else player.playVideo();
    });
    shell.querySelector('[data-rp-youtube-seek]')?.addEventListener('input', (event) => {
      if (!player || !lastDurationMs) return;
      const ratio = Number(event.target.value || 0) / 1000;
      const seconds = Math.max(0, lastDurationMs / 1000 * ratio);
      lastCurrentMs = Math.round(seconds * 1000);
      player.seekTo(seconds, true);
      updateYouTubeUi();
    });
    shell.querySelector('[data-rp-youtube-mute]')?.addEventListener('click', () => {
      if (!player) return;
      if (lastMuted) {
        player.unMute();
        lastMuted = false;
      } else {
        player.mute();
        lastMuted = true;
      }
      updateYouTubeUi();
    });
    shell.querySelector('[data-rp-youtube-fullscreen]')?.addEventListener('click', () => {
      const target = shell.querySelector('.rp-youtube-stage') || shell;
      target.requestFullscreen?.().catch?.(() => {});
    });
  }

  async function mountPlayer(container, videoId, context) {
    if (!container || !videoId) return;
    const signature = `${videoId}:${context}`;
    if (playerShell?.isConnected && playerSignature === signature) return;

    if (player) {
      try {
        const current = Number(player.getCurrentTime?.());
        const duration = Number(player.getDuration?.());
        if (Number.isFinite(current)) lastCurrentMs = Math.round(current * 1000);
        if (Number.isFinite(duration) && duration > 0) lastDurationMs = Math.round(duration * 1000);
      } catch (_) {}
      destroyPlayer();
    }

    const shell = buildPlayerShell(context);
    container.replaceChildren(shell);
    playerShell = shell;
    playerSignature = signature;
    bindShellControls(shell);
    const proxy = shell.querySelector('[data-rp-recorded-video]');
    definePlaybackProxy(proxy);

    try {
      await loadYouTubeApi();
      if (!shell.isConnected || playerSignature !== signature) return;
      const host = shell.querySelector('[data-rp-youtube-host]');
      const hostId = `rp-youtube-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      host.id = hostId;
      player = new window.YT.Player(hostId, {
        videoId,
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
            if (context === 'scoring' && lastCurrentMs > 0) {
              try { event.target.seekTo(lastCurrentMs / 1000, true); } catch (_) {}
            }
            if (context === 'scoring' && lastPlaying) {
              try { event.target.playVideo(); } catch (_) {}
            }
            if (context === 'setup') setSetupReady(true, 'Playback confirmed. YouTube can play inside Real Play.');
            updateYouTubeUi();
          },
          onStateChange: (event) => {
            lastPlaying = event.data === window.YT.PlayerState.PLAYING;
            if (event.data === window.YT.PlayerState.ENDED) lastPlaying = false;
            updateYouTubeUi();
          },
          onError: (event) => {
            lastPlaying = false;
            const code = Number(event.data || 0);
            const message = code === 101 || code === 150
              ? 'This YouTube video does not allow embedding. Use an embeddable Unlisted video or upload directly.'
              : code === 100
                ? 'YouTube says this video is unavailable or private. Check the link and visibility.'
                : 'YouTube could not play this game video inside Real Play.';
            if (context === 'setup') setSetupReady(false, message);
            const note = shell.querySelector('.rp-youtube-host-note');
            if (note) {
              note.textContent = message;
              note.classList.add('error');
            }
          },
        },
      });
      ticker = setInterval(updateYouTubeUi, 250);
    } catch (error) {
      if (context === 'setup') setSetupReady(false, error.message || 'YouTube playback could not initialize.');
      const note = shell.querySelector('.rp-youtube-host-note');
      if (note) {
        note.textContent = error.message || 'YouTube playback could not initialize.';
        note.classList.add('error');
      }
    }
  }

  function mountScoringPlayer(videoId) {
    const wrap = adminBody()?.querySelector('.rp-video-player-wrap');
    if (!wrap) return;
    const existingShell = wrap.querySelector('[data-rp-youtube-player-shell="scoring"]');
    if (existingShell && playerShell === existingShell && playerSignature === `${videoId}:scoring`) return;

    const video = wrap.querySelector('[data-rp-recorded-video]');
    if (!video) return;
    const slot = document.createElement('div');
    slot.dataset.rpYoutubeScoringSlot = '1';
    video.replaceWith(slot);
    mountPlayer(slot, videoId, 'scoring');
  }

  function latestDraftEvents() {
    if (!cachedSessionId || !cachedRecording?.uploadedAt) return [];
    const key = `rp-recorded-score-sheet:v2:${cachedSessionId}:${cachedRecording.uploadedAt}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(parsed?.events) ? parsed.events : [];
    } catch (_) {
      return [];
    }
  }

  function patchDraftMarkers() {
    if (!lastDurationMs) return;
    const markers = adminBody()?.querySelector('[data-rp-video-markers]');
    if (!markers || !adminBody()?.querySelector('.rp-video-scoring-screen')) return;
    const events = latestDraftEvents();
    if (!events.length && window.__realPlayRecordedScoringDraftActive) {
      markers.innerHTML = '';
      return;
    }
    if (!events.length) return;
    markers.innerHTML = events
      .filter((item) => item?.eventType === 'shot' && item?.shotResult === 'make')
      .map((item) => {
        const timestamp = Number(item.videoTimestampMs || 0);
        const left = Math.max(0, Math.min(100, timestamp / lastDurationMs * 100));
        const replay = Number(item.replayStartMs ?? Math.max(0, timestamp - 5000));
        return `<button type="button" class="rp-video-marker" style="left:${left}%" data-rp-video-marker="${replay}" title="${Number(item.shotValue || 0)}PT make at ${formatTime(timestamp)}">🏀</button>`;
      }).join('');
  }

  async function removeYouTubeSource() {
    if (sourceBusy) return;
    const state = await fetchState();
    if (!state.sessionId) return;
    if (!window.confirm('Remove this YouTube game video so you can paste a different link or upload a file?')) return;
    sourceBusy = true;
    try {
      await api('/api/real-play/admin/recorded-scoring/cancel', {
        method: 'POST',
        json: { session_id: state.sessionId },
      });
      destroyPlayer();
      lastCurrentMs = 0;
      lastDurationMs = 0;
      lastPlaying = false;
      const tab = root()?.querySelector('[data-rp-video-tab]');
      if (tab) tab.click();
    } catch (error) {
      window.alert(error.message || 'Could not remove the YouTube game video.');
    } finally {
      sourceBusy = false;
    }
  }

  async function enhance() {
    if (enhancing) return;
    const body = adminBody();
    if (!body || !root()?.classList.contains('open')) return;

    const videoTab = root()?.querySelector('[data-rp-video-tab].active');
    if (!videoTab) return;

    injectSourceChoice();

    const scoringLike = Boolean(body.querySelector('.rp-video-player-wrap'));
    const uploadedName = String(body.querySelector('.rp-video-uploaded strong')?.textContent || '');
    let videoId = parseYouTubeId(uploadedName.match(/YOUTUBE_([A-Za-z0-9_-]{11})\.mp4/i)?.[1] || '');

    if (!videoId && !body.querySelector('.rp-video-upload-box')) {
      enhancing = true;
      try {
        const state = await fetchState();
        videoId = recordingYouTubeId(state.recording);
      } catch (_) {
        videoId = null;
      } finally {
        enhancing = false;
      }
    } else if (videoId) {
      if (!cachedRecording || recordingYouTubeId(cachedRecording) !== videoId) {
        enhancing = true;
        try { await fetchState(); } catch (_) {}
        finally { enhancing = false; }
      }
    }

    if (!videoId) return;

    if (body.querySelector('.rp-video-uploaded')) {
      decorateYouTubeSetup(videoId);
    }
    if (scoringLike) {
      mountScoringPlayer(videoId);
    }
  }

  function scheduleEnhance() {
    if (enhanceTimer) clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(() => enhance().catch(() => {}), 45);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-rp-youtube-source-form]');
    if (!form || !root()?.contains(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = new FormData(form);
    saveYouTubeReference(data.get('youtubeUrl')).catch((error) => {
      sourceBusy = false;
      setSourceStatus(error.message || 'Could not save that YouTube video.', true);
    });
  }, true);

  document.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-rp-youtube-remove-source]');
    if (remove && root()?.contains(remove)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeYouTubeSource();
      return;
    }

    const marker = event.target.closest('[data-rp-video-marker]');
    if (marker && player && playerShell?.classList.contains('scoring')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const seekMs = Math.max(0, Number(marker.dataset.rpVideoMarker || 0));
      lastCurrentMs = seekMs;
      try {
        player.seekTo(seekMs / 1000, true);
        player.playVideo();
      } catch (_) {}
      lastPlaying = true;
      updateYouTubeUi();
    }
  }, true);

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', scheduleEnhance);
  window.addEventListener('beforeunload', destroyPlayer);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
  else scheduleEnhance();
})();
