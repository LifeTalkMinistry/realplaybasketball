(() => {
  if (window.__realPlayCompetitionHubInstalled) return;
  window.__realPlayCompetitionHubInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  const FILTER_LABELS = [
    'RANK OVR',
    'UNRANK OVR',
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
      .rp-competition-card-grid{display:grid;gap:14px}
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
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="overall"] [data-world-player-more],
      body.rp-simple-navigation-active .rp-world[data-rp-competition-presentation="scoped"] [data-world-player-more]{display:none!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row:not([data-rp-competition-scope-row]){display:none!important}
      body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row[data-rp-competition-scope-row]{display:grid}
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
      @media(max-width:390px){.rp-competition-shell{padding-inline:12px}.rp-competition-card{min-height:126px;padding:17px}.rp-competition-card-copy strong{font-size:1.28rem}.rp-scope-filter{min-width:68px;font-size:.39rem}}
      @media(prefers-reduced-transparency:reduce){.rp-competition-hub::before{opacity:.22}}
      @media(prefers-reduced-motion:reduce){.rp-competition-card{transition:none}}
    `;
    document.head.appendChild(style);
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
          <div class="rp-competition-card-grid">
            <button class="rp-competition-card rankings" type="button" data-rp-competition-action="player-rankings">
              <span class="rp-competition-card-copy"><small>OVERALL · CAREER</small><strong>PLAYER RANKINGS</strong><p>Your overall Real Play rank, OVR and verified career performance.</p></span><span class="rp-competition-card-arrow">→</span>
            </button>
            <button class="rp-competition-card tuneup" type="button" data-rp-competition-action="tune-up">
              <span class="rp-competition-card-copy"><small>PROGRAM RANKING</small><strong>TUNE-UP</strong><p>Ranking and player stats scoped only to the Tune-Up competition.</p></span><span class="rp-competition-card-arrow">→</span>
            </button>
            <button class="rp-competition-card league" type="button" data-rp-competition-action="league">
              <span class="rp-competition-card-copy"><small>SEASON COMPETITION</small><strong>LEAGUE</strong><p>Choose a League season, then view its own rankings, teams, games and stats.</p></span><span class="rp-competition-card-arrow">→</span>
            </button>
          </div>
          <p class="rp-competition-footnote">Player Rankings is the overall player layer. Tune-Up and League rankings belong only to the competition or season you opened.</p>
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
    if (title) title.textContent = name === 'hub' ? 'STATS' : name === 'league' ? 'LEAGUE SEASONS' : 'RANKINGS';
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

    removeScopedArtifacts();
    world.dataset.rpCompetitionPresentation = 'overall';

    const topTitle = world.querySelector('.rp-world-title strong');
    const topSubtitle = world.querySelector('.rp-world-title span');
    const topBadge = world.querySelector('.rp-world-online');
    const kicker = playersView.querySelector('.rp-world-player-directory-head small');
    const heading = playersView.querySelector('.rp-world-player-directory-head strong');

    if (topTitle) topTitle.textContent = 'PLAYER RANKINGS';
    if (topSubtitle) topSubtitle.textContent = 'REAL PLAY BASKETBALL';
    if (topBadge) {
      topBadge.style.removeProperty('visibility');
      topBadge.textContent = 'OVERALL';
    }
    if (kicker) kicker.textContent = 'OVERALL REAL PLAY';
    if (heading) heading.textContent = 'PLAYER RANKINGS';

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
    playerPresentation = 'overall';
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

    const response = await fetch(`${API_BASE_URL}/api/real-play/competition/stats?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Could not load competition stats.');
      error.status = response.status;
      throw error;
    }
    return data;
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
      : '<span class="rp-world-player-ovr unranked">UNRANKED</span>';
    const winRateValue = Number(player?.winRate ?? player?.record?.winRate);
    const winRate = Number.isFinite(winRateValue)
      ? `<span class="rp-world-player-winrate">${Math.round(winRateValue)}% <small>WR</small></span>`
      : '<span class="rp-world-player-winrate empty">— <small>WR</small></span>';

    return `
      <button type="button" class="rp-world-player-row" data-rp-competition-scope-row="true"
        data-world-player-id="${esc(playerId)}" aria-label="${esc(name)} Tune-Up statistics">
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

    list.innerHTML = players.map(scopedPlayerRow).join('');
    const rows = [...list.querySelectorAll('[data-rp-competition-scope-row]')];
    rows.forEach((row, index) => {
      row.__rpCompetitionScopedPlayer = players[index] || null;
    });
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
      config.players = Array.isArray(data?.players) ? data.players : [];
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
    if (topTitle) topTitle.textContent = config.title;
    if (playerCount) {
      if (config.loading) {
        playerCount.textContent = 'LOADING';
      } else {
        const count = Number.isFinite(Number(config.playerCount))
          ? Math.max(0, Math.trunc(Number(config.playerCount)))
          : (Array.isArray(config.players) ? config.players.length : 0);
        playerCount.textContent = count + ' PLAYER' + (count === 1 ? '' : 'S');
      }
    }

    renderScopedCompetitionRows(list, config);

    const more = playersView.querySelector('[data-world-player-more]');
    if (more) more.hidden = true;

    if (!config.filterInitialized && !config.loading && !config.error && Array.isArray(config.players) && config.players.length) {
      config.filterInitialized = true;
      const hasRanked = config.players.some((player) => Boolean(player?.ranked) && Number(player?.rank) > 0);
      const initialKey = hasRanked ? 'ranked' : 'unranked';
      window.setTimeout(() => {
        if (scopedRanking !== config || playerPresentation !== 'scoped') return;
        controls.querySelector(`[data-player-sort="${initialKey}"]`)?.click();
      }, 0);
    }

    world.scrollTop = 0;
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
    };
    playerPresentation = 'scoped';
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
        decoratePlayerRankings(0);
        queueOverallPlayerPage(Boolean(event?.detail?.hasMore));
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
    openLeague,
    openLeagueSeason,
  };
})();
