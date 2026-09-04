(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS', verse: 'Proverbs 28:1' },
    { id: 'valiant', name: 'VALIANT', verse: 'Joshua 1:9' },
    { id: 'watchmen', name: 'WATCHMEN', verse: 'Isaiah 62:6' },
    { id: 'conquerors', name: 'CONQUERORS', verse: 'Romans 8:37' },
  ];

  const lobby = document.querySelector('[data-rp-lobby]');
  const oldStage = lobby?.querySelector('.rp-mode-stage');
  if (!lobby || !oldStage) return;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || 'Real Play could not complete that request.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  const stage = document.createElement('section');
  stage.className = 'rp-mode-stage rp-beta-mode-stage';
  stage.setAttribute('aria-label', 'Real Play game formats');
  stage.innerHTML = `
    <div class="rp-mode-track" data-rp-beta-mode-track>
      <article class="rp-mode-card rp-mode-3v3" data-beta-mode="3v3">
        <div class="rp-mode-art" aria-hidden="true"></div>
        <div class="rp-mode-card-content">
          <div class="rp-mode-type">BETA SEASON · LIVE</div>
          <h2>3V3</h2>
          <p>Four Real Play clubs. Race to 8. Win your matchup and advance to the Final.</p>
          <div class="rp-mode-meta">4 CLUBS · RACE TO 8 · WIN & ADVANCE</div>
          <button class="rp-play-button" type="button" data-rp-enter-3v3>ENTER 3V3 <span>→</span></button>
        </div>
      </article>

      <article class="rp-mode-card rp-mode-5v5" data-beta-mode="5v5" aria-disabled="true">
        <div class="rp-mode-art" aria-hidden="true"></div>
        <div class="rp-mode-card-content">
          <div class="rp-mode-type">COMING SOON</div>
          <h2>5V5</h2>
          <p>Full-court Real Play basketball is being built for a future phase.</p>
          <div class="rp-mode-meta">FULL COURT · FUTURE MODE</div>
          <button class="rp-play-button" type="button" disabled>UNDER CONSTRUCTION</button>
        </div>
      </article>
    </div>
    <div class="rp-mode-tabs rp-beta-mode-tabs" role="tablist" aria-label="Game format selector">
      <button class="rp-mode-tab active" type="button" role="tab" aria-selected="true" data-rp-beta-tab="0">3V3</button>
      <button class="rp-mode-tab" type="button" role="tab" aria-selected="false" data-rp-beta-tab="1">5V5</button>
    </div>
  `;
  oldStage.replaceWith(stage);

  const track = stage.querySelector('[data-rp-beta-mode-track]');
  const cards = [...stage.querySelectorAll('[data-beta-mode]')];
  const tabs = [...stage.querySelectorAll('[data-rp-beta-tab]')];

  function activateTab(index) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      cards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      activateTab(index);
    });
  });

  let scrollTimer = null;
  track?.addEventListener('scroll', () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(center - cardCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      activateTab(nearestIndex);
    }, 70);
  }, { passive: true });

  const view = document.createElement('section');
  view.className = 'rp-3v3-view';
  view.setAttribute('aria-hidden', 'true');
  view.innerHTML = `
    <div class="rp-3v3-shell">
      <header class="rp-3v3-topbar">
        <button class="rp-3v3-back" type="button" aria-label="Back to main menu" data-rp-3v3-back>←</button>
        <div class="rp-3v3-brand"><strong>REAL PLAY 3V3</strong><span>BETA SEASON</span></div>
        <div class="rp-3v3-topmark">3V3</div>
      </header>

      <section class="rp-3v3-select-head">
        <h1 data-rp-team-heading>SELECT YOUR TEAM.</h1>
      </section>

      <div data-rp-team-browse>
        <section class="rp-3v3-team-picker" aria-label="Choose your preferred Real Play team">
          <button class="rp-team-arrow rp-team-arrow-left" type="button" aria-label="Previous team" data-rp-team-prev>‹</button>
          <div class="rp-team-carousel" data-rp-team-carousel tabindex="0" aria-live="polite">
            ${CLUBS.map((club) => `
              <button class="rp-team-card" id="rp-team-${club.id}" type="button" data-rp-three-club="${club.id}">
                <small>REAL PLAY CLUB</small>
                <strong>${club.name}</strong>
                <span>${club.verse}</span>
              </button>
            `).join('')}
          </div>
          <button class="rp-team-arrow rp-team-arrow-right" type="button" aria-label="Next team" data-rp-team-next>›</button>
        </section>

        <div class="rp-team-dots" data-rp-team-dots aria-hidden="true">
          ${CLUBS.map(() => '<i></i>').join('')}
        </div>
      </div>

      <section class="rp-team-fixed" data-rp-team-fixed hidden>
        <div class="rp-team-fixed-card" data-rp-team-fixed-card>
          <small data-rp-fixed-kicker>YOUR PREFERRED TEAM</small>
          <strong data-rp-fixed-name>TEAM</strong>
          <span data-rp-fixed-verse></span>
          <em data-rp-fixed-badge>TOP 1 PREFERENCE</em>
        </div>
        <button class="rp-team-change" type="button" data-rp-team-change>CHANGE TEAM</button>
      </section>

      <p class="rp-3v3-status" data-rp-3v3-status aria-live="polite"></p>

      <section class="rp-3v3-session" data-rp-3v3-session>
        <div class="rp-3v3-session-head">
          <div>
            <small>FIRST OFFICIAL 3V3 LEAGUE</small>
            <strong data-rp-session-title>BUILDING THE LAUNCH ROSTER…</strong>
            <span data-rp-session-meta></span>
          </div>
          <b data-rp-session-count>—</b>
        </div>
        <p class="rp-3v3-roster-needed" data-rp-roster-needed>Checking how many players we still need to complete the first roster.</p>
        <button class="rp-3v3-session-action" type="button" data-rp-session-action disabled>CHECKING…</button>
        <button class="rp-3v3-session-cancel" type="button" data-rp-session-cancel hidden>RELEASE MY LEAGUE SPOT</button>
        <p class="rp-3v3-session-message" data-rp-session-message aria-live="polite"></p>
      </section>
    </div>

    <div class="rp-team-confirm" data-rp-team-confirm aria-hidden="true">
      <section class="rp-team-confirm-card" role="dialog" aria-modal="true" aria-labelledby="rp-team-confirm-title">
        <small>TOP 1 PREFERENCE</small>
        <h2 id="rp-team-confirm-title">CHOOSE <span data-rp-confirm-team>TEAM</span>?</h2>
        <p>Make <strong data-rp-confirm-team-copy>this team</strong> your #1 preferred team?</p>
        <div class="rp-team-confirm-note">
          <span>This is a preference only. Real Play may still assign you to a different team based on balance and Beta Season needs.</span>
        </div>
        <button class="rp-team-confirm-primary" type="button" data-rp-team-confirm-save>YES, MAKE THIS MY TOP 1</button>
        <button class="rp-team-confirm-secondary" type="button" data-rp-team-confirm-close>NOT YET</button>
      </section>
    </div>
  `;
  document.body.appendChild(view);

  const back = view.querySelector('[data-rp-3v3-back]');
  const heading = view.querySelector('[data-rp-team-heading]');
  const browse = view.querySelector('[data-rp-team-browse]');
  const carousel = view.querySelector('[data-rp-team-carousel]');
  const clubButtons = [...view.querySelectorAll('[data-rp-three-club]')];
  const dots = [...view.querySelectorAll('[data-rp-team-dots] i')];
  const fixed = view.querySelector('[data-rp-team-fixed]');
  const fixedCard = view.querySelector('[data-rp-team-fixed-card]');
  const fixedKicker = view.querySelector('[data-rp-fixed-kicker]');
  const fixedName = view.querySelector('[data-rp-fixed-name]');
  const fixedVerse = view.querySelector('[data-rp-fixed-verse]');
  const fixedBadge = view.querySelector('[data-rp-fixed-badge]');
  const changeTeam = view.querySelector('[data-rp-team-change]');
  const status = view.querySelector('[data-rp-3v3-status]');
  const confirm = view.querySelector('[data-rp-team-confirm]');
  const confirmName = view.querySelector('[data-rp-confirm-team]');
  const confirmCopyName = view.querySelector('[data-rp-confirm-team-copy]');
  const confirmSave = view.querySelector('[data-rp-team-confirm-save]');
  const sessionPanel = view.querySelector('[data-rp-3v3-session]');
  const sessionTitle = view.querySelector('[data-rp-session-title]');
  const sessionMeta = view.querySelector('[data-rp-session-meta]');
  const sessionCount = view.querySelector('[data-rp-session-count]');
  const sessionAction = view.querySelector('[data-rp-session-action]');
  const sessionCancel = view.querySelector('[data-rp-session-cancel]');
  const sessionMessage = view.querySelector('[data-rp-session-message]');
  const rosterNeeded = view.querySelector('[data-rp-roster-needed]');

  let activeIndex = 0;
  let assignedClub = null;
  let savedClub = null;
  let loading = false;
  let pointerStartX = null;
  let pendingClub = null;
  let suppressClickUntil = 0;
  let changingPreference = false;
  let currentSession = null;
  let sessionLoading = false;
  let sessionTimer = null;

  function clubById(id) {
    return CLUBS.find((club) => club.id === id) || null;
  }

  function clubName(id) {
    return clubById(id)?.name || '';
  }

  function clubIndex(id) {
    const index = CLUBS.findIndex((club) => club.id === id);
    return index >= 0 ? index : 0;
  }

  function normalizeIndex(index) {
    return (index + CLUBS.length) % CLUBS.length;
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.classList.toggle('success', type === 'success');
    status.classList.toggle('error', type === 'error');
  }

  function setSessionMessage(message = '', type = '') {
    sessionMessage.textContent = message;
    sessionMessage.classList.toggle('success', type === 'success');
    sessionMessage.classList.toggle('error', type === 'error');
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

  function renderSession(session) {
    currentSession = session || null;
    sessionPanel.classList.remove('secured', 'full', 'live');
    sessionCancel.hidden = true;
    sessionCancel.disabled = true;
    setSessionMessage('');

    if (!session) {
      sessionTitle.textContent = 'LAUNCH ROSTER OPENING SOON';
      sessionMeta.textContent = 'Official start details will appear here once the launch roster opens.';
      sessionCount.textContent = '—';
      sessionAction.disabled = true;
      if (rosterNeeded) rosterNeeded.textContent = 'We’ll show the live reservation count here as soon as the first league roster is available.';
      sessionAction.textContent = 'ROSTER NOT OPEN YET';
      return;
    }

    const confirmed = Number(session.confirmedCount ?? session.confirmed_count ?? 0) || 0;
    const capacity = session.capacity === null || session.capacity === undefined ? null : Number(session.capacity);
    const joined = Boolean(session.joined);
    const gameStatus = session.gameStatus || session.game_status || 'setup';
    const full = capacity !== null && confirmed >= capacity;
    const available = session.available !== false && gameStatus === 'setup' && !full;
    const details = [];
    const dateText = formatSessionDate(session.startsAt || session.starts_at);
    if (dateText) details.push(dateText);
    if (session.locationName || session.location_name) details.push(session.locationName || session.location_name);

    sessionTitle.textContent = 'BETA LEAGUE ROSTER';
    sessionMeta.textContent = details.length ? details.join(' · ') : 'OFFICIAL START · WAITING ON ROSTER COMPLETION';
    sessionCount.textContent = capacity === null ? `${confirmed} RESERVED` : `${confirmed}/${capacity}`;
    if (rosterNeeded) {
      if (capacity === null) {
        rosterNeeded.textContent = `${confirmed} player${confirmed === 1 ? '' : 's'} reserved so far. Reserve yours and join the first official 3V3 league roster.`;
      } else {
        const remaining = Math.max(0, capacity - confirmed);
        rosterNeeded.textContent = remaining === 0
          ? 'THE FIRST 3V3 LEAGUE ROSTER IS COMPLETE.'
          : `WE ONLY NEED ${remaining} MORE PLAYER${remaining === 1 ? '' : 'S'} TO COMPLETE THE FIRST 3V3 ROSTER.`;
      }
    }

    if (gameStatus === 'live') {
      sessionPanel.classList.add('live');
      sessionAction.disabled = true;
      sessionAction.textContent = joined ? '● LEAGUE LIVE · YOU’RE IN' : '● LEAGUE LIVE';
      return;
    }

    if (gameStatus === 'final') {
      sessionAction.disabled = true;
      sessionAction.textContent = 'LEAGUE SESSION COMPLETE';
      return;
    }

    if (joined) {
      sessionPanel.classList.add('secured');
      sessionAction.disabled = true;
      sessionAction.textContent = 'YOUR LEAGUE SPOT IS RESERVED ✓';
      sessionCancel.hidden = false;
      sessionCancel.disabled = sessionLoading;
      sessionCancel.textContent = sessionLoading ? 'RELEASING…' : 'RELEASE MY LEAGUE SPOT';
      return;
    }

    if (full || !available) {
      sessionPanel.classList.add('full');
      sessionAction.disabled = true;
      sessionAction.textContent = 'LAUNCH ROSTER FULL';
      return;
    }

    sessionAction.disabled = sessionLoading;
    sessionAction.textContent = sessionLoading ? 'RESERVING…' : 'RESERVE MY LEAGUE SPOT';
  }

  async function refreshSession({ quiet = false } = {}) {
    if (sessionLoading || !token()) return;
    try {
      const data = await api('/api/real-play/career/session');
      renderSession(data?.session || null);
    } catch (error) {
      if (!quiet) setSessionMessage(error.message || 'Could not load the next session.', 'error');
    }
  }

  async function secureSpot() {
    if (sessionLoading || !currentSession || currentSession.joined) return;
    const gameStatus = currentSession.gameStatus || currentSession.game_status || 'setup';
    if (gameStatus !== 'setup') return;

    sessionLoading = true;
    sessionAction.disabled = true;
    sessionAction.textContent = 'RESERVING…';
    setSessionMessage('');
    let secured = false;

    try {
      const data = await api('/api/real-play/career/play', { method: 'POST' });
      renderSession(data?.session || currentSession);
      secured = true;
    } catch (error) {
      setSessionMessage(error.message || 'Could not reserve your league spot.', 'error');
    } finally {
      sessionLoading = false;
      if (currentSession) renderSession(currentSession);
      if (secured) setSessionMessage('YOU’RE ON THE FIRST 3V3 LEAGUE RESERVATION ROSTER.', 'success');
    }
  }

  async function cancelSpot() {
    if (sessionLoading || !currentSession || !currentSession.joined) return;
    const gameStatus = currentSession.gameStatus || currentSession.game_status || 'setup';
    if (gameStatus !== 'setup') {
      setSessionMessage('THIS LEAGUE ROSTER IS ALREADY LOCKED.', 'error');
      return;
    }

    sessionLoading = true;
    sessionCancel.disabled = true;
    sessionCancel.textContent = 'RELEASING…';
    setSessionMessage('');

    try {
      const data = await api('/api/real-play/career/play', { method: 'DELETE' });
      const releasedSession = data?.session || null;

      if (!releasedSession || releasedSession.joined) {
        throw new Error('The server did not release your reservation. Please try again.');
      }

      sessionLoading = false;
      renderSession(releasedSession);
      setSessionMessage('YOUR LEAGUE RESERVATION WAS RELEASED. THE SPOT IS OPEN AGAIN.', 'success');
      window.dispatchEvent(new CustomEvent('realplay:3v3-reservation-changed'));
    } catch (error) {
      sessionLoading = false;
      if (currentSession) renderSession(currentSession);
      setSessionMessage(error.message || 'Could not release your league spot.', 'error');
    }
  }

  function renderCarousel() {
    const previous = normalizeIndex(activeIndex - 1);
    const next = normalizeIndex(activeIndex + 1);

    clubButtons.forEach((button, index) => {
      const isActive = index === activeIndex;
      const isPrevious = index === previous;
      const isNext = index === next;
      const isHidden = !isActive && !isPrevious && !isNext;

      button.classList.toggle('slot-active', isActive);
      button.classList.toggle('slot-prev', isPrevious);
      button.classList.toggle('slot-next', isNext);
      button.classList.toggle('slot-hidden', isHidden);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
      button.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
      button.tabIndex = isHidden ? -1 : 0;
    });

    dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
    carousel?.setAttribute('aria-activedescendant', clubButtons[activeIndex]?.id || '');
  }

  function renderFixedTeam(id, official) {
    const club = clubById(id);
    if (!club) return;

    fixedName.textContent = club.name;
    fixedVerse.textContent = club.verse;
    fixedKicker.textContent = official ? 'YOUR TEAM' : 'YOUR PREFERRED TEAM';
    fixedBadge.textContent = official ? 'OFFICIAL' : 'TOP 1 PREFERENCE';
    fixedCard.classList.toggle('official', official);
    changeTeam.hidden = official;
  }

  function renderState() {
    const showFixed = Boolean(assignedClub || (savedClub && !changingPreference));
    browse.hidden = showFixed;
    fixed.hidden = !showFixed;

    if (assignedClub) {
      heading.textContent = 'YOUR TEAM.';
      renderFixedTeam(assignedClub, true);
    } else if (savedClub && !changingPreference) {
      heading.textContent = 'YOUR PREFERRED TEAM.';
      renderFixedTeam(savedClub, false);
    } else {
      heading.textContent = savedClub ? 'CHANGE YOUR TEAM.' : 'SELECT YOUR TEAM.';
      renderCarousel();
    }
  }

  function selectIndex(index) {
    if (assignedClub) return;
    activeIndex = normalizeIndex(index);
    setStatus('');
    renderCarousel();
  }

  function openConfirmation(id) {
    if (!id || assignedClub || loading) return;
    pendingClub = id;
    const name = clubName(id);
    confirmName.textContent = name;
    confirmCopyName.textContent = name;
    confirm.classList.add('open');
    confirm.setAttribute('aria-hidden', 'false');
    confirmSave.disabled = false;
    confirmSave.textContent = id === savedClub ? 'KEEP AS MY TOP 1' : 'YES, MAKE THIS MY TOP 1';
  }

  function closeConfirmation() {
    confirm.classList.remove('open');
    confirm.setAttribute('aria-hidden', 'true');
    pendingClub = null;
  }

  async function loadState({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    if (!quiet) setStatus('');
    try {
      const data = await api('/api/real-play/3v3/me');
      assignedClub = data.assignedClub || null;
      savedClub = data.preferredClub || null;
      activeIndex = clubIndex(assignedClub || savedClub || CLUBS[0].id);
      if (assignedClub) changingPreference = false;
    } catch (error) {
      if (error.status === 401) {
        closeView();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      if (!quiet) setStatus(error.message || 'Could not load your 3v3 team status.', 'error');
    } finally {
      loading = false;
      renderState();
    }
  }

  async function savePreference() {
    if (!pendingClub || assignedClub || loading) return;
    const club = pendingClub;
    loading = true;
    confirmSave.disabled = true;
    confirmSave.textContent = 'SAVING…';
    setStatus('');

    try {
      const data = await api('/api/real-play/3v3/preference', {
        method: 'PUT',
        body: { club },
      });
      savedClub = data.preferredClub || club;
      assignedClub = data.assignedClub || null;
      activeIndex = clubIndex(assignedClub || savedClub);
      changingPreference = false;
      closeConfirmation();
    } catch (error) {
      setStatus(error.message || 'Could not save your preferred team.', 'error');
      confirmSave.disabled = false;
      confirmSave.textContent = 'TRY AGAIN';
    } finally {
      loading = false;
      renderState();
    }
  }

  function refreshIfOpen() {
    if (!view.classList.contains('open') || !token()) return;
    if (!loading) loadState({ quiet: true });
    if (!sessionLoading) refreshSession({ quiet: true });
  }

  function startSessionPolling() {
    if (sessionTimer) window.clearInterval(sessionTimer);
    sessionTimer = window.setInterval(() => {
      if (view.classList.contains('open')) refreshSession({ quiet: true });
    }, 5000);
  }

  function openView() {
    if (!token()) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    changingPreference = false;
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-3v3-open');
    view.scrollTop = 0;
    loadState();
    refreshSession();
  }

  function closeView() {
    closeConfirmation();
    changingPreference = false;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-3v3-open');
  }

  clubButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (Date.now() < suppressClickUntil || assignedClub) return;
      if (index !== activeIndex) {
        selectIndex(index);
        return;
      }
      openConfirmation(button.dataset.rpThreeClub || null);
    });
  });

  carousel?.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartX = event.clientX;
  });

  carousel?.addEventListener('pointerup', (event) => {
    if (pointerStartX === null || assignedClub) return;
    const deltaX = event.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(deltaX) < 34) return;
    suppressClickUntil = Date.now() + 320;
    selectIndex(activeIndex + (deltaX < 0 ? 1 : -1));
  });

  carousel?.addEventListener('pointercancel', () => {
    pointerStartX = null;
  });

  carousel?.addEventListener('keydown', (event) => {
    if (assignedClub) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectIndex(activeIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectIndex(activeIndex + 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === carousel) {
      event.preventDefault();
      openConfirmation(CLUBS[activeIndex].id);
    }
  });

  view.querySelector('[data-rp-team-prev]')?.addEventListener('click', () => selectIndex(activeIndex - 1));
  view.querySelector('[data-rp-team-next]')?.addEventListener('click', () => selectIndex(activeIndex + 1));
  changeTeam?.addEventListener('click', () => {
    if (!savedClub || assignedClub) return;
    changingPreference = true;
    activeIndex = clubIndex(savedClub);
    setStatus('');
    renderState();
  });
  view.querySelector('[data-rp-team-confirm-close]')?.addEventListener('click', closeConfirmation);
  confirmSave?.addEventListener('click', savePreference);
  confirm?.addEventListener('click', (event) => {
    if (event.target === confirm) closeConfirmation();
  });
  sessionAction?.addEventListener('click', secureSpot);
  sessionCancel?.addEventListener('click', cancelSpot);

  stage.querySelector('[data-rp-enter-3v3]')?.addEventListener('click', openView);
  back?.addEventListener('click', closeView);

  window.addEventListener('focus', refreshIfOpen);
  window.addEventListener('pageshow', refreshIfOpen);
  window.addEventListener('realplay:3v3-assignment', refreshIfOpen);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfOpen();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (confirm.classList.contains('open')) closeConfirmation();
    else if (view.classList.contains('open')) closeView();
  });

  startSessionPolling();
})();