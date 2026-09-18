(() => {
  if (window.__realPlayReservationSnapshotStandbyFitInstalled) return;
  window.__realPlayReservationSnapshotStandbyFitInstalled = true;

  const style = document.createElement('style');
  style.id = 'rp-reservation-snapshot-standby-fit-style';
  style.textContent = `
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-cell{
      min-width:0!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-line{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      gap:5px!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name{
      flex:1 1 0!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-standby-access{
      flex:0 0 auto!important;
      box-sizing:border-box!important;
      padding-left:4px!important;
      padding-right:4px!important;
      font-size:.28rem!important;
      letter-spacing:.055em!important;
      line-height:1!important;
      overflow:hidden!important;
      white-space:nowrap!important;
    }
  `;
  document.head.appendChild(style);
})();
