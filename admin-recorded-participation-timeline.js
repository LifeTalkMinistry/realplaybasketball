(() => {
  if (window.__realPlayRecordedParticipationTimelineInstalled) return;
  window.__realPlayRecordedParticipationTimelineInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STORAGE_PREFIX = 'rp-recorded-participation:v1:';

  let sessionId = 0;
  let players = new Map();
  let knownPlayerIds = new Set();
  let state = {};
  let menu = null;
  let menuPlayerId = 0;
  let syncTimer = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function screen() {
    return document.querySelector('.rp-admin-control .rp-video-scoring-screen') || null;
  }

  function correctionState(sc = screen()) {
    if (!sc?.matches?.('[data-rp-replay-correction-mode]')) return null;
    try {
      const value = window.__realPlayReplayCorrectionAuditState?.();
      return value?.active ? value : null;
    } catch (_) {
      return null;
    }
  }

  function video() {
    return screen()?.querySelector('[data-rp-recorded-video]') || null;
  }

  function currentMs() {
    const correction = correctionState();
    if (correction) {
      return Math.max(0, Math.round(Number(correction.currentVideoMs || 0)));
    }
    return Math.max(0, Math.round(Number(video()?.currentTime || 0) * 1000));
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function key() {
    return sessionId ? `${STORAGE_PREFIX}${sessionId}` : '';
  }

  function loadState(serverParticipation = null) {
    if (!key()) {
      state = {};
      return;
    }
    try {
      const raw = localStorage.getItem(key());
      if (raw !== null) {
        const parsed = JSON.parse(raw || '{}');
        state = parsed && typeof parsed === 'object' ? parsed : {};
        return;
      }
    } catch (_) {}

    state = {};
    for (const row of Array.isArray(serverParticipation) ? serverParticipation : []) {
      const playerId = Number(row?.playerId ?? row?.player_id ?? 0);
      if (!Number.isSafeInteger(playerId) || playerId === 0) continue;
      state[String(playerId)] = {
        startsActive: row?.startsActive ?? row?.starts_active ?? true,
        dnp: Boolean(row?.didNotPlay ?? row?.did_not_play),
        events: Array.isArray(row?.events)
          ? row.events.map((item) => ({
              kind: String(item?.kind || '').toLowerCase(),
              atMs: Math.max(0, Number(item?.atMs ?? item?.at_ms ?? 0)),
            })).filter((item) => ['in', 'out', 'injured'].includes(item.kind))
          : [],
      };
    }
    if (Object.keys(state).length) saveState();
  }

  function saveState() {
    if (!key()) return;
    try {
      localStorage.setItem(key(), JSON.stringify(state));
    } catch (_) {}
  }

  function participationPayload(requestedSessionId = null) {
    const requested = Number(requestedSessionId || 0);
    if (requested && requested !== Number(sessionId)) return [];

    const ids = new Set(knownPlayerIds);
    for (const id of players.keys()) ids.add(Number(id));
    for (const id of Object.keys(state)) {
      const numericId = Number(id);
      if (Number.isSafeInteger(numericId) && numericId !== 0) ids.add(numericId);
    }

    return [...ids]
      .filter((id) => Number.isSafeInteger(id) && id !== 0)
      .sort((a, b) => a - b)
      .map((playerId) => {
        const rec = recordFor(playerId);
        return {
          playerId,
          startsActive: Boolean(rec.startsActive),
          didNotPlay: Boolean(rec.dnp),
          events: rec.dnp ? [] : [...rec.events]
            .map((item) => ({
              kind: String(item?.kind || '').toLowerCase(),
              atMs: Math.max(0, Math.round(Number(item?.atMs || 0))),
            }))
            .filter((item) => ['in', 'out', 'injured'].includes(item.kind))
            .sort((a, b) => a.atMs - b.atMs),
        };
      });
  }

  window.__realPlayRecordedParticipationPayload = participationPayload;
  window.__realPlayRecordedParticipationClear = (requestedSessionId = null) => {
    const requested = Number(requestedSessionId || 0);
    const targetSessionId = requested || Number(sessionId || 0);
    if (!Number.isSafeInteger(targetSessionId) || targetSessionId < 1) return false;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${targetSessionId}`);
    } catch (_) {}
    if (targetSessionId === Number(sessionId)) state = {};
    return true;
  };

  function recordFor(playerId) {
    const id = String(Number(playerId));
    if (!state[id] || typeof state[id] !== 'object') {
      state[id] = { startsActive: true, dnp: false, events: [] };
    }
    if (!Array.isArray(state[id].events)) state[id].events = [];
    if (typeof state[id].startsActive !== 'boolean') state[id].startsActive = true;
    state[id].dnp = Boolean(state[id].dnp);
    return state[id];
  }

  function statusAt(playerId, atMs = currentMs()) {
    const rec = recordFor(playerId);
    if (rec.dnp) return { active: false, label: 'DNP', reason: 'did_not_play' };

    let active = rec.startsActive;
    let label = active ? 'ON COURT' : 'BENCH';
    let reason = active ? 'playing' : 'bench';
    const events = [...rec.events].sort((a, b) => Number(a.atMs || 0) - Number(b.atMs || 0));
    for (const item of events) {
      if (Number(item.atMs || 0) > Number(atMs || 0)) break;
      if (item.kind === 'in') {
        active = true;
        label = 'ON COURT';
        reason = 'playing';
      } else if (item.kind === 'injured') {
        active = false;
        label = 'INJURED';
        reason = 'injured';
      } else if (item.kind === 'out') {
        active = false;
        label = 'BENCH';
        reason = 'bench';
      }
    }
    return { active, label, reason };
  }

  function playerName(playerId) {
    const known = players.get(Number(playerId));
    if (known?.playerName) return known.playerName;
    const button = screen()?.querySelector(`[data-rp-video-select-player="${Number(playerId)}"]`);
    return String(button?.textContent || 'REAL PLAY PLAYER').replace(/\s+/g, ' ').trim();
  }

  function addEvent(playerId, kind, options = {}) {
    const rec = recordFor(playerId);
    const atMs = Math.max(0, Number(options.atMs ?? currentMs()));
    if (kind === 'dnp') {
      rec.dnp = true;
      rec.startsActive = false;
      rec.events = [];
    } else if (kind === 'reset') {
      delete state[String(Number(playerId))];
    } else {
      rec.dnp = false;
      if (kind === 'in' && rec.events.length === 0 && options.startedOnBench === true) {
        rec.startsActive = false;
      }
      rec.events = rec.events.filter((item) => !(Number(item.atMs) === atMs && item.kind === kind));
      rec.events.push({ kind, atMs, createdAt: new Date().toISOString() });
      rec.events.sort((a, b) => Number(a.atMs || 0) - Number(b.atMs || 0));
    }
    saveState();
    syncRows();
  }

  function latestEventText(playerId) {
    const rec = recordFor(playerId);
    if (rec.dnp) return 'Marked DID NOT PLAY for this game.';
    const events = [...rec.events].sort((a, b) => Number(a.atMs || 0) - Number(b.atMs || 0));
    if (!events.length) return rec.startsActive ? 'Default: active from game start.' : 'Starts on bench.';
    return events.map((item) => {
      const label = item.kind === 'in' ? 'SUB IN' : item.kind === 'injured' ? 'INJURED / OUT' : 'SUB OUT';
      return `${label} @ ${formatTime(item.atMs)}`;
    }).join(' · ');
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-participation-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpParticipationStyles = '1';
    style.textContent = `
      .rp-video-score-player{position:relative}
      .rp-video-score-player[data-rp-participation-status]::after{content:attr(data-rp-participation-status);margin-left:8px;font-size:.42rem;font-weight:950;letter-spacing:.08em;opacity:.72}
      .rp-video-score-player.rp-participation-inactive{opacity:.48;border-style:dashed!important}
      .rp-video-score-player.rp-participation-inactive::after{color:#ffbd66;opacity:1}
      .rp-video-score-player.rp-participation-dnp{opacity:.34}
      .rp-participation-sheet{position:fixed;z-index:1500;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:20px 12px calc(18px + env(safe-area-inset-bottom));background:rgba(0,0,0,.7);backdrop-filter:blur(8px)}
      .rp-participation-card{width:min(100%,520px);border:1px solid rgba(255,255,255,.11);border-radius:20px;background:linear-gradient(180deg,#09111a,#04070b);box-shadow:0 -24px 70px rgba(0,0,0,.55);color:#f4f8fc;overflow:hidden}
      .rp-participation-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;border-bottom:1px solid rgba(255,255,255,.07)}
      .rp-participation-head small{display:block;color:#47d8ff;font-size:.48rem;font-weight:950;letter-spacing:.12em}.rp-participation-head strong{display:block;margin-top:3px;font-size:.8rem;font-weight:950;text-transform:uppercase}.rp-participation-head button{width:34px;height:34px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#080d14;color:#aeb9c7;font-size:1rem}
      .rp-participation-body{padding:14px}.rp-participation-now{padding:10px 12px;border:1px solid rgba(71,216,255,.13);border-radius:12px;background:rgba(20,100,135,.07);color:#9bc9d7;font-size:.58rem;font-weight:850;line-height:1.45}.rp-participation-now b{color:#5fe0ff}
      .rp-participation-actions{display:grid;gap:8px;margin-top:11px}.rp-participation-actions button{min-height:44px;padding:0 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#070c12;color:#dce7f1;text-align:left;font-size:.57rem;font-weight:950;letter-spacing:.05em}.rp-participation-actions button.in{color:#64e1ff;border-color:rgba(71,216,255,.2)}.rp-participation-actions button.out{color:#ffd17a;border-color:rgba(255,190,78,.16)}.rp-participation-actions button.injury{color:#ff9a86;border-color:rgba(255,112,90,.18)}.rp-participation-actions button.dnp{color:#ff8390;border-color:rgba(255,73,94,.2)}.rp-participation-actions button.reset{color:#8998aa}
      .rp-participation-history{margin-top:10px;color:#6f8194;font-size:.52rem;font-weight:800;line-height:1.5}
      .rp-participation-toast{position:fixed;z-index:1600;left:50%;bottom:92px;transform:translateX(-50%);width:min(88vw,430px);padding:10px 13px;border:1px solid rgba(255,105,120,.25);border-radius:12px;background:#12080c;color:#ffc1c8;font-size:.58rem;font-weight:900;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.45)}
    `;
    document.head.appendChild(style);
  }

  function closeMenu() {
    menu?.remove();
    menu = null;
    menuPlayerId = 0;
  }

  function openMenu(playerId) {
    closeMenu();
    menuPlayerId = Number(playerId);
    const atMs = currentMs();
    const status = statusAt(playerId, atMs);
    menu = document.createElement('div');
    menu.className = 'rp-participation-sheet';
    menu.dataset.rpParticipationSheet = '1';
    menu.innerHTML = `
      <div class="rp-participation-card" role="dialog" aria-modal="true" aria-label="Player participation">
        <div class="rp-participation-head"><div><small>PLAYER PARTICIPATION · ${esc(formatTime(atMs))}</small><strong>${esc(playerName(playerId))}</strong></div><button type="button" data-rp-participation-close>×</button></div>
        <div class="rp-participation-body">
          <div class="rp-participation-now">Current status at <b>${esc(formatTime(atMs))}</b>: <b>${esc(status.label)}</b>. Double-click a roster player any time to update their court participation.</div>
          <div class="rp-participation-actions">
            <button type="button" class="in" data-rp-participation-action="in">SUB IN NOW · STARTED ON BENCH IF THIS IS THEIR FIRST ENTRY</button>
            <button type="button" class="out" data-rp-participation-action="out">SUB OUT / NOT PLAYING FROM THIS POINT</button>
            <button type="button" class="injury" data-rp-participation-action="injured">INJURED / OUT FROM THIS POINT</button>
            <button type="button" class="dnp" data-rp-participation-action="dnp">DID NOT PLAY · ENTIRE GAME</button>
            <button type="button" class="reset" data-rp-participation-action="reset">CLEAR PARTICIPATION STATUS · DEFAULT TO PLAYING</button>
          </div>
          <div class="rp-participation-history">${esc(latestEventText(playerId))}</div>
        </div>
      </div>`;
    document.body.appendChild(menu);
  }

  function toast(message) {
    document.querySelectorAll('.rp-participation-toast').forEach((node) => node.remove());
    const node = document.createElement('div');
    node.className = 'rp-participation-toast';
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  // Presentation-only ordering: on court first, bench/injured next, DNP last.
  // Never change a player's roster membership or saved participation history.
  function sortLineupsByParticipation(sc) {
    sc.querySelectorAll('.rp-video-score-rosters .rp-video-score-team').forEach((team) => {
      const buttons = [...team.children].filter((child) =>
        child.matches?.('[data-rp-video-select-player]')
      );
      buttons.forEach((button, index) => {
        if (!button.hasAttribute('data-rp-participation-base-order')) {
          button.dataset.rpParticipationBaseOrder = String(index);
        }
      });
      const priority = (button) => button.classList.contains('rp-participation-dnp')
        ? 2
        : button.classList.contains('rp-participation-inactive') ? 1 : 0;
      const sorted = [...buttons].sort((a, b) =>
        priority(a) - priority(b)
        || Number(a.dataset.rpParticipationBaseOrder) - Number(b.dataset.rpParticipationBaseOrder)
      );

      // Don't touch the DOM if already sorted: the existing mutation observer
      // only needs one additional pass after a real status-based reorder.
      if (sorted.some((button, index) => button !== buttons[index])) {
        sorted.forEach((button) => team.appendChild(button));
      }
    });
  }

  function syncRows() {
    syncTimer = 0;
    const sc = screen();
    if (!sc) return;
    const atMs = currentMs();
    sc.querySelectorAll('[data-rp-video-select-player]').forEach((button) => {
      const playerId = Number(button.dataset.rpVideoSelectPlayer || 0);
      if (!playerId) return;
      knownPlayerIds.add(playerId);
      const status = statusAt(playerId, atMs);
      button.dataset.rpParticipationStatus = status.label;
      button.classList.toggle('rp-participation-inactive', !status.active);
      button.classList.toggle('rp-participation-dnp', status.reason === 'did_not_play');
      button.setAttribute('aria-description', status.active ? 'On court at current video time' : `${status.label} at current video time`);
    });
    sortLineupsByParticipation(sc);
  }

  function queueSync() {
    if (syncTimer) return;
    syncTimer = window.setTimeout(syncRows, 20);
  }

  async function loadSession() {
    if (window.__realPlayAdminVerified !== true || !token()) return false;

    const correction = correctionState();
    const correctionSessionId = Number(correction?.sessionId || 0);
    if (Number.isSafeInteger(correctionSessionId) && correctionSessionId > 0) {
      if (correctionSessionId !== sessionId) {
        sessionId = correctionSessionId;
        players = new Map();
        knownPlayerIds = new Set();
        (Array.isArray(correction?.players) ? correction.players : []).forEach((player) => {
          const id = Number(player?.playerId ?? player?.userId ?? 0);
          if (!Number.isSafeInteger(id) || id === 0) return;
          players.set(id, {
            ...player,
            userId: id,
            playerName: player?.playerName || 'REAL PLAY PLAYER',
          });
          knownPlayerIds.add(id);
        });
        loadState(correction?.participation);
      }
      queueSync();
      return true;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return false;
      const control = data?.control || {};
      const nextSessionId = Number(control?.session?.id || 0);
      if (!nextSessionId) return false;
      if (nextSessionId !== sessionId) {
        sessionId = nextSessionId;
        players = new Map();
        knownPlayerIds = new Set();
        (Array.isArray(control.players) ? control.players : []).forEach((player) => {
          const id = Number(player?.userId || 0);
          if (id) {
            players.set(id, player);
            knownPlayerIds.add(id);
          }
        });
        loadState();
      }
      queueSync();
      return true;
    } catch (_) {
      return false;
    }
  }

  function selectedPlayerId() {
    const panel = screen()?.querySelector('[data-rp-video-selected-panel] .rp-video-draft-panel[data-rp-draft-player-id]');
    const fromPanel = Number(panel?.dataset.rpDraftPlayerId || 0);
    if (fromPanel) return fromPanel;
    return Number(screen()?.querySelector('.rp-video-score-player.active[data-rp-video-select-player]')?.dataset.rpVideoSelectPlayer || 0);
  }

  function eventTargetIsAdd(target) {
    return Boolean(target.closest('[data-rp-video-shot], [data-rp-video-stat], [data-rp-video-moment]'));
  }

  function validateDraftAgainstParticipation() {
    if (!sessionId) return { ok: true };

    const correction = correctionState();
    let events = correction
      ? [
          ...(Array.isArray(correction.events) ? correction.events : []),
          ...(Array.isArray(correction.moments) ? correction.moments : []),
        ]
      : null;

    if (!events) {
      let draft = null;
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index) || '';
        if (!storageKey.startsWith('rp-recorded-score-sheet:v2:')) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
          if (Number(parsed?.sessionId || 0) !== sessionId) continue;
          if (!draft || String(parsed.updatedAt || '') > String(draft.updatedAt || '')) draft = parsed;
        } catch (_) {}
      }
      events = Array.isArray(draft?.events) ? draft.events : [];
    }

    for (const item of events) {
      const playerId = Number(item?.playerId || 0);
      if (!playerId) continue;
      if (!statusAt(playerId, Number(item?.videoTimestampMs || 0)).active) {
        return {
          ok: false,
          message: `${playerName(playerId)} has an audited event at ${formatTime(item.videoTimestampMs)} while marked off-court. Fix the participation timeline or remove that event before submitting.`,
        };
      }
    }
    return { ok: true };
  }

  ensureStyles();

  document.addEventListener('dblclick', (event) => {
    const button = event.target.closest('.rp-video-scoring-screen [data-rp-video-select-player]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const playerId = Number(button.dataset.rpVideoSelectPlayer || 0);
    if (!playerId) return;
    if (!sessionId) loadSession().then(() => openMenu(playerId));
    else openMenu(playerId);
  }, true);

  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-rp-participation-close]');
    if (close || (menu && event.target === menu)) {
      event.preventDefault();
      closeMenu();
      return;
    }

    const action = event.target.closest('[data-rp-participation-action]');
    if (action && menuPlayerId) {
      event.preventDefault();
      const kind = String(action.dataset.rpParticipationAction || '');
      addEvent(menuPlayerId, kind, { startedOnBench: kind === 'in' });
      const name = playerName(menuPlayerId);
      const when = formatTime(currentMs());
      closeMenu();
      toast(kind === 'dnp' ? `${name} marked DID NOT PLAY.` : kind === 'reset' ? `${name} participation reset.` : `${name}: ${kind === 'in' ? 'SUB IN' : kind === 'injured' ? 'INJURED / OUT' : 'SUB OUT'} @ ${when}.`);
      return;
    }
  }, true);

  document.addEventListener('click', (event) => {
    const rosterButton = event.target.closest('.rp-video-scoring-screen [data-rp-video-select-player]');
    if (rosterButton) {
      const playerId = Number(rosterButton.dataset.rpVideoSelectPlayer || 0);
      if (playerId && !statusAt(playerId).active) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const status = statusAt(playerId);
        toast(`${playerName(playerId)} is ${status.label} at ${formatTime(currentMs())}. Double-click the player to update participation.`);
        return;
      }
    }

    if (eventTargetIsAdd(event.target)) {
      const playerId = selectedPlayerId();
      if (playerId && !statusAt(playerId).active) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const status = statusAt(playerId);
        toast(`Audit blocked: ${playerName(playerId)} is ${status.label} at ${formatTime(currentMs())}.`);
        return;
      }
    }

    if (event.target.closest('[data-rp-draft-submit]')) {
      const validation = validateDraftAgainstParticipation();
      if (!validation.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast(validation.message);
      }
    }
  }, true);

  document.addEventListener('timeupdate', (event) => {
    if (event.target?.matches?.('[data-rp-recorded-video]')) queueSync();
  }, true);
  document.addEventListener('seeked', (event) => {
    if (event.target?.matches?.('[data-rp-recorded-video]')) queueSync();
  }, true);

  const observer = new MutationObserver(() => {
    const sc = screen();
    if (!sc) return;
    const correctionSessionId = Number(correctionState(sc)?.sessionId || 0);
    if (!sessionId || (correctionSessionId > 0 && correctionSessionId !== sessionId)) loadSession();
    queueSync();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', loadSession);
  window.addEventListener('realplay:admin-control-render', loadSession);
  window.addEventListener('realplay:replay-correction-audit-state', loadSession);
  window.addEventListener('focus', loadSession);
  loadSession();
})();
