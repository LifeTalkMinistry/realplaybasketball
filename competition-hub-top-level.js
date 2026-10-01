(() => {
  if (window.__realPlayCompetitionHubTopLevelInstalled) return;
  window.__realPlayCompetitionHubTopLevelInstalled = true;

  function installStyles() {
    if (document.querySelector('[data-rp-competition-top-level-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCompetitionTopLevelStyles = '1';
    style.textContent = `
      body.rp-simple-navigation-active .rp-competition-hub{
        top:0!important;
        left:0!important;
        right:0!important;
        bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom))!important;
        z-index:580!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-shell{
        min-height:calc(100dvh - var(--rp-simple-nav-height) - env(safe-area-inset-bottom))!important;
        padding-bottom:20px!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-close{
        display:none!important;
      }
      body.rp-simple-navigation-active .rp-competition-hub .rp-competition-topbar{
        grid-template-columns:42px minmax(0,1fr) 42px!important;
      }
      body.rp-simple-navigation-active.rp-competition-hub-open .rp-simple-nav{
        visibility:visible!important;
        pointer-events:auto!important;
        z-index:590!important;
      }
    `;
    document.head.appendChild(style);
  }

  function closeStatsForOtherTabs(event) {
    const navItem = event.target.closest?.('[data-rp-simple-nav-item]');
    if (!navItem) return;
    if (navItem.dataset.rpSimpleNavItem === 'players') return;
    if (!document.querySelector('[data-rp-competition-hub].open')) return;
    window.RealPlayCompetitionHub?.close?.();
  }

  installStyles();
  document.addEventListener('click', closeStatsForOtherTabs, true);
})();
