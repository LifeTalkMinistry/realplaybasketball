(() => {
  if (window.__realPlayFuture4v4CardCleanupInstalled) return;
  window.__realPlayFuture4v4CardCleanupInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';
  const VIEW_ATTR = 'data-rp-4v4-static-view';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS', verse: 'Proverbs 28:1', art: 'assets/3v3/clubs/lions-logo.png' },
    { id: 'valiant', name: 'VALIANT', verse: 'Joshua 1:9', art: 'assets/3v3/clubs/valiant-logo.png' },
    { id: 'watchmen', name: 'WATCHMEN', verse: 'Isaiah 62:6', art: 'assets/3v3/clubs/watchmen-logo.png' },
    { id: 'conquerors', name: 'CONQUERORS', verse: 'Romans 8:37', art: 'assets/3v3/clubs/conquerors-logo.png' },
  ];

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
      const error = new Error(data?.message || data?.error || 'Real Play could not complete that request.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function validRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
  }

  function validNumber(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  function validOvr(value) {
    const ovr = Number(value);
    return Number.isFinite(ovr) ? Math.round(ovr) : null;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4{
        min-height:108px!important;padding:18px!important;display:flex!important;
        flex-direction:column!important;justify-content:center!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>strong{
        display:block!important;margin:0!important;font-size:1.08rem!important;line-height:1.05!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4 .rp-home-4v4-explore{margin-top:16px!important}
      body.rp-4v4-static-open{overflow:hidden!important}
      body.rp-4v4-static-open .rp-bottom-nav,body.rp-4v4-static-open .rp-simple-nav{display:none!important}
      .rp-4v4-static-view{z-index:760!important}
      .rp-4v4-static-view .rp-3v3-brand span{color:var(--rp-cyan)}
      .rp-4v4-static-view .rp-3v3-status{min-height:18px}

      .rp-4v4-preference-panel{
        margin-bottom:28px!important;padding:12px 12px 14px!important;
        border:1px solid rgba(79,218,255,.12)!important;border-radius:20px!important;
        background:linear-gradient(180deg,rgba(4,12,21,.92),rgba(3,8,14,.96))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035)!important;
      }
      .rp-4v4-preference-action{
        width:100%!important;min-height:46px!important;margin:0!important;padding:0 14px!important;cursor:pointer!important;
        border:1px solid rgba(84,219,255,.2)!important;border-radius:14px!important;
        color:#eefaff!important;background:#091727!important;
        font-family:var(--rp-display,Arial,sans-serif)!important;font-size:.72rem!important;
        font-style:italic!important;font-weight:1000!important;letter-spacing:.035em!important;
        line-height:1!important;text-transform:uppercase!important;
        transition:transform .16s ease,border-color .16s ease,background .16s ease!important;
      }
      .rp-4v4-preference-action::before,.rp-4v4-preference-action::after{display:none!important;content:none!important}
      .rp-4v4-preference-action:hover:not(:disabled){border-color:rgba(84,219,255,.52)!important;background:#0b1d31!important}
      .rp-4v4-preference-action:active:not(:disabled){transform:scale(.985)}
      .rp-4v4-preference-action.is-selected{
        color:#7ce8ff!important;border-color:rgba(84,219,255,.4)!important;
        background:linear-gradient(180deg,rgba(17,53,75,.96),rgba(8,29,44,.98))!important;
      }
      .rp-4v4-preference-action:disabled{cursor:default!important;opacity:.78!important}
      .rp-4v4-preference-note{
        margin:8px 2px 12px;color:#637a8d;font-size:.46rem;font-weight:900;letter-spacing:.085em;
        line-height:1.35;text-align:center;text-transform:uppercase;
      }
      .rp-4v4-preference-board{
        overflow:hidden;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(1,7,12,.72);
      }
      .rp-4v4-preference-board-head{
        display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px 9px;
        border-bottom:1px solid rgba(255,255,255,.065);
      }
      .rp-4v4-preference-board-head small{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b9bac;
        font-size:.48rem;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;
      }
      .rp-4v4-preference-board-head b{
        flex:none;min-width:24px;height:22px;display:grid;place-items:center;padding:0 7px;border-radius:999px;
        color:#6ce4ff;background:rgba(75,218,255,.09);font-family:var(--rp-display,Arial,sans-serif);
        font-size:.55rem;font-style:italic;font-weight:1000;
      }
      .rp-4v4-preference-list{display:grid}
      .rp-4v4-preference-row{
        display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:42px;padding:8px 12px;
        border-bottom:1px solid rgba(255,255,255,.055);
      }
      .rp-4v4-preference-row:last-child{border-bottom:0}
      .rp-4v4-preference-player{min-width:0;display:flex;align-items:baseline;gap:6px}
      .rp-4v4-preference-player strong{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f1f7fb;
        font-family:var(--rp-display,Arial,sans-serif);font-size:.65rem;font-style:italic;font-weight:1000;text-transform:uppercase;
      }
      .rp-4v4-preference-player span{flex:none;color:#62768a;font-size:.48rem;font-weight:900}
      .rp-4v4-preference-standing{
        flex:none;color:#90a6b8;font-family:var(--rp-display,Arial,sans-serif);font-size:.56rem;font-style:italic;font-weight:1000;
        text-align:right;white-space:nowrap;text-transform:uppercase;
      }
      .rp-4v4-preference-standing.is-ranked{color:#74e6ff}
      .rp-4v4-preference-empty,.rp-4v4-preference-loading{
        margin:0;padding:18px 12px;color:#65788a;font-size:.54rem;font-weight:850;letter-spacing:.045em;
        line-height:1.45;text-align:center;text-transform:uppercase;
      }
      .rp-4v4-preference-loading{color:#86a8bd}
      .rp-4v4-preference-error{color:#ff8e9a!important}
      @media(max-width:420px){
        .rp-4v4-preference-panel{margin-left:10px!important;margin-right:10px!important;padding:10px 10px 12px!important;border-radius:18px!important}
        .rp-4v4-preference-row{gap:8px;min-height:40px;padding:8px 10px}
        .rp-4v4-preference-player strong{font-size:.61rem}
        .rp-4v4-preference-standing{font-size:.52rem}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCard() {
    installStyle();
    const card = document.querySelector('[data-rp-home-future-4v4="true"]') || document.querySelector('.rp-home-coming-card.is-4v4');
    if (!card) return false;
    card.querySelector(':scope > small')?.remove();
    card.querySelector(':scope > p')?.remove();
    card.querySelector(':scope > .rp-home-4v4-path')?.remove();
    const title = card.querySelector(':scope > strong');
    if (title && title.textContent.trim() !== '4V4 LEAGUE') title.textContent = '4V4 LEAGUE';
    const action = card.querySelector('.rp-home-4v4-explore');
    if (action) {
      if (action.textContent.trim() !== 'JOIN A TEAM NOW') action.textContent = 'JOIN A TEAM NOW';
      if (action.getAttribute('aria-label') !== 'Join a team now') action.setAttribute('aria-label', 'Join a team now');
    }
    return Boolean(title && action);
  }

  function closeRoadmap() {
    const roadmap = document.querySelector('[data-rp-home-coming-backdrop]');
    if (roadmap) roadmap.hidden = true;
    document.body.classList.remove('rp-home-coming-open');
    const oldPreview = document.querySelector('[data-rp-home-future-4v4-preview]');
    if (oldPreview) oldPreview.hidden = true;
    document.body.classList.remove('rp-home-team-preview-open');
  }

  function ensureView() {
    let view = document.querySelector(`[${VIEW_ATTR}]`);
    if (view) return view;

    view = document.createElement('section');
    view.className = 'rp-3v3-view rp-4v4-static-view';
    view.setAttribute(VIEW_ATTR, 'true');
    view.setAttribute('aria-hidden', 'true');
    view.innerHTML = `
      <div class="rp-3v3-shell">
        <header class="rp-3v3-topbar">
          <button class="rp-3v3-back" type="button" aria-label="Back to Home" data-rp-4v4-static-back>←</button>
          <div class="rp-3v3-brand"><strong>REAL PLAY 4V4</strong><span>TEAM FORMATION</span></div>
          <div class="rp-3v3-topmark">4V4</div>
        </header>
        <section class="rp-3v3-select-head"><h1>SELECT YOUR TEAM.</h1></section>
        <div data-rp-4v4-browse>
          <section class="rp-3v3-team-picker" aria-label="Choose a Real Play team">
            <button class="rp-team-arrow rp-team-arrow-left" type="button" aria-label="Previous team" data-rp-4v4-prev>‹</button>
            <div class="rp-team-carousel" data-rp-4v4-carousel tabindex="0" aria-live="polite">
              ${CLUBS.map((club, index) => `
                <button class="rp-team-card has-club-art club-${club.id}" id="rp-4v4-team-${club.id}" type="button" data-rp-4v4-card="${index}" data-rp-three-club="${club.id}">
                  <small>REAL PLAY CLUB</small>
                  <img class="rp-team-card-logo" src="${club.art}" alt="${club.name} club logo" decoding="async" loading="eager" />
                  <strong>${club.name}</strong>
                  <span>${club.verse}</span>
                </button>
              `).join('')}
            </div>
            <button class="rp-team-arrow rp-team-arrow-right" type="button" aria-label="Next team" data-rp-4v4-next>›</button>
          </section>
          <div class="rp-team-dots" data-rp-4v4-dots aria-hidden="true">${CLUBS.map(() => '<i></i>').join('')}</div>
        </div>
        <p class="rp-3v3-status" data-rp-4v4-status></p>
        <section class="rp-3v3-session rp-4v4-preference-panel">
          <button class="rp-4v4-preference-action" type="button" data-rp-4v4-preference-action>I PREFER THIS TEAM</button>
          <p class="rp-4v4-preference-note">EARLY PREFERENCE · NOT AN OFFICIAL ROSTER</p>
          <div class="rp-4v4-preference-board">
            <div class="rp-4v4-preference-board-head">
              <small>WHO PREFERS <span data-rp-4v4-preference-team>LIONS</span></small>
              <b data-rp-4v4-preference-count>0</b>
            </div>
            <div class="rp-4v4-preference-list" data-rp-4v4-preference-list>
              <p class="rp-4v4-preference-loading">LOADING PLAYER PREFERENCES…</p>
            </div>
          </div>
        </section>
      </div>`;

    document.body.appendChild(view);

    const cards = [...view.querySelectorAll('[data-rp-4v4-card]')];
    const dots = [...view.querySelectorAll('[data-rp-4v4-dots] i')];
    const carousel = view.querySelector('[data-rp-4v4-carousel]');
    const status = view.querySelector('[data-rp-4v4-status]');
    const preferenceAction = view.querySelector('[data-rp-4v4-preference-action]');
    const preferenceTeam = view.querySelector('[data-rp-4v4-preference-team]');
    const preferenceCount = view.querySelector('[data-rp-4v4-preference-count]');
    const preferenceList = view.querySelector('[data-rp-4v4-preference-list]');
    let activeIndex = 0;
    let pointerStartX = null;
    let preferredClub = null;
    let preferencePlayers = [];
    let preferenceLoading = false;
    let preferenceLoaded = false;
    let preferenceSaving = false;
    let preferenceError = '';
    const normalize = (index) => (index + cards.length) % cards.length;

    function setStatus(message = '', type = '') {
      status.textContent = message;
      status.classList.toggle('success', type === 'success');
      status.classList.toggle('error', type === 'error');
    }

    function playerStanding(player) {
      const rank = validRank(player?.rank);
      if (rank) {
        const ovr = validOvr(player?.ovr);
        return { ranked: true, text: ovr === null ? `#${rank}` : `#${rank} · ${ovr} OVR` };
      }
      const games = Math.max(0, Math.min(5, Number(player?.verifiedGames ?? player?.games ?? 0) || 0));
      return { ranked: false, text: `UNRANKED · ${games}/5` };
    }

    function sortedClubPlayers(clubId) {
      return preferencePlayers
        .filter((player) => String(player?.preferredClub || '').toLowerCase() === clubId)
        .sort((left, right) => {
          const leftRank = validRank(left?.rank);
          const rightRank = validRank(right?.rank);
          if (leftRank && rightRank) return leftRank - rightRank;
          if (leftRank) return -1;
          if (rightRank) return 1;
          const gamesDiff = (Number(right?.verifiedGames ?? right?.games ?? 0) || 0) - (Number(left?.verifiedGames ?? left?.games ?? 0) || 0);
          if (gamesDiff) return gamesDiff;
          return String(left?.playerName || '').localeCompare(String(right?.playerName || ''));
        });
    }

    function renderPreferenceBoard() {
      const club = CLUBS[activeIndex];
      const players = sortedClubPlayers(club.id);
      preferenceTeam.textContent = club.name;
      preferenceCount.textContent = String(players.length);

      const selected = preferredClub === club.id;
      preferenceAction.classList.toggle('is-selected', selected);
      preferenceAction.disabled = preferenceSaving || selected;
      if (preferenceSaving) preferenceAction.textContent = 'SAVING…';
      else if (selected) preferenceAction.textContent = `${club.name} PREFERRED ✓`;
      else if (preferredClub) preferenceAction.textContent = `MAKE ${club.name} MY PREFERENCE`;
      else preferenceAction.textContent = `I PREFER ${club.name}`;

      if (preferenceLoading && !preferenceLoaded) {
        preferenceList.innerHTML = '<p class="rp-4v4-preference-loading">LOADING PLAYER PREFERENCES…</p>';
        return;
      }
      if (preferenceError && !preferenceLoaded) {
        preferenceList.innerHTML = `<p class="rp-4v4-preference-empty rp-4v4-preference-error">${escapeHtml(preferenceError)}</p>`;
        return;
      }
      if (!players.length) {
        preferenceList.innerHTML = '<p class="rp-4v4-preference-empty">NO PLAYER PREFERENCES YET · BE THE FIRST</p>';
        return;
      }

      preferenceList.innerHTML = players.map((player) => {
        const number = validNumber(player?.playerNumber);
        const standing = playerStanding(player);
        return `
          <div class="rp-4v4-preference-row">
            <div class="rp-4v4-preference-player">
              <strong>${escapeHtml(player?.playerName || 'REAL PLAY PLAYER')}</strong>
              ${number === null ? '' : `<span>#${number}</span>`}
            </div>
            <div class="rp-4v4-preference-standing${standing.ranked ? ' is-ranked' : ''}">${escapeHtml(standing.text)}</div>
          </div>`;
      }).join('');
    }

    async function loadPreferences({ silent = false } = {}) {
      if (!token()) {
        preferenceLoaded = true;
        preferenceLoading = false;
        preferenceError = '';
        preferencePlayers = [];
        renderPreferenceBoard();
        return;
      }
      if (preferenceLoading) return;
      preferenceLoading = true;
      if (!silent) preferenceError = '';
      renderPreferenceBoard();
      try {
        const data = await api('/api/real-play/4v4/me');
        preferredClub = String(data?.preferredClub || '').toLowerCase() || null;
        preferencePlayers = Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : [];
        preferenceLoaded = true;
        preferenceError = '';
      } catch (error) {
        preferenceError = error?.status === 404
          ? 'TEAM PREFERENCE SERVICE IS UPDATING · TRY AGAIN SHORTLY'
          : (error?.message || 'Could not load team preferences.');
      } finally {
        preferenceLoading = false;
        renderPreferenceBoard();
      }
    }

    async function savePreference() {
      const club = CLUBS[activeIndex];
      if (!token()) {
        setStatus('SIGN IN TO SAVE YOUR TEAM PREFERENCE.', 'error');
        return;
      }
      if (preferenceSaving || preferredClub === club.id) return;
      preferenceSaving = true;
      setStatus('');
      renderPreferenceBoard();
      try {
        const data = await api('/api/real-play/4v4/preference', {
          method: 'PUT',
          body: { club: club.id },
        });
        preferredClub = String(data?.preferredClub || club.id).toLowerCase();
        setStatus(`${club.name} SAVED AS YOUR EARLY TEAM PREFERENCE.`, 'success');
        await loadPreferences({ silent: true });
      } catch (error) {
        setStatus(error?.status === 404
          ? 'TEAM PREFERENCE SERVICE IS UPDATING · TRY AGAIN SHORTLY.'
          : (error?.message || 'Could not save your team preference.'), 'error');
      } finally {
        preferenceSaving = false;
        renderPreferenceBoard();
      }
    }

    function render(index = activeIndex) {
      activeIndex = normalize(index);
      const previous = normalize(activeIndex - 1);
      const next = normalize(activeIndex + 1);
      cards.forEach((card, cardIndex) => {
        const active = cardIndex === activeIndex;
        const prev = cardIndex === previous;
        const nextCard = cardIndex === next;
        const hidden = !active && !prev && !nextCard;
        card.classList.toggle('slot-active', active);
        card.classList.toggle('slot-prev', prev);
        card.classList.toggle('slot-next', nextCard);
        card.classList.toggle('slot-hidden', hidden);
        card.setAttribute('aria-current', active ? 'true' : 'false');
        card.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        card.tabIndex = hidden ? -1 : 0;
      });
      dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === activeIndex));
      carousel?.setAttribute('aria-activedescendant', cards[activeIndex]?.id || '');
      const club = CLUBS[activeIndex];
      view.dataset.rpActiveClub = club.id;
      setStatus(`${club.name} · ${club.verse}`);
      renderPreferenceBoard();
    }

    view.querySelector('[data-rp-4v4-prev]')?.addEventListener('click', () => render(activeIndex - 1));
    view.querySelector('[data-rp-4v4-next]')?.addEventListener('click', () => render(activeIndex + 1));
    cards.forEach((card, index) => card.addEventListener('click', () => { if (index !== activeIndex) render(index); }));
    preferenceAction?.addEventListener('click', savePreference);
    carousel?.addEventListener('pointerdown', (event) => {
      if (!(event.pointerType === 'mouse' && event.button !== 0)) pointerStartX = event.clientX;
    });
    carousel?.addEventListener('pointerup', (event) => {
      if (pointerStartX === null) return;
      const delta = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(delta) >= 34) render(activeIndex + (delta < 0 ? 1 : -1));
    });
    carousel?.addEventListener('pointercancel', () => { pointerStartX = null; });
    carousel?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); render(activeIndex - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); render(activeIndex + 1); }
    });
    view.querySelector('[data-rp-4v4-static-back]')?.addEventListener('click', closeView);
    view.__rpLoad4v4Preferences = loadPreferences;
    render(0);
    return view;
  }

  function openView() {
    closeRoadmap();
    const view = ensureView();
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-4v4-static-open');
    view.scrollTop = 0;
    view.__rpLoad4v4Preferences?.();
    window.setTimeout(() => view.querySelector('[data-rp-4v4-static-back]')?.focus({ preventScroll: true }), 0);
  }

  function closeView() {
    const view = document.querySelector(`[${VIEW_ATTR}]`);
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-4v4-static-open');
  }

  document.addEventListener('click', (event) => {
    const action = event.target?.closest?.('.rp-home-4v4-explore');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openView();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const view = document.querySelector(`[${VIEW_ATTR}].open`);
    if (!view) return;
    event.preventDefault();
    closeView();
  });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (cleanCard() || attempts >= 60) window.clearInterval(timer);
  }, 100);
})();