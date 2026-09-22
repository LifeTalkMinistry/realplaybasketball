(() => {
  if (window.__realPlaySessionTeamsInstalled) return;
  window.__realPlaySessionTeamsInstalled = true;

  const API = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const TEAM_SIZE = 4;
  const POLL_MS = 4000;

  let board = null;
  let snapshot = null;
  let roster = null;
  let loading = false;
  let busy = false;
  let message = '';
  let messageType = '';

  const authToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  async function api(path, options = {}) {
    const token = authToken();
    if (!token) throw new Error('Sign in to reserve a team.');
    const response = await fetch(`${API}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
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

  function view() { return document.querySelector('[data-rp-ranking-games]'); }
  function section() { return view()?.querySelector('.rp-ranking-next') || null; }
  function viewIsOpen() {
    const node = view();
    return Boolean(node && (node.classList.contains('open') || node.getAttribute('aria-hidden') === 'false'));
  }

  function ensureBoard() {
    if (board?.isConnected) return board;
    const host = section();
    const card = host?.querySelector('[data-rp-ranking-session]');
    if (!host || !card) return null;
    board = document.createElement('section');
    board.className = 'rp-session-teams';
    board.dataset.rpSessionTeams = 'true';
    board.hidden = true;
    card.insertAdjacentElement('afterend', board);
    return board;
  }

  function players() { return Array.isArray(roster?.players) ? roster.players : []; }
  function standbyPlayers() { return Array.isArray(roster?.standbyPlayers) ? roster.standbyPlayers : []; }
  function isYou(player) { return Boolean(player?.isYou ?? player?.is_you); }
  function secured() { return players().some(isYou); }
  function standby() { return standbyPlayers().some(isYou); }
  function myTeam() {
    const id = Number(snapshot?.myTeamId || 0);
    return (snapshot?.teams || []).find((team) => Number(team.id) === id) || null;
  }
  function tally() {
    const capacity = Number(roster?.capacity ?? snapshot?.session?.capacity ?? 16) || 16;
    const confirmed = Number(roster?.confirmedCount ?? roster?.confirmed_count ?? 0) || 0;
    const standbyCount = Number(roster?.standbyCount ?? roster?.standby_count ?? standbyPlayers().length) || 0;
    return { capacity, confirmed, standbyCount, full: confirmed >= capacity, left: Math.max(0, capacity - confirmed) };
  }

  function memberMarkup(team) {
    const members = Array.isArray(team.members) ? team.members.slice(0, TEAM_SIZE) : [];
    const html = members.map((member) => {
      const label = member.isYou ? 'YOU' : member.isCreator ? 'CREATOR' : '';
      return `<div class="rp-session-team-member"><strong>${esc(member.name || 'REAL PLAY PLAYER')}</strong>${label ? `<em>${label}</em>` : ''}</div>`;
    });
    while (html.length < TEAM_SIZE) {
      html.push(`<div class="rp-session-team-member empty"><strong>${team.visibility === 'private' ? 'INVITED SPOT' : 'OPEN SPOT'}</strong></div>`);
    }
    return html.join('');
  }

  function cardMarkup(team, mine) {
    const count = Math.min(TEAM_SIZE, Number(team.memberCount ?? team.members?.length ?? 0) || 0);
    const complete = count >= TEAM_SIZE;
    const yours = Number(mine?.id || 0) === Number(team.id);
    const stateClass = complete ? 'complete' : team.visibility === 'private' ? 'private' : 'open';
    const stateText = complete ? 'COMPLETE' : team.visibility === 'private' ? 'PRIVATE TEAM · CODE REQUIRED' : 'OPEN TEAM · ANYONE CAN JOIN';
    const footer = [];

    if (team.isCreator && team.visibility === 'private' && team.joinCode) {
      footer.push(`<div class="rp-session-team-code">TEAM CODE <b>${esc(team.joinCode)}</b></div>`);
    }
    if (team.isCreator && !complete) {
      footer.push(team.visibility === 'private'
        ? `<button type="button" data-rp-team-visibility="open" data-team-id="${Number(team.id)}">MAKE OPEN</button>`
        : `<button class="secondary" type="button" data-rp-team-private data-team-id="${Number(team.id)}">MAKE PRIVATE</button>`);
    }
    if (!mine && !complete) {
      footer.push(team.visibility === 'private'
        ? `<button type="button" data-rp-team-join-private="${Number(team.id)}" ${busy ? 'disabled' : ''}>JOIN TEAM</button>`
        : `<button type="button" data-rp-team-join="${Number(team.id)}" ${busy ? 'disabled' : ''}>JOIN TEAM</button>`);
    }
    if (!footer.length && yours) footer.push('<span class="rp-session-team-code">YOUR TEAM</span>');

    return `<article class="rp-session-team-card${yours ? ' is-yours' : ''}${complete ? ' is-complete' : ''}">
      <div class="rp-session-team-card-head">
        <div class="rp-session-team-name"><strong>${esc(team.name || 'TEAM')}</strong><span class="${stateClass}">${team.visibility === 'private' && !complete ? '🔒 ' : ''}${stateText}</span></div>
        <div class="rp-session-team-count"><b>${count}</b>/${TEAM_SIZE}</div>
      </div>
      <div class="rp-session-team-members">${memberMarkup(team)}</div>
      ${footer.length ? `<div class="rp-session-team-card-foot">${footer.join('')}</div>` : ''}
    </article>`;
  }

  function render() {
    const node = ensureBoard();
    const host = section();
    if (!node || !host) return;
    if (!snapshot?.session) {
      node.hidden = true;
      host.classList.remove('rp-team-reservation-enabled');
      return;
    }

    host.classList.add('rp-team-reservation-enabled');
    node.hidden = false;
    const counts = tally();
    const mine = myTeam();
    const teams = Array.isArray(snapshot.teams) ? snapshot.teams : [];

    let actions = '';
    let note = '';
    if (mine) {
      note = `<p class="rp-session-team-my-note">YOUR TEAM · ${esc(mine.name)} · ${Number(mine.memberCount || 0)}/${TEAM_SIZE}</p>`;
    } else if (standby() && !secured()) {
      note = '<p class="rp-session-team-my-note">YOU’RE ON STANDBY. IF A SESSION SPOT OPENS, YOU’LL MOVE IN AUTOMATICALLY.</p>';
    } else if (counts.full && !secured()) {
      actions = `<div class="rp-session-team-actions"><button class="rp-session-team-action primary" type="button" data-rp-team-standby ${busy ? 'disabled' : ''}>JOIN STANDBY</button></div>`;
    } else {
      actions = `<div class="rp-session-team-actions" style="grid-template-columns:1fr 1fr">
        <button class="rp-session-team-action primary" type="button" data-rp-team-create ${busy ? 'disabled' : ''}>CREATE TEAM</button>
        <button class="rp-session-team-action" type="button" data-rp-team-random ${busy ? 'disabled' : ''}>RANDOM TEAM</button>
      </div>`;
    }

    const sub = counts.full ? (counts.standbyCount ? `FULL · ${counts.standbyCount} STANDBY` : 'SESSION FULL') : `${counts.left} SPOT${counts.left === 1 ? '' : 'S'} LEFT`;
    node.innerHTML = `<div class="rp-session-teams-head">
        <div><small>BUILD YOUR RUN</small><h3>TEAM RESERVATION</h3></div>
        <div class="rp-session-teams-capacity"><strong>${counts.confirmed}/${counts.capacity} PLAYERS</strong><span>${sub}</span></div>
      </div>
      ${actions}${note}
      ${teams.length ? `<div class="rp-session-team-list">${teams.map((team) => cardMarkup(team, mine)).join('')}</div>` : '<div class="rp-session-team-empty">NO TEAMS YET. CREATE THE FIRST TEAM OR TAP RANDOM TEAM TO LET REAL PLAY PLACE YOU.</div>'}
      <p class="rp-session-team-status${messageType ? ` ${messageType}` : ''}" aria-live="polite">${esc(message || (busy ? 'UPDATING TEAM…' : ''))}</p>`;
  }

  async function loadRoster() {
    try { roster = await api('/api/real-play/career/session-roster'); }
    catch (_error) { roster = null; }
  }

  async function refresh({ quiet = false } = {}) {
    if (loading || busy || !authToken() || !ensureBoard()) return;
    loading = true;
    try {
      snapshot = await api('/api/real-play/career/session-teams');
      await loadRoster();
      if (!quiet) { message = ''; messageType = ''; }
      render();
    } catch (error) {
      if (error.status !== 401 && !quiet) console.warn('[Real Play] Team reservation unavailable.', error);
      section()?.classList.remove('rp-team-reservation-enabled');
      if (board) board.hidden = true;
    } finally { loading = false; }
  }

  async function act(body) {
    if (busy) return false;
    busy = true; message = ''; messageType = ''; render();
    try {
      snapshot = await api('/api/real-play/career/session-teams', { method: 'POST', body });
      await loadRoster();
      message = snapshot?.message || 'TEAM UPDATED.';
      messageType = 'success';
      try { window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed')); } catch (_error) {}
      return true;
    } catch (error) {
      message = error.message || 'Unable to update your team.';
      messageType = 'error';
      await loadRoster();
      return false;
    } finally { busy = false; render(); }
  }

  async function joinStandby() {
    if (busy) return;
    busy = true; render();
    try {
      const result = await api('/api/real-play/career/access', { method: 'POST', body: {} });
      message = result?.message || 'STANDBY UPDATED.';
      messageType = result?.entry?.status === 'secured' ? 'success' : '';
      await loadRoster();
      try { window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed')); } catch (_error) {}
    } catch (error) { message = error.message || 'Unable to join standby.'; messageType = 'error'; }
    finally { busy = false; render(); }
  }

  function closeSheet() {
    const overlay = document.querySelector('[data-rp-team-sheet]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function head(kicker, title) {
    return `<div class="rp-team-sheet-grab" aria-hidden="true"></div><div class="rp-team-sheet-head"><div><small>${esc(kicker)}</small><h3>${esc(title)}</h3></div><button class="rp-team-sheet-close" type="button" aria-label="Close" data-rp-team-sheet-close>×</button></div>`;
  }

  function sheet(html, setup) {
    document.querySelector('[data-rp-team-sheet]')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'rp-team-sheet-overlay';
    overlay.dataset.rpTeamSheet = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="rp-team-sheet" role="dialog" aria-modal="true">${html}</section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-rp-team-sheet-close]')?.addEventListener('click', closeSheet);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeSheet(); });
    setup?.(overlay);
    requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('is-open'); });
  }

  function openCreate() {
    sheet(`${head('SUNDAY OPEN RANK', 'CREATE TEAM')}
      <form data-team-create-form>
        <label class="rp-team-field"><span>TEAM NAME</span><input name="name" maxlength="24" autocomplete="off" placeholder="e.g. RAVENS" required></label>
        <div class="rp-team-visibility" role="group" aria-label="Who can join">
          <button type="button" class="is-selected" data-choice="open">OPEN TEAM<br><small>ANYONE CAN JOIN</small></button>
          <button type="button" data-choice="private">PRIVATE TEAM<br><small>4-DIGIT CODE</small></button>
        </div>
        <label class="rp-team-field code" data-create-code hidden><span>CHOOSE YOUR 4-DIGIT CODE</span><input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234"></label>
        <p class="rp-team-sheet-note" data-create-note>Open teams can be joined directly and can receive players who choose Random Team.</p>
        <button class="rp-team-sheet-submit" type="submit">CREATE TEAM & SAVE MY SPOT</button>
      </form>`, (overlay) => {
      let visibility = 'open';
      const form = overlay.querySelector('[data-team-create-form]');
      const codeWrap = overlay.querySelector('[data-create-code]');
      const note = overlay.querySelector('[data-create-note]');
      overlay.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
        visibility = button.dataset.choice === 'private' ? 'private' : 'open';
        overlay.querySelectorAll('[data-choice]').forEach((item) => item.classList.toggle('is-selected', item === button));
        codeWrap.hidden = visibility !== 'private';
        form.elements.code.required = visibility === 'private';
        note.textContent = visibility === 'private' ? 'Only players who know this 4-digit code can join your team.' : 'Open teams can be joined directly and can receive players who choose Random Team.';
      }));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = String(form.elements.name.value || '').trim();
        const code = String(form.elements.code.value || '').replace(/\D/g, '').slice(0, 4);
        if (visibility === 'private' && !/^\d{4}$/.test(code)) return form.elements.code.focus();
        const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
        if (await act({ action: 'create', name, visibility, code })) closeSheet(); else submit.disabled = false;
      });
      window.setTimeout(() => form.elements.name.focus(), 80);
    });
  }

  function openRandomTeam() {
    sheet(`${head('TEAM RESERVATION', 'RANDOM TEAM')}
      <p class="rp-team-sheet-note">Your session spot is already reserved. Random Team only decides where Real Play places you. If an open team is missing a player, you will automatically be added there. If no team currently needs a player, Real Play will place you into an open team so your reservation stays organized.</p>
      <button class="rp-team-sheet-submit" type="button" data-rp-random-confirm>I UNDERSTAND IT</button>`, (overlay) => {
      const confirm = overlay.querySelector('[data-rp-random-confirm]');
      confirm?.addEventListener('click', async () => {
        confirm.disabled = true;
        if (await act({ action: 'assign' })) closeSheet(); else confirm.disabled = false;
      });
      window.setTimeout(() => confirm?.focus(), 80);
    });
  }

  function openCode(teamId = null) {
    const team = teamId ? (snapshot?.teams || []).find((item) => Number(item.id) === Number(teamId)) : null;
    const title = team?.name ? `JOIN ${team.name}` : 'JOIN PRIVATE TEAM';
    const note = team?.name
      ? `Enter the 4-digit code shared for ${team.name}. Your session spot is secured when the join succeeds.`
      : 'Enter the 4-digit code your teammate shared. Your session spot is secured when the join succeeds.';
    sheet(`${head('PRIVATE TEAM', title)}
      <form data-team-code-form>
        <label class="rp-team-field code"><span>4-DIGIT TEAM CODE</span><input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234" required></label>
        <p class="rp-team-sheet-note">${esc(note)}</p>
        <button class="rp-team-sheet-submit" type="submit">JOIN TEAM & SAVE MY SPOT</button>
      </form>`, (overlay) => {
      const form = overlay.querySelector('[data-team-code-form]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = String(form.elements.code.value || '').replace(/\D/g, '').slice(0, 4);
        if (!/^\d{4}$/.test(code)) return;
        const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
        if (await act({ action: 'join_code', code, ...(team ? { teamId: Number(team.id) } : {}) })) closeSheet(); else submit.disabled = false;
      });
      window.setTimeout(() => form.elements.code.focus(), 80);
    });
  }

  function openPrivate(teamId) {
    const team = (snapshot?.teams || []).find((item) => Number(item.id) === Number(teamId));
    if (!team) return;
    sheet(`${head('TEAM ACCESS', 'MAKE PRIVATE')}
      <form data-team-private-form>
        <label class="rp-team-field code"><span>CHOOSE A 4-DIGIT CODE</span><input name="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="1234" required></label>
        <p class="rp-team-sheet-note">Once private, only players with this code can fill the remaining spots.</p>
        <button class="rp-team-sheet-submit" type="submit">MAKE ${esc(team.name)} PRIVATE</button>
      </form>`, (overlay) => {
      const form = overlay.querySelector('[data-team-private-form]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = String(form.elements.code.value || '').replace(/\D/g, '').slice(0, 4);
        if (!/^\d{4}$/.test(code)) return;
        const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
        if (await act({ action: 'set_visibility', teamId: Number(teamId), visibility: 'private', code })) closeSheet(); else submit.disabled = false;
      });
      window.setTimeout(() => form.elements.code.focus(), 80);
    });
  }

  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return;
    if (el.closest('[data-rp-team-create]')) return void openCreate();
    if (el.closest('[data-rp-team-random]')) return void openRandomTeam();
    if (el.closest('[data-rp-team-standby]')) return void joinStandby();
    const joinPrivate = el.closest('[data-rp-team-join-private]');
    if (joinPrivate) return void openCode(Number(joinPrivate.dataset.rpTeamJoinPrivate));
    const join = el.closest('[data-rp-team-join]');
    if (join) return void act({ action: 'join_open', teamId: Number(join.dataset.rpTeamJoin) });
    const makePrivate = el.closest('[data-rp-team-private]');
    if (makePrivate) return void openPrivate(Number(makePrivate.dataset.teamId));
    const visibility = el.closest('[data-rp-team-visibility]');
    if (visibility) return void act({ action: 'set_visibility', teamId: Number(visibility.dataset.teamId), visibility: visibility.dataset.rpTeamVisibility });
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSheet(); });
  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(() => refresh({ quiet: true }), 120));
  window.addEventListener('realplay:app-ready', () => refresh({ quiet: true }));
  window.addEventListener('storage', (event) => { if (event.key === TOKEN_KEY) refresh({ quiet: true }); });

  const mountObserver = new MutationObserver(() => {
    if (board?.isConnected) return;
    if (ensureBoard() && authToken()) refresh({ quiet: true });
  });
  mountObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(() => { if (authToken() && viewIsOpen()) refresh({ quiet: true }); }, POLL_MS);
  ensureBoard();
  if (authToken()) refresh({ quiet: true });
})();