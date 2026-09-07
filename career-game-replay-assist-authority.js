(() => {
  if (window.__realPlayReplayAssistAuthorityInstalled) return;
  window.__realPlayReplayAssistAuthorityInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const ASSIST_VISIBLE_MS = 1500;
  const ASSIST_DELAY_MS = 2000;

  let replayData = null;
  let replaySessionId = 0;
  let scoreWasVisible = false;
  let pendingAssistName = '';
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
      gap:.5rem;
      width:auto;
      max-width:calc(100% - 20px);
      min-height:44px;
      box-sizing:border-box;
      padding:9px 12px;
      border:1px solid transparent;
      border-radius:12px;
      background:
        linear-gradient(158deg,rgba(5,11,18,.94),rgba(3,6,11,.97)) padding-box,
        linear-gradient(112deg,rgba(19,152,255,.46),rgba(119,129,151,.18) 50%,rgba(255,53,66,.38)) border-box;
      box-shadow:
        0 12px 34px rgba(0,0,0,.34),
        -8px 0 24px rgba(0,117,255,.06),
        8px 0 24px rgba(255,37,51,.045);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      opacity:0;
      transform:translateY(7px);
      pointer-events:none;
      transition:opacity .16s ease,transform .16s ease;
    }
    .rp-career-replay-assist-pop.show{opacity:1;transform:translateY(0)}
    .rp-career-replay-assist-pop span{
      flex:0 0 auto;
      color:#46b6ff;
      font-size:.58rem;
      font-weight:950;
      line-height:1;
      letter-spacing:.11em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-assist-pop span::after{
      content:' · ';
      margin-left:.34rem;
      color:#768392;
    }
    .rp-career-replay-assist-pop strong{
      min-width:0;
      max-width:220px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:#fff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.84rem;
      font-style:italic;
      font-weight:950;
      line-height:1;
    }
    @media(max-width:620px){
      .rp-career-replay-assist-pop{
        right:8px;
        bottom:8px;
        max-width:calc(100% - 16px);
        min-height:40px;
        padding:8px 10px;
        border-radius:10px;
      }
      .rp-career-replay-assist-pop span{font-size:.52rem}
      .rp-career-replay-assist-pop strong{max-width:185px;font-size:.76rem}
    }
    @media(prefers-reduced-motion:reduce){.rp-career-replay-assist-pop{transition:none}}
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
    pop.className = 'rp-career-replay-assist-pop rp-career-replay-stat-pop';
    pop.dataset.rpCareerAssistPop = '1';
    pop.setAttribute('aria-live', 'polite');
    pop.innerHTML = '<span>ASSIST BY</span><strong data-rp-career-assist-name>PLAYER</strong>';
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
    if (label) label.textContent = assistIdentity(cleanName);
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

  function directAssistName(marker) {
    return String(marker?.assistPlayerName ?? marker?.assist_player_name ?? '').trim();
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

  function assistIdentity(name) {
    const player = playerRecordByName(name);
    const rawNumber = player?.playerNumber ?? player?.player_number;
    const number = rawNumber === null || rawNumber === undefined || rawNumber === '' ? '#--' : `#${Number(rawNumber)}`;
    return `${number} ${String(name || 'REAL PLAY PLAYER').trim()}`;
  }

  function scoreFingerprint(pop) {
    return {
      team: normalize(pop?.querySelector('[data-rp-career-score-detail]')?.textContent?.split('·')[0]),
      name: normalize(pop?.querySelector('[data-rp-career-score-name]')?.textContent),
      value: num(String(pop?.querySelector('[data-rp-career-score-value]')?.textContent || '').replace(/[^0-9.-]/g, '')),
    };
  }

  function currentScoreMarker(pop) {
    const markers = Array.isArray(replayData?.markers) ? replayData.markers : [];
    if (!markers.length) return null;
    const fingerprint = scoreFingerprint(pop);
    const currentMs = parseCurrentClockMs();
    const matching = markers.filter((marker) => {
      const markerName = normalize(marker?.playerName);
      const markerTeam = normalize(marker?.team);
      const markerValue = num(marker?.shotValue);
      return (!fingerprint.name || markerName === fingerprint.name)
        && (!fingerprint.team || !markerTeam || markerTeam === fingerprint.team)
        && (!fingerprint.value || markerValue === fingerprint.value);
    });
    const pool = matching.length ? matching : markers;
    return [...pool].sort((a, b) =>
      Math.abs(num(a?.videoTimestampMs) - currentMs) - Math.abs(num(b?.videoTimestampMs) - currentMs)
    )[0] || null;
  }

  function handleScorePop(pop) {
    if (!pop?.isConnected) return;
    if (activeScorePop !== pop) {
      activeScorePop = pop;
      scoreWasVisible = false;
      pendingAssistName = '';
      hideAssist();
    }

    const visible = pop.classList.contains('show');
    if (visible && !scoreWasVisible) {
      hideAssist();
      pendingAssistName = directAssistName(currentScoreMarker(pop));
    } else if (!visible && scoreWasVisible) {
      const assistName = pendingAssistName || directAssistName(currentScoreMarker(pop));
      pendingAssistName = '';
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
      pendingAssistName = '';
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
    pendingAssistName = '';
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
    if (mutations.some((mutation) =>
      (mutation.type === 'attributes' && mutation.target?.matches?.('[data-rp-career-score-pop]'))
      || [...(mutation.addedNodes || [])].some((node) => node instanceof Element
        && (node.matches?.('[data-rp-career-score-pop], [data-rp-career-replay-stage]')
          || node.querySelector?.('[data-rp-career-score-pop], [data-rp-career-replay-stage]')))
    )) inspectReplayUi();
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
    pendingAssistName = '';
    hideAssist();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inspectReplayUi, { once: true });
  } else {
    inspectReplayUi();
  }
})();
