(() => {
  if (window.__realPlayAdminLiveRefreshFixInstalled) return;
  window.__realPlayAdminLiveRefreshFixInstalled = true;

  function install() {
    const current = window.__realPlayRefreshAdminGameControl;
    if (typeof current !== 'function' || current.__realPlayLiveRefreshFixed) return;

    const original = current;
    const wrapped = async (...args) => {
      const adminRoot = document.querySelector('.rp-admin-control');
      if (!adminRoot?.classList.contains('open')) {
        return original(...args);
      }

      // When Game Control is already open, force its normal live refresh path.
      // The previous helper pointed at detectAdmin(), which updated the cached
      // control signature without repainting the open screen. That made the
      // following silent poll think nothing changed, so roster updates only
      // appeared after a full browser refresh.
      window.dispatchEvent(new Event('focus'));
      return true;
    };

    wrapped.__realPlayLiveRefreshFixed = true;
    wrapped.__realPlayOriginal = original;
    window.__realPlayRefreshAdminGameControl = wrapped;
  }

  install();
  window.addEventListener('realplay:admin-render', install);
  window.addEventListener('realplay:settings-open', install);
})();
