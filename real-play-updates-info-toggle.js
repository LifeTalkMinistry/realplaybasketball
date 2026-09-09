(() => {
  if (window.__realPlayUpdatesInfoToggleInstalled) return;
  window.__realPlayUpdatesInfoToggleInstalled = true;

  const style = document.createElement('style');
  style.dataset.rpUpdatesInfoStyles = 'true';
  style.textContent = `
    .rp-updates-info-button{
      appearance:none;
      display:grid;
      place-items:center;
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      padding:0!important;
      border:1px solid rgba(72,215,255,.24)!important;
      border-radius:50%!important;
      color:#58dcff!important;
      background:rgba(18,103,158,.10)!important;
      font:950 14px/1 Georgia,'Times New Roman',serif!important;
      font-style:italic!important;
      letter-spacing:0!important;
      cursor:pointer;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 0 18px rgba(34,188,255,.06);
      touch-action:manipulation;
    }
    .rp-updates-info-button:hover,
    .rp-updates-info-button:focus-visible,
    .rp-updates-info-button.active{
      border-color:rgba(72,215,255,.58)!important;
      color:#f3fbff!important;
      background:rgba(20,121,181,.20)!important;
      outline:none;
    }

    .rp-updates-info-overlay{
      position:fixed;
      z-index:50;
      inset:0;
      display:flex;
      align-items:flex-end;
      justify-content:center;
      padding:16px;
      background:rgba(0,0,0,.78);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
    }
    .rp-updates-info-overlay[hidden]{display:none!important}

    .rp-updates-info-card{
      position:relative;
      width:min(100%,520px);
      max-height:min(82svh,720px);
      overflow-y:auto;
      overscroll-behavior:contain;
      padding:20px 18px max(18px,env(safe-area-inset-bottom));
      border:1px solid transparent;
      border-radius:24px 24px 18px 18px;
      color:#f7fbff;
      background:
        linear-gradient(150deg,rgba(7,14,24,.985),rgba(2,6,11,.995)) padding-box,
        linear-gradient(112deg,rgba(22,163,255,.68),rgba(64,150,220,.22) 30%,rgba(255,255,255,.08) 52%,rgba(184,61,82,.24) 74%,rgba(255,45,62,.52)) border-box;
      box-shadow:0 28px 90px rgba(0,0,0,.62);
      scrollbar-width:none;
    }
    .rp-updates-info-card::-webkit-scrollbar{display:none}

    .rp-updates-info-head{
      display:grid;
      grid-template-columns:1fr 38px;
      gap:14px;
      align-items:start;
      padding-bottom:15px;
      border-bottom:1px solid rgba(255,255,255,.065);
    }
    .rp-updates-info-head small{
      display:block;
      color:#42d4ff;
      font-size:.47rem;
      font-weight:950;
      letter-spacing:.14em;
    }
    .rp-updates-info-head h2{
      margin:5px 0 0;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:1.75rem;
      font-style:italic;
      font-weight:950;
      line-height:.95;
      letter-spacing:-.02em;
    }
    .rp-updates-info-close{
      appearance:none;
      width:38px;
      height:38px;
      border:1px solid rgba(255,255,255,.10);
      border-radius:12px;
      color:#fff;
      background:#080d15;
      font-size:1.2rem;
      font-weight:700;
      cursor:pointer;
    }

    .rp-updates-info-intro{
      margin:14px 1px 0;
      color:#9aaabd;
      font-size:.72rem;
      line-height:1.58;
    }
    .rp-updates-info-list{
      display:grid;
      gap:9px;
      margin-top:15px;
    }
    .rp-updates-info-item{
      display:grid;
      grid-template-columns:32px minmax(0,1fr);
      gap:10px;
      padding:12px;
      border:1px solid rgba(255,255,255,.065);
      border-radius:14px;
      background:#070c14;
    }
    .rp-updates-info-item>span{
      display:grid;
      place-items:center;
      width:32px;
      height:32px;
      border:1px solid rgba(72,215,255,.18);
      border-radius:10px;
      color:#4fdcff;
      background:rgba(18,103,158,.10);
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.64rem;
      font-weight:950;
    }
    .rp-updates-info-item strong{
      display:block;
      color:#f5f9fd;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.76rem;
      font-style:italic;
      font-weight:950;
      letter-spacing:.025em;
    }
    .rp-updates-info-item p{
      margin:4px 0 0;
      color:#75869a;
      font-size:.60rem;
      line-height:1.48;
    }
    .rp-updates-info-item b{color:#b9c8d7;font-weight:800}

    .rp-updates-info-principle{
      margin-top:14px;
      padding:13px 14px;
      border:1px solid rgba(72,215,255,.13);
      border-radius:14px;
      color:#87a0b5;
      background:rgba(16,103,153,.08);
      font-size:.58rem;
      line-height:1.5;
      text-align:center;
    }
    .rp-updates-info-principle strong{
      display:block;
      margin-top:3px;
      color:#5edcff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.72rem;
      font-style:italic;
      font-weight:950;
      letter-spacing:.035em;
    }
    .rp-updates-info-done{
      width:100%;
      min-height:46px;
      margin-top:15px;
      border:1px solid rgba(72,215,255,.24);
      border-radius:13px;
      color:#53ddff;
      background:rgba(11,78,125,.14);
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.62rem;
      font-weight:950;
      letter-spacing:.09em;
      cursor:pointer;
    }

    @media(min-width:700px){
      .rp-updates-info-overlay{align-items:center}
      .rp-updates-info-card{border-radius:24px}
    }
  `;
  document.head.appendChild(style);

  let installedPanel = null;
  let button = null;
  let overlay = null;
  let previousFocus = null;

  function closeInfo() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    button?.classList.remove('active');
    button?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('rp-updates-info-open');
    previousFocus?.focus?.();
  }

  function openInfo() {
    if (!overlay || !button) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    button.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('rp-updates-info-open');
    requestAnimationFrame(() => overlay.querySelector('[data-rp-updates-info-close]')?.focus());
  }

  function install(panel) {
    if (!panel || panel === installedPanel || panel.dataset.rpUpdatesInfoInstalled === 'true') return;

    const oldBadge = panel.querySelector('.rp-updates-official');
    if (!oldBadge) return;

    installedPanel = panel;
    panel.dataset.rpUpdatesInfoInstalled = 'true';

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-updates-info-button';
    button.dataset.rpUpdatesInfoButton = 'true';
    button.textContent = 'i';
    button.setAttribute('aria-label', 'About Updates');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'rp-updates-info');
    oldBadge.replaceWith(button);

    overlay = document.createElement('section');
    overlay.className = 'rp-updates-info-overlay';
    overlay.id = 'rp-updates-info';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'rp-updates-info-title');
    overlay.innerHTML = `
      <div class="rp-updates-info-card">
        <header class="rp-updates-info-head">
          <div>
            <small>REAL PLAY OFFICIAL FEED</small>
            <h2 id="rp-updates-info-title">ABOUT UPDATES</h2>
          </div>
          <button class="rp-updates-info-close" type="button" data-rp-updates-info-close aria-label="Close Updates information">×</button>
        </header>

        <p class="rp-updates-info-intro">Updates is Real Play's official information feed. This is where players can quickly see verified schedules, finalized results and important announcements from Real Play.</p>

        <div class="rp-updates-info-list">
          <article class="rp-updates-info-item">
            <span>01</span>
            <div><strong>OFFICIAL INFORMATION</strong><p>Posts here come from the Real Play update system. The page is designed for organization-wide information rather than regular player community posting.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>02</span>
            <div><strong>ALL</strong><p>Shows the complete official feed together so you can see schedules, results and announcements in one timeline.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>03</span>
            <div><strong>SCHEDULES</strong><p>Shows upcoming Real Play sessions or events, including the date, time and location when those details are available.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>04</span>
            <div><strong>RESULTS</strong><p>Shows finalized Real Play results. Result cards may include the official score, winner and a link to the game or verified stats when available.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>05</span>
            <div><strong>ANNOUNCEMENTS</strong><p>Shows important Real Play notices that players should know, including operational, community or competition-related information.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>06</span>
            <div><strong>PINNED UPDATES</strong><p>A <b>PINNED</b> post is intentionally kept prominent because Real Play considers it especially important or currently relevant.</p></div>
          </article>
          <article class="rp-updates-info-item">
            <span>07</span>
            <div><strong>GAME RECEIPTS</strong><p>When a result is connected to an official recorded game, you may be able to open the game and inspect the available replay or stats behind that result.</p></div>
          </article>
        </div>

        <div class="rp-updates-info-principle">ONE PLACE FOR WHAT REAL PLAY HAS OFFICIALLY PUBLISHED.<strong>SCHEDULES · RESULTS · ANNOUNCEMENTS</strong></div>
        <button class="rp-updates-info-done" type="button" data-rp-updates-info-close>GOT IT</button>
      </div>`;
    panel.appendChild(overlay);

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (overlay.hidden) openInfo();
      else closeInfo();
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-rp-updates-info-close]')) closeInfo();
    });

    new MutationObserver(() => {
      if (!panel.classList.contains('open')) closeInfo();
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeInfo();
    }
  }, true);

  const existing = document.querySelector('[data-rp-updates]');
  if (existing) install(existing);

  new MutationObserver(() => {
    const panel = document.querySelector('[data-rp-updates]');
    if (panel) install(panel);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
