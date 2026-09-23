(() => {
  if (window.__realPlayReplayPlayerCorrectionInstalled) return;
  window.__realPlayReplayPlayerCorrectionInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const nativeFetch = window.fetch.bind(window);

  let latestContext = null;
  let latestSessionId = 0;
  let directory = null;
  let directoryPromise = null;
  let localDraftDirty = false;
  let modal = null;
  let busy = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function requestUrl(input) {
    try {
      if (typeof input === 'string') return new URL(input, window.location.href);
      if (input?.url) return new URL(input.url, window.location.href);
    } catch (_) {}
    return null;
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  // Observe only the replay-correction GET so this small add-on knows which
  // finalized game and roster the existing score-sheet editor is showing.
  // The response returned to the original editor is untouched.
  window.fetch = async function realPlayPlayerCorrectionFetch(input, init) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    const response = await nativeFetch(input, init);

    const match = url?.pathname?.match(/^\/api\/real-play\/admin\/replay-corrections\/(\d+)$/);
    if (match && method === 'GET' && response.ok) {
      latestSessionId = Number(match[1]);
      response.clone().json().then((data) => {
        if (!data?.session?.id) return;
        latestContext = data;
        latestSessionId = Number(data.session.id);
        localDraftDirty = false;
        queueDecorate();
      }).catch(() => {});
    }

    return response;
  };

  async function api(path, options = {}) {
    const token = authToken();
    if (!token) throw new Error('Admin session is not available.');
    const response = await nativeFetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
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

  async function loadDirectory() {
    if (directory) return directory;
    if (directoryPromise) return directoryPromise;
    directoryPromise = api('/api/real-play/admin/player', {
      method: 'POST',
      json: { action: 'list' },
    }).then((data) => {
      directory = Array.isArray(data?.players) ? data.players : [];
      return directory;
    }).finally(() => {
      directoryPromise = null;
    });
    return directoryPromise;
  }

  function currentSelectedPlayerId() {
    const active = document.querySelector(
      '.rp-admin-control.open [data-rp-replay-correction-mode] [data-rp-video-select-player].active'
    );
    const value = Number(active?.dataset?.rpVideoSelectPlayer);
    return Number.isSafeInteger(value) && value !== 0 ? value : null;
  }

  function contextPlayer(playerId) {
    return (latestContext?.players || []).find(
      (player) => Number(player?.playerId) === Number(playerId)
    ) || null;
  }

  function playerNumberLabel(player) {
    const number = player?.playerNumber;
    return number === null || number === undefined ? '#--' : `#${Number(number)}`;
  }

  function playerLabel(player) {
    return `${playerNumberLabel(player)} ${player?.playerName || 'REAL PLAY PLAYER'}`;
  }

  function closeModal() {
    if (!modal) return;
    modal.remove();
    modal = null;
    busy = false;
  }

  function candidateHtml(player) {
    const status = String(player?.status || 'active').toUpperCase();
    const ovr = player?.ovr === null || player?.ovr === undefined ? 'UNRANKED' : `${Number(player.ovr)} OVR`;
    return `<button type="button" class="rp-player-correction-candidate" data-rp-player-correction-target="${Number(player.userId)}">
      <span><b>${esc(playerNumberLabel(player))}</b><strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong></span>
      <small>${esc(ovr)} · ${esc(status)}</small>
    </button>`;
  }

  function renderCandidateList(listNode, searchValue, sourceId) {
    const rosterIds = new Set((latestContext?.players || []).map((player) => Number(player.playerId)));
    const query = String(searchValue || '').trim().toLowerCase();
    const matches = (directory || [])
      .filter((player) => {
        const id = Number(player?.userId);
        if (!Number.isSafeInteger(id) || id < 1) return false;
        if (id === Number(sourceId) || rosterIds.has(id)) return false;
        if (!query) return true;
        const haystack = [
          player?.playerName,
          player?.playerNumber === null || player?.playerNumber === undefined ? '' : `#${player.playerNumber}`,
          player?.playerNumber,
          player?.userId,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 80);

    listNode.innerHTML = matches.length
      ? matches.map(candidateHtml).join('')
      : '<div class="rp-player-correction-empty">NO MATCHING REAL PLAY PLAYER</div>';
  }

  async function applyCorrection(source, target) {
    if (busy || !latestSessionId) return;

    const dirtyWarning = localDraftDirty
      ? '\n\nWARNING: You have unsaved score-sheet edits. Correcting the player will reload this editor and those unsaved edits will be discarded.'
      : '';
    const confirmed = window.confirm(
      `Correct audited player?\n\n${playerLabel(source)} → ${playerLabel(target)}\n\nAll official audited events and this game participation will move to the corrected player. The original player will no longer receive this game.${dirtyWarning}`
    );
    if (!confirmed) return;

    busy = true;
    const card = modal?.querySelector('.rp-player-correction-card');
    if (card) card.classList.add('busy');
    const status = modal?.querySelector('[data-rp-player-correction-status]');
    if (status) status.textContent = 'TRANSFERRING OFFICIAL GAME DATA…';

    try {
      const result = await api(
        `/api/real-play/admin/replay-corrections/${encodeURIComponent(latestSessionId)}/reassign-player`,
        {
          method: 'POST',
          json: {
            fromPlayerId: Number(source.playerId),
            toPlayerId: Number(target.userId),
          },
        }
      );
      const count = Number(result?.transferredEventCount || 0);
      closeModal();
      window.alert(
        `Player corrected successfully.\n\n${source.playerName} → ${target.playerName}\n${count} audited event${count === 1 ? '' : 's'} transferred.\n\nThe recorded game will now reload with the corrected player.`
      );
      window.location.reload();
    } catch (error) {
      busy = false;
      if (card) card.classList.remove('busy');
      if (status) status.textContent = error?.message || 'Unable to correct this player.';
    }
  }

  async function openCorrectionPicker() {
    if (busy) return;
    const sourceId = currentSelectedPlayerId();
    const source = contextPlayer(sourceId);
    if (!source) {
      window.alert('Select the player whose audited identity is wrong first.');
      return;
    }

    closeModal();
    modal = document.createElement('div');
    modal.className = 'rp-player-correction-modal';
    modal.innerHTML = `<div class="rp-player-correction-card" role="dialog" aria-modal="true" aria-label="Correct audited player">
      <header>
        <div><small>RECORDED GAME AUDIT</small><h2>CORRECT PLAYER</h2></div>
        <button type="button" data-rp-player-correction-close aria-label="Close">×</button>
      </header>
      <div class="rp-player-correction-current">
        <small>CURRENT AUDITED PLAYER</small>
        <strong>${esc(playerLabel(source))}</strong>
        <span>${esc(String(source.team || '').toUpperCase())} TEAM</span>
      </div>
      <label class="rp-player-correction-search">
        <small>CHANGE TO THE CORRECT PLAYER</small>
        <input type="search" placeholder="Search player name, #, or ID" autocomplete="off" data-rp-player-correction-search>
      </label>
      <div class="rp-player-correction-list" data-rp-player-correction-list>
        <div class="rp-player-correction-empty">LOADING REAL PLAY PLAYERS…</div>
      </div>
      <div class="rp-player-correction-warning">
        <b>THIS MOVES THE OFFICIAL GAME RECORD.</b>
        <span>Audited events, game participation, career evidence and rating evidence will follow the corrected player. No stats are duplicated.</span>
      </div>
      <div class="rp-player-correction-status" data-rp-player-correction-status></div>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('[data-rp-player-correction-close]')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal && !busy) closeModal();
    });

    const listNode = modal.querySelector('[data-rp-player-correction-list]');
    const search = modal.querySelector('[data-rp-player-correction-search]');

    try {
      await loadDirectory();
      if (!modal?.isConnected) return;
      renderCandidateList(listNode, '', sourceId);
      search?.focus();
      search?.addEventListener('input', () => renderCandidateList(listNode, search.value, sourceId));
      listNode?.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-rp-player-correction-target]');
        if (!button || busy) return;
        const targetId = Number(button.dataset.rpPlayerCorrectionTarget);
        const target = (directory || []).find((player) => Number(player.userId) === targetId);
        if (target) applyCorrection(source, target);
      });
    } catch (error) {
      if (listNode) listNode.innerHTML = '<div class="rp-player-correction-empty">PLAYER DIRECTORY UNAVAILABLE</div>';
      const status = modal?.querySelector('[data-rp-player-correction-status]');
      if (status) status.textContent = error?.message || 'Unable to load players.';
    }
  }

  function decorateSelectedPanel() {
    const root = document.querySelector('.rp-admin-control.open [data-rp-replay-correction-mode]');
    if (!root || !latestContext) return;
    const head = root.querySelector('.rp-video-player-panel-head');
    if (!head || head.querySelector('[data-rp-correct-audited-player]')) return;
    const close = head.querySelector('[data-rp-video-close-player]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-correct-audited-player';
    button.dataset.rpCorrectAuditedPlayer = '1';
    button.title = 'Correct which player this audited game belongs to';
    button.innerHTML = '<span>✎</span> CORRECT PLAYER';
    button.addEventListener('click', openCorrectionPicker);
    if (close) head.insertBefore(button, close);
    else head.appendChild(button);
  }

  let decorateQueued = false;
  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
      decorateQueued = false;
      decorateSelectedPanel();
    });
  }

  // Track scorer changes made after the official score sheet was loaded. A
  // player correction is still allowed, but the confirmation clearly warns
  // that the editor reload will discard those unsaved local changes.
  document.addEventListener('click', (event) => {
    const scoringChange = event.target?.closest?.(
      '[data-rp-video-shot], [data-rp-video-stat], [data-rp-draft-remove-shot], [data-rp-draft-remove-stat], [data-rp-video-undo]'
    );
    if (scoringChange && document.querySelector('.rp-admin-control.open [data-rp-replay-correction-mode]')) {
      localDraftDirty = true;
    }
    if (event.target?.closest?.('[data-rp-correct-audited-player]')) return;
    queueDecorate();
  }, true);

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.textContent = `
    .rp-correct-audited-player{
      margin-left:auto!important;
      min-height:34px!important;
      padding:0 12px!important;
      border:1px solid rgba(65,208,255,.48)!important;
      border-radius:10px!important;
      background:rgba(5,31,43,.92)!important;
      color:#c9f5ff!important;
      font:800 11px/1 system-ui,sans-serif!important;
      letter-spacing:.06em!important;
      cursor:pointer!important;
      white-space:nowrap!important;
    }
    .rp-correct-audited-player:hover{background:rgba(9,54,72,.98)!important;border-color:#54d9ff!important}
    .rp-correct-audited-player span{font-size:15px;margin-right:5px}
    .rp-player-correction-modal{
      position:fixed;inset:0;z-index:2147483000;
      display:flex;align-items:center;justify-content:center;
      padding:18px;background:rgba(0,4,10,.86);backdrop-filter:blur(8px);
    }
    .rp-player-correction-card{
      width:min(560px,100%);max-height:min(760px,92vh);overflow:hidden;
      display:flex;flex-direction:column;
      border:1px solid rgba(71,203,255,.32);border-radius:18px;
      background:linear-gradient(180deg,#06121d 0%,#02080e 100%);
      box-shadow:0 24px 90px rgba(0,0,0,.68),0 0 35px rgba(49,190,255,.10);
      color:#eefaff;
    }
    .rp-player-correction-card.busy{pointer-events:none;opacity:.72}
    .rp-player-correction-card>header{display:flex;align-items:center;gap:12px;padding:18px 18px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
    .rp-player-correction-card>header div{flex:1}
    .rp-player-correction-card>header small{display:block;color:#65dcff;font:800 10px/1 system-ui,sans-serif;letter-spacing:.16em}
    .rp-player-correction-card>header h2{margin:6px 0 0;font:900 22px/1 system-ui,sans-serif;font-style:italic;letter-spacing:.04em}
    .rp-player-correction-card>header button{width:38px;height:38px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#07111a;color:#dff7ff;font-size:24px;cursor:pointer}
    .rp-player-correction-current{margin:16px 18px 0;padding:14px 15px;border:1px solid rgba(255,92,92,.26);border-radius:13px;background:rgba(88,10,18,.13)}
    .rp-player-correction-current small,.rp-player-correction-search small{display:block;color:#9eb7c4;font:800 9px/1 system-ui,sans-serif;letter-spacing:.12em}
    .rp-player-correction-current strong{display:block;margin-top:7px;font:900 16px/1.2 system-ui,sans-serif}
    .rp-player-correction-current span{display:block;margin-top:6px;color:#ff9c9c;font:800 10px/1 system-ui,sans-serif;letter-spacing:.08em}
    .rp-player-correction-search{display:block;padding:16px 18px 10px}
    .rp-player-correction-search input{box-sizing:border-box;width:100%;height:44px;margin-top:8px;padding:0 13px;border:1px solid rgba(75,205,255,.28);border-radius:12px;outline:none;background:#020b12;color:#f0fbff;font:700 14px system-ui,sans-serif}
    .rp-player-correction-search input:focus{border-color:#50d5ff;box-shadow:0 0 0 3px rgba(80,213,255,.08)}
    .rp-player-correction-list{min-height:100px;max-height:310px;overflow:auto;padding:0 18px 8px}
    .rp-player-correction-candidate{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;margin:7px 0;padding:12px 13px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:#07121b;color:#eefaff;text-align:left;cursor:pointer}
    .rp-player-correction-candidate:hover{border-color:rgba(74,211,255,.58);background:#0a1d29}
    .rp-player-correction-candidate>span{display:flex;align-items:center;gap:9px;min-width:0;flex:1}
    .rp-player-correction-candidate b{color:#61dcff;font:900 12px system-ui,sans-serif;white-space:nowrap}
    .rp-player-correction-candidate strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:850 13px system-ui,sans-serif}
    .rp-player-correction-candidate small{color:#8197a4;font:750 9px system-ui,sans-serif;white-space:nowrap}
    .rp-player-correction-empty{padding:26px 10px;text-align:center;color:#6f8795;font:850 11px system-ui,sans-serif;letter-spacing:.08em}
    .rp-player-correction-warning{margin:4px 18px 0;padding:12px 13px;border-radius:12px;background:rgba(38,158,204,.08);border:1px solid rgba(68,199,250,.16)}
    .rp-player-correction-warning b{display:block;color:#81e6ff;font:900 10px/1.2 system-ui,sans-serif;letter-spacing:.08em}
    .rp-player-correction-warning span{display:block;margin-top:6px;color:#9eb3bf;font:650 11px/1.45 system-ui,sans-serif}
    .rp-player-correction-status{min-height:17px;padding:10px 18px 16px;color:#ff8b8b;font:800 11px/1.4 system-ui,sans-serif}
    @media(max-width:560px){
      .rp-correct-audited-player{padding:0 8px!important;font-size:9px!important}
      .rp-player-correction-modal{padding:10px}
      .rp-player-correction-card{max-height:95vh}
      .rp-player-correction-candidate small{display:none}
    }
  `;
  document.head.appendChild(style);

  window.__realPlayReplayPlayerCorrectionReady = true;
  queueDecorate();
})();