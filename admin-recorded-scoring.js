(() => {
  if (window.__realPlayRecordedScoringInstalled) return;
  window.__realPlayRecordedScoringInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SEARCH_MIN = 2;

  let videoMode = false;
  let busy = false;
  let control = { session: null, players: [] };
  let recordingState = { recording: null, events: [] };
  let directory = [];
  let unclaimedMatches = [];
  let directoryLoaded = false;
  let selectedPlayerId = null;
  let streamUrl = '';
  let streamForUploadAt = '';
  let uploadProgress = 0;
  let notice = '';
  let noticeType = '';
  let searchQuery = '';
  let searchTimer = null;
  let createOpen = false;
  let playheadMs = 0;
  let shouldResume = false;
  let lastDurationMs = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
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

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function playerLabel(player) {
    const number = player?.playerNumber === null || player?.playerNumber === undefined ? '#--' : `#${Number(player.playerNumber)}`;
    return `${number} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function rosterPlayers(team) {
    return (control.players || []).filter((player) => player.checkedIn && String(player.team || '').toLowerCase() === team);
  }

  function activeRosterIds() {
    return new Set((control.players || []).filter((player) => player.checkedIn && player.team).map((player) => Number(player.userId)));
  }

  function syncTabActive() {
    const adminRoot = root();
    if (!adminRoot) return;
    const videoTab = adminRoot.querySelector('[data-rp-video-tab]');
    if (!videoTab) return;
    if (videoMode) {
      adminRoot.querySelectorAll('[data-admin-tab]').forEach((tab) => tab.classList.remove('active'));
      videoTab.classList.add('active');
    } else {
      videoTab.classList.remove('active');
    }
  }

  function ensureTab() {
    const adminRoot = root();
    const nav = adminRoot?.querySelector('.rp-admin-tabs');
    if (!nav || nav.querySelector('[data-rp-video-tab]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-admin-tab rp-admin-video-tab';
    button.dataset.rpVideoTab = '1';
    button.textContent = 'VIDEO';
    const finalize = nav.querySelector('[data-admin-tab="finalize"]');
    nav.insertBefore(button, finalize || null);
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      videoMode = true;
      notice = '';
      noticeType = '';
      syncTabActive();
      renderLoading();
      await loadEverything();
    });
  }

  function noticeHtml() {
    if (!notice) return '';
    return `<div class="rp-video-notice ${noticeType === 'error' ? 'error' : 'success'}">${esc(notice)}</div>`;
  }

  function stepHeader(step, title, detail, done = false) {
    return `<div class="rp-video-step-head"><span class="rp-video-step-number ${done ? 'done' : ''}">${done ? '✓' : step}</span><div><strong>${esc(title)}</strong><small>${esc(detail)}</small></div></div>`;
  }

  function renderLoading() {
    const adminBody = body();
    if (!adminBody || !videoMode) return;
    syncTabActive();
    adminBody.innerHTML = `<div class="rp-video-screen"><div class="rp-admin-title"><span class="rp-admin-kicker">RECORDED SCORING</span><h1>VIDEO REVIEW</h1><p>Loading the current Real Play game…</p></div><div class="rp-video-loading">LOADING…</div></div>`;
  }

  async function loadControl() {
    const data = await api('/api/real-play/admin/career/control');
    control = data?.control || { session: null, players: [] };
    return control;
  }

  async function loadRecordingState() {
    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId) {
      recordingState = { recording: null, events: [] };
      return recordingState;
    }
    const data = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
    recordingState = {
      recording: data?.recording || null,
      events: Array.isArray(data?.events) ? data.events : [],
    };
    const uploadedAt = recordingState.recording?.uploadedAt || '';
    if (uploadedAt !== streamForUploadAt) {
      streamUrl = '';
      streamForUploadAt = uploadedAt;
    }
    return recordingState;
  }

  async function loadDirectory() {
    if (directoryLoaded) return;
    try {
      const data = await api('/api/real-play/admin/3v3/players');
      directory = Array.isArray(data?.players) ? data.players : [];
      directoryLoaded = true;
    } catch (_) {
      directory = [];
    }
  }

  async function ensureStream() {
    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId || !recordingState.recording || streamUrl) return streamUrl;
    const data = await api('/api/real-play/admin/recorded-scoring/stream-access', {
      method: 'POST',
      json: { session_id: sessionId },
    });
    streamUrl = data?.stream_url ? `${API_BASE_URL}${data.stream_url}` : '';
    return streamUrl;
  }

  async function loadEverything() {
    if (!videoMode) return;
    try {
      await loadControl();
      if (control.session) {
        await Promise.all([loadRecordingState(), loadDirectory()]);
        if (recordingState.recording) await ensureStream();
      }
      render();
    } catch (error) {
      notice = error.message || 'Unable to load recorded scoring.';
      noticeType = 'error';
      render();
    }
  }

  async function controlAction(payload) {
    const data = await api('/api/real-play/admin/career/control', { method: 'POST', json: payload });
    control = data?.control || control;
    return control;
  }

  function uploadHtml() {
    const uploaded = Boolean(recordingState.recording);
    return `<section class="rp-video-step ${uploaded ? 'complete' : ''}">
      ${stepHeader('1', 'UPLOAD FULL GAME', uploaded ? recordingState.recording.originalName : 'One continuous recording. No cuts required.', uploaded)}
      ${uploaded ? `
        <div class="rp-video-uploaded"><span>VIDEO READY</span><strong>${esc(recordingState.recording.originalName)}</strong><small>${Math.round(Number(recordingState.recording.sizeBytes || 0) / (1024 * 1024))} MB${recordingState.recording.durationMs ? ` · ${formatTime(recordingState.recording.durationMs)}` : ''}</small></div>
        ${control.session?.gameStatus === 'setup' ? '<label class="rp-video-replace"><input type="file" accept="video/mp4,video/webm,video/quicktime" data-rp-video-file>REPLACE VIDEO</label>' : ''}
      ` : `
        <label class="rp-video-upload-box">
          <input type="file" accept="video/mp4,video/webm,video/quicktime" data-rp-video-file ${busy ? 'disabled' : ''}>
          <span>＋</span><strong>SELECT GAME VIDEO</strong><small>MP4 · MOV · WEBM</small>
        </label>
        ${uploadProgress > 0 ? `<div class="rp-video-progress"><i style="width:${Math.min(100, uploadProgress)}%"></i></div><small class="rp-video-progress-label">UPLOADING ${Math.round(uploadProgress)}%</small>` : ''}
      `}
    </section>`;
  }

  function rosterCard(team) {
    const players = rosterPlayers(team);
    return `<div class="rp-video-roster-card ${team}">
      <div class="rp-video-roster-head"><strong>${team.toUpperCase()}</strong><span>${players.length}</span></div>
      <div class="rp-video-roster-list">${players.length ? players.map((player) => `
        <div class="rp-video-roster-player">
          <div><strong>${esc(playerLabel(player))}</strong><small>${player.unclaimed ? 'CREATED PLAYER · CLAIMABLE' : 'REAL PLAY ACCOUNT'}</small></div>
          <div class="rp-video-roster-actions">
            <button type="button" data-rp-video-switch="${team === 'west' ? 'east' : 'west'}" data-player-id="${Number(player.userId)}">${team === 'west' ? '→ EAST' : '← WEST'}</button>
            <button type="button" class="remove" data-rp-video-remove data-player-id="${Number(player.userId)}">×</button>
          </div>
        </div>`).join('') : '<div class="rp-video-roster-empty">NO PLAYER SELECTED</div>'}</div>
    </div>`;
  }

  function searchResultsHtml() {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < SEARCH_MIN) return '<div class="rp-video-search-hint">Type at least 2 characters.</div>';
    const selected = activeRosterIds();
    const registered = directory
      .filter((player) => !selected.has(Number(player.userId)))
      .filter((player) => `${player.playerName || ''} ${player.email || ''}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((player) => ({ kind: 'registered', id: Number(player.userId), name: player.playerName, sub: player.email || 'REAL PLAY ACCOUNT' }));
    const unclaimed = unclaimedMatches
      .filter((profile) => !selected.has(-Number(profile.playerId || profile.id)))
      .slice(0, 8)
      .map((profile) => ({ kind: 'unclaimed', id: Number(profile.playerId || profile.id), name: profile.playerName, sub: `${profile.publicPlayerId || 'CREATED PLAYER'} · CLAIMABLE` }));
    const combined = [...registered, ...unclaimed].slice(0, 10);
    if (!combined.length) return '<div class="rp-video-search-hint">No matching player. Use CREATE PLAYER below.</div>';
    return combined.map((item) => `<div class="rp-video-search-result">
      <div><strong>${esc(item.name)}</strong><small>${esc(item.sub)}</small></div>
      <div class="rp-video-search-actions">
        <button type="button" data-rp-video-add data-kind="${item.kind}" data-id="${item.id}" data-team="west">WEST</button>
        <button type="button" data-rp-video-add data-kind="${item.kind}" data-id="${item.id}" data-team="east">EAST</button>
      </div>
    </div>`).join('');
  }

  function rulesHtml() {
    const rules = control.session?.rules || null;
    const label = control.session?.rulesLabel || (rules ? 'GAME RULES SET' : 'RULES NOT SET');
    return `<div class="rp-video-rules">
      <div class="rp-video-rules-current"><span>CURRENT RULES</span><strong>${esc(label)}</strong></div>
      <button type="button" data-rp-video-rule-standard ${busy ? 'disabled' : ''}>STANDARD 3V3</button>
      <form data-rp-video-race-form>
        <select name="target"><option value="8">RACE TO 8</option><option value="16">RACE TO 16</option><option value="21">RACE TO 21</option></select>
        <select name="format"><option value="3v3">3V3</option><option value="4v4">4V4</option><option value="5v5">5V5</option></select>
        <button type="submit" ${busy ? 'disabled' : ''}>SET RACE TO</button>
      </form>
    </div>`;
  }

  function rosterSetupHtml() {
    const rules = control.session?.rules || null;
    const expected = Number(rules?.playersPerSide || 0);
    const west = rosterPlayers('west').length;
    const east = rosterPlayers('east').length;
    const rosterReady = expected > 0 && west === expected && east === expected;
    const uploaded = Boolean(recordingState.recording);
    const canStart = uploaded && rosterReady && !busy;
    return `<section class="rp-video-step ${rosterReady ? 'complete' : ''}" data-rp-video-roster-setup>
      ${stepHeader('2', 'CHOOSE PLAYERS', 'Search or create the exact people visible in this game.', rosterReady)}
      <div class="rp-video-search-wrap">
        <input type="search" data-rp-video-search value="${esc(searchQuery)}" placeholder="Search player name or email" autocomplete="off">
        <div class="rp-video-search-results" data-rp-video-search-results>${searchResultsHtml()}</div>
      </div>
      <button type="button" class="rp-video-create-toggle" data-rp-video-create-toggle>${createOpen ? '− CLOSE CREATE PLAYER' : '+ CREATE PLAYER'}</button>
      ${createOpen ? `<form class="rp-video-create-form" data-rp-video-create-form>
        <label>PLAYER NAME<input name="playerName" minlength="2" maxlength="60" required placeholder="Player name"></label>
        <label>TEAM<select name="team"><option value="west">WEST</option><option value="east">EAST</option></select></label>
        <button type="submit" ${busy ? 'disabled' : ''}>CREATE & ADD</button>
        <small>This uses Real Play's existing claimable player-identity system. No fake login account is created.</small>
      </form>` : ''}
      <div class="rp-video-rosters">${rosterCard('west')}${rosterCard('east')}</div>
      ${rulesHtml()}
      <div class="rp-video-roster-check ${rosterReady ? 'ready' : ''}">${rules ? `${esc(control.session.rulesLabel || '')} needs exactly ${expected} West + ${expected} East. Current: ${west} + ${east}.` : 'Set the game rules to validate the roster size.'}</div>
      <button type="button" class="rp-video-start" data-rp-video-start ${canStart ? '' : 'disabled'}>START VIDEO SCORING</button>
    </section>`;
  }

  function markerButtons() {
    const duration = Number(recordingState.recording?.durationMs || lastDurationMs || 0);
    if (!duration) return '';
    return (recordingState.events || [])
      .filter((event) => event.eventType === 'shot' && event.shotResult === 'make' && Number.isFinite(Number(event.videoTimestampMs)))
      .map((event) => {
        const left = Math.max(0, Math.min(100, Number(event.videoTimestampMs) / duration * 100));
        return `<button type="button" class="rp-video-marker" style="left:${left}%" data-rp-video-marker="${Number(event.replayStartMs ?? Math.max(0, Number(event.videoTimestampMs) - 5000))}" title="${event.shotValue}PT make at ${formatTime(event.videoTimestampMs)}">🏀</button>`;
      }).join('');
  }

  function selectedPanel() {
    const player = (control.players || []).find((item) => Number(item.userId) === Number(selectedPlayerId) && item.checkedIn && item.team);
    if (!player) return '<div class="rp-video-select-prompt">SELECT A PLAYER TO SCORE AN EVENT</div>';
    const stats = player.stats || {};
    return `<section class="rp-video-player-panel">
      <div class="rp-video-player-panel-head"><div><small>${esc(String(player.team || '').toUpperCase())}</small><strong>${esc(playerLabel(player))}</strong></div><button type="button" data-rp-video-close-player>×</button></div>
      <div class="rp-video-player-line">${Number(stats.pts || 0)} PTS · ${Number(stats.ast || 0)} AST · ${Number(stats.reb || 0)} REB · ${Number(stats.stl || 0)} STL · ${Number(stats.blk || 0)} BLK · ${Number(stats.tov || 0)} TO</div>
      <div class="rp-video-shot-grid">
        <button type="button" data-rp-video-shot data-value="1" data-result="miss">1PT MISS</button>
        <button type="button" class="make" data-rp-video-shot data-value="1" data-result="make">1PT MAKE</button>
        <button type="button" data-rp-video-shot data-value="2" data-result="miss">2PT MISS</button>
        <button type="button" class="make" data-rp-video-shot data-value="2" data-result="make">2PT MAKE</button>
      </div>
      <div class="rp-video-stat-grid">
        ${['AST','REB','TO','STL','BLK','FOUL'].map((stat) => `<button type="button" data-rp-video-stat="${stat.toLowerCase()}">${stat}</button>`).join('')}
      </div>
    </section>`;
  }

  function scoringRoster(team) {
    const players = rosterPlayers(team);
    return `<section class="rp-video-score-team"><div class="rp-video-score-team-head"><strong>${team.toUpperCase()}</strong><span>${players.length}</span></div>${players.map((player) => `<button type="button" class="rp-video-score-player ${Number(selectedPlayerId) === Number(player.userId) ? 'active' : ''}" data-rp-video-select-player="${Number(player.userId)}">${esc(playerLabel(player))}</button>`).join('')}</section>`;
  }

  function videoPlayerHtml() {
    if (!streamUrl) return '<div class="rp-video-player-unavailable">VIDEO STREAM IS PREPARING…</div>';
    return `<div class="rp-video-player-wrap">
      <video data-rp-recorded-video src="${esc(streamUrl)}" controls playsinline preload="metadata"></video>
      <div class="rp-video-timebar"><span>VIDEO TIME</span><strong data-rp-video-time>${formatTime(playheadMs)}</strong></div>
      <div class="rp-video-marker-rail"><i></i><div data-rp-video-markers>${markerButtons()}</div></div>
      <div class="rp-video-marker-key"><span>🏀 MADE BASKET</span><small>Tap a ball to replay from 5 seconds before the make.</small></div>
    </div>`;
  }

  function scoringHtml() {
    const session = control.session;
    const completed = Boolean(recordingState.recording?.reviewCompletedAt);
    return `<div class="rp-video-screen rp-video-scoring-screen">
      <div class="rp-admin-title"><span class="rp-admin-kicker">RECORDED SCORING</span><h1>WATCH & SCORE</h1><p>Watch the full game continuously. Tap the event at the exact moment it happens.</p></div>
      ${noticeHtml()}
      ${videoPlayerHtml()}
      <div class="rp-video-auto-note"><strong>5-SECOND LEAD-IN IS AUTOMATIC</strong><span>When a MAKE is stamped at 7:32, Real Play stores the replay start at 7:27.</span></div>
      <div class="rp-video-scoreboard"><div><small>WEST</small><strong data-rp-video-score-west>${Number(session?.westScore || 0)}</strong></div><span>—</span><div><small>EAST</small><strong data-rp-video-score-east>${Number(session?.eastScore || 0)}</strong></div></div>
      <div class="rp-video-score-rosters">${scoringRoster('west')}${scoringRoster('east')}</div>
      <div data-rp-video-selected-panel>${selectedPanel()}</div>
      <div class="rp-video-review-actions">
        <button type="button" class="rp-video-undo" data-rp-video-undo ${busy ? 'disabled' : ''}>UNDO LAST EVENT</button>
        <button type="button" class="rp-video-finish" data-rp-video-finish ${busy ? 'disabled' : ''}>${completed ? 'REVIEW COMPLETE' : 'FINISH SCORING'}</button>
      </div>
    </div>`;
  }

  function finalVideoHtml() {
    return `<div class="rp-video-screen"><div class="rp-admin-title"><span class="rp-admin-kicker">RECORDED SCORING</span><h1>VIDEO LOCKED</h1><p>This game's official result has already been finalized.</p></div>${noticeHtml()}${videoPlayerHtml()}<div class="rp-video-auto-note"><strong>${(recordingState.events || []).filter((event) => event.eventType === 'shot' && event.shotResult === 'make').length} SCORING MARKERS</strong><span>The full continuous video and timestamp evidence remain attached to this game.</span></div></div>`;
  }

  function renderSetup() {
    return `<div class="rp-video-screen">
      <div class="rp-admin-title"><span class="rp-admin-kicker">POST-GAME WORKFLOW</span><h1>RECORDED SCORING</h1><p>Upload the full game, manually choose the players, then score directly from the recording.</p></div>
      ${noticeHtml()}
      ${uploadHtml()}
      ${recordingState.recording ? rosterSetupHtml() : ''}
    </div>`;
  }

  function render() {
    if (!videoMode) return;
    const adminBody = body();
    if (!adminBody) return;
    syncTabActive();
    if (!control.session) {
      adminBody.innerHTML = `<div class="rp-video-screen"><div class="rp-admin-title"><span class="rp-admin-kicker">RECORDED SCORING</span><h1>VIDEO REVIEW</h1></div>${noticeHtml()}<div class="rp-admin-empty"><strong>NO ACTIVE GAME</strong><p>Open a Real Play session first, then return to VIDEO.</p></div></div>`;
      return;
    }
    if (control.session.gameStatus === 'final') adminBody.innerHTML = finalVideoHtml();
    else if (control.session.gameStatus === 'live' && recordingState.recording?.reviewStartedAt) adminBody.innerHTML = scoringHtml();
    else adminBody.innerHTML = renderSetup();
    bindVideoPlayback();
  }

  function rememberPlayback() {
    const video = body()?.querySelector('[data-rp-recorded-video]');
    if (!video) return;
    playheadMs = Math.round(Number(video.currentTime || 0) * 1000);
    shouldResume = !video.paused && !video.ended;
    if (Number.isFinite(video.duration)) lastDurationMs = Math.round(video.duration * 1000);
  }

  function bindVideoPlayback() {
    const video = body()?.querySelector('[data-rp-recorded-video]');
    if (!video || video.dataset.rpBound === '1') return;
    video.dataset.rpBound = '1';
    const time = body()?.querySelector('[data-rp-video-time]');
    const restore = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0) {
        lastDurationMs = Math.round(duration * 1000);
        if (playheadMs > 0) video.currentTime = Math.min(duration, playheadMs / 1000);
      }
      if (shouldResume) video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', restore, { once: true });
    video.addEventListener('timeupdate', () => {
      playheadMs = Math.round(Number(video.currentTime || 0) * 1000);
      if (time) time.textContent = formatTime(playheadMs);
    });
    video.addEventListener('play', () => { shouldResume = true; });
    video.addEventListener('pause', () => { shouldResume = false; });
    video.addEventListener('ended', () => { shouldResume = false; });
  }

  function currentVideoTimestamp() {
    const video = body()?.querySelector('[data-rp-recorded-video]');
    if (!video) throw new Error('Game video is not ready.');
    return Math.round(Number(video.currentTime || 0) * 1000);
  }

  async function videoDurationMs(file) {
    return new Promise((resolve) => {
      const preview = document.createElement('video');
      const url = URL.createObjectURL(file);
      const finish = (value) => {
        URL.revokeObjectURL(url);
        preview.remove();
        resolve(value);
      };
      preview.preload = 'metadata';
      preview.onloadedmetadata = () => finish(Number.isFinite(preview.duration) ? Math.round(preview.duration * 1000) : null);
      preview.onerror = () => finish(null);
      preview.src = url;
    });
  }

  async function uploadVideo(file) {
    if (!file || busy || !control.session) return;
    busy = true;
    uploadProgress = 0.5;
    notice = '';
    noticeType = '';
    render();
    try {
      const durationMs = await videoDurationMs(file);
      const start = await api('/api/real-play/admin/recorded-scoring/uploads', {
        method: 'POST',
        json: {
          session_id: Number(control.session.id),
          mime_type: file.type || 'video/mp4',
          original_name: file.name || 'real-play-game.mp4',
          size_bytes: file.size,
        },
      });
      const chunkSize = Number(start.chunk_size_bytes);
      const totalChunks = Number(start.total_chunks);
      for (let index = 0; index < totalChunks; index += 1) {
        const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
        await api(`/api/real-play/admin/recorded-scoring/uploads/${start.upload_id}/chunks/${index}`, {
          method: 'PUT',
          body: chunk,
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        uploadProgress = ((index + 1) / totalChunks) * 94;
        const progress = body()?.querySelector('.rp-video-progress i');
        const label = body()?.querySelector('.rp-video-progress-label');
        if (progress) progress.style.width = `${uploadProgress}%`;
        if (label) label.textContent = `UPLOADING ${Math.round(uploadProgress)}%`;
      }
      const completed = await api(`/api/real-play/admin/recorded-scoring/uploads/${start.upload_id}/complete`, {
        method: 'POST',
        json: { duration_ms: durationMs },
      });
      recordingState = { recording: completed.recording || null, events: completed.events || [] };
      streamUrl = '';
      streamForUploadAt = recordingState.recording?.uploadedAt || '';
      await ensureStream();
      uploadProgress = 100;
      notice = 'Full game video uploaded. Now choose the exact players in this recording.';
      noticeType = 'success';
    } catch (error) {
      notice = error.message || 'Video upload failed.';
      noticeType = 'error';
      uploadProgress = 0;
    } finally {
      busy = false;
      render();
    }
  }

  async function searchUnclaimed(query) {
    const q = String(query || '').trim();
    if (q.length < SEARCH_MIN) {
      unclaimedMatches = [];
      updateSearchResults();
      return;
    }
    try {
      const data = await api(`/api/real-play/profile-ownership/unclaimed?q=${encodeURIComponent(q)}`);
      if (searchQuery.trim() === q) {
        unclaimedMatches = Array.isArray(data?.profiles) ? data.profiles : [];
        updateSearchResults();
      }
    } catch (_) {
      if (searchQuery.trim() === q) {
        unclaimedMatches = [];
        updateSearchResults();
      }
    }
  }

  function updateSearchResults() {
    const wrap = body()?.querySelector('[data-rp-video-search-results]');
    if (wrap) wrap.innerHTML = searchResultsHtml();
  }

  function patchRosterSetupDOM() {
    const adminBody = body();
    const section = adminBody?.querySelector('[data-rp-video-roster-setup]');
    if (!section) return false;

    const rules = control.session?.rules || null;
    const expected = Number(rules?.playersPerSide || 0);
    const west = rosterPlayers('west').length;
    const east = rosterPlayers('east').length;
    const rosterReady = expected > 0 && west === expected && east === expected;
    const canStart = Boolean(recordingState.recording) && rosterReady && !busy;

    const rosters = section.querySelector('.rp-video-rosters');
    if (rosters) rosters.innerHTML = `${rosterCard('west')}${rosterCard('east')}`;

    const check = section.querySelector('.rp-video-roster-check');
    if (check) {
      check.classList.toggle('ready', rosterReady);
      check.textContent = rules
        ? `${control.session?.rulesLabel || ''} needs exactly ${expected} West + ${expected} East. Current: ${west} + ${east}.`
        : 'Set the game rules to validate the roster size.';
    }

    const start = section.querySelector('[data-rp-video-start]');
    if (start) start.disabled = !canStart;

    section.classList.toggle('complete', rosterReady);
    updateSearchResults();
    return true;
  }

  async function mutateRoster(payload, successText = '') {
    if (busy) return;
    busy = true;
    notice = '';

    const searchInput = body()?.querySelector('[data-rp-video-search]');
    const hadFocus = document.activeElement === searchInput;
    const caretStart = searchInput?.selectionStart ?? null;
    const caretEnd = searchInput?.selectionEnd ?? null;

    try {
      await controlAction(payload);
      notice = successText;
      noticeType = 'success';
      busy = false;

      // Roster changes should not remount the YouTube/video workspace.
      // Patch only the roster/search/readiness nodes in place.
      if (!patchRosterSetupDOM()) render();

      const nextInput = body()?.querySelector('[data-rp-video-search]');
      if (hadFocus && nextInput) {
        nextInput.focus({ preventScroll: true });
        if (caretStart !== null && caretEnd !== null && typeof nextInput.setSelectionRange === 'function') {
          try { nextInput.setSelectionRange(caretStart, caretEnd); } catch (_) {}
        }
      }
    } catch (error) {
      notice = error.message || 'Roster update failed.';
      noticeType = 'error';
      busy = false;
      // Keep the page stable even on roster errors unless the setup section vanished.
      if (!patchRosterSetupDOM()) render();
    }
  }

  async function createPlayerAndAdd(form) {
    if (busy) return;
    const data = new FormData(form);
    const playerName = String(data.get('playerName') || '').trim().replace(/\s+/g, ' ');
    const team = String(data.get('team') || 'west');
    if (playerName.length < 2) return;
    busy = true;
    notice = '';
    render();
    try {
      const created = await api('/api/real-play/admin/profile-ownership/unclaimed', {
        method: 'POST',
        json: { playerName },
      });
      const profileId = Number(created?.profile?.playerId || created?.profile?.id);
      if (!profileId) throw new Error('Player profile was created but could not be selected.');
      await controlAction({ action: 'video-roster-add', unclaimedPlayerId: profileId, team });
      createOpen = false;
      notice = `${created?.profile?.playerName || playerName} created and added to ${team.toUpperCase()}.`;
      noticeType = 'success';
      searchQuery = '';
      unclaimedMatches = [];
    } catch (error) {
      notice = error.message || 'Could not create the player.';
      noticeType = 'error';
      createOpen = true;
    } finally {
      busy = false;
      render();
    }
  }

  async function setRules(payload) {
    if (busy) return;
    busy = true;
    notice = '';
    try {
      await controlAction({ action: 'set-rules', ...payload });
      notice = `${control.session?.rulesLabel || 'Game rules'} selected.`;
      noticeType = 'success';
    } catch (error) {
      notice = error.message || 'Could not set game rules.';
      noticeType = 'error';
    } finally {
      busy = false;
      render();
    }
  }

  async function startVideoScoring() {
    if (busy) return;
    if (!window.confirm('Start recorded scoring? The selected roster and game rules will lock for this game.')) return;
    busy = true;
    notice = '';
    render();
    try {
      await controlAction({ action: 'start-video-review' });
      await loadRecordingState();
      selectedPlayerId = null;
      playheadMs = 0;
      shouldResume = false;
      notice = 'Recorded scoring started. Tap each event at the exact video moment it happens.';
      noticeType = 'success';
    } catch (error) {
      notice = error.message || 'Could not start recorded scoring.';
      noticeType = 'error';
    } finally {
      busy = false;
      render();
    }
  }

  function updateScoringDOM() {
    if (!videoMode) return;
    const adminBody = body();
    const west = adminBody?.querySelector('[data-rp-video-score-west]');
    const east = adminBody?.querySelector('[data-rp-video-score-east]');
    if (west) west.textContent = Number(control.session?.westScore || 0);
    if (east) east.textContent = Number(control.session?.eastScore || 0);
    const markers = adminBody?.querySelector('[data-rp-video-markers]');
    if (markers) markers.innerHTML = markerButtons();
    const panel = adminBody?.querySelector('[data-rp-video-selected-panel]');
    if (panel) panel.innerHTML = selectedPanel();
    adminBody?.querySelectorAll('[data-rp-video-select-player]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.rpVideoSelectPlayer) === Number(selectedPlayerId));
    });
  }

  async function scoreVideoEvent(payload) {
    if (busy || !selectedPlayerId) return;
    const timestamp = currentVideoTimestamp();
    busy = true;
    const clickedTime = timestamp;
    try {
      await controlAction({ ...payload, userId: Number(selectedPlayerId), videoTimestampMs: timestamp });
      await loadRecordingState();
      playheadMs = clickedTime;
      notice = '';
      updateScoringDOM();
    } catch (error) {
      notice = error.message || 'Could not record that event.';
      noticeType = 'error';
      render();
    } finally {
      busy = false;
    }
  }

  async function undoVideoEvent() {
    if (busy) return;
    busy = true;
    try {
      await controlAction({ action: 'undo-video-event' });
      await loadRecordingState();
      notice = 'Last recorded event undone.';
      noticeType = 'success';
      updateScoringDOM();
    } catch (error) {
      notice = error.message || 'Nothing could be undone.';
      noticeType = 'error';
      render();
    } finally {
      busy = false;
    }
  }

  async function finishScoring() {
    if (busy || !control.session) return;
    const video = body()?.querySelector('[data-rp-recorded-video]');
    const durationMs = video && Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : recordingState.recording?.durationMs || null;
    if (!window.confirm('Confirm that you finished watching and scoring the full continuous game video?')) return;
    busy = true;
    try {
      const data = await api('/api/real-play/admin/recorded-scoring/complete-review', {
        method: 'POST',
        json: { session_id: Number(control.session.id), duration_ms: durationMs },
      });
      recordingState = { recording: data.recording || recordingState.recording, events: data.events || recordingState.events };
      notice = 'Video review complete. Review the final score and stats before finalizing.';
      noticeType = 'success';
      videoMode = false;
      syncTabActive();
      root()?.querySelector('[data-admin-tab="finalize"]')?.click();
    } catch (error) {
      notice = error.message || 'Could not complete video review.';
      noticeType = 'error';
      render();
    } finally {
      busy = false;
    }
  }

  document.addEventListener('change', (event) => {
    if (!videoMode) return;
    const input = event.target.closest('[data-rp-video-file]');
    if (input?.files?.[0]) uploadVideo(input.files[0]);
  });

  document.addEventListener('input', (event) => {
    if (!videoMode) return;
    const input = event.target.closest('[data-rp-video-search]');
    if (!input) return;
    searchQuery = input.value || '';
    updateSearchResults();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUnclaimed(searchQuery.trim()), 220);
  });

  document.addEventListener('submit', (event) => {
    if (!videoMode) return;
    const createForm = event.target.closest('[data-rp-video-create-form]');
    if (createForm) {
      event.preventDefault();
      createPlayerAndAdd(createForm);
      return;
    }
    const raceForm = event.target.closest('[data-rp-video-race-form]');
    if (raceForm) {
      event.preventDefault();
      const data = new FormData(raceForm);
      setRules({ rulesetFamily: 'race_to', targetScore: Number(data.get('target')), playerFormat: String(data.get('format') || '3v3') });
    }
  });

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const baseTab = event.target.closest('[data-admin-tab]');
    if (baseTab) {
      if (videoMode) rememberPlayback();
      videoMode = false;
      syncTabActive();
      return;
    }
    if (!videoMode) return;

    const add = event.target.closest('[data-rp-video-add]');
    if (add) {
      const kind = add.dataset.kind;
      const id = Number(add.dataset.id);
      const team = add.dataset.team;
      mutateRoster({
        action: 'video-roster-add',
        ...(kind === 'registered' ? { userId: id } : { unclaimedPlayerId: id }),
        team,
      }, `Player added to ${String(team).toUpperCase()}.`);
      return;
    }

    const remove = event.target.closest('[data-rp-video-remove]');
    if (remove) {
      mutateRoster({ action: 'video-roster-remove', userId: Number(remove.dataset.playerId) }, 'Player removed from this game roster.');
      return;
    }

    const move = event.target.closest('[data-rp-video-switch]');
    if (move) {
      mutateRoster({ action: 'video-roster-team', userId: Number(move.dataset.playerId), team: move.dataset.rpVideoSwitch }, 'Team updated.');
      return;
    }

    if (event.target.closest('[data-rp-video-create-toggle]')) {
      createOpen = !createOpen;
      render();
      return;
    }

    if (event.target.closest('[data-rp-video-rule-standard]')) {
      setRules({ rulesetFamily: 'standard' });
      return;
    }

    if (event.target.closest('[data-rp-video-start]')) {
      startVideoScoring();
      return;
    }

    const player = event.target.closest('[data-rp-video-select-player]');
    if (player) {
      selectedPlayerId = Number(player.dataset.rpVideoSelectPlayer);
      updateScoringDOM();
      return;
    }

    if (event.target.closest('[data-rp-video-close-player]')) {
      selectedPlayerId = null;
      updateScoringDOM();
      return;
    }

    const shot = event.target.closest('[data-rp-video-shot]');
    if (shot) {
      scoreVideoEvent({ action: 'video-shot', shotValue: Number(shot.dataset.value), result: shot.dataset.result });
      return;
    }

    const stat = event.target.closest('[data-rp-video-stat]');
    if (stat) {
      scoreVideoEvent({ action: 'video-stat', stat: stat.dataset.rpVideoStat });
      return;
    }

    const marker = event.target.closest('[data-rp-video-marker]');
    if (marker) {
      const video = body()?.querySelector('[data-rp-recorded-video]');
      if (video) {
        const seekMs = Math.max(0, Number(marker.dataset.rpVideoMarker || 0));
        video.currentTime = seekMs / 1000;
        playheadMs = seekMs;
        video.play().catch(() => {});
      }
      return;
    }

    if (event.target.closest('[data-rp-video-undo]')) {
      undoVideoEvent();
      return;
    }

    if (event.target.closest('[data-rp-video-finish]')) {
      finishScoring();
    }
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    ensureTab();
    if (!videoMode) return;
    syncTabActive();
    // Base Game Control may repaint after its own server poll. Restore the
    // recorded-scoring workspace while preserving the current video playhead.
    window.requestAnimationFrame(() => {
      if (!videoMode) return;
      render();
    });
  });

  const observer = new MutationObserver(() => ensureTab());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab, { once: true });
  else ensureTab();
})();
