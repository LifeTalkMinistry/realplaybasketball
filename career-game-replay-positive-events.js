(() => {
  if (window.__realPlayReplayPositiveEventsInstalled) return;
  window.__realPlayReplayPositiveEventsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISIBLE_MS = 1500;
  const POLL_MS = 120;
  const TYPES = new Map([
    ['reb', 'REBOUND BY'],
    ['rebound', 'REBOUND BY'],
    ['rebounds', 'REBOUND BY'],
    ['stl', 'STEAL BY'],
    ['steal', 'STEAL BY'],
    ['steals', 'STEAL BY'],
    ['blk', 'BLOCK BY'],
    ['block', 'BLOCK BY'],
    ['blocks', 'BLOCK BY'],
  ]);
  const AUDIT_STAMPS = {
    score: { text: '🏀', label: 'SCORE', leadMs: 7000 },
    miss: { text: '×', label: 'MISS', leadMs: 5000 },
    ast: { text: 'A', label: 'ASSIST', leadMs: 5000 },
    reb: { text: 'R', label: 'REBOUND', leadMs: 5000 },
    to: { text: 'TO', label: 'TURNOVER', leadMs: 5000 },
    stl: { text: 'S', label: 'STEAL', leadMs: 5000 },
    blk: { text: 'B', label: 'BLOCK', leadMs: 5000 },
    foul: { text: 'F', label: 'FOUL', leadMs: 5000 },
  };

  let replayData = null;
  let replaySessionId = 0;
  let ticker = null;
  let lastClockMs = 0;
  let queue = [];
  let activeTimer = null;
  let activeKey = '';
  let sessionToken = 0;
  let auditTimelineSignature = '';

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-positive-pop{
      position:absolute;
      z-index:5;
      right:10px;
      bottom:10px;
      display:flex;
      align-items:center;
      gap:.55rem;
      width:auto;
      min-width:190px;
      max-width:min(72%,360px);
      min-height:58px;
      box-sizing:border-box;
      padding:10px 13px;
      border:1px solid transparent;
      border-radius:14px;
      background:
        linear-gradient(158deg,rgba(5,11,18,.96),rgba(3,6,11,.985)) padding-box,
        linear-gradient(112deg,rgba(19,152,255,.50),rgba(119,129,151,.18) 50%,rgba(255,53,66,.44)) border-box;
      box-shadow:
        0 16px 42px rgba(0,0,0,.40),
        -10px 0 28px rgba(0,117,255,.065),
        10px 0 28px rgba(255,37,51,.05);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      opacity:0;
      transform:translateY(7px);
      pointer-events:none;
      transition:opacity .16s ease,transform .16s ease;
    }
    .rp-career-replay-positive-pop.show{opacity:1;transform:translateY(0)}
    .rp-career-replay-positive-pop span{
      flex:0 0 auto;
      color:#46b6ff;
      font-size:.58rem;
      font-weight:950;
      line-height:1;
      letter-spacing:.12em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-positive-pop span::after{
      content:' · ';
      margin-left:.34rem;
      color:#768392;
    }
    .rp-career-replay-positive-pop strong{
      min-width:0;
      max-width:230px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:#fff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.86rem;
      font-style:italic;
      font-weight:950;
      line-height:1;
    }

    /* Finalized replays use the exact persisted audit timeline, not only made baskets. */
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind]{
      display:grid;
      place-items:center;
      width:22px;
      height:22px;
      padding:0;
      border:1px solid rgba(111,174,196,.30);
      border-radius:50%;
      background:#071824;
      color:#dff8ff;
      font:950 7px/1 system-ui,sans-serif;
      letter-spacing:-.02em;
      box-shadow:0 1px 4px rgba(0,0,0,.58);
    }
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="score"]{
      border-color:rgba(244,157,51,.56);
      background:#24170a;
      font-size:13px;
    }
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="miss"]{
      border-color:rgba(210,101,101,.42);
      background:#231015;
      color:#ffb2b8;
      font-size:13px;
    }
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="ast"]{border-color:rgba(54,216,245,.5);color:#9cefff}
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="reb"]{border-color:rgba(121,214,171,.46);color:#adf2d1}
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="to"],
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="foul"]{border-color:rgba(232,120,120,.42);color:#ffb3b3}
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="stl"],
    .rp-career-replay-timeline-marker[data-rp-career-audit-kind="blk"]{border-color:rgba(167,142,245,.46);color:#d2c5ff}

    .rp-career-replay-fullscreen-marker[data-rp-career-audit-kind]:not([data-rp-career-audit-kind="score"]),
    .rp-career-replay-game-skip-ball[data-rp-career-audit-kind]:not([data-rp-career-audit-kind="score"]){
      font:950 9px/1 system-ui,sans-serif;
      letter-spacing:-.03em;
    }
    .rp-career-replay-fullscreen-marker[data-rp-career-audit-kind="miss"],
    .rp-career-replay-game-skip-ball[data-rp-career-audit-kind="miss"]{color:#ffb2b8}

    @media(max-width:620px){
      .rp-career-replay-positive-pop{
        right:8px;
        bottom:8px;
        min-width:170px;
        max-width:78%;
        min-height:42px;
        padding:9px 11px;
        border-radius:12px;
      }
      .rp-career-replay-positive-pop span{font-size:.52rem}
      .rp-career-replay-positive-pop strong{max-width:190px;font-size:.78rem}
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
    pop.className = 'rp-career-replay-positive-pop rp-career-replay-stat-pop';
    pop.dataset.rpCareerPositivePop = '1';
    pop.setAttribute('aria-live', 'polite');
    pop.innerHTML = '<span data-rp-career-positive-type>REBOUND BY</span><strong data-rp-career-positive-name>PLAYER</strong>';
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
    if (nameNode) nameNode.textContent = playerIdentity(item.name);
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

  function playerRecordByName(name) {
    const target = normalize(name);
    if (!target) return null;
    const pools = [
      replayData?.playerStats,
      replayData?.players,
      replayData?.roster,
      replayData?.game?.players,
      replayData?.game?.roster,
    ];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      const match = pool.find((player) => normalize(player?.playerName ?? player?.player_name ?? player?.name) === target);
      if (match) return match;
    }
    return null;
  }

  function playerIdentity(name) {
    const cleanName = String(name || 'REAL PLAY PLAYER').trim();
    const player = playerRecordByName(cleanName);
    const rawNumber = player?.playerNumber ?? player?.player_number;
    let number = rawNumber === null || rawNumber === undefined || rawNumber === '' ? '' : `#${Number(rawNumber)}`;
    if (!/^#\d+$/.test(number)) {
      const target = normalize(cleanName);
      const row = [...document.querySelectorAll('[data-rp-career-stat-player]')].find((node) =>
        normalize(node.querySelector('.rp-career-replay-stat-player-name')?.textContent) === target
      );
      const visible = String(row?.querySelector('.rp-career-replay-stat-number')?.textContent || '').trim();
      if (/^#\d+$/.test(visible)) number = visible;
    }
    return `${number || '#--'} ${cleanName}`;
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

  function eventCategory(event) {
    const type = normalize(event?.eventType ?? event?.event_type ?? event?.type);
    const shotResult = normalize(event?.shotResult ?? event?.shot_result ?? event?.result);
    if (type === 'shot' || shotResult) {
      if (['make', 'made'].includes(shotResult)) return 'score';
      if (['miss', 'missed'].includes(shotResult)) return 'miss';
    }

    const key = normalize(event?.statKey ?? event?.stat_key ?? event?.stat ?? event?.key);
    if (['ast', 'assist', 'assists'].includes(key)) return 'ast';
    if (['reb', 'rebound', 'rebounds'].includes(key)) return 'reb';
    if (['to', 'tov', 'turnover', 'turnovers'].includes(key)) return 'to';
    if (['stl', 'steal', 'steals'].includes(key)) return 'stl';
    if (['blk', 'block', 'blocks'].includes(key)) return 'blk';
    if (['foul', 'fouls'].includes(key)) return 'foul';
    return null;
  }

  function eventReplayStartMs(event, category) {
    const stamp = Math.max(0, eventTimestampMs(event));
    if (category === 'score') {
      const stored = Number(event?.replayStartMs ?? event?.replay_start_ms);
      if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
    }
    return Math.max(0, Math.round(stamp - (AUDIT_STAMPS[category]?.leadMs || 5000)));
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function finalizedTimelineEvents() {
    if (!replayData) return [];
    const source = Array.isArray(replayData?.timelineEvents)
      ? replayData.timelineEvents
      : Array.isArray(replayData?.timeline_events)
        ? replayData.timeline_events
        : [];

    const rows = source.length
      ? source
      : (Array.isArray(replayData?.markers)
        ? replayData.markers.map((marker) => ({ ...marker, eventType: 'shot', shotResult: 'make' }))
        : []);

    const seen = new Set();
    return rows
      .map((event, index) => {
        const category = eventCategory(event);
        if (!category || !AUDIT_STAMPS[category]) return null;
        const stamp = Math.max(0, eventTimestampMs(event));
        const replayStart = eventReplayStartMs(event, category);
        const rawId = event?.eventId ?? event?.event_id ?? event?.id ?? '';
        const name = playerName(event);
        const key = rawId !== '' ? String(rawId) : `${category}:${stamp}:${name}:${index}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return { key, category, stamp, replayStart, name };
      })
      .filter(Boolean)
      .sort((a, b) => a.stamp - b.stamp || a.replayStart - b.replayStart);
  }

  function renderAuditTimeline() {
    if (!replayData) return;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    const layer = viewer?.querySelector('[data-rp-career-replay-timeline-markers]');
    if (!layer) return;

    const events = finalizedTimelineEvents();
    if (!events.length) return;

    const signature = `${replaySessionId}|${events.map((item) => `${item.key}:${item.category}:${item.stamp}:${item.replayStart}`).join('|')}`;
    const existingCount = layer.querySelectorAll('[data-rp-career-audit-marker]').length;
    if (auditTimelineSignature === signature
      && layer.dataset.rpAuditTimelineSignature === signature
      && existingCount === events.length) return;

    const fragment = document.createDocumentFragment();
    events.forEach((item) => {
      const meta = AUDIT_STAMPS[item.category];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-career-replay-timeline-marker';
      button.dataset.rpCareerReplayMarker = String(item.replayStart);
      button.dataset.rpCareerMarkerStamp = String(item.stamp);
      button.dataset.rpCareerAuditMarker = '1';
      button.dataset.rpCareerAuditKind = item.category;
      button.textContent = meta.text;
      const who = item.name ? ` · ${playerIdentity(item.name)}` : '';
      const title = `${meta.label}${who} · ${formatTime(item.stamp)}`;
      button.setAttribute('aria-label', `Jump to ${title}`);
      button.title = title;
      fragment.appendChild(button);
    });

    layer.replaceChildren(fragment);
    layer.dataset.rpAuditTimelineSignature = signature;
    auditTimelineSignature = signature;
  }

  function copyAuditMarkerPresentation(source, target) {
    if (!source || !target) return;
    target.textContent = source.textContent || '•';
    const kind = String(source.dataset.rpCareerAuditKind || '');
    if (kind) target.dataset.rpCareerAuditKind = kind;
    else delete target.dataset.rpCareerAuditKind;
    const label = source.getAttribute('aria-label');
    if (label) target.setAttribute('aria-label', label);
    if (source.title) target.title = source.title;
  }

  function syncDerivedAuditMarkers() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) return;
    const sources = [...viewer.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-audit-marker]')];
    if (!sources.length) return;

    const fullscreen = [...viewer.querySelectorAll('[data-rp-career-replay-fullscreen-marker]')];
    fullscreen.forEach((target, index) => copyAuditMarkerPresentation(sources[index], target));

    const iphone = [...viewer.querySelectorAll('[data-rp-career-replay-game-skip-ball]')];
    iphone.forEach((target, index) => copyAuditMarkerPresentation(sources[index], target));
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

  function parseClockMs(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
    return Math.round(parts[0] * 1000);
  }

  function parseCurrentClockMs() {
    const clock = document.querySelector('[data-rp-career-replay].open [data-rp-career-replay-clock]');
    const current = String(clock?.textContent || '').split('/')[0].trim();
    return parseClockMs(current);
  }

  function parseDurationClockMs(viewer) {
    const clock = viewer?.querySelector('[data-rp-career-replay-clock]');
    const duration = String(clock?.textContent || '').split('/')[1]?.trim();
    const fromClock = parseClockMs(duration);
    if (fromClock > 0) return fromClock;
    const video = viewer?.querySelector('video');
    const seconds = Number(video?.duration || 0);
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
  }

  function seekAuditMarker(marker) {
    const viewer = marker?.closest?.('[data-rp-career-replay]') || document.querySelector('[data-rp-career-replay].open');
    if (!viewer) return;
    const targetMs = Math.max(0, Number(marker.dataset.rpCareerReplayMarker || 0));
    const duration = parseDurationClockMs(viewer);
    const seek = viewer.querySelector('[data-rp-career-replay-seek]');

    if (seek && duration > 0) {
      seek.value = String(Math.max(0, Math.min(1000, Math.round(targetMs / duration * 1000))));
      seek.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const video = viewer.querySelector('video');
      if (video) {
        try { video.currentTime = targetMs / 1000; } catch (_) {}
      }
    }

    const play = viewer.querySelector('[data-rp-career-replay-play]');
    if (play && !String(play.textContent || '').includes('❚')) play.click();
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
    renderAuditTimeline();
    syncDerivedAuditMarkers();
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
    auditTimelineSignature = '';
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
      renderAuditTimeline();
      syncDerivedAuditMarkers();
      startTicker();
    } catch (_) {
      if (requestToken === sessionToken && replaySessionId === id) replayData = null;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-rp-career-replay-session]');
    if (button) loadReplayData(button.dataset.rpCareerReplaySession);
  }, true);

  document.addEventListener('click', (event) => {
    const marker = event.target?.closest?.('[data-rp-career-replay-timeline-markers] [data-rp-career-audit-marker]');
    if (!marker) return;
    event.preventDefault();
    event.stopPropagation();
    seekAuditMarker(marker);
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    replayData = null;
    replaySessionId = 0;
    queue = [];
    auditTimelineSignature = '';
    clearActive();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTicker, { once: true });
  } else {
    startTicker();
  }
})();