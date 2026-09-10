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
  let feedObserver = null;
  let metadataLoading = false;

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
    updatesPanel()?.classList.toggle('rp-world-results-entry', Boolean(enabled));
  }

  function chooseResultsFilter(attempt = 0) {
    const resultFilter = document.querySelector('[data-rp-updates] [data-update-filter="result"]');
    if (resultFilter) {
      resultFilter.click();
      ensureWorldControls();
      applyWorldFilters();
      return;
    }
    if (attempt < 12) window.setTimeout(() => chooseResultsFilter(attempt + 1), 50);
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
      applyWorldFilters();
    } catch (_error) {
      // The official cards remain usable even if filter metadata cannot refresh.
    } finally {
      metadataLoading = false;
    }
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
        <h1>GAME RESULTS</h1>
        <small data-rp-world-results-count>OFFICIAL GAMES</small>
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
        </div>`;
      feed.parentElement?.insertBefore(controls, feed);

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
        applyWorldFilters();
      });
      feedObserver.observe(feed, { childList: true });
    }

    rebuildWeekOptions();
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

    const cards = [...panel.querySelectorAll('[data-updates-feed] .rp-update-result[data-update-id]')];
    let visibleCount = 0;

    cards.forEach((card) => {
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
    empty?.classList.toggle('show', cards.length > 0 && visibleCount === 0);
  }

  function openAuthoritativeResults() {
    removeLegacyWorldResults();
    injectWorldResultsStyles();

    try { window.RealPlayWorld?.close?.(); } catch (_error) {}
    try { window.RealPlayProfile?.close?.(); } catch (_error) {}

    markWorldActive();

    if (window.RealPlayUpdates?.open) {
      window.RealPlayUpdates.open();
      setWorldResultsMode(true);
      chooseResultsFilter();
      ensureWorldControls();
      loadResultMetadata();
      window.setTimeout(applyWorldFilters, 0);
      return;
    }

    const legacyUpdates = document.querySelector('[data-rp-main-action="updates"]');
    if (legacyUpdates) {
      legacyUpdates.click();
      window.setTimeout(() => {
        legacyUpdates.click();
        setWorldResultsMode(true);
        chooseResultsFilter();
        ensureWorldControls();
        loadResultMetadata();
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
        applyWorldFilters();
      }, 0);
      return result;
    },
  };
})();
