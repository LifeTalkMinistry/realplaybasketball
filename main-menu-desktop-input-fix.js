(() => {
  if (window.__realPlayDesktopMenuInputFixInstalled) return;
  window.__realPlayDesktopMenuInputFixInstalled = true;

  const list = document.querySelector('[data-rp-main-menu-list]');
  const menu = document.querySelector('[data-rp-main-menu]');
  const items = [...document.querySelectorAll('[data-rp-main-action]')];
  if (!list || !menu || !items.length) return;

  const DRAG_THRESHOLD = 10;
  const CLICK_GUARD_MS = 180;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let suppressClickUntil = 0;

  function reset() {
    pointerId = null;
    list.classList.remove('rp-physics-dragging');
  }

  function moveSelection(direction) {
    list.dispatchEvent(new KeyboardEvent('keydown', {
      key: direction > 0 ? 'ArrowDown' : 'ArrowUp',
      bubbles: true,
      cancelable: true,
    }));
  }

  items.forEach((item) => {
    item.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;

      // Keep a simple desktop press owned by the real button. The parent
      // carousel otherwise captures the mouse pointer and Chromium can retarget
      // the later click to the list instead of the visible card.
      event.stopPropagation();
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = lastY = event.clientY;
    });
  });

  window.addEventListener('pointermove', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;

    const distance = Math.hypot(lastX - startX, lastY - startY);
    if (distance >= DRAG_THRESHOLD) list.classList.add('rp-physics-dragging');
  }, { passive: true });

  window.addEventListener('pointerup', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;

    lastX = event.clientX;
    lastY = event.clientY;
    const deltaX = lastX - startX;
    const deltaY = lastY - startY;
    const distance = Math.hypot(deltaX, deltaY);
    const verticalDrag = Math.abs(deltaY) >= Math.abs(deltaX) * 0.62;

    reset();

    if (distance < DRAG_THRESHOLD) return;

    suppressClickUntil = Date.now() + CLICK_GUARD_MS;
    if (verticalDrag) moveSelection(deltaY < 0 ? 1 : -1);
  }, { capture: true, passive: true });

  window.addEventListener('pointercancel', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    reset();
  }, { capture: true, passive: true });

  list.addEventListener('click', (event) => {
    if (Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
})();