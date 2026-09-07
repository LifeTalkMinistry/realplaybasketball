(() => {
  if (window.__realPlayReplayAdminEditInstalled) return;
  window.__realPlayReplayAdminEditInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STATS = [
    { key: 'ast', label: 'AST', type: 'stat', aliases: ['ast', 'assist', 'assists'] },
    { key: 'reb', label: 'REB', type: 'stat', aliases: ['reb', 'rebound', 'rebounds'] },
    { key: 'to', label: 'TO', type: 'stat', aliases: ['to', 'tov', 'turnover', 'turnovers'] },
    { key: 'stl', label: 'STL', type: 'stat', aliases: ['stl', 'steal', 'steals'] },
    { key: 'blk', label: 'BLK', type: 'stat', aliases: ['blk', 'block', 'blocks'] },
    { key: 'foul', label: 'FOUL', type: 'stat', aliases: ['foul', 'fouls'] },
  ];
  const SHOTS = [
    { key: 'one-make', label: '1PT MAKE', type: 'shot', value: 1, result: 'make' },
    { key: 'one-miss', label: '1PT MISS', type: 'shot', value: 1, result: 'miss' },
    { key: 'two-make', label: '2PT MAKE', type: 'shot', value: 2, result: 'make' },
    { key: 'two-miss', label: '2PT MISS', type: 'shot', value: 2, result: 'miss' },
  ];

  let currentSessionId = 0;
  let editor = null;
  let context = null;
  let draftEvents = [];
  let expandedPlayerId = null;
  let busy = false;
  let notice = '';
  let noticeError = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function adminVerified() {
    return window.__realPlayAdminVerified === true;
  }

  function viewer() {
    return document.querySelector('[data-rp-career-replay].open');
  }

  function replayClockMs() {
    const text = String(viewer()?.querySelector('[data-rp-career-replay-clock]')?.textContent || '').split('/')[0].trim();
    const parts = text.split(':').map(Number);
    if (!text || parts.some((value) => !Number.isFinite(value))) return 0;
    if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
    return Math.round((parts[0] || 0) * 1000);
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function parseTime(value) {
    const clean = String(value || '').trim();
    if (!clean) return 0;
    const parts = clean.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    else return null;
    return Math.round(seconds * 1000);
  }

  async function api(sessionId, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/replay-corrections/${encodeURIComponent(sessionId)}`, {
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

  function normalizeEvent(event, index) {
    return {
      localId: `event-${Number(event?.id || 0)}-${index}`,
      playerId: Number(event?.playerId ?? event?.player_id),
      eventType: String(event?.eventType ?? event?.event_type || '').toLowerCase(),
      statKey: event?.statKey ?? event?.stat_key ?? null,
      shotValue: event?.shotValue ?? event?.shot_value ?? null,
      shotResult: event?.shotResult ?? event?.shot_result ?? null,
      videoTimestampMs: Number(event?.videoTimestampMs ?? event?.video_timestamp_ms ?? 0),
      originalOrder: index,
    };
  }

  function playerEvents(playerId) {
    return draftEvents.filter((event) => Number(event.playerId) === Number(playerId));
  }

  function countShot(playerId, value, result) {
    return playerEvents(playerId).filter((event) => event.eventType === 'shot'
      && Number(event.shotValue) === Number(value)
      && String(event.shotResult).toLowerCase() === result).length;
  }

  function countStat(playerId, aliases) {
    return playerEvents(playerId).filter((event) => event.eventType === 'stat'
      && aliases.includes(String(event.statKey || '').toLowerCase())).length;
  }

  function summary(playerId) {
    const oneMade = countShot(playerId, 1, 'make');
    const oneMiss = countShot(playerId, 1, 'miss');
    const twoMade = countShot(playerId, 2, 'make');
    const twoMiss = countShot(playerId, 2, 'miss');
    const result = {
      pts: oneMade + twoMade * 2,
      oneMade,
      oneMiss,
      twoMade,
      twoMiss,
    };
    STATS.forEach((stat) => { result[stat.key] = countStat(playerId, stat.aliases); });
    return result;
  }

  function teamScore(team) {
    return (context?.players || [])
      .filter((player) => String(player.team || '').toLowerCase() === team)
      .reduce((total, player) => total + summary(player.playerId).pts, 0);
  }

  function currentTimestampMs() {
    const input = editor?.querySelector('[data-rp-correction-time]');
    const ms = parseTime(input?.value || '');
    if (ms === null) throw new Error('Use a valid video time such as 0:59 or 1:02:15.');
    const duration = Number(context?.recording?.durationMs || 0);
    if (duration > 0 && ms > duration + 2000) throw new Error('That timestamp is beyond this game video.');
    return ms;
  }

  function removeLatest(playerId, predicate) {
    let bestIndex = -1;
    let bestTime = -1;
    for (let index = 0; index < draftEvents.length; index += 1) {
      const event = draftEvents[index];
      if (Number(event.playerId) !== Number(playerId) || !predicate(event)) continue;
      const time = Number(event.videoTimestampMs || 0);
      if (time >= bestTime) {
        bestTime = time;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) draftEvents.splice(bestIndex, 1);
  }

  function addShot(playerId, value, result) {
    const timestamp = currentTimestampMs();
    draftEvents.push({
      localId: `new-${Date.now()}-${Math.random()}`,
      playerId: Number(playerId),
      eventType: 'shot',
      statKey: null,
      shotValue: Number(value),
      shotResult: result,
      videoTimestampMs: timestamp,
      originalOrder: draftEvents.length + 100000,
    });
  }

  function addStat(playerId, key) {
    const timestamp = currentTimestampMs();
    draftEvents.push({
      localId: `new-${Date.now()}-${Math.random()}`,
      playerId: Number(playerId),
      eventType: 'stat',
      statKey: key,
      shotValue: null,
      shotResult: null,
      videoTimestampMs: timestamp,
      originalOrder: draftEvents.length + 100000,
    });
  }

  function controlRow(playerId, item, count) {
    return `<div class="rp-correction-control-row">
      <span>${esc(item.label)}</span>
      <div>
        <button type="button" data-rp-correction-minus="${esc(item.key)}" data-player-id="${Number(playerId)}" ${count ? '' : 'disabled'} aria-label="Remove ${esc(item.label)}">−</button>
        <strong>${count}</strong>
        <button type="button" data-rp-correction-plus="${esc(item.key)}" data-player-id="${Number(playerId)}" aria-label="Add ${esc(item.label)}">+</button>
      </div>
    </div>`;
  }

  function playerCard(player) {
    const stats = summary(player.playerId);
    const expanded = Number(expandedPlayerId) === Number(player.playerId);
    return `<article class="rp-correction-player ${expanded ? 'open' : ''}" data-player-card="${Number(player.playerId)}">
      <button type="button" class="rp-correction-player-head" data-rp-correction-expand="${Number(player.playerId)}">
        <div><small>${esc(String(player.team || '').toUpperCase())}${player.playerNumber === null ? '' : ` · #${Number(player.playerNumber)}`}</small><strong>${esc(player.playerName)}</strong></div>
        <div class="rp-correction-player-summary"><b>${stats.pts}</b><span>PTS</span><i>${expanded ? '−' : '+'}</i></div>
      </button>
      ${expanded ? `<div class="rp-correction-player-body">
        <div class="rp-correction-mini-line">${stats.ast} AST · ${stats.reb} REB · ${stats.to} TO · ${stats.stl} STL · ${stats.blk} BLK · ${stats.foul} FOUL</div>
        <div class="rp-correction-section-label">SHOTS</div>
        <div class="rp-correction-control-grid">${SHOTS.map((item) => controlRow(player.playerId, item, countShot(player.playerId, item.value, item.result))).join('')}</div>
        <div class="rp-correction-section-label">PLAYER STATS</div>
        <div class="rp-correction-control-grid">${STATS.map((item) => controlRow(player.playerId, item, countStat(player.playerId, item.aliases))).join('')}</div>
      </div>` : ''}
    </article>`;
  }

  function teamSection(team) {
    const players = (context?.players || []).filter((player) => String(player.team || '').toLowerCase() === team);
    return `<section class="rp-correction-team">
      <header><strong>${team.toUpperCase()}</strong><b>${teamScore(team)}</b></header>
      <div>${players.map(playerCard).join('') || '<p class="rp-correction-empty">NO PLAYERS</p>'}</div>
    </section>`;
  }

  function renderEditor() {
    if (!editor || !context) return;
    const body = editor.querySelector('[data-rp-correction-body]');
    if (!body) return;
    body.innerHTML = `
      <div class="rp-correction-score"><div><small>WEST</small><strong>${teamScore('west')}</strong></div><span>—</span><div><small>EAST</small><strong>${teamScore('east')}</strong></div></div>
      ${notice ? `<div class="rp-correction-notice ${noticeError ? 'error' : ''}">${esc(notice)}</div>` : ''}
      <div class="rp-correction-time-card">
        <div><strong>VIDEO TIME FOR NEW EVENT</strong><small>Before tapping +, set the exact moment the stat happened. This keeps assists and replay data attached to the correct play.</small></div>
        <div class="rp-correction-time-actions"><input type="text" inputmode="numeric" data-rp-correction-time value="${esc(editor.dataset.timeValue || formatTime(replayClockMs()))}" placeholder="0:59"><button type="button" data-rp-correction-use-time>USE REPLAY TIME</button></div>
      </div>
      <div class="rp-correction-help"><strong>ADMIN CORRECTION</strong><span>− removes the latest matching event. + adds a new event at the video time above. PTS is calculated from 1PT/2PT makes.</span></div>
      <div class="rp-correction-teams">${teamSection('west')}${teamSection('east')}</div>
      <div class="rp-correction-save-wrap"><button type="button" data-rp-correction-save ${busy ? 'disabled' : ''}>${busy ? 'SAVING…' : 'SAVE OFFICIAL CORRECTION'}</button></div>`;
  }

  function ensureEditor() {
    if (editor?.isConnected) return editor;
    editor = document.createElement('section');
    editor.className = 'rp-replay-correction';
    editor.setAttribute('aria-hidden', 'true');
    editor.innerHTML = `
      <div class="rp-correction-shell">
        <header class="rp-correction-topbar">
          <button type="button" data-rp-correction-close aria-label="Back to replay">←</button>
          <div><small>REAL PLAY ADMIN</small><strong data-rp-correction-title>EDIT OFFICIAL STATS</strong></div>
          <span>✎</span>
        </header>
        <main data-rp-correction-body></main>
      </div>`;
    document.body.appendChild(editor);
    editor.addEventListener('click', handleEditorClick);
    return editor;
  }

  function closeEditor() {
    if (!editor) return;
    const input = editor.querySelector('[data-rp-correction-time]');
    if (input) editor.dataset.timeValue = input.value;
    editor.classList.remove('open');
    editor.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-replay-correction-open');
  }

  async function openEditor() {
    if (!currentSessionId || busy) return;
    const root = ensureEditor();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-replay-correction-open');
    root.dataset.timeValue = formatTime(replayClockMs());
    const body = root.querySelector('[data-rp-correction-body]');
    if (body) body.innerHTML = '<div class="rp-correction-loading">LOADING OFFICIAL SCORE SHEET…</div>';

    try {
      const data = await api(currentSessionId);
      context = data;
      draftEvents = (Array.isArray(data.events) ? data.events : []).map(normalizeEvent);
      expandedPlayerId = data.players?.[0]?.playerId ?? null;
      notice = '';
      noticeError = false;
      const title = root.querySelector('[data-rp-correction-title]');
      if (title) title.textContent = data.session?.title || 'EDIT OFFICIAL STATS';
      renderEditor();
    } catch (error) {
      context = null;
      if (body) body.innerHTML = `<div class="rp-correction-error"><strong>EDITING UNAVAILABLE</strong><span>${esc(error.message || 'Unable to load this official game.')}</span><button type="button" data-rp-correction-close>CLOSE</button></div>`;
    }
  }

  function saveTimeValue() {
    const input = editor?.querySelector('[data-rp-correction-time]');
    if (input) editor.dataset.timeValue = input.value;
  }

  function changeEvent(button, direction) {
    saveTimeValue();
    const playerId = Number(button.dataset.playerId || 0);
    const key = direction === 'plus' ? button.dataset.rpCorrectionPlus : button.dataset.rpCorrectionMinus;
    const shot = SHOTS.find((item) => item.key === key);
    const stat = STATS.find((item) => item.key === key);
    try {
      if (shot) {
        if (direction === 'plus') addShot(playerId, shot.value, shot.result);
        else removeLatest(playerId, (event) => event.eventType === 'shot' && Number(event.shotValue) === shot.value && String(event.shotResult).toLowerCase() === shot.result);
      } else if (stat) {
        if (direction === 'plus') addStat(playerId, stat.key);
        else removeLatest(playerId, (event) => event.eventType === 'stat' && stat.aliases.includes(String(event.statKey || '').toLowerCase()));
      }
      notice = '';
      noticeError = false;
    } catch (error) {
      notice = error.message || 'Unable to change that stat.';
      noticeError = true;
    }
    renderEditor();
  }

  async function saveCorrection() {
    if (busy || !context?.session?.id) return;
    saveTimeValue();
    const west = teamScore('west');
    const east = teamScore('east');
    if (west === east) {
      notice = 'A finalized Career game cannot be saved as a tie.';
      noticeError = true;
      renderEditor();
      return;
    }
    if (!window.confirm(`Save this official correction? Final score will be WEST ${west} – ${east} EAST.`)) return;

    busy = true;
    notice = '';
    noticeError = false;
    renderEditor();
    try {
      const ordered = draftEvents
        .map((event, index) => ({ ...event, submitOrder: index }))
        .sort((a, b) => Number(a.videoTimestampMs || 0) - Number(b.videoTimestampMs || 0) || a.submitOrder - b.submitOrder);
      const result = await api(context.session.id, {
        method: 'POST',
        json: {
          events: ordered.map((event) => ({
            playerId: Number(event.playerId),
            eventType: event.eventType,
            statKey: event.statKey,
            shotValue: event.shotValue,
            shotResult: event.shotResult,
            videoTimestampMs: Number(event.videoTimestampMs || 0),
          })),
        },
      });
      busy = false;
      notice = `Official correction saved. WEST ${Number(result.westScore || 0)} – ${Number(result.eastScore || 0)} EAST.`;
      noticeError = false;
      renderEditor();
      window.setTimeout(() => {
        closeEditor();
        const trigger = document.querySelector(`[data-rp-career-replay-session="${Number(context.session.id)}"]`);
        if (trigger) trigger.click();
        else window.location.reload();
      }, 650);
    } catch (error) {
      busy = false;
      notice = error.message || 'Unable to save the official correction.';
      noticeError = true;
      renderEditor();
    }
  }

  function handleEditorClick(event) {
    if (event.target.closest('[data-rp-correction-close]')) {
      closeEditor();
      return;
    }
    const expand = event.target.closest('[data-rp-correction-expand]');
    if (expand) {
      saveTimeValue();
      const id = Number(expand.dataset.rpCorrectionExpand);
      expandedPlayerId = Number(expandedPlayerId) === id ? null : id;
      renderEditor();
      return;
    }
    const plus = event.target.closest('[data-rp-correction-plus]');
    if (plus) {
      changeEvent(plus, 'plus');
      return;
    }
    const minus = event.target.closest('[data-rp-correction-minus]');
    if (minus) {
      changeEvent(minus, 'minus');
      return;
    }
    if (event.target.closest('[data-rp-correction-use-time]')) {
      const input = editor.querySelector('[data-rp-correction-time]');
      const value = formatTime(replayClockMs());
      if (input) input.value = value;
      editor.dataset.timeValue = value;
      return;
    }
    if (event.target.closest('[data-rp-correction-save]')) saveCorrection();
  }

  function pencilSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19.6 8.6a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Zm11-13 2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function syncPencil() {
    const root = viewer();
    if (!root) return;
    const topbar = root.querySelector('.rp-career-replay-topbar');
    if (!topbar) return;
    let button = topbar.querySelector('[data-rp-replay-admin-edit]');
    const shouldShow = adminVerified() && currentSessionId > 0;
    if (!shouldShow) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-replay-admin-edit';
      button.dataset.rpReplayAdminEdit = '1';
      button.setAttribute('aria-label', 'Edit official game stats');
      button.innerHTML = pencilSvg();
      topbar.appendChild(button);
      button.addEventListener('click', openEditor);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{width:38px;height:38px;display:grid;place-items:center;justify-self:end;border:1px solid rgba(85,197,229,.22);border-radius:11px;background:#061722;color:#a7edf6;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.2)}
    .rp-replay-admin-edit:hover{border-color:rgba(85,224,245,.5);background:#082331;color:#d9fbff}.rp-replay-admin-edit:active{transform:scale(.96)}
    .rp-replay-admin-edit svg{width:17px;height:17px}
    .rp-replay-correction{position:fixed;inset:0;z-index:100000;display:none;background:#020a11;color:#eafaff;overflow:auto;-webkit-overflow-scrolling:touch}
    .rp-replay-correction.open{display:block}.rp-replay-correction-open{overflow:hidden!important}
    .rp-correction-shell{width:min(760px,100%);min-height:100%;margin:0 auto;background:linear-gradient(180deg,#020b12,#04131d 55%,#020a11)}
    .rp-correction-topbar{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;min-height:70px;padding:0 16px;border-bottom:1px solid rgba(82,168,197,.16);background:rgba(2,10,17,.94);backdrop-filter:blur(12px)}
    .rp-correction-topbar>button{width:38px;height:38px;border:1px solid rgba(85,197,229,.2);border-radius:11px;background:#061722;color:#dffaff;font-size:1rem}
    .rp-correction-topbar>div{text-align:center;min-width:0}.rp-correction-topbar small{display:block;color:#5ea6b8;font-size:.48rem;font-weight:950;letter-spacing:.12em}.rp-correction-topbar strong{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.84rem;font-style:italic;letter-spacing:.02em}.rp-correction-topbar>span{justify-self:end;color:#59d7e8;font-size:1rem}
    .rp-correction-shell main{padding:18px 16px 34px}
    .rp-correction-score{display:flex;align-items:center;justify-content:center;gap:18px;padding:15px;border:1px solid rgba(76,179,207,.16);border-radius:16px;background:#061722}.rp-correction-score div{text-align:center}.rp-correction-score small{display:block;color:#6d98a7;font-size:.48rem;font-weight:900}.rp-correction-score strong{display:block;margin-top:2px;font-size:1.55rem}.rp-correction-score span{color:#446773}
    .rp-correction-time-card{display:grid;gap:12px;margin-top:14px;padding:14px;border:1px solid rgba(82,191,218,.16);border-radius:15px;background:#05131c}.rp-correction-time-card strong{display:block;font-size:.66rem;letter-spacing:.06em}.rp-correction-time-card small{display:block;margin-top:4px;color:#7ca1ad;font-size:.57rem;line-height:1.45}.rp-correction-time-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.rp-correction-time-actions input{min-width:0;height:42px;padding:0 12px;border:1px solid rgba(95,211,234,.22);border-radius:10px;background:#020b11;color:#fff;font-weight:900}.rp-correction-time-actions button{padding:0 12px;border:1px solid rgba(79,216,235,.24);border-radius:10px;background:#08212d;color:#8deaf5;font-size:.55rem;font-weight:950}
    .rp-correction-help{display:grid;gap:3px;margin:10px 0 15px;padding:10px 12px;border-radius:11px;background:rgba(54,180,202,.07)}.rp-correction-help strong{color:#65ddeb;font-size:.55rem;letter-spacing:.08em}.rp-correction-help span{color:#779ca8;font-size:.54rem;line-height:1.45}
    .rp-correction-teams{display:grid;gap:14px}.rp-correction-team{border:1px solid rgba(72,164,192,.15);border-radius:15px;overflow:hidden;background:#04121b}.rp-correction-team>header{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:#071b26}.rp-correction-team>header strong{color:#63dce9;font-size:.64rem;letter-spacing:.08em}.rp-correction-team>header b{font-size:1rem}
    .rp-correction-player{border-top:1px solid rgba(78,164,189,.11)}.rp-correction-player:first-child{border-top:0}.rp-correction-player-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:0;background:transparent;color:inherit;text-align:left}.rp-correction-player-head small{display:block;color:#668f9d;font-size:.47rem;font-weight:900}.rp-correction-player-head strong{display:block;margin-top:2px;font-size:.69rem}.rp-correction-player-summary{display:flex;align-items:center;gap:5px}.rp-correction-player-summary b{font-size:.9rem}.rp-correction-player-summary span{color:#628b99;font-size:.43rem;font-weight:900}.rp-correction-player-summary i{width:24px;height:24px;display:grid;place-items:center;margin-left:4px;border:1px solid rgba(93,203,225,.16);border-radius:7px;color:#6cdde9;font-style:normal}
    .rp-correction-player-body{padding:0 12px 13px}.rp-correction-mini-line{padding:9px 10px;border-radius:9px;background:#071a24;color:#86aab5;font-size:.5rem;font-weight:800}.rp-correction-section-label{margin:12px 0 6px;color:#5d8795;font-size:.48rem;font-weight:950;letter-spacing:.09em}.rp-correction-control-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rp-correction-control-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:42px;padding:7px 8px;border:1px solid rgba(72,171,197,.13);border-radius:9px;background:#061821}.rp-correction-control-row>span{font-size:.52rem;font-weight:900}.rp-correction-control-row>div{display:flex;align-items:center;gap:6px}.rp-correction-control-row button{width:27px;height:27px;border:1px solid rgba(84,205,226,.2);border-radius:7px;background:#08232f;color:#8eeaf4;font-size:.85rem;font-weight:900}.rp-correction-control-row button:disabled{opacity:.25}.rp-correction-control-row strong{min-width:16px;text-align:center;font-size:.68rem}
    .rp-correction-save-wrap{position:sticky;bottom:0;margin:18px -16px -34px;padding:12px 16px 18px;background:linear-gradient(180deg,rgba(2,10,17,0),#020a11 26%)}.rp-correction-save-wrap button{width:100%;min-height:48px;border:1px solid rgba(68,229,240,.36);border-radius:12px;background:linear-gradient(105deg,#0a5665,#0a3948);color:#e8feff;font-size:.65rem;font-weight:950;letter-spacing:.05em}.rp-correction-save-wrap button:disabled{opacity:.55}
    .rp-correction-notice{margin:12px 0;padding:10px 12px;border:1px solid rgba(79,224,196,.2);border-radius:10px;background:rgba(42,181,153,.08);color:#99f3df;font-size:.58rem;font-weight:800}.rp-correction-notice.error{border-color:rgba(255,100,100,.22);background:rgba(160,44,44,.08);color:#ffb4b4}.rp-correction-loading,.rp-correction-error{min-height:55vh;display:grid;place-items:center;text-align:center;color:#7fa6b2;font-size:.62rem;font-weight:900}.rp-correction-error{align-content:center;gap:8px}.rp-correction-error strong{color:#fff}.rp-correction-error button{margin-top:8px;padding:10px 16px;border:1px solid rgba(80,210,230,.2);border-radius:9px;background:#08202b;color:#dffaff}.rp-correction-empty{padding:14px;color:#668b97;font-size:.55rem;text-align:center}
    @media(max-width:460px){.rp-correction-shell main{padding:14px 12px 28px}.rp-correction-control-grid{grid-template-columns:1fr}.rp-correction-save-wrap{margin-left:-12px;margin-right:-12px;margin-bottom:-28px;padding-left:12px;padding-right:12px}.rp-correction-time-actions{grid-template-columns:1fr}.rp-correction-time-actions button{min-height:38px}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-career-replay-session]');
    if (!trigger) return;
    const id = Number(trigger.dataset.rpCareerReplaySession || 0);
    if (Number.isSafeInteger(id) && id > 0) {
      currentSessionId = id;
      window.setTimeout(syncPencil, 120);
    }
  }, true);

  const observer = new MutationObserver(() => syncPencil());
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.setInterval(syncPencil, 700);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    currentSessionId = 0;
    closeEditor();
    syncPencil();
  });
})();
