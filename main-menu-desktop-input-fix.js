(() => {
  if (window.__realPlayDesktopMenuInputFixInstalled) return;
  window.__realPlayDesktopMenuInputFixInstalled = true;

  function installMainMenuDesktopFix() {
    const list = document.querySelector('[data-rp-main-menu-list]');
    const menu = document.querySelector('[data-rp-main-menu]');
    const items = [...document.querySelectorAll('[data-rp-main-action]')];
    if (!list || !menu || !items.length || list.dataset.rpDesktopInputFixBound === '1') return false;
    list.dataset.rpDesktopInputFixBound = '1';

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

    return true;
  }

  function installWorldPlayerCarouselDesktopFix() {
    const carousel = document.querySelector('.rp-world-player-sort, [data-world-player-sort]');
    if (!carousel || carousel.dataset.rpDesktopCarouselBound === '1') return false;
    carousel.dataset.rpDesktopCarouselBound = '1';

    const canScroll = () => carousel.scrollWidth > carousel.clientWidth + 2;

    // IMPORTANT: do not capture pointer/click events here. The Players filter
    // module owns the buttons. Previous desktop drag interception caused
    // Chromium to swallow or retarget the actual button clicks.
    // Desktop navigation is therefore implemented with wheel/trackpad scrolling,
    // while normal button clicks remain completely native and untouched.
    carousel.addEventListener('wheel', (event) => {
      if (!canScroll()) return;
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontalIntent ? event.deltaX : event.deltaY;
      if (!delta) return;

      const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
      const before = carousel.scrollLeft;
      const next = Math.max(0, Math.min(maxScroll, before + delta));
      if (Math.abs(next - before) < 0.5) return;

      event.preventDefault();
      carousel.scrollLeft = next;
    }, { passive: false });

    // Keyboard support stays native as well. When a filter receives focus,
    // bring it into view without changing or intercepting its click behavior.
    carousel.addEventListener('focusin', (event) => {
      const button = event.target.closest?.('[data-player-sort]');
      if (!button) return;
      requestAnimationFrame(() => {
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    });

    return true;
  }

  function installAvailableDesktopFixes() {
    installMainMenuDesktopFix();
    installWorldPlayerCarouselDesktopFix();
  }

  installAvailableDesktopFixes();

  const observer = new MutationObserver(() => installAvailableDesktopFixes());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();