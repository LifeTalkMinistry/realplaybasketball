(() => {
  if (window.__realPlayRankingSpotPriorityInstalled) return;
  window.__realPlayRankingSpotPriorityInstalled = true;

  const STYLE_ID = 'rp-ranking-spot-priority-style';
  const GUIDE_IMAGE_PATH = 'assets/guides/16-player-priority-guide.png';

  let view = null;
  let trigger = null;
  let overlay = null;
  let guideOverlay = null;
  let guideReturnFocus = null;
  let activeTab = 'priority';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-ranking-next .rp-spot-priority-trigger{
        position:absolute;left:0;top:50%;z-index:5;width:34px;height:34px;margin:0;padding:0;
        display:grid;place-items:center;border:1px solid rgba(68,207,242,.28);border-radius:11px;
        background:linear-gradient(180deg,rgba(7,25,37,.96),rgba(4,13,21,.98));color:#76dff6;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 6px 16px rgba(0,0,0,.20);
        transform:translateY(-50%);appearance:none;-webkit-appearance:none;cursor:pointer;
      }
      .rp-ranking-next .rp-spot-priority-trigger:hover,
      .rp-ranking-next .rp-spot-priority-trigger:focus-visible{
        border-color:rgba(75,218,250,.48);background:linear-gradient(180deg,rgba(8,31,45,.98),rgba(5,17,27,.99));outline:none;
      }
      .rp-ranking-next .rp-spot-priority-trigger svg{width:17px;height:17px;display:block}

      .rp-spot-priority-overlay{
        position:fixed;inset:0;z-index:2450;display:flex;align-items:flex-end;justify-content:center;
        padding:18px 12px max(18px,env(safe-area-inset-bottom));box-sizing:border-box;background:rgba(0,3,7,.70);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .18s ease,visibility .18s ease;
      }
      .rp-spot-priority-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .rp-spot-priority-sheet{
        width:min(100%,430px);max-height:min(84dvh,720px);overflow:auto;box-sizing:border-box;padding:10px 14px 16px;
        border:1px solid rgba(65,200,238,.28);border-radius:24px 24px 18px 18px;
        background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -18px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
        transform:translateY(18px);transition:transform .18s ease;scrollbar-width:none;
      }
      .rp-spot-priority-sheet::-webkit-scrollbar{display:none}
      .rp-spot-priority-overlay.is-open .rp-spot-priority-sheet{transform:translateY(0)}
      .rp-spot-priority-grab{width:52px;height:4px;margin:1px auto 8px;border-radius:999px;background:rgba(146,171,190,.34)}
      .rp-spot-priority-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 1px 11px}
      .rp-spot-priority-head > div:first-child{min-width:0;flex:1 1 auto}
      .rp-spot-priority-head small{display:block;margin-bottom:4px;color:#60d9f2;font:950 .46rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-spot-priority-head h2{margin:0;color:#f7fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.32rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1;text-transform:uppercase}
      .rp-spot-priority-head-actions{flex:0 0 auto;display:flex;align-items:center;gap:8px}
      .rp-spot-priority-more{
        min-width:78px;height:34px;padding:0 13px;border:1px solid rgba(73,216,249,.34);border-radius:11px;
        background:linear-gradient(180deg,rgba(11,55,73,.72),rgba(5,26,38,.82));color:#72e4fb;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 6px 18px rgba(0,0,0,.18);
        font:900 .58rem/1 Arial,sans-serif;letter-spacing:.035em;cursor:pointer;appearance:none;-webkit-appearance:none;
      }
      .rp-spot-priority-more:hover,.rp-spot-priority-more:focus-visible{
        border-color:rgba(73,216,249,.62);background:linear-gradient(180deg,rgba(14,73,96,.82),rgba(6,34,49,.9));color:#b8f3ff;outline:none;
      }
      .rp-spot-priority-close{
        flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);
        border-radius:50%;background:rgba(255,255,255,.035);color:#aebdca;font:700 1rem/1 Arial,sans-serif;cursor:pointer;
      }

      .rp-session-guide-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 11px;padding:4px;border:1px solid rgba(88,151,185,.14);border-radius:12px;background:rgba(2,10,17,.52)}
      .rp-session-guide-tab{min-height:36px;padding:0 8px;border:1px solid transparent;border-radius:9px;background:transparent;color:#72879a;font:950 .55rem/1 Arial,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer;appearance:none;-webkit-appearance:none}
      .rp-session-guide-tab:hover,.rp-session-guide-tab:focus-visible{color:#c7d8e4;outline:none}
      .rp-session-guide-tab.is-active{border-color:rgba(73,216,249,.50);background:linear-gradient(180deg,rgba(14,78,101,.46),rgba(8,43,60,.55));color:#68e1f9;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 0 18px rgba(50,203,241,.08)}
      .rp-session-guide-panel[hidden]{display:none!important}

      .rp-spot-priority-list{display:grid;gap:8px}
      .rp-spot-priority-row{display:grid;grid-template-columns:31px minmax(0,1fr);gap:11px;align-items:start;padding:11px 12px;border:1px solid rgba(102,153,184,.13);border-radius:13px;background:rgba(4,13,21,.72)}
      .rp-session-guide-panel[data-rp-session-guide-panel="priority"] .rp-spot-priority-row:first-child{border-color:rgba(83,224,189,.20);background:rgba(16,54,49,.24)}
      .rp-session-guide-panel[data-rp-session-guide-panel="setup"] .rp-spot-priority-row{border-color:rgba(73,205,239,.14);background:linear-gradient(180deg,rgba(5,18,28,.76),rgba(3,12,20,.78))}
      .rp-spot-priority-number{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(74,207,242,.22);border-radius:9px;color:#65dff7;font:950 .67rem/1 Arial,sans-serif}
      .rp-session-guide-panel[data-rp-session-guide-panel="priority"] .rp-spot-priority-row:first-child .rp-spot-priority-number{border-color:rgba(94,231,196,.24);color:#7aebca}
      .rp-spot-priority-copy strong{display:block;margin:1px 0 4px;color:#eef7fc;font:900 .68rem/1.15 Arial,sans-serif;letter-spacing:.035em;text-transform:uppercase}
      .rp-spot-priority-copy p{margin:0;color:#8192a5;font:650 .61rem/1.42 Arial,sans-serif}
      .rp-spot-priority-cap{margin-top:11px;padding:11px 12px;border:1px solid rgba(73,205,239,.18);border-radius:13px;background:rgba(24,115,144,.08);text-align:center}
      .rp-spot-priority-cap span{display:block;color:#72879a;font:900 .43rem/1 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-spot-priority-cap strong{display:block;margin-top:5px;color:#eef8fc;font:950 .76rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);letter-spacing:.035em;text-transform:uppercase}
      .rp-spot-priority-chain{margin:11px 0 1px;color:#65798c;font:900 .47rem/1.35 Arial,sans-serif;letter-spacing:.055em;text-align:center;text-transform:uppercase}
      .rp-spot-priority-chain b{color:#69dff7;font-weight:950}
      .rp-game-setup-note{margin:10px 2px 0;color:#65798c;font:750 .50rem/1.45 Arial,sans-serif;text-align:center}

      .rp-priority-guide-overlay{
        position:fixed;inset:0;z-index:2600;display:flex;align-items:center;justify-content:center;
        padding:max(14px,env(safe-area-inset-top)) 12px max(14px,env(safe-area-inset-bottom));box-sizing:border-box;
        background:rgba(0,3,7,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
        opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease;
      }
      .rp-priority-guide-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .rp-priority-guide-shell{
        position:relative;width:min(100%,720px);max-height:94dvh;overflow:auto;border:1px solid rgba(73,216,249,.28);
        border-radius:18px;background:#03070b;box-shadow:0 22px 70px rgba(0,0,0,.62);scrollbar-width:none;
      }
      .rp-priority-guide-shell::-webkit-scrollbar{display:none}
      .rp-priority-guide-close{
        position:sticky;top:10px;z-index:2;float:right;margin:10px 10px -46px 0;width:38px;height:38px;display:grid;place-items:center;
        border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(3,10,15,.88);color:#eef7fc;
        box-shadow:0 5px 18px rgba(0,0,0,.35);font:800 1.05rem/1 Arial,sans-serif;cursor:pointer;
      }
      .rp-priority-guide-image{display:block;width:100%;height:auto;background:#020306}
      .rp-priority-guide-error{display:none;min-height:280px;padding:72px 24px 32px;box-sizing:border-box;text-align:center;color:#b9c9d6;font:700 .82rem/1.55 Arial,sans-serif}
      .rp-priority-guide-error strong{display:block;margin-bottom:8px;color:#f2f8fc;font-size:1rem}
      .rp-priority-guide-shell.has-error .rp-priority-guide-image{display:none}
      .rp-priority-guide-shell.has-error .rp-priority-guide-error{display:block}

      @media(max-width:390px){
        .rp-ranking-next .rp-spot-priority-trigger{width:32px;height:32px;border-radius:10px}
        .rp-spot-priority-sheet{padding-left:12px;padding-right:12px}
        .rp-spot-priority-head{gap:8px}
        .rp-spot-priority-head h2{font-size:1.2rem}
        .rp-spot-priority-head-actions{gap:6px}
        .rp-spot-priority-more{min-width:68px;height:32px;padding:0 10px;font-size:.53rem}
        .rp-spot-priority-close{width:34px;height:34px}
        .rp-session-guide-tab{font-size:.50rem;letter-spacing:.04em}
        .rp-priority-guide-overlay{padding-left:8px;padding-right:8px}
        .rp-priority-guide-shell{border-radius:14px}
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

  function setupCapacityLabel() {
    const total = view?.querySelector('[data-rp-ranking-access-total]');
    const text = String(total?.textContent || '').trim();
    const match = text.match(/\d+\s*\/\s*(\d+)/);
    const capacity = match ? Number(match[1]) : 16;
    return `${capacity} PLAYERS · 4V4 · 5-SET TARGET`;
  }

  function syncTab(nextTab = activeTab) {
    if (!overlay) return;
    activeTab = nextTab === 'setup' ? 'setup' : 'priority';

    overlay.querySelectorAll('[data-rp-session-guide-tab]').forEach((button) => {
      const selected = button.dataset.rpSessionGuideTab === activeTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    });

    overlay.querySelectorAll('[data-rp-session-guide-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.rpSessionGuidePanel !== activeTab;
    });
  }

  function ensureGuideOverlay() {
    if (guideOverlay) return guideOverlay;

    guideOverlay = document.createElement('div');
    guideOverlay.className = 'rp-priority-guide-overlay';
    guideOverlay.dataset.rpPriorityGuideOverlay = 'true';
    guideOverlay.setAttribute('aria-hidden', 'true');
    guideOverlay.innerHTML = `
      <section class="rp-priority-guide-shell" role="dialog" aria-modal="true" aria-label="16-player priority explanation">
        <button class="rp-priority-guide-close" type="button" aria-label="Close priority explanation">×</button>
        <img class="rp-priority-guide-image" data-rp-priority-guide-image src="${GUIDE_IMAGE_PATH}" alt="How the Real Play 16-player priority system works" />
        <div class="rp-priority-guide-error" data-rp-priority-guide-error>
          <strong>Guide image not found.</strong>
          Upload the image to <code>${GUIDE_IMAGE_PATH}</code> and this button will display it here.
        </div>
      </section>`;

    document.body.appendChild(guideOverlay);

    const shell = guideOverlay.querySelector('.rp-priority-guide-shell');
    const image = guideOverlay.querySelector('[data-rp-priority-guide-image]');
    image?.addEventListener('load', () => shell?.classList.remove('has-error'));
    image?.addEventListener('error', () => shell?.classList.add('has-error'));
    guideOverlay.querySelector('.rp-priority-guide-close')?.addEventListener('click', closeGuideImage);
    guideOverlay.addEventListener('click', (event) => {
      if (event.target === guideOverlay) closeGuideImage();
    });

    return guideOverlay;
  }

  function openGuideImage(event) {
    guideReturnFocus = event?.currentTarget || document.activeElement;
    const node = ensureGuideOverlay();
    const shell = node.querySelector('.rp-priority-guide-shell');
    const image = node.querySelector('[data-rp-priority-guide-image]');
    shell?.classList.remove('has-error');
    if (image) image.src = GUIDE_IMAGE_PATH;
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => node.querySelector('.rp-priority-guide-close')?.focus({ preventScroll:true }), 20);
  }

  function closeGuideImage() {
    if (!guideOverlay) return;
    guideOverlay.classList.remove('is-open');
    guideOverlay.setAttribute('aria-hidden', 'true');
    try { guideReturnFocus?.focus({ preventScroll:true }); } catch (_error) {}
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rp-spot-priority-overlay';
    overlay.dataset.rpSpotPriorityOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-spot-priority-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-session-guide-title">
        <div class="rp-spot-priority-grab" aria-hidden="true"></div>
        <header class="rp-spot-priority-head">
          <div><small>HOW REAL PLAY WORKS</small><h2 id="rp-session-guide-title">SESSION GUIDE</h2></div>
          <div class="rp-spot-priority-head-actions">
            <button class="rp-spot-priority-more" type="button" data-rp-spot-priority-more aria-label="Open full spot priority explanation">Click Me</button>
            <button class="rp-spot-priority-close" type="button" aria-label="Close session guide">×</button>
          </div>
        </header>

        <div class="rp-session-guide-tabs" role="tablist" aria-label="Session guide sections">
          <button class="rp-session-guide-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="rp-session-guide-priority" data-rp-session-guide-tab="priority">SPOT PRIORITY</button>
          <button class="rp-session-guide-tab" type="button" role="tab" aria-selected="false" aria-controls="rp-session-guide-setup" data-rp-session-guide-tab="setup" tabindex="-1">GAME SET UP</button>
        </div>

        <div class="rp-session-guide-panel" id="rp-session-guide-priority" role="tabpanel" data-rp-session-guide-panel="priority">
          <div class="rp-spot-priority-list">
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">1</span><div class="rp-spot-priority-copy"><strong>Play Token · Highest Priority</strong><p>Uses 1 Play Token. The spot is secured immediately while session capacity is available.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">2</span><div class="rp-spot-priority-copy"><strong>GCash Pay-to-Play</strong><p>₱50 prepaid entry. It has priority over an unpaid Cash Pay-to-Play entry.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">3</span><div class="rp-spot-priority-copy"><strong>Cash Pay-to-Play</strong><p>₱50 due at the court. The spot is provisional and can move behind higher-priority secured entries if capacity fills.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">4</span><div class="rp-spot-priority-copy"><strong>Free Standby</strong><p>No guaranteed spot. A standby player can play only when secured capacity becomes available.</p></div></article>
          </div>
          <div class="rp-spot-priority-cap"><span>SESSION LIMIT</span><strong data-rp-spot-priority-capacity>SECURED CAPACITY</strong></div>
          <p class="rp-spot-priority-chain"><b>PLAY TOKEN</b> → GCASH → CASH → FREE STANDBY</p>
        </div>

        <div class="rp-session-guide-panel" id="rp-session-guide-setup" role="tabpanel" data-rp-session-guide-panel="setup" hidden>
          <div class="rp-spot-priority-list">
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">1</span><div class="rp-spot-priority-copy"><strong>15 Minutes Per Set</strong><p>Each set has a maximum 15-minute game window so the session keeps moving.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">2</span><div class="rp-spot-priority-copy"><strong>Race to 8 · 12-Second Shot Clock</strong><p>First team to 8 wins. Every possession must attack within 12 seconds, preventing a team from simply holding the ball while ahead.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">3</span><div class="rp-spot-priority-copy"><strong>5-Set Target Per Player</strong><p>Every completed set counts toward the player’s session total. A full-session player is targeted for about 5 sets.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">4</span><div class="rp-spot-priority-copy"><strong>Late Arrival & Rotation</strong><p>Players below the 5-set target receive rotation priority. Late players join the remaining rotation, and the session does not extend.</p></div></article>
          </div>
          <div class="rp-spot-priority-cap"><span>SESSION SET UP</span><strong data-rp-game-setup-capacity>16 PLAYERS · 4V4 · 5-SET TARGET</strong></div>
          <p class="rp-game-setup-note">3 HOURS · FAST-PACED SETS · FAIR ROTATION</p>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    overlay.querySelector('.rp-spot-priority-close')?.addEventListener('click', close);
    overlay.querySelector('[data-rp-spot-priority-more]')?.addEventListener('click', openGuideImage);
    overlay.querySelectorAll('[data-rp-session-guide-tab]').forEach((button) => {
      button.addEventListener('click', () => syncTab(button.dataset.rpSessionGuideTab));
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    syncTab(activeTab);
    return overlay;
  }

  function open() {
    const node = ensureOverlay();
    const cap = node.querySelector('[data-rp-spot-priority-capacity]');
    if (cap) cap.textContent = capacityLabel();
    const setupCap = node.querySelector('[data-rp-game-setup-capacity]');
    if (setupCap) setupCap.textContent = setupCapacityLabel();
    syncTab(activeTab);
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => node.querySelector('.rp-session-guide-tab.is-active')?.focus({ preventScroll:true }), 20);
  }

  function close() {
    if (!overlay) return;
    if (guideOverlay?.classList.contains('is-open')) closeGuideImage();
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
      trigger.setAttribute('aria-label', 'Open spot priority and game set up guide');
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
    if (guideOverlay?.classList.contains('is-open') && event.key === 'Escape') {
      event.preventDefault();
      closeGuideImage();
      return;
    }

    if (!overlay?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = activeTab === 'priority' ? 'setup' : 'priority';
    syncTab(next);
    overlay.querySelector('.rp-session-guide-tab.is-active')?.focus({ preventScroll:true });
  });

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }
})();


(() => {
  if (window.__realPlayPriorityGuideZoomInstalled) return;
  window.__realPlayPriorityGuideZoomInstalled = true;

  const STYLE_ID = 'rp-priority-guide-zoom-style';
  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function installZoomStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-priority-guide-shell[data-rp-zoom-ready="true"]{overflow:hidden!important}
      .rp-priority-guide-shell[data-rp-zoom-ready="true"] .rp-priority-guide-close{
        position:absolute!important;top:10px!important;right:10px!important;float:none!important;margin:0!important;z-index:8!important;
      }
      .rp-priority-guide-zoom-viewport{
        width:100%;max-height:94dvh;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
        touch-action:pan-x pan-y;scrollbar-width:none;background:#020306;
      }
      .rp-priority-guide-zoom-viewport::-webkit-scrollbar{display:none}
      .rp-priority-guide-zoom-viewport .rp-priority-guide-image{
        display:block!important;width:100%;max-width:none!important;height:auto!important;margin:0;transform:none!important;
        transform-origin:top left;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;
      }
      .rp-priority-guide-zoom-controls{
        position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));z-index:9;display:flex;align-items:center;gap:6px;
        padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(2,8,12,.86);
        box-shadow:0 8px 30px rgba(0,0,0,.38);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);transform:translateX(-50%);
      }
      .rp-priority-guide-zoom-button,.rp-priority-guide-zoom-readout{
        height:34px;min-width:38px;padding:0 10px;border:1px solid rgba(93,216,246,.24);border-radius:999px;
        background:rgba(8,31,43,.88);color:#eaf9fd;font:900 .7rem/1 Arial,sans-serif;appearance:none;-webkit-appearance:none;cursor:pointer;
      }
      .rp-priority-guide-zoom-button{width:38px;padding:0;font-size:1.05rem}
      .rp-priority-guide-zoom-readout{min-width:64px;color:#74e6fb}
      .rp-priority-guide-zoom-button:focus-visible,.rp-priority-guide-zoom-readout:focus-visible{
        outline:2px solid rgba(103,229,252,.55);outline-offset:2px;
      }
      .rp-priority-guide-zoom-hint{
        position:absolute;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 50px);z-index:8;padding:5px 9px;
        border-radius:999px;background:rgba(2,8,12,.72);color:#8296a7;font:800 .52rem/1 Arial,sans-serif;
        letter-spacing:.05em;text-transform:uppercase;pointer-events:none;transform:translateX(-50%);
      }
      @media(max-width:390px){
        .rp-priority-guide-zoom-controls{bottom:max(9px,env(safe-area-inset-bottom));padding:5px}
        .rp-priority-guide-zoom-button,.rp-priority-guide-zoom-readout{height:32px}
        .rp-priority-guide-zoom-button{width:36px;min-width:36px}
        .rp-priority-guide-zoom-readout{min-width:58px;padding:0 8px}
        .rp-priority-guide-zoom-hint{bottom:calc(max(9px,env(safe-area-inset-bottom)) + 46px);font-size:.48rem}
      }
    `;
    document.head.appendChild(style);
  }

  function touchDistance(a, b) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function touchMidpoint(a, b, rect) {
    return {
      x: ((a.clientX + b.clientX) / 2) - rect.left,
      y: ((a.clientY + b.clientY) / 2) - rect.top,
    };
  }

  function enhanceGuideOverlay() {
    const overlay = document.querySelector('[data-rp-priority-guide-overlay]');
    const shell = overlay?.querySelector('.rp-priority-guide-shell');
    const image = overlay?.querySelector('[data-rp-priority-guide-image]');
    if (!overlay || !shell || !image) return false;
    if (shell.dataset.rpZoomReady === 'true') return true;

    installZoomStyles();
    shell.dataset.rpZoomReady = 'true';

    const viewport = document.createElement('div');
    viewport.className = 'rp-priority-guide-zoom-viewport';
    viewport.setAttribute('aria-label', 'Zoomable priority guide image');
    image.parentNode.insertBefore(viewport, image);
    viewport.appendChild(image);

    const controls = document.createElement('div');
    controls.className = 'rp-priority-guide-zoom-controls';
    controls.setAttribute('aria-label', 'Image zoom controls');
    controls.innerHTML = `
      <button class="rp-priority-guide-zoom-button" type="button" data-rp-guide-zoom-out aria-label="Zoom out">−</button>
      <button class="rp-priority-guide-zoom-readout" type="button" data-rp-guide-zoom-reset aria-label="Reset zoom">100%</button>
      <button class="rp-priority-guide-zoom-button" type="button" data-rp-guide-zoom-in aria-label="Zoom in">+</button>
    `;

    const hint = document.createElement('div');
    hint.className = 'rp-priority-guide-zoom-hint';
    hint.textContent = 'Pinch or use + / −';
    shell.appendChild(hint);
    shell.appendChild(controls);

    const readout = controls.querySelector('[data-rp-guide-zoom-reset]');
    const zoomIn = controls.querySelector('[data-rp-guide-zoom-in]');
    const zoomOut = controls.querySelector('[data-rp-guide-zoom-out]');

    let scale = 1;
    let pinch = null;
    let gestureStartScale = 1;

    function updateReadout() {
      if (readout) readout.textContent = `${Math.round(scale * 100)}%`;
      shell.classList.toggle('is-zoomed', scale > 1.001);
    }

    function setScale(nextScale, anchor = null) {
      const next = clamp(Number(nextScale) || 1, MIN_SCALE, MAX_SCALE);
      const old = scale;
      if (Math.abs(next - old) < 0.001) return;

      const x = anchor?.x ?? (viewport.clientWidth / 2);
      const y = anchor?.y ?? (viewport.clientHeight / 2);
      const oldLeft = viewport.scrollLeft;
      const oldTop = viewport.scrollTop;

      scale = next;
      image.style.width = `${scale * 100}%`;
      updateReadout();

      window.requestAnimationFrame(() => {
        const ratio = scale / old;
        viewport.scrollLeft = Math.max(0, ((oldLeft + x) * ratio) - x);
        viewport.scrollTop = Math.max(0, ((oldTop + y) * ratio) - y);
      });
    }

    function resetZoom(scrollTop = true) {
      scale = 1;
      image.style.width = '100%';
      updateReadout();
      viewport.scrollLeft = 0;
      if (scrollTop) viewport.scrollTop = 0;
    }

    zoomIn?.addEventListener('click', () => setScale(scale + 0.5));
    zoomOut?.addEventListener('click', () => setScale(scale - 0.5));
    readout?.addEventListener('click', () => resetZoom(false));

    viewport.addEventListener('dblclick', (event) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      setScale(scale > 1.01 ? 1 : 2, { x:event.clientX - rect.left, y:event.clientY - rect.top });
    });

    viewport.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      setScale(scale * (event.deltaY < 0 ? 1.18 : 0.84), { x:event.clientX - rect.left, y:event.clientY - rect.top });
    }, { passive:false });

    viewport.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return;
      pinch = {
        distance:touchDistance(event.touches[0], event.touches[1]),
        scale,
      };
    }, { passive:true });

    viewport.addEventListener('touchmove', (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const currentDistance = touchDistance(event.touches[0], event.touches[1]);
      if (!currentDistance || !pinch.distance) return;
      const rect = viewport.getBoundingClientRect();
      const center = touchMidpoint(event.touches[0], event.touches[1], rect);
      setScale(pinch.scale * (currentDistance / pinch.distance), center);
    }, { passive:false });

    viewport.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) pinch = null;
    }, { passive:true });
    viewport.addEventListener('touchcancel', () => { pinch = null; }, { passive:true });

    viewport.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      gestureStartScale = scale;
    }, { passive:false });
    viewport.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      setScale(gestureStartScale * Number(event.scale || 1));
    }, { passive:false });
    viewport.addEventListener('gestureend', (event) => event.preventDefault(), { passive:false });

    overlay.querySelector('.rp-priority-guide-close')?.addEventListener('click', () => resetZoom(true));

    const overlayObserver = new MutationObserver(() => {
      if (!overlay.classList.contains('is-open')) resetZoom(true);
    });
    overlayObserver.observe(overlay, { attributes:true, attributeFilter:['class'] });

    updateReadout();
    return true;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-spot-priority-more]')) return;
    window.setTimeout(enhanceGuideOverlay, 0);
  }, true);

  const observer = new MutationObserver(() => enhanceGuideOverlay());
  observer.observe(document.documentElement, { childList:true, subtree:true });
  enhanceGuideOverlay();
})();
