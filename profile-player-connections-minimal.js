(() => {
  if (window.__realPlayPlayerConnectionsMinimalInstalled) return;
  window.__realPlayPlayerConnectionsMinimalInstalled = true;

  const style = document.createElement('style');
  style.dataset.rpPlayerConnectionsMinimal = 'true';
  style.textContent = `
    .rp-player-connections-section > .rp-profile-section-head{
      display:none!important;
    }

    .rp-player-connections-section{
      padding-block:18px!important;
    }

    .rp-player-connections-section::after{
      display:none!important;
    }

    .rp-player-connections-section .rp-player-connections-preview{
      position:relative!important;
      z-index:1!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      gap:22px!important;
      align-items:center!important;
      padding:0 4px!important;
    }

    .rp-player-connections-section .rp-player-connections-preview::after{
      content:'|'!important;
      position:absolute!important;
      left:50%!important;
      top:50%!important;
      transform:translate(-50%,-50%)!important;
      color:#5f7185!important;
      font-family:Arial,sans-serif!important;
      font-size:.72rem!important;
      font-weight:900!important;
      line-height:1!important;
      pointer-events:none!important;
    }

    .rp-player-connections-section .rp-player-connection-preview{
      appearance:none!important;
      -webkit-appearance:none!important;
      min-width:0!important;
      min-height:0!important;
      width:100%!important;
      padding:2px 0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      display:block!important;
      color:#eef8ff!important;
      text-align:center!important;
      cursor:pointer!important;
      overflow:visible!important;
      opacity:1!important;
    }

    .rp-player-connections-section .rp-player-connection-preview::before,
    .rp-player-connections-section .rp-player-connection-preview > strong,
    .rp-player-connections-section .rp-player-connection-preview > span,
    .rp-player-connections-section .rp-player-connection-preview .rp-connection-arrow{
      display:none!important;
    }

    .rp-player-connections-section .rp-player-connection-preview > small{
      display:block!important;
      max-width:none!important;
      margin:0!important;
      color:#f2f7fb!important;
      font-family:Impact,'Arial Narrow',Arial,sans-serif!important;
      font-size:.72rem!important;
      font-style:italic!important;
      font-weight:900!important;
      letter-spacing:.035em!important;
      line-height:1.15!important;
      white-space:nowrap!important;
    }

    .rp-player-connections-section .rp-player-connection-preview:hover > small,
    .rp-player-connections-section .rp-player-connection-preview:focus-visible > small{
      color:#42d8ff!important;
    }

    .rp-player-connections-section .rp-player-connection-preview.against:hover > small,
    .rp-player-connections-section .rp-player-connection-preview.against:focus-visible > small{
      color:#ff7597!important;
    }

    .rp-player-connections-section .rp-player-connection-preview:focus-visible{
      outline:1px solid rgba(66,216,255,.55)!important;
      outline-offset:5px!important;
      border-radius:6px!important;
    }

    @media(max-width:360px){
      .rp-player-connections-section .rp-player-connections-preview{
        gap:18px!important;
      }
      .rp-player-connections-section .rp-player-connection-preview > small{
        font-size:.62rem!important;
        letter-spacing:.02em!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
