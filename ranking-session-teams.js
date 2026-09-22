(() => {
  if (window.__realPlaySessionTeamsInstalled) return;
  window.__realPlaySessionTeamsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const TEAM_SIZE = 4;
  const POLL_MS = 4000;

  let board = null;
  let snapshot = null;
  let roster = null;
  let loading = false;
  let busy = false;
  let pollTimer = null;
  let statusMessage = '';
  let statusType = '';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Sign in to reserve a team.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  function rankingView() {
    return document.querySelector('[data-rp-ranking-games]');
  }

  function rankingSection() {
    return rankingView()?.querySelector('.rp-ranking-next') || null;
  }

  function isViewOpen() {
    const view = rankingView();
    return Boolean(view && (view.classList.contains('open') || view.getAttribute('aria-hidden') === 'false'));
  }

  function ensureBoard() {
    if (board?.isConnected) return board;
    const section = rankingSection();
    const sessionCard = section?.querySelector('[data-rp-ranking-session]');
    if (!section || !sessionCard) return null;

    board = document.createElement('section');
    board.className = 'rp-session-teams';
    board.dataset.rpSessionTeams = 'true';
    board.hidden = true;
    sessionCard.insertAdjacentElement('afterend', board);
    return board;
  }

  function currentTeam() {
    const id = Number(snapshot?.myTeamId || 0);
    return (snapshot?.teams || []).find((team) => Number(team.id) === id) || null;
  }

  function rosterPlayers() {
    return Array.isArray(roster?.players) ? roster.players : [];
  }

  function standbyPlayers() {
    return Array.isArray(roster?.standbyPlayers) ? roster.standbyPlayers : [];
  }

  function isYou(player) {
    return Boolean(player?.isYou ?? player?.is_you);
  }

  function userIsSecured() {
    return rosterPlayers().some(isYou);
  }

  function userIsStandby() {
    return standbyPlayers().some(isYou);
  }

  function counts() {
    const capacity = Number(roster?.capacity ?? snapshot?.session?.capacity ?? 16) || 16;
    const confirmed = Number(roster?.confirmedCount ?? roster?.confirmed_count ?? 0) || 0;
    const standby = Number(roster?.standbyCount ?? roster?.standby_count ?? standbyPlayers().length) || 0;
    return {
      capacity,
      confirmed,
      standby,
      spotsLeft: Math.max(0, capacity - confirmed),
      full: confirmed >= capacity,
    };
  }

  function setStatus(message = '', type = '') {
    statusMessage = String(message || '');
    statusType = type;
    render();
  }

  function teamMemberMarkup(team) {
    const members = Array.isArray(team.members) ? team.members.slice(0, TEAM_SIZE) : [];
    const items = [];

    members.forEach((member) => {
      const tag = member.isYou ? 'YOU' : member.isCreator ? 'CREATOR' : '';
      items.push(`
        <div class="rp-session-team-member">
          <strong>${escapeHtml(member.name || 'REAL PLAY PLAYER')}</strong>
          ${tag ? `<em>${tag}</em>` : ''}
        </div>`);
    });

    for (let index = members.length; index < TEAM_SIZE; index += 1) {
      items.push(`
        <div class="rp-session-team-member empty">
          <strong>${team.visibility === 'private' ? 'INVITED SPOT' : 'OPEN SPOT'}</strong>
        </div>`);
    }

    return items.join('');
  }

  function teamCardMarkup(team, myTeam) {
    const count = Math.min(TEAM_SIZE, Number(team.memberCount ?? team.members?.length ?? 0) || 0);
    const complete = count >= TEAM_SIZE;
    const yours = Number(myTeam?.id || 0) === Number(team.id);
    const canJoin = !myTeam && team.visibility === 'open' && !complete;
    const stateClass = complete ? 'complete' : team.visibility === 'private' ? 'private' : 'open';
    const stateText = complete ? 'COMPLETE' : team.visibility === 'private' ? 'PRIVATE TEAM · CODE REQUIRED' : 'OPEN TEAM · ANYONE CAN JOIN';
    const footerParts = [];

    if (team.isCreator && team.visibility === 'private' && team.joinCode) {
      footerParts.push(`<div class="rp-session-team-code">TEAM CODE <b>${escapeHtml(team.joinCode)}</b></div>`);
    }

    if (team.isCreator && !complete) {
      if (team.visibility === 'private') {
        footerParts.push(`<button type="button" data-rp-team-visibility="open" data-team-id="${Number(team.id)}">MAKE OPEN</button>`);
      } else {
        footerParts.push(`<button class="secondary" type="button" data-rp-team-private data-team-id="${Number(team.id)}">MAKE PRIVATE</button>`);
      }
    }

    if (canJoin) {
      footerParts.push(`<button type="button" data-rp-team-join="${Number(team.id)}" ${busy ? 'disabled' : ''}>JOIN TEAM</button>`);
    }

    if (!footerParts.length && yours) {
      footerParts.push('<span class="rp-session-team-code">YOUR TEAM</span>');
    }

    return `
      <article class="rp-session-team-card${yours ? ' is-yours' : ''}${complete ? ' is-complete' : ''}">
        <div class="rp-session-team-card-head">
          <div class="rp-session-team-name">
            <strong>${escapeHtml(team.name || 'TEAM')}</strong>
            <span class="${stateClass}">${team.visibility === 'private' && !complete ? '🔒 ' : ''}${stateText}</span>
          </div>
          <div class="rp-session-team-count"><b>${count}</b>/${TEAM_SIZE}</div>
        </div>
        <div class="rp-session-team-members">${teamMemberMarkup(team)}</div>
        ${footerParts.length ? `<div class="rp-session-team-card-foot">${footerParts.join('')}</div>` : ''}
      </article>`;
  }

  function render() {
    const node = ensureBoard();
    const section = rankingSection();
    if (!node || !section) return;

    if (!snapshot?.session) {
      node.hidden = true;
      section.classList.remove('rp-team-reservation-enabled');
      return;
    }

    section.classList.add('rp-team-reservation-enabled');
    node.hidden = false;

    const tally = counts();
    const myTeam = currentTeam();
    const isSecured = userIsSecured();
    const isStandby = userIsStandby();
    const teams = Array.isArray(snapshot.teams) ? snapshot.teams : [];

    let actions = '';
    let myNote = '';

    if (myTeam) {
      myNote = `<p class="rp-session-team-my-note">YOUR TEAM · ${escapeHtml(myTeam.name)} · ${Number(myTeam.memberCount || 0)}/${TEAM_SIZE}</p>`;
    } else if (isStandby && !isSecured) {
      myNote = '<p class="rp-session-team-my-note">YOU’RE ON STANDBY. IF A SESSION SPOT OPENS, YOU’LL MOVE IN AUTOMATICALLY.</p>';
    } else if (tally.full && !isSecured) {
      actions = `
        <div class="rp-session-team-actions">
          <button class="rp-session-team-action primary" type="button" data-rp-team-standby ${busy ? 'disabled' : ''}>JOIN STANDBY</button>
        </div>`;
    } else {
      actions = `
        <div class="rp-session-team-actions">
          <button class="rp-session-team-action primary" type="button" data-rp-team-create ${busy ? 'disabled' : ''}>CREATE TEAM</button>
          <button class="rp-session-team-action" type="button" data-rp-team-code ${busy ? 'disabled' : ''}>JOIN WITH CODE</button>
          <button class="rp-session-team-action" type="button" data-rp-team-assign ${busy ? 'disabled' : ''}>ASSIGN ME</button>
        </div>`;
    }

    const capacityLabel = tally.full
      ? `${tally.confirmed}/${tally.capacity} PLAYERS`
      : `${tally.confirmed}/${tally.capacity} PLAYERS`;
    const capacitySub = tally.full
      ? (tally.standby > 0 ? `FULL · ${tally.standby} STANDBY` : 'SESSION FULL')
      : `${tally.spotsLeft} SPOT${tally.spotsLeft === 1 ? '' : 'S'} LEFT`;

    node.innerHTML = `
      <div class="rp-session-teams-head">
        <div>
          <small>BUILD YOUR RUN</small>
          <h3>TEAM RESERVATION</h3>
        </div>
        <div class="rp-session-teams-capacity">
          <strong>${capacityLabel}</strong>
          <span>${capacitySub}</span>
        </div>
      </div>
      <p class="rp-session-teams-intro">Create your team, join a private team with its 4-digit code, or let Real Play assign you to an open team that needs a player.</p>
      ${actions}
      ${myNote}
      ${teams.length
        ? `<div class="rp-session-team-list">${teams.map((team) => teamCardMarkup(team, myTeam)).join('')}</div>`
        : '<div class="rp-session-team-empty">NO TEAMS YET. CREATE THE FIRST TEAM OR TAP ASSIGN ME TO START AN OPEN ONE.</div>'}
      <p class="rp-session-team-status${statusType ? ` ${statusType}` : ''}" aria-live="polite">${escapeHtml(statusMessage || (busy ? 'UPDATING TEAM…' : ''))}</p>
    `;
  }

  async function loadRoster() {
    try {
      roster = await api('/api/real-play/career/session-roster');
    } catch (_error) {
      roster = null;
    }
  }

  async function refresh({ quiet = false } = {}) {
    if (loading || busy || !token()) return;
    if (!ensureBoard()) return;
    loading = true;
    try {
      const data = await api('/api/real-play/career/session-teams');
      snapshot = data || null;
      await loadRoster();
      if (!quiet) {
        statusMessage = '';
        statusType = '';
      }
      render();
    } catch (error) {
      if (error.status === 401) return;
      // Do not hide the original reservation UI unless the new backend is live.
      rankingSection()?.classList.remove('rp-team-reservation-enabled');
      if (board) board.hidden = true;
      if (!quiet) console.warn('[Real Play] Team reservation unavailable.', error);
    } finally {
      loading = false;
    }
  }

  async function postTeamAction(body) {
    if (busy) return false;
    busy = true;
    statusMessage = '';
    statusType = '';
    render();
    try {
      const data = await api('/api/real-play/career/session-teams', {
        method: 'POST',
        body,
      });
      snapshot = data || snapshot;
      await loadRoster();
      statusMessage = data?.message || 'TEAM UPDATED.';
      statusType = 'success';
      try { window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed')); } catch (_error) {}
      return true;
    } catch (error) {
      statusMessage = error.message || 'Unable to update your team.';
      statusType = 'error';
      await loadRoster();
      return false;
    } finally {
      busy = false;
      render();
    }
  }

  async function joinStandby() {
    if (busy) return;
    busy = true;
    render();
    try {
      const data = await api('/api/real-play/career/access', { method: 'POST', body: {} });
      statusMessage = data?.message || 'YOU ARE ON STANDBY.';
      statusType = data?.entry?.status === 'secured' ? 'success' : '';
      await loadRoster();
      try { window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed')); } catch (_error) {}
    } catch (error) {
      statusMessage = error.message || 'Unable to join standby.';
      statusType = 'error';
    } finally {
      busy = false;
      render();
    }
  }

  function closeSheet() {
    const overlay = document.querySelector('[data-rp-team-sheet]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function mountSheet(innerHtml, onMount) {
    document.querySelector('[data-rp-team-sheet]')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'rp-team-sheet-overlay';
    overlay.dataset.rpTeamSheet = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="rp-team-sheet" role="dialog" aria-modal="true">${innerHtml}</section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-rp-team-sheet-close]')?.addEventListener('click', closeSheet);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSheet();
    });
    onMount?.(overlay);
    requestAnimationFrame(() => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
    });
    return overlay;
  }

  function sheetHead(kicker, title) {
    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><small>${escapeHtml(kicker)}</small><h3>${escapeHtml(title)}</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Close" data-rp-team-sheet-close>×</button>
      </div>`;
  }

  function openCreateSheet() {
    const overlay = mountSheet(`
      ${sheetHead('SUNDAY OPEN RANK', 'CREATE TEAM')}
      <form data-rp-team-create-form>
        <label class="rp-team-field">
          <span>TEAM NAME</span>
          <input name="name" maxlength="24" autocomplete="off" placeholder="e.g. RAVENS" required />
        </label>
        <div class="rp-team-visibility" role="group" aria-label="Who can join">
          <button type="button" class="is-selected" data-rp-team-visibility-choice="open">OPEN TEAM<br><small>ANYONE CAN JOIN</small></button>
          <button type="button" data-rp-team-visibility-choice="private">PRIVATE TEAM<br><small>4-DIGIT CODE</small></button>
        </div>
        <label class="rp-team-field code" data-rp-team-create-code hidden>
          <span>CHOOSE YOUR 4-DIGIT CODE</span>
          <input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234" />
        </label>
        <p class="rp-team-sheet-note" data-rp-team-create-note>Open teams can be joined directly and can receive players who tap Assign Me.</p>
        <button class="rp-team-sheet-submit" type="submit">CREATE TEAM & SAVE MY SPOT</button>
      </form>`,
      (sheet) => {
        let visibility = 'open';
        const form = sheet.querySelector('[data-rp-team-create-form]');
        const codeField = sheet.querySelector('[data-rp-team-create-code]');
        const codeInput = form?.elements?.code;
        const note = sheet.querySelector('[data-rp-team-create-note]');

        sheet.querySelectorAll('[data-rp-team-visibility-choice]').forEach((button) => {
          button.addEventListener('click', () => {
            visibility = button.dataset.rpTeamVisibilityChoice === 'private' ? 'private' : 'open';
            sheet.querySelectorAll('[data-rp-team-visibility-choice]').forEach((item) => {
              item.classList.toggle('is-selected', item === button);
            });
            const isPrivate = visibility === 'private';
            codeField.hidden = !isPrivate;
            if (codeInput) codeInput.required = isPrivate;
            if (note) note.textContent = isPrivate
              ? 'Only players who know this 4-digit code can join your team.'
              : 'Open teams can be joined directly and can receive players who tap Assign Me.';
          });
        });

        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const name = String(form.elements.name?.value || '').trim();
          const code = String(form.elements.code?.value || '').replace(/\D/g, '').slice(0, 4);
          const submit = form.querySelector('[type="submit"]');
          if (visibility === 'private' && !/^\d{4}$/.test(code)) {
            form.elements.code?.focus();
            return;
          }
          if (submit) submit.disabled = true;
          const ok = await postTeamAction({ action: 'create', name, visibility, code });
          if (ok) closeSheet();
          else if (submit) submit.disabled = false;
        });

        window.setTimeout(() => form?.elements?.name?.focus(), 80);
      }
    );
    return overlay;
  }

  function openJoinCodeSheet() {
    mountSheet(`
      ${sheetHead('PRIVATE TEAM', 'JOIN WITH CODE')}
      <form data-rp-team-code-form>
        <label class="rp-team-field code">
          <span>4-DIGIT TEAM CODE</span>
          <input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234" required />
        </label>
        <p class="rp-team-sheet-note">Enter the code your teammate shared with you. Your session spot is secured when the join succeeds.</p>
        <button class="rp-team-sheet-submit" type="submit">JOIN TEAM & SAVE MY SPOT</button>
      </form>`,
      (sheet) => {
        const form = sheet.querySelector('[data-rp-team-code-form]');
        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const code = String(form.elements.code?.value || '').replace(/\D/g, '').slice(0, 4);
          if (!/^\d{4}$/.test(code)) return;
          const submit = form.querySelector('[type="submit"]');
          if (submit) submit.disabled = true;
          const ok = await postTeamAction({ action: 'join_code', code });
          if (ok) closeSheet();
          else if (submit) submit.disabled = false;
        });
        window.setTimeout(() => form?.elements?.code?.focus(), 80);
      }
    );
  }

  function openMakePrivateSheet(teamId) {
    const team = (snapshot?.teams || []).find((item) => Number(item.id) === Number(teamId));
    if (!team) return;
    mountSheet(`
      ${sheetHead('TEAM ACCESS', 'MAKE PRIVATE')}
      <form data-rp-team-private-form>
        <label class="rp-team-field code">
          <span>CHOOSE A 4-DIGIT CODE</span>
          <input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234" required />
        </label>
        <p class="rp-team-sheet-note">Once private, only players with this code can fill the remaining spots.</p>
        <button class="rp-team-sheet-submit" type="submit">MAKE ${escapeHtml(team.name)} PRIVATE</button>
      </form>`,
      (sheet) => {
        const form = sheet.querySelector('[data-rp-team-private-form]');
        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const code = String(form.elements.code?.value || '').replace(/\D/g, '').slice(0, 4);
          if (!/^\d{4}$/.test(code)) return;
          const submit = form.querySelector('[type="submit"]');
          if (submit) submit.disabled = true;
          const ok = await postTeamAction({ action: 'set_visibility', teamId: Number(teamId), visibility: 'private', code });
          if (ok) closeSheet();
          else if (submit) submit.disabled = false;
        });
        window.setTimeout(() => form?.elements?.code?.focus(), 80);
      }
    );
  }

  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;

    if (element.closest('[data-rp-team-create]')) {
      event.preventDefault();
      openCreateSheet();
      return;
    }
    if (element.closest('[data-rp-team-code]')) {
      event.preventDefault();
      openJoinCodeSheet();
      return;
    }
    if (element.closest('[data-rp-team-assign]')) {
      event.preventDefault();
      postTeamAction({ action: 'assign' });
      return;
    }
    if (element.closest('[data-rp-team-standby]')) {
      event.preventDefault();
      joinStandby();
      return;
    }

    const join = element.closest('[data-rp-team-join]');
    if (join) {
      event.preventDefault();
      postTeamAction({ action: 'join_open', teamId: Number(join.dataset.rpTeamJoin) });
      return;
    }

    const makePrivate = element.closest('[data-rp-team-private]');
    if (makePrivate) {
      event.preventDefault();
      openMakePrivateSheet(Number(makePrivate.dataset.teamId));
      return;
    }

    const visibility = element.closest('[data-rp-team-visibility]');
    if (visibility) {
      event.preventDefault();
      postTeamAction({
        action: 'set_visibility',
        teamId: Number(visibility.dataset.teamId),
        visibility: visibility.dataset.rpTeamVisibility === 'private' ? 'private' : 'open',
      });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-rp-team-sheet]')) closeSheet();
  });

  window.addEventListener('realplay:ranking-session-changed', () => {
    window.setTimeout(() => refresh({ quiet: true }), 120);
  });
  window.addEventListener('realplay:app-ready', () => refresh({ quiet: true }));
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) refresh({ quiet: true });
  });

  const observer = new MutationObserver(() => {
    if (!ensureBoard()) return;
    if (token()) refresh({ quiet: true });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  pollTimer = window.setInterval(() => {
    if (!token() || !isViewOpen()) return;
    refresh({ quiet: true });
  }, POLL_MS);

  ensureBoard();
  if (token()) refresh({ quiet: true });
})();
