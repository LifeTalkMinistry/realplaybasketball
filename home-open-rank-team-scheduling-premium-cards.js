(() => {
  if (window.__realPlayHomeTeamPremiumCardsInstalled) return;
  window.__realPlayHomeTeamPremiumCardsInstalled = true;

  const style = document.createElement('style');
  style.dataset.rpHomeTeamPremiumCardsStyle = '1';
  style.textContent = `
    /* Keep the compact + ADD TEAM workflow, but preserve the original premium
       rectangular team-card presentation after a team has been selected. */
    .rp-home-team-selected{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:6px!important;
      margin-top:7px!important;
      min-height:0!important;
      align-items:stretch!important;
    }

    .rp-home-team-selected-empty{
      grid-column:1 / -1!important;
      min-height:36px!important;
      display:flex!important;
      align-items:center!important;
      padding:0 9px!important;
      border:1px dashed rgba(255,255,255,.08)!important;
      border-radius:9px!important;
      background:rgba(6,15,23,.45)!important;
      color:#637887!important;
      font:800 .49rem/1.3 system-ui,sans-serif!important;
      letter-spacing:.035em!important;
    }

    .rp-home-team-chip{
      box-sizing:border-box!important;
      width:100%!important;
      min-width:0!important;
      min-height:36px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:8px!important;
      padding:0 8px 0 10px!important;
      border:1px solid rgba(49,211,255,.50)!important;
      border-radius:9px!important;
      background:rgba(7,58,79,.54)!important;
      color:#dff8ff!important;
      box-shadow:none!important;
      font:950 .49rem/1.1 system-ui,sans-serif!important;
      letter-spacing:.045em!important;
      text-align:left!important;
      text-transform:uppercase!important;
      cursor:pointer!important;
      overflow:hidden!important;
    }

    .rp-home-team-chip > span:first-child{
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }

    .rp-home-team-chip-x{
      flex:0 0 auto!important;
      width:20px!important;
      height:20px!important;
      display:grid!important;
      place-items:center!important;
      border:1px solid rgba(88,220,255,.18)!important;
      border-radius:50%!important;
      background:rgba(3,24,34,.62)!important;
      color:#79e6ff!important;
      font:900 .68rem/1 system-ui,sans-serif!important;
      transition:background .15s ease,border-color .15s ease,color .15s ease!important;
    }

    .rp-home-team-chip:hover,
    .rp-home-team-chip:focus-visible{
      border-color:rgba(75,221,255,.72)!important;
      background:rgba(7,69,93,.65)!important;
      outline:none!important;
    }

    .rp-home-team-chip:hover .rp-home-team-chip-x,
    .rp-home-team-chip:focus-visible .rp-home-team-chip-x{
      border-color:rgba(100,229,255,.34)!important;
      background:rgba(13,53,69,.88)!important;
      color:#c9f7ff!important;
    }

    .rp-home-team-picker-shell{
      margin-top:7px!important;
    }

    @media(max-width:390px){
      .rp-home-team-selected{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
      .rp-home-team-chip{
        max-width:none!important;
        padding-left:8px!important;
        padding-right:6px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
