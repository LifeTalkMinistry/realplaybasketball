(() => {
  if (window.__realPlayGameRulesInstalled) return;
  window.__realPlayGameRulesInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let controlCache = null;
  let loading = null;
  let busy = false;
  let scheduled = false;
  let notice = '';
  let noticeType = '';
  let timeoutCompletionKey = '';
  let draft = { family: 'standard', target: 8, format: '3v3' };

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function syncDraftFromRules(rules) {
    if (!rules) return;
    if (rules.rulesetFamily === 'standard') {
      draft = { family: 'standard', target: 21, format: '3v3' };
      return;
    }
    if (rules.rulesetFamily === 'race_to') {
      draft = {
        family: 'race_to',
        target: Number(rules.targetScore || 8),
        format: String(rules.playerFormat || '3v3').toLowerCase(),
      };
    }
  }

  async function hydrate(force = false) {
    if (loading && !force) return loading;
    loading = request('GET')
      .then((data) => {
        controlCache = data?.control || null;
        syncDraftFromRules(controlCache?.session?.rules);
        return controlCache;
      })
      .catch(() => controlCache)
      .finally(() => { loading = null; schedule(); });
    return loading;
  }

  function rulesLabel(rules) {
    if (!rules) return 'RULES NOT CONFIRMED';
    if (rules.rulesetFamily === 'standard') return 'STANDARD · 3V3';
    return `RACE TO ${Number(rules.targetScore || 0)} · ${String(rules.playerFormat || '').toUpperCase()}`;
  }

  function rulesDetail(rules) {
    if (!rules) return 'Choose what the players agreed to play, then confirm it before START GAME.';
    if (rules.rulesetFamily === 'standard') return '10:00 · FIRST TO 21 · 12 SEC SHOT CLOCK · 1 × 30 SEC TIMEOUT EACH · OT FIRST TO 2';
    return `TARGET SCORE ${Number(rules.targetScore || 0)} · ${String(rules.playerFormat || '').toUpperCase()} · NO STANDARD CLOCKS OR TIMEOUTS`;
  }

  function draftRules() {
    if (draft.family === 'standard') {
      return {
        rulesetFamily: 'standard', standardPreset: 'standard_3v3', playerFormat: '3v3',
        playersPerSide: 3, targetScore: 21, regulationSeconds: 600, shotClockSeconds: 12,
        timeoutsPerTeam: 1, timeoutSeconds: 30, overtimeTargetPoints: 2,
      };
    }
    return {
      rulesetFamily: 'race_to', playerFormat: draft.format,
      playersPerSide: Number(String(draft.format).charAt(0)) || 3,
      targetScore: Number(draft.target || 8), regulationSeconds: null, shotClockSeconds: null,
      timeoutsPerTeam: 0, timeoutSeconds: null, overtimeTargetPoints: null,
    };
  }

  function activeTeamCounts() {
    const players = Array.isArray(controlCache?.players) ? controlCache.players : [];
    return players.reduce((counts, player) => {
      if (!player.checkedIn || !player.team) return counts;
      if (player.team === 'west') counts.west += 1;
      if (player.team === 'east') counts.east += 1;
      return counts;
    }, { west: 0, east: 0 });
  }

  function rosterValidation(rules = controlCache?.session?.rules) {
    if (!rules) return { ok: false, text: 'Confirm GAME RULES first.' };
    const expected = Number(rules.playersPerSide || 0);
    const counts = activeTeamCounts();
    if (!expected) return { ok: false, text: 'Player format is missing.' };
    if (counts.west !== expected || counts.east !== expected) {
      return {
        ok: false,
        text: `${rulesLabel(rules)} needs exactly ${expected} West and ${expected} East players. Current: ${counts.west} West · ${counts.east} East.`,
      };
    }
    return { ok: true, text: `${counts.west} West · ${counts.east} East · roster matches ${String(rules.playerFormat).toUpperCase()}.` };
  }

  function optionButton(label, attr, value, active, disabled = false) {
    return `<button type="button" class="rp-game-rules-option ${active ? 'active' : ''}" ${attr}="${esc(value)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
  }

  function renderPregameRules() {
    const adminBody = body();
    const pregame = adminBody?.querySelector('[data-courtside-pregame]');
    if (!pregame) return;

    const saved = controlCache?.session?.rules || null;
    const locked = Boolean(controlCache?.session?.rulesLocked);
    const start = pregame.querySelector('[data-control-action="start"]');
    const validation = rosterValidation(saved);

    let card = pregame.querySelector('[data-rp-game-rules-card]');
    if (!card) {
      card = document.createElement('section');
      card.className = 'rp-game-rules-card';
      card.dataset.rpGameRulesCard = '1';
      start?.before(card);
    }

    const preview = locked ? saved : draftRules();
    const lockClass = locked ? 'locked' : saved ? 'saved' : '';
    const lockText = locked ? 'LOCKED' : saved ? 'CONFIRMED' : 'NOT SET';
    const race = draft.family === 'race_to';

    card.innerHTML = `<div class="rp-game-rules-head">
        <div><small>GAME RULES</small><strong>WHAT ARE WE PLAYING?</strong></div>
        <span class="rp-game-rules-lock ${lockClass}">${lockText}</span>
      </div>
      <div class="rp-game-rules-family">
        <button type="button" class="rp-game-rules-choice ${!race ? 'active' : ''}" data-rp-rule-family="standard" ${locked || busy ? 'disabled' : ''}>STANDARD</button>
        <button type="button" class="rp-game-rules-choice ${race ? 'active' : ''}" data-rp-rule-family="race_to" ${locked || busy ? 'disabled' : ''}>RACE TO</button>
      </div>
      <div class="rp-game-rules-config">
        ${race ? `<div class="rp-game-rules-group"><label>RACE TARGET</label><div class="rp-game-rules-options">
          ${[8,16,21].map((value) => optionButton(`RACE TO ${value}`, 'data-rp-race-target', value, Number(draft.target) === value, locked || busy)).join('')}
        </div></div>
        <div class="rp-game-rules-group"><label>PLAYER FORMAT</label><div class="rp-game-rules-options">
          ${['3v3','4v4','5v5'].map((value) => optionButton(value.toUpperCase(), 'data-rp-player-format', value, draft.format === value, locked || busy)).join('')}
        </div></div>` : `<div class="rp-game-rules-group"><label>STANDARD PRESET</label><div class="rp-game-rules-options">
          ${optionButton('STANDARD 3V3', 'data-rp-standard-preset', 'standard_3v3', true, true)}
        </div></div>`}
      </div>
      <div class="rp-game-rules-summary"><small>${saved ? 'CURRENT / PREVIEW' : 'PREVIEW'}</small><strong>${esc(rulesLabel(preview))}</strong><span>${esc(rulesDetail(preview))}</span></div>
      ${locked ? '' : `<button type="button" class="rp-game-rules-confirm" data-rp-confirm-rules ${busy ? 'disabled' : ''}>${busy ? 'SAVING...' : saved ? 'UPDATE GAME RULES' : 'CONFIRM GAME RULES'}</button>`}
      <p class="rp-game-rules-notice ${noticeType}">${esc(notice || (saved ? validation.text : 'Rules must be confirmed before START GAME.'))}</p>`;

    if (start) {
      const startAllowed = Boolean(saved && validation.ok && !busy && !locked);
      start.disabled = !startAllowed;
      start.title = startAllowed ? '' : (saved ? validation.text : 'Confirm GAME RULES first.');
    }
  }

  function effectiveRemaining(clock) {
    if (!clock || clock.remainingMs === null || clock.remainingMs === undefined) return null;
    const base = Number(clock.remainingMs);
    if (!Number.isFinite(base)) return null;
    if (!clock.running || !clock.anchorAt) return Math.max(0, base);
    const anchor = new Date(clock.anchorAt).getTime();
    if (!Number.isFinite(anchor)) return Math.max(0, base);
    return Math.max(0, base - Math.max(0, Date.now() - anchor));
  }

  function formatGameClock(ms) {
    if (ms === null) return '—';
    const totalTenths = Math.max(0, Math.ceil(ms / 100));
    const totalSeconds = Math.floor(totalTenths / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0 && totalSeconds < 60) return `${seconds}.${totalTenths % 10}`;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function formatShotClock(ms) {
    if (ms === null) return '—';
    return String(Math.max(0, Math.ceil(ms / 1000)));
  }

  function scoreFromDom() {
    const adminBody = body();
    const sides = [...(adminBody?.querySelectorAll('.rp-admin-score-side') || [])];
    const read = (team) => {
      const side = sides.find((item) => item.querySelector('small')?.textContent.trim().toUpperCase() === team);
      return Number(side?.querySelector('strong')?.textContent || 0) || 0;
    };
    return { west: read('WEST'), east: read('EAST') };
  }

  function clientEndState(session) {
    const rules = session?.rules;
    if (!rules) return { reached: false, overtime: false, text: '' };
    const score = scoreFromDom();
    if (rules.rulesetFamily === 'race_to') {
      if (score.west >= Number(rules.targetScore) || score.east >= Number(rules.targetScore)) {
        return { reached: true, overtime: false, text: `RACE TO ${rules.targetScore} REACHED · REVIEW THE RESULT` };
      }
      return { reached: false, overtime: false, text: '' };
    }
    const overtimeActive = Boolean(session.overtime?.active || session.gamePhase === 'overtime');
    if (overtimeActive) {
      const westStart = Number(session.overtime?.westStartScore ?? score.west);
      const eastStart = Number(session.overtime?.eastStartScore ?? score.east);
      const target = Number(session.overtime?.targetPoints || 2);
      if ((score.west - westStart) >= target || (score.east - eastStart) >= target) {
        return { reached: true, overtime: false, text: 'OVERTIME TARGET REACHED · REVIEW THE RESULT' };
      }
      return { reached: false, overtime: false, text: '' };
    }
    if (score.west >= 21 || score.east >= 21) return { reached: true, overtime: false, text: 'FIRST TO 21 REACHED · REVIEW THE RESULT' };
    const gameLeft = effectiveRemaining(session.gameClock);
    if (gameLeft === 0) {
      if (score.west === score.east) return { reached: false, overtime: true, text: 'REGULATION TIED · OVERTIME REQUIRED' };
      return { reached: true, overtime: false, text: 'REGULATION COMPLETE · REVIEW THE RESULT' };
    }
    return { reached: false, overtime: false, text: '' };
  }

  function remainingTimeouts(session, team) {
    const allowed = Number(session?.timeouts?.allowedPerTeam || 0);
    const used = team === 'west' ? Number(session?.timeouts?.westUsed || 0) : Number(session?.timeouts?.eastUsed || 0);
    return Math.max(0, allowed - used);
  }

  function liveControlsHtml(session) {
    const rules = session?.rules;
    if (!rules) return '';
    const end = clientEndState(session);
    const phase = String(session.gamePhase || 'live').toUpperCase();
    const banner = end.text ? `<div class="rp-live-end-banner ${end.overtime ? 'ot' : ''}">${esc(end.text)}${end.overtime ? '<br><button type="button" class="rp-live-rule-action primary" data-rp-live-rule-action="start-overtime" style="margin-top:8px">START OVERTIME</button>' : ''}</div>` : '';
    const bar = `<div class="rp-live-rulebar"><div><small>GAME RULES · LOCKED</small><strong>${esc(rulesLabel(rules))}</strong></div><span>${esc(phase)}</span></div>`;

    if (rules.rulesetFamily === 'race_to') {
      const score = scoreFromDom();
      return `${bar}${banner}<div class="rp-live-race-panel"><small>OPEN RANKING · FLEXIBLE RULES</small><strong>RACE TO ${Number(rules.targetScore)}</strong><span>${esc(String(rules.playerFormat || '').toUpperCase())} · ${score.west}–${score.east}</span></div><div class="rp-live-rule-error" data-rp-live-rule-error>${esc(noticeType === 'error' ? notice : '')}</div>`;
    }

    const overtimeActive = Boolean(session.overtime?.active || session.gamePhase === 'overtime');
    const gameLeft = overtimeActive ? null : effectiveRemaining(session.gameClock);
    const shotLeft = effectiveRemaining(session.shotClock);
    const timeoutLeft = effectiveRemaining({
      remainingMs: session.timeouts?.activeRemainingMs,
      anchorAt: session.timeouts?.activeAnchorAt,
      running: session.timeouts?.running,
    });
    const timeoutTeam = session.timeouts?.activeTeam || null;
    const clockRunning = Boolean(session.gameClock?.running);
    const shotRunning = Boolean(session.shotClock?.running);
    const paused = !timeoutTeam && ((session.gamePhase === 'paused') || (overtimeActive && !shotRunning));
    const westRemaining = remainingTimeouts(session, 'west');
    const eastRemaining = remainingTimeouts(session, 'east');

    return `${bar}${banner}<section class="rp-live-clock-panel">
      <div class="rp-live-clocks">
        <div class="rp-live-clock ${gameLeft === 0 ? 'expired' : ''}"><small>GAME CLOCK</small><strong data-rp-game-clock>${overtimeActive ? 'OT' : formatGameClock(gameLeft)}</strong><span class="rp-live-clock-status">${overtimeActive ? 'FIRST TO 2' : timeoutTeam ? 'STOPPED · TIMEOUT' : clockRunning ? 'RUNNING' : 'STOPPED'}</span></div>
        <div class="rp-live-clock shot ${shotLeft === 0 ? 'expired' : ''}"><small>SHOT CLOCK</small><strong data-rp-shot-clock>${formatShotClock(shotLeft)}</strong><span class="rp-live-clock-status">${shotLeft === 0 ? 'EXPIRED' : shotRunning ? 'RUNNING' : 'STOPPED'}</span></div>
      </div>
      ${timeoutTeam ? `<div class="rp-live-timeout-overlay"><small>${esc(timeoutTeam.toUpperCase())} TIMEOUT</small><strong data-rp-timeout-clock>${formatShotClock(timeoutLeft)}</strong><span>FULL 30-SECOND TIMEOUT · GAME STOPPED</span></div>` : `<div class="rp-live-clock-actions">
        <button type="button" class="rp-live-rule-action ${paused ? 'primary' : ''}" data-rp-live-rule-action="${paused ? 'resume-clock' : 'pause-clock'}">${paused ? 'RESUME GAME' : 'STOP CLOCK'}</button>
        <button type="button" class="rp-live-rule-action" data-rp-live-rule-action="reset-shot-clock">RESET SHOT · 12</button>
      </div>
      ${overtimeActive ? '' : `<div class="rp-live-clock-actions three"><button type="button" class="rp-live-rule-action" data-rp-live-rule-action="adjust-game-clock" data-delta-seconds="-5">−5 SEC</button><button type="button" class="rp-live-rule-action" disabled>MANUAL TIME</button><button type="button" class="rp-live-rule-action" data-rp-live-rule-action="adjust-game-clock" data-delta-seconds="5">+5 SEC</button></div>`}
      <div class="rp-live-timeouts">
        <div class="rp-live-timeout-team"><div><span>WEST TIMEOUT</span><strong>${westRemaining} LEFT</strong></div><button type="button" class="rp-live-rule-action" data-rp-live-rule-action="timeout" data-team="west" ${westRemaining < 1 ? 'disabled' : ''}>CALL TIMEOUT</button></div>
        <div class="rp-live-timeout-team"><div><span>EAST TIMEOUT</span><strong>${eastRemaining} LEFT</strong></div><button type="button" class="rp-live-rule-action" data-rp-live-rule-action="timeout" data-team="east" ${eastRemaining < 1 ? 'disabled' : ''}>CALL TIMEOUT</button></div>
      </div>`}
      <div class="rp-live-rule-error" data-rp-live-rule-error>${esc(noticeType === 'error' ? notice : '')}</div>
    </section>`;
  }

  function renderLiveControls() {
    const adminBody = body();
    const view = adminBody?.querySelector('[data-courtside-view]:not([data-courtside-review])');
    const session = controlCache?.session;
    if (!view || !session || session.gameStatus !== 'live' || !session.rules) return;
    let mount = view.querySelector('[data-rp-live-rules-controls]');
    if (!mount) {
      mount = document.createElement('div');
      mount.dataset.rpLiveRulesControls = '1';
      const head = view.querySelector('.rp-courtside-head');
      head?.insertAdjacentElement('afterend', mount);
    }
    if (mount) mount.innerHTML = liveControlsHtml(session);
  }

  function updateClockText() {
    const adminRoot = root();
    const adminBody = body();
    const session = controlCache?.session;
    if (!adminRoot?.classList.contains('open')) return;

    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';
    if (active === 'live') {
      if (adminBody?.querySelector('[data-courtside-pregame]') && !adminBody.querySelector('[data-rp-game-rules-card]')) schedule();
      if (adminBody?.querySelector('[data-courtside-view]:not([data-courtside-review])') && !adminBody.querySelector('[data-rp-live-rules-controls]')) schedule();
    }
    if (active === 'finalize' && adminBody?.querySelector('[data-courtside-review]') && !adminBody.querySelector('[data-rp-review-rules]')) schedule();

    if (!session || session.gameStatus !== 'live') return;
    const game = adminRoot.querySelector('[data-rp-game-clock]');
    const shot = adminRoot.querySelector('[data-rp-shot-clock]');
    const timeout = adminRoot.querySelector('[data-rp-timeout-clock]');
    const overtimeActive = Boolean(session.overtime?.active || session.gamePhase === 'overtime');
    if (game && !overtimeActive) game.textContent = formatGameClock(effectiveRemaining(session.gameClock));
    if (shot) shot.textContent = formatShotClock(effectiveRemaining(session.shotClock));
    if (timeout) {
      const left = effectiveRemaining({
        remainingMs: session.timeouts?.activeRemainingMs,
        anchorAt: session.timeouts?.activeAnchorAt,
        running: session.timeouts?.running,
      });
      timeout.textContent = formatShotClock(left);
      if (left === 0 && session.timeouts?.activeTeam && session.timeouts?.activeAnchorAt) {
        const key = `${session.timeouts.activeTeam}:${session.timeouts.activeAnchorAt}`;
        if (timeoutCompletionKey !== key) {
          timeoutCompletionKey = key;
          mutate({ action: 'complete-timeout' }, { silentSuccess: true });
        }
      }
    }
    const end = clientEndState(session);
    const existing = adminRoot.querySelector('.rp-live-end-banner');
    if (end.text && !existing) renderLiveControls();
  }

  function renderReviewContext() {
    const adminBody = body();
    const review = adminBody?.querySelector('[data-courtside-review]');
    const rules = controlCache?.session?.rules;
    if (!review || !rules) return;
    let bar = review.querySelector('[data-rp-review-rules]');
    if (!bar) {
      bar = document.createElement('div');
      bar.dataset.rpReviewRules = '1';
      review.querySelector('.rp-courtside-head')?.insertAdjacentElement('afterend', bar);
    }
    if (bar) bar.innerHTML = `<div class="rp-live-rulebar"><div><small>GAME RULES</small><strong>${esc(rulesLabel(rules))}</strong></div><span>REVIEW</span></div>`;
  }

  function apply() {
    const adminRoot = root();
    if (!adminRoot?.classList.contains('open')) return;
    const active = adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab || '';
    if (active === 'live') {
      renderPregameRules();
      renderLiveControls();
    } else if (active === 'finalize') {
      renderReviewContext();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  async function mutate(payload, options = {}) {
    if (busy) return null;
    busy = true;
    notice = '';
    noticeType = '';
    schedule();
    try {
      const data = await request('POST', payload);
      controlCache = data?.control || controlCache;
      syncDraftFromRules(controlCache?.session?.rules);
      if (!options.silentSuccess) {
        notice = options.success || '';
        noticeType = notice ? 'good' : '';
      }
      return controlCache;
    } catch (error) {
      notice = error.message || 'Game control action failed.';
      noticeType = 'error';
      return null;
    } finally {
      busy = false;
      schedule();
    }
  }

  async function confirmRules() {
    const rules = draftRules();
    const result = await mutate({
      action: 'set-rules',
      rulesetFamily: rules.rulesetFamily,
      standardPreset: rules.standardPreset || null,
      playerFormat: rules.playerFormat,
      targetScore: rules.targetScore,
    }, { success: 'GAME RULES CONFIRMED. Check the roster, then START GAME.' });
    if (result) {
      const validation = rosterValidation(result.session?.rules);
      if (!validation.ok) {
        notice = validation.text;
        noticeType = 'error';
        schedule();
      }
    }
  }

  async function startGame(button) {
    if (busy) return;
    await hydrate(true);
    const rules = controlCache?.session?.rules;
    if (!rules) {
      notice = 'Confirm GAME RULES before START GAME.';
      noticeType = 'error';
      schedule();
      return;
    }
    const validation = rosterValidation(rules);
    if (!validation.ok) {
      notice = validation.text;
      noticeType = 'error';
      schedule();
      return;
    }
    if (!window.confirm(`Start this official Open Ranking game?\n\n${rulesLabel(rules)}\n${rulesDetail(rules)}\n\nThe rules and active rosters will lock.`)) return;
    const result = await mutate({ action: 'start' }, { success: `${rulesLabel(rules)} started. Rules are now locked.` });
    if (result) {
      button.disabled = true;
      window.dispatchEvent(new Event('focus'));
    }
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;
    const start = event.target.closest('[data-control-action="start"]');
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!start.disabled) startGame(start);
  }, true);

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;

    const family = event.target.closest('[data-rp-rule-family]');
    if (family) {
      draft.family = family.dataset.rpRuleFamily === 'race_to' ? 'race_to' : 'standard';
      notice = '';
      noticeType = '';
      renderPregameRules();
      return;
    }
    const target = event.target.closest('[data-rp-race-target]');
    if (target) {
      draft.target = Number(target.dataset.rpRaceTarget || 8);
      notice = '';
      noticeType = '';
      renderPregameRules();
      return;
    }
    const format = event.target.closest('[data-rp-player-format]');
    if (format) {
      draft.format = String(format.dataset.rpPlayerFormat || '3v3');
      notice = '';
      noticeType = '';
      renderPregameRules();
      return;
    }
    if (event.target.closest('[data-rp-confirm-rules]')) {
      confirmRules();
      return;
    }

    const actionButton = event.target.closest('[data-rp-live-rule-action]');
    if (!actionButton || actionButton.disabled) return;
    const action = actionButton.dataset.rpLiveRuleAction;
    const payload = { action };
    if (actionButton.dataset.team) payload.team = actionButton.dataset.team;
    if (actionButton.dataset.deltaSeconds) payload.deltaSeconds = Number(actionButton.dataset.deltaSeconds);
    if (action === 'timeout') {
      const team = String(payload.team || '').toUpperCase();
      if (!window.confirm(`${team} calls its one 30-second timeout?\n\nThe full 30 seconds will be consumed and game clocks will stop.`)) return;
    }
    mutate(payload, { silentSuccess: true });
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    schedule();
    const adminRoot = root();
    if (!adminRoot?.classList.contains('open')) return;
    if (!controlCache || adminRoot.querySelector('.rp-admin-tab.active')?.dataset.adminTab === 'live') hydrate(true);
  });

  window.addEventListener('focus', () => {
    if (root()?.classList.contains('open')) hydrate(true);
  });

  window.setInterval(updateClockText, 100);
  hydrate();
})();
