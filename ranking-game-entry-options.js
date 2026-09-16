(() => {
  if (window.__realPlayRankingGameEntryOptionsInstalled) return;
  window.__realPlayRankingGameEntryOptionsInstalled = true;

  const STYLE_ID = 'rp-ranking-entry-options-style';
  const SHEET_ATTR = 'data-rp-ranking-entry-options';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-entry-options-overlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        padding:18px 12px 0;
        background:rgba(0,0,0,.72);
        backdrop-filter:blur(10px);
        -webkit-backdrop-filter:blur(10px);
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transition:opacity .2s ease,visibility .2s ease;
      }
      .rp-entry-options-overlay.is-open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
      }
      .rp-entry-options-sheet{
        position:relative;
        width:min(100%,430px);
        max-height:calc(100dvh - 20px);
        overflow:auto;
        overscroll-behavior:contain;
        padding:10px 16px calc(18px + env(safe-area-inset-bottom));
        border:1px solid rgba(45,205,255,.24);
        border-bottom:0;
        border-radius:28px 28px 0 0;
        background:
          radial-gradient(circle at 88% 8%,rgba(30,191,255,.14),transparent 28%),
          linear-gradient(180deg,#07111b 0%,#03070c 48%,#020407 100%);
        box-shadow:0 -24px 70px rgba(0,0,0,.65),0 -1px 28px rgba(20,174,255,.08);
        transform:translateY(32px);
        transition:transform .24s cubic-bezier(.2,.85,.3,1);
        color:#f5f8ff;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      .rp-entry-options-overlay.is-open .rp-entry-options-sheet{transform:translateY(0)}
      .rp-entry-options-grab{
        width:52px;
        height:4px;
        margin:2px auto 15px;
        border-radius:999px;
        background:rgba(255,255,255,.18);
      }
      .rp-entry-options-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        margin-bottom:15px;
      }
      .rp-entry-options-head small{
        display:block;
        margin-bottom:5px;
        color:#38d5ff;
        font-size:.54rem;
        font-weight:900;
        letter-spacing:.18em;
        text-transform:uppercase;
      }
      .rp-entry-options-head h2{
        margin:0;
        color:#fff;
        font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);
        font-size:1.45rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.025em;
        line-height:1;
        text-transform:uppercase;
      }
      .rp-entry-options-head p{
        margin:7px 0 0;
        max-width:270px;
        color:#8190a4;
        font-size:.72rem;
        font-weight:650;
        line-height:1.45;
      }
      .rp-entry-options-close{
        flex:0 0 auto;
        display:grid;
        place-items:center;
        width:36px;
        height:36px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:50%;
        background:rgba(255,255,255,.04);
        color:#dfe8f4;
        font-size:1.12rem;
        line-height:1;
        cursor:pointer;
      }
      .rp-entry-option-stack{display:grid;gap:10px}
      .rp-entry-option{
        position:relative;
        width:100%;
        overflow:hidden;
        padding:15px 14px;
        border:1px solid rgba(255,255,255,.09);
        border-radius:17px;
        background:linear-gradient(145deg,rgba(15,23,34,.96),rgba(6,11,18,.98));
        color:#fff;
        text-align:left;
        cursor:pointer;
        appearance:none;
        -webkit-appearance:none;
        transition:transform .16s ease,border-color .16s ease,background .16s ease;
      }
      .rp-entry-option:active{transform:scale(.985)}
      .rp-entry-option.membership{
        border-color:rgba(45,209,255,.5);
        background:
          radial-gradient(circle at 100% 0,rgba(22,206,255,.2),transparent 38%),
          linear-gradient(135deg,rgba(10,43,75,.98),rgba(4,17,29,.99));
        box-shadow:inset 0 0 0 1px rgba(20,150,255,.08),0 8px 24px rgba(0,130,255,.08);
      }
      .rp-entry-option.membership::after{
        content:'';
        position:absolute;
        right:-42px;
        top:-58px;
        width:130px;
        height:130px;
        border-radius:50%;
        background:rgba(19,204,255,.11);
        filter:blur(4px);
        pointer-events:none;
      }
      .rp-entry-option.payplay{border-color:rgba(52,145,255,.24)}
      .rp-entry-option.standby{
        border-color:rgba(255,255,255,.07);
        background:linear-gradient(145deg,rgba(10,14,20,.92),rgba(4,7,11,.98));
      }
      .rp-entry-option-badges{
        position:relative;
        z-index:1;
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        margin-bottom:10px;
      }
      .rp-entry-option-badge{
        display:inline-flex;
        align-items:center;
        min-height:20px;
        padding:0 7px;
        border-radius:999px;
        background:rgba(255,255,255,.06);
        color:#91a1b6;
        font-size:.45rem;
        font-weight:950;
        letter-spacing:.09em;
        text-transform:uppercase;
      }
      .membership .rp-entry-option-badge.primary{
        background:rgba(35,214,255,.14);
        color:#5fe4ff;
        border:1px solid rgba(74,219,255,.2);
      }
      .standby .rp-entry-option-badge.primary{
        background:rgba(255,190,74,.08);
        color:#d8b16e;
        border:1px solid rgba(255,190,74,.12);
      }
      .rp-entry-option-main{
        position:relative;
        z-index:1;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
      }
      .rp-entry-option-copy{min-width:0}
      .rp-entry-option-copy strong{
        display:block;
        color:#f8fbff;
        font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);
        font-size:.98rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.02em;
        line-height:1.1;
        text-transform:uppercase;
      }
      .membership .rp-entry-option-copy strong{font-size:1.04rem}
      .rp-entry-option-copy p{
        margin:6px 0 0;
        color:#7e8da2;
        font-size:.66rem;
        font-weight:650;
        line-height:1.42;
      }
      .membership .rp-entry-option-copy p{color:#98a9bd}
      .rp-entry-price{
        flex:0 0 auto;
        min-width:58px;
        text-align:right;
      }
      .rp-entry-price b{
        display:block;
        color:#f8fbff;
        font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);
        font-size:1.2rem;
        font-style:italic;
        font-weight:950;
        line-height:1;
      }
      .membership .rp-entry-price b{color:#49dfff;font-size:1.35rem}
      .rp-entry-price span{
        display:block;
        margin-top:4px;
        color:#657387;
        font-size:.43rem;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .rp-entry-option-note{
        position:relative;
        z-index:1;
        margin-top:11px;
        padding:8px 10px;
        border:1px solid rgba(53,213,255,.13);
        border-radius:10px;
        background:rgba(37,204,255,.055);
        color:#8fdff2;
        font-size:.57rem;
        font-weight:800;
        line-height:1.35;
      }
      .standby .rp-entry-option-note{
        border-color:rgba(255,190,74,.10);
        background:rgba(255,190,74,.035);
        color:#a79577;
      }
      .rp-entry-options-foot{
        margin:12px 6px 0;
        color:#576579;
        font-size:.52rem;
        font-weight:700;
        line-height:1.45;
        text-align:center;
      }
      @media (min-width:700px){
        .rp-entry-options-overlay{align-items:center;padding:18px}
        .rp-entry-options-sheet{border-bottom:1px solid rgba(45,205,255,.24);border-radius:26px;padding-bottom:20px}
      }
      @media (prefers-reduced-motion:reduce){
        .rp-entry-options-overlay,.rp-entry-options-sheet,.rp-entry-option{transition:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function makeSheet() {
    const existing = document.querySelector(`[${SHEET_ATTR}]`);
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.className = 'rp-entry-options-overlay';
    overlay.setAttribute(SHEET_ATTR, 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-entry-options-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-entry-options-title">
        <div class="rp-entry-options-grab" aria-hidden="true"></div>
        <div class="rp-entry-options-head">
          <div>
            <small>JOIN RANKING GAME</small>
            <h2 id="rp-entry-options-title">CHOOSE HOW TO PLAY</h2>
            <p>Choose how you want to secure this Ranking Game.</p>
          </div>
          <button class="rp-entry-options-close" type="button" aria-label="Close entry options" data-rp-entry-close>×</button>
        </div>

        <div class="rp-entry-option-stack">
          <button class="rp-entry-option membership" type="button" data-rp-entry-choice="membership">
            <div class="rp-entry-option-badges">
              <span class="rp-entry-option-badge primary">4 PLAY TOKENS</span>
              <span class="rp-entry-option-badge">90-DAY VALIDITY</span>
            </div>
            <div class="rp-entry-option-main">
              <div class="rp-entry-option-copy">
                <strong>₱99 MONTHLY MEMBERSHIP</strong>
                <p>Get 4 Play Tokens every month. Use 1 token to secure any eligible Real Play session.</p>
              </div>
              <div class="rp-entry-price"><b>₱99</b><span>PER MONTH</span></div>
            </div>
            <div class="rp-entry-option-note">₱24.75 / TOKEN · 1 TOKEN = 1 SECURED PLAY · CONFIRMED NO-SHOW = TOKEN USED</div>
          </button>

          <button class="rp-entry-option payplay" type="button" data-rp-entry-choice="pay-to-play">
            <div class="rp-entry-option-badges">
              <span class="rp-entry-option-badge">FLEXIBLE</span>
            </div>
            <div class="rp-entry-option-main">
              <div class="rp-entry-option-copy">
                <strong>₱50 PAY TO PLAY</strong>
                <p>No monthly commitment. Pay ₱50 to secure this specific session.</p>
              </div>
              <div class="rp-entry-price"><b>₱50</b><span>THIS SESSION</span></div>
            </div>
          </button>

          <button class="rp-entry-option standby" type="button" data-rp-entry-choice="standby">
            <div class="rp-entry-option-badges">
              <span class="rp-entry-option-badge primary">NO GUARANTEED SPOT</span>
            </div>
            <div class="rp-entry-option-main">
              <div class="rp-entry-option-copy">
                <strong>FREE STANDBY</strong>
                <p>No payment and no reserved spot. Play only if a secured spot opens.</p>
              </div>
              <div class="rp-entry-price"><b>FREE</b><span>STANDBY</span></div>
            </div>
            <div class="rp-entry-option-note">Standby never displaces a confirmed paid player.</div>
          </button>
        </div>

        <p class="rp-entry-options-foot">Preview UI only — payment and token booking are not connected yet.</p>
      </section>
    `;
    document.body.appendChild(overlay);

    const close = () => closeSheet(overlay);
    overlay.querySelector('[data-rp-entry-close]')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });

    return overlay;
  }

  function openSheet() {
    installStyles();
    const overlay = makeSheet();
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    window.setTimeout(() => overlay.querySelector('[data-rp-entry-close]')?.focus(), 80);
  }

  function closeSheet(overlay = document.querySelector(`[${SHEET_ATTR}]`)) {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  installStyles();

  // Intercept the existing Join Ranking Game CTA before the legacy join handler.
  // This is intentionally UI-only: choosing a plan does not call any API yet.
  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-rp-ranking-session-action]')
      : null;
    if (!trigger || trigger.disabled) return;
    if (!/JOIN\s+RANKING\s+GAME/i.test(String(trigger.textContent || ''))) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    openSheet();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const overlay = document.querySelector(`[${SHEET_ATTR}]`);
    if (overlay?.classList.contains('is-open')) closeSheet(overlay);
  });
})();
