(() => {
  if (window.__realPlayMainMenuTouchLiteInstalled) return;
  window.__realPlayMainMenuTouchLiteInstalled = true;

  const list = document.querySelector('[data-rp-main-menu-list]');
  if (!list) return;

  const SWIPE_DISTANCE = 22;
  const FAST_FLICK_SPEED = 420;
  const MAX_FEEDBACK_PX = 16;
  const POST_SWIPE_CLICK_GUARD_MS = 95;
  const RETURN_CLASS_MS = 80;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let lastAt = 0;
  let velocityY = 0;
  let suppressClickUntil = 0;
  let feedbackFrame = 0;
  let pendingFeedback = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function renderFeedback() {
    feedbackFrame = 0;
    list.style.transform = `translate3d(0,${pendingFeedback.toFixed(1)}px,0)`;
  }

  function scheduleFeedback(deltaY) {
    pendingFeedback = clamp(deltaY * 0.22, -MAX_FEEDBACK_PX, MAX_FEEDBACK_PX);
    if (feedbackFrame) return;
    feedbackFrame = requestAnimationFrame(renderFeedback);
  }

  function clearFeedback() {
    if (feedbackFrame) cancelAnimationFrame(feedbackFrame);
    feedbackFrame = 0;
    pendingFeedback = 0;
    list.classList.add('rp-touch-lite-returning');
    list.style.transform = 'translate3d(0,0,0)';
    window.setTimeout(() => list.classList.remove('rp-touch-lite-returning'), RETURN_CLASS_MS);
  }

  function dispatchMove(direction) {
    const key = direction > 0 ? 'ArrowDown' : 'ArrowUp';
    list.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    }));
  }

  list.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;

    event.stopImmediatePropagation();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastY = event.clientY;
    lastAt = performance.now();
    velocityY = 0;
    list.classList.add('rp-touch-lite-active');

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
    if (Math.abs(deltaY) >= Math.abs(deltaX) * 0.55) scheduleFeedback(deltaY);
  }, { capture: true, passive: false });

  function finishPointer(event, cancelled = false) {
    if (pointerId === null || event.pointerId !== pointerId) return;

    event.stopImmediatePropagation();
    const releasedId = pointerId;
    pointerId = null;
    list.classList.remove('rp-touch-lite-active');

    try { list.releasePointerCapture(releasedId); } catch (_error) {}

    const deltaY = event.clientY - startY;
    const deltaX = event.clientX - startX;
    const verticalEnough = Math.abs(deltaY) >= Math.abs(deltaX) * 0.62;
    const distanceSwipe = Math.abs(deltaY) >= SWIPE_DISTANCE;
    const fastFlick = Math.abs(velocityY) >= FAST_FLICK_SPEED && Math.abs(deltaY) >= 8;

    clearFeedback();

    if (!cancelled && verticalEnough && (distanceSwipe || fastFlick)) {
      if (event.cancelable) event.preventDefault();
      suppressClickUntil = Date.now() + POST_SWIPE_CLICK_GUARD_MS;
      dispatchMove(deltaY < 0 ? 1 : -1);
    }
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