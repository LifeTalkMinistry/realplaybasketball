(() => {
  if (window.__realPlayRankingSpotPriorityInstalled) return;
  window.__realPlayRankingSpotPriorityInstalled = true;

  const STYLE_ID = 'rp-ranking-spot-priority-style';
  let view = null;
  let trigger = null;
  let overlay = null;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-ranking-next .rp-spot-priority-trigger{
        position:absolute;
        left:0;
        top:50%;
        z-index:5;
        width:34px;
        height:34px;
        margin:0;
        padding:0;
        display:grid;
        place-items:center;
        border:1px solid rgba(68,207,242,.28);
        border-radius:11px;
        background:linear-gradient(180deg,rgba(7,25,37,.96),rgba(4,13,21,.98));
        color:#76dff6;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 6px 16px rgba(0,0,0,.20);
        transform:translateY(-50%);
        appearance:none;
        -webkit-appearance:none;
        cursor:pointer;
      }
      .rp-ranking-next .rp-spot-priority-trigger:hover,
      .rp-ranking-next .rp-spot-priority-trigger:focus-visible{
        border-color:rgba(75,218,250,.48);
        background:linear-gradient(180deg,rgba(8,31,45,.98),rgba(5,17,27,.99));
        outline:none;
      }
      .rp-ranking-next .rp-spot-priority-trigger svg{width:17px;height:17px;display:block}

      .rp-spot-priority-overlay{
        position:fixed;
        inset:0;
        z-index:2450;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        padding:18px 12px max(18px,env(safe-area-inset-bottom));
        box-sizing:border-box;
        background:rgba(0,3,7,.70);
        backdrop-filter:blur(7px);
        -webkit-backdrop-filter:blur(7px);
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transition:opacity .18s ease,visibility .18s ease;
      }
      .rp-spot-priority-overlay.is-open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
      }
      .rp-spot-priority-sheet{
        width:min(100%,430px);
        max-height:min(82dvh,680px);
        overflow:auto;
        box-sizing:border-box;
        padding:10px 14px 16px;
        border:1px solid rgba(65,200,238,.28);
        border-radius:24px 24px 18px 18px;
        background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -18px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
        transform:translateY(18px);
        transition:transform .18s ease;
      }
      .rp-spot-priority-overlay.is-open .rp-spot-priority-sheet{transform:translateY(0)}
      .rp-spot-priority-grab{
        width:52px;
        height:4px;
        margin:1px auto 8px;
        border-radius:999px;
        background:rgba(146,171,190,.34);
      }
      .rp-spot-priority-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:5px 1px 12px;
      }
      .rp-spot-priority-head small{
        display:block;
        margin-bottom:4px;
        color:#60d9f2;
        font:950 .46rem/1 Arial,sans-serif;
        letter-spacing:.12em;
        text-transform:uppercase;
      }
      .rp-spot-priority-head h2{
        margin:0;
        color:#f7fbff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:1.32rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.025em;
        line-height:1;
        text-transform:uppercase;
      }
      .rp-spot-priority-close{
        flex:0 0 auto;
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid rgba(255,255,255,.12);
        border-radius:50%;
        background:rgba(255,255,255,.035);
        color:#aebdca;
        font:700 1rem/1 Arial,sans-serif;
        cursor:pointer;
      }
      .rp-spot-priority-list{display:grid;gap:8px}
      .rp-spot-priority-row{
        display:grid;
        grid-template-columns:31px minmax(0,1fr);
        gap:11px;
        align-items:start;
        padding:11px 12px;
        border:1px solid rgba(102,153,184,.13);
        border-radius:13px;
        background:rgba(4,13,21,.72);
      }
      .rp-spot-priority-row:first-child{
        border-color:rgba(83,224,189,.20);
        background:rgba(16,54,49,.24);
      }
      .rp-spot-priority-number{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        border:1px solid rgba(74,207,242,.22);
        border-radius:9px;
        color:#65dff7;
        font:950 .67rem/1 Arial,sans-serif;
      }
      .rp-spot-priority-row:first-child .rp-spot-priority-number{
        border-color:rgba(94,231,196,.24);
        color:#7aebca;
      }
      .rp-spot-priority-copy strong{
        display:block;
        margin:1px 0 4px;
        color:#eef7fc;
        font:900 .68rem/1.15 Arial,sans-serif;
        letter-spacing:.035em;
        text-transform:uppercase;
      }
      .rp-spot-priority-copy p{
        margin:0;
        color:#8192a5;
        font:650 .61rem/1.42 Arial,sans-serif;
      }
      .rp-spot-priority-cap{
        margin-top:11px;
        padding:11px 12px;
        border:1px solid rgba(73,205,239,.18);
        border-radius:13px;
        background:rgba(24,115,144,.08);
        text-align:center;
      }
      .rp-spot-priority-cap span{
        display:block;
        color:#72879a;
        font:900 .43rem/1 Arial,sans-serif;
        letter-spacing:.11em;
        text-transform:uppercase;
      }
      .rp-spot-priority-cap strong{
        display:block;
        margin-top:5px;
        color:#eef8fc;
        font:950 .76rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        letter-spacing:.035em;
        text-transform:uppercase;
      }
      .rp-spot-priority-chain{
        margin:11px 0 1px;
        color:#65798c;
        font:900 .47rem/1.35 Arial,sans-serif;
        letter-spacing:.055em;
        text-align:center;
        text-transform:uppercase;
      }
      .rp-spot-priority-chain b{color:#69dff7;font-weight:950}
      @media(max-width:390px){
        .rp-ranking-next .rp-spot-priority-trigger{width:32px;height:32px;border-radius:10px}
        .rp-spot-priority-sheet{padding-left:12px;padding-right:12px}
        .rp-spot-priority-head h2{font-size:1.2rem}
      }
    `;
    document.head.appendChild(style);
  }

  function capacityLabel() {
    const total = view?.querySelector('[data-rp-ranking-access-total]');
    const text = String(total?.textContent || '').trim();
    const match = text.match(/\d+\s*\/\s*(\d+)/);
    return match ? `SECURED CAPACITY · ${Number(match[1])} PLAYERS` : 'SECURED CAPACITY · SESSION LIMIT';
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rp-spot-priority-overlay';
    overlay.dataset.rpSpotPriorityOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-spot-priority-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-spot-priority-title">
        <div class="rp-spot-priority-grab" aria-hidden="true"></div>
        <header class="rp-spot-priority-head">
          <div><small>HOW SPOTS ARE SECURED</small><h2 id="rp-spot-priority-title">SPOT PRIORITY</h2></div>
          <button class="rp-spot-priority-close" type="button" aria-label="Close spot priority">×</button>
        </header>
        <div class="rp-spot-priority-list">
          <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">1</span><div class="rp-spot-priority-copy"><strong>Play Token · Highest Priority</strong><p>Uses 1 Play Token. The spot is secured immediately while session capacity is available.</p></div></article>
          <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">2</span><div class="rp-spot-priority-copy"><strong>GCash Pay-to-Play</strong><p>₱50 prepaid entry. It has priority over an unpaid Cash Pay-to-Play entry.</p></div></article>
          <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">3</span><div class="rp-spot-priority-copy"><strong>Cash Pay-to-Play</strong><p>₱50 due at the court. The spot is provisional and can move behind higher-priority secured entries if capacity fills.</p></div></article>
          <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">4</span><div class="rp-spot-priority-copy"><strong>Free Standby</strong><p>No guaranteed spot. A standby player can play only when secured capacity becomes available.</p></div></article>
        </div>
        <div class="rp-spot-priority-cap"><span>SESSION LIMIT</span><strong data-rp-spot-priority-capacity>SECURED CAPACITY</strong></div>
        <p class="rp-spot-priority-chain"><b>PLAY TOKEN</b> → GCASH → CASH → FREE STANDBY</p>
      </section>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.rp-spot-priority-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    return overlay;
  }

  function open() {
    const node = ensureOverlay();
    const cap = node.querySelector('[data-rp-spot-priority-capacity]');
    if (cap) cap.textContent = capacityLabel();
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => node.querySelector('.rp-spot-priority-close')?.focus({ preventScroll:true }), 20);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    try { trigger?.focus({ preventScroll:true }); } catch (_error) {}
  }

  function mount() {
    view = document.querySelector('[data-rp-ranking-games]');
    const head = view?.querySelector('.rp-ranking-next .rp-ranking-section-head');
    if (!view || !head) return false;
    installStyles();

    trigger = head.querySelector('[data-rp-spot-priority]');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rp-spot-priority-trigger';
      trigger.dataset.rpSpotPriority = 'true';
      trigger.setAttribute('aria-label', 'How secured spot priority works');
      trigger.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6h9M5 12h12M5 18h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M17.5 5.5v5m0 0-2-2m2 2 2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      trigger.addEventListener('click', open);
      head.appendChild(trigger);
    }
    return true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay?.classList.contains('is-open')) close();
  });

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }
})();
