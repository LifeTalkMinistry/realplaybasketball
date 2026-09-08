(() => {
  if (window.__realPlayRecordedStartSubmitFixInstalled) return;
  window.__realPlayRecordedStartSubmitFixInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let starting = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
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

  function setInlineStatus(message = '', error = false) {
    const adminBody = body();
    const start = adminBody?.querySelector('[data-rp-video-start]');
    if (!start) return;
    let node = adminBody.querySelector('[data-rp-video-start-status]');
    if (!node) {
      node = document.createElement('div');
      node.dataset.rpVideoStartStatus = '1';
      node.style.marginTop = '10px';
      node.style.font = '700 10px/1.45 system-ui,sans-serif';
      node.style.letterSpacing = '.02em';
      node.style.color = error ? '#ff9b9b' : '#75f2c6';
      start.insertAdjacentElement('afterend', node);
    }
    node.style.color = error ? '#ff9b9b' : '#75f2c6';
    node.textContent = message;
  }

  function rosterCounts(control) {
    const players = Array.isArray(control?.players) ? control.players : [];
    return players.reduce((counts, player) => {
      if (!player?.checkedIn || !player?.team) return counts;
      const team = String(player.team).toLowerCase();
      if (team === 'west') counts.west += 1;
      if (team === 'east') counts.east += 1;
      return counts;
    }, { west: 0, east: 0 });
  }

  function visibleRaceSelection() {
    const form = body()?.querySelector('[data-rp-video-race-form]');
    if (!form) return null;
    const target = Number(form.querySelector('select[name="target"]')?.value || 0);
    const format = String(form.querySelector('select[name="format"]')?.value || '').trim().toLowerCase();
    if (![8, 16, 21].includes(target) || !['3v3', '4v4', '5v5'].includes(format)) return null;
    return { rulesetFamily: 'race_to', targetScore: target, playerFormat: format };
  }

  async function commitVisibleRules(control) {
    const selection = visibleRaceSelection();
    const saved = control?.session?.rules || null;
    if (!selection) return control;

    const same = saved?.rulesetFamily === 'race_to'
      && Number(saved.targetScore) === selection.targetScore
      && String(saved.playerFormat || '').toLowerCase() === selection.playerFormat;
    if (same) return control;

    const data = await api('/api/real-play/admin/career/control', {
      method: 'POST',
      json: { action: 'set-rules', ...selection },
    });
    return data?.control || control;
  }

  async function startRecordedScoring(button) {
    if (starting) return;
    if (!window.confirm('Start recorded scoring? The selected roster and game rules will lock for this game.')) return;

    starting = true;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'STARTING…';
    setInlineStatus('Checking the saved rules, exact roster, and video…');

    try {
      let data = await api('/api/real-play/admin/career/control');
      let control = data?.control || null;
      if (!control?.session?.id) throw new Error('There is no active replay game to start.');
      if (String(control.session.gameEntryMode || '').toLowerCase() !== 'replay') {
        throw new Error('This game is not set to REPLAY RECORDED. Change the game type to replay first.');
      }

      control = await commitVisibleRules(control);
      if (!control?.session?.rules) {
        data = await api('/api/real-play/admin/career/control');
        control = data?.control || control;
      }

      const rules = control?.session?.rules || null;
      const expected = Number(rules?.playersPerSide || 0);
      const counts = rosterCounts(control);
      if (!expected) throw new Error('Confirm the game rules before starting recorded scoring.');
      if (counts.west !== expected || counts.east !== expected) {
        throw new Error(`${control.session?.rulesLabel || 'Current rules'} needs exactly ${expected} West and ${expected} East players. Current: ${counts.west} West · ${counts.east} East.`);
      }

      const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(control.session.id)}`);
      if (!state?.recording) throw new Error('Upload or attach the full game video before starting recorded scoring.');

      const started = await api('/api/real-play/admin/career/control', {
        method: 'POST',
        json: { action: 'start-video-review' },
      });
      const startedControl = started?.control || null;
      const reviewStarted = Boolean(startedControl?.session?.recordedScoring?.reviewStarted);
      if (!reviewStarted) {
        const verify = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(control.session.id)}`);
        if (!verify?.recording?.reviewStartedAt) {
          throw new Error('The server did not confirm that recorded scoring started.');
        }
      }

      setInlineStatus('Recorded scoring started. Opening WATCH & SCORE…');
      window.setTimeout(() => {
        const tab = root()?.querySelector('[data-rp-video-tab]');
        tab?.click();
      }, 80);
    } catch (error) {
      const message = error?.message || 'Could not start recorded scoring.';
      setInlineStatus(message, true);
      window.alert(`Could not start recorded scoring:\n\n${message}`);
      button.disabled = false;
      button.textContent = originalText;
    } finally {
      starting = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-rp-video-start]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startRecordedScoring(button);
  }, true);
})();
