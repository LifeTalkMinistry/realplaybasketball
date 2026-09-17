(() => {
  if (window.__realPlayLiveStatStabilityInstalled) return;
  window.__realPlayLiveStatStabilityInstalled = true;

  // RETIRED: LIVE stat controls are no longer an active scoring path.
  // This file remains loaded late in the app boot, so it also carries a small
  // admin-sheet stability patch for mobile browsers.
  if (!document.querySelector('[data-rp-player-admin-mobile-scroll-fix]')) {
    const style = document.createElement('style');
    style.dataset.rpPlayerAdminMobileScrollFix = '1';
    style.textContent = `
      .rp-player-admin-sheet{
        overscroll-behavior:contain!important;
        touch-action:pan-y!important;
      }
      .rp-player-admin-card{
        min-height:0!important;
        max-height:min(82dvh,720px)!important;
        overflow-x:hidden!important;
        overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
        touch-action:pan-y!important;
        scrollbar-gutter:stable;
      }
      .rp-player-admin-body{
        padding-bottom:calc(28px + env(safe-area-inset-bottom))!important;
        touch-action:pan-y!important;
      }
      @media(max-height:760px){
        .rp-player-admin-card{max-height:calc(100dvh - 92px)!important}
      }
    `;
    document.head.appendChild(style);
  }
})();
