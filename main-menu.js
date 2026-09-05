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

      <button id="rp-main-choice-ranking" class="rp-main-menu-item" type="button" data-rp-main-action="ranking">
        <small>OFFICIAL COMPETITIVE PLAY</small>
        <strong>OPEN RANKING</strong>
        <span>EAST VS WEST · BUILD YOUR OVR</span>
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

      <button id="rp-main-choice-profile" class="rp-main-menu-item" type="button" data-rp-main-action="profile">
        <small>YOUR IDENTITY</small>
        <strong>PROFILE</strong>
        <span>PLAYER CARD · STATS · HISTORY</span>
      </button>

      <button id="rp-main-choice-settings" class="rp-main-menu-item" type="button" data-rp-main-action="settings">
        <small>ACCOUNT</small>
        <strong>SETTINGS</strong>
        <span>MEMBERSHIP · COMMUNITY · LOG OUT</span>
      </button>
    </div>
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
  const noticeButton = notice.querySelector('[data-rp-main-notice-close]');

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const DRAG_STEP_PX = 172;
  const MAX_DRAG_ITEMS = 1.12;
  const PROJECTION_SECONDS = 0.18;
  const SPRING = { mass: 0.92, stiffness: 238, damping: 29 };

  let activeIndex = 0;
  let position = 0;
  let pointerId = null;
  let pointerStartY = 0;
  let dragStartPosition = 0;
  let pointerLastY = 0;
  let pointerLastAt = 0;
  let pointerVelocityY = 0;
  let dragDistance = 0;
  let suppressClickUntil = 0;
  let lastWheelAt = 0;
  let springFrame = 0;
  let springVelocity = 0;
  let springTarget = null;
  let dragFrame = 0;
  let pendingPointerY = null;
  let visualStepPx = 184;
  let noticeAction = 'close';

  menu.classList.add('rp-physics-menu');

  function normalizeIndex(index) {
    return ((index % items.length) + items.length) % items.length;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function wrappedDistance(index, currentPosition) {
    let distance = index - currentPosition;
    const half = items.length / 2;
    while (distance > half) distance -= items.length;
    while (distance < -half) distance += items.length;
    return distance;
  }

  function shortestDelta(fromIndex, toIndex) {
    let delta = toIndex - fromIndex;
    const half = items.length / 2;
    if (delta > half) delta -= items.length;
    if (delta < -half) delta += items.length;
    return delta;
  }

  function updateGeometry() {
    const height = list?.clientHeight || 430;
    visualStepPx = clamp(height * 0.43, 154, 224);
  }

  /* Hot path: compositor-only properties. No filters, gradients, shadows,
     CSS custom properties or class toggles are changed per frame. */
  function renderPhysics() {
    const step = visualStepPx;

    items.forEach((item, index) => {
      const distance = wrappedDistance(index, position);
      const absolute = Math.abs(distance);
      const centered = 1 - smoothstep(Math.min(absolute, 1));
      const beyond = clamp((absolute - 1) / 0.62, 0, 1);
      const alpha = absolute <= 1
        ? 0.20 + 0.80 * centered
        : 0.20 * (1 - smoothstep(beyond));
      const scale = absolute <= 1
        ? 0.60 + 0.40 * centered
        : 0.56 - 0.08 * smoothstep(beyond);
      const signed = Math.sign(distance || 1);
      const y = signed * step * Math.pow(absolute, 0.94);
      const rotate = clamp(-distance * 5.2, -7.5, 7.5);
      const visibleOpacity = absolute > 1.62 ? 0 : alpha;

      item.style.transform = `translate3d(-50%,-50%,0) translate3d(0,${y.toFixed(2)}px,0) rotateX(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      item.style.opacity = visibleOpacity.toFixed(4);
    });
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
    renderPhysics();
  }

  function cancelDragFrame() {
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
  }

  function applyPendingDrag() {
    dragFrame = 0;
    if (pointerId === null || pendingPointerY === null) return;
    const deltaFromStart = pendingPointerY - pointerStartY;
    const dragUnits = clamp(-deltaFromStart / DRAG_STEP_PX, -MAX_DRAG_ITEMS, MAX_DRAG_ITEMS);
    position = dragStartPosition + dragUnits;
    renderPhysics();
  }

  function scheduleDragRender(clientY) {
    pendingPointerY = clientY;
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(applyPendingDrag);
  }

  function flushPendingDrag() {
    if (!dragFrame) return;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    applyPendingDrag();
  }

  function cancelSpring() {
    if (springFrame) cancelAnimationFrame(springFrame);
    springFrame = 0;
    springTarget = null;
    menu.classList.remove('rp-physics-settling');
  }

  function commitSettled(target) {
    cancelSpring();
    cancelDragFrame();
    const previousIndex = activeIndex;
    activeIndex = normalizeIndex(Math.round(target));
    position = activeIndex;
    springVelocity = 0;
    pendingPointerY = null;
    menu.classList.remove('rp-physics-moving');
    renderSelector();

    if (previousIndex !== activeIndex) {
      try {
        if ('vibrate' in navigator) navigator.vibrate(8);
      } catch (_error) {
        // Haptics are optional and unsupported on some mobile browsers.
      }
    }
  }

  function springTo(target, initialVelocity = 0) {
    cancelSpring();

    if (reducedMotion?.matches) {
      commitSettled(target);
      return;
    }

    springTarget = target;
    springVelocity = clamp(initialVelocity, -7, 7);
    menu.classList.add('rp-physics-settling', 'rp-physics-moving');
    let lastAt = performance.now();

    const tick = (now) => {
      const dt = clamp((now - lastAt) / 1000, 0.001, 0.032);
      lastAt = now;

      const displacement = position - springTarget;
      const force = (-SPRING.stiffness * displacement) - (SPRING.damping * springVelocity);
      const acceleration = force / SPRING.mass;

      springVelocity += acceleration * dt;
      position += springVelocity * dt;
      renderPhysics();

      if (Math.abs(position - springTarget) < 0.0012 && Math.abs(springVelocity) < 0.012) {
        commitSettled(springTarget);
        return;
      }

      springFrame = requestAnimationFrame(tick);
    };

    springFrame = requestAnimationFrame(tick);
  }

  function moveSelection(direction) {
    if (!direction) return;
    springTo(activeIndex + (direction > 0 ? 1 : -1), direction * 1.1);
  }

  function selectIndex(index) {
    const normalized = normalizeIndex(index);
    const delta = shortestDelta(activeIndex, normalized);
    if (!delta) {
      springTo(activeIndex, 0);
      return;
    }
    springTo(activeIndex + clamp(delta, -1, 1), Math.sign(delta) * 0.9);
  }

  function showNotice({ kicker, title, copy, button = 'GOT IT', action = 'close' }) {
    noticeKicker.textContent = kicker;
    noticeTitle.textContent = title;
    noticeCopy.textContent = copy;
    noticeAction = action;
    if (noticeButton) noticeButton.textContent = button;
    notice.classList.add('open');
    notice.setAttribute('aria-hidden', 'false');
  }

  function closeNotice() {
    notice.classList.remove('open');
    notice.setAttribute('aria-hidden', 'true');
    noticeAction = 'close';
    if (noticeButton) noticeButton.textContent = 'GOT IT';
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

  function openRankingGames(attempt = 0) {
    if (window.RealPlayRankingGames?.open) {
      window.RealPlayRankingGames.open();
      return;
    }
    if (attempt < 8) {
      window.setTimeout(() => openRankingGames(attempt + 1), 100);
      return;
    }
    showNotice({
      kicker: 'RANKING GAMES',
      title: 'RANKING GAMES ARE LOADING.',
      copy: 'The East vs West ranking layer is still loading. Try Ranking Games again in a moment.',
    });
  }

  function openWorld() {
    if (window.RealPlayWorld?.open) {
      window.RealPlayWorld.open();
      return;
    }
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

  function openProfile() {
    if (window.RealPlayProfile?.open) {
      window.RealPlayProfile.open();
      return;
    }
    showNotice({
      kicker: 'REAL PLAY PROFILE',
      title: 'PROFILE IS LOADING.',
      copy: 'Your player profile layer is still loading. Try Profile again in a moment.',
    });
  }

  function openSettings() {
    const playerName = String(lobby.querySelector('[data-rp-name]')?.textContent || 'REAL PLAY PLAYER').trim();
    const email = String(document.querySelector('[data-auth-account-email]')?.textContent || '').trim();
    const identity = email ? `${playerName} · ${email}` : playerName;

    showNotice({
      kicker: 'ACCOUNT',
      title: 'SETTINGS',
      copy: identity,
      button: 'LOG OUT',
      action: 'logout',
    });
  }

  function logout() {
    const existingLogout = document.querySelector('[data-auth-logout]');
    closeNotice();

    if (existingLogout) {
      existingLogout.click();
      return;
    }

    window.localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }

  function enterSelected() {
    const action = items[activeIndex]?.dataset.rpMainAction;
    if (action === '3v3') {
      openThreeVThree();
    } else if (action === 'ranking') {
      openRankingGames();
    } else if (action === '5v5') {
      showNotice({
        kicker: 'REAL PLAY 5V5',
        title: 'UNDER CONSTRUCTION.',
        copy: 'Full-court 5V5 is visible in the Real Play roadmap, but 3V3 remains the active Beta Season format for now.',
      });
    } else if (action === 'updates') {
      if (window.RealPlayUpdates?.open) window.RealPlayUpdates.open();
      else showNotice({
        kicker: 'REAL PLAY UPDATES',
        title: 'THE UPDATE CENTER.',
        copy: 'Official schedules, game results, club announcements and Beta Season changes will live here as Real Play grows.',
      });
    } else if (action === 'world') {
      openWorld();
    } else if (action === 'profile') {
      openProfile();
    } else if (action === 'settings') {
      openSettings();
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
    cancelSpring();
    cancelDragFrame();
    pointerId = event.pointerId;
    pointerStartY = event.clientY;
    pointerLastY = event.clientY;
    pointerLastAt = performance.now();
    pointerVelocityY = 0;
    dragDistance = 0;
    dragStartPosition = position;
    pendingPointerY = event.clientY;
    menu.classList.add('rp-physics-moving');
    list.classList.add('rp-physics-dragging');
    try { list.setPointerCapture(pointerId); } catch (_error) {}
  });

  list?.addEventListener('pointermove', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(8, now - pointerLastAt);
    const frameVelocity = (event.clientY - pointerLastY) / (elapsed / 1000);

    pointerVelocityY = pointerVelocityY * 0.72 + frameVelocity * 0.28;
    pointerLastY = event.clientY;
    pointerLastAt = now;
    dragDistance = Math.max(dragDistance, Math.abs(event.clientY - pointerStartY));
    scheduleDragRender(event.clientY);
  }, { passive: true });

  function releasePointer(event, cancelled = false) {
    if (pointerId === null || (event?.pointerId !== undefined && event.pointerId !== pointerId)) return;

    flushPendingDrag();
    const releasedPointer = pointerId;
    pointerId = null;
    list?.classList.remove('rp-physics-dragging');
    try { list?.releasePointerCapture(releasedPointer); } catch (_error) {}

    if (cancelled) {
      springTo(activeIndex, 0);
      return;
    }

    if (dragDistance > 8) suppressClickUntil = Date.now() + 360;

    const velocityItems = clamp(-pointerVelocityY / DRAG_STEP_PX, -6, 6);
    const projected = position + velocityItems * PROJECTION_SECONDS;
    const origin = activeIndex;
    let target = Math.round(projected);
    target = clamp(target, origin - 1, origin + 1);

    const moved = Math.abs(position - origin);
    if (moved < 0.16 && Math.abs(velocityItems) < 0.72) target = origin;

    springTo(target, velocityItems);
  }

  list?.addEventListener('pointerup', (event) => releasePointer(event, false));
  list?.addEventListener('pointercancel', (event) => releasePointer(event, true));
  list?.addEventListener('lostpointercapture', (event) => {
    if (pointerId !== null && event.pointerId === pointerId) releasePointer(event, true);
  });

  list?.addEventListener('wheel', (event) => {
    const now = Date.now();
    if (Math.abs(event.deltaY) < 10 || now - lastWheelAt < 190) return;
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

  noticeButton?.addEventListener('click', () => {
    if (noticeAction === 'logout') {
      logout();
      return;
    }
    closeNotice();
  });
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

  updateGeometry();
  renderSelector();
  refreshOvr();
  window.addEventListener('focus', refreshOvr);
  window.addEventListener('resize', () => {
    updateGeometry();
    renderPhysics();
  }, { passive: true });

  if ('ResizeObserver' in window && list) {
    const observer = new ResizeObserver(() => {
      updateGeometry();
      renderPhysics();
    });
    observer.observe(list);
  }
})();
