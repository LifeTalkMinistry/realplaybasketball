(() => {
  if (window.__realPlayIPhoneGameSkipsInstalled) return;
  window.__realPlayIPhoneGameSkipsInstalled = true;

  const ua = String(navigator.userAgent || '');
  if (!/iPhone|iPod/i.test(ua)) return;

  const BUTTON_ATTR = 'data-rp-career-replay-game-skips';
  const PANEL_ATTR = 'data-rp-career-replay-game-skips-panel';
  const BALL_ATTR = 'data-rp-career-replay-game-skip-ball';
  const SOURCE_SELECTOR = '[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]';
  const STYLE_ID = 'rp-career-replay-iphone-game-skips-style';

  let activeStage = null;
  let syncTimer = 0;
  const revealTimers = new WeakMap();

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-career-replay-game-skips-button{
        position:absolute;
        z-index:7;
        top:8px;
        right:54px;
        min-width:112px;
        height:38px;
        padding:0 11px;
        border:1px solid rgba(88,211,241,.32);
        border-radius:11px;
        background:rgba(3,17,26,.86);
        color:#f4fbff;
        box-shadow:0 8px 22px rgba(0,0,0,.3);
        backdrop-filter:blur(10px);
        -webkit-backdrop-filter:blur(10px);
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.06em;
        white-space:nowrap;
        cursor:pointer;
        touch-action:manipulation;
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease;
      }
      .rp-career-replay-game-skips-button.show,
      .rp-career-replay-game-skips-button.open{
        opacity:1;
        pointer-events:auto;
      }
      .rp-career-replay-game-skips-button:focus-visible{
        outline:2px solid rgba(69,199,255,.72);
        outline-offset:2px;
      }
      .rp-career-replay-game-skips-panel{
        position:absolute;
        z-index:14;
        left:50%;
        bottom:max(12px,env(safe-area-inset-bottom));
        width:min(calc(100% - 24px),720px);
        box-sizing:border-box;
        padding:9px 12px 12px;
        border:1px solid rgba(86,214,245,.34);
        border-radius:14px;
        background:rgba(2,12,19,.91);
        box-shadow:0 14px 34px rgba(0,0,0,.42);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        transform:translateX(-50%);
        color:#f5fbff;
        pointer-events:auto;
      }
      .rp-career-replay-game-skips-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:8px;
      }
      .rp-career-replay-game-skips-head div{
        min-width:0;
      }
      .rp-career-replay-game-skips-head strong{
        display:block;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.62rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.08em;
      }
      .rp-career-replay-game-skips-head small{
        display:block;
        margin-top:2px;
        color:#7ca2b4;
        font-size:.46rem;
        font-weight:800;
        letter-spacing:.03em;
      }
      .rp-career-replay-game-skips-close{
        flex:0 0 auto;
        width:30px;
        height:30px;
        padding:0;
        border:1px solid rgba(160,205,221,.18);
        border-radius:9px;
        background:#091923;
        color:#fff;
        font-size:1rem;
        line-height:1;
      }
      .rp-career-replay-game-skips-track{
        position:relative;
        height:42px;
        margin:0 8px;
      }
      .rp-career-replay-game-skips-track::before{
        content:'';
        position:absolute;
        left:0;
        right:0;
        top:50%;
        height:3px;
        border-radius:999px;
        background:rgba(214,235,243,.25);
        box-shadow:0 1px 7px rgba(0,0,0,.28);
        transform:translateY(-50%);
      }
      .rp-career-replay-game-skip-ball{
        position:absolute;
        z-index:2;
        top:50%;
        width:30px;
        height:30px;
        padding:0;
        display:grid;
        place-items:center;
        border:1px solid rgba(122,221,241,.2);
        border-radius:50%;
        background:rgba(2,12,19,.88);
        color:#fff;
        box-shadow:0 5px 14px rgba(0,0,0,.28);
        transform:translate(-50%,-50%);
        font-size:19px;
        line-height:1;
        cursor:pointer;
        touch-action:manipulation;
      }
      .rp-career-replay-game-skip-ball.active{
        transform:translate(-50%,-50%) scale(1.2);
        border-color:rgba(122,221,241,.72);
        filter:drop-shadow(0 0 6px rgba(47,213,238,.9));
      }
      .rp-career-replay-game-skips-empty{
        padding:8px 4px 4px;
        color:#7898a7;
        font-size:.52rem;
        font-weight:800;
        text-align:center;
      }
      @media(max-width:620px){
        .rp-career-replay-game-skips-button{
          top:7px;
          right:49px;
          min-width:104px;
          height:36px;
          padding:0 9px;
          border-radius:10px;
          font-size:.54rem;
        }
        .rp-career-replay-game-skips-panel{
          bottom:max(10px,env(safe-area-inset-bottom));
          width:calc(100% - 18px);
        }
      }
      @media(prefers-reduced-motion:reduce){
        .rp-career-replay-game-skips-button{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  function sourceMarkers(stage) {
    const replayRoot = stage?.closest?.('.rp-career-replay');
    if (!replayRoot) return [];
    return [...replayRoot.querySelectorAll(SOURCE_SELECTOR)];
  }

  function closePanel(stage) {
    const panel = stage?.querySelector?.(`[${PANEL_ATTR}]`);
    panel?.remove();
    stage?.querySelector?.(`[${BUTTON_ATTR}]`)?.classList.remove('open');
    if (activeStage === stage) activeStage = null;
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = 0;
    }
  }

  function syncPanel(stage) {
    const panel = stage?.querySelector?.(`[${PANEL_ATTR}]`);
    const track = panel?.querySelector('.rp-career-replay-game-skips-track');
    if (!track) return;

    const sources = sourceMarkers(stage);
    const balls = [...track.querySelectorAll(`[${BALL_ATTR}]`)];
    sources.forEach((source, index) => {
      const ball = balls[index];
      if (!ball) return;
      const left = String(source.style.left || '').trim();
      if (left) ball.style.left = left;
      ball.classList.toggle('active', source.classList.contains('active'));
    });
  }

  function buildPanel(stage) {
    closePanel(stage);
    const panel = document.createElement('div');
    panel.className = 'rp-career-replay-game-skips-panel';
    panel.setAttribute(PANEL_ATTR, '1');
    panel.innerHTML = `
      <div class="rp-career-replay-game-skips-head">
        <div><strong>🏀 GAME SKIPS</strong><small>TAP A BASKET · JUMP 7 SECONDS BEFORE · OPEN FULLSCREEN</small></div>
        <button type="button" class="rp-career-replay-game-skips-close" aria-label="Close game skips">×</button>
      </div>
      <div class="rp-career-replay-game-skips-track"></div>`;

    const track = panel.querySelector('.rp-career-replay-game-skips-track');
    const sources = sourceMarkers(stage);

    if (!sources.length) {
      track.replaceWith(Object.assign(document.createElement('div'), {
        className: 'rp-career-replay-game-skips-empty',
        textContent: 'NO MADE-BASKET SKIPS ARE AVAILABLE FOR THIS GAME YET.',
      }));
    } else {
      sources.forEach((source, index) => {
        const ball = document.createElement('button');
        ball.type = 'button';
        ball.className = 'rp-career-replay-game-skip-ball';
        ball.setAttribute(BALL_ATTR, '1');
        ball.dataset.rpGameSkipIndex = String(index);
        ball.textContent = '🏀';
        ball.setAttribute('aria-label', source.getAttribute('aria-label') || 'Jump to made basket');
        ball.title = source.title || 'Jump to made basket';
        if (source.style.left) ball.style.left = source.style.left;
        track.appendChild(ball);
      });
    }

    stage.appendChild(panel);
    stage.querySelector(`[${BUTTON_ATTR}]`)?.classList.add('open');
    activeStage = stage;

    panel.querySelector('.rp-career-replay-game-skips-close')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePanel(stage);
      reveal(stage, 2600);
    });

    panel.addEventListener('click', (event) => {
      const ball = event.target?.closest?.(`[${BALL_ATTR}]`);
      if (!ball) return;
      event.preventDefault();
      event.stopPropagation();

      const index = Number(ball.dataset.rpGameSkipIndex || 0);
      const source = sourceMarkers(stage)[index];
      if (!source) return;

      // Reuse the official Real Play marker logic, including the existing
      // seven-second lead-in. Then immediately hand the same user gesture to
      // the native iPhone fullscreen button so the selected play opens like
      // YouTube fullscreen instead of losing the skip feature.
      source.click();
      closePanel(stage);
      stage.querySelector('[data-rp-career-replay-expand-fixed]')?.click();
    });

    syncPanel(stage);
    syncTimer = window.setInterval(() => {
      if (!panel.isConnected || activeStage !== stage) {
        if (syncTimer) clearInterval(syncTimer);
        syncTimer = 0;
        return;
      }
      syncPanel(stage);
    }, 120);
  }

  function reveal(stage, ms = 3000) {
    if (!stage?.isConnected) return;
    const button = stage.querySelector(`[${BUTTON_ATTR}]`);
    if (!button) return;
    button.classList.add('show');
    const old = revealTimers.get(stage);
    if (old) clearTimeout(old);
    if (button.classList.contains('open')) return;
    const timer = window.setTimeout(() => {
      if (!button.classList.contains('open')) button.classList.remove('show');
    }, ms);
    revealTimers.set(stage, timer);
  }

  function ensure(stage) {
    if (!stage || stage.querySelector(`[${BUTTON_ATTR}]`)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-career-replay-game-skips-button';
    button.setAttribute(BUTTON_ATTR, '1');
    button.setAttribute('aria-label', 'Open made basket game skips');
    button.textContent = '🏀 GAME SKIPS';
    stage.appendChild(button);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (stage.querySelector(`[${PANEL_ATTR}]`)) closePanel(stage);
      else buildPanel(stage);
      reveal(stage, 3000);
    });

    const show = () => reveal(stage, 3000);
    stage.addEventListener('pointerdown', show, { passive: true });
    stage.addEventListener('touchstart', show, { passive: true });
    stage.addEventListener('click', show);
    reveal(stage, 3500);
  }

  function enhance() {
    document.querySelectorAll('[data-rp-career-replay-stage]').forEach(ensure);
    if (activeStage && !activeStage.isConnected) closePanel(activeStage);
  }

  installStyles();
  enhance();

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
