(() => {
  if (window.__realPlayWorldResultsInstalled) return;
  window.__realPlayWorldResultsInstalled = true;

  // WORLD never owns a second result renderer. It opens the authoritative
  // RealPlayUpdates result feed and adds only navigation/filtering around the
  // existing official result cards.
  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

  let resultMetadata = new Map();
  let selectedWeek = 'all';
  let selectedType = 'all';
  let selectedCompetition = 'tune-up';
  let selectedSeason = 'tune-up-s1';
  let selectedDateRange = 'all';
  let customDateFrom = '';
  let customDateTo = '';
  let selectedTeam = 'all';
  let selectedView = 'feed';
  let feedObserver = null;
  let metadataLoading = false;
  let resultTotal = 0;
  let viewLoadSequence = 0;
  let lastCategoryAutoFetchOffset = null;
  let categoryAutoFetchCount = 0;
  const teamMvpReplayCache = new Map();
  const teamMvpReplayRequests = new Map();

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function injectWorldResultsStyles() {
    if (document.getElementById('rp-world-results-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-world-results-authority-style';
    style.textContent = `
      /* WORLD is only an entry point into the authoritative Results feed. */
      .rp-updates.rp-world-results-entry .rp-updates-topbar,
      .rp-updates.rp-world-results-entry .rp-updates-head,
      .rp-updates.rp-world-results-entry .rp-updates-filters,
      .rp-updates.rp-world-results-entry .rp-updates-info-button,
      .rp-updates.rp-world-results-entry .rp-updates-info-overlay{
        display:none!important;
      }
      .rp-updates.rp-world-results-entry .rp-updates-shell{
        padding-top:max(18px,env(safe-area-inset-top))!important;
      }
      .rp-updates.rp-world-results-entry .rp-updates-status{
        margin-top:0!important;
      }
      /* Keep the World results layer measurable while another category's
         game records are still being fetched from subsequent pages. */
      .rp-updates.rp-world-results-entry [data-updates-feed]{
        min-height:32px;
      }

      .rp-world-results-controls{
        display:none;
      }
      .rp-updates.rp-world-results-entry .rp-world-results-controls{
        display:block;
        padding:0 0 15px;
      }
      .rp-world-results-controls h1{
        margin:0;
        color:#f7fbff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:1.18rem;
        font-style:italic;
        font-weight:950;
        line-height:1;
        letter-spacing:.015em;
        text-align:center;
        text-transform:uppercase;
      }
      .rp-world-results-controls>small{
        display:block;
        margin-top:5px;
        color:#65758a;
        font-size:.43rem;
        font-weight:900;
        letter-spacing:.12em;
        text-align:center;
        text-transform:uppercase;
      }
      .rp-world-tabs{
        width:min(100%,360px);
        margin:0 auto;
        padding:4px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:4px;
        border:1px solid rgba(255,255,255,.075);
        border-radius:13px;
        background:rgba(4,9,16,.86);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.02);
      }
      .rp-world-tab{
        min-height:38px;
        border:0;
        border-radius:9px;
        color:#65758a;
        background:transparent;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.09em;
        text-transform:uppercase;
        cursor:pointer;
      }
      .rp-world-tab.active{
        color:#f7fbff;
        background:
          linear-gradient(100deg,rgba(14,145,205,.20),rgba(6,13,22,.88) 54%,rgba(164,30,48,.16));
        box-shadow:
          inset 0 0 0 1px rgba(65,214,255,.16),
          0 5px 16px rgba(0,0,0,.18);
      }
      /* Competition and season are separate native dropdown controls. */
      .rp-world-context-picker{
        width:min(100%,360px);
        margin:0 auto;
        padding:0;
        border:0;
        border-radius:13px;
        background:transparent;
        box-shadow:none;
      }
      .rp-world-context-main{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        align-items:stretch;
        gap:12px;
        min-height:46px;
        padding:0;
        border-radius:0;
        background:none;
        box-shadow:none;
      }
      .rp-world-context-main .rp-world-context-dot,
      .rp-world-context-chevron{
        display:none;
      }
      .rp-world-context-select{
        display:block;
        width:100%;
        min-width:0;
        max-width:none;
        height:46px;
        padding:0 24px 0 8px;
        border:1px solid rgba(70,200,245,.28);
        border-radius:12px;
        outline:0;
        appearance:none;
        -webkit-appearance:none;
        color:#f7fbff;
        background-color:#071321;
        background-image:
          linear-gradient(45deg,transparent 50%,#71dfff 50%),
          linear-gradient(135deg,#71dfff 50%,transparent 50%),
          linear-gradient(145deg,rgba(10,91,127,.38),rgba(5,14,25,.96) 65%,rgba(76,14,33,.30));
        background-position:
          calc(100% - 16px) 21px,
          calc(100% - 11px) 21px,
          center;
        background-size:5px 5px,5px 5px,100% 100%;
        background-repeat:no-repeat;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 6px 18px rgba(0,0,0,.22);
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.62rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.055em;
        text-align:center;
        text-align-last:center;
        text-transform:uppercase;
        cursor:pointer;
        transition:border-color .16s ease,box-shadow .16s ease,filter .16s ease;
      }
      .rp-world-context-select:hover{
        border-color:rgba(90,219,255,.58);
        filter:brightness(1.14);
      }
      .rp-world-context-select:focus-visible{
        outline:2px solid #60dbff;
        outline-offset:2px;
      }
      .rp-world-context-select:active{
        filter:brightness(1.25);
      }
      .rp-world-context-select option{
        color:#f7fbff;
        background:#07101a;
      }
      .rp-world-team-filter{
        width:min(100%,360px);
        margin:8px auto 0;
        padding:3px 22px 3px 3px;
        display:flex;
        gap:4px;
        overflow-x:auto;
        overflow-y:hidden;
        scrollbar-width:none;
        -webkit-overflow-scrolling:touch;
        touch-action:pan-x;
        overscroll-behavior-x:contain;
        scroll-snap-type:x proximity;
        border:1px solid rgba(255,255,255,.065);
        border-radius:12px;
        background:rgba(4,9,16,.76);
      }
      .rp-world-team-filter[hidden]{display:none!important}
      .rp-world-date-custom[hidden]{display:none!important}
      .rp-world-date-custom{
        width:min(100%,360px);
        margin:10px auto 0;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }
      .rp-world-date-custom label{
        display:grid;
        gap:6px;
        color:#8ba6bc;
        font:800 .54rem Arial,sans-serif;
        letter-spacing:.07em;
        text-transform:uppercase;
      }
      .rp-world-date-custom input{
        box-sizing:border-box;
        width:100%;
        min-width:0;
        min-height:40px;
        padding:8px;
        border:1px solid rgba(70,200,245,.28);
        border-radius:10px;
        color-scheme:dark;
        color:#fff;
        background:#071827;
        font:700 .72rem Arial,sans-serif;
      }
      .rp-world-date-custom input:focus-visible{
        outline:2px solid #60dbff;
        outline-offset:2px;
      }
      .rp-world-team-filter::-webkit-scrollbar{display:none}
      .rp-world-team-chip{
        width:64px;
        min-width:64px;
        min-height:34px;
        flex:0 0 64px;
        scroll-snap-align:start;
        padding:0 6px;
        white-space:nowrap;
        border:0;
        border-radius:9px;
        color:#65758a;
        background:transparent;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.48rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.075em;
        text-transform:uppercase;
        cursor:pointer;
      }
      .rp-world-team-chip.active{
        color:#f7fbff;
        background:rgba(10,160,211,.18);
        box-shadow:inset 0 0 0 1px rgba(65,214,255,.14);
      }

      .rp-world-feed-intro{
        display:none;
        margin-top:15px;
        padding:0 3px 2px;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view .rp-world-feed-intro{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view .rp-update-card.rp-update-schedule{
        display:none!important;
      }
      .rp-world-feed-intro strong,
      .rp-world-results-subhead strong{
        color:#f7fbff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.72rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.04em;
        text-transform:uppercase;
      }
      .rp-world-feed-intro span,
      .rp-world-results-subhead span{
        color:#607187;
        font-size:.40rem;
        font-weight:900;
        letter-spacing:.09em;
        text-align:right;
        text-transform:uppercase;
      }
      .rp-world-results-only{
        display:none;
        margin-top:15px;
      }
      .rp-updates.rp-world-results-entry.rp-world-results-view .rp-world-results-only{
        display:block;
      }
      .rp-world-results-subhead{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
        padding:0 3px 1px;
      }

      /* WORLD / FEED uses the same official result source, but presents a compact
         deterministic report card instead of duplicating the full Results art. */
      .rp-world-story-block{display:none}
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"]{
        aspect-ratio:auto!important;
        min-height:0!important;
        overflow:hidden!important;
        padding:15px 15px 14px!important;
        border:1px solid transparent!important;
        border-radius:18px!important;
        background:
          linear-gradient(145deg,rgba(5,11,19,.975),rgba(3,7,13,.99)) padding-box,
          linear-gradient(112deg,rgba(25,184,255,.56),rgba(255,255,255,.055) 52%,rgba(255,45,66,.40)) border-box!important;
        box-shadow:0 16px 38px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.02)!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] > .rp-update-card-head{
        position:static!important;
        width:auto!important;
        height:auto!important;
        margin:0!important;
        padding:0!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        pointer-events:auto!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-kind{
        width:auto!important;
        height:auto!important;
        display:flex!important;
        align-items:center!important;
        gap:9px!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-kind > span{
        width:30px!important;
        height:30px!important;
        flex:0 0 30px!important;
        display:grid!important;
        place-items:center!important;
        border:1px solid rgba(72,216,255,.12)!important;
        border-radius:9px!important;
        color:#56e3ff!important;
        background:rgba(17,117,158,.10)!important;
        font-size:.78rem!important;
        text-shadow:none!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-kind strong{
        font-size:.56rem!important;
        letter-spacing:.09em!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-kind small{
        margin-top:4px!important;
        font-size:.38rem!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] > h2,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-session-name-row,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-score,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-mvp,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-location,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] > footer,
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"]::after{
        display:none!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view .rp-world-story-block{
        display:block!important;
        margin-top:14px;
      }
      .rp-world-story-kicker{
        display:block;
        margin-bottom:7px;
        color:#48d9ff;
        font-size:.43rem;
        font-weight:950;
        letter-spacing:.12em;
        text-transform:uppercase;
      }
      .rp-world-story-block h3{
        margin:0;
        color:#f8fbff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:clamp(.92rem,4.5vw,1.28rem);
        font-style:italic;
        font-weight:950;
        line-height:1.05;
        letter-spacing:.005em;
        text-transform:uppercase;
      }
      .rp-world-story-block p{
        margin:10px 0 0;
        color:#a9b8c8;
        font-size:.67rem;
        font-weight:650;
        line-height:1.55;
      }
      .rp-world-story-statline{
        margin-top:11px;
        padding:9px 10px;
        border:1px solid rgba(72,216,255,.10);
        border-radius:10px;
        color:#d9f7ff;
        background:rgba(14,93,128,.08);
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.045em;
      }
      .rp-world-story-cta{
        display:block;
        margin-top:12px;
        padding-top:10px;
        border-top:1px solid rgba(255,255,255,.055);
        color:#4fdbff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.50rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.08em;
        text-align:right;
        text-transform:uppercase;
      }
      .rp-world-results-filter-row{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:16px;
      }
      .rp-world-results-filter{
        position:relative;
      }
      .rp-world-results-filter label{
        position:absolute;
        z-index:1;
        top:7px;
        left:12px;
        color:#53657b;
        font-size:.38rem;
        font-weight:950;
        letter-spacing:.10em;
        pointer-events:none;
      }
      .rp-world-results-filter select{
        appearance:none;
        -webkit-appearance:none;
        width:100%;
        min-height:48px;
        padding:18px 31px 6px 11px;
        border:1px solid rgba(255,255,255,.085);
        border-radius:12px;
        outline:0;
        color:#eef7ff;
        background:
          linear-gradient(145deg,rgba(7,13,22,.98),rgba(3,7,13,.99));
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.045em;
        text-transform:uppercase;
        cursor:pointer;
      }
      .rp-world-results-filter::after{
        content:'⌄';
        position:absolute;
        right:12px;
        bottom:13px;
        color:#43d7ff;
        font-size:.72rem;
        font-weight:950;
        pointer-events:none;
      }
      .rp-world-results-filter select:focus{
        border-color:rgba(55,213,255,.38);
        box-shadow:0 0 0 1px rgba(55,213,255,.06);
      }
      .rp-world-results-empty{
        display:none;
        padding:36px 18px;
        border:1px dashed rgba(255,255,255,.09);
        border-radius:18px;
        color:#607188;
        background:rgba(4,8,14,.58);
        font-size:.62rem;
        font-weight:850;
        line-height:1.5;
        text-align:center;
      }
      .rp-updates.rp-world-results-entry .rp-world-results-empty.show{
        display:block;
      }

      /* Progressive WORLD feed: three records at a time. The next batch is
         requested only after the user scrolls toward the end of the loaded set. */
      .rp-updates-progressive-initial{
        min-height:150px;
        display:grid;
        place-items:center;
        color:#61758b;
        font-size:.46rem;
        font-weight:950;
        letter-spacing:.12em;
        text-align:center;
      }
      .rp-updates-progressive-sentinel{
        min-height:58px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:14px 8px calc(10px + env(safe-area-inset-bottom));
        color:#52667c;
        font-size:.42rem;
        font-weight:950;
        letter-spacing:.13em;
        text-align:center;
      }
      .rp-updates-progressive-sentinel.loading span{
        color:#4fdcff;
        animation:rpWorldMorePulse .9s ease-in-out infinite alternate;
      }
      .rp-updates-progressive-sentinel .rp-updates-load-more{
        min-width:min(100%,250px);
        min-height:44px;
        padding:0 22px;
        border:1px solid rgba(63,214,255,.22);
        border-radius:14px;
        color:#f5fbff;
        background:
          linear-gradient(100deg,rgba(15,144,207,.20),rgba(4,13,22,.98) 48%,rgba(165,24,44,.16));
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.018),
          0 10px 24px rgba(0,0,0,.22);
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.09em;
        cursor:pointer;
      }
      .rp-updates-progressive-sentinel .rp-updates-load-more:disabled{
        cursor:default;
        opacity:.72;
      }
      .rp-updates.rp-world-results-entry.rp-world-results-view .rp-updates-progressive-sentinel{
        padding-top:17px;
      }
      @keyframes rpWorldMorePulse{from{opacity:.38}to{opacity:1}}
      @media(prefers-reduced-motion:reduce){
        .rp-updates-progressive-sentinel.loading span{animation:none;opacity:.8}
      }
      /* Scoreboard-first WORLD game report. */
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"]{
        padding:14px 14px 13px!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] > .rp-update-card-head{
        display:none!important;
      }
      .rp-updates.rp-world-results-entry.rp-world-feed-view .rp-world-story-block{
        display:block!important;
        margin-top:0!important;
      }
      .rp-world-scorecard-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        min-height:24px;
      }
      .rp-world-scorecard-head strong,
      .rp-world-scorecard-head span{
        font-family:var(--rp-display,Arial,sans-serif);
        font-style:italic;
        font-weight:950;
        text-transform:uppercase;
      }
      .rp-world-scorecard-head strong{
        color:#eef8ff;
        font-size:.66rem;
        letter-spacing:.04em;
      }
      .rp-world-scorecard-head span{
        color:#58ddff;
        font-size:.52rem;
        letter-spacing:.07em;
        text-align:right;
      }
      .rp-world-scorecard-matchup{
        display:grid;
        grid-template-columns:minmax(68px,1fr) minmax(112px,1.35fr) minmax(68px,1fr);
        align-items:center;
        gap:8px;
        min-height:108px;
        padding:13px 2px 11px;
      }
      .rp-world-scorecard-team{
        display:grid;
        justify-items:center;
        align-content:center;
        gap:6px;
        min-width:0;
        text-align:center;
      }
      .rp-world-scorecard-team-logo,
      .rp-world-scorecard-team-fallback{
        width:48px;
        height:48px;
        object-fit:contain;
        display:grid;
        place-items:center;
        box-sizing:border-box;
      }
      .rp-world-scorecard-team-logo{filter:drop-shadow(0 5px 12px rgba(0,0,0,.32))}
      .rp-world-scorecard-team-fallback{
        border:1px solid rgba(255,255,255,.14);
        border-radius:50%;
        color:#f6f9ff;
        background:#0a111b;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:1.12rem;
        font-style:italic;
        font-weight:950;
      }
      .rp-world-scorecard-team-fallback-west{box-shadow:inset 0 0 0 1px rgba(28,190,255,.14)}
      .rp-world-scorecard-team-fallback-east{box-shadow:inset 0 0 0 1px rgba(255,53,71,.14)}
      .rp-world-scorecard-team>span:last-child{
        width:100%;
        overflow:hidden;
        color:#e9f2fb;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.58rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.025em;
        text-overflow:ellipsis;
        text-transform:uppercase;
        white-space:nowrap;
      }
      .rp-world-scorecard-score{
        display:grid;
        grid-template-columns:1fr 22px 1fr;
        align-items:center;
        justify-items:center;
        min-width:0;
      }
      .rp-world-scorecard-score b{
        color:#f8fbff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:2.2rem;
        font-style:italic;
        font-weight:950;
        line-height:1;
        letter-spacing:.015em;
      }
      .rp-world-scorecard-score i{
        color:#778492;
        font-size:1.05rem;
        font-style:normal;
        font-weight:800;
      }
      .rp-world-scorecard-divider{
        height:1px;
        margin:0;
        background:rgba(255,255,255,.095);
      }
      .rp-world-scorecard-stats-head{
        --rp-world-stat-width:174px;
        display:grid;
        grid-template-columns:minmax(0,1fr) var(--rp-world-stat-width);
        align-items:center;
        gap:10px;
        padding:10px 2px 7px;
      }
      .rp-world-scorecard-stats-head>strong{
        color:#8594a3;
        font-size:.48rem;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .rp-world-scorecard-stats-head>span,
      .rp-world-scorecard-mvp-stats{
        display:grid;
        grid-template-columns:repeat(6,minmax(0,1fr));
        align-items:stretch;
        min-width:0;
        text-align:center;
      }
      .rp-world-scorecard-stats-head b,
      .rp-world-scorecard-mvp-stats b{
        display:grid;
        place-items:center;
        min-width:0;
        border-left:1px solid rgba(255,255,255,.075);
      }
      .rp-world-scorecard-stats-head b:last-child,
      .rp-world-scorecard-mvp-stats b:last-child{
        border-right:1px solid rgba(255,255,255,.075);
      }
      .rp-world-scorecard-stats-head b{
        min-height:18px;
        color:#7b8895;
        font-size:.43rem;
        font-weight:900;
        letter-spacing:.04em;
      }
      .rp-world-scorecard-mvp-list{display:grid}
      .rp-world-scorecard-mvp-row{
        --rp-world-stat-width:174px;
        display:grid;
        grid-template-columns:minmax(0,1fr) var(--rp-world-stat-width);
        align-items:center;
        gap:10px;
        min-height:44px;
        padding:6px 2px;
        border-top:1px solid rgba(255,255,255,.045);
      }
      .rp-world-scorecard-mvp-name{
        display:grid;
        gap:2px;
        min-width:0;
      }
      .rp-world-scorecard-mvp-name small{
        color:#617182;
        font-size:.39rem;
        font-weight:900;
        letter-spacing:.055em;
        text-transform:uppercase;
      }
      .rp-world-scorecard-mvp-name strong{
        overflow:hidden;
        color:#eef7ff;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.60rem;
        font-style:italic;
        font-weight:950;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .rp-world-scorecard-mvp-stats b{
        min-height:28px;
        color:#dce8f1;
        font-size:.58rem;
        font-weight:900;
      }
      .rp-updates.rp-world-results-entry .rp-update-card.rp-update-result{
        cursor:default!important;
      }
      .rp-world-scorecard-actions{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        align-items:stretch;
        margin-top:8px;
        min-height:42px;
        border-top:1px solid rgba(255,255,255,.075);
      }
      .rp-world-scorecard-actions button{
        min-width:0;
        min-height:42px;
        padding:0 7px;
        border:0;
        border-right:1px solid rgba(255,255,255,.075);
        color:#9aabba;
        background:transparent;
        font-family:var(--rp-display,Arial,sans-serif);
        font-size:.47rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.035em;
        text-align:center;
        cursor:pointer;
        transition:color .14s ease,background .14s ease;
      }
      .rp-world-scorecard-actions button:last-child{border-right:0}
      .rp-world-scorecard-actions button.watch{color:#55dcff}
      .rp-world-scorecard-actions button:hover,
      .rp-world-scorecard-actions button:focus-visible{
        color:#eefaff;
        background:rgba(63,211,255,.045);
        outline:none;
      }
      .rp-world-scorecard-actions button:active{
        background:rgba(63,211,255,.075);
      }
      .rp-world-scorecard-recap-copy{
        margin-top:8px;
        padding:10px;
        border:1px solid rgba(255,255,255,.06);
        border-radius:10px;
        background:rgba(255,255,255,.018);
      }
      .rp-world-scorecard-recap-copy[hidden]{display:none!important}
      .rp-world-scorecard-recap-copy strong{
        display:block;
        color:#edf6ff;
        font-size:.61rem;
        font-weight:900;
        line-height:1.3;
      }
      .rp-world-scorecard-recap-copy p{
        margin:6px 0 0!important;
        color:#8fa0b1!important;
        font-size:.56rem!important;
        line-height:1.45!important;
      }

      @media(max-width:360px){
        .rp-world-scorecard-matchup{grid-template-columns:minmax(60px,1fr) minmax(100px,1.2fr) minmax(60px,1fr);gap:5px}
        .rp-world-scorecard-team-logo,.rp-world-scorecard-team-fallback{width:42px;height:42px}
        .rp-world-scorecard-score b{font-size:1.95rem}
        .rp-world-scorecard-stats-head,.rp-world-scorecard-mvp-row{--rp-world-stat-width:156px;grid-template-columns:minmax(0,1fr) var(--rp-world-stat-width)}
        .rp-world-results-filter-row{gap:6px}
        .rp-world-results-filter select{font-size:.53rem;padding-left:9px}
      }
    `;
    document.head.appendChild(style);
  }

  function markWorldActive() {
    document.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === 'world';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function removeLegacyWorldResults() {
    document.querySelectorAll('[data-rp-world-results]').forEach((node) => node.remove());
  }

  function updatesPanel() {
    return document.querySelector('[data-rp-updates]');
  }

  function worldVisualReady() {
    const panel = updatesPanel();
    if (!panel?.classList.contains('open')) return false;
    if (!panel.classList.contains('rp-world-results-entry')) return false;
    if (!document.body.classList.contains('rp-updates-open')) return false;

    // The core route shell intentionally keeps WORLD visibility:hidden while
    // loading so HOME can never flash underneath it. That hidden state is not
    // a failure; it is the transition contract. Verify that the real WORLD
    // page is structurally/layout ready underneath the shell, then let core
    // navigation remove the shell and reveal it atomically.
    const style = window.getComputedStyle(panel);
    if (style.display === 'none') return false;
    if (style.position !== 'fixed') return false;

    const controls = panel.querySelector('[data-rp-world-results-controls]');
    const feed = panel.querySelector('[data-updates-feed]');
    return Boolean(controls && feed);
  }

  function announceWorldReady(detail = {}) {
    let attempts = 0;
    const verify = () => {
      attempts += 1;
      if (worldVisualReady()) {
        try {
          window.dispatchEvent(new CustomEvent('realplay:world-loaded', {
            detail: { ...detail, visualReady: true },
          }));
        } catch (_error) {}
        return;
      }
      if (attempts < 24) {
        window.requestAnimationFrame(verify);
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('realplay:world-load-error', {
          detail: { message: 'WORLD loaded data but its page was not visually ready.' },
        }));
      } catch (_error) {}
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(verify));
  }

  function setWorldResultsMode(enabled) {
    const panel = updatesPanel();
    if (!panel) return;
    panel.classList.toggle('rp-world-results-entry', Boolean(enabled));
    if (!enabled) {
      panel.classList.remove('rp-world-feed-view', 'rp-world-results-view');
      return;
    }
    panel.classList.toggle('rp-world-feed-view', selectedView === 'feed');
    panel.classList.toggle('rp-world-results-view', selectedView === 'results');
  }

  function chooseUpdatesFilter(name, attempt = 0) {
    const target = document.querySelector(`[data-rp-updates] [data-update-filter="${name}"]`);
    if (target) {
      if (!target.classList.contains('active')) target.click();
      window.setTimeout(() => {
        ensureWorldControls();
        decorateStoryCards();
        applyWorldFilters();
      }, 0);
      return;
    }
    if (attempt < 12) window.setTimeout(() => chooseUpdatesFilter(name, attempt + 1), 50);
  }

  function syncWorldTabs() {
    const panel = updatesPanel();
    panel?.querySelectorAll('[data-rp-world-tab]').forEach((button) => {
      const active = button.dataset.rpWorldTab === selectedView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

  async function waitForWorldViewVisualSettle({ isResults, expected = 0, sequence }) {
    const panel = updatesPanel();
    const feed = panel?.querySelector('[data-updates-feed]');
    if (!panel || !feed) throw new Error('WORLD view is not mounted yet.');

    // WORLD readiness is intentionally first-layer only. The loader protects
    // the first usable frame, not the entire result history.
    const criticalCards = () => [...feed.querySelectorAll('.rp-update-result')]
      .filter((card) => !card.hidden);
    // Data can load successfully while the selected competition is absent
    // from the first server page. Visibility is a FILTER outcome, not an
    // indicator of failed loading.
    const requiredFirstCard = Math.max(0, Number(expected) || 0) > 0
      && criticalCards().length > 0;

    const started = performance.now();
    let firstCard = criticalCards()[0] || null;
    while (requiredFirstCard && !firstCard && performance.now() - started < 1800) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      firstCard = criticalCards()[0] || null;
    }
    if (requiredFirstCard && !firstCard) {
      throw new Error('The first game result is still being prepared.');
    }

    // If the first card needs a team-MVP fallback, that is part of the visible
    // card itself, so keep the loader until that one critical hydration ends.
    if (firstCard?.dataset.rpWorldMvpHydrating === 'true') {
      const mvpStarted = performance.now();
      while (
        firstCard?.dataset.rpWorldMvpHydrating === 'true'
        && performance.now() - mvpStarted < 3200
      ) {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }
    }

    const criticalRoot = firstCard || feed;

    // Only typography/assets that can affect the first visible card hold the
    // loader. Lower cards and later pages continue progressively.
    try {
      await Promise.race([
        document.fonts?.ready || Promise.resolve(),
        wait(700),
      ]);
    } catch (_error) {}

    const pendingImages = [...criticalRoot.querySelectorAll('img[src]')]
      .filter((img) => !img.complete)
      .slice(0, 6);
    if (pendingImages.length) {
      await Promise.race([
        Promise.all(pendingImages.map((img) => new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }))),
        wait(900),
      ]);
    }

    // Require a short quiet window only on the critical first layer. Mutations
    // farther down the feed are explicitly allowed after reveal.
    await new Promise((resolve) => {
      let done = false;
      let quietTimer = 0;
      let maxTimer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        if (quietTimer) window.clearTimeout(quietTimer);
        if (maxTimer) window.clearTimeout(maxTimer);
        observer.disconnect();
        resolve();
      };
      const armQuiet = () => {
        if (quietTimer) window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(finish, isResults ? 260 : 220);
      };
      const observer = new MutationObserver(armQuiet);
      observer.observe(criticalRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style', 'src'],
      });
      armQuiet();
      maxTimer = window.setTimeout(finish, 850);
    });

    await new Promise((resolve) => window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    }));

    if (sequence !== viewLoadSequence) throw new Error('WORLD view changed while loading.');

    const panelRect = panel.getBoundingClientRect();
    const feedRect = feed.getBoundingClientRect();
    if (panelRect.width < 40 || panelRect.height < 40 || feedRect.width < 40) {
      throw new Error('WORLD is still settling.');
    }

    if (requiredFirstCard) {
      const card = criticalCards()[0];
      const rect = card?.getBoundingClientRect?.();
      if (!card || !rect || rect.width < 40 || rect.height < 40) {
        throw new Error('The first game result is still settling.');
      }
    }
  }

  function loadWorldView(view, { initial = false } = {}) {
    const nextView = view === 'results' ? 'results' : 'feed';
    const isResults = nextView === 'results';
    // WORLD FEED currently shows game-result stories only. Query results
    // directly so hidden schedule/announcement records never consume the
    // progressive page slots and make the feed look empty.
    const category = 'result';
    const routeTarget = isResults ? 'world-results' : 'world';
    const pageSize = isResults ? 2 : 3;
    const loadMode = isResults ? 'button' : 'auto';
    const loadingLabel = isResults ? 'LOADING GAME RESULTS...' : 'LOADING LATEST FROM REAL PLAY...';
    const sequence = ++viewLoadSequence;
    const loadingStartedAt = performance.now();
    // A reopened World feed starts a fresh server pagination cursor.
    lastCategoryAutoFetchOffset = null;
    categoryAutoFetchCount = 0;
    // The loader is now readiness-driven. Keep only a tiny anti-flash floor;
    // never hold a finished first layer just to display the loader longer.
    const minimumLoadingMs = 120;

    // The old view is never allowed to be the transition surface. Show the
    // destination-owned loader first and keep it for a short minimum window so
    // even fast/cache-hit requests cannot visually leak the previous content.
    window.RealPlayRouteShell?.show?.(routeTarget);
    selectedView = nextView;
    setWorldResultsMode(true);
    ensureWorldControls();
    syncWorldTabs();

    let settled = false;
    let timer = 0;

    const cleanup = () => {
      window.removeEventListener('realplay:updates-page-loaded', onLoaded);
      window.removeEventListener('realplay:updates-page-error', onError);
      if (timer) window.clearTimeout(timer);
    };

    const fail = (message) => {
      if (settled || sequence !== viewLoadSequence) return;
      settled = true;
      cleanup();
      if (initial) {
        try {
          window.dispatchEvent(new CustomEvent('realplay:world-load-error', {
            detail: { message: message || 'WORLD could not finish loading.' },
          }));
        } catch (_error) {}
        return;
      }
      window.RealPlayRouteShell?.error?.(
        routeTarget,
        message || (isResults ? 'Game results could not finish loading.' : 'The World feed could not finish loading.')
      );
    };

    const reveal = async (detail = {}) => {
      if (settled || sequence !== viewLoadSequence) return;

      if (isResults) {
        resultTotal = detail.categoryScopedByServer && Number.isFinite(Number(detail.total))
          ? Math.max(0, Number(detail.total))
          : 0;
      }

      loadResultMetadata();
      setWorldResultsMode(true);
      ensureWorldControls();
      syncWorldTabs();
      applyWorldFilters();

      try {
        await waitForWorldViewVisualSettle({
          isResults,
          expected: Math.min(pageSize, Math.max(0, Number(detail.loaded) || 0)),
          sequence,
        });
      } catch (error) {
        fail(error?.message || (isResults
          ? 'Game results are still being prepared.'
          : 'The World feed is still being prepared.'));
        return;
      }

      if (settled || sequence !== viewLoadSequence) return;

      const elapsed = performance.now() - loadingStartedAt;
      const remaining = Math.max(0, minimumLoadingMs - elapsed);
      if (remaining > 0) await wait(remaining);

      if (settled || sequence !== viewLoadSequence) return;
      settled = true;
      cleanup();

      if (initial) {
        announceWorldReady({
          loaded: Number(detail.loaded || 0),
          rendered: Number(detail.rendered || 0),
          hasMore: Boolean(detail.hasMore),
        });
      } else {
        window.RealPlayRouteShell?.hide?.(routeTarget);
      }
    };

    const onLoaded = (event) => {
      const detail = event?.detail || {};
      if (!detail.progressive || detail.append) return;
      if (String(detail.category || '') !== category) return;
      reveal(detail);
    };

    const onError = (event) => {
      const detail = event?.detail || {};
      if (detail.append) return;
      if (String(detail.category || '') !== category) return;
      fail(detail.message);
    };

    window.addEventListener('realplay:updates-page-loaded', onLoaded);
    window.addEventListener('realplay:updates-page-error', onError);

    window.RealPlayUpdates?.open?.({
      progressive: true,
      pageSize,
      category,
      loadMode,
      loadingLabel,
    });

    setWorldResultsMode(true);
    ensureWorldControls();
    syncWorldTabs();

    timer = window.setTimeout(() => {
      fail(isResults
        ? 'The latest game results did not finish loading.'
        : 'The latest Real Play feed did not finish loading.');
    }, 9000);
  }

  function setWorldView(view) {
    loadWorldView(view, { initial: false });
  }

  function manilaWeekStart(value) {
    const ms = Date.parse(value || '');
    if (!Number.isFinite(ms)) return '';
    const local = new Date(ms + MANILA_OFFSET_MS);
    const weekday = local.getUTCDay();
    const daysFromMonday = (weekday + 6) % 7;
    const startUtcLike = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - daysFromMonday
    );
    const start = new Date(startUtcLike);
    const y = start.getUTCFullYear();
    const m = String(start.getUTCMonth() + 1).padStart(2, '0');
    const d = String(start.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function weekLabel(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'WEEK';
    const [y, m, d] = key.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 6));
    const fmt = (date) => new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date).toUpperCase();
    return `${fmt(start)} – ${fmt(end)}`;
  }

  function classifyGameType(update, card) {
    const metadata = update?.metadata || {};
    const text = [
      update?.title,
      update?.body,
      update?.source_key,
      update?.sourceKey,
      metadata.gameType,
      metadata.game_type,
      metadata.mode,
      metadata.format,
      metadata.sessionType,
      metadata.session_type,
      metadata.league,
      metadata.division,
      card?.querySelector('h2')?.textContent,
      card?.textContent,
    ].filter(Boolean).join(' ').toLowerCase();

    if (/\b5\s*v\s*5\b|\b5-on-5\b|\bfive v five\b|\bfull court\b/.test(text)) return '5v5';
    if (/\b3\s*v\s*3\b|\b3-on-3\b|\bthree v three\b|\bfounding four\b|\brace to 8\b/.test(text)) return '3v3';
    if (/\bopen[\s-]?rank(?:ing)?\b|\branking session\b|\bcareer session\b|\beast vs west\b/.test(text)) return 'open-rank';
    return 'other';
  }

  function loadResultMetadata() {
    // WORLD is progressively paginated. Reuse only the update records that
    // RealPlayUpdates has actually loaded so this layer never performs a
    // hidden full-history request behind the first three visible cards.
    const loaded = window.RealPlayUpdates?.getUpdates?.();
    const next = new Map();
    (Array.isArray(loaded) ? loaded : [])
      .filter((item) => item?.category === 'result')
      .forEach((item) => next.set(String(item.id), item));
    resultMetadata = next;
    rebuildContextOptions();
    decorateStoryCards();
    applyWorldFilters();
  }


  function fallbackStory(update) {
    const metadata = update?.metadata || {};
    const west = Number(metadata.westScore);
    const east = Number(metadata.eastScore);
    if (!Number.isFinite(west) || !Number.isFinite(east)) return null;

    const westName = String(metadata.westTeamName || metadata.west_team_name || 'WEST').trim().toUpperCase() || 'WEST';
    const eastName = String(metadata.eastTeamName || metadata.east_team_name || 'EAST').trim().toUpperCase() || 'EAST';
    const tie = west === east;
    const winnerSide = tie ? '' : (west > east ? 'WEST' : 'EAST');
    const loserSide = tie ? '' : (west > east ? 'EAST' : 'WEST');
    const winner = winnerSide === 'WEST' ? westName : winnerSide === 'EAST' ? eastName : '';
    const loser = loserSide === 'WEST' ? westName : loserSide === 'EAST' ? eastName : '';
    const winnerScore = Math.max(west, east);
    const loserScore = Math.min(west, east);
    const margin = Math.abs(west - east);
    const mvp = metadata.gameMvp || {};
    const mvpName = String(mvp.playerName || mvp.name || '').trim();
    const statParts = [
      Number(mvp.points || 0) > 0 ? `${Number(mvp.points)} PTS` : '',
      Number(mvp.assists || 0) > 0 ? `${Number(mvp.assists)} AST` : '',
      Number(mvp.rebounds || 0) > 0 ? `${Number(mvp.rebounds)} REB` : '',
    ].filter(Boolean);
    const score = tie ? `${west}-${east}` : `${winnerScore}-${loserScore}`;

    let headline = tie
      ? `${westName} AND ${eastName} FINISH LEVEL, ${score}`
      : margin <= 2
        ? `${winner} HOLDS OFF ${loser}, ${score}`
        : `${winner} DEFEATS ${loser}, ${score}`;

    if (!tie && mvpName && String(mvp.team || '').toUpperCase() === winnerSide && Number(mvp.points || 0) >= Math.ceil(winnerScore / 2)) {
      headline = `${mvpName} LEADS ${winner} PAST ${loser}, ${score}`;
    }

    const summary = mvpName
      ? `${mvpName} earned Game MVP${statParts.length ? ` with ${statParts.join(' · ')}` : ''} in the official ${score} result between ${westName} and ${eastName}.`
      : tie
        ? `${westName} and ${eastName} finished level at ${score} in an official Real Play game.`
        : `${winner} defeated ${loser}, ${score}, in an official Real Play game.`;

    return {
      kind: 'GAME_REPORT',
      headline,
      summary,
      statLine: statParts.join(' · '),
      generatedBy: 'REAL_PLAY_TEMPLATE_LIBRARY',
      source: 'VERIFIED_GAME_RECORD',
    };
  }

  function storyForUpdate(update) {
    const story = update?.metadata?.story;
    if (story && typeof story === 'object' && String(story.headline || '').trim()) return story;
    return fallbackStory(update);
  }

  const WORLD_CLUB_ART = {
    LIONS: 'assets/3v3/clubs/lions-logo.png',
    VALIANT: 'assets/3v3/clubs/valiant-logo.png',
    WATCHMEN: 'assets/3v3/clubs/watchmen-logo.png',
    CONQUERORS: 'assets/3v3/clubs/conquerors-logo.png',
    CHOSEN: 'assets/3v3/clubs/chosen-logo.png',
    EAGLES: 'assets/3v3/clubs/eagles-logo.png',
    STEADFAST: 'assets/3v3/clubs/steadfast-logo.png',
    WARRIORS: 'assets/3v3/clubs/warriors-logo.png',
  };
  const CURRENT_WORLD_TEAMS = Object.freeze(Object.keys(WORLD_CLUB_ART));

  function worldResultTitle(metadata = {}) {
    const competition = competitionInfo({ metadata }).key;
    const seasonGame = Number(metadata.seasonGameNumber ?? metadata.season_game_number);
    const openRank = Number(metadata.openRankNumber ?? metadata.open_rank_number);
    if (competition === 'open-rank' && Number.isSafeInteger(openRank) && openRank > 0) {
      return `OPEN RANK #${String(openRank).padStart(3, '0')}`;
    }
    if (competition !== 'open-rank' && Number.isSafeInteger(seasonGame) && seasonGame > 0) {
      const label = competition === 'league' ? 'LEAGUE' : 'TUNE UP';
      return `${label} #${String(seasonGame).padStart(2, '0')}`;
    }
    return String(
      metadata.resultDisplayTitle ?? metadata.result_display_title
      ?? metadata.sessionTitle ?? metadata.session_title ?? 'GAME RESULT'
    ).trim().toUpperCase();
  }
  function worldTeamLogo(name, side) {
    const cleanName = String(name || '').trim().toUpperCase();
    const src = WORLD_CLUB_ART[cleanName];
    if (src) {
      return `<img class="rp-world-scorecard-team-logo" src="${esc(src)}" alt="${esc(cleanName)} team logo" loading="lazy" decoding="async">`;
    }
    const initial = cleanName.charAt(0) || (side === 'east' ? 'E' : 'W');
    return `<span class="rp-world-scorecard-team-fallback rp-world-scorecard-team-fallback-${side}" aria-hidden="true">${esc(initial)}</span>`;
  }

  function normalizedTeamMvp(metadata = {}, side) {
    const gameMvp = metadata.gameMvp ?? metadata.game_mvp ?? null;
    const teamMvps = gameMvp?.teamMvps ?? gameMvp?.team_mvps ?? metadata.teamMvps ?? metadata.team_mvps ?? {};
    const direct = teamMvps?.[side] || null;
    if (direct) return direct;

    const overallTeam = String(gameMvp?.team || '').trim().toLowerCase();
    return overallTeam === side ? gameMvp : null;
  }

  function normalizeReplayMvp(player = {}) {
    const rawId = Number(player.playerId ?? player.player_id ?? player.userId ?? player.user_id);
    const identityKey = String(player.identityKey ?? player.identity_key ?? (
      Number.isSafeInteger(rawId) && rawId !== 0
        ? (rawId < 0 ? `manual:${Math.abs(rawId)}` : `user:${rawId}`)
        : ''
    )).trim();
    return {
      identityKey,
      didNotPlay: player.didNotPlay === true || player.did_not_play === true
        || String(player.participationStatus ?? player.participation_status ?? '').toUpperCase() === 'DNP',
      playerName: String(player.playerName ?? player.player_name ?? player.name ?? '').trim(),
      team: String(player.team || '').trim().toLowerCase(),
      points: Number(player.points ?? player.pts ?? 0),
      assists: Number(player.assists ?? player.ast ?? 0),
      rebounds: Number(player.rebounds ?? player.reb ?? 0),
      turnovers: Number(player.turnovers ?? player.tov ?? 0),
      steals: Number(player.steals ?? player.stl ?? 0),
      blocks: Number(player.blocks ?? player.blk ?? 0),
      fouls: Number(player.fouls ?? player.foul ?? 0),
      madeShots: Number(
        player.madeShots
        ?? player.made_shots
        ?? (Number(player.onePtMade || 0) + Number(player.twoPtMade || 0))
      ),
      missedShots: Number(
        player.missedShots
        ?? player.missed_shots
        ?? (Number(player.onePtMiss || 0) + Number(player.twoPtMiss || 0))
      ),
    };
  }

  function replayMvpImpact(player = {}) {
    return Number(player.points || 0)
      + (Number(player.rebounds || 0) * 1.2)
      + (Number(player.assists || 0) * 1.5)
      + (Number(player.steals || 0) * 2)
      + (Number(player.blocks || 0) * 2)
      - (Number(player.turnovers || 0) * 1.5)
      - (Number(player.missedShots || 0) * 0.5)
      - (Number(player.fouls || 0) * 0.25);
  }

  function replayMvpFgPct(player = {}) {
    const made = Number(player.madeShots || 0);
    const missed = Number(player.missedShots || 0);
    const attempts = made + missed;
    return attempts > 0 ? made / attempts : 0;
  }

  function isBetterReplayMvp(candidate, current) {
    if (!current) return true;
    const impactDiff = replayMvpImpact(candidate) - replayMvpImpact(current);
    if (Math.abs(impactDiff) > 0.0001) return impactDiff > 0;

    const fgDiff = replayMvpFgPct(candidate) - replayMvpFgPct(current);
    if (Math.abs(fgDiff) > 0.000001) return fgDiff > 0;

    if (candidate.points !== current.points) return candidate.points > current.points;
    if (candidate.turnovers !== current.turnovers) return candidate.turnovers < current.turnovers;
    const nameDiff = String(candidate.playerName || '').localeCompare(String(current.playerName || ''));
    if (nameDiff !== 0) return nameDiff < 0;
    const candidateKey = String(candidate.identityKey || '').trim();
    const currentKey = String(current.identityKey || '').trim();
    return Boolean(candidateKey && currentKey && candidateKey < currentKey);
  }

  function deriveReplayTeamMvps(playerStats = []) {
    const winners = { west: null, east: null };
    (Array.isArray(playerStats) ? playerStats : []).forEach((raw) => {
      const player = normalizeReplayMvp(raw);
      if (!['west', 'east'].includes(player.team) || !player.playerName || player.didNotPlay) return;
      if (isBetterReplayMvp(player, winners[player.team])) winners[player.team] = player;
    });
    return winners;
  }

  async function loadReplayTeamMvps(sessionId) {
    const id = Number(sessionId);
    if (!Number.isSafeInteger(id) || id <= 0) return { west: null, east: null };
    if (teamMvpReplayCache.has(id)) return teamMvpReplayCache.get(id);
    if (teamMvpReplayRequests.has(id)) return teamMvpReplayRequests.get(id);

    const request = fetch(`https://api.clarapmc.com/api/real-play/public/career/games/${id}/replay`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Replay stats unavailable');
        const data = await response.json();
        const mvps = deriveReplayTeamMvps(data?.playerStats);
        teamMvpReplayCache.set(id, mvps);
        return mvps;
      })
      .catch(() => ({ west: null, east: null }))
      .finally(() => teamMvpReplayRequests.delete(id));

    teamMvpReplayRequests.set(id, request);
    return request;
  }

  function hydrateMissingWorldTeamMvps(card, metadata, westMvp, eastMvp) {
    if (westMvp && eastMvp) {
      if (card) delete card.dataset.rpWorldMvpHydrating;
      return;
    }
    const sessionId = Number(metadata.sessionId ?? metadata.session_id);
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return;

    card.dataset.rpWorldMvpHydrating = 'true';
    loadReplayTeamMvps(sessionId).then((mvps) => {
      if (!card?.isConnected) return;
      const rows = card.querySelectorAll('.rp-world-scorecard-mvp-row');
      if (rows.length < 2) return;

      const westName = String(metadata.westTeamName ?? metadata.west_team_name ?? 'WEST').trim().toUpperCase() || 'WEST';
      const eastName = String(metadata.eastTeamName ?? metadata.east_team_name ?? 'EAST').trim().toUpperCase() || 'EAST';

      if (!westMvp && mvps?.west) rows[0].outerHTML = worldMvpRow(westName, mvps.west);
      if (!eastMvp && mvps?.east) rows[1].outerHTML = worldMvpRow(eastName, mvps.east);
    }).catch(() => {}).finally(() => {
      if (card?.isConnected) delete card.dataset.rpWorldMvpHydrating;
    });
  }

  function worldMvpRow(teamName, mvp) {
    const name = String(mvp?.playerName ?? mvp?.player_name ?? mvp?.name ?? '').trim() || '—';
    const points = Number(mvp?.points || 0);
    const assists = Number(mvp?.assists || 0);
    const rebounds = Number(mvp?.rebounds || 0);
    const steals = Number(mvp?.steals || 0);
    const blocks = Number(mvp?.blocks || 0);
    const turnovers = Number(mvp?.turnovers || 0);
    return `
      <div class="rp-world-scorecard-mvp-row">
        <div class="rp-world-scorecard-mvp-name">
          <small>${esc(teamName)} MVP</small>
          <strong>${esc(name)}</strong>
        </div>
        <div class="rp-world-scorecard-mvp-stats" aria-label="${esc(name)} stats">
          <b>${points}</b><b>${assists}</b><b>${rebounds}</b><b>${steals}</b><b>${blocks}</b><b>${turnovers}</b>
        </div>
      </div>`;
  }

  function decorateStoryCard(card) {
    if (!card) return;
    const update = resultMetadata.get(String(card.dataset.updateId || ''));
    const story = storyForUpdate(update);
    const metadata = update?.metadata || {};
    const west = Number(metadata.westScore ?? metadata.west_score);
    const east = Number(metadata.eastScore ?? metadata.east_score);
    if (!story || !Number.isFinite(west) || !Number.isFinite(east)) return;

    const westName = String(metadata.westTeamName ?? metadata.west_team_name ?? 'WEST').trim().toUpperCase() || 'WEST';
    const eastName = String(metadata.eastTeamName ?? metadata.east_team_name ?? 'EAST').trim().toUpperCase() || 'EAST';
    const resultLabel = west === east
      ? 'TIE'
      : `${west > east ? westName : eastName} WIN`;
    const westMvp = normalizedTeamMvp(metadata, 'west');
    const eastMvp = normalizedTeamMvp(metadata, 'east');

    let block = card.querySelector('[data-rp-world-story]');
    if (!block) {
      block = document.createElement('section');
      block.className = 'rp-world-story-block';
      block.dataset.rpWorldStory = 'true';
      card.appendChild(block);
    }

    block.innerHTML = `
      <div class="rp-world-scorecard-head">
        <strong>${esc(worldResultTitle(metadata))}</strong>
        <span>${esc(resultLabel)}</span>
      </div>

      <div class="rp-world-scorecard-matchup">
        <div class="rp-world-scorecard-team">
          ${worldTeamLogo(westName, 'west')}
          <span>${esc(westName)}</span>
        </div>
        <div class="rp-world-scorecard-score" aria-label="${esc(westName)} ${west}, ${esc(eastName)} ${east}">
          <b>${west}</b><i>−</i><b>${east}</b>
        </div>
        <div class="rp-world-scorecard-team">
          ${worldTeamLogo(eastName, 'east')}
          <span>${esc(eastName)}</span>
        </div>
      </div>

      <div class="rp-world-scorecard-divider"></div>

      <div class="rp-world-scorecard-stats-head">
        <strong>STATS</strong>
        <span><b>PTS</b><b>AST</b><b>REB</b><b>STL</b><b>BLK</b><b>TO</b></span>
      </div>
      <div class="rp-world-scorecard-mvp-list">
        ${worldMvpRow(westName, westMvp)}
        ${worldMvpRow(eastName, eastMvp)}
      </div>

      <div class="rp-world-scorecard-divider"></div>

      <div class="rp-world-scorecard-actions" role="group" aria-label="Game actions">
        <button type="button" data-rp-world-game-recap>GAME RECAP</button>
        <button type="button" class="watch" data-rp-world-watch>WATCH</button>
        <button type="button" data-rp-world-story-toggle aria-expanded="false">READ STORY</button>
      </div>
      <div class="rp-world-scorecard-recap-copy" data-rp-world-story-copy hidden>
        ${story.headline ? `<strong>${esc(story.headline)}</strong>` : ''}
        ${story.summary ? `<p>${esc(story.summary)}</p>` : ''}
      </div>`;

    block.querySelector('[data-rp-world-story-toggle]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const button = event.currentTarget;
      const copy = block.querySelector('[data-rp-world-story-copy]');
      if (!copy) return;
      const open = copy.hidden;
      copy.hidden = !open;
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.textContent = open ? 'HIDE STORY' : 'READ STORY';
    });

    hydrateMissingWorldTeamMvps(card, metadata, westMvp, eastMvp);

    const label = card.querySelector('.rp-update-kind strong');
    if (label) {
      if (!label.dataset.rpWorldDefaultLabel) label.dataset.rpWorldDefaultLabel = label.textContent || 'RESULT';
      label.textContent = selectedView === 'feed' ? 'GAME REPORT' : label.dataset.rpWorldDefaultLabel;
    }
  }

  function decorateStoryCards() {
    const panel = updatesPanel();
    if (!panel?.classList.contains('rp-world-results-entry')) return;
    panel.querySelectorAll('[data-updates-feed] .rp-update-result[data-update-id]').forEach(decorateStoryCard);
  }

  function installTeamFilterSwipe(teamFilter) {
    if (!teamFilter || teamFilter.__rpTeamSwipeInstalled) return;
    teamFilter.__rpTeamSwipeInstalled = true;

    // Touch devices keep the browser's native horizontal swipe behavior.
    // Desktop users can drag the same row left/right with the mouse.
    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let moved = false;
    let suppressClickUntil = 0;

    teamFilter.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = teamFilter.scrollLeft;
      dragging = true;
      moved = false;
      teamFilter.setPointerCapture?.(pointerId);
    });

    teamFilter.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      if (!moved && Math.abs(deltaX) < 5) return;
      moved = true;
      event.preventDefault();
      teamFilter.scrollLeft = startScrollLeft - deltaX;
    });

    const finishDrag = (event) => {
      if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return;
      if (moved) suppressClickUntil = performance.now() + 180;
      try { teamFilter.releasePointerCapture?.(pointerId); } catch (_error) {}
      pointerId = null;
      dragging = false;
      moved = false;
    };

    teamFilter.addEventListener('pointerup', finishDrag);
    teamFilter.addEventListener('pointercancel', finishDrag);

    // Prevent a drag-release over a team chip from accidentally selecting it.
    teamFilter.addEventListener('click', (event) => {
      if (performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    // Mouse-wheel / trackpad fallback: vertical wheel motion becomes horizontal
    // only while this row still has room to scroll in that direction.
    teamFilter.addEventListener('wheel', (event) => {
      if (teamFilter.scrollWidth <= teamFilter.clientWidth + 1) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;

      const maxScroll = Math.max(0, teamFilter.scrollWidth - teamFilter.clientWidth);
      const atStart = teamFilter.scrollLeft <= 1;
      const atEnd = teamFilter.scrollLeft >= maxScroll - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

      event.preventDefault();
      teamFilter.scrollLeft = Math.max(0, Math.min(maxScroll, teamFilter.scrollLeft + delta));
    }, { passive: false });
  }

  function ensureWorldControls() {
    const panel = updatesPanel();
    const feed = panel?.querySelector('[data-updates-feed]');
    if (!panel || !feed) return false;

    let controls = panel.querySelector('[data-rp-world-results-controls]');
    if (!controls) {
      controls = document.createElement('section');
      controls.className = 'rp-world-results-controls';
      controls.dataset.rpWorldResultsControls = 'true';
      controls.innerHTML = `
        <div class="rp-world-context-picker" aria-label="Competition filters">
          <div class="rp-world-context-main">
            <select class="rp-world-context-select" data-rp-world-competition aria-label="Competition">
              <option value="open-rank">OPEN RANKING</option>
              <option value="tune-up">TUNE UP</option>
              <option value="league">LEAGUE</option>
            </select>
            <span class="rp-world-context-dot" aria-hidden="true">·</span>
            <select class="rp-world-context-select" data-rp-world-season aria-label="Season">
              <option value="tune-up-s1">SEASON 1</option>
            </select>
            <span class="rp-world-context-chevron" aria-hidden="true">⌄</span>
          </div>
        </div>
        <div class="rp-world-date-custom" data-rp-world-date-custom hidden>
          <label>From<input type="date" data-rp-world-date-from aria-label="Start game date"></label>
          <label>To<input type="date" data-rp-world-date-to aria-label="End game date"></label>
        </div>
        <div class="rp-world-team-filter" data-rp-world-team-filter aria-label="Team filter"></div>`;
      feed.parentElement?.insertBefore(controls, feed);

      controls.querySelector('[data-rp-world-competition]')?.addEventListener('change', (event) => {
        selectedCompetition = event.currentTarget.value || 'tune-up';
        selectedSeason = '';
        selectedDateRange = 'all';
        lastCategoryAutoFetchOffset = null;
        categoryAutoFetchCount = 0;
        selectedTeam = 'all';
        rebuildContextOptions();
        applyWorldFilters();
      });
      controls.querySelector('[data-rp-world-season]')?.addEventListener('change', (event) => {
        if (selectedCompetition === 'open-rank') {
          selectedDateRange = event.currentTarget.value || 'all';
        } else {
          selectedSeason = event.currentTarget.value || '';
        }
        lastCategoryAutoFetchOffset = null;
        categoryAutoFetchCount = 0;
        selectedTeam = 'all';
        rebuildContextOptions();
        applyWorldFilters();
      });
      const fromInput = controls.querySelector('[data-rp-world-date-from]');
      const toInput = controls.querySelector('[data-rp-world-date-to]');
      for (const input of [fromInput, toInput]) {
        input?.addEventListener('change', () => {
          customDateFrom = fromInput.value;
          customDateTo = toInput.value;
          lastCategoryAutoFetchOffset = null;
          categoryAutoFetchCount = 0;
          applyWorldFilters();
        });
      }
      const teamFilter = controls.querySelector('[data-rp-world-team-filter]');
      installTeamFilterSwipe(teamFilter);
      teamFilter?.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-rp-world-team]');
        if (!button) return;
        selectedTeam = button.dataset.rpWorldTeam || 'all';
        rebuildContextOptions();
        applyWorldFilters();
      });
    }

    if (!panel.querySelector('[data-rp-world-results-empty]')) {
      const empty = document.createElement('div');
      empty.className = 'rp-world-results-empty';
      empty.dataset.rpWorldResultsEmpty = 'true';
      empty.textContent = 'NO OFFICIAL GAMES MATCH THESE FILTERS YET.';
      feed.insertAdjacentElement('afterend', empty);
    }

    if (!feedObserver) {
      feedObserver = new MutationObserver(() => {
        if (!panel.classList.contains('rp-world-results-entry')) return;
        loadResultMetadata();
      });
      feedObserver.observe(feed, { childList: true });
    }

    rebuildContextOptions();
    return true;
  }

  function competitionInfo(update, card) {
    const metadata = update?.metadata || {};
    const context = String(
      metadata.competitionContext ?? metadata.competition_context ?? metadata.mode ?? ''
    ).trim().toLowerCase();
    const west = String(metadata.westTeamName ?? metadata.west_team_name ?? '').trim().toUpperCase();
    const east = String(metadata.eastTeamName ?? metadata.east_team_name ?? '').trim().toUpperCase();
    const hasClub = Boolean(WORLD_CLUB_ART[west] || WORLD_CLUB_ART[east]);
    const isEastWest = west === 'WEST' && east === 'EAST';
    const title = String(
      metadata.resultDisplayTitle ?? metadata.result_display_title
      ?? metadata.sessionTitle ?? metadata.session_title ?? update?.title ?? ''
    ).toLowerCase();
    const seasonGame = Number(metadata.seasonGameNumber ?? metadata.season_game_number);
    const openRank = Number(metadata.openRankNumber ?? metadata.open_rank_number);

    // Permanent clubs and temporary East/West sides are distinct competition
    // identities. The legacy openRankNumber can exist on both types of games.
    if (isEastWest) return { key: 'open-rank', label: 'OPEN RANKING' };
    if (/tune[\s_-]?up/.test(context) || /tune[\s_-]?up/.test(title)) {
      return { key: 'tune-up', label: 'TUNE UP' };
    }
    if (/^league$/.test(context) || /\bleague\b/.test(title)) {
      return { key: 'league', label: 'LEAGUE' };
    }
    if (hasClub) return { key: 'tune-up', label: 'TUNE UP' };
    if (/open[\s_-]?rank(?:ing)?/.test(context) || /open[\s_-]?rank(?:ing)?/.test(title)) {
      return { key: 'open-rank', label: 'OPEN RANKING' };
    }
    if (Number.isSafeInteger(seasonGame) && seasonGame > 0) {
      return { key: 'tune-up', label: 'TUNE UP' };
    }
    if (Number.isSafeInteger(openRank) && openRank > 0) {
      return { key: 'open-rank', label: 'OPEN RANKING' };
    }
    return { key: 'open-rank', label: 'OPEN RANKING' };
  }

  function seasonInfo(update, card) {
    const metadata = update?.metadata || {};
    const competition = competitionInfo(update, card);
    if (competition.key === 'open-rank') return { key: 'all-games', label: 'ALL GAMES' };
    if (competition.key === 'tune-up') {
      const raw = Number(metadata.tuneUpSeasonNumber ?? metadata.tune_up_season_number
        ?? metadata.seasonNumber ?? metadata.season_number);
      const label = String(metadata.seasonLabel ?? metadata.season_label
        ?? metadata.seasonName ?? metadata.season_name ?? '').toUpperCase();
      const match = label.match(/(?:SEASON|S)\s*#?\s*(\d+)/);
      const number = Number.isSafeInteger(raw) && raw > 0 ? raw : Number(match?.[1] || 1);
      return { key: `tune-up-s${number}`, label: `SEASON ${number}` };
    }

    const explicit = String(
      metadata.seasonLabel
      ?? metadata.season_label
      ?? metadata.seasonName
      ?? metadata.season_name
      ?? metadata.leagueSeasonName
      ?? metadata.league_season_name
      ?? ''
    ).trim();
    const title = String(worldResultTitle(metadata) || '');
    const text = [explicit, title, update?.title, update?.body, card?.textContent]
      .filter(Boolean).join(' ').toUpperCase();

    const tuneNumber = Number(
      metadata.tuneUpSeasonNumber
      ?? metadata.tune_up_season_number
      ?? metadata.seasonNumber
      ?? metadata.season_number
    );
    const tuneMatch = text.match(/TUNE[\s-]*UP(?:\s*S(?:EASON)?\s*)?(\d+)?/i);
    if (tuneMatch) {
      const number = Number.isSafeInteger(tuneNumber) && tuneNumber > 0
        ? tuneNumber
        : Math.max(1, Number(tuneMatch[1] || 1));
      return { key: `tune-up-s${number}`, label: `SEASON ${number}` };
    }

    if (/\bBETA\b/.test(text)) return { key: 'beta-season', label: 'BETA SEASON' };

    const seasonMatch = text.match(/\bSEASON\s*#?\s*(\d+)\b/i);
    if (seasonMatch) {
      return { key: `season-${seasonMatch[1]}`, label: `SEASON ${seasonMatch[1]}` };
    }

    if (explicit) {
      const label = explicit.toUpperCase();
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'season';
      return { key, label };
    }

    return { key: 'season', label: 'SEASON' };
  }

  // Resolve a game's actual played date in Philippine local time. Only
  // fall back to publication time for legacy records missing game dates.
  function gameDateKey(update = {}) {
    const m = update?.metadata || {};
    const value = m.gameDate ?? m.game_date ?? m.playedAt ?? m.played_at
      ?? m.gameAt ?? m.game_at ?? m.sessionDate ?? m.session_date
      ?? m.sessionAt ?? m.session_at ?? m.eventAt ?? m.event_at
      ?? update?.event_at ?? update?.eventAt
      ?? update?.published_at ?? update?.publishedAt;
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '';
    const local = new Date(parsed + MANILA_OFFSET_MS);
    return local.toISOString().slice(0, 10);
  }

  function manilaTodayKey() {
    return new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
  }

  function matchesDateRange(update) {
    if (selectedDateRange === 'all') return true;
    const key = gameDateKey(update);
    if (!key) return false;
    if (selectedDateRange === 'custom') {
      if (!customDateFrom || !customDateTo || customDateFrom > customDateTo) return false;
      return key >= customDateFrom && key <= customDateTo;
    }
    const days = Number(selectedDateRange);
    if (![7, 30, 90].includes(days)) return true;
    const today = manilaTodayKey();
    const lower = new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 86400000)
      .toISOString().slice(0, 10);
    return key >= lower && key <= today;
  }

  function resultTeams(update = {}) {
    const metadata = update?.metadata || {};
    return [
      metadata.westTeamName ?? metadata.west_team_name,
      metadata.eastTeamName ?? metadata.east_team_name,
    ]
      .map((name) => String(name || '').trim().toUpperCase())
      .filter(Boolean);
  }

  function rebuildContextOptions() {
    const panel = updatesPanel();
    const competitionSelect = panel?.querySelector('[data-rp-world-competition]');
    const seasonSelect = panel?.querySelector('[data-rp-world-season]');
    const teamFilter = panel?.querySelector('[data-rp-world-team-filter]');
    if (!panel || !competitionSelect || !seasonSelect || !teamFilter) return;

    const cards = [...panel.querySelectorAll('[data-updates-feed] .rp-update-result[data-update-id]')];
    const rows = cards.map((card) => {
      const update = resultMetadata.get(String(card.dataset.updateId || ''));
      return {
        card,
        update,
        competition: competitionInfo(update, card),
        season: seasonInfo(update, card),
        teams: resultTeams(update),
      };
    });

    // Show all three categories even if one has no published results yet.
    const competitions = new Map([
      ['open-rank', 'OPEN RANKING'],
      ['tune-up', 'TUNE UP'],
      ['league', 'LEAGUE'],
    ]);
    if (!competitions.has(selectedCompetition)) selectedCompetition = 'tune-up';
    competitionSelect.innerHTML = [...competitions]
      .map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`)
      .join('');
    competitionSelect.value = selectedCompetition;

    const scoped = rows.filter((row) => row.competition.key === selectedCompetition);
    const seasons = new Map();
    scoped.forEach((row) => seasons.set(row.season.key, row.season.label));
    const customPanel = panel.querySelector('[data-rp-world-date-custom]');
    if (customPanel) {
      customPanel.hidden = selectedCompetition !== 'open-rank' || selectedDateRange !== 'custom';
      const from = customPanel.querySelector('[data-rp-world-date-from]');
      const to = customPanel.querySelector('[data-rp-world-date-to]');
      if (from && from.value !== customDateFrom) from.value = customDateFrom;
      if (to && to.value !== customDateTo) to.value = customDateTo;
    }
    if (selectedCompetition === 'open-rank') {
      const dateOptions = [
        ['all', 'ALL TIME'],
        ['7', 'LAST 7 DAYS'],
        ['30', 'LAST 30 DAYS'],
        ['90', 'LAST 90 DAYS'],
        ['custom', 'CUSTOM RANGE'],
      ];
      seasonSelect.setAttribute('aria-label', 'Game date range');
      seasonSelect.innerHTML = dateOptions
        .map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
      seasonSelect.value = selectedDateRange;
      selectedSeason = 'all-games';
      selectedTeam = 'all';
      teamFilter.hidden = true;
      teamFilter.replaceChildren();
      return;
    }
    seasonSelect.setAttribute('aria-label', 'Season');
    // Only offer real recorded seasons. An empty category shows an
    // explanatory option instead of fabricating a League season.
    if (!seasons.size) {
      seasons.set(selectedCompetition === 'open-rank' ? 'all-games' : 'no-season',
        selectedCompetition === 'open-rank' ? 'ALL GAMES' : 'NO SEASON YET');
    }
    if (!selectedSeason || !seasons.has(selectedSeason)) {
      selectedSeason = seasons.has('tune-up-s1') ? 'tune-up-s1' : [...seasons.keys()][0];
    }
    seasonSelect.innerHTML = [...seasons]
      .map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`)
      .join('');
    seasonSelect.value = selectedSeason;

    // Open Ranking uses temporary East/West sides, not permanent club filters.
    // Hide the entire row and clear any previous club selection.
    teamFilter.hidden = selectedCompetition === 'open-rank';
    if (teamFilter.hidden) {
      selectedTeam = 'all';
      teamFilter.replaceChildren();
      return;
    }

    const teams = new Set(CURRENT_WORLD_TEAMS);
    scoped
      .filter((row) => row.season.key === selectedSeason)
      .forEach((row) => row.teams.forEach((team) => teams.add(team)));
    if (selectedTeam !== 'all' && !teams.has(selectedTeam)) selectedTeam = 'all';

    teamFilter.innerHTML = [
      `<button type="button" class="rp-world-team-chip${selectedTeam === 'all' ? ' active' : ''}" data-rp-world-team="all">ALL</button>`,
      ...[...teams].sort().map((team) =>
        `<button type="button" class="rp-world-team-chip${selectedTeam === team ? ' active' : ''}" data-rp-world-team="${esc(team)}">${esc(team)}</button>`
      ),
    ].join('');

    const activeChip = teamFilter.querySelector('.rp-world-team-chip.active');
    if (activeChip && selectedTeam !== 'all') {
      activeChip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function rebuildWeekOptions() {
    const select = document.querySelector('[data-rp-world-results-week]');
    if (!select) return;

    const keys = new Set();
    document.querySelectorAll('[data-rp-updates] .rp-update-result[data-update-id]').forEach((card) => {
      const update = resultMetadata.get(String(card.dataset.updateId || ''));
      const key = manilaWeekStart(update?.published_at || update?.publishedAt);
      if (key) keys.add(key);
    });

    const sorted = [...keys].sort().reverse();
    const previous = selectedWeek;
    select.innerHTML = '<option value="all">ALL WEEKS</option>'
      + sorted.map((key) => `<option value="${key}">${weekLabel(key)}</option>`).join('');

    if (previous !== 'all' && keys.has(previous)) {
      select.value = previous;
    } else {
      selectedWeek = 'all';
      select.value = 'all';
    }
  }

  function applyWorldFilters() {
    const panel = updatesPanel();
    if (!panel?.classList.contains('rp-world-results-entry')) return;
    if (!ensureWorldControls()) return;

    setWorldResultsMode(true);
    decorateStoryCards();
    rebuildContextOptions();

    const allCards = [...panel.querySelectorAll('[data-updates-feed] .rp-update-card')];
    const resultCards = allCards.filter((card) => card.classList.contains('rp-update-result'));

    allCards
      .filter((card) => !card.classList.contains('rp-update-result'))
      .forEach((card) => { card.hidden = true; });

    let visibleCount = 0;
    resultCards.forEach((card) => {
      const update = resultMetadata.get(String(card.dataset.updateId || ''));
      const competition = competitionInfo(update, card).key;
      const season = seasonInfo(update, card).key;
      const teams = resultTeams(update);
      // Open Ranking is an East/West game history, not a season-based club
      // competition: 'ALL GAMES' must always show every Open Ranking result.
      const visible = competition === selectedCompetition
        && (selectedCompetition !== 'open-rank' || matchesDateRange(update))
        && (selectedCompetition === 'open-rank' || season === selectedSeason)
        && (selectedCompetition === 'open-rank' || selectedTeam === 'all' || teams.includes(selectedTeam));

      card.hidden = !visible;
      if (visible) visibleCount += 1;

      const label = card.querySelector('.rp-update-kind strong');
      if (label?.dataset.rpWorldDefaultLabel) {
        label.textContent = 'GAME REPORT';
      }
    });

    const empty = panel.querySelector('[data-rp-world-results-empty]');
    const state = window.RealPlayUpdates?.progressiveState?.();
    const validCustomRange = selectedDateRange !== 'custom'
      || Boolean(customDateFrom && customDateTo && customDateFrom <= customDateTo);
    const isOpenRankDateSearch = selectedCompetition === 'open-rank' && validCustomRange;
    // Server pages contain a mixture of Open Ranking and club results. Fill
    // the initial visible page with three matching games, not merely one.
    // For bounded ranges, continue through all pages so older matching
    // records aren't incorrectly excluded by the server's pagination.
    const searchingRange = isOpenRankDateSearch && selectedDateRange !== 'all';
    const needsAnotherPage = Boolean(state?.hasMore && state.category === 'result'
      && categoryAutoFetchCount < 120
      && (visibleCount < 3 || searchingRange));

    // Results are server-paginated before the client-side competition filter.
    // If the first page belongs to a different competition, keep loading
    // until a matching game is present or the available results are exhausted.
    // Do not declare the category empty while later result pages are pending.
    if (empty) {
      empty.textContent = selectedCompetition === 'open-rank' && selectedDateRange === 'custom'
        && (!customDateFrom || !customDateTo || customDateFrom > customDateTo)
        ? 'SELECT A VALID START AND END DATE.'
        : needsAnotherPage
          ? 'LOOKING FOR GAMES IN THIS DATE RANGE...'
          : 'NO OFFICIAL GAMES MATCH THESE FILTERS YET.';
      empty.classList.toggle('show', visibleCount === 0);
    }
    if (needsAnotherPage) {
      const offset = state.nextOffset;
      if (offset !== null && offset !== lastCategoryAutoFetchOffset) {
        lastCategoryAutoFetchOffset = offset;
        categoryAutoFetchCount += 1;
        window.setTimeout(() => {
          if (!panel.isConnected || !panel.classList.contains('rp-world-results-entry')) return;
          const current = window.RealPlayUpdates?.progressiveState?.();
          if (current?.hasMore && current.category === 'result') {
            window.RealPlayUpdates?.loadMore?.();
          }
        }, 120);
      }
    }
  }

  function openAuthoritativeResults() {
    // Core navigation owns the loading shell. This feature only prepares the
    // real WORLD page and announces when that page is actually paint-ready.
    removeLegacyWorldResults();
    injectWorldResultsStyles();

    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    markWorldActive();

    if (window.RealPlayUpdates?.open) {
      loadWorldView('feed', { initial: true });
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent('realplay:world-load-error', {
        detail: { message: 'WORLD could not initialize its official feed.' },
      }));
    } catch (_error) {}
  }

  // Primary navigation belongs exclusively to simple-navigation.js. WORLD is a
  // feature implementation, not a second router, so it must never intercept
  // bottom-nav clicks or replace the core route authority.
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-rp-home-command-card], [data-rp-simple-updates], [data-rp-simple-next]')) {
      setWorldResultsMode(false);
    }
  });

  injectWorldResultsStyles();
  removeLegacyWorldResults();

  window.RealPlayWorldResults = {
    open: openAuthoritativeResults,
    openResults: () => loadWorldView('results', { initial: false }),
    openFeed: () => loadWorldView('feed', { initial: false }),
    refresh() {
      const result = window.RealPlayUpdates?.refresh?.({ quiet: true });
      window.setTimeout(() => {
        loadResultMetadata();
        decorateStoryCards();
        applyWorldFilters();
      }, 0);
      return result;
    },
  };
})();
