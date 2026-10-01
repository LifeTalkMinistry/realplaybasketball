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

    return true;
  }

  function installWorldPlayerCarouselDesktopFix() {
    const carousel = document.querySelector('.rp-world-player-sort, [data-world-player-sort]');
    if (!carousel || carousel.dataset.rpDesktopCarouselBound === '1') return false;
    carousel.dataset.rpDesktopCarouselBound = '1';

    const DRAG_THRESHOLD = 6;
    const CLICK_GUARD_MS = 220;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let suppressClickUntil = 0;

    const canScroll = () => carousel.scrollWidth > carousel.clientWidth + 2;

    const reset = () => {
      pointerId = null;
      dragging = false;
      carousel.classList.remove('rp-desktop-carousel-dragging');
    };

    carousel.style.cursor = 'grab';

    carousel.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !canScroll()) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = carousel.scrollLeft;
      dragging = false;
      // Do not capture the pointer yet. Capturing on a normal click retargets
      // Chromium's click event to the carousel itself instead of the filter
      // button, which prevents the delegated filter handler from firing.
    });

    carousel.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!dragging) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          reset();
          return;
        }
        dragging = true;
        carousel.classList.add('rp-desktop-carousel-dragging');
        carousel.style.cursor = 'grabbing';
        try { carousel.setPointerCapture(event.pointerId); } catch (_error) {}
      }

      event.preventDefault();
      carousel.scrollLeft = startScrollLeft - deltaX;
    }, { passive: false });

    const finishPointer = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      if (dragging) suppressClickUntil = Date.now() + CLICK_GUARD_MS;
      if (dragging) {
        try { carousel.releasePointerCapture(event.pointerId); } catch (_error) {}
      }
      reset();
      carousel.style.cursor = 'grab';
    };

    carousel.addEventListener('pointerup', finishPointer, { capture: true });
    carousel.addEventListener('pointercancel', finishPointer, { capture: true });

    // A normal desktop mouse has a vertical wheel, not a horizontal swipe.
    // While the pointer is over this horizontal filter strip, translate that
    // wheel motion into horizontal carousel motion instead of making the user
    // open DevTools/mobile emulation just to reach the remaining filters.
    carousel.addEventListener('wheel', (event) => {
      if (!canScroll()) return;
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontalIntent ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      carousel.scrollLeft += delta;
    }, { passive: false });

    carousel.addEventListener('click', (event) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });

    // Keep whichever filter was clicked fully visible in the strip.
    carousel.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-player-sort]');
      if (!button || Date.now() < suppressClickUntil) return;
      requestAnimationFrame(() => button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }));
    });

    return true;
  }

  function installAvailableDesktopFixes() {
    installMainMenuDesktopFix();
    installWorldPlayerCarouselDesktopFix();
  }

  installAvailableDesktopFixes();

  // WORLD / PLAYERS is mounted dynamically, so keep a lightweight observer
  // until the horizontal filter carousel exists in the real DOM.
  const observer = new MutationObserver(() => installAvailableDesktopFixes());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();