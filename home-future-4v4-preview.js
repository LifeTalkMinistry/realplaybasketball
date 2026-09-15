(() => {
  if (window.__realPlayFuture4v4PreviewInstalled) return;
  window.__realPlayFuture4v4PreviewInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-preview-style';
  const PREVIEW_ATTR = 'data-rp-home-future-4v4-preview';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4{
        min-height:142px!important;
        padding:17px!important;
        border-color:rgba(71,214,255,.18)!important;
        background:
          radial-gradient(80% 100% at 0% 50%,rgba(38,190,255,.10),transparent 70%),
          radial-gradient(82% 100% at 100% 50%,rgba(255,62,82,.075),transparent 72%),
          #050a10!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 30px rgba(0,0,0,.20)!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4::before{
        background-image:
          linear-gradient(90deg,rgba(3,8,13,.96),rgba(3,8,13,.64)),
          url('assets/home/home-3v3.png?v=20260915-future-4v4-preview-v1')!important;
        opacity:.12!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>small{
        color:#58dcff!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>strong{
        font-size:1.02rem!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>p{
        max-width:92%!important;
        color:#8fa1b3!important;
      }
      .rp-home-4v4-path{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        margin:12px 0 0;
      }
      .rp-home-4v4-path span{
        display:inline-flex;
        align-items:center;
        min-height:22px;
        padding:4px 7px;
        border:1px solid rgba(255,255,255,.065);
        border-radius:999px;
        background:rgba(255,255,255,.025);
        color:#71869a;
        font-size:.39rem;
        font-weight:950;
        letter-spacing:.09em;
        text-transform:uppercase;
      }
      .rp-home-4v4-explore{
        width:100%;
        min-height:38px;
        margin-top:13px;
        border:1px solid rgba(70,214,255,.22);
        border-radius:11px;
        background:linear-gradient(180deg,rgba(15,70,94,.30),rgba(4,16,25,.76));
        color:#dff8ff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.52rem;
        font-weight:950;
        letter-spacing:.11em;
        text-transform:uppercase;
        cursor:pointer;
      }
      .rp-home-4v4-explore:active{transform:scale(.994)}

      .rp-home-team-preview-backdrop{
        position:fixed;
        inset:0;
        z-index:720;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        background:rgba(0,2,5,.80);
        -webkit-backdrop-filter:blur(9px);
        backdrop-filter:blur(9px);
      }
      .rp-home-team-preview-backdrop[hidden]{display:none!important}
      .rp-home-team-preview-sheet{
        width:min(100%,620px);
        max-height:min(88dvh,780px);
        overflow:auto;
        padding:18px 16px calc(20px + env(safe-area-inset-bottom));
        border:1px solid rgba(255,255,255,.09);
        border-bottom:0;
        border-radius:24px 24px 0 0;
        background:
          radial-gradient(90% 55% at 0% 0%,rgba(31,174,237,.095),transparent 68%),
          radial-gradient(90% 55% at 100% 0%,rgba(220,43,62,.07),transparent 70%),
          linear-gradient(180deg,#080e16 0%,#03070c 100%);
        box-shadow:0 -30px 70px rgba(0,0,0,.66);
      }
      .rp-home-team-preview-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        margin-bottom:14px;
      }
      .rp-home-team-preview-head small{
        display:block;
        margin-bottom:5px;
        color:#58dcff;
        font-size:.42rem;
        font-weight:950;
        letter-spacing:.16em;
        text-transform:uppercase;
      }
      .rp-home-team-preview-head h2{
        margin:0;
        color:#f5f8fb;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:1.25rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.03em;
        line-height:1;
      }
      .rp-home-team-preview-close{
        width:34px;
        height:34px;
        flex:0 0 34px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:50%;
        background:#0b1119;
        color:#a8b7c6;
        font-size:1rem;
        cursor:pointer;
      }
      .rp-home-team-preview-hero{
        position:relative;
        overflow:hidden;
        padding:18px;
        border:1px solid rgba(255,255,255,.075);
        border-radius:17px;
        background:linear-gradient(145deg,rgba(7,18,29,.96),rgba(4,8,14,.98));
      }
      .rp-home-team-preview-hero::after{
        content:'';
        position:absolute;
        left:0;
        right:0;
        top:0;
        height:1px;
        background:linear-gradient(90deg,rgba(57,220,255,.72),rgba(255,255,255,.08) 52%,rgba(255,59,79,.58));
      }
      .rp-home-team-preview-hero>small{
        color:#71869a;
        font-size:.41rem;
        font-weight:950;
        letter-spacing:.14em;
        text-transform:uppercase;
      }
      .rp-home-team-preview-hero>strong{
        display:block;
        margin:7px 0 6px;
        color:#f7fbff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:1.10rem;
        font-style:italic;
        font-weight:950;
        line-height:1.05;
      }
      .rp-home-team-preview-hero>p{
        margin:0;
        color:#8fa1b3;
        font-size:.61rem;
        font-weight:700;
        line-height:1.48;
      }
      .rp-home-team-preview-meta{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:13px;
      }
      .rp-home-team-preview-meta span{
        padding:6px 8px;
        border:1px solid rgba(255,255,255,.07);
        border-radius:999px;
        color:#8497a9;
        background:rgba(255,255,255,.025);
        font-size:.40rem;
        font-weight:950;
        letter-spacing:.10em;
        text-transform:uppercase;
      }
      .rp-home-team-rule-card{
        margin-top:11px;
        padding:16px;
        border:1px solid rgba(255,255,255,.07);
        border-radius:17px;
        background:#050a10;
      }
      .rp-home-team-rule-card>small{
        display:block;
        color:#667b8f;
        font-size:.41rem;
        font-weight:950;
        letter-spacing:.15em;
        text-transform:uppercase;
      }
      .rp-home-team-rule-card>strong{
        display:block;
        margin:6px 0 5px;
        color:#ecf3f8;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.83rem;
        font-weight:950;
        letter-spacing:.025em;
      }
      .rp-home-team-rule-card>p{
        margin:0;
        color:#8192a3;
        font-size:.57rem;
        font-weight:700;
        line-height:1.46;
      }
      .rp-home-captain-demo{
        display:grid;
        gap:7px;
        margin-top:13px;
      }
      .rp-home-captain-row{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        min-height:48px;
        padding:8px 9px;
        border:1px solid rgba(255,255,255,.065);
        border-radius:12px;
        background:rgba(255,255,255,.018);
      }
      .rp-home-captain-rank{
        display:flex;
        align-items:center;
        justify-content:center;
        height:31px;
        border-radius:9px;
        border:1px solid rgba(76,214,255,.14);
        background:rgba(28,118,159,.10);
        color:#dff8ff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.70rem;
        font-weight:950;
      }
      .rp-home-captain-copy strong{
        display:block;
        color:#dce6ee;
        font-size:.56rem;
        font-weight:950;
        letter-spacing:.045em;
      }
      .rp-home-captain-copy small{
        display:block;
        margin-top:3px;
        color:#65788b;
        font-size:.39rem;
        font-weight:850;
        letter-spacing:.07em;
        text-transform:uppercase;
      }
      .rp-home-captain-status{
        padding:5px 7px;
        border:1px solid rgba(76,214,255,.14);
        border-radius:999px;
        color:#71dfff;
        background:rgba(38,154,199,.075);
        font-size:.36rem;
        font-weight:950;
        letter-spacing:.07em;
        text-transform:uppercase;
        white-space:nowrap;
      }
      .rp-home-captain-row.is-next .rp-home-captain-status{
        color:#8898a8;
        border-color:rgba(255,255,255,.07);
        background:transparent;
      }
      .rp-home-captain-row.is-transferred{
        border-color:rgba(80,221,255,.22);
        background:rgba(32,151,194,.06);
        box-shadow:inset 0 0 0 1px rgba(80,221,255,.03);
      }
      .rp-home-captain-row.is-transferred .rp-home-captain-status{
        color:#dffaff;
        border-color:rgba(80,221,255,.28);
      }
      .rp-home-captain-row.is-declined{
        opacity:.68;
      }
      .rp-home-captain-row.is-declined .rp-home-captain-status{
        color:#b3bdc6;
        border-color:rgba(255,255,255,.09);
        background:rgba(255,255,255,.025);
      }
      .rp-home-captain-demo-action{
        width:100%;
        min-height:38px;
        margin-top:10px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:11px;
        background:#0a1119;
        color:#a9bac9;
        font-size:.48rem;
        font-weight:950;
        letter-spacing:.10em;
        text-transform:uppercase;
        cursor:pointer;
      }
      .rp-home-captain-demo-message{
        margin:10px 0 0;
        padding:10px 11px;
        border-left:2px solid #49d9ff;
        background:rgba(38,151,196,.055);
        color:#9eb0bf;
        font-size:.52rem;
        font-weight:750;
        line-height:1.45;
      }
      .rp-home-team-ovr-gate{
        margin-top:13px;
        padding:13px;
        border:1px solid rgba(255,255,255,.065);
        border-radius:13px;
        background:linear-gradient(90deg,rgba(41,178,230,.055),rgba(255,255,255,.015) 50%,rgba(215,49,68,.045));
      }
      .rp-home-team-ovr-gate-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .rp-home-team-ovr-gate-head strong{
        color:#e9f1f7;
        font-size:.60rem;
        font-weight:950;
        letter-spacing:.045em;
      }
      .rp-home-team-ovr-gate-head span{
        color:#ff8a97;
        font-size:.39rem;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .rp-home-team-ovr-track{
        position:relative;
        height:7px;
        margin:10px 0;
        overflow:hidden;
        border-radius:999px;
        background:#101820;
      }
      .rp-home-team-ovr-track::before{
        content:'';
        display:block;
        width:73%;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,#39dcff 0%,#7adff5 60%,#ff6676 100%);
        opacity:.72;
      }
      .rp-home-team-ovr-track::after{
        content:'';
        position:absolute;
        top:-2px;
        bottom:-2px;
        left:78%;
        width:1px;
        background:#ff6b7b;
        box-shadow:0 0 8px rgba(255,75,93,.72);
      }
      .rp-home-team-ovr-gate p{
        margin:0;
        color:#7f91a2;
        font-size:.52rem;
        font-weight:700;
        line-height:1.45;
      }
      .rp-home-team-flow{
        display:flex;
        align-items:center;
        gap:5px;
        margin-top:12px;
        overflow-x:auto;
        padding-bottom:2px;
        scrollbar-width:none;
      }
      .rp-home-team-flow::-webkit-scrollbar{display:none}
      .rp-home-team-flow span{
        flex:0 0 auto;
        color:#7990a3;
        font-size:.39rem;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .rp-home-team-flow b{
        flex:0 0 auto;
        color:#435566;
        font-size:.55rem;
      }
      .rp-home-team-preview-note{
        margin:13px 2px 0;
        color:#5f7182;
        font-size:.43rem;
        font-weight:850;
        letter-spacing:.07em;
        line-height:1.5;
        text-align:center;
        text-transform:uppercase;
      }
      body.rp-home-team-preview-open{overflow:hidden!important}

      @media(max-width:380px){
        .rp-home-team-preview-sheet{padding-left:13px;padding-right:13px}
        .rp-home-captain-row{grid-template-columns:38px minmax(0,1fr);gap:7px}
        .rp-home-captain-status{grid-column:2;justify-self:start}
      }
    `;
    document.head.appendChild(style);
  }

  function getRoadmapCard() {
    const list = document.querySelector('[data-rp-simple-home] .rp-home-coming-list');
    if (!list) return null;
    return list.querySelector('.rp-home-coming-card.is-3v3')
      || list.querySelector('[data-rp-home-future-4v4]');
  }

  function setScenario(joined) {
    const preview = document.querySelector(`[${PREVIEW_ATTR}]`);
    if (!preview) return;
    const rank3 = preview.querySelector('[data-rp-captain-rank="3"]');
    const rank5 = preview.querySelector('[data-rp-captain-rank="5"]');
    const rank3Copy = rank3?.querySelector('[data-rp-captain-copy]');
    const rank3Status = rank3?.querySelector('[data-rp-captain-status]');
    const rank5Copy = rank5?.querySelector('[data-rp-captain-copy]');
    const rank5Status = rank5?.querySelector('[data-rp-captain-status]');
    const action = preview.querySelector('[data-rp-captain-demo-action]');
    const message = preview.querySelector('[data-rp-captain-demo-message]');

    rank3?.classList.toggle('is-declined', joined);
    rank5?.classList.toggle('is-transferred', joined);
    if (rank3Copy) rank3Copy.textContent = joined ? 'Joins Rank #1 roster' : 'Third captain opportunity';
    if (rank3Status) rank3Status.textContent = joined ? 'Captain slot declined' : 'Captain eligible';
    if (rank5Copy) rank5Copy.textContent = joined ? 'Next highest available rank' : 'Next in line if a captain declines';
    if (rank5Status) rank5Status.textContent = joined ? 'Eligibility transferred' : 'Waiting';
    if (action) action.textContent = joined ? 'RESET EXAMPLE' : 'SHOW: #3 JOINS #1 TEAM';
    if (message) {
      message.hidden = !joined;
      message.textContent = '#3 keeps the same individual Rank and OVR. Only the captain opportunity moves down to #5 for this League cycle.';
    }
    preview.dataset.rpCaptainScenario = joined ? 'joined' : 'default';
  }

  function closePreview({ restoreFocus = true } = {}) {
    const preview = document.querySelector(`[${PREVIEW_ATTR}]`);
    if (!preview) return;
    preview.hidden = true;
    document.body.classList.remove('rp-home-team-preview-open');
    if (restoreFocus) {
      window.setTimeout(() => document.querySelector('[data-rp-home-future-4v4] .rp-home-4v4-explore')?.focus({ preventScroll: true }), 0);
    }
  }

  function openPreview() {
    const preview = ensurePreview();
    if (!preview) return;
    preview.hidden = false;
    document.body.classList.add('rp-home-team-preview-open');
    window.setTimeout(() => preview.querySelector('[data-rp-home-team-preview-close]')?.focus({ preventScroll: true }), 0);
  }

  function ensurePreview() {
    let preview = document.querySelector(`[${PREVIEW_ATTR}]`);
    if (preview) return preview;

    preview = document.createElement('div');
    preview.className = 'rp-home-team-preview-backdrop';
    preview.setAttribute(PREVIEW_ATTR, 'true');
    preview.hidden = true;
    preview.innerHTML = `
      <section class="rp-home-team-preview-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-home-team-preview-title">
        <header class="rp-home-team-preview-head">
          <div>
            <small>REAL PLAY · FUTURE COMPETITION</small>
            <h2 id="rp-home-team-preview-title">4V4 TEAM FORMATION</h2>
          </div>
          <button class="rp-home-team-preview-close" type="button" data-rp-home-team-preview-close aria-label="Close 4V4 Team Formation preview">×</button>
        </header>

        <section class="rp-home-team-preview-hero">
          <small>THE PATH FROM OPEN RANKING</small>
          <strong>RANK CAN EARN THE RIGHT TO LEAD.</strong>
          <p>The highest-ranked eligible players receive first opportunity to become Team Captains. They may accept, decline, or join another captain's roster.</p>
          <div class="rp-home-team-preview-meta">
            <span>4V4 ON COURT</span>
            <span>MAX 5-PLAYER ROSTER</span>
            <span>REAL PLAY PLAYER POOL</span>
          </div>
        </section>

        <section class="rp-home-team-rule-card">
          <small>CAPTAIN ELIGIBILITY</small>
          <strong>FIRST OPPORTUNITY FOLLOWS THE RANKING.</strong>
          <p>Real Play keeps moving down the official ranking until the required active captain slots are filled.</p>

          <div class="rp-home-captain-demo" aria-label="Captain eligibility example">
            <div class="rp-home-captain-row" data-rp-captain-rank="1">
              <span class="rp-home-captain-rank">#1</span>
              <span class="rp-home-captain-copy"><strong>Rank #1</strong><small>First captain opportunity</small></span>
              <span class="rp-home-captain-status">Captain eligible</span>
            </div>
            <div class="rp-home-captain-row" data-rp-captain-rank="2">
              <span class="rp-home-captain-rank">#2</span>
              <span class="rp-home-captain-copy"><strong>Rank #2</strong><small>Second captain opportunity</small></span>
              <span class="rp-home-captain-status">Captain eligible</span>
            </div>
            <div class="rp-home-captain-row" data-rp-captain-rank="3">
              <span class="rp-home-captain-rank">#3</span>
              <span class="rp-home-captain-copy"><strong>Rank #3</strong><small data-rp-captain-copy>Third captain opportunity</small></span>
              <span class="rp-home-captain-status" data-rp-captain-status>Captain eligible</span>
            </div>
            <div class="rp-home-captain-row" data-rp-captain-rank="4">
              <span class="rp-home-captain-rank">#4</span>
              <span class="rp-home-captain-copy"><strong>Rank #4</strong><small>Fourth captain opportunity</small></span>
              <span class="rp-home-captain-status">Captain eligible</span>
            </div>
            <div class="rp-home-captain-row is-next" data-rp-captain-rank="5">
              <span class="rp-home-captain-rank">#5</span>
              <span class="rp-home-captain-copy"><strong>Rank #5</strong><small data-rp-captain-copy>Next in line if a captain declines</small></span>
              <span class="rp-home-captain-status" data-rp-captain-status>Waiting</span>
            </div>
          </div>

          <button class="rp-home-captain-demo-action" type="button" data-rp-captain-demo-action>SHOW: #3 JOINS #1 TEAM</button>
          <p class="rp-home-captain-demo-message" data-rp-captain-demo-message hidden></p>
        </section>

        <section class="rp-home-team-rule-card">
          <small>TEAM OVR CAP</small>
          <strong>CHEMISTRY IS ALLOWED. STACKING IS LIMITED.</strong>
          <p>Friends and familiar teammates may request to stay together, but the proposed roster still has to fit inside the Team OVR limit approved for that League cycle.</p>
          <div class="rp-home-team-ovr-gate">
            <div class="rp-home-team-ovr-gate-head">
              <strong>TEAM OVR CHECK</strong>
              <span>Required before approval</span>
            </div>
            <div class="rp-home-team-ovr-track" aria-hidden="true"></div>
            <p>The final limit is not being hard-coded in this preview. When League rules are activated, the app can calculate the roster from verified Real Play OVR data and approve or reject the combination automatically.</p>
          </div>
        </section>

        <section class="rp-home-team-rule-card">
          <small>THE LEAGUE FLOW</small>
          <strong>OPEN RANKING BUILDS TOWARD SOMETHING.</strong>
          <div class="rp-home-team-flow" aria-label="4V4 League progression">
            <span>PLAY</span><b>→</b><span>OVR</span><b>→</b><span>RANK</span><b>→</b><span>CAPTAIN</span><b>→</b><span>ROSTER</span><b>→</b><span>TEAM OVR</span><b>→</b><span>APPROVED</span>
          </div>
        </section>

        <p class="rp-home-team-preview-note">Preview only · Team formation and League registration are not active yet.</p>
      </section>`;

    document.body.appendChild(preview);

    preview.querySelector('[data-rp-home-team-preview-close]')?.addEventListener('click', () => closePreview());
    preview.addEventListener('click', (event) => {
      if (event.target === preview) closePreview();
    });
    preview.querySelector('[data-rp-captain-demo-action]')?.addEventListener('click', () => {
      setScenario(preview.dataset.rpCaptainScenario !== 'joined');
    });

    setScenario(false);
    return preview;
  }

  function upgradeRoadmapCard() {
    const card = getRoadmapCard();
    if (!card) return false;
    if (card.dataset.rpHomeFuture4v4 === 'true') return true;

    card.dataset.rpHomeFuture4v4 = 'true';
    card.classList.remove('is-3v3');
    card.classList.add('is-4v4');
    card.innerHTML = `
      <small>FUTURE COMPETITION · NEXT STEP</small>
      <strong>4V4 LEAGUE</strong>
      <p>Your Open Ranking career can lead here. Top-ranked players get first captain opportunity, then proposed rosters must pass the Team OVR gate.</p>
      <div class="rp-home-4v4-path" aria-hidden="true">
        <span>RANK → CAPTAIN</span>
        <span>BUILD ROSTER</span>
        <span>TEAM OVR CHECK</span>
      </div>
      <button class="rp-home-4v4-explore" type="button">EXPLORE TEAM FORMATION →</button>`;

    card.querySelector('.rp-home-4v4-explore')?.addEventListener('click', openPreview);
    ensurePreview();
    return true;
  }

  function install() {
    installStyles();
    return upgradeRoadmapCard();
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 80) window.clearInterval(timer);
  }, 125);

  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const preview = document.querySelector(`[${PREVIEW_ATTR}]`);
    if (!preview || preview.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closePreview();
  }, true);
})();
