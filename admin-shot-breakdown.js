(() => {
  if (window.__realPlayShotBreakdownInstalled) return;
  window.__realPlayShotBreakdownInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let busy = false;
  let scheduled = false;
  let pendingRefresh = false;
  let rootObserver = null;
  let refreshSequence = 0;
  let refreshInFlight = false;
  let lastRefreshAt = 0;
  let lastControl = null;
  const playerCache = new Map();

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function playerPanel() {
    return root()?.querySelector('.rp-courtside-player-panel') || null;
  }

  function selectedPlayerId(panel = playerPanel()) {
    const value = panel?.querySelector('[data-user-id]')?.dataset.userId;
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  async function request(method = 'GET', payload) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Admin session is not available.');

    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
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

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function normalizeStats(stats = {}) {
    const normalized = {
      onePtMade: number(stats.onePtMade),
      onePtMiss: number(stats.onePtMiss),
      twoPtMade: number(stats.twoPtMade),
      twoPtMiss: number(stats.twoPtMiss),
      ast: number(stats.ast),
      reb: number(stats.reb),
      tov: number(stats.tov),
      stl: number(stats.stl),
      blk: number(stats.blk),
      foul: number(stats.foul),
    };
    normalized.pts = normalized.onePtMade + (2 * normalized.twoPtMade);
    return normalized;
  }

  function shotSummary(made, missed) {
    const attempts = made + missed;
    return {
      made,
      missed,
      attempts,
      percent: attempts ? `${Math.round((made / attempts) * 100)}%` : '—',
    };
  }

  function parseMadeAttempts(text) {
    const match = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;
    const made = number(match[1]);
    const attempts = Math.max(made, number(match[2]));
    return { made, missed: attempts - made };
  }

  function readPanelFallback(panel, playerId) {
    const cached = playerCache.get(Number(playerId)) || null;
    const draft = cached ? { ...cached } : normalizeStats();

    panel?.querySelectorAll('.rp-courtside-stat').forEach((box) => {
      const label = String(box.querySelector('label')?.textContent || '').trim().toUpperCase();
      const raw = String(box.querySelector('strong')?.textContent || '').trim();
      if (label === '1PT') {
        const shot = parseMadeAttempts(raw);
        if (shot) {
          draft.onePtMade = shot.made;
          draft.onePtMiss = shot.missed;
        }
      } else if (label === '2PT') {
        const shot = parseMadeAttempts(raw);
        if (shot) {
          draft.twoPtMade = shot.made;
          draft.twoPtMiss = shot.missed;
        }
      } else if (label === 'AST') draft.ast = number(raw);
      else if (label === 'REB') draft.reb = number(raw);
      else if (label === 'TO') draft.tov = number(raw);
      else if (label === 'STL') draft.stl = number(raw);
      else if (label === 'BLK') draft.blk = number(raw);
      else if (label === 'FOUL') draft.foul = number(raw);
    });

    return normalizeStats(draft);
  }

  function statActions(playerId, stat) {
    const id = esc(playerId);
    return `<div class="rp-courtside-stat-actions">
      <button type="button" data-control-action="stat" data-user-id="${id}" data-stat="${stat}" data-delta="-1">−</button>
      <button type="button" data-control-action="stat" data-user-id="${id}" data-stat="${stat}" data-delta="1">+</button>
    </div>`;
  }

  function normalStat(playerId, label, value, stat) {
    return `<div class="rp-courtside-stat">
      <label>${label}</label>
      <strong>${number(value)}</strong>
      ${statActions(playerId, stat)}
    </div>`;
  }

  function pointsCard(points) {
    return `<div class="rp-courtside-stat rp-shot-points">
      <label>PTS</label>
      <strong>${number(points)}</strong>
      <span class="rp-shot-auto">AUTO</span>
    </div>`;
  }

  function shotCard(playerId, shotValue, summary, rangeLabel) {
    const id = esc(playerId);
    return `<div class="rp-courtside-stat rp-shot-card">
      <label>${shotValue}PT</label>
      <strong>${summary.made} / ${summary.attempts}</strong>
      <span class="rp-shot-meta">${summary.percent} · ${rangeLabel}</span>
      <div class="rp-shot-actions">
        <button type="button" data-rp-shot-action="shot" data-user-id="${id}" data-shot-value="${shotValue}" data-result="miss">MISS</button>
        <button type="button" class="make" data-rp-shot-action="shot" data-user-id="${id}" data-shot-value="${shotValue}" data-result="make">MAKE</button>
      </div>
    </div>`;
  }

  function derivedTeamScores(control) {
    const scores = { west: 0, east: 0 };
    for (const player of control?.players || []) {
      const team = String(player?.team || '').toLowerCase();
      if (!player?.checkedIn || (team !== 'west' && team !== 'east')) continue;
      const stats = normalizeStats(player?.stats || {});
      scores[team] += stats.pts;
    }
    return scores;
  }

  function updateScoreboard(control = lastControl) {
    const scope = root();
    if (!scope || !control) return;
    const scores = derivedTeamScores(control);
    scope.querySelectorAll('.rp-admin-score-side').forEach((side) => {
      const label = side.querySelector('small')?.textContent.trim().toUpperCase();
      const value = side.querySelector('strong');
      if (!value) return;
      let next = null;
      if (label === 'WEST') next = String(scores.west);
      if (label === 'EAST') next = String(scores.east);
      if (next !== null && value.textContent !== next) value.textContent = next;
    });
  }

  function clearError(panel) {
    panel?.querySelector('.rp-shot-error')?.remove();
  }

  function showError(panel, message) {
    if (!panel) return;
    let error = panel.querySelector('.rp-shot-error');
    if (!error) {
      error = document.createElement('div');
      error.className = 'rp-shot-error';
      panel.appendChild(error);
    }
    error.textContent = message;
  }

  function renderStats(panel, playerId, rawStats) {
    if (!panel) return false;
    const stats = normalizeStats(rawStats);
    const one = shotSummary(stats.onePtMade, stats.onePtMiss);
    const two = shotSummary(stats.twoPtMade, stats.twoPtMiss);
    const signature = JSON.stringify({ playerId: Number(playerId), stats, busy });
    const grid = panel.querySelector('.rp-courtside-stats');
    if (!grid) return false;

    if (panel.dataset.rpShotSignature !== signature) {
      grid.innerHTML = [
        pointsCard(stats.pts),
        shotCard(playerId, 1, one, 'INSIDE ARC'),
        shotCard(playerId, 2, two, 'OUTSIDE ARC'),
        normalStat(playerId, 'AST', stats.ast, 'ast'),
        normalStat(playerId, 'REB', stats.reb, 'reb'),
        normalStat(playerId, 'TO', stats.tov, 'tov'),
        normalStat(playerId, 'STL', stats.stl, 'stl'),
        normalStat(playerId, 'BLK', stats.blk, 'blk'),
        normalStat(playerId, 'FOUL', stats.foul, 'foul'),
      ].join('');

      let undo = panel.querySelector('[data-rp-shot-action="undo-shot"]');
      if (!undo) {
        undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'rp-shot-undo';
        undo.dataset.rpShotAction = 'undo-shot';
        grid.insertAdjacentElement('afterend', undo);
      }
      undo.dataset.userId = String(playerId);
      undo.textContent = 'UNDO LAST SHOT';
      undo.disabled = busy || (one.attempts + two.attempts === 0);

      grid.querySelectorAll('button').forEach((button) => {
        button.disabled = busy;
      });
      panel.dataset.rpShotSignature = signature;
    }
    return true;
  }

  function cacheControl(control) {
    if (!control?.session) return;
    lastControl = control;
    for (const player of control.players || []) {
      const id = Number(player.userId ?? player.playerId);
      if (!Number.isSafeInteger(id) || id === 0) continue;
      playerCache.set(id, normalizeStats(player.stats || {}));
    }
  }

  function renderFromControl(control, playerId) {
    const panel = playerPanel();
    if (!panel || !control?.session) return false;
    cacheControl(control);
    const player = (control.players || []).find((item) => Number(item.userId ?? item.playerId) === Number(playerId));
    if (!player) return false;
    renderStats(panel, playerId, player.stats || {});
    updateScoreboard(control);
    return true;
  }

  function stabilizePanel() {
    const panel = playerPanel();
    const playerId = selectedPlayerId(panel);
    if (!panel || playerId === null) return null;
    const fallback = readPanelFallback(panel, playerId);
    renderStats(panel, playerId, fallback);
    updateScoreboard();
    return playerId;
  }

  async function refreshPanel() {
    const panel = playerPanel();
    const playerId = selectedPlayerId(panel);
    if (!panel || playerId === null || refreshInFlight) return;
    refreshInFlight = true;
    lastRefreshAt = Date.now();
    const sequence = ++refreshSequence;
    try {
      const data = await request('GET');
      if (sequence !== refreshSequence) return;
      renderFromControl(data?.control, playerId);
    } catch (_error) {
      // Keep the already-rendered 1PT/2PT scorer on screen. A temporary API
      // failure must never restore the legacy PTS / MAKE / MISS controls.
    } finally {
      refreshInFlight = false;
    }
  }

  function scheduleEnhance(forceRefresh = false) {
    if (forceRefresh) pendingRefresh = true;
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      const playerId = stabilizePanel();
      if (playerId === null) {
        pendingRefresh = false;
        return;
      }
      const needsInitialData = !playerCache.has(Number(playerId)) && (Date.now() - lastRefreshAt > 1000);
      const shouldRefresh = pendingRefresh || needsInitialData;
      pendingRefresh = false;
      if (shouldRefresh) refreshPanel();
    });
  }

  async function handleShotAction(button) {
    if (busy) return;
    const panel = playerPanel();
    const playerId = Number(button.dataset.userId);
    if (!panel || !Number.isSafeInteger(playerId) || playerId === 0) return;

    busy = true;
    clearError(panel);
    panel.dataset.rpShotSignature = '';
    stabilizePanel();
    try {
      let payload;
      if (button.dataset.rpShotAction === 'shot') {
        payload = {
          action: 'shot',
          userId: playerId,
          shotValue: Number(button.dataset.shotValue),
          result: String(button.dataset.result || ''),
        };
      } else {
        payload = { action: 'undo-shot', userId: playerId };
      }

      const data = await request('POST', payload);
      renderFromControl(data?.control, playerId);
    } catch (error) {
      showError(panel, error.message || 'Unable to record that shot.');
    } finally {
      busy = false;
      panel.dataset.rpShotSignature = '';
      scheduleEnhance(true);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-shot-action]');
    const adminRoot = root();
    if (!button || !adminRoot?.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    handleShotAction(button);
  }, true);

  window.addEventListener('realplay:admin-render', () => scheduleEnhance(true));

  function attachObserver() {
    const adminRoot = root();
    if (!adminRoot || rootObserver) return Boolean(adminRoot);
    rootObserver = new MutationObserver(() => scheduleEnhance(false));
    rootObserver.observe(adminRoot, { childList: true, subtree: true });
    scheduleEnhance(true);
    return true;
  }

  if (!attachObserver()) {
    const bootObserver = new MutationObserver(() => {
      if (attachObserver()) bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
