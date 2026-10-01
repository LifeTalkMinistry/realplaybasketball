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

    const DRAG_THRESHOLD = 6;
    const CLICK_GUARD_MS = 120;
    let mouseDown = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let suppressClickUntil = 0;
    let previousSnapType = '';
    let previousScrollBehavior = '';

    const canScroll = () => carousel.scrollWidth > carousel.clientWidth + 2;

    const syncCursor = () => {
      carousel.style.cursor = canScroll() ? (dragging ? 'grabbing' : 'grab') : '';
    };

    const endDrag = () => {
      mouseDown = false;
      if (dragging) {
        suppressClickUntil = Date.now() + CLICK_GUARD_MS;
        carousel.style.scrollSnapType = previousSnapType;
        carousel.style.scrollBehavior = previousScrollBehavior;
      }
      dragging = false;
      carousel.classList.remove('rp-desktop-carousel-dragging');
      document.documentElement.classList.remove('rp-player-carousel-mouse-dragging');
      syncCursor();
    };

    // Desktop mouse dragging is deliberately implemented with mouse events,
    // not pointer/touch events. This keeps the mobile/F12 touch carousel native.
    carousel.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || !canScroll()) return;
      mouseDown = true;
      dragging = false;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = carousel.scrollLeft;
    });

    window.addEventListener('mousemove', (event) => {
      if (!mouseDown) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!dragging) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          endDrag();
          return;
        }

        dragging = true;
        previousSnapType = carousel.style.scrollSnapType;
        previousScrollBehavior = carousel.style.scrollBehavior;
        carousel.style.scrollSnapType = 'none';
        carousel.style.scrollBehavior = 'auto';
        carousel.classList.add('rp-desktop-carousel-dragging');
        document.documentElement.classList.add('rp-player-carousel-mouse-dragging');
        syncCursor();
      }

      event.preventDefault();
      carousel.scrollLeft = startScrollLeft - deltaX;
    }, { passive: false });

    window.addEventListener('mouseup', () => {
      if (!mouseDown) return;
      endDrag();
    }, { capture: true });

    window.addEventListener('blur', () => {
      if (mouseDown) endDrag();
    });

    // Prevent Chromium's native text/image drag only after using this strip as
    // a drag surface. This does not intercept ordinary filter button clicks.
    carousel.addEventListener('dragstart', (event) => event.preventDefault());
    carousel.querySelectorAll('[data-player-sort]').forEach((button) => {
      button.draggable = false;
      button.style.userSelect = 'none';
      button.style.webkitUserSelect = 'none';
    });

    carousel.addEventListener('click', (event) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });

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

    carousel.addEventListener('focusin', (event) => {
      const button = event.target.closest?.('[data-player-sort]');
      if (!button) return;
      requestAnimationFrame(() => {
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    });

    // Touch remains a native horizontal scroller. These inline properties only
    // reinforce the existing mobile behavior and do not attach touch handlers.
    carousel.style.overflowX = 'auto';
    carousel.style.overflowY = 'hidden';
    carousel.style.webkitOverflowScrolling = 'touch';
    carousel.style.touchAction = 'pan-x';
    syncCursor();

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