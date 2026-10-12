(() => {
  if (window.RealPlayGameEngagement) return;

  const API = 'https://api.clarapmc.com/api/real-play/public';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_game_viewer_id_v1';
  const cache = new Map();
  const loadedAt = new Map();
  const pending = new Set();
  const attempts = new Map();
  const counted = new Set();
  const inflight = new Set();
  const number = new Intl.NumberFormat('en');
  let flushTimer = null;
  let videoSessionId = 0;
  let videoMs = 0;
  let videoTick = 0;
  let storySessionId = 0;
  let storyTimer = null;
  let storyActiveAt = 0;

  function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  }

  function visitorId() {
    try {
      const stored = window.localStorage.getItem(VISITOR_KEY);
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored || '')) return stored;
      const generated = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, generated);
      return generated;
    } catch (_) {
      // Session-only identity if storage is blocked; no account is required.
      if (!visitorId.fallback) visitorId.fallback = crypto.randomUUID();
      return visitorId.fallback;
    }
  }

  function paint(id, values) {
    const video = Math.max(0, Number(values?.videoViews || 0));
    document.querySelectorAll('[data-rp-game-view-counts]').forEach((el) => {
      if (Number(el.dataset.rpGameViewCounts) !== id) return;
      const videoNode = el.querySelector('[data-rp-video-view-count]');
      if (videoNode) videoNode.textContent = number.format(video);
      el.setAttribute('aria-label', `${number.format(video)} video views`);
    });
  }

  async function flushCounts() {
    const ids = [...pending].slice(0, 50);
    ids.forEach((id) => pending.delete(id));
    flushTimer = null;
    if (!ids.length) return;
    const now = Date.now();
    ids.forEach((id) => loadedAt.set(id, now)); // prevents rerender-request loops
    try {
      const response = await fetch(`${API}/games/views?ids=${ids.join(',')}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Counters unavailable');
      const data = await response.json();
      ids.forEach((id) => {
        // A new view may have been accepted while this older GET was pending.
        if (Number(loadedAt.get(id)) > now) return;
        const values = data?.counts?.[String(id)] || { videoViews: 0, storyViews: 0 };
        cache.set(id, values);
        paint(id, values);
      });
    } catch (_) {
      // Never show an invented zero when the authoritative API is unavailable.
      ids.forEach((id) => loadedAt.set(id, now - 20000));
    }
    if (pending.size) flushTimer = setTimeout(flushCounts, 70);
  }

  function mountCard(card, rawId) {
    const id = validId(rawId);
    if (!card || !id) return;
    const values = cache.get(id);
    if (values) paint(id, values);
    if (Date.now() - Number(loadedAt.get(id) || 0) < 30000) return;
    pending.add(id);
    if (!flushTimer) flushTimer = setTimeout(flushCounts, 70);
  }

  async function postView(id, type, seconds) {
    const key = `${type}:${id}`;
    if (counted.has(key) || inflight.has(key)) return;
    if (Date.now() < Number(attempts.get(key) || 0)) return;
    attempts.set(key, Date.now() + 12000);
    inflight.add(key);
    try {
      let authorization = null;
      try { authorization = window.localStorage.getItem(TOKEN_KEY); } catch (_) {}
      const body = JSON.stringify({ type, visitorId: visitorId(), watchedSeconds: seconds });
      const send = (token) => fetch(`${API}/games/${id}/views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
      let response = await send(authorization);
      // Expired account tokens may still observe public games as guests.
      if (response.status === 401 && authorization) response = await send(null);
      if (!response.ok) throw new Error('Could not record view');
      const data = await response.json();
      if (!data.ok) throw new Error('View was not accepted');
      counted.add(key);
      const values = { videoViews: Number(data.videoViews || 0), storyViews: Number(data.storyViews || 0) };
      cache.set(id, values);
      loadedAt.set(id, Date.now());
      paint(id, values);
    } catch (_) {
      // A later qualifying session can retry without spamming the API.
    } finally {
      inflight.delete(key);
    }
  }

  // Invoked by the actual replay player while its media state is PLAYING.
  // Measure elapsed wall time rather than seek position (skipping is not a view).
  function videoActivity(rawId, playing) {
    const id = validId(rawId);
    if (id !== videoSessionId) {
      videoSessionId = id;
      videoMs = 0;
      videoTick = 0;
    }
    if (!id || counted.has(`video:${id}`) || !playing || document.visibilityState === 'hidden') {
      videoTick = 0;
      return;
    }
    const now = performance.now();
    if (videoTick) {
      const delta = now - videoTick;
      if (delta > 0 && delta < 2000) videoMs += delta;
    }
    videoTick = now;
    if (videoMs >= 10000) postView(id, 'video', Math.max(10, videoMs / 1000));
  }

  function stopStoryTimer() {
    if (storyTimer) clearTimeout(storyTimer);
    storyTimer = null;
    storyActiveAt = 0;
  }

  function resumeStoryTimer() {
    stopStoryTimer();
    if (!storySessionId || document.visibilityState === 'hidden') return;
    storyActiveAt = Date.now();
    const id = storySessionId;
    storyTimer = setTimeout(() => {
      if (storySessionId !== id || document.visibilityState === 'hidden') return;
      const viewer = document.querySelector('[data-rp-game-story-viewer]');
      if (!viewer || viewer.hidden) return;
      postView(id, 'story', Math.max(5, (Date.now() - storyActiveAt) / 1000));
    }, 5200);
  }

  function storyOpened(rawId) {
    storySessionId = validId(rawId);
    resumeStoryTimer();
  }

  function storyClosed() {
    storySessionId = 0;
    stopStoryTimer();
  }

  document.addEventListener('visibilitychange', () => {
    videoTick = 0;
    if (storySessionId) resumeStoryTimer();
  });

  window.RealPlayGameEngagement = {
    mountCard,
    videoActivity,
    storyOpened,
    storyClosed,
  };
})();
