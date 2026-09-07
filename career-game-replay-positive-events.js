(() => {
  if (window.__realPlayReplayPositiveEventsInstalled) return;
  window.__realPlayReplayPositiveEventsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISIBLE_MS = 1500;
  const POLL_MS = 120;
  const TYPES = new Map([
    ['reb', 'REB'],
    ['rebound', 'REB'],
    ['rebounds', 'REB'],
    ['stl', 'STL'],
    ['steal', 'STL'],
    ['steals', 'STL'],
    ['blk', 'BLK'],
    ['block', 'BLK'],
    ['blocks', 'BLK'],
  ]);

  let replayData = null;
  let replaySessionId = 0;
  let ticker = null;
  let lastClockMs = 0;
  let queue = [];
  let activeTimer = null;
  let activeKey = '';
  let sessionToken = 0;

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-positive-pop{
      position:absolute;z-index:5;right:10px;bottom:10px;display:flex;align-items:center;gap:.3rem;
      width:auto;max-width:calc(100% - 20px);min-height:30px;box-sizing:border-box;padding:6px 9px;
      border:1px solid rgba(94,226,247,.22);border-radius:9px;
      background:linear-gradient(105deg,rgba(3,18,27,.9),rgba(5,35,47,.84));
      box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
      opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .16s ease,transform .16s ease
    }
    .rp-career-replay-positive-pop.show{opacity:1;transform:translateY(0)}
    .rp-career-replay-positive-pop span{
      flex:0 0 auto;color:#70dfee;font-size:.5rem;font-weight:950;line-height:1;letter-spacing:.08em;
      text-transform:uppercase;white-space:nowrap
    }
    .rp-career-replay-positive-pop span::after{content:' · ';margin-left:.28rem;color:#6f8f9c}
    .rp-career-replay-positive-pop strong{
      min-width:0;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      color:#f4fbff;font-family:var(--rp-display,Arial,sans-serif);font-size:.72rem;font-style:italic;
      font-weight:950;line-height:1
    }
    @media(max-width:620px){
      .rp-career-replay-positive-pop{right:8px;bottom:8px;max-width:calc(100% - 16px);min-height:28px;padding:5px 8px;border-radius:8px}
      .rp-career-replay-positive-pop span{font-size:.46rem}
      .rp-career-replay-positive-pop strong{max-width:165px;font-size:.66rem}
    }
    @media(prefers-reduced-motion:reduce){.rp-career-replay-positive-pop{transition:none}}
  `;
  document.head.appendChild(style);

  function clearActive() {
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    activeKey = '';
    document.querySelectorAll('[data-rp-career-positive-pop].show').forEach((node) => node.classList.remove('show'));
  }

  function ensurePop() {
    const stage = document.querySelector('[data-rp-career-replay].open [data-rp-career-replay-stage]');
    if (!stage) return null;
    let pop = stage.querySelector('[data-rp-career-positive-pop]');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'rp-career-replay-positive-pop';
    pop.dataset.rpCareerPositivePop = '1';
    pop.setAttribute('aria-live', 'polite');
    pop.innerHTML = '<span data-rp-career-positive-type>REB</span><strong data-rp-career-positive-name>PLAYER</strong>';
    stage.appendChild(pop);
    return pop;
  }

  function isAttentionBusy() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) return true;
    return Boolean(
      viewer.querySelector('[data-rp-career-score-pop].show')
      || viewer.querySelector('[data-rp-career-assist-pop].show')
      || viewer.querySelector('[data-rp-career-positive-pop].show')
    );
  }

  function showEvent(item) {
    const pop = ensurePop();
    if (!pop) return;
    const typeNode = pop.querySelector('[data-rp-career-positive-type]');
    const nameNode = pop.querySelector('[data-rp-career-positive-name]');
    if (typeNode) typeNode.textContent = item.label;
    if (nameNode) nameNode.textContent = item.name || 'REAL PLAY PLAYER';
    activeKey = item.key;
    pop.classList.add('show');
    activeTimer = setTimeout(() => {
      pop.classList.remove('show');
      activeTimer = null;
      activeKey = '';
    }, VISIBLE_MS);
  }

  function playerRecordFromId(id) {
    if (id === null || id === undefined || id === '') return null;
    const target = String(id);
    const pools = [
      replayData?.playerStats,
      replayData?.players,
      replayData?.roster,
      replayData?.game?.players,
      replayData?.game?.roster,
    ];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      const match = pool.find((candidate) => {
        const candidateId = candidate?.playerId ?? candidate?.player_id ?? candidate?.id ?? candidate?.userId ?? candidate?.user_id;
        return candidateId !== null && candidateId !== undefined && String(candidateId) === target;
      });
      if (match) return match;
    }
    return null;
  }

  function playerName(event) {
    const direct = event?.playerName ?? event?.player_name ?? event?.name;
    if (String(direct || '').trim()) return String(direct).trim();
    const player = playerRecordFromId(event?.playerId ?? event?.player_id ?? event?.userId ?? event?.user_id);
    return String(player?.playerName ?? player?.player_name ?? player?.name ?? '').trim();
  }

  function eventLabel(event) {
    const type = normalize(event?.eventType ?? event?.event_type ?? event?.type);
    const stat = normalize(event?.statKey ?? event?.stat_key ?? event?.stat ?? event?.key);
    return TYPES.get(stat) || TYPES.get(type) || '';
  }

  function eventTimestampMs(event) {
    return num(
      event?.videoTimestampMs
      ?? event?.video_timestamp_ms
      ?? event?.timestampMs
      ?? event?.timestamp_ms
      ?? event?.timeMs
      ?? event?.time_ms
    );
  }

  function collectPositiveEvents() {
    if (!replayData) return [];
    const found = [];
    const seenObjects = new Set();
    const seenKeys = new Set();

    function walk(value, depth) {
      if (depth > 6 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);

      const label = eventLabel(value);
      if (label) {
        const stamp = eventTimestampMs(value);
        const name = playerName(value);
        if (stamp >= 0 && name) {
          const rawId = value?.eventId ?? value?.event_id ?? value?.id ?? '';
          const key = rawId ? String(rawId) : `${label}:${name}:${stamp}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            found.push({ key, label, name, stamp });
          }
        }
      }

      Object.values(value).forEach((child) => walk(child, depth + 1));
    }

    walk(replayData, 0);
    return found.sort((a, b) => a.stamp - b.stamp);
  }

  function parseCurrentClockMs() {
    const clock = document.querySelector('[data-rp-career-replay].open [data-rp-career-replay-clock]');
    const current = String(clock?.textContent || '').split('/')[0].trim();
    if (!current) return 0;
    const parts = current.split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
    return Math.round(parts[0] * 1000);
  }

  function resetQueueForSeek(currentMs) {
    queue = [];
    clearActive();
    lastClockMs = currentMs;
  }

  function enqueueCrossedEvents(currentMs) {
    const events = collectPositiveEvents();
    if (!events.length) return;

    if (currentMs + 900 < lastClockMs || currentMs - lastClockMs > 5000) {
      resetQueueForSeek(currentMs);
      return;
    }

    for (const item of events) {
      if (item.stamp > lastClockMs && item.stamp <= currentMs + 140) {
        if (!queue.some((queued) => queued.key === item.key) && activeKey !== item.key) queue.push(item);
      }
    }
    lastClockMs = currentMs;
  }

  function tick() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer || !replayData) return;
    const currentMs = parseCurrentClockMs();
    enqueueCrossedEvents(currentMs);
    if (!queue.length || isAttentionBusy()) return;
    showEvent(queue.shift());
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(tick, POLL_MS);
  }

  async function loadReplayData(sessionId) {
    const id = Number(sessionId || 0);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const requestToken = ++sessionToken;
    replaySessionId = id;
    replayData = null;
    queue = [];
    clearActive();
    lastClockMs = 0;

    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(id)}/replay`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || requestToken !== sessionToken || replaySessionId !== id) return;
      replayData = data;
      lastClockMs = parseCurrentClockMs();
      startTicker();
    } catch (_) {
      if (requestToken === sessionToken && replaySessionId === id) replayData = null;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-career-replay-session]');
    if (button) loadReplayData(button.dataset.rpCareerReplaySession);
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    replayData = null;
    replaySessionId = 0;
    queue = [];
    clearActive();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTicker, { once: true });
  } else {
    startTicker();
  }
})();