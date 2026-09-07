(() => {
  if (window.__realPlayOverlayFocusReleaseInstalled) return;
  window.__realPlayOverlayFocusReleaseInstalled = true;

  function safeFallback() {
    return document.querySelector('[data-rp-main-action].slot-active')
      || document.querySelector('[data-rp-main-menu-list]')
      || document.querySelector('[data-rp-app]');
  }

  function releaseFocus(container) {
    const active = document.activeElement;
    if (!container || !active || !container.contains(active)) return;

    // First remove focus from the surface that is about to become aria-hidden.
    try { active.blur?.(); } catch (_) {}

    // If the browser still retains focus inside the hidden surface, hand focus
    // to a stable visible Real Play element. This prevents Chrome's
    // "Blocked aria-hidden because its descendant retained focus" warning.
    if (container.contains(document.activeElement)) {
      const target = safeFallback();
      if (!target || typeof target.focus !== 'function') return;
      if (!target.hasAttribute('tabindex') && target === document.querySelector('[data-rp-app]')) {
        target.setAttribute('tabindex', '-1');
      }
      try { target.focus({ preventScroll: true }); }
      catch (_) { try { target.focus(); } catch (_) {} }
    }
  }

  function surfaceFromCloseTarget(target) {
    if (target.closest?.('[data-rp-main-notice-close]')) return document.querySelector('[data-rp-main-notice]');
    if (target.closest?.('[data-rp-career-replay-close]')) return document.querySelector('[data-rp-career-replay]');
    if (target.closest?.('[data-updates-close]')) return document.querySelector('[data-rp-updates]');
    if (target.closest?.('[data-rp-profile-close]')) return target.closest('[data-rp-profile], .rp-public-player-profile, [data-rp-public-profile]');
    if (target.closest?.('[data-rp-public-profile-close], [data-rp-player-profile-close]')) return target.closest('.rp-public-player-profile, [data-rp-public-profile]');
    if (target.closest?.('[data-admin-exit]')) return document.querySelector('.rp-admin-control');
    return null;
  }

  // Capture runs before the overlay's own close handler changes aria-hidden.
  document.addEventListener('click', (event) => {
    const notice = document.querySelector('[data-rp-main-notice]');
    if (event.target === notice && notice?.classList.contains('open')) {
      releaseFocus(notice);
      return;
    }

    const updates = document.querySelector('[data-rp-updates]');
    if (event.target === updates && updates?.classList.contains('open')) {
      releaseFocus(updates);
      return;
    }

    const surface = surfaceFromCloseTarget(event.target);
    if (surface) releaseFocus(surface);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const surfaces = [
      document.querySelector('[data-rp-main-notice].open'),
      document.querySelector('[data-rp-career-replay].open'),
      document.querySelector('[data-rp-updates].open'),
      document.querySelector('[data-rp-profile].open'),
      document.querySelector('.rp-public-player-profile.open'),
      document.querySelector('.rp-admin-control.open'),
    ].filter(Boolean);
    const activeSurface = surfaces.find((surface) => surface.contains(document.activeElement)) || surfaces[0];
    if (activeSurface) releaseFocus(activeSurface);
  }, true);
})();