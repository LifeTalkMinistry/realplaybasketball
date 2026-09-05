(() => {
  if (window.__realPlayShotBreakdownInstalled) return;
  window.__realPlayShotBreakdownInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let busy = false;
  let scheduled = false;
  let rootObserver = null;
  let refreshSequence = 0;

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

  function shotSummary(made, missed) {
    const attempts = made + missed;
    return {
      made,
      missed,
      attempts,
      percent: attempts ? `${Math.round((made / attempts) * 100)}%` : '—',
    };
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
      <strong>${Number(value || 0)}</strong>
      ${statActions(playerId, stat)}
    </div>`;
  }

  function pointsCard(points) {
    return `<div class="rp-courtside-stat rp-shot-points">
      <label>PTS</label>
      <strong>${Number(points || 0)}</strong>
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

  function updateScoreboard(session) {
    const scope = root();
    if (!scope || !session) return;
    scope.querySelectorAll('.rp-admin-score-side').forEach((side) => {
      const label = side.querySelector('small')?.textContent.trim().toUpperCase();
      const value = side.querySelector('strong');
      if (!value) return;
      if (label === 'WEST') value.textContent = String(Number(session.westScore || 0));
      if (label === 'EAST') value.textContent = String(Number(session.eastScore || 0));
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

  function renderFromControl(control, playerId) {
    const panel = playerPanel();
    if (!panel || !control?.session) return false;
    const player = (control.players || []).find((item) => Number(item.userId ?? item.playerId) === Number(playerId));
    if (!player) return false;

    const stats = player.stats || {};
    const one = shotSummary(Number(stats.onePtMade || 0), Number(stats.onePtMiss || 0));
    const two = shotSummary(Number(stats.twoPtMade || 0), Number(stats.twoPtMiss || 0));
    const signature = JSON.stringify({
      playerId: Number(playerId),
      pts: Number(stats.pts || 0),
      one,
      two,
      ast: Number(stats.ast || 0),
      reb: Number(stats.reb || 0),
      tov: Number(stats.tov || 0),
      stl: Number(stats.stl || 0),
      blk: Number(stats.blk || 0),
      foul: Number(stats.foul || 0),
      busy,
    });

    const grid = panel.querySelector('.rp-courtside-stats');
    if (!grid) return false;

    if (panel.dataset.rpShotSignature !== signature) {
      grid.innerHTML = [
        pointsCard(stats.pts),
        shotCard(playerId, 1, one, 'INSIDE'),
        shotCard(playerId, 2, two, 'OUTSIDE'),
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

    updateScoreboard(control.session);
    return true;
  }

  async function refreshPanel() {
    const panel = playerPanel();
    const playerId = selectedPlayerId(panel);
    if (!panel || playerId === null) return;
    const sequence = ++refreshSequence;
    try {
      const data = await request('GET');
      if (sequence !== refreshSequence) return;
      renderFromControl(data?.control, playerId);
    } catch (_error) {
      // The base courtside UI remains usable if the enhancement cannot hydrate.
    }
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      refreshPanel();
    });
  }

  async function handleShotAction(button) {
    if (busy) return;
    const panel = playerPanel();
    const playerId = Number(button.dataset.userId);
    if (!panel || !Number.isSafeInteger(playerId) || playerId === 0) return;

    busy = true;
    clearError(panel);
    scheduleEnhance();
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
      scheduleEnhance();
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

  window.addEventListener('realplay:admin-render', scheduleEnhance);

  function attachObserver() {
    const adminRoot = root();
    if (!adminRoot || rootObserver) return Boolean(adminRoot);
    rootObserver = new MutationObserver(scheduleEnhance);
    rootObserver.observe(adminRoot, { childList: true, subtree: true });
    scheduleEnhance();
    return true;
  }

  if (!attachObserver()) {
    const bootObserver = new MutationObserver(() => {
      if (attachObserver()) bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
