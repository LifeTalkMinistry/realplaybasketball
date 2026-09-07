(() => {
  if (window.__realPlayReplayAssistSequenceInstalled) return;
  window.__realPlayReplayAssistSequenceInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const ASSIST_VISIBLE_MS = 1500;
  const ASSIST_DELAY_MS = 2000;
  const ASSIST_AFTER_SCORE_WINDOW_MS = 15000;

  let replayData = null;
  let replaySessionId = 0;
  let scoreWasVisible = false;
  let assistTimer = null;
  let assistDelayTimer = null;
  let activeScorePop = null;

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-assist-pop{
      position:absolute;
      z-index:4;
      right:10px;
      bottom:10px;
      display:flex;
      align-items:center;
      gap:.3rem;
      width:auto;
      max-width:calc(100% - 20px);
      min-height:30px;
      box-sizing:border-box;
      padding:6px 9px;
      border:1px solid rgba(94,226,247,.22);
      border-radius:9px;
      background:linear-gradient(105deg,rgba(3,18,27,.9),rgba(5,35,47,.84));
      box-shadow:0 8px 24px rgba(0,0,0,.28);
      backdrop-filter:blur(9px);
      -webkit-backdrop-filter:blur(9px);
      opacity:0;
      transform:translateY(6px);
      pointer-events:none;
      transition:opacity .16s ease,transform .16s ease;
    }
    .rp-career-replay-assist-pop.show{
      opacity:1;
      transform:translateY(0);
    }
    .rp-career-replay-assist-pop span{
      flex:0 0 auto;
      color:#70dfee;
      font-family:var(--rp-body,Arial,sans-serif);
      font-size:.5rem;
      font-weight:950;
      line-height:1;
      letter-spacing:.08em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-assist-pop span::after{
      content:' · ';
      margin-left:.28rem;
      color:#6f8f9c;
    }
    .rp-career-replay-assist-pop strong{
      min-width:0;
      max-width:190px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:#f4fbff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.72rem;
      font-style:italic;
      font-weight:950;
      line-height:1;
    }
    @media(max-width:620px){
      .rp-career-replay-assist-pop{
        right:8px;
        bottom:8px;
        max-width:calc(100% - 16px);
        min-height:28px;
        padding:5px 8px;
        border-radius:8px;
      }
      .rp-career-replay-assist-pop span{font-size:.46rem}
      .rp-career-replay-assist-pop strong{max-width:165px;font-size:.66rem}
    }
    @media(prefers-reduced-motion:reduce){
      .rp-career-replay-assist-pop{transition:none}
    }
  `;
  document.head.appendChild(style);

  function clearAssistTimer() {
    if (assistTimer) {
      clearTimeout(assistTimer);
      assistTimer = null;
    }
    if (assistDelayTimer) {
      clearTimeout(assistDelayTimer);
      assistDelayTimer = null;
    }
  }

  function ensureAssistPop() {
    const stage = document.querySelector('[data-rp-career-replay].open [data-rp-career-replay-stage]');
    if (!stage) return null;
    let pop = stage.querySelector('[data-rp-career-assist-pop]');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'rp-career-replay-assist-pop';
    pop.dataset.rpCareerAssistPop = '1';
    pop.setAttribute('aria-live', 'polite');
    pop.innerHTML = '<span>AST</span><strong data-rp-career-assist-name>PLAYER</strong>';
    stage.appendChild(pop);
    return pop;
  }

  function hideAssist() {
    clearAssistTimer();
    document.querySelectorAll('[data-rp-career-assist-pop].show').forEach((pop) => pop.classList.remove('show'));
  }

  function showAssist(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    hideAssist();
    const pop = ensureAssistPop();
    if (!pop) return;
    const label = pop.querySelector('[data-rp-career-assist-name]');
    if (label) label.textContent = cleanName;
    pop.classList.add('show');
    assistTimer = setTimeout(() => {
      pop.classList.remove('show');
      assistTimer = null;
    }, ASSIST_VISIBLE_MS);
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

  function playerNameFromId(id) {
    const player = playerRecordFromId(id);
    return String(player?.playerName ?? player?.player_name ?? player?.name ?? '').trim();
  }

  function playerTeamFromId(id) {
    const player = playerRecordFromId(id);
    return normalize(player?.team ?? player?.side);
  }

  function markerTimestampMs(marker) {
    return num(marker?.videoTimestampMs ?? marker?.video_timestamp_ms ?? marker?.timestampMs ?? marker?.timestamp_ms);
  }

  function directAssistName(marker) {
    if (!marker) return '';
    const direct = marker.assistPlayerName
      ?? marker.assist_player_name
      ?? marker.assisterName
      ?? marker.assister_name
      ?? marker.assistedByName
      ?? marker.assisted_by_name
      ?? marker.assist?.playerName
      ?? marker.assist?.player_name
      ?? marker.assist?.name
      ?? marker.assistedBy?.playerName
      ?? marker.assistedBy?.name;
    if (String(direct || '').trim()) return String(direct).trim();

    const directId = marker.assistPlayerId
      ?? marker.assist_player_id
      ?? marker.assisterId
      ?? marker.assister_id
      ?? marker.assistedById
      ?? marker.assisted_by_id
      ?? marker.assist?.playerId
      ?? marker.assist?.player_id
      ?? marker.assistedBy?.playerId
      ?? marker.assistedBy?.id;
    return playerNameFromId(directId);
  }

  function isAssistEvent(event) {
    const type = normalize(event?.eventType ?? event?.event_type ?? event?.type);
    const stat = normalize(event?.statKey ?? event?.stat_key ?? event?.stat ?? event?.key);
    return ['ast', 'assist', 'assists'].includes(stat) || ['ast', 'assist', 'assists'].includes(type);
  }

  function collectAssistEvents() {
    if (!replayData) return [];
    const found = [];
    const seenObjects = new Set();

    function walk(value, depth) {
      if (depth > 6 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      if (isAssistEvent(value)) found.push(value);
      Object.values(value).forEach((child) => walk(child, depth + 1));
    }

    walk(replayData, 0);
    return found;
  }

  function eventPlayerName(event) {
    const direct = event?.playerName ?? event?.player_name ?? event?.name;
    if (String(direct || '').trim()) return String(direct).trim();
    return playerNameFromId(event?.playerId ?? event?.player_id ?? event?.userId ?? event?.user_id);
  }

  function eventPlayerTeam(event) {
    const direct = normalize(event?.team ?? event?.side);
    if (direct) return direct;
    return playerTeamFromId(event?.playerId ?? event?.player_id ?? event?.userId ?? event?.user_id);
  }

  function eventTimestampMs(event) {
    return num(event?.videoTimestampMs ?? event?.video_timestamp_ms ?? event?.timestampMs ?? event?.timestamp_ms ?? event?.timeMs ?? event?.time_ms);
  }

  function eventLinksToMarker(event, marker) {
    const markerId = marker?.eventId ?? marker?.event_id ?? marker?.id;
    if (markerId === null || markerId === undefined) return false;
    const linked = [
      event?.relatedEventId,
      event?.related_event_id,
      event?.shotEventId,
      event?.shot_event_id,
      event?.scoreEventId,
      event?.score_event_id,
      event?.parentEventId,
      event?.parent_event_id,
      event?.assistedEventId,
      event?.assisted_event_id,
    ];
    return linked.some((value) => value !== null && value !== undefined && String(value) === String(markerId));
  }

  function nextScoreTimestampAfter(marker) {
    const stamp = markerTimestampMs(marker);
    const markers = Array.isArray(replayData?.markers) ? replayData.markers : [];
    const next = markers
      .map(markerTimestampMs)
      .filter((value) => value > stamp)
      .sort((a, b) => a - b)[0];
    return Number.isFinite(next) ? next : null;
  }

  function assistNameForMarker(marker) {
    if (!marker) return '';
    const direct = directAssistName(marker);
    if (direct) return direct;

    const scorerName = normalize(marker?.playerName ?? marker?.player_name);
    const scorerTeam = normalize(marker?.team);
    const scoreStamp = markerTimestampMs(marker);
    const nextScoreStamp = nextScoreTimestampAfter(marker);
    const upperBound = Math.min(
      scoreStamp + ASSIST_AFTER_SCORE_WINDOW_MS,
      nextScoreStamp === null ? Number.POSITIVE_INFINITY : Math.max(scoreStamp, nextScoreStamp - 1),
    );
    const assistEvents = collectAssistEvents();
    if (!assistEvents.length) return '';

    const linked = assistEvents.find((event) => {
      if (!eventLinksToMarker(event, marker)) return false;
      const eventStamp = eventTimestampMs(event);
      return eventStamp === 0 || (eventStamp >= scoreStamp && eventStamp <= upperBound);
    });
    if (linked) {
      const linkedName = eventPlayerName(linked);
      if (linkedName && normalize(linkedName) !== scorerName) return linkedName;
    }

    const candidates = assistEvents
      .map((event) => {
        const eventStamp = eventTimestampMs(event);
        return {
          name: eventPlayerName(event),
          team: eventPlayerTeam(event),
          eventStamp,
          delta: eventStamp - scoreStamp,
        };
      })
      .filter((candidate) => candidate.name
        && normalize(candidate.name) !== scorerName
        && candidate.eventStamp >= scoreStamp
        && candidate.eventStamp <= upperBound
        && candidate.delta >= 0
        && (!scorerTeam || !candidate.team || candidate.team === scorerTeam))
      .sort((a, b) => a.delta - b.delta);

    return candidates[0]?.name || '';
  }

  function scoreFingerprint(pop) {
    const team = normalize(pop?.querySelector('[data-rp-career-score-detail]')?.textContent?.split('·')[0]);
    const name = normalize(pop?.querySelector('[data-rp-career-score-name]')?.textContent);
    const value = num(String(pop?.querySelector('[data-rp-career-score-value]')?.textContent || '').replace(/[^0-9.-]/g, ''));
    return { team, name, value };
  }

  function currentScoreMarker(pop) {
    const markers = Array.isArray(replayData?.markers) ? replayData.markers : [];
    if (!markers.length) return null;
    const fingerprint = scoreFingerprint(pop);
    const currentMs = parseCurrentClockMs();
    const matched = markers.filter((marker) => {
      const markerName = normalize(marker?.playerName ?? marker?.player_name);
      const markerTeam = normalize(marker?.team);
      const markerValue = num(marker?.shotValue ?? marker?.shot_value);
      return (!fingerprint.name || markerName === fingerprint.name)
        && (!fingerprint.team || !markerTeam || markerTeam === fingerprint.team)
        && (!fingerprint.value || markerValue === fingerprint.value);
    });
    const pool = matched.length ? matched : markers;
    return [...pool].sort((a, b) => Math.abs(markerTimestampMs(a) - currentMs) - Math.abs(markerTimestampMs(b) - currentMs))[0] || null;
  }

  function handleScorePop(pop) {
    if (!pop?.isConnected) return;
    if (activeScorePop !== pop) {
      activeScorePop = pop;
      scoreWasVisible = false;
      hideAssist();
    }

    const visible = pop.classList.contains('show');
    if (visible && !scoreWasVisible) {
      hideAssist();
    } else if (!visible && scoreWasVisible) {
      const marker = currentScoreMarker(pop);
      const assistName = assistNameForMarker(marker);
      if (assistName) {
        assistDelayTimer = setTimeout(() => {
          assistDelayTimer = null;
          showAssist(assistName);
        }, ASSIST_DELAY_MS);
      }
    }
    scoreWasVisible = visible;
  }

  function inspectReplayUi() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) {
      activeScorePop = null;
      scoreWasVisible = false;
      hideAssist();
      return;
    }
    const pop = viewer.querySelector('[data-rp-career-score-pop]');
    if (pop) handleScorePop(pop);
  }

  async function loadReplayData(sessionId) {
    const id = Number(sessionId || 0);
    if (!Number.isSafeInteger(id) || id < 1) return;
    replaySessionId = id;
    replayData = null;
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(id)}/replay`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || replaySessionId !== id) return;
      replayData = data;
    } catch (_) {
      if (replaySessionId === id) replayData = null;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-career-replay-session]');
    if (!button) return;
    loadReplayData(button.dataset.rpCareerReplaySession);
  }, true);

  const observer = new MutationObserver((mutations) => {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target?.matches?.('[data-rp-career-score-pop]')) {
        relevant = true;
        break;
      }
      for (const node of mutation.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('[data-rp-career-score-pop], [data-rp-career-replay-stage]')
          || node.querySelector?.('[data-rp-career-score-pop], [data-rp-career-replay-stage]')) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (relevant) inspectReplayUi();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    replayData = null;
    replaySessionId = 0;
    hideAssist();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inspectReplayUi, { once: true });
  } else {
    inspectReplayUi();
  }
})();
