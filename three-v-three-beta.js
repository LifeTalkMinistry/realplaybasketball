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
        <button class="rp-3v3-back" type="button" aria-label="Back to game formats" data-rp-3v3-back>←</button>
        <div class="rp-3v3-brand"><strong>REAL PLAY 3V3</strong><span>BETA SEASON</span></div>
        <div class="rp-3v3-topmark">3V3</div>
      </header>

      <section class="rp-3v3-hero">
        <p class="rp-3v3-eyebrow">THE FOUNDING FOUR</p>
        <h1>CHOOSE YOUR CLUB.</h1>
        <p>Choose the club you would like to represent. During Beta Season, Real Play confirms the final team designation.</p>
      </section>

      <section class="rp-3v3-player-state" data-rp-3v3-player-state>
        <div class="rp-3v3-player-state-head">
          <div><small>YOUR 3V3 STATUS</small><strong data-rp-3v3-state-title>FREE AGENT</strong></div>
          <span class="rp-3v3-state-pill" data-rp-3v3-state-pill>BETA</span>
        </div>
        <p data-rp-3v3-state-copy>Select your preferred club below. Your final assignment will be confirmed by Real Play.</p>
      </section>

      <div class="rp-3v3-section-head">
        <div><span>REAL PLAY CLUBS</span><h2>Preferred Club</h2></div>
        <span>FINAL ASSIGNMENT: ADMIN</span>
      </div>

      <div class="rp-3v3-clubs" data-rp-3v3-clubs>
        ${CLUBS.map((club) => `
          <button class="rp-3v3-club" type="button" data-rp-three-club="${club.id}">
            <strong>${club.name}</strong>
            <span>${club.verse}</span>
          </button>
        `).join('')}
      </div>

      <button class="rp-3v3-save" type="button" data-rp-3v3-save disabled>SAVE PREFERRED CLUB <span>→</span></button>
      <p class="rp-3v3-status" data-rp-3v3-status aria-live="polite"></p>

      <div class="rp-3v3-format">
        <div><small>BETA CONTEST FORMAT</small><strong>4 CLUBS · 2 SEMIFINALS · 1 FINAL</strong></div>
        <b>RACE TO 8</b>
      </div>
    </div>
  `;
  document.body.appendChild(view);

  const back = view.querySelector('[data-rp-3v3-back]');
  const clubButtons = [...view.querySelectorAll('[data-rp-three-club]')];
  const save = view.querySelector('[data-rp-3v3-save]');
  const status = view.querySelector('[data-rp-3v3-status]');
  const playerState = view.querySelector('[data-rp-3v3-player-state]');
  const stateTitle = view.querySelector('[data-rp-3v3-state-title]');
  const statePill = view.querySelector('[data-rp-3v3-state-pill]');
  const stateCopy = view.querySelector('[data-rp-3v3-state-copy]');

  let selectedClub = null;
  let assignedClub = null;
  let savedClub = null;
  let loading = false;

  function clubName(id) {
    return CLUBS.find((club) => club.id === id)?.name || '';
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.classList.toggle('success', type === 'success');
    status.classList.toggle('error', type === 'error');
  }

  function render() {
    const locked = Boolean(assignedClub);
    clubButtons.forEach((button) => {
      const id = button.dataset.rpThreeClub;
      const selected = id === (assignedClub || selectedClub);
      button.classList.toggle('selected', selected);
      button.classList.toggle('assigned', id === assignedClub);
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(selected));
    });

    if (assignedClub) {
      playerState.classList.add('assigned');
      stateTitle.textContent = clubName(assignedClub);
      statePill.textContent = 'ASSIGNED';
      stateCopy.textContent = `Real Play has confirmed your Beta Season club. You are representing ${clubName(assignedClub)}.`;
      save.disabled = true;
      save.innerHTML = 'ASSIGNMENT CONFIRMED <span>✓</span>';
      return;
    }

    playerState.classList.remove('assigned');
    stateTitle.textContent = savedClub ? 'PREFERENCE SAVED' : 'FREE AGENT';
    statePill.textContent = savedClub ? 'PENDING' : 'BETA';
    stateCopy.textContent = savedClub
      ? `${clubName(savedClub)} is your preferred club. Final team designation is still confirmed by Real Play.`
      : 'Select your preferred club below. Your final assignment will be confirmed by Real Play.';
    save.disabled = loading || !selectedClub || selectedClub === savedClub;
    save.innerHTML = savedClub && selectedClub === savedClub
      ? 'PREFERENCE SAVED <span>✓</span>'
      : 'SAVE PREFERRED CLUB <span>→</span>';
  }

  async function loadState() {
    selectedClub = null;
    assignedClub = null;
    savedClub = null;
    loading = true;
    setStatus('LOADING YOUR 3V3 STATUS…');
    render();
    try {
      const data = await api('/api/real-play/3v3/me');
      assignedClub = data.assignedClub || null;
      savedClub = data.preferredClub || null;
      selectedClub = assignedClub || savedClub || null;
      setStatus(assignedClub ? 'Your club assignment is confirmed.' : '', assignedClub ? 'success' : '');
    } catch (error) {
      if (error.status === 401) {
        closeView();
        document.querySelector('[data-auth-open]')?.click();
        return;
      }
      setStatus(error.message || 'Could not load your 3v3 club status.', 'error');
    } finally {
      loading = false;
      render();
    }
  }

  async function savePreference() {
    if (!selectedClub || assignedClub || loading) return;
    loading = true;
    save.disabled = true;
    save.innerHTML = 'SAVING… <span>·</span>';
    setStatus('');
    try {
      const data = await api('/api/real-play/3v3/preference', {
        method: 'PUT',
        body: { club: selectedClub },
      });
      savedClub = data.preferredClub || selectedClub;
      assignedClub = data.assignedClub || null;
      selectedClub = assignedClub || savedClub;
      setStatus(data.message || 'Preferred club saved. Final assignment is confirmed by Real Play.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not save your preferred club.', 'error');
    } finally {
      loading = false;
      render();
    }
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
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-3v3-open');
  }

  clubButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (assignedClub) return;
      selectedClub = button.dataset.rpThreeClub || null;
      setStatus('');
      render();
    });
  });

  stage.querySelector('[data-rp-enter-3v3]')?.addEventListener('click', openView);
  back?.addEventListener('click', closeView);
  save?.addEventListener('click', savePreference);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && view.classList.contains('open')) closeView();
  });
})();
