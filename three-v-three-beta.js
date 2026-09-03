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
        <p>THE FOUNDING FOUR</p>
        <h1>SELECT YOUR TEAM.</h1>
        <span>Choose the team you would most like to represent this Beta Season.</span>
      </section>

      <section class="rp-3v3-team-picker" aria-label="Choose your preferred Real Play team">
        <button class="rp-team-arrow rp-team-arrow-left" type="button" aria-label="Previous team" data-rp-team-prev>‹</button>
        <div class="rp-team-carousel" data-rp-team-carousel tabindex="0" aria-live="polite">
          ${CLUBS.map((club) => `
            <button class="rp-team-card" id="rp-team-${club.id}" type="button" data-rp-three-club="${club.id}">
              <small>REAL PLAY CLUB</small>
              <strong>${club.name}</strong>
              <span>${club.verse}</span>
              <em data-rp-team-badge></em>
            </button>
          `).join('')}
        </div>
        <button class="rp-team-arrow rp-team-arrow-right" type="button" aria-label="Next team" data-rp-team-next>›</button>
      </section>

      <div class="rp-team-dots" data-rp-team-dots aria-hidden="true">
        ${CLUBS.map(() => '<i></i>').join('')}
      </div>

      <p class="rp-team-center-label" data-rp-team-center-label>TAP TEAM TO CHOOSE</p>
      <p class="rp-3v3-status" data-rp-3v3-status aria-live="polite"></p>

      <section class="rp-3v3-compact-state" data-rp-3v3-compact-state>
        <small>YOUR BETA STATUS</small>
        <strong data-rp-3v3-state-title>NO PREFERENCE YET</strong>
        <p data-rp-3v3-state-copy>Your #1 preference will be reviewed before final team assignment.</p>
      </section>

      <div class="rp-3v3-format">
        <div><small>BETA CONTEST FORMAT</small><strong>4 CLUBS · 2 SEMIFINALS · 1 FINAL</strong></div>
        <b>RACE TO 8</b>
      </div>
    </div>

    <div class="rp-team-confirm" data-rp-team-confirm aria-hidden="true">
      <section class="rp-team-confirm-card" role="dialog" aria-modal="true" aria-labelledby="rp-team-confirm-title">
        <small>TOP 1 PREFERENCE</small>
        <h2 id="rp-team-confirm-title">CHOOSE <span data-rp-confirm-team>TEAM</span>?</h2>
        <p>Do you want to make <strong data-rp-confirm-team-copy>this team</strong> your #1 preferred team for the Beta Season?</p>
        <div class="rp-team-confirm-note">
          <b>IMPORTANT</b>
          <span>This is your preference, not your final assignment. Real Play may still place you on a different team based on balance and Beta Season needs.</span>
        </div>
        <button class="rp-team-confirm-primary" type="button" data-rp-team-confirm-save>YES, MAKE THIS MY TOP 1</button>
        <button class="rp-team-confirm-secondary" type="button" data-rp-team-confirm-close>NOT YET</button>
      </section>
    </div>
  `;
  document.body.appendChild(view);

  const back = view.querySelector('[data-rp-3v3-back]');
  const carousel = view.querySelector('[data-rp-team-carousel]');
  const clubButtons = [...view.querySelectorAll('[data-rp-three-club]')];
  const dots = [...view.querySelectorAll('[data-rp-team-dots] i')];
  const status = view.querySelector('[data-rp-3v3-status]');
  const centerLabel = view.querySelector('[data-rp-team-center-label]');
  const stateTitle = view.querySelector('[data-rp-3v3-state-title]');
  const stateCopy = view.querySelector('[data-rp-3v3-state-copy]');
  const compactState = view.querySelector('[data-rp-3v3-compact-state]');
  const confirm = view.querySelector('[data-rp-team-confirm]');
  const confirmName = view.querySelector('[data-rp-confirm-team]');
  const confirmCopyName = view.querySelector('[data-rp-confirm-team-copy]');
  const confirmSave = view.querySelector('[data-rp-team-confirm-save]');

  let activeIndex = 0;
  let assignedClub = null;
  let savedClub = null;
  let loading = false;
  let pointerStartX = null;
  let pendingClub = null;
  let suppressClickUntil = 0;

  function clubName(id) {
    return CLUBS.find((club) => club.id === id)?.name || '';
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

  function renderCarousel() {
    const previous = normalizeIndex(activeIndex - 1);
    const next = normalizeIndex(activeIndex + 1);

    clubButtons.forEach((button, index) => {
      const id = button.dataset.rpThreeClub;
      const isActive = index === activeIndex;
      const isPrevious = index === previous;
      const isNext = index === next;
      const isHidden = !isActive && !isPrevious && !isNext;
      const badge = button.querySelector('[data-rp-team-badge]');

      button.classList.toggle('slot-active', isActive);
      button.classList.toggle('slot-prev', isPrevious);
      button.classList.toggle('slot-next', isNext);
      button.classList.toggle('slot-hidden', isHidden);
      button.classList.toggle('saved', id === savedClub);
      button.classList.toggle('assigned', id === assignedClub);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
      button.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
      button.tabIndex = isHidden ? -1 : 0;

      if (badge) {
        if (id === assignedClub) badge.textContent = 'OFFICIAL TEAM';
        else if (id === savedClub) badge.textContent = 'YOUR #1 PREFERENCE';
        else badge.textContent = '';
      }
    });

    dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
    carousel?.setAttribute('aria-activedescendant', clubButtons[activeIndex]?.id || '');

    const activeClub = CLUBS[activeIndex];
    if (assignedClub) {
      centerLabel.textContent = activeClub.id === assignedClub ? 'OFFICIAL TEAM CONFIRMED' : 'TEAM ASSIGNMENT LOCKED';
    } else if (activeClub.id === savedClub) {
      centerLabel.textContent = 'YOUR CURRENT #1 PREFERENCE';
    } else {
      centerLabel.textContent = 'TAP TEAM TO CHOOSE';
    }
  }

  function renderState() {
    compactState.classList.toggle('assigned', Boolean(assignedClub));

    if (assignedClub) {
      stateTitle.textContent = `${clubName(assignedClub)} · OFFICIAL`;
      stateCopy.textContent = `Real Play has confirmed your Beta Season team. You are officially representing ${clubName(assignedClub)}.`;
    } else if (savedClub) {
      stateTitle.textContent = `${clubName(savedClub)} · TOP 1 SAVED`;
      stateCopy.textContent = 'Your preference is saved. Final team assignment is still confirmed by Real Play.';
    } else {
      stateTitle.textContent = 'NO PREFERENCE YET';
      stateCopy.textContent = 'Your #1 preference will be reviewed before final team assignment.';
    }

    renderCarousel();
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
    if (!quiet) setStatus('LOADING YOUR 3V3 STATUS…');
    try {
      const data = await api('/api/real-play/3v3/me');
      assignedClub = data.assignedClub || null;
      savedClub = data.preferredClub || null;
      activeIndex = clubIndex(assignedClub || savedClub || CLUBS[0].id);
      if (assignedClub) setStatus(`Official team confirmed: ${clubName(assignedClub)}.`, 'success');
      else if (!quiet) setStatus('');
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
      closeConfirmation();
      setStatus(`${clubName(savedClub)} is now your #1 preferred team.`, 'success');
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
    if (!view.classList.contains('open') || !token() || loading) return;
    loadState({ quiet: true });
  }

  function openView() {
    if (!token()) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-3v3-open');
    view.scrollTop = 0;
    loadState();
  }

  function closeView() {
    closeConfirmation();
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
  view.querySelector('[data-rp-team-confirm-close]')?.addEventListener('click', closeConfirmation);
  confirmSave?.addEventListener('click', savePreference);
  confirm?.addEventListener('click', (event) => {
    if (event.target === confirm) closeConfirmation();
  });

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
})();
