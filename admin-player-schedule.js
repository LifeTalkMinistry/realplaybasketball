(() => {
  if (window.__realPlayAdminPlayerScheduleInstalled) return;
  window.__realPlayAdminPlayerScheduleInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  const CLUB_LABELS = Object.freeze({
    lions: 'LIONS',
    valiant: 'VALIANT',
    watchmen: 'WATCHMEN',
    conquerors: 'CONQUERORS',
    chosen: 'CHOSEN',
    eagles: 'EAGLES',
    steadfast: 'STEADFAST',
    warriors: 'WARRIORS',
  });
  // Fallback only. The admin UI should prefer the canonical club list returned
  // by the API so future teams appear here without another frontend patch.
  const DEFAULT_CLUB_ORDER = Object.freeze([
    'lions',
    'valiant',
    'watchmen',
    'conquerors',
    'chosen',
    'eagles',
    'steadfast',
    'warriors',
  ]);

  let selectedPlayerId = null;
  let selectedPlayerIdentity = null;
  let sheetBody = null;
  let bodyObserver = null;
  let mainMarkup = '';
  let identityMarkup = '';
  let actionBusy = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const token = () => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch (_) { return ''; }
  };

  async function adminCall(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) throw new Error('Please log in to Real Play first.');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not update this 4v4 team assignment.');
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-admin-player-schedule-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpAdminPlayerScheduleStyles = '1';
    style.textContent = `
      .rp-player-admin-action.schedule{color:#66ddff;border-color:rgba(72,215,255,.2);background:rgba(20,112,153,.07)}
      .rp-admin-schedule-meta{display:grid;gap:4px;margin:11px 0;padding:12px 13px;border:1px solid rgba(72,215,255,.14);border-radius:13px;background:rgba(15,94,128,.06)}
      .rp-admin-schedule-meta span{color:#65dfff;font-size:.46rem;font-weight:950;letter-spacing:.09em}
      .rp-admin-schedule-meta strong{color:#dfeaf4;font-family:var(--rp-display,Arial,sans-serif);font-size:.68rem;font-weight:950;text-transform:uppercase}
      .rp-admin-schedule-meta small{color:#8091a5;font-size:.5rem;font-weight:800;line-height:1.45}
      .rp-admin-team-list{display:grid;gap:8px;margin-top:10px}
      .rp-admin-team-choice{min-height:62px!important}
      .rp-admin-team-choice>div{display:grid;gap:4px;text-align:left}
      .rp-admin-team-choice strong{font-size:.62rem}
      .rp-admin-team-choice small{color:#75869a;font-size:.48rem;line-height:1.3}
      .rp-admin-team-choice.is-current{border-color:rgba(72,215,255,.42);background:rgba(20,112,153,.13)}
      .rp-admin-team-choice.is-current small{color:#65dfff}
      .rp-admin-team-choice.is-full:not(.is-current){opacity:.48}
      .rp-admin-4v4-note{margin:9px 2px 2px;color:#74879a;font-size:.5rem;font-weight:750;line-height:1.5}
      .rp-admin-4v4-section-label{margin:14px 2px 7px;color:#65dfff;font-size:.47rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}
    `;
    document.head.appendChild(style);
  }

  function capturePlayer(event) {
    const row = event.target instanceof Element
      ? event.target.closest('.rp-world-player-row[data-world-player-id]')
      : null;
    if (!row) return;
    const id = Number(row.dataset.worldPlayerId);
    if (Number.isSafeInteger(id) && id > 0) {
      selectedPlayerId = id;
      const label = String(row.querySelector('strong')?.textContent || row.textContent || '').trim();
      const numbered = label.match(/^(.*?)\s+#(\d{1,2})(?:\b|\s|$)/);
      selectedPlayerIdentity = {
        id,
        name: (numbered?.[1] || label.split(/\n/)[0] || '').trim(),
        playerNumber: numbered ? Number(numbered[2]) : null,
      };
    }
  }

  function enhanceMain() {
    if (!sheetBody) return;
    const jersey = sheetBody.querySelector('[data-admin-menu-action="change_jersey"]');
    if (!jersey || sheetBody.querySelector('[data-admin-schedule-open]')) return;
    const view = sheetBody.querySelector('[data-admin-menu-action="view"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-player-admin-action schedule';
    button.dataset.adminScheduleOpen = '1';
    button.disabled = Boolean(view?.disabled);
    button.innerHTML = 'MANAGE 4V4 TEAM <span>›</span>';
    jersey.insertAdjacentElement('afterend', button);
  }

  function restoreMain() {
    if (!sheetBody || !mainMarkup) return;
    sheetBody.innerHTML = mainMarkup;
    mainMarkup = '';
    identityMarkup = '';
    actionBusy = false;
    enhanceMain();
  }

  function renderLoading() {
    sheetBody.innerHTML = `${identityMarkup}<p class="rp-player-admin-status">LOADING 4V4 TEAM…</p><div class="rp-player-admin-form-actions"><button type="button" data-admin-schedule-back>BACK</button><button disabled>LOADING…</button></div>`;
  }

  function teamLabel(club) {
    const normalized = String(club || '').trim().toLowerCase();
    return CLUB_LABELS[normalized]
      || normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
      || 'TEAM';
  }

  function normalizeTeamStates(state) {
    const rows = Array.isArray(state?.teamStates) ? state.teamStates : [];
    const byClub = new Map();
    rows.forEach((team) => {
      const club = String(team?.club || '').trim().toLowerCase();
      if (club) byClub.set(club, team);
    });

    const orderedClubs = [];
    const seen = new Set();
    const addClub = (value) => {
      const club = String(value || '').trim().toLowerCase();
      if (!club || seen.has(club)) return;
      seen.add(club);
      orderedClubs.push(club);
    };

    // API authority first, then any team states not present in the registry.
    // The fallback keeps the admin usable during a partial/older response.
    if (Array.isArray(state?.clubs)) state.clubs.forEach(addClub);
    rows.forEach((team) => addClub(team?.club));
    if (!orderedClubs.length) DEFAULT_CLUB_ORDER.forEach(addClub);

    return orderedClubs.map((club) => {
      const row = byClub.get(club) || {};
      const capacity = Math.max(1, Number(row.capacity) || 6);
      const memberCount = Math.max(0, Number(row.memberCount) || 0);
      return {
        club,
        status: String(row.status || 'available').toLowerCase(),
        memberCount,
        capacity,
        rosterFull: Boolean(row.rosterFull) || memberCount >= capacity,
      };
    });
  }

  function teamStatusText(team, isCurrent) {
    const count = Math.min(team.capacity, team.memberCount);
    if (isCurrent) {
      const stateLabel = team.rosterFull ? 'FULL' : team.status === 'secured' ? 'SECURED' : 'FORMING';
      return `CURRENT · ${count}/${team.capacity} PLAYERS · ${stateLabel}`;
    }
    if (team.rosterFull) return `FULL · ${count}/${team.capacity} PLAYERS`;
    if (team.status === 'secured') return `SECURED · ${count}/${team.capacity} PLAYERS`;
    if (count > 0) return `FORMING · ${count}/${team.capacity} PLAYERS`;
    return `AVAILABLE · 0/${team.capacity} PLAYERS`;
  }

  function renderState(state, message = '', type = '') {
    const teams = normalizeTeamStates(state);
    const joinedClub = String(state?.joinedClub || '').toLowerCase();
    const available = state?.fourVFourAvailable !== false;
    const current = joinedClub ? teams.find((team) => team.club === joinedClub) || null : null;
    const currentSummary = current
      ? `${teamLabel(current.club)} · ${Math.min(current.memberCount, current.capacity)}/${current.capacity} PLAYERS · ${current.rosterFull ? 'FULL' : current.status === 'secured' ? 'SECURED' : 'FORMING'}`
      : 'NO TEAM YET';

    const teamButtons = teams.map((team) => {
      const isCurrent = team.club === joinedClub;
      const isFull = team.rosterFull;
      const disabled = !available || isCurrent || (isFull && !isCurrent);
      const classes = [
        'rp-player-admin-action',
        'schedule',
        'rp-admin-team-choice',
        isCurrent ? 'is-current' : '',
        isFull && !isCurrent ? 'is-full' : '',
      ].filter(Boolean).join(' ');
      return `
        <button type="button" class="${classes}" data-admin-4v4-club="${team.club}" ${disabled ? 'disabled' : ''}>
          <div>
            <strong>${esc(teamLabel(team.club))}</strong>
            <small>${esc(teamStatusText(team, isCurrent))}</small>
          </div>
          <span>${isCurrent ? '✓' : isFull ? 'FULL' : '›'}</span>
        </button>`;
    }).join('');

    const unavailableMessage = !available
      ? (state?.message || 'This player needs a claimed Real Play account before they can be assigned to a 4v4 team.')
      : '';

    sheetBody.innerHTML = `
      ${identityMarkup}
      <p class="rp-player-admin-status ${type}" data-rp-admin-schedule-status>${esc(message)}</p>
      <div class="rp-admin-schedule-meta">
        <span>CURRENT 4V4 ASSIGNMENT</span>
        <strong>${esc(currentSummary)}</strong>
        <small>${current ? 'Move this player directly to another available team below.' : 'Choose the team this player should occupy in the current 4v4 setup.'}</small>
      </div>
      ${unavailableMessage ? `<p class="rp-player-admin-warning">${esc(unavailableMessage)}</p>` : ''}
      <div class="rp-admin-4v4-section-label">MOVE / ASSIGN PLAYER</div>
      <div class="rp-admin-team-list">${teamButtons}</div>
      <p class="rp-admin-4v4-note">Moving a player automatically releases their previous 4v4 team slot. Teams at roster capacity cannot receive another player.</p>
      ${current && available ? `
        <div class="rp-admin-4v4-section-label">REMOVE ASSIGNMENT</div>
        <button type="button" class="rp-player-admin-action danger" data-admin-reservation-cancel>
          <div><strong>REMOVE FROM TEAM</strong><small>Remove only this player’s current 4v4 team assignment.</small></div><span>›</span>
        </button>` : ''}
      <div class="rp-player-admin-form-actions" style="margin-top:12px">
        <button type="button" data-admin-schedule-back>BACK</button>
        <button type="button" disabled>4V4 TEAM MANAGEMENT</button>
      </div>`;
  }

  function playerPayload() {
    const payload = { playerId: selectedPlayerId };
    if (selectedPlayerIdentity?.name) payload.playerName = selectedPlayerIdentity.name;
    if (Number.isInteger(selectedPlayerIdentity?.playerNumber)) payload.playerNumber = selectedPlayerIdentity.playerNumber;
    return payload;
  }

  async function loadState(message = '', type = '') {
    try {
      const state = await adminCall('team_reservation_access', playerPayload());
      renderState(state, message, type);
    } catch (error) {
      renderState(null, error.message || 'Could not load 4v4 team assignment.', 'error');
    }
  }

  async function openSchedule() {
    if (!sheetBody || !selectedPlayerId) return;
    mainMarkup = sheetBody.innerHTML;
    identityMarkup = sheetBody.querySelector('.rp-player-admin-identity')?.outerHTML || '';
    renderLoading();
    await loadState();
  }

  function announceTeamChange() {
    const detail = { source: 'admin-player-4v4-team', playerId: selectedPlayerId };
    window.dispatchEvent(new CustomEvent('realplay:4v4-team-changed', { detail }));
    window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed', { detail }));
  }

  async function removeFromTeam() {
    if (actionBusy) return;
    if (!window.confirm('Remove this player from their current 4v4 team?')) return;
    actionBusy = true;
    sheetBody?.querySelectorAll('button').forEach((button) => {
      if (!button.matches('[data-admin-schedule-back]')) button.disabled = true;
    });
    try {
      const result = await adminCall('team_reservation_cancel', playerPayload());
      renderState(result, result?.message || 'Player removed from the team.', 'success');
      announceTeamChange();
    } catch (error) {
      await loadState(error.message || 'Could not remove this player from the team.', 'error');
    } finally {
      actionBusy = false;
    }
  }

  async function moveToTeam(club) {
    if (actionBusy) return;
    actionBusy = true;
    sheetBody?.querySelectorAll('button').forEach((button) => {
      if (!button.matches('[data-admin-schedule-back]')) button.disabled = true;
    });
    try {
      const result = await adminCall('team_reservation_update', {
        ...playerPayload(),
        operation: 'team',
        club,
      });
      renderState(result, result?.message || '4v4 team assignment updated.', 'success');
      announceTeamChange();
    } catch (error) {
      await loadState(error.message || 'Could not move this player to that team.', 'error');
    } finally {
      actionBusy = false;
    }
  }

  function attachToSheet() {
    const next = document.querySelector('[data-rp-player-admin-sheet] [data-rp-player-admin-body]');
    if (!next) return false;
    if (sheetBody === next) {
      enhanceMain();
      return true;
    }
    bodyObserver?.disconnect();
    sheetBody = next;
    bodyObserver = new MutationObserver(() => enhanceMain());
    bodyObserver.observe(sheetBody, { childList: true, subtree: false });
    enhanceMain();
    return true;
  }

  installStyles();
  document.addEventListener('pointerdown', capturePlayer, true);
  document.addEventListener('contextmenu', capturePlayer, true);
  document.addEventListener('click', (event) => {
    capturePlayer(event);
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-admin-schedule-open]')) {
      event.preventDefault();
      openSchedule();
      return;
    }
    if (target.closest('[data-admin-schedule-back]')) {
      event.preventDefault();
      restoreMain();
      return;
    }
    if (target.closest('[data-admin-reservation-cancel]')) {
      event.preventDefault();
      removeFromTeam();
      return;
    }
    const team = target.closest('[data-admin-4v4-club]');
    if (team && !team.disabled) {
      event.preventDefault();
      moveToTeam(String(team.getAttribute('data-admin-4v4-club') || ''));
    }
  });

  if (!attachToSheet()) {
    const observer = new MutationObserver(() => {
      if (attachToSheet()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
