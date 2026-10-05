(() => {
  if (window.__realPlayAuditTeamDesignationInstalled) return;
  window.__realPlayAuditTeamDesignationInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let directory = { preferencePlayers: [], teamStates: [] };
  let directoryLoaded = false;
  let directoryPromise = null;
  let busy = false;
  let borrowOpen = false;
  let borrowQuery = '';
  let borrowBusy = false;
  let mountedControl = null;
  let mountPromise = null;
  let mountedSessionId = 0;
  const designations = new Map();

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
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function auditSection() {
    return adminRoot()?.querySelector('[data-rp-video-roster-setup]') || null;
  }

  function designationState(sessionId) {
    const id = Number(sessionId || 0);
    if (!designations.has(id)) designations.set(id, { west: '', east: '' });
    return designations.get(id);
  }

  function membersFor(club) {
    const key = String(club || '').trim().toLowerCase();
    return (directory.preferencePlayers || []).filter(
      (player) => String(player?.preferredClub || '').trim().toLowerCase() === key
    );
  }

  function signedPlayerId(player) {
    const userId = Number(player?.userId);
    if (Number.isSafeInteger(userId) && userId > 0) return userId;
    const playerId = Number(player?.playerId);
    if (Number.isSafeInteger(playerId) && playerId > 0) return -playerId;
    return null;
  }

  function preferencePlayerBySignedId(value) {
    const id = Number(value);
    return (directory.preferencePlayers || []).find((player) => signedPlayerId(player) === id) || null;
  }

  function activeRosterIds(control = mountedControl) {
    return new Set((control?.players || [])
      .filter((player) => player?.checkedIn && ['west', 'east'].includes(String(player?.team || '').toLowerCase()))
      .map((player) => Number(player?.userId))
      .filter((id) => Number.isSafeInteger(id) && id !== 0));
  }

  function borrowMatches(control = mountedControl) {
    const q = String(borrowQuery || '').trim().toLowerCase();
    const selected = activeRosterIds(control);
    return (directory.preferencePlayers || [])
      .filter((player) => {
        const id = signedPlayerId(player);
        if (id === null || selected.has(id)) return false;
        if (!q) return true;
        const jersey = player?.playerNumber === null || player?.playerNumber === undefined ? '' : String(player.playerNumber);
        return `${player?.playerName || ''} ${player?.preferredClub || ''} ${jersey}`.toLowerCase().includes(q);
      })
      .sort((left, right) => {
        const clubCompare = String(left?.preferredClub || '').localeCompare(String(right?.preferredClub || ''));
        return clubCompare || String(left?.playerName || '').localeCompare(String(right?.playerName || ''));
      })
      .slice(0, 48);
  }

  function borrowResultHtml(player, state) {
    const id = signedPlayerId(player);
    if (id === null) return '';
    const home = String(player?.preferredClub || '').trim().toLowerCase();
    const jersey = player?.playerNumber === null || player?.playerNumber === undefined ? '' : `#${Number(player.playerNumber)} · `;
    const rank = Number.isSafeInteger(Number(player?.rank)) && Number(player.rank) > 0 ? ` · RANK #${Number(player.rank)}` : '';
    const ovr = Number.isFinite(Number(player?.ovr)) ? ` · ${Math.round(Number(player.ovr))} OVR` : '';
    const actions = ['west', 'east'].map((side) => {
      const destination = String(state?.[side] || '').trim().toLowerCase();
      if (!destination) {
        return `<button type="button" disabled>SET ${side.toUpperCase()} TEAM</button>`;
      }
      if (destination === home) {
        return `<button type="button" class="own" disabled>${destination.toUpperCase()} · OWN</button>`;
      }
      return `<button type="button" data-rp-borrow-add data-player-id="${id}" data-team="${side}">→ ${esc(destination.toUpperCase())}</button>`;
    }).join('');

    return `<div class="rp-video-borrow-result">
      <div class="rp-video-borrow-copy">
        <strong>${esc(jersey)}${esc(player?.playerName || 'REAL PLAY PLAYER')}</strong>
        <small>${esc(home.toUpperCase() || 'NO TEAM')}${esc(ovr)}${esc(rank)}</small>
      </div>
      <div class="rp-video-borrow-actions">${actions}</div>
    </div>`;
  }

  function renderBorrowResults(section, control, sessionId) {
    if (!section) return;
    const results = section.querySelector('[data-rp-borrow-results]');
    const count = section.querySelector('[data-rp-borrow-count]');
    if (!results) return;
    const state = designationState(sessionId);
    const matches = borrowMatches(control);
    if (count) count.textContent = `${matches.length} AVAILABLE`;
    results.innerHTML = matches.length
      ? matches.map((player) => borrowResultHtml(player, state)).join('')
      : '<div class="rp-video-borrow-empty">NO MATCHING TEAM-ROSTER PLAYER AVAILABLE.</div>';
  }

  function renderBorrowPanel(section, control, sessionId) {
    if (!section) return;
    const rosters = section.querySelector('.rp-video-rosters');
    if (!rosters) return;

    let wrap = section.querySelector('[data-rp-borrow-wrap]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'rp-video-borrow-wrap';
      wrap.dataset.rpBorrowWrap = '1';
      rosters.before(wrap);
    }

    wrap.innerHTML = `
      <button type="button" class="rp-video-borrow-toggle ${borrowOpen ? 'open' : ''}" data-rp-borrow-toggle>
        ${borrowOpen ? '− CLOSE BORROW PLAYER' : '⇄ BORROW PLAYER'}
      </button>
      ${borrowOpen ? `<div class="rp-video-borrow-panel" data-rp-borrow-panel>
        <div class="rp-video-borrow-head">
          <div><strong>BORROW FROM REAL PLAY ROSTERS</strong><small>Game-only assignment. The player's registered team does not change.</small></div>
          <span data-rp-borrow-count></span>
        </div>
        <input type="search" data-rp-borrow-search value="${esc(borrowQuery)}" placeholder="Search player, jersey, or team" autocomplete="off">
        <div class="rp-video-borrow-results" data-rp-borrow-results></div>
      </div>` : ''}
    `;

    if (borrowOpen) renderBorrowResults(section, control, sessionId);
  }

  function applyBorrowedBadges(section, control, sessionId) {
    if (!section) return;
    const state = designationState(sessionId);
    for (const side of ['west', 'east']) {
      const destination = String(state?.[side] || '').trim().toLowerCase();
      const card = section.querySelector(`.rp-video-roster-card.${side}`);
      if (!card) continue;
      card.querySelectorAll('.rp-video-roster-player').forEach((row) => {
        row.querySelector('[data-rp-borrowed-badge]')?.remove();
        if (!destination) return;
        const id = Number(row.querySelector('[data-player-id]')?.dataset.playerId);
        const source = preferencePlayerBySignedId(id);
        const home = String(source?.preferredClub || '').trim().toLowerCase();
        if (!home || home === destination) return;
        const copy = row.firstElementChild;
        if (!copy) return;
        const badge = document.createElement('small');
        badge.className = 'rp-video-borrowed-badge';
        badge.dataset.rpBorrowedBadge = '1';
        badge.textContent = `BORROWED · ${home.toUpperCase()}`;
        copy.appendChild(badge);
      });
    }
  }

  async function loadDirectory(force = false) {
    if (directoryPromise) return directoryPromise;
    if (directoryLoaded && !force) return directory;
    directoryPromise = (async () => {
      let data;
      try {
        data = await api('/api/real-play/4v4/admin/rosters');
      } catch (adminRosterError) {
        // Compatibility fallback while the backend update is still being pulled
        // onto the production machine. The existing player-state endpoint
        // already carries the same team roster directory for player accounts.
        try {
          data = await api('/api/real-play/4v4/me');
        } catch (_) {
          throw adminRosterError;
        }
      }
      directory = {
        preferencePlayers: Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : [],
        teamStates: Array.isArray(data?.teamStates) ? data.teamStates : [],
      };
      directoryLoaded = true;
      return directory;
    })();
    try {
      return await directoryPromise;
    } finally {
      directoryPromise = null;
    }
  }

  function setNotice(message, type = 'success') {
    const section = auditSection();
    if (!section) return;
    let node = section.querySelector('[data-rp-audit-team-notice]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'rp-audit-team-designation-notice';
      node.dataset.rpAuditTeamNotice = '1';
      const rosters = section.querySelector('.rp-video-rosters');
      if (rosters) rosters.after(node);
      else section.appendChild(node);
    }
    node.textContent = message || '';
    node.classList.toggle('error', type === 'error');
    node.hidden = !message;
  }

  function buildSelect(side, sessionId) {
    const state = designationState(sessionId);
    const otherSide = side === 'west' ? 'east' : 'west';
    const label = document.createElement('label');
    label.className = 'rp-video-team-designation';
    label.dataset.rpAuditTeamDesignationWrap = side;

    const caption = document.createElement('small');
    caption.textContent = 'DESIGNATED TEAM';

    const select = document.createElement('select');
    select.dataset.rpAuditTeamDesignation = side;
    select.setAttribute('aria-label', `${side.toUpperCase()} designated team`);
    select.disabled = busy;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = directory.teamStates.length ? 'SELECT TEAM' : 'TEAM ROSTERS UNAVAILABLE';
    select.appendChild(placeholder);

    for (const team of directory.teamStates) {
      const club = String(team?.club || '').trim().toLowerCase();
      if (!club) continue;
      const option = document.createElement('option');
      option.value = club;
      option.textContent = `${club.toUpperCase()} · ${membersFor(club).length} REGISTERED`;
      option.disabled = state[otherSide] === club && state[side] !== club;
      select.appendChild(option);
    }

    select.value = state[side] || '';
    label.append(caption, select);
    return label;
  }

  async function getControl() {
    const data = await api('/api/real-play/admin/career/control');
    return data?.control || { session: null, players: [] };
  }

  async function controlAction(payload) {
    const data = await api('/api/real-play/admin/career/control', {
      method: 'POST',
      json: payload,
    });
    return data?.control || null;
  }

  function refreshAudit() {
    const tab = adminRoot()?.querySelector('[data-rp-video-tab]');
    if (tab && !tab.disabled) {
      tab.click();
      return;
    }
    window.dispatchEvent(new CustomEvent('realplay:admin-render', { detail: { tab: 'audit' } }));
  }

  async function borrowPlayer(playerIdValue, sideValue) {
    if (borrowBusy || busy) return;
    const signedId = Number(playerIdValue);
    const side = String(sideValue || '').trim().toLowerCase();
    if (!Number.isSafeInteger(signedId) || signedId === 0 || !['west', 'east'].includes(side)) return;

    let control;
    try {
      control = await getControl();
    } catch (error) {
      setNotice(error.message || 'Could not load the current game.', 'error');
      return;
    }

    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId || control?.session?.gameStatus !== 'setup') {
      setNotice('Borrowing is available only before scoring starts.', 'error');
      return;
    }

    mountedControl = control;
    mountedSessionId = sessionId;
    const state = designationState(sessionId);
    state.west = String(control?.session?.westTeamName || state.west || '').trim().toLowerCase();
    state.east = String(control?.session?.eastTeamName || state.east || '').trim().toLowerCase();

    try {
      await loadDirectory(true);
    } catch (error) {
      setNotice(error.message || 'Real Play team rosters are unavailable.', 'error');
      return;
    }

    const player = preferencePlayerBySignedId(signedId);
    if (!player) {
      setNotice('That player is not currently attached to a Real Play team roster.', 'error');
      return;
    }

    const home = String(player.preferredClub || '').trim().toLowerCase();
    const destination = String(state[side] || '').trim().toLowerCase();
    if (!destination) {
      setNotice(`Choose the designated ${side.toUpperCase()} team before borrowing a player.`, 'error');
      return;
    }
    if (home === destination) {
      setNotice(`${player.playerName} already belongs to ${destination.toUpperCase()}; add them as a normal roster player instead.`, 'error');
      return;
    }
    if (activeRosterIds(control).has(signedId)) {
      setNotice(`${player.playerName} is already in this game roster.`, 'error');
      return;
    }

    borrowBusy = true;
    busy = true;
    mount();
    setNotice(`Borrowing ${player.playerName} from ${home.toUpperCase()}…`);

    try {
      await controlAction({
        action: 'video-roster-add',
        ...(signedId > 0 ? { userId: signedId } : { unclaimedPlayerId: Math.abs(signedId) }),
        team: side,
      });
      borrowQuery = '';
      setNotice(`${player.playerName} borrowed from ${home.toUpperCase()} for ${destination.toUpperCase()}. Player stats and personal W/L still count; ${home.toUpperCase()} team record is unchanged.`);
    } catch (error) {
      setNotice(error.message || `Could not borrow ${player.playerName}.`, 'error');
    } finally {
      borrowBusy = false;
      busy = false;
      refreshAudit();
    }
  }

  async function assignTeam(sideValue, clubValue) {
    if (busy) return;
    const side = String(sideValue || '').trim().toLowerCase();
    const club = String(clubValue || '').trim().toLowerCase();
    if (!['west', 'east'].includes(side)) return;

    let control;
    try {
      control = await getControl();
    } catch (error) {
      setNotice(error.message || 'Could not load the current game.', 'error');
      return;
    }

    const sessionId = Number(control?.session?.id || 0);
    if (!sessionId || control?.session?.gameStatus !== 'setup') {
      setNotice('Team designation is available only before scoring starts.', 'error');
      return;
    }

    mountedSessionId = sessionId;
    const state = designationState(sessionId);

    if (!club) {
      busy = true;
      mount();
      try {
        await controlAction({
          action: 'set-team-designation',
          side,
          teamName: null,
        });
        state[side] = '';
        setNotice(`${side.toUpperCase()} team designation cleared.`);
      } catch (error) {
        setNotice(error.message || `Could not clear the ${side.toUpperCase()} team designation.`, 'error');
      } finally {
        busy = false;
        refreshAudit();
      }
      return;
    }

    const otherSide = side === 'west' ? 'east' : 'west';
    if (state[otherSide] === club) {
      setNotice(`${club.toUpperCase()} is already designated as ${otherSide.toUpperCase()}.`, 'error');
      mount();
      return;
    }

    busy = true;
    mount();
    setNotice(`Loading ${club.toUpperCase()} roster…`);

    try {
      await loadDirectory(true);
      const members = membersFor(club).filter((player) => signedPlayerId(player) !== null);
      if (!members.length) throw new Error(`${club.toUpperCase()} has no registered players to auto-populate.`);

      const expected = Number(control?.session?.rules?.playersPerSide || 0);
      const isFourVFour = String(control?.session?.rules?.playerFormat || '').toLowerCase() === '4v4';
      const maxRoster = isFourVFour ? 6 : (expected > 0 ? expected : members.length);
      const rosterMembers = members.slice(0, maxRoster);
      const existing = (control.players || []).filter(
        (player) => player.checkedIn && String(player.team || '').toLowerCase() === side
      );

      for (const player of existing) {
        await controlAction({
          action: 'video-roster-remove',
          userId: Number(player.userId),
        });
      }

      for (const player of rosterMembers) {
        const signedId = signedPlayerId(player);
        await controlAction({
          action: 'video-roster-add',
          ...(signedId > 0 ? { userId: signedId } : { unclaimedPlayerId: Math.abs(signedId) }),
          team: side,
        });
      }

      await controlAction({
        action: 'set-team-designation',
        side,
        teamName: club,
      });

      state[side] = club;
      const extras = Math.max(0, members.length - rosterMembers.length);
      if (isFourVFour && rosterMembers.length > expected) {
        const substitutes = rosterMembers.length - expected;
        setNotice(`${club.toUpperCase()} → ${side.toUpperCase()}: all ${rosterMembers.length} roster players loaded — ${expected} on court with ${substitutes} substitute${substitutes === 1 ? '' : 's'} available.`);
      } else if (extras) {
        setNotice(`${club.toUpperCase()} → ${side.toUpperCase()}: ${rosterMembers.length} roster players loaded. ${extras} player${extras === 1 ? '' : 's'} exceed this game format's roster limit.`);
      } else {
        setNotice(`${club.toUpperCase()} → ${side.toUpperCase()}: ${rosterMembers.length} registered player${rosterMembers.length === 1 ? '' : 's'} auto-populated.`);
      }
    } catch (error) {
      state[side] = '';
      setNotice(error.message || `Could not load ${club.toUpperCase()}.`, 'error');
    } finally {
      busy = false;
      refreshAudit();
    }
  }

  function syncExistingSelects(sessionId) {
    const state = designationState(sessionId);
    for (const side of ['west', 'east']) {
      const otherSide = side === 'west' ? 'east' : 'west';
      const select = auditSection()?.querySelector(`[data-rp-audit-team-designation="${side}"]`);
      if (!select) continue;
      select.disabled = busy;
      select.value = state[side] || '';
      for (const option of select.options) {
        if (!option.value) continue;
        option.disabled = state[otherSide] === option.value && state[side] !== option.value;
      }
    }
  }

  async function mount() {
    if (mountPromise) return mountPromise;
    mountPromise = (async () => {
      const section = auditSection();
      if (!section) return false;

      let control;
      try {
        control = await getControl();
      } catch (_) {
        return false;
      }

      const sessionId = Number(control?.session?.id || 0);
      if (!sessionId) return false;

      if (mountedSessionId && mountedSessionId !== sessionId) {
        designations.delete(mountedSessionId);
      }
      mountedSessionId = sessionId;
      mountedControl = control;
      const state = designationState(sessionId);
      state.west = String(control?.session?.westTeamName || '').trim().toLowerCase();
      state.east = String(control?.session?.eastTeamName || '').trim().toLowerCase();

      try {
        await loadDirectory(false);
      } catch (error) {
        setNotice(error.message || 'Registered team rosters are unavailable.', 'error');
      }

      for (const side of ['west', 'east']) {
        const card = section.querySelector(`.rp-video-roster-card.${side}`);
        if (!card) continue;
        let wrap = card.querySelector('[data-rp-audit-team-designation-wrap]');
        if (!wrap) {
          const head = card.querySelector('.rp-video-roster-head');
          wrap = buildSelect(side, sessionId);
          if (head) head.after(wrap);
          else card.prepend(wrap);
        }
      }
      syncExistingSelects(sessionId);
      renderBorrowPanel(section, control, sessionId);
      applyBorrowedBadges(section, control, sessionId);
      return true;
    })();

    try {
      return await mountPromise;
    } finally {
      mountPromise = null;
    }
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-rp-borrow-toggle]');
    if (toggle) {
      borrowOpen = !borrowOpen;
      const section = auditSection();
      if (section && mountedSessionId) {
        renderBorrowPanel(section, mountedControl, mountedSessionId);
        if (borrowOpen) {
          window.requestAnimationFrame(() => section.querySelector('[data-rp-borrow-search]')?.focus({ preventScroll: true }));
        }
      }
      return;
    }

    const add = event.target.closest?.('[data-rp-borrow-add]');
    if (add) {
      borrowPlayer(add.dataset.playerId, add.dataset.team);
    }
  }, true);

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-rp-borrow-search]');
    if (!input) return;
    borrowQuery = input.value || '';
    const section = auditSection();
    if (section && mountedSessionId) renderBorrowResults(section, mountedControl, mountedSessionId);
  }, true);

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('[data-rp-audit-team-designation]');
    if (!select) return;
    event.stopPropagation();
    assignTeam(select.dataset.rpAuditTeamDesignation, select.value);
  }, true);

  // Roster edits do not erase the game's public team identity.
  // The designation changes only through the DESIGNATED TEAM selector.

  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(() => mount());
  });

  const observer = new MutationObserver(() => {
    const section = auditSection();
    if (!section) return;
    const missingDesignation = ['west', 'east'].some((side) => {
      const card = section.querySelector(`.rp-video-roster-card.${side}`);
      return Boolean(card && !card.querySelector('[data-rp-audit-team-designation-wrap]'));
    });
    const missingBorrow = !section.querySelector('[data-rp-borrow-wrap]');
    if (!missingDesignation && !missingBorrow) {
      if (mountedSessionId) applyBorrowedBadges(section, mountedControl, mountedSessionId);
      return;
    }
    window.requestAnimationFrame(() => mount());
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  } else {
    mount();
  }
})();