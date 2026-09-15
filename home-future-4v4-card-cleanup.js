(() => {
  if (window.__realPlayFuture4v4CardCleanupInstalled) return;
  window.__realPlayFuture4v4CardCleanupInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';
  const TOKEN_KEY = 'real_play_access_token';
  const VIEW_ATTR = 'data-rp-4v4-team-view';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4{
        min-height:108px!important;
        padding:18px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>strong{
        display:block!important;
        margin:0!important;
        font-size:1.08rem!important;
        line-height:1.05!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4 .rp-home-4v4-explore{
        margin-top:16px!important;
      }

      body.rp-4v4-team-open{overflow:hidden!important}
      body.rp-4v4-team-open .rp-bottom-nav,
      body.rp-4v4-team-open .rp-simple-nav{display:none!important}

      .rp-4v4-team-view{
        z-index:760!important;
        background:
          radial-gradient(circle at 12% -4%,rgba(29,220,255,.13),transparent 30%),
          radial-gradient(circle at 92% 32%,rgba(222,45,66,.10),transparent 34%),
          linear-gradient(180deg,#040914 0%,#02050b 62%,#010308 100%)!important;
      }
      .rp-4v4-team-view .rp-3v3-shell::before{
        opacity:.035!important;
      }
      .rp-4v4-team-intro{
        position:relative;
        z-index:2;
        padding:34px 4px 10px;
        text-align:center;
      }
      .rp-4v4-team-intro>small{
        display:block;
        margin-bottom:8px;
        color:#58dcff;
        font-size:.48rem;
        font-weight:950;
        letter-spacing:.18em;
        text-transform:uppercase;
      }
      .rp-4v4-team-intro h1{
        margin:0;
        color:#fff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:clamp(2.55rem,12vw,4rem);
        font-style:italic;
        font-weight:950;
        line-height:.88;
        letter-spacing:-.04em;
        text-transform:uppercase;
      }
      .rp-4v4-team-intro p{
        max-width:430px;
        margin:15px auto 0;
        color:#8294a6;
        font-size:.67rem;
        font-weight:720;
        line-height:1.55;
      }
      .rp-4v4-team-intro p strong{color:#dbeaf5}

      .rp-4v4-roster-card,
      .rp-4v4-rule-card,
      .rp-4v4-ovr-card{
        position:relative;
        z-index:2;
        margin-top:14px;
        border:1px solid rgba(126,173,232,.11);
        border-radius:20px;
        background:linear-gradient(155deg,rgba(10,23,38,.94),rgba(3,7,14,.98));
        box-shadow:0 18px 50px rgba(0,0,0,.22);
      }
      .rp-4v4-roster-card{padding:18px}
      .rp-4v4-roster-head{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
        padding-bottom:13px;
        border-bottom:1px solid rgba(255,255,255,.055);
      }
      .rp-4v4-roster-head small,
      .rp-4v4-rule-card small,
      .rp-4v4-ovr-card small{
        display:block;
        color:#647a90;
        font-size:.44rem;
        font-weight:950;
        letter-spacing:.15em;
        text-transform:uppercase;
      }
      .rp-4v4-roster-head strong{
        display:block;
        margin-top:4px;
        color:#eff8ff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.88rem;
        font-weight:950;
        letter-spacing:.035em;
      }
      .rp-4v4-roster-head b{
        color:#58dcff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.72rem;
        font-weight:950;
        letter-spacing:.05em;
      }
      .rp-4v4-roster-list{
        display:grid;
        gap:7px;
        margin-top:12px;
      }
      .rp-4v4-roster-slot{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        min-height:50px;
        padding:8px 10px;
        border:1px solid rgba(255,255,255,.055);
        border-radius:13px;
        background:rgba(255,255,255,.018);
      }
      .rp-4v4-roster-slot>span:first-child{
        display:grid;
        place-items:center;
        width:32px;
        height:32px;
        border-radius:9px;
        color:#dffaff;
        background:rgba(40,173,221,.075);
        border:1px solid rgba(74,219,255,.13);
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.62rem;
        font-weight:950;
      }
      .rp-4v4-slot-copy strong{
        display:block;
        color:#dce7ef;
        font-size:.57rem;
        font-weight:950;
        letter-spacing:.035em;
      }
      .rp-4v4-slot-copy small{
        display:block;
        margin-top:3px;
        color:#617589;
        font-size:.39rem;
        font-weight:850;
        letter-spacing:.07em;
        text-transform:uppercase;
      }
      .rp-4v4-slot-state{
        color:#6f8294;
        font-size:.38rem;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
        white-space:nowrap;
      }
      .rp-4v4-roster-slot.is-captain .rp-4v4-slot-state{color:#58dcff}

      .rp-4v4-rule-card{padding:16px}
      .rp-4v4-rule-card strong{
        display:block;
        margin:6px 0 6px;
        color:#edf5fb;
        font-size:.74rem;
        font-weight:950;
        letter-spacing:.025em;
      }
      .rp-4v4-rule-card p{
        margin:0;
        color:#7d90a2;
        font-size:.58rem;
        font-weight:700;
        line-height:1.5;
      }
      .rp-4v4-rule-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
        margin-top:13px;
      }
      .rp-4v4-rule-mini{
        min-height:102px;
        padding:13px;
        border:1px solid rgba(255,255,255,.055);
        border-radius:14px;
        background:rgba(255,255,255,.016);
      }
      .rp-4v4-rule-mini b{
        display:block;
        color:#eef7fc;
        font-size:.61rem;
        font-weight:950;
      }
      .rp-4v4-rule-mini span{
        display:block;
        margin-top:7px;
        color:#708397;
        font-size:.49rem;
        font-weight:720;
        line-height:1.45;
      }

      .rp-4v4-ovr-card{
        padding:16px;
        margin-bottom:26px;
      }
      .rp-4v4-ovr-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        margin-top:6px;
      }
      .rp-4v4-ovr-row strong{
        color:#f5fbff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:1.02rem;
        font-weight:950;
      }
      .rp-4v4-ovr-row b{
        color:#8a9cad;
        font-size:.43rem;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .rp-4v4-ovr-track{
        position:relative;
        height:7px;
        margin:12px 0 9px;
        overflow:hidden;
        border-radius:999px;
        background:#0e1720;
      }
      .rp-4v4-ovr-track::before{
        content:'';
        position:absolute;
        left:23%;
        width:54%;
        inset-block:0;
        border-radius:inherit;
        background:linear-gradient(90deg,rgba(69,213,255,.58),rgba(112,225,245,.85),rgba(255,101,118,.64));
      }
      .rp-4v4-ovr-card p{
        margin:0;
        color:#718496;
        font-size:.51rem;
        font-weight:720;
        line-height:1.45;
      }
      .rp-4v4-page-note{
        position:relative;
        z-index:2;
        margin:0 0 26px;
        color:#586b7e;
        text-align:center;
        font-size:.43rem;
        font-weight:900;
        letter-spacing:.10em;
        line-height:1.5;
        text-transform:uppercase;
      }
      @media(max-width:370px){
        .rp-4v4-rule-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCard() {
    installStyle();
    const card = document.querySelector('[data-rp-home-future-4v4="true"]')
      || document.querySelector('.rp-home-coming-card.is-4v4');
    if (!card) return false;

    card.querySelector(':scope > small')?.remove();
    card.querySelector(':scope > p')?.remove();
    card.querySelector(':scope > .rp-home-4v4-path')?.remove();

    const title = card.querySelector(':scope > strong');
    if (title && title.textContent.trim() !== '4V4 LEAGUE') {
      title.textContent = '4V4 LEAGUE';
    }

    const action = card.querySelector('.rp-home-4v4-explore');
    if (action && action.textContent.trim() !== 'JOIN A TEAM NOW') {
      action.textContent = 'JOIN A TEAM NOW';
      action.setAttribute('aria-label', 'Join a team now');
    }

    return Boolean(title && action);
  }

  function closeRoadmap() {
    const roadmap = document.querySelector('[data-rp-home-coming-backdrop]');
    if (roadmap) roadmap.hidden = true;
    document.body.classList.remove('rp-home-coming-open');

    const oldPreview = document.querySelector('[data-rp-home-future-4v4-preview]');
    if (oldPreview) oldPreview.hidden = true;
    document.body.classList.remove('rp-home-team-preview-open');
  }

  function ensureDedicatedView() {
    let view = document.querySelector(`[${VIEW_ATTR}]`);
    if (view) return view;

    view = document.createElement('section');
    view.className = 'rp-3v3-view rp-4v4-team-view';
    view.setAttribute(VIEW_ATTR, 'true');
    view.setAttribute('aria-hidden', 'true');
    view.innerHTML = `
      <div class="rp-3v3-shell">
        <header class="rp-3v3-topbar">
          <button class="rp-3v3-back" type="button" aria-label="Back to Home" data-rp-4v4-back>←</button>
          <div class="rp-3v3-brand"><strong>REAL PLAY 4V4</strong><span>TEAM FORMATION</span></div>
          <div class="rp-3v3-topmark">4V4</div>
        </header>

        <section class="rp-4v4-team-intro">
          <small>FUTURE LEAGUE</small>
          <h1>FORM YOUR TEAM.</h1>
          <p>Build with verified Real Play players. <strong>Choose freely — but the final roster must pass the League Team OVR range.</strong></p>
        </section>

        <section class="rp-4v4-roster-card">
          <div class="rp-4v4-roster-head">
            <div><small>YOUR ROSTER</small><strong>4 ON COURT · MAX 5 PLAYERS</strong></div>
            <b>0 / 5</b>
          </div>
          <div class="rp-4v4-roster-list">
            <div class="rp-4v4-roster-slot is-captain">
              <span>C</span>
              <span class="rp-4v4-slot-copy"><strong>TEAM CAPTAIN</strong><small>Official ranked player</small></span>
              <span class="rp-4v4-slot-state">Not selected</span>
            </div>
            <div class="rp-4v4-roster-slot"><span>2</span><span class="rp-4v4-slot-copy"><strong>ROSTER SLOT</strong><small>Verified ranked player</small></span><span class="rp-4v4-slot-state">Open</span></div>
            <div class="rp-4v4-roster-slot"><span>3</span><span class="rp-4v4-slot-copy"><strong>ROSTER SLOT</strong><small>Verified ranked player</small></span><span class="rp-4v4-slot-state">Open</span></div>
            <div class="rp-4v4-roster-slot"><span>4</span><span class="rp-4v4-slot-copy"><strong>ROSTER SLOT</strong><small>Verified ranked player</small></span><span class="rp-4v4-slot-state">Open</span></div>
            <div class="rp-4v4-roster-slot"><span>5</span><span class="rp-4v4-slot-copy"><strong>OPTIONAL SUBSTITUTE</strong><small>Verified ranked player</small></span><span class="rp-4v4-slot-state">Open</span></div>
          </div>
        </section>

        <section class="rp-4v4-rule-card">
          <small>TEAM FORMATION RULE</small>
          <strong>REAL PLAY DOES NOT CHOOSE YOUR FRIENDS.</strong>
          <p>You can form the team you want. Real Play only decides whether the finished roster is competitively legal.</p>
          <div class="rp-4v4-rule-grid">
            <div class="rp-4v4-rule-mini"><b>PLAYER ELIGIBILITY</b><span>League rosters come from verified Real Play players with an official Rank.</span></div>
            <div class="rp-4v4-rule-mini"><b>TEAM OVR BAND</b><span>The roster must stay between the League minimum and maximum Team OVR limits.</span></div>
          </div>
        </section>

        <section class="rp-4v4-ovr-card">
          <small>TEAM OVR CHECK</small>
          <div class="rp-4v4-ovr-row"><strong>— OVR</strong><b>Awaiting roster</b></div>
          <div class="rp-4v4-ovr-track" aria-hidden="true"></div>
          <p>The legal Team OVR range will be applied when the official League cycle opens. Strong and weak rosters can both be required to adjust before approval.</p>
        </section>

        <p class="rp-4v4-page-note">Dedicated 4V4 Team Formation · Roster selection will connect to verified Real Play player data next.</p>
      </div>`;

    document.body.appendChild(view);
    view.querySelector('[data-rp-4v4-back]')?.addEventListener('click', closeDedicatedView);
    return view;
  }

  function openDedicatedView() {
    if (!localStorage.getItem(TOKEN_KEY)) {
      closeRoadmap();
      document.querySelector('[data-auth-open]')?.click();
      return;
    }

    closeRoadmap();
    const view = ensureDedicatedView();
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-3v3-open', 'rp-4v4-team-open');
    view.scrollTop = 0;
    window.setTimeout(() => view.querySelector('[data-rp-4v4-back]')?.focus({ preventScroll: true }), 0);
  }

  function closeDedicatedView() {
    const view = document.querySelector(`[${VIEW_ATTR}]`);
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-4v4-team-open');

    // Keep the shared 3V3 body lock only if the original 3V3 view is actually open.
    if (!document.querySelector('.rp-3v3-view.open:not(.rp-4v4-team-view)')) {
      document.body.classList.remove('rp-3v3-open');
    }
  }

  cleanCard();

  const observer = new MutationObserver(() => {
    cleanCard();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Capture before the legacy preview button handler. JOIN A TEAM NOW now owns a
  // dedicated full-screen destination instead of the old bottom-sheet preview.
  document.addEventListener('click', (event) => {
    const action = event.target.closest('.rp-home-4v4-explore');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDedicatedView();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const view = document.querySelector(`[${VIEW_ATTR}].open`);
    if (!view) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDedicatedView();
  }, true);

  window.RealPlayFuture4v4Team = {
    open: openDedicatedView,
    close: closeDedicatedView,
  };
})();