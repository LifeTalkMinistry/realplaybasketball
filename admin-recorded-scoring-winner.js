(() => {
  if (window.__realPlayRecordedWinnerInstalled) return;
  window.__realPlayRecordedWinnerInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let sessionId = 0;
  let targetScore = 0;
  let declaredWinner = null;
  let loadingRules = false;
  let lastRulesCheckAt = 0;
  let lastScoreboard = null;
  let lastRenderKey = '';

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

    if (declaredWinner === 'west' && westReached) return 'west';
    if (declaredWinner === 'east' && eastReached) return 'east';

    if (westReached && !eastReached) return 'west';
    if (eastReached && !westReached) return 'east';

    if (westReached && eastReached) {
      if (westScore > eastScore) return 'west';
      if (eastScore > westScore) return 'east';
    }

    return null;
  }

  function applyWinner(scoreboard, westScore, eastScore) {
    const winner = winnerForScores(westScore, eastScore);

    if (winner) {
      declaredWinner = winner;
      const label = `${winner.toUpperCase()} WINS`;

      if (!scoreboard.classList.contains('rp-video-scoreboard-winner')) {
        scoreboard.classList.add('rp-video-scoreboard-winner');
      }
      if (scoreboard.dataset.rpVideoWinner !== winner) {
        scoreboard.dataset.rpVideoWinner = winner;
      }

      let winnerNode = scoreboard.querySelector('[data-rp-video-winning-team]');
      if (!winnerNode) {
        winnerNode = document.createElement('div');
        winnerNode.className = 'rp-video-winner-only';
        winnerNode.dataset.rpVideoWinningTeam = '1';
        scoreboard.appendChild(winnerNode);
      }
      if (winnerNode.textContent !== label) winnerNode.textContent = label;
      return;
    }

    const westReached = targetScore > 0 && westScore >= targetScore;
    const eastReached = targetScore > 0 && eastScore >= targetScore;
    if (!westReached && !eastReached) declaredWinner = null;

    if (scoreboard.classList.contains('rp-video-scoreboard-winner')) {
      scoreboard.classList.remove('rp-video-scoreboard-winner');
    }
    if (scoreboard.dataset.rpVideoWinner) delete scoreboard.dataset.rpVideoWinner;
    const winnerNode = scoreboard.querySelector('[data-rp-video-winning-team]');
    if (winnerNode) winnerNode.remove();
  }

  async function loadRules(force = false) {
    if (loadingRules) return;
    const auth = token();
    const screen = scoringScreen();
    if (!auth || !screen) return;

    const now = Date.now();
    if (!force && targetScore > 0 && now - lastRulesCheckAt < 10000) return;
    lastRulesCheckAt = now;
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
      lastRenderKey = '';
      syncWinner();
    } catch (_) {
      // Winner display is an enhancement only; scoring stays usable if the
      // rules lookup is temporarily unavailable.
    } finally {
      loadingRules = false;
    }
  }

  function syncWinner() {
    const screen = scoringScreen();
    const scoreboard = screen?.querySelector('.rp-video-scoreboard') || null;
    if (!scoreboard) {
      lastScoreboard = null;
      lastRenderKey = '';
      return;
    }

    const westNode = scoreboard.querySelector('[data-rp-video-score-west]');
    const eastNode = scoreboard.querySelector('[data-rp-video-score-east]');
    if (!westNode || !eastNode) return;

    const westScore = numericText(westNode);
    const eastScore = numericText(eastNode);
    const key = `${westScore}:${eastScore}:${targetScore}:${declaredWinner || ''}`;

    if (scoreboard !== lastScoreboard || key !== lastRenderKey) {
      lastScoreboard = scoreboard;
      lastRenderKey = key;
      applyWinner(scoreboard, westScore, eastScore);
    }

    if (!targetScore) loadRules();
    else loadRules(false);
  }

  // Do not observe the scoreboard or the whole page with MutationObserver.
  // The draft scorer rewrites score DOM synchronously, and an observer that
  // also rewrites that same DOM can create a self-triggering render loop and
  // freeze the admin scorer. A light heartbeat plus scorer-click sync gives
  // the same immediate UX without touching the scoring pipeline.
  const heartbeat = window.setInterval(syncWinner, 750);

  document.addEventListener('click', (event) => {
    if (!root()?.contains(event.target)) return;
    if (
      event.target.closest('[data-rp-video-shot]')
      || event.target.closest('[data-rp-draft-remove-shot]')
      || event.target.closest('[data-rp-video-undo]')
      || event.target.closest('[data-rp-video-tab]')
    ) {
      window.setTimeout(() => {
        syncWinner();
        loadRules(false);
      }, 0);
    }
  }, true);

  window.addEventListener('pagehide', () => window.clearInterval(heartbeat), { once: true });
  window.setTimeout(() => {
    syncWinner();
    loadRules(true);
  }, 0);
})();
