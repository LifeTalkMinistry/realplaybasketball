(() => {
  if (window.__realPlayRecordedWinnerInstalled) return;
  window.__realPlayRecordedWinnerInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let sessionId = 0;
  let targetScore = 0;
  let declaredWinner = null;
  let scoreObserver = null;
  let detectTimer = null;
  let loadingRules = false;
  let syncing = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('[data-admin-body] .rp-video-scoring-screen') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function numericText(node) {
    const value = Number(String(node?.textContent || '').trim());
    return Number.isFinite(value) ? value : 0;
  }

  function winnerForScores(westScore, eastScore) {
    if (!Number.isFinite(targetScore) || targetScore <= 0) return null;

    const westReached = westScore >= targetScore;
    const eastReached = eastScore >= targetScore;

    // Once a team first reaches the target during this scoring session, keep
    // that winner stable even if the scorer continues reviewing later action.
    // Undoing/correcting the winning basket below the target removes the lock.
    if (declaredWinner === 'west' && westReached) return 'west';
    if (declaredWinner === 'east' && eastReached) return 'east';

    if (westReached && !eastReached) return 'west';
    if (eastReached && !westReached) return 'east';

    // This mainly covers restored drafts that were already beyond the target
    // before this layer loaded. Prefer the higher score; an exact tie is left
    // unresolved rather than inventing a winner without event chronology.
    if (westReached && eastReached) {
      if (westScore > eastScore) return 'west';
      if (eastScore > westScore) return 'east';
    }

    return null;
  }

  function syncWinner() {
    if (syncing) return;
    const screen = scoringScreen();
    const scoreboard = screen?.querySelector('.rp-video-scoreboard');
    if (!scoreboard) return;

    const westNode = scoreboard.querySelector('[data-rp-video-score-west]');
    const eastNode = scoreboard.querySelector('[data-rp-video-score-east]');
    if (!westNode || !eastNode) return;

    const westScore = numericText(westNode);
    const eastScore = numericText(eastNode);
    const winner = winnerForScores(westScore, eastScore);

    syncing = true;
    try {
      if (winner) {
        declaredWinner = winner;
        scoreboard.classList.add('rp-video-scoreboard-winner');
        scoreboard.dataset.rpVideoWinner = winner;

        let winnerNode = scoreboard.querySelector('[data-rp-video-winning-team]');
        if (!winnerNode) {
          winnerNode = document.createElement('div');
          winnerNode.className = 'rp-video-winner-only';
          winnerNode.dataset.rpVideoWinningTeam = '1';
          scoreboard.appendChild(winnerNode);
        }
        winnerNode.textContent = `${winner.toUpperCase()} WINS`;
      } else {
        const westReached = targetScore > 0 && westScore >= targetScore;
        const eastReached = targetScore > 0 && eastScore >= targetScore;
        if (!westReached && !eastReached) declaredWinner = null;

        scoreboard.classList.remove('rp-video-scoreboard-winner');
        delete scoreboard.dataset.rpVideoWinner;
        scoreboard.querySelector('[data-rp-video-winning-team]')?.remove();
      }
    } finally {
      syncing = false;
    }
  }

  function bindScoreboard() {
    const scoreboard = scoringScreen()?.querySelector('.rp-video-scoreboard');
    if (!scoreboard) return;

    if (scoreboard.dataset.rpWinnerBound !== '1') {
      scoreObserver?.disconnect();
      scoreObserver = new MutationObserver(() => syncWinner());
      scoreObserver.observe(scoreboard, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      scoreboard.dataset.rpWinnerBound = '1';
    }

    syncWinner();
  }

  async function loadRules() {
    if (loadingRules) return;
    const auth = token();
    if (!auth || !scoringScreen()) return;

    loadingRules = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      const session = data?.control?.session || null;
      const nextSessionId = Number(session?.id || 0);
      if (nextSessionId !== sessionId) {
        sessionId = nextSessionId;
        declaredWinner = null;
      }

      const nextTarget = Number(session?.rules?.targetScore || 0);
      targetScore = Number.isFinite(nextTarget) && nextTarget > 0 ? nextTarget : 0;
      bindScoreboard();
    } catch (_) {
      // Winner display is an enhancement only. Scoring must remain usable if
      // the one-time rules lookup is unavailable.
    } finally {
      loadingRules = false;
    }
  }

  function scheduleDetect() {
    if (detectTimer) clearTimeout(detectTimer);
    detectTimer = setTimeout(() => {
      if (!scoringScreen()) {
        scoreObserver?.disconnect();
        scoreObserver = null;
        return;
      }

      bindScoreboard();
      if (!targetScore) loadRules();
    }, 50);
  }

  const pageObserver = new MutationObserver(scheduleDetect);
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!root()?.contains(event.target)) return;
    if (
      event.target.closest('[data-rp-video-shot]')
      || event.target.closest('[data-rp-draft-remove-shot]')
      || event.target.closest('[data-rp-video-undo]')
      || event.target.closest('[data-rp-video-tab]')
    ) {
      setTimeout(() => {
        bindScoreboard();
        if (!targetScore) loadRules();
      }, 0);
    }
  }, true);

  scheduleDetect();
})();
