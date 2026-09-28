(() => {
  if (window.__realPlayFastSnapBootstrapInstalled) return;
  window.__realPlayFastSnapBootstrapInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const GUEST_REFRESH_MS = 10000;
  let guestRefreshTimer = null;
  let originalRankingOpen = null;
  let rankingApiPatched = false;
  let lastToken = localStorage.getItem(TOKEN_KEY) || '';

  // Preserve the existing fast-snap/reduced-motion bootstrap behavior.
  const original = window.matchMedia?.bind(window);
  if (original && !window.__realPlayOriginalMatchMedia) {
    window.__realPlayOriginalMatchMedia = original;
    window.matchMedia = (query) => {
      const result = original(query);
      if (query !== '(prefers-reduced-motion: reduce)') return result;

      return new Proxy(result, {
        get(target, property) {
          if (property === 'matches') return true;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    };
  }

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function openAuth() {
    document.querySelector('[data-auth-open]')?.click();
  }

  async function publicJson(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
    return data;
  }

  function formatSessionDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function rankingView() {
    return document.querySelector('[data-rp-ranking-games]');
  }

  function rankingSection(view) {
    return view?.querySelector('.rp-ranking-next') || null;
  }

  function ensureGuestBoard(view) {
    let board = view?.querySelector('[data-rp-session-teams]');
    if (board) return board;
    const host = rankingSection(view);
    const card = host?.querySelector('[data-rp-ranking-session]');
    if (!host || !card) return null;
    board = document.createElement('section');
    board.className = 'rp-session-teams';
    board.dataset.rpSessionTeams = 'true';
    board.hidden = true;
    card.insertAdjacentElement('afterend', board);
    return board;
  }

  function publicMemberMarkup(team, teamSize) {
    const members = Array.isArray(team?.members) ? team.members.slice(0, teamSize) : [];
    const rows = members.map((member) => {
      const label = member?.isCreator ? '<em>CREATOR</em>' : '';
      return `<div class="rp-session-team-member"><strong>${esc(member?.name || 'REAL PLAY PLAYER')}</strong>${label}</div>`;
    });
    while (rows.length < teamSize) {
      rows.push(`<div class="rp-session-team-member empty"><strong>${team?.visibility === 'private' ? 'INVITED SPOT' : 'OPEN SPOT'}</strong></div>`);
    }
    return rows.join('');
  }

  function publicTeamCard(team, teamSize) {
    const count = Math.min(teamSize, Number(team?.memberCount ?? team?.members?.length ?? 0) || 0);
    const complete = count >= teamSize;
    const isPrivate = team?.visibility === 'private';
    const stateClass = complete ? 'complete' : isPrivate ? 'private' : 'open';
    const stateText = complete ? 'COMPLETE' : isPrivate ? 'PRIVATE TEAM · CODE REQUIRED' : 'OPEN TEAM · ANYONE CAN JOIN';
    const action = complete
      ? ''
      : `<div class="rp-session-team-card-foot"><button type="button" ${isPrivate ? `data-rp-team-join-private="${Number(team?.id || 0)}"` : `data-rp-team-join="${Number(team?.id || 0)}"`}>JOIN TEAM</button></div>`;

    return `<article class="rp-session-team-card${complete ? ' is-complete' : ''}">
      <div class="rp-session-team-card-head">
        <div class="rp-session-team-name"><strong>${esc(team?.name || 'TEAM')}</strong><span class="${stateClass}">${stateText}</span></div>
        <div class="rp-session-team-count"><b>${count}</b>/${teamSize}</div>
      </div>
      <div class="rp-session-team-members">${publicMemberMarkup(team, teamSize)}</div>
      ${action}
    </article>`;
  }

  function renderGuestSession(view, access) {
    const session = access?.session || null;
    const card = view?.querySelector('[data-rp-ranking-session]');
    const host = rankingSection(view);
    const sessionAction = view?.querySelector('[data-rp-ranking-session-action]');
    const cancelAction = view?.querySelector('[data-rp-ranking-cancel]');
    if (!card || !host) return;

    if (cancelAction) cancelAction.hidden = true;
    if (sessionAction) {
      sessionAction.hidden = true;
      sessionAction.disabled = true;
      sessionAction.style.display = 'none';
    }

    if (!session) {
      host.classList.remove('rp-team-reservation-enabled');
      const status = view.querySelector('[data-rp-ranking-session-status]');
      const title = view.querySelector('[data-rp-ranking-session-title]');
      const copy = view.querySelector('[data-rp-ranking-session-copy]');
      if (status) status.textContent = 'NO GAME ANNOUNCED';
      if (title) title.textContent = 'TO BE ANNOUNCED';
      if (copy) copy.textContent = 'The next official Ranking Game will appear here once Real Play announces the court, date and time.';
      return;
    }

    const capacity = Number(session.capacity || 16) || 16;
    const secured = Number(access?.counts?.secured || 0) || 0;
    const details = [];
    if (session.locationName) details.push(String(session.locationName).toUpperCase());
    if (session.startsAt) details.push(formatSessionDate(session.startsAt));
    details.push(`${secured}/${capacity} CONFIRMED`);

    card.classList.add('posted');
    card.classList.toggle('full', secured >= capacity);
    const status = view.querySelector('[data-rp-ranking-session-status]');
    const title = view.querySelector('[data-rp-ranking-session-title]');
    const copy = view.querySelector('[data-rp-ranking-session-copy]');
    if (status) status.textContent = secured >= capacity ? 'RANKING GAME FULL' : 'RANKING GAME ANNOUNCED';
    if (title) title.textContent = String(session.title || 'OPEN RANKING SESSION').toUpperCase();
    if (copy) copy.textContent = details.filter(Boolean).join(' · ');
    host.classList.add('rp-team-reservation-enabled');
  }

  function renderGuestTeams(view, access, teamState) {
    const board = ensureGuestBoard(view);
    const host = rankingSection(view);
    if (!board || !host) return;

    const session = teamState?.session || access?.session || null;
    if (!session) {
      board.hidden = true;
      host.classList.remove('rp-team-reservation-enabled');
      return;
    }

    const teamSize = Number(teamState?.teamSize || 4) || 4;
    const capacity = Number(access?.session?.capacity ?? session?.capacity ?? 16) || 16;
    const confirmed = Number(access?.counts?.secured || 0) || 0;
    const standby = Number(access?.counts?.standby || 0) || 0;
    const full = confirmed >= capacity;
    const left = Math.max(0, capacity - confirmed);
    const teams = Array.isArray(teamState?.teams) ? teamState.teams : [];
    const actions = full
      ? `<div class="rp-session-team-actions"><button class="rp-session-team-action primary" type="button" data-rp-team-standby>JOIN STANDBY</button></div>`
      : `<div class="rp-session-team-actions" style="grid-template-columns:1fr 1fr">
          <button class="rp-session-team-action primary" type="button" data-rp-team-create>CREATE TEAM</button>
          <button class="rp-session-team-action" type="button" data-rp-team-random>RANDOM TEAM</button>
        </div>`;
    const sub = full ? (standby ? `FULL · ${standby} STANDBY` : 'SESSION FULL') : `${left} SPOT${left === 1 ? '' : 'S'} LEFT`;

    host.classList.add('rp-team-reservation-enabled');
    board.hidden = false;
    board.dataset.rpGuestTeamBrowser = 'true';
    board.innerHTML = `<div class="rp-session-teams-head">
        <div><small>BUILD YOUR RUN</small><h3>TEAM RESERVATION</h3></div>
        <div class="rp-session-teams-capacity"><strong>${confirmed}/${capacity} PLAYERS</strong><span>${sub}</span></div>
      </div>
      ${actions}
      ${teams.length ? `<div class="rp-session-team-list">${teams.map((team) => publicTeamCard(team, teamSize)).join('')}</div>` : '<div class="rp-session-team-empty">NO TEAMS YET. CREATE THE FIRST TEAM OR TAP RANDOM TEAM TO LET REAL PLAY PLACE YOU.</div>'}
      <p class="rp-session-team-status">BROWSE FREELY · LOG IN ONLY WHEN YOU CREATE OR JOIN A TEAM.</p>`;
  }

  async function refreshGuestRanking() {
    if (token()) return;
    const view = rankingView();
    if (!view || !view.classList.contains('open')) return;
    try {
      const [access, teams] = await Promise.all([
        publicJson('/api/real-play/public/career/access'),
        publicJson('/api/real-play/public/career/session-teams'),
      ]);
      if (token()) return;
      renderGuestSession(view, access);
      renderGuestTeams(view, access, teams);
    } catch (error) {
      const board = ensureGuestBoard(view);
      if (board) {
        board.hidden = false;
        board.innerHTML = '<div class="rp-session-team-empty">TEAM RESERVATION IS LOADING. PLEASE TRY AGAIN IN A MOMENT.</div>';
      }
      console.warn('[Real Play] Public team reservation preview unavailable.', error);
    }
  }

  function setGuestHero(view) {
    const set = (selector, value) => {
      const node = view?.querySelector(selector);
      if (node) node.textContent = value;
    };
    view?.classList.remove('ranked');
    set('[data-rp-ranking-kicker]', 'SUNDAY OPEN RANKING');
    set('[data-rp-ranking-title]', 'CHOOSE YOUR TEAM.');
    set('[data-rp-ranking-copy]', 'Browse the live team list first. You only need to log in when you create a team, join a team, choose Random Team, or join standby.');
    set('[data-rp-ranking-status-label]', 'PLAYER ACCESS');
    set('[data-rp-ranking-status-value]', 'BROWSE FIRST');
    set('[data-rp-ranking-status-note]', 'LOGIN ONLY TO RESERVE');
  }

  function openGuestRanking() {
    const view = rankingView();
    if (!view) {
      window.setTimeout(openGuestRanking, 80);
      return;
    }

    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-ranking-open');
    view.scrollTop = 0;
    setGuestHero(view);
    refreshGuestRanking();

    if (guestRefreshTimer) window.clearInterval(guestRefreshTimer);
    guestRefreshTimer = window.setInterval(() => {
      if (!rankingView()?.classList.contains('open') || token()) return;
      refreshGuestRanking();
    }, GUEST_REFRESH_MS);
  }

  function installRankingApiPatch() {
    const api = window.RealPlayRankingGames;
    if (!api || rankingApiPatched || typeof api.open !== 'function') return false;
    originalRankingOpen = api.open.bind(api);
    api.open = (...args) => {
      if (token()) return originalRankingOpen(...args);
      openGuestRanking();
    };
    api.__guestReservationGatewayPatched = true;
    rankingApiPatched = true;
    return true;
  }

  // The Home CTA is a browser/entry point, not the authentication gateway.
  // Capture it so a guest always reaches the team reservation view first.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const entry = target.closest('[data-rp-home-open-rank]');
    if (entry && !token()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      installRankingApiPatch();
      openGuestRanking();
      return;
    }

    const reservationAction = target.closest([
      '[data-rp-team-create]',
      '[data-rp-team-random]',
      '[data-rp-team-standby]',
      '[data-rp-team-join]',
      '[data-rp-team-join-private]',
    ].join(','));
    if (!reservationAction || token()) return;

    // THIS is the login gateway: the player has now chosen an action that
    // would actually reserve a place or team membership.
    event.preventDefault();
    event.stopImmediatePropagation();
    openAuth();
  }, true);

  // ranking-games.js loads later in the progressive enhancement chain. Patch
  // its public API as soon as it exists without changing signed-in behavior.
  const patchTimer = window.setInterval(() => {
    if (installRankingApiPatch()) window.clearInterval(patchTimer);
  }, 80);

  window.addEventListener('realplay:enhancements-ready', installRankingApiPatch);

  // If the player logs in from a team action while the Ranking view is already
  // open, hand control straight back to the normal authenticated Ranking flow.
  window.setInterval(() => {
    const currentToken = token();
    if (!lastToken && currentToken && rankingView()?.classList.contains('open')) {
      if (guestRefreshTimer) {
        window.clearInterval(guestRefreshTimer);
        guestRefreshTimer = null;
      }
      try { originalRankingOpen?.(); } catch (_error) {}
      try { window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed')); } catch (_error) {}
    }
    lastToken = currentToken;
  }, 350);
})();
