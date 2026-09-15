(() => {
  if (window.__realPlayFuture4v4CardCleanupInstalled) return;
  window.__realPlayFuture4v4CardCleanupInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';
  const VIEW_ATTR = 'data-rp-4v4-static-view';
  const CLUBS = [
    { id: 'lions', name: 'LIONS', verse: 'Proverbs 28:1', art: 'assets/3v3/clubs/lions-logo.png' },
    { id: 'valiant', name: 'VALIANT', verse: 'Joshua 1:9', art: 'assets/3v3/clubs/valiant-logo.png' },
    { id: 'watchmen', name: 'WATCHMEN', verse: 'Isaiah 62:6', art: 'assets/3v3/clubs/watchmen-logo.png' },
    { id: 'conquerors', name: 'CONQUERORS', verse: 'Romans 8:37', art: 'assets/3v3/clubs/conquerors-logo.png' },
  ];

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
      .rp-4v4-static-view .rp-3v3-session{margin-bottom:28px}
      .rp-4v4-static-view .rp-3v3-session-action{cursor:default}
      .rp-4v4-static-view .rp-3v3-status{min-height:18px}
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
        <section class="rp-3v3-session">
          <div class="rp-3v3-session-head">
            <div><small>FUTURE 4V4 LEAGUE</small><strong data-rp-4v4-session-title>TEAM FORMATION PREVIEW</strong><span>4 ON COURT · MAX 5-PLAYER ROSTER</span></div>
            <b data-rp-4v4-session-count>—</b>
          </div>
          <p class="rp-3v3-roster-needed" data-rp-4v4-roster-needed>Choose one of the original Real Play teams.</p>
          <button class="rp-3v3-session-action" type="button" disabled>FORMATION OPENS SOON</button>
        </section>
      </div>`;

    document.body.appendChild(view);

    const cards = [...view.querySelectorAll('[data-rp-4v4-card]')];
    const dots = [...view.querySelectorAll('[data-rp-4v4-dots] i')];
    const carousel = view.querySelector('[data-rp-4v4-carousel]');
    const sessionTitle = view.querySelector('[data-rp-4v4-session-title]');
    const sessionCount = view.querySelector('[data-rp-4v4-session-count]');
    const rosterNeeded = view.querySelector('[data-rp-4v4-roster-needed]');
    const status = view.querySelector('[data-rp-4v4-status]');
    let activeIndex = 0;
    let pointerStartX = null;
    const normalize = (index) => (index + cards.length) % cards.length;

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
      sessionTitle.textContent = `${club.name} · 4V4 TEAM`;
      sessionCount.textContent = `${activeIndex + 1}/4`;
      rosterNeeded.textContent = `${club.name} remains one of the original Real Play clubs for future 4V4 team formation.`;
      status.textContent = `${club.name} · ${club.verse}`;
    }

    view.querySelector('[data-rp-4v4-prev]')?.addEventListener('click', () => render(activeIndex - 1));
    view.querySelector('[data-rp-4v4-next]')?.addEventListener('click', () => render(activeIndex + 1));
    cards.forEach((card, index) => card.addEventListener('click', () => { if (index !== activeIndex) render(index); }));
    carousel?.addEventListener('pointerdown', (event) => { if (!(event.pointerType === 'mouse' && event.button !== 0)) pointerStartX = event.clientX; });
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
