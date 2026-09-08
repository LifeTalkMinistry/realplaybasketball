(() => {
  if (window.__realPlayRankingInfoToggleInstalled) return;
  window.__realPlayRankingInfoToggleInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const oldMark = view.querySelector('.rp-ranking-mark');
  if (!oldMark) return;

  const style = document.createElement('style');
  style.dataset.rpRankingInfoStyles = 'true';
  style.textContent = `
    .rp-ranking-info-button{
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
    .rp-ranking-info-button:hover,
    .rp-ranking-info-button:focus-visible,
    .rp-ranking-info-button.active{
      border-color:rgba(72,215,255,.58)!important;
      color:#f3fbff!important;
      background:rgba(20,121,181,.20)!important;
      outline:none;
    }

    /* Retire the older inline hero information experiment. */
    .rp-ranking-kicker-row{
      display:contents!important;
    }
    .rp-ranking-kicker-row>.rp-ranking-info-toggle{
      display:none!important;
    }

    .rp-ranking-info-overlay{
      position:fixed;
      z-index:40;
      inset:0;
      display:flex;
      align-items:flex-end;
      justify-content:center;
      padding:16px;
      background:rgba(0,0,0,.78);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
    }
    .rp-ranking-info-overlay[hidden]{display:none!important}

    .rp-ranking-info-card{
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
    .rp-ranking-info-card::-webkit-scrollbar{display:none}

    .rp-ranking-info-head{
      display:grid;
      grid-template-columns:1fr 38px;
      gap:14px;
      align-items:start;
      padding-bottom:15px;
      border-bottom:1px solid rgba(255,255,255,.065);
    }
    .rp-ranking-info-head small{
      display:block;
      color:#42d4ff;
      font-size:.47rem;
      font-weight:950;
      letter-spacing:.14em;
    }
    .rp-ranking-info-head h2{
      margin:5px 0 0;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:1.75rem;
      font-style:italic;
      font-weight:950;
      line-height:.95;
      letter-spacing:-.02em;
    }
    .rp-ranking-info-close{
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

    .rp-ranking-info-intro{
      margin:14px 1px 0;
      color:#9aaabd;
      font-size:.72rem;
      line-height:1.58;
    }

    .rp-ranking-info-list{
      display:grid;
      gap:9px;
      margin-top:15px;
    }
    .rp-ranking-info-item{
      display:grid;
      grid-template-columns:32px minmax(0,1fr);
      gap:10px;
      padding:12px;
      border:1px solid rgba(255,255,255,.065);
      border-radius:14px;
      background:#070c14;
    }
    .rp-ranking-info-item>span{
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
    .rp-ranking-info-item strong{
      display:block;
      color:#f5f9fd;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.76rem;
      font-style:italic;
      font-weight:950;
      letter-spacing:.025em;
    }
    .rp-ranking-info-item p{
      margin:4px 0 0;
      color:#75869a;
      font-size:.60rem;
      line-height:1.48;
    }
    .rp-ranking-info-item b{color:#b9c8d7;font-weight:800}

    .rp-ranking-info-principle{
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
    .rp-ranking-info-principle strong{
      display:block;
      margin-top:3px;
      color:#5edcff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.72rem;
      font-style:italic;
      font-weight:950;
      letter-spacing:.035em;
    }

    .rp-ranking-info-done{
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
      .rp-ranking-info-overlay{align-items:center}
      .rp-ranking-info-card{border-radius:24px}
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rp-ranking-mark rp-ranking-info-button';
  button.dataset.rpRankingInfoButton = 'true';
  button.textContent = 'i';
  button.setAttribute('aria-label', 'About Open Rank');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'rp-open-rank-info');
  oldMark.replaceWith(button);

  const overlay = document.createElement('section');
  overlay.className = 'rp-ranking-info-overlay';
  overlay.id = 'rp-open-rank-info';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rp-open-rank-info-title');
  overlay.innerHTML = `
    <div class="rp-ranking-info-card">
      <header class="rp-ranking-info-head">
        <div>
          <small>REAL PLAY COMPETITIVE SYSTEM</small>
          <h2 id="rp-open-rank-info-title">ABOUT OPEN RANK</h2>
        </div>
        <button class="rp-ranking-info-close" type="button" data-rp-ranking-info-close aria-label="Close Open Rank information">×</button>
      </header>

      <p class="rp-ranking-info-intro">Open Rank is Real Play's official ranked environment. Your verified real basketball performance becomes competitive evidence for one unified Real Play OVR.</p>

      <div class="rp-ranking-info-list">
        <article class="rp-ranking-info-item">
          <span>01</span>
          <div><strong>START UNRANKED</strong><p>New competitive players begin <b>UNRANKED</b>. Your first five verified Open Rank games build the evidence for your initial OVR.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>02</span>
          <div><strong>5 GAMES → FIRST OVR</strong><p>Games 1–4 still count as hidden provisional evidence. When Game 5 is finalized, your initial OVR is revealed from the accumulated evidence across all five games—not Game 5 alone.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>03</span>
          <div><strong>VERIFIED STATS ONLY</strong><p>Official scorer data can include points, assists, rebounds, turnovers, steals, blocks, fouls and the game result. Only verified real basketball creates rating evidence.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>04</span>
          <div><strong>GAME CONTEXT MATTERS</strong><p>Open Rank can use different approved formats or rules. The system keeps each game's rules context so a short Race-to target is not blindly compared with a longer or different format.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>05</span>
          <div><strong>AFTER YOU GET RANKED</strong><p>Later authorized ranked games can move your OVR up or down. Performance, opponent strength, expected performance, result, consistency and rules context can all matter.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>06</span>
          <div><strong>FAIR MATCHUPS</strong><p>Open Rank can temporarily divide checked-in players into sides such as East and West. Ranked players may use OVR and Unranked players may use provisional evidence to help create the fairest available game.</p></div>
        </article>
        <article class="rp-ranking-info-item">
          <span>07</span>
          <div><strong>NEXT OPEN RANK GAME</strong><p>The session card on this page shows the next announced Open Rank opportunity, confirmed participation and whether you can join, are already confirmed, or the session is full.</p></div>
        </article>
      </div>

      <div class="rp-ranking-info-principle">YOUR PUBLIC RATING STAYS SIMPLE.<strong>ONE PLAYER · ONE OVR · VERIFIED REAL PERFORMANCE</strong></div>
      <button class="rp-ranking-info-done" type="button" data-rp-ranking-info-close>GOT IT</button>
    </div>`;
  view.appendChild(overlay);

  let previousFocus = null;

  function openInfo() {
    previousFocus = document.activeElement;
    overlay.hidden = false;
    button.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('rp-ranking-info-open');
    requestAnimationFrame(() => overlay.querySelector('[data-rp-ranking-info-close]')?.focus());
  }

  function closeInfo() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    button.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('rp-ranking-info-open');
    previousFocus?.focus?.();
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (overlay.hidden) openInfo();
    else closeInfo();
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-rp-ranking-info-close]')) closeInfo();
  });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeInfo();
    }
  });

  new MutationObserver(() => {
    if (!view.classList.contains('open')) closeInfo();
  }).observe(view, { attributes: true, attributeFilter: ['class'] });
})();
