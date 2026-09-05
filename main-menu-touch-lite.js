(() => {
  if (window.__realPlayMainMenuTouchLiteInstalled) return;
  window.__realPlayMainMenuTouchLiteInstalled = true;

  const list = document.querySelector('[data-rp-main-menu-list]');
  const menu = document.querySelector('[data-rp-main-menu]');
  const items = [...document.querySelectorAll('[data-rp-main-action]')];
  if (!list || !menu || !items.length) return;

  const SWIPE_DISTANCE = 22;
  const FAST_FLICK_SPEED = 420;
  const FOLLOW_LIMIT = 0.92;
  const POST_SWIPE_CLICK_GUARD_MS = 95;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let lastAt = 0;
  let velocityY = 0;
  let suppressClickUntil = 0;
  let followFrame = 0;
  let pendingProgress = 0;
  let basePosition = 0;
  let visualStepPx = 184;
  let visibleRecords = [];

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

  function renderFollow() {
    followFrame = 0;
    const virtualPosition = basePosition + pendingProgress;

    visibleRecords.forEach(({ item, index }) => {
      const distance = wrappedDistance(index, virtualPosition);
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
      const y = signed * visualStepPx * Math.pow(absolute, 0.94);
      const rotate = clamp(-distance * 5.2, -7.5, 7.5);
      const visibleOpacity = absolute > 1.62 ? 0 : alpha;

      item.style.transform = `translate3d(-50%,-50%,0) translate3d(0,${y.toFixed(2)}px,0) rotateX(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      item.style.opacity = visibleOpacity.toFixed(4);
    });
  }

  function scheduleFollow(deltaY) {
    pendingProgress = clamp(-deltaY / visualStepPx, -FOLLOW_LIMIT, FOLLOW_LIMIT);
    if (followFrame) return;
    followFrame = requestAnimationFrame(renderFollow);
  }

  function cancelFollowFrame() {
    if (followFrame) cancelAnimationFrame(followFrame);
    followFrame = 0;
  }

  function dispatchMove(direction) {
    const key = direction > 0 ? 'ArrowDown' : 'ArrowUp';
    list.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    }));
  }

  function restoreStartVisuals() {
    visibleRecords.forEach(({ item, transform, opacity }) => {
      item.style.transform = transform;
      item.style.opacity = opacity;
    });
  }

  /* Clear the old whole-list feedback from earlier builds. The cards themselves
     now follow the finger, which is both more physical and cheaper to composite. */
  list.style.transform = '';

  list.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;

    event.stopImmediatePropagation();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastY = event.clientY;
    lastAt = performance.now();
    velocityY = 0;
    pendingProgress = 0;

    const activeIndex = items.findIndex((item) => item.classList.contains('slot-active'));
    basePosition = activeIndex >= 0 ? activeIndex : 0;
    visualStepPx = clamp((list.clientHeight || 430) * 0.43, 154, 224);
    visibleRecords = items
      .map((item, index) => ({
        item,
        index,
        transform: item.style.transform,
        opacity: item.style.opacity,
      }))
      .filter(({ item }) => !item.classList.contains('slot-hidden'));

    list.classList.add('rp-touch-lite-active');
    menu.classList.add('rp-physics-moving');

    try { list.setPointerCapture(pointerId); } catch (_error) {}
  }, { capture: true });

  list.addEventListener('pointermove', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;

    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();

    const now = performance.now();
    const elapsed = Math.max(8, now - lastAt);
    const frameVelocity = (event.clientY - lastY) / (elapsed / 1000);
    velocityY = velocityY * 0.58 + frameVelocity * 0.42;
    lastY = event.clientY;
    lastAt = now;

    const deltaY = event.clientY - startY;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaY) >= Math.abs(deltaX) * 0.55) scheduleFollow(deltaY);
  }, { capture: true, passive: false });

  function finishPointer(event, cancelled = false) {
    if (pointerId === null || event.pointerId !== pointerId) return;

    event.stopImmediatePropagation();
    cancelFollowFrame();

    const releasedId = pointerId;
    pointerId = null;
    list.classList.remove('rp-touch-lite-active');

    try { list.releasePointerCapture(releasedId); } catch (_error) {}

    const deltaY = event.clientY - startY;
    const deltaX = event.clientX - startX;
    const verticalEnough = Math.abs(deltaY) >= Math.abs(deltaX) * 0.62;
    const distanceSwipe = Math.abs(deltaY) >= SWIPE_DISTANCE;
    const fastFlick = Math.abs(velocityY) >= FAST_FLICK_SPEED && Math.abs(deltaY) >= 8;
    const shouldMove = !cancelled && verticalEnough && (distanceSwipe || fastFlick);

    if (shouldMove) {
      if (event.cancelable) event.preventDefault();
      suppressClickUntil = Date.now() + POST_SWIPE_CLICK_GUARD_MS;

      /* Keep the exact finger-follow transforms in place. main-menu.js changes
         the selection immediately; the fast-snap CSS then carries those same
         layers the short remaining distance into the locked position. */
      dispatchMove(deltaY < 0 ? 1 : -1);
    } else {
      menu.classList.remove('rp-physics-moving');
      restoreStartVisuals();
    }

    pendingProgress = 0;
    visibleRecords = [];
  }

  list.addEventListener('pointerup', (event) => finishPointer(event, false), { capture: true, passive: false });
  list.addEventListener('pointercancel', (event) => finishPointer(event, true), { capture: true, passive: false });
  list.addEventListener('lostpointercapture', (event) => {
    if (pointerId !== null && event.pointerId === pointerId) finishPointer(event, true);
  }, { capture: true });

  list.addEventListener('click', (event) => {
    if (Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
})();