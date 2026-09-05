(() => {
  if (window.__realPlayAdminLiveRefreshFixInstalled) return;
  window.__realPlayAdminLiveRefreshFixInstalled = true;

  let preservedScrollTop = 0;
  let scrollRoot = null;
  let restoringScroll = false;

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function rememberScroll(root = adminRoot()) {
    if (!root?.classList.contains('open') || restoringScroll) return;
    preservedScrollTop = Math.max(0, Number(root.scrollTop || 0));
  }

  function restoreScroll(root = adminRoot()) {
    if (!root?.classList.contains('open')) return;
    const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
    const target = Math.min(preservedScrollTop, maxScrollTop);
    if (Math.abs(root.scrollTop - target) < 1) return;

    restoringScroll = true;
    root.scrollTop = target;
    restoringScroll = false;
  }

  function scheduleScrollRestore() {
    window.requestAnimationFrame(() => {
      restoreScroll();
      // Admin enhancement layers can add/remove controls immediately after the
      // base render. Restore once more after those layout changes settle.
      window.requestAnimationFrame(() => restoreScroll());
    });
  }

  function installScrollGuard() {
    const root = adminRoot();
    if (!root || root === scrollRoot) return;

    scrollRoot = root;
    root.style.overflowAnchor = 'none';
    root.addEventListener('scroll', () => rememberScroll(root), { passive: true });

    // Capture the exact court-side position before a control action causes the
    // admin body to be rebuilt. Normal team/check-in/stat actions should never
    // throw the operator back toward the top of the roster.
    root.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-admin-tab]')) {
        // A deliberate section change may start from the top of the new view.
        preservedScrollTop = 0;
        return;
      }
      rememberScroll(root);
    }, true);

    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('[data-admin-tab]')) {
        preservedScrollTop = 0;
        return;
      }
      rememberScroll(root);
    }, true);

    root.addEventListener('submit', () => rememberScroll(root), true);
  }

  function installLiveRefresh() {
    const current = window.__realPlayRefreshAdminGameControl;
    if (typeof current !== 'function' || current.__realPlayLiveRefreshFixed) return;

    const original = current;
    const wrapped = async (...args) => {
      const root = adminRoot();
      if (!root?.classList.contains('open')) {
        return original(...args);
      }

      rememberScroll(root);

      // When Game Control is already open, force its normal live refresh path.
      // The previous helper pointed at detectAdmin(), which updated the cached
      // control signature without repainting the open screen. That made the
      // following silent poll think nothing changed, so roster updates only
      // appeared after a full browser refresh.
      window.dispatchEvent(new Event('focus'));
      scheduleScrollRestore();
      return true;
    };

    wrapped.__realPlayLiveRefreshFixed = true;
    wrapped.__realPlayOriginal = original;
    window.__realPlayRefreshAdminGameControl = wrapped;
  }

  function install() {
    installScrollGuard();
    installLiveRefresh();
  }

  install();

  window.addEventListener('realplay:admin-render', () => {
    install();
    scheduleScrollRestore();
  });

  window.addEventListener('realplay:settings-open', install);
})();