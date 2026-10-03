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
  let selectedView = 'feed';
  let feedObserver = null;
  let metadataLoading = false;

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
        margin:15px auto 0;
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
      @media(max-width:360px){
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

  function setWorldView(view) {
    selectedView = view === 'results' ? 'results' : 'feed';
    setWorldResultsMode(true);
    const panel = updatesPanel();
    panel?.querySelectorAll('[data-rp-world-tab]').forEach((button) => {
      const active = button.dataset.rpWorldTab === selectedView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    chooseUpdatesFilter(selectedView === 'results' ? 'result' : 'all');
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

  async function loadResultMetadata() {
    if (metadataLoading) return;
    metadataLoading = true;
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const next = new Map();
      (Array.isArray(data?.updates) ? data.updates : [])
        .filter((item) => item?.category === 'result')
        .forEach((item) => next.set(String(item.id), item));
      resultMetadata = next;
      rebuildWeekOptions();
      decorateStoryCards();
      applyWorldFilters();
    } catch (_error) {
      // The official cards remain usable even if filter metadata cannot refresh.
    } finally {
      metadataLoading = false;
    }
  }


  function fallbackStory(update) {
    const metadata = update?.metadata || {};
    const west = Number(metadata.westScore);
    const east = Number(metadata.eastScore);
    if (!Number.isFinite(west) || !Number.isFinite(east)) return null;

    const tie = west === east;
    const winner = tie ? '' : (west > east ? 'WEST' : 'EAST');
    const loser = tie ? '' : (west > east ? 'EAST' : 'WEST');
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
      ? `WEST AND EAST FINISH LEVEL, ${score}`
      : margin <= 2
        ? `${winner} HOLDS OFF ${loser}, ${score}`
        : `${winner} DEFEATS ${loser}, ${score}`;

    if (!tie && mvpName && String(mvp.team || '').toUpperCase() === winner && Number(mvp.points || 0) >= Math.ceil(winnerScore / 2)) {
      headline = `${mvpName} LEADS ${winner} PAST ${loser}, ${score}`;
    }

    const summary = mvpName
      ? `${mvpName} earned Game MVP${statParts.length ? ` with ${statParts.join(' · ')}` : ''} in the official ${score} result.`
      : tie
        ? `West and East finished level at ${score} in an official Real Play game.`
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

  function decorateStoryCard(card) {
    if (!card) return;
    const update = resultMetadata.get(String(card.dataset.updateId || ''));
    const story = storyForUpdate(update);
    if (!story) return;

    let block = card.querySelector('[data-rp-world-story]');
    if (!block) {
      block = document.createElement('section');
      block.className = 'rp-world-story-block';
      block.dataset.rpWorldStory = 'true';
      card.appendChild(block);
    }

    block.innerHTML = `
      <small class="rp-world-story-kicker">${esc(story.kind || 'GAME REPORT')} · VERIFIED DATA</small>
      <h3>${esc(story.headline || 'OFFICIAL GAME REPORT')}</h3>
      ${story.summary ? `<p>${esc(story.summary)}</p>` : ''}
      ${story.statLine ? `<div class="rp-world-story-statline">${esc(story.statLine)}</div>` : ''}
      <span class="rp-world-story-cta">VIEW GAME + STATS →</span>`;

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
        <h1>WORLD</h1>
        <small>REAL PLAY BASKETBALL</small>
        <nav class="rp-world-tabs" role="tablist" aria-label="World views">
          <button type="button" class="rp-world-tab active" data-rp-world-tab="feed" role="tab" aria-selected="true">FEED</button>
          <button type="button" class="rp-world-tab" data-rp-world-tab="results" role="tab" aria-selected="false">RESULTS</button>
        </nav>
        <div class="rp-world-feed-intro">
          <strong>LATEST FROM REAL PLAY</strong>
          <span>STORIES FROM VERIFIED DATA</span>
        </div>
        <div class="rp-world-results-only">
          <div class="rp-world-results-subhead">
            <strong>GAME RESULTS</strong>
            <span data-rp-world-results-count>OFFICIAL GAMES</span>
          </div>
          <div class="rp-world-results-filter-row">
            <div class="rp-world-results-filter">
              <label for="rp-world-results-week">WEEK</label>
              <select id="rp-world-results-week" data-rp-world-results-week>
                <option value="all">ALL WEEKS</option>
              </select>
            </div>
            <div class="rp-world-results-filter">
              <label for="rp-world-results-type">GAME TYPE</label>
              <select id="rp-world-results-type" data-rp-world-results-type>
                <option value="all">ALL GAMES</option>
                <option value="open-rank">OPEN RANK</option>
                <option value="3v3">3V3</option>
                <option value="5v5">5V5</option>
              </select>
            </div>
          </div>
        </div>`;
      feed.parentElement?.insertBefore(controls, feed);

      controls.querySelectorAll('[data-rp-world-tab]').forEach((button) => {
        button.addEventListener('click', () => setWorldView(button.dataset.rpWorldTab));
      });
      controls.querySelector('[data-rp-world-results-week]')?.addEventListener('change', (event) => {
        selectedWeek = event.currentTarget.value || 'all';
        applyWorldFilters();
      });
      controls.querySelector('[data-rp-world-results-type]')?.addEventListener('change', (event) => {
        selectedType = event.currentTarget.value || 'all';
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
        rebuildWeekOptions();
        decorateStoryCards();
        applyWorldFilters();
      });
      feedObserver.observe(feed, { childList: true });
    }

    rebuildWeekOptions();
    controls.querySelectorAll('[data-rp-world-tab]').forEach((button) => {
      const active = button.dataset.rpWorldTab === selectedView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    return true;
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

    const allCards = [...panel.querySelectorAll('[data-updates-feed] .rp-update-card')];
    const resultCards = allCards.filter((card) => card.classList.contains('rp-update-result'));

    resultCards.forEach((card) => {
      const label = card.querySelector('.rp-update-kind strong');
      if (label?.dataset.rpWorldDefaultLabel) {
        label.textContent = selectedView === 'feed'
          ? 'GAME REPORT'
          : label.dataset.rpWorldDefaultLabel;
      }
    });

    if (selectedView === 'feed') {
      allCards.forEach((card) => { card.hidden = false; });
      panel.querySelector('[data-rp-world-results-empty]')?.classList.remove('show');
      return;
    }

    let visibleCount = 0;
    resultCards.forEach((card) => {
      const update = resultMetadata.get(String(card.dataset.updateId || ''));
      const type = classifyGameType(update, card);
      const week = manilaWeekStart(update?.published_at || update?.publishedAt);
      const typeMatch = selectedType === 'all' || type === selectedType;
      const weekMatch = selectedWeek === 'all' || week === selectedWeek;
      const visible = typeMatch && weekMatch;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    const count = panel.querySelector('[data-rp-world-results-count]');
    if (count) count.textContent = `${visibleCount} GAME${visibleCount === 1 ? '' : 'S'}`;

    const empty = panel.querySelector('[data-rp-world-results-empty]');
    empty?.classList.toggle('show', resultCards.length > 0 && visibleCount === 0);
  }

  function openAuthoritativeResults() {
    removeLegacyWorldResults();
    injectWorldResultsStyles();

    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    markWorldActive();

    if (window.RealPlayUpdates?.open) {
      window.RealPlayUpdates.open();
      selectedView = 'feed';
      setWorldResultsMode(true);
      ensureWorldControls();
      loadResultMetadata();
      setWorldView('feed');
      window.setTimeout(applyWorldFilters, 0);
      return;
    }

    const legacyUpdates = document.querySelector('[data-rp-main-action="updates"]');
    if (legacyUpdates) {
      legacyUpdates.click();
      window.setTimeout(() => {
        legacyUpdates.click();
        selectedView = 'feed';
        setWorldResultsMode(true);
        ensureWorldControls();
        loadResultMetadata();
        setWorldView('feed');
      }, 0);
    }
  }

  function patchSimpleNavigationApi(attempt = 0) {
    if (window.RealPlaySimpleNavigation) {
      window.RealPlaySimpleNavigation.world = openAuthoritativeResults;
      return;
    }
    if (attempt < 40) window.setTimeout(() => patchSimpleNavigationApi(attempt + 1), 100);
  }

  document.addEventListener('click', (event) => {
    const worldButton = event.target.closest?.('[data-rp-simple-nav-item="world"]');
    if (worldButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAuthoritativeResults();
      return;
    }

    const otherNav = event.target.closest?.('[data-rp-simple-nav-item]');
    if (otherNav && otherNav.dataset.rpSimpleNavItem !== 'world') {
      setWorldResultsMode(false);
      return;
    }

    if (event.target.closest?.('[data-rp-home-command-card], [data-rp-simple-updates], [data-rp-simple-next]')) {
      setWorldResultsMode(false);
    }
  }, true);

  injectWorldResultsStyles();
  removeLegacyWorldResults();
  patchSimpleNavigationApi();

  window.RealPlayWorldResults = {
    open: openAuthoritativeResults,
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
