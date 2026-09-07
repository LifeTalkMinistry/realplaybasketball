(() => {
  if (window.__realPlayReplayAssistAuthorityInstalled) return;
  window.__realPlayReplayAssistAuthorityInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const ASSIST_VISIBLE_MS = 1500;

  let replayData = null;
  let replaySessionId = 0;
  let scoreWasVisible = false;
  let pendingAssistName = '';
  let assistTimer = null;
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
    .rp-career-replay-assist-pop.show{opacity:1;transform:translateY(0)}
    .rp-career-replay-assist-pop span{
      flex:0 0 auto;
      color:#70dfee;
      font-size:.5rem;
      font-weight:950;
      line-height:1;
      letter-spacing:.08em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-assist-pop span::after{content:' · ';margin-left:.28rem;color:#6f8f9c}
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
      .rp-career-replay-assist-pop{right:8px;bottom:8px;max-width:calc(100% - 16px);min-height:28px;padding:5px 8px;border-radius:8px}
      .rp-career-replay-assist-pop span{font-size:.46rem}
      .rp-career-replay-assist-pop strong{max-width:165px;font-size:.66rem}
    }
    @media(prefers-reduced-motion:reduce){.rp-career-replay-assist-pop{transition:none}}
  `;
  document.head.appendChild(style);

  function clearAssistTimer() {
    if (!assistTimer) return;
    clearTimeout(assistTimer);
    assistTimer = null;
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

  function directAssistName(marker) {
    return String(marker?.assistPlayerName ?? marker?.assist_player_name ?? '').trim();
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
      if (assistName) showAssist(assistName);
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
