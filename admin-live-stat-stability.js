(() => {
  if (window.__realPlayLiveStatStabilityInstalled) return;
  window.__realPlayLiveStatStabilityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let busy = false;
  let cachedRulesHtml = '';

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
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
      AST: number(stats.AST ?? stats.ast),
      REB: number(stats.REB ?? stats.reb),
      TO: number(stats.TO ?? stats.tov),
      STL: number(stats.STL ?? stats.stl),
      BLK: number(stats.BLK ?? stats.blk),
      FOUL: number(stats.FOUL ?? stats.foul),
    };
    normalized.PTS = normalized.onePtMade + (2 * normalized.twoPtMade);
    return normalized;
  }

  function shotSummary(made, missed) {
    const attempts = made + missed;
    return {
      made,
      attempts,
      percent: attempts ? `${Math.round((made / attempts) * 100)}%` : '—',
    };
  }

  function captureRulesPanel() {
    const mount = body()?.querySelector('[data-rp-live-rules-controls]');
    if (mount) cachedRulesHtml = mount.innerHTML;
  }

  function restoreRulesPanelBeforePaint() {
    const adminRoot = root();
    const adminBody = body();
    if (!cachedRulesHtml || !adminRoot?.classList.contains('open') || !adminBody) return;
    if (adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'live') return;
    const view = adminBody.querySelector('[data-courtside-view]:not([data-courtside-review])');
    if (!view || view.querySelector('[data-rp-live-rules-controls]')) return;

    const head = view.querySelector('.rp-courtside-head');
    if (!head) return;
    const mount = document.createElement('div');
    mount.dataset.rpLiveRulesControls = '1';
    mount.innerHTML = cachedRulesHtml;
    head.insertAdjacentElement('afterend', mount);
  }

  async function request(payload) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function setActionBusy(state) {
    const panel = body()?.querySelector('.rp-courtside-player-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-rp-shot-action], [data-control-action="stat"]').forEach((button) => {
      button.disabled = Boolean(state);
    });
  }

  function setError(message = '') {
    const errorBox = body()?.querySelector('[data-rp-shot-error]');
    if (!errorBox) return;
    errorBox.hidden = !message;
    errorBox.textContent = message;
  }

  function patchScoreboard(control) {
    const players = Array.isArray(control?.players) ? control.players : [];
    const score = players.reduce((total, player) => {
      if (!player?.checkedIn || !player?.team) return total;
      const pts = normalizeStats(player.stats || {}).PTS;
      if (String(player.team).toLowerCase() === 'west') total.west += pts;
      if (String(player.team).toLowerCase() === 'east') total.east += pts;
      return total;
    }, { west: 0, east: 0 });

    body()?.querySelectorAll('.rp-admin-score-side').forEach((side) => {
      const team = side.querySelector('small')?.textContent.trim().toUpperCase();
      const value = side.querySelector('strong');
      if (!value) return;
      if (team === 'WEST') value.textContent = String(score.west);
      if (team === 'EAST') value.textContent = String(score.east);
    });
  }

  function patchPlayerPanel(control, userId) {
    const panel = body()?.querySelector('.rp-courtside-player-panel');
    if (!panel) return;
    const player = (control?.players || []).find((item) => Number(item.userId ?? item.playerId) === Number(userId));
    if (!player) return;

    const stats = normalizeStats(player.stats || {});
    const one = shotSummary(stats.onePtMade, stats.onePtMiss);
    const two = shotSummary(stats.twoPtMade, stats.twoPtMiss);

    panel.querySelectorAll('.rp-courtside-stat').forEach((card) => {
      const label = card.querySelector('label')?.textContent.trim().toUpperCase();
      const value = card.querySelector('strong');
      if (!label || !value) return;

      if (label === 'PTS') value.textContent = String(stats.PTS);
      else if (label === '1PT') {
        value.textContent = `${one.made} / ${one.attempts}`;
        const meta = card.querySelector('.rp-shot-meta');
        if (meta) meta.textContent = `${one.percent} · INSIDE ARC`;
      } else if (label === '2PT') {
        value.textContent = `${two.made} / ${two.attempts}`;
        const meta = card.querySelector('.rp-shot-meta');
        if (meta) meta.textContent = `${two.percent} · OUTSIDE ARC`;
      } else if (Object.prototype.hasOwnProperty.call(stats, label)) {
        value.textContent = String(stats[label]);
      }
    });

    const attempts = one.attempts + two.attempts;
    const undo = panel.querySelector('[data-rp-shot-action="undo-shot"]');
    if (undo) undo.disabled = attempts === 0;
  }

  function patchFromControl(control, userId) {
    if (!control) return;
    patchScoreboard(control);
    patchPlayerPanel(control, userId);
  }

  async function handleAction(button) {
    if (busy) return;
    const userId = Number(button.dataset.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return;

    let payload;
    if (button.matches('[data-rp-shot-action]')) {
      payload = button.dataset.rpShotAction === 'shot'
        ? {
            action: 'shot',
            userId,
            shotValue: Number(button.dataset.shotValue),
            result: String(button.dataset.result || ''),
          }
        : { action: 'undo-shot', userId };
    } else {
      payload = {
        action: 'stat',
        userId,
        stat: String(button.dataset.stat || ''),
        delta: Number(button.dataset.delta || 0),
      };
    }

    busy = true;
    captureRulesPanel();
    setError('');
    setActionBusy(true);

    try {
      const data = await request(payload);
      patchFromControl(data?.control || null, userId);
    } catch (error) {
      setError(error.message || 'Unable to record that action.');
    } finally {
      busy = false;
      setActionBusy(false);
      const panel = body()?.querySelector('.rp-courtside-player-panel');
      const undo = panel?.querySelector('[data-rp-shot-action="undo-shot"]');
      if (undo) {
        const attempts = [...panel.querySelectorAll('.rp-shot-card strong')].reduce((sum, node) => {
          const match = node.textContent.match(/\/\s*(\d+)/);
          return sum + Number(match?.[1] || 0);
        }, 0);
        undo.disabled = attempts === 0;
      }
    }
  }

  // This listener intentionally loads before the legacy courtside listener.
  // It owns live stat mutations so a single score does not destroy/rebuild the
  // whole admin body and the clock panel stays mounted continuously.
  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot?.classList.contains('open') || !adminRoot.contains(event.target)) return;
    if (adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'live') return;

    const button = event.target.closest('[data-rp-shot-action], [data-control-action="stat"]');
    if (!button || !button.closest('.rp-courtside-player-panel') || button.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleAction(button);
  }, true);

  // The base admin poll can still rebuild the body after it notices the server
  // state changed. Preserve the already-visible rules/clock panel and restore
  // it in a microtask after the courtside layer restores its view, before the
  // browser gets a chance to paint an empty gap.
  window.addEventListener('realplay:admin-render', () => {
    queueMicrotask(restoreRulesPanelBeforePaint);
  });

  document.addEventListener('pointerdown', (event) => {
    if (root()?.contains(event.target)) captureRulesPanel();
  }, true);
})();
