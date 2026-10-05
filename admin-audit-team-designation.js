(() => {
  if (window.__realPlayAuditTeamDesignationInstalled) return;
  window.__realPlayAuditTeamDesignationInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let directory = { preferencePlayers: [], teamStates: [] };
  let directoryLoaded = false;
  let directoryPromise = null;
  let busy = false;
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

  async function loadDirectory(force = false) {
    if (directoryPromise) return directoryPromise;
    if (directoryLoaded && !force) return directory;
    directoryPromise = (async () => {
      const data = await api('/api/real-play/4v4/admin/rosters');
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
      state[side] = '';
      mount();
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
      const activeMembers = expected > 0 ? members.slice(0, expected) : members;
      const existing = (control.players || []).filter(
        (player) => player.checkedIn && String(player.team || '').toLowerCase() === side
      );

      for (const player of existing) {
        await controlAction({
          action: 'video-roster-remove',
          userId: Number(player.userId),
        });
      }

      for (const player of activeMembers) {
        const signedId = signedPlayerId(player);
        await controlAction({
          action: 'video-roster-add',
          ...(signedId > 0 ? { userId: signedId } : { unclaimedPlayerId: Math.abs(signedId) }),
          team: side,
        });
      }

      state[side] = club;
      const extras = Math.max(0, members.length - activeMembers.length);
      const formatText = expected > 0 ? `${expected}v${expected}` : 'this game';
      setNotice(
        extras
          ? `${club.toUpperCase()} → ${side.toUpperCase()}: ${activeMembers.length} active players loaded for ${formatText}. ${extras} registered substitute${extras === 1 ? '' : 's'} remain outside the active roster.`
          : `${club.toUpperCase()} → ${side.toUpperCase()}: ${activeMembers.length} registered player${activeMembers.length === 1 ? '' : 's'} auto-populated.`
      );
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
      return true;
    })();

    try {
      return await mountPromise;
    } finally {
      mountPromise = null;
    }
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('[data-rp-audit-team-designation]');
    if (!select) return;
    event.stopPropagation();
    assignTeam(select.dataset.rpAuditTeamDesignation, select.value);
  }, true);

  document.addEventListener('click', (event) => {
    const admin = adminRoot();
    if (!admin || !admin.contains(event.target)) return;

    const add = event.target.closest?.('[data-rp-video-add]');
    if (add && mountedSessionId) {
      const side = String(add.dataset.team || '').toLowerCase();
      if (['west', 'east'].includes(side)) designationState(mountedSessionId)[side] = '';
      return;
    }

    const remove = event.target.closest?.('[data-rp-video-remove]');
    if (remove && mountedSessionId) {
      const card = remove.closest('.rp-video-roster-card');
      const side = card?.classList.contains('west') ? 'west' : card?.classList.contains('east') ? 'east' : '';
      if (side) designationState(mountedSessionId)[side] = '';
      return;
    }

    const move = event.target.closest?.('[data-rp-video-switch]');
    if (move && mountedSessionId) {
      const targetSide = String(move.dataset.rpVideoSwitch || '').toLowerCase();
      designationState(mountedSessionId).west = '';
      designationState(mountedSessionId).east = '';
      if (['west', 'east'].includes(targetSide)) designationState(mountedSessionId)[targetSide] = '';
    }
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(() => mount());
  });

  const observer = new MutationObserver(() => {
    if (!auditSection()) return;
    window.requestAnimationFrame(() => mount());
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  } else {
    mount();
  }
})();