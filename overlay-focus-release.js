(() => {
  if (window.__realPlayOverlayFocusReleaseInstalled) return;
  window.__realPlayOverlayFocusReleaseInstalled = true;

  function focusSafeMenuTarget(container) {
    const active = document.activeElement;
    if (!container || !active || !container.contains(active)) return;

    const preferred = document.querySelector('[data-rp-main-action].slot-active');
    const fallback = document.querySelector('[data-rp-main-menu-list]');
    const target = preferred || fallback;

    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
        return;
      } catch (_error) {
        target.focus();
        return;
      }
    }

    if (typeof active.blur === 'function') active.blur();
  }

  // Run during capture, before the existing overlay handlers set aria-hidden.
  document.addEventListener('click', (event) => {
    const notice = document.querySelector('[data-rp-main-notice]');
    if (!notice?.classList.contains('open')) return;

    const clickedClose = event.target.closest?.('[data-rp-main-notice-close]');
    const clickedBackdrop = event.target === notice;
    if (clickedClose || clickedBackdrop) focusSafeMenuTarget(notice);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const notice = document.querySelector('[data-rp-main-notice]');
    if (notice?.classList.contains('open')) focusSafeMenuTarget(notice);
  }, true);
})();
