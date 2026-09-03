(() => {
  if (window.__realPlayMainMenuInstalled) return;
  window.__realPlayMainMenuInstalled = true;

  const app = document.querySelector('[data-rp-app]');
  const lobby = document.querySelector('[data-rp-lobby]');
  const playerStrip = lobby?.querySelector('.rp-player-strip');
  if (!app || !lobby || !playerStrip || lobby.querySelector('[data-rp-main-menu]')) return;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  const menu = document.createElement('section');
  menu.className = 'rp-main-menu';
  menu.dataset.rpMainMenu = 'true';
  menu.setAttribute('aria-label', 'Real Play main menu');
  menu.innerHTML = `
    <div class="rp-main-menu-brand" aria-hidden="true">
      <strong>REAL PLAY</strong>
      <span>BASKETBALL</span>
      <i></i>
      <small>LESS SCREEN. REAL POINTS.</small>
    </div>

    <div class="rp-main-menu-list" data-rp-main-menu-list aria-label="Choose where to go" tabindex="0">
      <button id="rp-main-choice-3v3" class="rp-main-menu-item" type="button" data-rp-main-action="3v3">
        <small>BETA SEASON · LIVE</small>
        <strong>3V3</strong>
        <span>FOUNDING FOUR · RACE TO 8</span>
      </button>

      <button id="rp-main-choice-5v5" class="rp-main-menu-item" type="button" data-rp-main-action="5v5">
        <small>COMING SOON</small>
        <strong>5V5</strong>
        <span>UNDER CONSTRUCTION</span>
      </button>

      <button id="rp-main-choice-updates" class="rp-main-menu-item" type="button" data-rp-main-action="updates">
        <small>REAL PLAY</small>
        <strong>UPDATES</strong>
        <span>SCHEDULES · RESULTS · ANNOUNCEMENTS</span>
      </button>

      <button id="rp-main-choice-world" class="rp-main-menu-item" type="button" data-rp-main-action="world">
        <small>COMMUNITY</small>
        <strong>WORLD</strong>
        <span>PLAYERS · COMMUNITY · CHAT</span>
      </button>
    </div>

    <p class="rp-main-menu-foot">SWIPE TO CHOOSE · TAP CENTER TO ENTER</p>
  `;
  playerStrip.insertAdjacentElement('afterend', menu);

  const notice = document.createElement('div');
  notice.className = 'rp-main-notice';
  notice.dataset.rpMainNotice = 'true';
  notice.setAttribute('aria-hidden', 'true');
  notice.innerHTML = `
    <section class="rp-main-notice-card" role="dialog" aria-modal="true" aria-labelledby="rp-main-notice-title">
      <small data-rp-main-notice-kicker>REAL PLAY</small>
      <h2 id="rp-main-notice-title" data-rp-main-notice-title>COMING SOON.</h2>
      <p data-rp-main-notice-copy></p>
      <button type="button" data-rp-main-notice-close>GOT IT</button>
    </section>
  `;
  document.body.appendChild(notice);

  const list = menu.querySelector('[data-rp-main-menu-list]');
  const items = [...menu.querySelectorAll('[data-rp-main-action]')];
  const noticeKicker = notice.querySelector('[data-rp-main-notice-kicker]');
  const noticeTitle = notice.querySelector('[data-rp-main-notice-title]');
  const noticeCopy = notice.querySelector('[data-rp-main-notice-copy]');
  let activeIndex = 0;
  let pointerStartY = null;
  let suppressClickUntil = 0;
  let lastWheelAt = 0;

  function normalizeIndex(index) {
    return (index + items.length) % items.length;
  }

  function renderSelector() {
    const prevIndex = normalizeIndex(activeIndex - 1);
    const nextIndex = normalizeIndex(activeIndex + 1);

    items.forEach((item, index) => {
      const active = index === activeIndex;
      const previous = index === prevIndex;
      const next = index === nextIndex;
      item.classList.toggle('slot-active', active);
      item.classList.toggle('slot-prev', previous);
      item.classList.toggle('slot-next', next);
      item.classList.toggle('slot-hidden', !active && !previous && !next);
      item.setAttribute('aria-current', active ? 'true' : 'false');
      item.setAttribute('aria-hidden', !active && !previous && !next ? 'true' : 'false');
      item.tabIndex = active || previous || next ? 0 : -1;
    });

    list?.setAttribute('aria-activedescendant', items[activeIndex]?.id || '');
  }

  function selectIndex(index) {
    activeIndex = normalizeIndex(index);
    renderSelector();
  }

  function moveSelection(direction) {
    selectIndex(activeIndex + direction);
  }

  function showNotice({ kicker, title, copy }) {
    noticeKicker.textContent = kicker;
    noticeTitle.textContent = title;
    noticeCopy.textContent = copy;
    notice.classList.add('open');
    notice.setAttribute('aria-hidden', 'false');
  }

  function closeNotice() {
    notice.classList.remove('open');
    notice.setAttribute('aria-hidden', 'true');
  }

  function openThreeVThree(attempt = 0) {
    const trigger = document.querySelector('[data-rp-enter-3v3]');
    if (trigger) {
      trigger.click();
      return;
    }
    if (attempt < 8) {
      window.setTimeout(() => openThreeVThree(attempt + 1), 100);
      return;
    }
    showNotice({
      kicker: '3V3',
      title: 'LOADING REAL PLAY 3V3.',
      copy: 'The Beta Season game layer is still loading. Try 3V3 again in a moment.',
    });
  }

  function openWorld() {
    const trigger = document.querySelector('[data-rp-nav="world"], [data-rp-action="world"]');
    if (trigger) {
      trigger.click();
      return;
    }
    showNotice({
      kicker: 'REAL PLAY WORLD',
      title: 'WORLD IS LOADING.',
      copy: 'The community layer is still loading. Try World again in a moment.',
    });
  }

  function enterSelected() {
    const action = items[activeIndex]?.dataset.rpMainAction;
    if (action === '3v3') {
      openThreeVThree();
    } else if (action === '5v5') {
      showNotice({
        kicker: 'REAL PLAY 5V5',
        title: 'UNDER CONSTRUCTION.',
        copy: 'Full-court 5V5 is visible in the Real Play roadmap, but 3V3 remains the active Beta Season format for now.',
      });
    } else if (action === 'updates') {
      showNotice({
        kicker: 'REAL PLAY UPDATES',
        title: 'THE UPDATE CENTER.',
        copy: 'Official schedules, game results, club announcements and Beta Season changes will live here as Real Play grows.',
      });
    } else if (action === 'world') {
      openWorld();
    }
  }

  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      if (Date.now() < suppressClickUntil) return;
      if (index !== activeIndex) {
        selectIndex(index);
        return;
      }
      enterSelected();
    });
  });

  list?.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartY = event.clientY;
  });

  list?.addEventListener('pointerup', (event) => {
    if (pointerStartY === null) return;
    const deltaY = event.clientY - pointerStartY;
    pointerStartY = null;
    if (Math.abs(deltaY) < 28) return;
    suppressClickUntil = Date.now() + 350;
    moveSelection(deltaY < 0 ? 1 : -1);
  });

  list?.addEventListener('pointercancel', () => {
    pointerStartY = null;
  });

  list?.addEventListener('wheel', (event) => {
    const now = Date.now();
    if (Math.abs(event.deltaY) < 12 || now - lastWheelAt < 220) return;
    lastWheelAt = now;
    event.preventDefault();
    moveSelection(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  list?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (event.target === list) {
        event.preventDefault();
        enterSelected();
      }
    }
  });

  notice.querySelector('[data-rp-main-notice-close]')?.addEventListener('click', closeNotice);
  notice.addEventListener('click', (event) => {
    if (event.target === notice) closeNotice();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && notice.classList.contains('open')) closeNotice();
  });

  function pick(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  async function refreshOvr() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const state = await response.json().catch(() => ({}));
      const rating = lobby.querySelector('[data-rp-ovr]');
      const ratingLabel = rating?.parentElement?.querySelector('span');
      const value = pick(
        state?.ovr,
        state?.career?.ovr,
        state?.careerSummary?.ovr,
        state?.career_summary?.ovr,
        state?.profile?.ovr,
        state?.profile?.rating
      );
      if (!rating) return;
      if (value !== undefined && value !== null && value !== '') {
        rating.textContent = `${value} OVR`;
        if (ratingLabel) ratingLabel.textContent = 'BETA SEASON';
      } else {
        rating.textContent = 'UNRANKED';
        if (ratingLabel) ratingLabel.textContent = 'BETA SEASON';
      }
    } catch (_error) {
      // Keep the menu usable if player ranking is temporarily unavailable.
    }
  }

  renderSelector();
  refreshOvr();
  window.addEventListener('focus', refreshOvr);
})();