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

    const DRAG_THRESHOLD = 7;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let suppressImmediateClick = false;

    const canScroll = () => carousel.scrollWidth > carousel.clientWidth + 2;

    const resetDrag = () => {
      pointerId = null;
      dragging = false;
      carousel.classList.remove('rp-desktop-carousel-dragging');
      carousel.style.cursor = canScroll() ? 'grab' : '';
    };

    carousel.style.cursor = canScroll() ? 'grab' : '';

    // Start tracking the mouse without preventing or capturing the press.
    // A plain press/release therefore remains a completely normal button click.
    carousel.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !canScroll()) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = carousel.scrollLeft;
      dragging = false;
    });

    // Listen on window so the drag keeps moving even if the pointer crosses a
    // button edge. We still do not use setPointerCapture, which previously
    // retargeted Chromium clicks away from the real filter button.
    window.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!dragging) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          resetDrag();
          return;
        }
        dragging = true;
        carousel.classList.add('rp-desktop-carousel-dragging');
        carousel.style.cursor = 'grabbing';
      }

      // Only an established horizontal drag is cancelled. Simple clicks never
      // reach this branch, so the Players filter module keeps full click ownership.
      event.preventDefault();
      carousel.scrollLeft = startScrollLeft - deltaX;
    }, { passive: false });

    window.addEventListener('pointerup', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const wasDragging = dragging;
      resetDrag();

      // Browsers may synthesize a click immediately after a mouse drag. Suppress
      // only that same-turn synthetic click, then automatically re-enable clicks.
      if (wasDragging) {
        suppressImmediateClick = true;
        window.setTimeout(() => { suppressImmediateClick = false; }, 0);
      }
    }, { capture: true, passive: true });

    window.addEventListener('pointercancel', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      resetDrag();
    }, { capture: true, passive: true });

    carousel.addEventListener('click', (event) => {
      if (!suppressImmediateClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });

    // Wheel/trackpad navigation remains available as a second desktop input.
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