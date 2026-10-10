(() => {
  if (window.__realPlayCompetitionHubInstalled) return;
  window.__realPlayCompetitionHubInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  const FILTER_LABELS = [
    'RANK OVR',
    'WIN RATE',
    'MOST OVERALL MVP',
    'MOST TEAM MVP',
    'BEST SHOOTING %',
    'BEST REBOUNDER',
    'SCORING',
    'ASSISTS',
    'STEALS',
    'BLOCKS',
    'GAMES PLAYED',
    'NAME',
    'JERSEY #',
  ];

  let panel = null;
  let navObserver = null;
  let playerDecorationTimer = null;
  let presentationTimer = null;
  let overallAutoLoadTimer = null;
  let statsLoadingOverlay = null;
  let overallPlayersReady = false;
  let playerPresentation = '';
  let scopedRanking = null;
  let scopedRequestId = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function installStyles() {
    if (document.querySelector('[data-rp-competition-hub-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCompetitionHubStyles = '1';
    style.textContent = `
      body.rp-competition-hub-open{overflow:hidden!important}
      .rp-competition-hub{
        position:fixed;inset:0;z-index:620;display:none;isolation:isolate;
        background:var(--rp-player-background);color:#eef7ff;overflow:auto;-webkit-overflow-scrolling:touch;
      }
      .rp-competition-hub::before{
        content:'';position:fixed;z-index:0;left:50%;top:36%;width:min(142vw,760px);aspect-ratio:2/3;
        transform:translate(-50%,-50%);pointer-events:none;background:var(--rp-player-backdrop);
        opacity:.38;filter:brightness(.72) contrast(1.18) saturate(1.18);
        -webkit-mask-image:radial-gradient(ellipse 80% 67% at 50% 55%,#000 0 58%,rgba(0,0,0,.88) 72%,transparent 96%);
        mask-image:radial-gradient(ellipse 80% 67% at 50% 55%,#000 0 58%,rgba(0,0,0,.88) 72%,transparent 96%);
      }
      .rp-competition-hub.open{display:block}
      .rp-competition-shell{position:relative;z-index:1;width:min(100%,760px);min-height:100dvh;margin:0 auto;padding:calc(18px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom));box-sizing:border-box}
      .rp-competition-topbar{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:10px;position:sticky;top:0;z-index:4;margin:-4px -4px 18px;padding:8px 4px 12px;background:linear-gradient(180deg,rgba(2,3,7,.94) 70%,rgba(2,3,7,0));backdrop-filter:blur(10px)}
      .rp-competition-back,.rp-competition-close{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(124,204,240,.16);border-radius:13px;background:#07101a;color:#dff7ff;font:900 1rem/1 Arial,sans-serif;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
      .rp-competition-back[hidden]{visibility:hidden;display:grid!important}
      .rp-competition-heading{text-align:center;min-width:0}
      .rp-competition-heading small{display:block;color:#49d8ff;font:950 .48rem/1.2 Arial,sans-serif;letter-spacing:.18em}
      .rp-competition-heading strong{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.15rem;font-style:italic;font-weight:950;letter-spacing:.035em}
      .rp-competition-view[hidden]{display:none!important}
      .rp-competition-intro{padding:8px 4px 22px}
      .rp-competition-intro small{display:block;color:#5d7187;font:900 .54rem/1.2 Arial,sans-serif;letter-spacing:.16em}
      .rp-competition-intro h1{margin:7px 0 8px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(2rem,9vw,3.25rem);font-style:italic;font-weight:950;line-height:.95;letter-spacing:.02em}
      .rp-competition-intro p{max-width:560px;margin:0;color:#8ea1b6;font:700 .72rem/1.55 Arial,sans-serif}
      .rp-competition-card-grid{display:grid;gap:8px}
      /* STATS is a compact competition directory, not a stack of promo cards. */
      [data-rp-competition-view="hub"] .rp-competition-card-grid{margin-top:8px!important;padding:8px 0}
      [data-rp-competition-view="hub"] .rp-competition-card{
        min-height:68px;display:flex;align-items:center;gap:13px;padding:12px 15px;
        border:1px solid rgba(125,171,209,.09);border-radius:12px;
        background:linear-gradient(100deg,rgba(8,17,29,.94),rgba(3,7,13,.92));
        box-shadow:none;
      }
      [data-rp-competition-view="hub"] .rp-competition-card::before{
        content:'';width:3px;height:27px;flex:0 0 3px;border-radius:5px;
        background:rgb(var(--rp-competition-accent));opacity:.75;
      }
      [data-rp-competition-view="hub"] .rp-competition-card-copy{flex:1;min-width:0}
      [data-rp-competition-view="hub"] .rp-competition-card-copy small{margin:0 0 4px;font-size:.41rem;letter-spacing:.13em}
      [data-rp-competition-view="hub"] .rp-competition-card-copy strong{font-size:1.13rem;letter-spacing:.04em}
      [data-rp-competition-view="hub"] .rp-competition-card-copy p{margin:4px 0 0;font-size:.57rem;line-height:1.35}
      [data-rp-competition-view="hub"] .rp-competition-card-arrow{
        width:28px;height:28px;border:0;border-radius:8px;
        font-size:.92rem;background:transparent;
      }
      .rp-competition-card.openrank{--rp-competition-accent:93,178,255}
      .rp-openrank-detail{display:grid;gap:12px;margin-top:7px;padding:20px 17px;
        border:1px solid rgba(93,178,255,.18);border-radius:17px;
        background:linear-gradient(145deg,rgba(8,23,38,.96),rgba(3,8,17,.94));}
      .rp-openrank-detail small{color:#5db2ff;font:900 .47rem Arial,sans-serif;letter-spacing:.14em}
      .rp-openrank-detail h2{margin:0;color:#f3f9ff;font:italic 950 1.55rem Impact,'Arial Narrow',Arial,sans-serif}
      .rp-openrank-detail p{margin:0;color:#96aabd;font:650 .72rem/1.6 Arial,sans-serif}
      .rp-openrank-history{min-height:44px;border:1px solid rgba(87,214,255,.34);
        border-radius:11px;background:linear-gradient(110deg,rgba(15,95,136,.55),rgba(4,29,45,.94));
        color:#eafaff;font:950 .7rem Arial,sans-serif;letter-spacing:.07em;cursor:pointer}
      .rp-openrank-history:focus-visible{outline:2px solid #64ddff;outline-offset:2px}
      .rp-competition-card{
        --rp-competition-accent:85,223,255;
        position:relative;width:100%;min-height:136px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:18px;padding:22px;
        overflow:hidden;border:1px solid rgba(201,206,214,.11);border-radius:20px;background:linear-gradient(160deg,rgba(7,12,20,.90),rgba(3,6,11,.94));color:#eff8ff;text-align:left;
        box-shadow:0 8px 24px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.025);transition:transform .16s ease,border-color .16s ease,background .16s ease;
      }
      .rp-competition-card.tuneup{--rp-competition-accent:255,122,146}
      .rp-competition-card.league{--rp-competition-accent:182,156,255}
      .rp-competition-card:hover{border-color:rgba(var(--rp-competition-accent),.3);background:linear-gradient(160deg,rgba(10,16,25,.94),rgba(4,8,14,.96))}
      .rp-competition-card:active{transform:scale(.987)}
      .rp-competition-card:focus-visible,.rp-season-card:focus-visible,.rp-scope-filter:focus-visible,.rp-competition-back:focus-visible,.rp-competition-close:focus-visible{outline:2px solid #5bdfff;outline-offset:2px}
      .rp-competition-card-copy{position:relative;z-index:1}
      .rp-competition-card-copy small{display:block;margin-bottom:7px;color:rgb(var(--rp-competition-accent));font:950 .48rem/1 Arial,sans-serif;letter-spacing:.14em}
      .rp-competition-card-copy strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.42rem;font-style:italic;font-weight:950;letter-spacing:.025em}
      .rp-competition-card-copy p{margin:7px 0 0;color:#8195ab;font:700 .64rem/1.45 Arial,sans-serif}
      .rp-competition-card-arrow{position:relative;z-index:1;display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(var(--rp-competition-accent),.18);border-radius:50%;color:rgb(var(--rp-competition-accent));background:rgba(var(--rp-competition-accent),.035);font:950 1rem/1 Arial,sans-serif}
      body.rp-simple-navigation-active.rp-competition-hub-open .rp-simple-nav{
        background:rgba(2,3,7,.94);box-shadow:0 -8px 24px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035);
      }
      body.rp-simple-navigation-active.rp-competition-hub-open .rp-simple-nav::before{opacity:.55;box-shadow:none}
      body.rp-simple-navigation-active.rp-competition-hub-open .rp-simple-nav::after{content:none}
      .rp-competition-footnote{margin:16px 3px 0;color:#52677d;font:800 .52rem/1.5 Arial,sans-serif;letter-spacing:.035em}
      .rp-season-list{display:grid;gap:10px;padding-top:4px}
      .rp-season-card{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:18px;border:1px solid rgba(166,131,255,.17);border-radius:18px;background:linear-gradient(145deg,#0b101a,#05080e);color:#f1f4ff;text-align:left}
      .rp-season-card small{display:block;color:#9c85e9;font:950 .46rem/1 Arial,sans-serif;letter-spacing:.15em}
      .rp-season-card strong{display:block;margin-top:5px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.2rem;font-style:italic;letter-spacing:.03em}
      .rp-season-card span{color:#748399;font:900 .48rem/1 Arial,sans-serif;letter-spacing:.08em}
      .rp-season-card b{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(181,152,255,.2);border-radius:50%;color:#b9a3ff;background:rgba(44,31,80,.28)}
      .rp-scope-wrap{display:grid;gap:12px}
      .rp-scope-context{padding:5px 3px 2px}
      .rp-scope-context small{display:block;color:#5edfff;font:950 .48rem/1 Arial,sans-serif;letter-spacing:.15em}
      .rp-scope-context strong{display:block;margin-top:5px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.45rem;font-style:italic;letter-spacing:.025em}
      .rp-scope-context p{margin:7px 0 0;color:#778ba1;font:700 .62rem/1.5 Arial,sans-serif}
      .rp-scope-filters{display:flex;gap:6px;padding:7px;overflow-x:auto;border:1px solid rgba(72,216,255,.16);border-radius:16px;background:rgba(2,7,13,.92);scrollbar-width:none;-webkit-overflow-scrolling:touch}
      .rp-scope-filters::-webkit-scrollbar{display:none}
      .rp-scope-filter{flex:0 0 calc((100% - 24px)/5);min-width:74px;min-height:44px;padding:4px;border:1px solid rgba(160,194,224,.18);border-radius:12px;background:#0a1420;color:#91a7bd;font:950 .43rem/1.05 Arial,sans-serif;letter-spacing:.02em;text-align:center}
      .rp-scope-filter.active{border-color:#55ddff;background:linear-gradient(180deg,#57ddff,#1fb8ea);color:#00131c}
      .rp-scope-empty{display:grid;place-items:center;min-height:260px;padding:28px;border:1px dashed rgba(117,194,230,.15);border-radius:20px;background:rgba(4,9,15,.56);text-align:center}
      .rp-scope-empty div{max-width:390px}
      .rp-scope-empty b{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 14px;border:1px solid rgba(72,216,255,.18);border-radius:50%;color:#55dfff;background:rgba(20,103,132,.12);font:950 1.15rem/1 Arial,sans-serif}
      .rp-scope-empty strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.2rem;font-style:italic;letter-spacing:.035em}
      .rp-scope-empty p{margin:8px 0 0;color:#71869d;font:700 .65rem/1.55 Arial,sans-serif}
      .rp-scope-empty small{display:block;margin-top:13px;color:#45596f;font:850 .5rem/1.5 Arial,sans-serif;letter-spacing:.04em}

      /* Scoped competition rankings: custom context header, exact Player Rankings body below. */
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-view="players"] .rp-world-player-directory-head{display:none!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-status]{display:none!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-sort] [data-player-sort="unranked"]{display:none!important}
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="overall"] [data-world-player-more],
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="scoped"] [data-world-player-more]{display:none!important}

      /* Stats owns its loading state. Never expose the shared Players directory while a Stats view is booting. */
      .rp-stats-loading-overlay{
        position:fixed;z-index:575;inset:0 0 calc(var(--rp-simple-nav-height,72px) + env(safe-area-inset-bottom)) 0;
        display:grid;place-items:center;padding:24px;box-sizing:border-box;color:#eef7ff;
        background:
          radial-gradient(circle at 18% 16%,rgba(25,151,255,.16),transparent 30%),
          radial-gradient(circle at 82% 42%,rgba(255,35,58,.11),transparent 30%),
          linear-gradient(180deg,#03060c 0%,#020409 52%,#010205 100%);
      }
      .rp-stats-loading-card{display:grid;justify-items:center;gap:11px;text-align:center}
      .rp-stats-loading-mark{
        width:46px;height:46px;border:3px solid rgba(83,218,255,.16);border-top-color:#55ddff;border-radius:50%;
        animation:rp-stats-loading-spin .75s linear infinite;box-shadow:0 0 22px rgba(60,205,255,.12)
      }
      .rp-stats-loading-card strong{
        font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.15rem;font-style:italic;font-weight:950;letter-spacing:.08em
      }
      .rp-stats-loading-card span{color:#688096;font:900 .5rem/1.45 Arial,sans-serif;letter-spacing:.10em}
      @keyframes rp-stats-loading-spin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){.rp-stats-loading-mark{animation:none;border-top-color:rgba(83,218,255,.16);box-shadow:0 0 0 2px #55ddff inset}}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row:not([data-rp-competition-scope-row]){display:none!important}
      /* Scope-owned player rows can be legitimately UNRANKED overall. Global rules
         must not override the competition's verified participation list. Respect
         explicit [hidden] for active competition metric filters. */
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row[data-rp-competition-scope-row]:not([hidden]){display:grid!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row[data-rp-competition-scope-row][hidden]{display:none!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking .rp-world-topbar{display:none!important}
      .rp-competition-world-scope-header{display:block;padding:2px 2px 4px;margin:0}
      .rp-competition-scope-topbar{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:10px;margin:0 0 8px}
      .rp-competition-scope-title-wrap{min-width:0;text-align:center}
      .rp-competition-scope-title-wrap strong{display:block;margin:0;text-align:center;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.04rem;font-style:italic;font-weight:950;letter-spacing:.07em;color:#eef7ff}
      .rp-competition-scope-title-wrap span{display:block;margin-top:3px;color:#5d7187;font:900 .45rem/1 Arial,sans-serif;letter-spacing:.10em;text-transform:uppercase}
      .rp-competition-scope-empty-row{display:grid;place-items:center;min-height:190px;padding:28px 14px;text-align:center}
      .rp-competition-scope-empty-row div{max-width:380px}
      .rp-competition-scope-empty-row strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.18rem;font-style:italic;font-weight:950;letter-spacing:.03em;color:#eef7ff}
      .rp-competition-scope-empty-row p{margin:8px 0 0;color:#71859b;font:700 .63rem/1.55 Arial,sans-serif}

      /* Ranking header authority: info on the left, back on the right, title centered. */
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="overall"] .rp-world-player-directory-head{
        position:relative!important;
        min-height:54px!important;
        padding-left:48px!important;
        padding-right:48px!important;
        box-sizing:border-box!important;
      }
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="overall"] .rp-world-player-ovr-info{
        left:1px!important;
        right:auto!important;
        top:1px!important;
      }
      .rp-competition-overall-back{
        position:absolute;top:1px;right:1px;width:36px;height:36px;display:grid;place-items:center;padding:0;
        border:1px solid rgba(72,216,255,.24);border-radius:12px;background:rgba(5,12,19,.82);color:#dff7ff;
        font:900 1rem/1 Arial,sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);z-index:3;
      }
      .rp-competition-overall-back:active{transform:scale(.96)}
      .rp-competition-overall-back:focus-visible{outline:2px solid #71e4ff;outline-offset:2px}

      .rp-competition-scope-topbar{
        grid-template-columns:42px minmax(0,1fr) 42px!important;
      }
      .rp-competition-world-scope-info,
      .rp-competition-world-scope-back{
        width:42px;height:42px;display:grid;place-items:center;padding:0;border:1px solid rgba(124,204,240,.18);
        background:rgba(7,16,26,.9);color:#dff7ff;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
      }
      .rp-competition-world-scope-info{
        border-radius:50%;color:#48d8ff;font-family:Georgia,serif;font-size:1rem;font-style:italic;font-weight:900;line-height:1;
      }
      .rp-competition-world-scope-back{
        border-radius:13px;font:900 1rem/1 Arial,sans-serif;
      }
      .rp-competition-world-scope-info:active,
      .rp-competition-world-scope-back:active{transform:scale(.97)}
      .rp-competition-world-scope-info:focus-visible,
      .rp-competition-world-scope-back:focus-visible{outline:2px solid #5bdfff;outline-offset:2px}
            @media(min-width:640px){.rp-competition-card-grid{grid-template-columns:1fr 1fr}.rp-competition-card:first-child{grid-column:1/-1}.rp-scope-filter{flex-basis:105px}}
      @media(min-width:640px){
        [data-rp-competition-view="hub"] .rp-competition-card-grid{grid-template-columns:1fr}
        [data-rp-competition-view="hub"] .rp-competition-card:first-child{grid-column:auto}
      }
      @media(max-width:390px){.rp-competition-shell{padding-inline:12px}.rp-competition-card{min-height:126px;padding:17px}.rp-competition-card-copy strong{font-size:1.28rem}.rp-scope-filter{min-width:68px;font-size:.39rem}}
      /* Flat STATS menu: icon + title only. */
      [data-rp-competition-view="hub"] .rp-competition-card-grid{display:flex!important;flex-direction:column!important;gap:2px!important;width:100%;padding:0!important;margin:4px 0 0!important}
      [data-rp-competition-view="hub"] .rp-competition-card{
        display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:15px!important;
        width:100%;min-height:54px!important;padding:12px 14px!important;margin:0!important;
        border:0!important;border-radius:8px!important;background:transparent!important;
        box-shadow:none!important;text-align:left;cursor:pointer;overflow:visible;
      }
      [data-rp-competition-view="hub"] .rp-competition-card::before,
      [data-rp-competition-view="hub"] .rp-competition-card-arrow{display:none!important}
      [data-rp-competition-view="hub"] .rp-stats-menu-icon{display:block;width:19px;height:19px;flex:0 0 19px;color:#b6c2d1}
      [data-rp-competition-view="hub"] .rp-competition-card-copy{display:block!important;flex:1;min-width:0}
      [data-rp-competition-view="hub"] .rp-competition-card-copy strong{
        display:block;font:800 .84rem/1.25 Arial,sans-serif!important;font-style:normal!important;letter-spacing:.005em!important;color:#f0f3f8
      }
      [data-rp-competition-view="hub"] .rp-competition-card:hover{background:rgba(120,163,194,.08)!important}
      [data-rp-competition-view="hub"] .rp-competition-card:active{background:rgba(120,163,194,.14)!important;transform:none}
      [data-rp-competition-view="hub"] .rp-competition-card:first-child{grid-column:auto!important}
      @media(max-width:390px){
        [data-rp-competition-view="hub"] .rp-competition-card{min-height:54px!important;padding:12px 14px!important}
        [data-rp-competition-view="hub"] .rp-competition-card-copy strong{font-size:.84rem!important}
      }
      @media(prefers-reduced-transparency:reduce){.rp-competition-hub::before{opacity:.22}}
      @media(prefers-reduced-motion:reduce){.rp-competition-card{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function showStatsLoading(title = 'LOADING STATS...', detail = 'PREPARING VERIFIED PLAYER DATA') {
    if (!statsLoadingOverlay) {
      statsLoadingOverlay = document.createElement('section');
      statsLoadingOverlay.className = 'rp-stats-loading-overlay';
      statsLoadingOverlay.dataset.rpStatsLoading = 'true';
      statsLoadingOverlay.setAttribute('role', 'status');
      statsLoadingOverlay.setAttribute('aria-live', 'polite');
      statsLoadingOverlay.innerHTML = `
        <div class="rp-stats-loading-card">
          <div class="rp-stats-loading-mark" aria-hidden="true"></div>
          <strong data-rp-stats-loading-title>LOADING STATS...</strong>
          <span data-rp-stats-loading-detail>PREPARING VERIFIED PLAYER DATA</span>
        </div>`;
      document.body.appendChild(statsLoadingOverlay);
    }
    const heading = statsLoadingOverlay.querySelector('[data-rp-stats-loading-title]');
    const copy = statsLoadingOverlay.querySelector('[data-rp-stats-loading-detail]');
    if (heading) heading.textContent = title;
    if (copy) copy.textContent = detail;
    statsLoadingOverlay.hidden = false;
  }

  function hideStatsLoading() {
    if (statsLoadingOverlay) statsLoadingOverlay.hidden = true;
  }

  function announceStatsViewReady(kind) {
    try {
      window.dispatchEvent(new CustomEvent('realplay:stats-view-ready', {
        detail: { kind: kind || playerPresentation || 'stats' },
      }));
    } catch (_error) {}
  }

  function createPanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'rp-competition-hub';
    panel.dataset.rpCompetitionHub = 'true';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="rp-competition-shell">
        <header class="rp-competition-topbar">
          <button class="rp-competition-back" type="button" data-rp-competition-back aria-label="Back" hidden>←</button>
          <div class="rp-competition-heading"><small>REAL PLAY BASKETBALL</small><strong data-rp-competition-title>STATS</strong></div>
          <button class="rp-competition-close" type="button" data-rp-competition-close aria-label="Close">×</button>
        </header>

        <section class="rp-competition-view" data-rp-competition-view="hub">
          <div class="rp-competition-intro">
            <small>CHOOSE YOUR STATS VIEW</small>
            <h1>STATS.</h1>
            <p>Follow your overall Real Play standing, enter Tune-Up competition, or open an official League season.</p>
          </div>
          <nav class="rp-competition-card-grid" aria-label="Stats sections">
            <button class="rp-competition-card rankings" type="button" data-rp-competition-action="player-rankings"><svg class="rp-stats-menu-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20v-6h4v6M10 20V9h4v11M16 20V4h4v16M3 20h18"/></svg><span class="rp-competition-card-copy"><strong>PLAYER RANKINGS</strong></span></button>
            <button class="rp-competition-card openrank" type="button" data-rp-competition-action="open-ranking"><svg class="rp-stats-menu-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 11a3 3 0 0 0 0-6M17 14a5 5 0 0 1 4 5v1"/></svg><span class="rp-competition-card-copy"><strong>OPEN RANKING</strong></span></button>
            <button class="rp-competition-card tuneup" type="button" data-rp-competition-action="tune-up"><svg class="rp-stats-menu-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 9 9l4 3-4 9 9-11-5-2 2-5Z"/></svg><span class="rp-competition-card-copy"><strong>TUNE UP</strong></span></button>
            <button class="rp-competition-card league" type="button" data-rp-competition-action="league"><svg class="rp-stats-menu-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H4v2a4 4 0 0 0 4 4M17 5h3v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/></svg><span class="rp-competition-card-copy"><strong>LEAGUE</strong></span></button>
          </nav>
        </section>

        <section class="rp-competition-view" data-rp-competition-view="open-rank" hidden>
          <div class="rp-openrank-detail">
            <small>ANY SESSION · ANY AVAILABLE PLAYERS</small>
            <h2>OPEN RANKING</h2>
            <p>Official East vs West pickup games stand apart from Tune Up and League. No permanent club assignment is required.</p>
            <button class="rp-openrank-history" type="button" data-rp-openrank-history>VIEW VERIFIED GAMES →</button>
            <p>Dedicated pickup-player rankings will require separate verified Open Ranking statistics. Tune Up rankings are not reused here.</p>
          </div>
        </section>

        <section class="rp-competition-view" data-rp-competition-view="league" hidden>
          <div class="rp-season-list">
            <button class="rp-season-card" type="button" data-rp-league-season="1"><span><small>LEAGUE SEASON</small><strong>SEASON 1</strong><span>UPCOMING</span></span><b>→</b></button>
            <button class="rp-season-card" type="button" data-rp-league-season="2"><span><small>LEAGUE SEASON</small><strong>SEASON 2</strong><span>FUTURE</span></span><b>→</b></button>
          </div>
        </section>

        <section class="rp-competition-view" data-rp-competition-view="scope" hidden>
          <div class="rp-scope-wrap">
            <div class="rp-scope-context"><small data-rp-scope-kicker>COMPETITION RANKING</small><strong data-rp-scope-title>TUNE-UP</strong><p data-rp-scope-copy>Rankings and player statistics in this competition only.</p></div>
            <div class="rp-scope-filters" aria-label="Competition ranking filters" data-rp-scope-filters></div>
            <div class="rp-scope-empty"><div><b>◎</b><strong data-rp-scope-empty-title>NO VERIFIED RESULTS YET.</strong><p data-rp-scope-empty-copy>Rankings and stats will appear here after verified competition games begin.</p><small>OVERALL PLAYER RANKINGS ARE KEPT SEPARATE UNTIL THIS COMPETITION HAS ITS OWN VERIFIED DATA.</small></div></div>
          </div>
        </section>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelector('[data-rp-competition-close]')?.addEventListener('click', close);
    panel.querySelector('[data-rp-competition-back]')?.addEventListener('click', goBack);
    panel.querySelector('[data-rp-competition-action="player-rankings"]')?.addEventListener('click', openPlayerRankings);
    panel.querySelector('[data-rp-competition-action="tune-up"]')?.addEventListener('click', openTuneUp);
    panel.querySelector('[data-rp-competition-action="open-ranking"]')?.addEventListener('click', openOpenRanking);
    panel.querySelector('[data-rp-openrank-history]')?.addEventListener('click', openOpenRankHistory);
    panel.querySelector('[data-rp-competition-action="league"]')?.addEventListener('click', openLeague);
    panel.querySelectorAll('[data-rp-league-season]').forEach((button) => {
      button.addEventListener('click', () => openLeagueSeason(button.dataset.rpLeagueSeason));
    });

    const filters = panel.querySelector('[data-rp-scope-filters]');
    if (filters) {
      filters.innerHTML = FILTER_LABELS.map((label, index) => `<button class="rp-scope-filter${index === 0 ? ' active' : ''}" type="button" aria-pressed="${index === 0 ? 'true' : 'false'}">${esc(label)}</button>`).join('');
      filters.addEventListener('click', (event) => {
        const button = event.target.closest('.rp-scope-filter');
        if (!button) return;
        filters.querySelectorAll('.rp-scope-filter').forEach((item) => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    }
    return panel;
  }

  function setView(name) {
    createPanel();
    panel.querySelectorAll('[data-rp-competition-view]').forEach((view) => {
      view.hidden = view.dataset.rpCompetitionView !== name;
    });
    const title = panel.querySelector('[data-rp-competition-title]');
    const back = panel.querySelector('[data-rp-competition-back]');
    if (title) title.textContent = name === 'hub' ? 'STATS' : name === 'league' ? 'LEAGUE SEASONS' : name === 'open-rank' ? 'OPEN RANKING' : 'RANKINGS';
    if (back) back.hidden = name === 'hub';
    panel.dataset.rpCompetitionCurrentView = name;
  }

  function markCompeteNav(active = true) {
    const button = document.querySelector('[data-rp-simple-nav-item="players"]');
    const nav = document.querySelector('[data-rp-simple-nav]');
    if (!button || !nav) return;
    nav.querySelectorAll('[data-rp-simple-nav-item]').forEach((item) => {
      const selected = active && item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function showPanelView(name = 'hub') {
    createPanel();
    setView(name);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-competition-hub-open');
    markCompeteNav(true);
  }

  function open() {
    const wasScoped = playerPresentation === 'scoped';
    if (wasScoped) {
      clearPlayerPresentation();
      try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    }
    showPanelView('hub');
    window.requestAnimationFrame(() => panel.querySelector('[data-rp-competition-action="player-rankings"]')?.focus({ preventScroll: true }));
  }

  function close() {
    if (!panel) return;
    const focused = document.activeElement;
    if (focused && panel.contains(focused)) {
      try { focused.blur(); } catch (_error) {}
    }
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-competition-hub-open');
  }

  function goBack() {
    const current = panel?.dataset?.rpCompetitionCurrentView || 'hub';
    if (current === 'scope' && panel?.dataset?.rpScopeParent === 'league') {
      setView('league');
      return;
    }
    setView('hub');
  }

  function removeScopedArtifacts() {
    const world = document.querySelector('[data-rp-world]');
    if (!world) return;
    world.classList.remove('rp-competition-scoped-ranking');
    delete world.dataset.rpCompetitionScope;
    delete world.dataset.rpCompetitionSeasonId;
    delete world.dataset.rpCompetitionPresentation;
    world.querySelector('[data-rp-competition-world-scope-header]')?.remove();
    world.querySelector('[data-rp-competition-world-scope-back]')?.remove();
    world.querySelector('[data-rp-competition-overall-back]')?.remove();
    world.querySelector('[data-rp-competition-scope-empty]')?.remove();
  }

  function clearPlayerPresentation() {
    if (playerDecorationTimer) {
      window.clearTimeout(playerDecorationTimer);
      playerDecorationTimer = null;
    }
    if (presentationTimer) {
      window.clearTimeout(presentationTimer);
      presentationTimer = null;
    }
    if (overallAutoLoadTimer) {
      window.clearTimeout(overallAutoLoadTimer);
      overallAutoLoadTimer = null;
    }
    const wasScoped = playerPresentation === 'scoped';
    scopedRequestId += 1;
    hideStatsLoading();
    removeScopedArtifacts();
    playerPresentation = '';
    scopedRanking = null;
    if (wasScoped) {
      window.setTimeout(() => {
        try { window.RealPlayPlayers?.refresh?.(); } catch (_error) {}
      }, 0);
    }
  }

  function openPlayersRoute() {
    const button = document.querySelector('[data-rp-simple-nav-item="players"]');
    if (!button) {
      window.RealPlaySimpleNavigation?.players?.();
      return;
    }
    // Preserve the visitor directory and authenticated directory handlers.
    button.dataset.rpCompetitionBypass = '1';
    try { button.click(); }
    finally { delete button.dataset.rpCompetitionBypass; }
  }

  function decoratePlayerRankings(attempt = 0) {
    if (playerPresentation !== 'overall') return;
    const world = document.querySelector('[data-rp-world]');
    const playersView = world?.querySelector('[data-world-view="players"]');
    if (!world || !playersView || playersView.hidden) {
      if (attempt < 18) playerDecorationTimer = window.setTimeout(() => decoratePlayerRankings(attempt + 1), 70);
      return;
    }

    // A normal overall refresh must not remove/recreate its own Back button.
    // The scoped cleanup is only needed when a scoped view still owns World.
    if (world.dataset.rpCompetitionPresentation === 'scoped'
      || world.classList.contains('rp-competition-scoped-ranking')) removeScopedArtifacts();
    hideStatsLoading();
    if (world.dataset.rpCompetitionPresentation !== 'overall') {
      world.dataset.rpCompetitionPresentation = 'overall';
    }

    const topTitle = world.querySelector('.rp-world-title strong');
    const topSubtitle = world.querySelector('.rp-world-title span');
    const topBadge = world.querySelector('.rp-world-online');
    const kicker = playersView.querySelector('.rp-world-player-directory-head small');
    const heading = playersView.querySelector('.rp-world-player-directory-head strong');

    if (topTitle && topTitle.textContent !== 'PLAYER RANKINGS') topTitle.textContent = 'PLAYER RANKINGS';
    if (topSubtitle && topSubtitle.textContent !== 'REAL PLAY BASKETBALL') {
      topSubtitle.textContent = 'REAL PLAY BASKETBALL';
    }
    if (topBadge) {
      if (topBadge.style.getPropertyValue('visibility')) topBadge.style.removeProperty('visibility');
      if (topBadge.textContent !== 'OVERALL') topBadge.textContent = 'OVERALL';
    }
    if (kicker && kicker.textContent !== 'OVERALL REAL PLAY') kicker.textContent = 'OVERALL REAL PLAY';
    if (heading && heading.textContent !== 'PLAYER RANKINGS') heading.textContent = 'PLAYER RANKINGS';

    const directoryHead = playersView.querySelector('.rp-world-player-directory-head');
    if (directoryHead && !directoryHead.querySelector('[data-rp-competition-overall-back]')) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'rp-competition-overall-back';
      back.dataset.rpCompetitionOverallBack = 'true';
      back.setAttribute('aria-label', 'Back to Stats');
      back.textContent = '←';
      back.addEventListener('click', returnFromOverallRanking);
      directoryHead.appendChild(back);
    }
  }

  function queueOverallPlayerPage(hasMore) {
    if (playerPresentation !== 'overall' || !hasMore) return;
    if (overallAutoLoadTimer) window.clearTimeout(overallAutoLoadTimer);
    overallAutoLoadTimer = window.setTimeout(() => {
      overallAutoLoadTimer = null;
      if (playerPresentation !== 'overall') return;
      try { window.RealPlayPlayers?.refresh?.({ append: true }); } catch (_error) {}
    }, 0);
  }

  function returnFromOverallRanking() {
    clearPlayerPresentation();
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    showPanelView('hub');
  }

  function openPlayerRankings() {
    close();
    clearPlayerPresentation();
    overallPlayersReady = false;
    playerPresentation = 'overall';
    // Core navigation owns the Stats loading shell for overall rankings.
    // Do not stack a second competition overlay on top of it.
    openPlayersRoute();
    playerDecorationTimer = window.setTimeout(() => decoratePlayerRankings(0), 45);
  }

  function scopedToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function fetchScopedCompetitionStats(config) {
    const accessToken = scopedToken();
    if (!accessToken) {
      const error = new Error('Please log in to view verified competition stats.');
      error.status = 401;
      throw error;
    }

    const params = new URLSearchParams();
    params.set('context', config.competitionContext || 'open_ranking');
    if (config.competitionSeasonId) params.set('season_id', String(config.competitionSeasonId));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/real-play/competition/stats?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Tune-Up stats took too long to load. Please try again.');
        timeoutError.code = 'COMPETITION_STATS_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Could not load competition stats.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function normalizeAutomaticCompetitionRanks(players) {
    // Only actual competition participation qualifies: the backend excludes
    // recorded DNP and provides the verified games count per competitor.
    const source = (Array.isArray(players) ? players : [])
      .filter((player) => Number(player?.record?.games ?? player?.leaderboardStats?.games ?? 0) > 0)
      .map((player) => ({ ...player }));
    source.sort((left, right) => {
      const leftRank = Number(left?.rank);
      const rightRank = Number(right?.rank);
      const leftHasRank = Number.isSafeInteger(leftRank) && leftRank > 0;
      const rightHasRank = Number.isSafeInteger(rightRank) && rightRank > 0;
      if (leftHasRank && rightHasRank && leftRank !== rightRank) return leftRank - rightRank;

      const leftOvr = Number(left?.ovr ?? left?.provisionalOvr);
      const rightOvr = Number(right?.ovr ?? right?.provisionalOvr);
      const leftHasOvr = Number.isFinite(leftOvr);
      const rightHasOvr = Number.isFinite(rightOvr);
      if (leftHasOvr !== rightHasOvr) return leftHasOvr ? -1 : 1;
      if (leftHasOvr && rightHasOvr && leftOvr !== rightOvr) return rightOvr - leftOvr;

      const leftGames = Number(left?.record?.games ?? left?.leaderboardStats?.games ?? 0);
      const rightGames = Number(right?.record?.games ?? right?.leaderboardStats?.games ?? 0);
      if (leftGames !== rightGames) return rightGames - leftGames;

      const leftWinRate = Number(left?.winRate ?? left?.record?.winRate ?? 0);
      const rightWinRate = Number(right?.winRate ?? right?.record?.winRate ?? 0);
      if (leftWinRate !== rightWinRate) return rightWinRate - leftWinRate;

      return String(left?.playerName || '').localeCompare(String(right?.playerName || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    });

    return source.map((player, index) => {
      const ovrValue = player?.ovr ?? player?.provisionalOvr ?? null;
      const ovr = ovrValue !== null && ovrValue !== undefined && Number.isFinite(Number(ovrValue))
        ? Number(ovrValue)
        : null;
      return {
        ...player,
        ranked: true,
        rank: index + 1,
        officialRank: index + 1,
        ovr,
      };
    });
  }

  function scopedPlayerRow(player) {
    const playerId = String(player?.userId ?? player?.identityKey ?? '').trim();
    const name = player?.playerName || 'REAL PLAY PLAYER';
    const rawNumber = player?.playerNumber;
    const jersey = rawNumber === null || rawNumber === undefined || rawNumber === ''
      ? '#—'
      : `#${Number(rawNumber)}`;
    const rating = player?.ranked && player?.ovr !== null && player?.ovr !== undefined
      ? `<span class="rp-world-player-ovr">${esc(player.ovr)} <small>OVR</small></span>`
      : '<span class="rp-world-player-ovr unranked">— <small>OVR</small></span>';
    const winRateValue = Number(player?.winRate ?? player?.record?.winRate);
    const winRate = Number.isFinite(winRateValue)
      ? `<span class="rp-world-player-winrate">${Math.round(winRateValue)}% <small>WR</small></span>`
      : '<span class="rp-world-player-winrate empty">— <small>WR</small></span>';

    return `
      <button type="button" class="rp-world-player-row" data-rp-competition-scope-row="true"
        data-world-player-id="${esc(playerId)}" aria-label="${esc(name)} competition statistics">
        <span class="rp-world-player-name"><strong>${esc(name)}</strong><b>${esc(jersey)}</b></span>
        <span class="rp-world-player-metrics">${rating}${winRate}</span>
      </button>`;
  }

  function renderScopedCompetitionRows(list, config) {
    if (config.loading) {
      list.innerHTML = '<div class="rp-competition-scope-empty-row" data-rp-competition-scope-empty><div><strong>LOADING VERIFIED RESULTS...</strong><p>Reading finalized competition records.</p></div></div>';
      return;
    }

    if (config.error) {
      list.innerHTML = '<div class="rp-competition-scope-empty-row" data-rp-competition-scope-empty><div><strong>COULD NOT LOAD TUNE-UP STATS.</strong><p>' + esc(config.error) + '</p></div></div>';
      return;
    }

    const players = Array.isArray(config.players) ? config.players : [];
    if (!players.length) {
      list.innerHTML = '<div class="rp-competition-scope-empty-row" data-rp-competition-scope-empty><div><strong>' + esc(config.emptyTitle) + '</strong><p>' + esc(config.emptyCopy) + '</p></div></div>';
      return;
    }

    // Shared Stats observers call applyScopedRanking on clicks, window focus,
    // and World refreshes. Replacing the entire list on each of those events
    // destroys badge images, resets scroll anchoring, and visibly flickers.
    // Keep the same row nodes until new scoped evidence actually arrives or
    // another directory has replaced them.
    const existingRows = [...list.querySelectorAll('[data-rp-competition-scope-row]')];
    const stillOwned = config.renderedRowsList === list
      && config.renderedRowsPlayers === players
      && existingRows.length === players.length
      && list.children.length === players.length
      && existingRows.every((row) => row.__rpCompetitionScopedPlayer != null);
    if (stillOwned) return;

    list.innerHTML = players.map(scopedPlayerRow).join('');
    const rows = [...list.querySelectorAll('[data-rp-competition-scope-row]')];
    rows.forEach((row, index) => {
      row.__rpCompetitionScopedPlayer = players[index] || null;
    });
    config.renderedRowsList = list;
    config.renderedRowsPlayers = players;
  }

  async function loadScopedCompetition(config) {
    if (!config?.competitionContext) return;
    const requestId = ++scopedRequestId;
    config.loading = true;
    config.error = '';
    config.players = [];
    config.playerCount = 0;
    applyScopedRanking(0);

    try {
      const data = await fetchScopedCompetitionStats(config);
      if (requestId !== scopedRequestId || scopedRanking !== config || playerPresentation !== 'scoped') return;
      config.players = normalizeAutomaticCompetitionRanks(data?.players);
      // Backend resolves the active Tune-Up season when no season was chosen.
      // Pass the same scope to the player journey/game-history drill-down.
      if (config.competitionContext === 'open_ranking') {
        const resolvedSeasonId = Number(data?.competitionSeasonId);
        if (Number.isSafeInteger(resolvedSeasonId) && resolvedSeasonId > 0) {
          config.competitionSeasonId = resolvedSeasonId;
        }
      }
      config.playerCount = Number.isFinite(Number(data?.playerCount))
        ? Math.max(0, Math.trunc(Number(data.playerCount)))
        : config.players.length;
    } catch (error) {
      if (requestId !== scopedRequestId || scopedRanking !== config || playerPresentation !== 'scoped') return;
      config.error = error?.message || 'Could not load competition stats.';
      config.players = [];
      config.playerCount = 0;
    } finally {
      if (requestId === scopedRequestId && scopedRanking === config && playerPresentation === 'scoped') {
        config.loading = false;
        applyScopedRanking(0);
      }
    }
  }

  function applyScopedRanking(attempt = 0) {
    const config = scopedRanking;
    if (!config || playerPresentation !== 'scoped') return;

    const world = document.querySelector('[data-rp-world]');
    const playersView = world?.querySelector('[data-world-view="players"]');
    const directory = playersView?.querySelector('.rp-world-player-directory');
    const list = playersView?.querySelector('[data-world-player-list]');
    const controls = playersView?.querySelector('[data-world-player-sort]');

    if (!world || !playersView || playersView.hidden || !directory || !list || !controls) {
      if (attempt < 22) playerDecorationTimer = window.setTimeout(() => applyScopedRanking(attempt + 1), 70);
      return;
    }

    world.classList.add('rp-competition-scoped-ranking');
    world.dataset.rpCompetitionScope = config.id;
    if (config.competitionSeasonId) world.dataset.rpCompetitionSeasonId = String(config.competitionSeasonId);
    else delete world.dataset.rpCompetitionSeasonId;
    world.dataset.rpCompetitionPresentation = 'scoped';

    let header = directory.querySelector('[data-rp-competition-world-scope-header]');
    if (!header) {
      header = document.createElement('header');
      header.className = 'rp-competition-world-scope-header';
      header.dataset.rpCompetitionWorldScopeHeader = 'true';
      header.innerHTML = `
        <div class="rp-competition-scope-topbar">
          <button class="rp-competition-world-scope-info" type="button" data-rp-competition-world-scope-info aria-label="Open OVR simulator and calculation guide" title="How OVR works">i</button>
          <div class="rp-competition-scope-title-wrap">
            <strong data-rp-competition-scope-top-title></strong>
            <span data-rp-competition-scope-player-count>0 PLAYERS</span>
          </div>
          <button class="rp-competition-world-scope-back" type="button" data-rp-competition-world-scope-back aria-label="Back">←</button>
        </div>`;
      directory.insertBefore(header, controls);
      header.querySelector('[data-rp-competition-world-scope-info]')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = 'ovr-simulator.html';
      });
      header.querySelector('[data-rp-competition-world-scope-back]')?.addEventListener('click', returnFromScopedRanking);
    }

    const topTitle = header.querySelector('[data-rp-competition-scope-top-title]');
    const playerCount = header.querySelector('[data-rp-competition-scope-player-count]');
    if (topTitle && topTitle.textContent !== config.title) topTitle.textContent = config.title;
    if (playerCount) {
      let countText = 'LOADING';
      if (!config.loading) {
        const count = Number.isFinite(Number(config.playerCount))
          ? Math.max(0, Math.trunc(Number(config.playerCount)))
          : (Array.isArray(config.players) ? config.players.length : 0);
        countText = count + ' PLAYER' + (count === 1 ? '' : 'S');
      }
      if (playerCount.textContent !== countText) playerCount.textContent = countText;
    }

    renderScopedCompetitionRows(list, config);

    const more = playersView.querySelector('[data-world-player-more]');
    if (more) more.hidden = true;

    if (!config.filterInitialized && !config.loading && !config.error && Array.isArray(config.players) && config.players.length) {
      config.filterInitialized = true;
      const initialKey = 'ranked';
      window.setTimeout(() => {
        if (scopedRanking !== config || playerPresentation !== 'scoped') return;
        try {
          window.dispatchEvent(new CustomEvent('realplay:player-filter-select', {
            detail: { key: initialKey, source: 'competition-scope' },
          }));
        } catch (_error) {
          controls.querySelector(`[data-player-sort="${initialKey}"]`)?.click();
        }
      }, 0);
    }

    // Set the initial position only when entering a new scope. A subsequent
    // filter tap or focus refresh must not jump the player's scrolling list.
    if (!config.initialScrollApplied) {
      config.initialScrollApplied = true;
      world.scrollTop = 0;
    }

    if (!config.loading && !config.readyAnnounced) {
      config.readyAnnounced = true;
      hideStatsLoading();
      announceStatsViewReady(config.error ? 'competition-error' : 'competition');
    }
  }

  function openScopedRanking(config) {
    close();
    clearPlayerPresentation();
    scopedRanking = {
      ...config,
      loading: Boolean(config.competitionContext),
      error: '',
      players: [],
      playerCount: 0,
      filterInitialized: false,
      readyAnnounced: false,
    };
    playerPresentation = 'scoped';
    // Core navigation owns the visible loading shell until both the shared
    // player view and this competition's verified data are ready.
    openPlayersRoute();
    const activeScope = scopedRanking;
    playerDecorationTimer = window.setTimeout(() => applyScopedRanking(0), 45);
    if (activeScope.competitionContext) loadScopedCompetition(activeScope);
  }

  function returnFromScopedRanking() {
    const parent = scopedRanking?.parent === 'league' ? 'league' : 'hub';
    clearPlayerPresentation();
    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    showPanelView(parent);
  }

  function openOpenRanking() {
    showPanelView('open-rank');
  }

  function openOpenRankHistory() {
    // The World history already has authoritative East vs West result
    // classification. Request it through the core route rather than
    // presenting Tune Up's open_ranking backend scope as pickup rankings.
    window.__realPlayWorldRequestedCompetition = 'open-rank';
    close();
    window.RealPlaySimpleNavigation?.world?.();
  }

  function openTuneUp() {
    openScopedRanking({
      id: 'tune-up',
      title: 'TUNE-UP',
      kicker: 'TUNE-UP · PLAYER RANKING',
      copy: 'Every ranking and statistic on this page belongs only to the Tune-Up competition.',
      emptyTitle: 'NO TUNE-UP RESULTS YET.',
      emptyCopy: 'Tune-Up rankings and stats will appear here when verified Tune-Up games begin.',
      competitionContext: 'open_ranking',
      parent: 'hub',
    });
  }

  function openLeague() {
    createPanel();
    setView('league');
  }

  function openLeagueSeason(season) {
    const cleanSeason = String(season || '').replace(/[^0-9A-Za-z -]/g, '') || '1';
    openScopedRanking({
      id: 'league-season-' + cleanSeason.toLowerCase().replace(/\s+/g, '-'),
      title: 'SEASON ' + cleanSeason,
      kicker: 'LEAGUE · SEASON ' + cleanSeason + ' · PLAYER RANKING',
      copy: 'Every ranking and statistic on this page belongs only to League Season ' + cleanSeason + '.',
      emptyTitle: 'NO SEASON ' + cleanSeason + ' RESULTS YET.',
      emptyCopy: 'Season ' + cleanSeason + ' rankings and stats will appear here after verified League games begin.',
      competitionContext: 'league',
      competitionSeasonId: Number.isSafeInteger(Number(cleanSeason)) ? Number(cleanSeason) : null,
      parent: 'league',
    });
  }

  function maintainPlayerPresentation() {
    if (!playerPresentation) return;
    if (presentationTimer) window.clearTimeout(presentationTimer);
    presentationTimer = window.setTimeout(() => {
      if (playerPresentation === 'scoped') applyScopedRanking(0);
      else if (playerPresentation === 'overall') decoratePlayerRankings(0);
    }, 0);
  }

  function handleScopedPrimaryNavigation(event) {
    if (playerPresentation !== 'scoped') return;
    const item = event.target.closest?.('[data-rp-simple-nav-item]');
    if (!item) return;
    if (item.dataset.rpSimpleNavItem === 'players') return;
    clearPlayerPresentation();
  }

  function renamePlayersNav() {
    const button = document.querySelector('[data-rp-simple-nav-item="players"]');
    if (!button) return false;
    const label = button.querySelector('small');
    if (label && label.textContent !== 'STATS') label.textContent = 'STATS';
    button.setAttribute('aria-label', 'Open Real Play stats');
    return true;
  }

  function handlePlayersNavCapture(event) {
    const button = event.target.closest?.('[data-rp-simple-nav-item="players"]');
    if (!button || button.dataset.rpCompetitionBypass === '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }

  function install() {
    installStyles();
    createPanel();
    renamePlayersNav();
    document.addEventListener('click', handleScopedPrimaryNavigation, true);
    document.addEventListener('click', handlePlayersNavCapture, true);
    document.addEventListener('click', maintainPlayerPresentation);
    window.addEventListener('focus', maintainPlayerPresentation);
    window.addEventListener('realplay:players-loaded', (event) => {
      if (playerPresentation === 'scoped') {
        applyScopedRanking(0);
        return;
      }
      if (playerPresentation === 'overall') {
        overallPlayersReady = true;
        decoratePlayerRankings(0);
        queueOverallPlayerPage(Boolean(event?.detail?.hasMore));
        hideStatsLoading();
        announceStatsViewReady('overall');
      }
    });

    navObserver = new MutationObserver(() => renamePlayersNav());
    navObserver.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  install();

  window.RealPlayCompetitionHub = {
    open,
    close,
    openPlayerRankings,
    openTuneUp,
    openOpenRanking,
    openLeague,
    openLeagueSeason,
  };
})();
