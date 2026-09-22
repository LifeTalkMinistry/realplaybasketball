(() => {
  if (window.__realPlaySimpleNavigationStateAuthorityInstalled) return;
  window.__realPlaySimpleNavigationStateAuthorityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const CURRENT_RANKING_ACCESS_URL = `${API_BASE_URL}/api/real-play/career/access`;
  const HOME_REFRESH_MIN_MS = 15_000;
  const HOME_RATE_LIMIT_BACKOFF_MS = 60_000;
  let enforcing = false;
  let enforceQueued = false;
  let homeRefreshTimer = 0;
  let homeLoading = false;
  let lastHomeRefreshAt = 0;
  let homeRefreshBlockedUntil = 0;
  let configuredHomeCapacity = 16;
  let availabilityRequestId = 0;
  let hasOpenRankAvailability = false;
  const observedAuthorityTargets = new WeakSet();

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function activeRoute() {
    const selected = document.querySelector('[data-rp-simple-nav-item][aria-current="page"]')
      || document.querySelector('[data-rp-simple-nav-item].active');
    return String(selected?.dataset?.rpSimpleNavItem || '');
  }

  function setClassState(node, className, enabled) {
    if (!node) return;
    if (node.classList.contains(className) === enabled) return;
    node.classList.toggle(className, enabled);
  }

  function setHiddenState(node, hidden) {
    if (!node || node.hidden === hidden) return;
    node.hidden = hidden;
  }

  function enforcePlayersView() {
    if (activeRoute() !== 'players') return;

    const panel = document.querySelector('[data-rp-world]');
    const playersView = panel?.querySelector('[data-world-view="players"]');
    if (!panel || !playersView) return;

    const title = panel.querySelector('.rp-world-title strong');
    if (title && title.textContent !== 'PLAYERS') title.textContent = 'PLAYERS';

    const badge = panel.querySelector('.rp-world-online');
    if (badge && badge.textContent !== 'COMMUNITY') badge.textContent = 'COMMUNITY';

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      setClassState(button, 'active', button.dataset.worldTab === 'players');
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      setHiddenState(view, view.dataset.worldView !== 'players');
    });
  }

  function enforceChatsView() {
    if (activeRoute() !== 'chats') return;

    const panel = document.querySelector('[data-rp-world]');
    const chatsView = panel?.querySelector('[data-world-view="chats"]');
    if (!panel || !chatsView) return;

    const title = panel.querySelector('.rp-world-title strong');
    if (title && title.textContent !== 'CHATS') title.textContent = 'CHATS';

    const badge = panel.querySelector('.rp-world-online');
    const expectedBadge = localStorage.getItem(TOKEN_KEY) ? 'COMMUNITY' : 'READ ONLY';
    if (badge && badge.textContent !== expectedBadge) badge.textContent = expectedBadge;

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      setClassState(button, 'active', button.dataset.worldTab === 'chats');
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      setHiddenState(view, view.dataset.worldView !== 'chats');
    });
  }

  function formatEvent(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function scheduleType(update) {
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
    ].filter(Boolean).join(' ').toLowerCase();

    /* Competition context wins over player format. A 3v3 Open Ranking game is
       still Open Ranking on Home. */
    if (/\bopen[\s-]?rank(?:ing)?\b|\branking session\b|\bcareer session\b|\beast vs west\b/.test(text)) return 'open-rank';
    if (/\b5\s*v\s*5\b|\b5-on-5\b|\bfive v five\b|\bfull court\b/.test(text)) return '5v5';
    if (/\b3\s*v\s*3\b|\b3-on-3\b|\bthree v three\b|\bfounding four\b|\brace to 8\b/.test(text)) return '3v3';
    return '';
  }

  function isHomeScheduleOverride(update) {
    if (!update || update.category !== 'schedule') return false;
    if (update.source_key || update.sourceKey) return false;
    if (scheduleType(update) !== 'open-rank') return false;
    return /\bPLAYER\s+CAP\b/i.test(String(update.body || ''));
  }

  function homeRoot() {
    return document.querySelector('[data-rp-simple-home]');
  }

  function openOfficialFeed() {
    window.RealPlayUpdates?.open?.();
  }

  function openSundayRanking() {
    if (window.RealPlayRankingGames?.open) {
      window.RealPlayRankingGames.open();
      return;
    }

    if (!localStorage.getItem(TOKEN_KEY)) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }

    openOfficialFeed();
  }

  function setComingOpen(open) {
    const backdrop = homeRoot()?.querySelector('[data-rp-home-coming-backdrop]');
    if (!backdrop) return;
    backdrop.hidden = !open;
    document.body.classList.toggle('rp-home-coming-open', open);
    if (open) {
      window.setTimeout(() => backdrop.querySelector('[data-rp-home-coming-close]')?.focus({ preventScroll: true }), 0);
    }
  }

  function installHomeCommandCenter() {
    const root = homeRoot();
    if (!root) return false;
    if (root.dataset.rpHomeCommandCenter === 'true') return true;

    root.dataset.rpHomeCommandCenter = 'true';
    root.classList.add('rp-home-command-center');
    root.innerHTML = `
      <header class="rp-simple-home-head">
        <div><small>REAL PLAY BASKETBALL</small><h1>HOME</h1></div>
        <span data-rp-simple-access>${localStorage.getItem(TOKEN_KEY) ? 'PLAYER' : 'PUBLIC'}</span>
      </header>

      <section class="rp-simple-next rp-home-main-announcement" data-rp-home-main-announcement>
        <small>MAIN ANNOUNCEMENT</small>
        <h2>NO MAIN ANNOUNCEMENT.</h2>
        <p>Important Real Play updates will appear here.</p>
      </section>

      <section data-rp-home-open-rank aria-label="Current Sunday Open Ranking session">
        <div class="rp-home-session-copy">
          <strong data-rp-home-open-rank-title>SUNDAY OPEN RANKING</strong>
          <p data-rp-home-open-rank-meta>EVERY SUNDAY · 8:00 PM – 11:00 PM</p>
          <span class="rp-home-spots-left" data-rp-home-open-rank-capacity>16 PLAYER CAP</span>
        </div>
        <button class="rp-home-save-slot" type="button" data-rp-home-save-slot>SAVE MY SLOT</button>
      </section>

      <button class="rp-home-whats-coming" type="button" data-rp-home-whats-coming>
        WHAT'S COMING <span aria-hidden="true">→</span>
      </button>

      <div class="rp-home-coming-backdrop" data-rp-home-coming-backdrop hidden>
        <section class="rp-home-coming-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-home-coming-title">
          <header class="rp-home-coming-head">
            <div><small>REAL PLAY ROADMAP</small><strong id="rp-home-coming-title">WHAT'S COMING</strong></div>
            <button class="rp-home-coming-close" type="button" data-rp-home-coming-close aria-label="Close What's Coming">×</button>
          </header>
          <div class="rp-home-coming-list">
            <article class="rp-home-coming-card is-3v3">
              <small>FUTURE COMPETITION</small>
              <strong>3V3 LEAGUE</strong>
              <p>Organized team competition will move here when Real Play is ready to activate it.</p>
            </article>
            <article class="rp-home-coming-card is-5v5">
              <small>FUTURE COMPETITION</small>
              <strong>5V5 LEAGUE</strong>
              <p>Full-court league play stays visible as part of the roadmap, not as a current promise.</p>
            </article>
            <article class="rp-home-coming-card">
              <small>FUTURE EXPANSION</small>
              <strong>MORE OPEN RANKING SCHEDULES</strong>
              <p>New recurring groups appear only after real player demand is strong enough to support them.</p>
            </article>
          </div>
        </section>
      </div>

      <div class="rp-home-brand-lockup" aria-label="Real Play Basketball — Less Screen. Real Points.">
        <strong>REAL PLAY</strong>
        <span>BASKETBALL</span>
        <small>LESS SCREEN. REAL POINTS.</small>
      </div>`;

    root.querySelector('[data-rp-home-main-announcement]')?.addEventListener('click', openOfficialFeed);
    root.querySelector('[data-rp-home-save-slot]')?.addEventListener('click', openSundayRanking);
    root.querySelector('[data-rp-home-whats-coming]')?.addEventListener('click', () => setComingOpen(true));
    root.querySelector('[data-rp-home-coming-close]')?.addEventListener('click', () => setComingOpen(false));
    root.querySelector('[data-rp-home-coming-backdrop]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) setComingOpen(false);
    });

    refreshHomeCommandCenter();
    return true;
  }

  function renderAnnouncement(update) {
    const node = homeRoot()?.querySelector('[data-rp-home-main-announcement]');
    if (!node) return;
    node.innerHTML = update
      ? `<small>MAIN ANNOUNCEMENT${update.pinned ? ' · PINNED' : ''}</small><h2>${esc(update.title || 'REAL PLAY UPDATE')}</h2><p>${esc(update.body || 'Open the official feed for the full announcement.')}</p>`
      : '<small>MAIN ANNOUNCEMENT</small><h2>NO MAIN ANNOUNCEMENT.</h2><p>Important Real Play updates will appear here.</p>';
  }

  function parseOpenRankCapacity(update) {
    const metadata = update?.metadata || {};
    const directCap = Number(metadata.capacity ?? update?.capacity);
    if (Number.isFinite(directCap) && directCap > 0) return Math.round(directCap);
    const bodyCap = Number(String(update?.body || '').match(/\b(\d{1,3})\s+PLAYER\s+CAP\b/i)?.[1]);
    return Number.isFinite(bodyCap) && bodyCap > 0 ? Math.round(bodyCap) : 16;
  }

  function renderConfiguredOpenRankCapacity({ force = false } = {}) {
    const node = homeRoot()?.querySelector('[data-rp-home-open-rank-capacity]');
    if (!node || (!force && hasOpenRankAvailability)) return;
    const nextText = `${configuredHomeCapacity} PLAYER CAP`;
    if (node.textContent !== nextText) node.textContent = nextText;
  }

  function count(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  function renderOpenRankAvailability(state) {
    const node = homeRoot()?.querySelector('[data-rp-home-open-rank-capacity]');
    if (!node || !state || typeof state !== 'object') return false;

    const session = state?.session;
    const counts = state?.counts || {};
    if (!session || typeof session !== 'object') return false;

    const capacityRaw = Number(session.capacity);
    const capacity = Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.trunc(capacityRaw) : 0;
    if (!capacity) return false;

    const secured = count(counts.secured);
    const standby = count(counts.standby);
    const mainStandby = Math.min(standby, Math.max(capacity - secured, 0));
    const filled = Math.min(capacity, secured + mainStandby);
    const spotsLeft = Math.max(0, capacity - filled);
    const nextText = `${spotsLeft} ${spotsLeft === 1 ? 'SPOT' : 'SPOTS'} LEFT`;

    hasOpenRankAvailability = true;
    if (node.textContent !== nextText) node.textContent = nextText;
    return true;
  }

  async function refreshOpenRankAvailability() {
    const requestId = ++availabilityRequestId;
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    const node = homeRoot()?.querySelector('[data-rp-home-open-rank-capacity]');
    if (!node) return;
    if (!auth) {
      hasOpenRankAvailability = false;
      renderConfiguredOpenRankCapacity({ force: true });
      return;
    }

    try {
      const response = await fetch(CURRENT_RANKING_ACCESS_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        cache: 'no-store',
      });
      if (requestId !== availabilityRequestId) return;
      if (!response.ok) throw new Error(`Could not load current Ranking access (${response.status}).`);

      const data = await response.json().catch(() => ({}));
      if (requestId !== availabilityRequestId) return;
      if (!renderOpenRankAvailability(data)) {
        hasOpenRankAvailability = false;
        renderConfiguredOpenRankCapacity({ force: true });
      }
    } catch (_error) {
      if (requestId === availabilityRequestId && !hasOpenRankAvailability) {
        renderConfiguredOpenRankCapacity({ force: true });
      }
    }
  }

  function renderOpenRank(update) {
    const root = homeRoot();
    if (!root) return;

    const title = root.querySelector('[data-rp-home-open-rank-title]');
    const meta = root.querySelector('[data-rp-home-open-rank-meta]');

    if (!update) {
      configuredHomeCapacity = 16;
      if (title) title.textContent = 'SUNDAY OPEN RANKING';
      if (meta) meta.textContent = 'EVERY SUNDAY · 8:00 PM – 11:00 PM';
      renderConfiguredOpenRankCapacity();
      return;
    }

    const when = formatEvent(update.event_at || update.eventAt);
    const location = String(update.location_name || update.locationName || '').trim();
    configuredHomeCapacity = parseOpenRankCapacity(update);

    if (title) title.textContent = String(update.title || 'SUNDAY OPEN RANKING').toUpperCase();
    if (meta) meta.textContent = [when, location].filter(Boolean).join(' · ') || 'SUNDAY · 8:00 PM – 11:00 PM';
    renderConfiguredOpenRankCapacity();
  }

  async function refreshHomeCommandCenter() {
    if (!installHomeCommandCenter() || homeLoading) return;

    const requestStartedAt = Date.now();
    if (requestStartedAt < homeRefreshBlockedUntil) return;
    if (lastHomeRefreshAt && requestStartedAt - lastHomeRefreshAt < HOME_REFRESH_MIN_MS) return;

    homeLoading = true;
    lastHomeRefreshAt = requestStartedAt;
    availabilityRequestId += 1;
    renderConfiguredOpenRankCapacity();

    const access = homeRoot()?.querySelector('[data-rp-simple-access]');
    if (access) access.textContent = localStorage.getItem(TOKEN_KEY) ? 'PLAYER' : 'PUBLIC';

    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('Retry-After'));
        const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : HOME_RATE_LIMIT_BACKOFF_MS;
        homeRefreshBlockedUntil = Date.now() + Math.max(HOME_RATE_LIMIT_BACKOFF_MS, retryAfterMs);
        throw new Error('Real Play Home refresh is rate limited.');
      }
      if (!response.ok) throw new Error('Could not load Real Play Home.');
      homeRefreshBlockedUntil = 0;

      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const announcement = updates.find((item) => item?.category === 'announcement' && item?.pinned)
        || updates.find((item) => item?.category === 'announcement')
        || null;

      const now = Date.now();
      const homeSchedules = updates
        .filter(isHomeScheduleOverride)
        .map((item) => ({
          item,
          time: Date.parse(item.event_at || item.eventAt || ''),
          published: Date.parse(item.published_at || item.publishedAt || '') || 0,
        }))
        .filter((entry) => Number.isFinite(entry.time) && entry.time >= now - 60_000)
        .sort((a, b) => b.published - a.published || a.time - b.time);

      renderAnnouncement(announcement);
      renderOpenRank(homeSchedules[0]?.item || null);
    } catch (_error) {
      renderOpenRank(null);
    } finally {
      homeLoading = false;
    }

    refreshOpenRankAvailability();
  }

  function enforce() {
    if (enforcing) return;
    enforcing = true;
    try {
      installHomeCommandCenter();
      enforcePlayersView();
      enforceChatsView();
    } finally {
      enforcing = false;
    }
  }

  function queueEnforce() {
    if (enforceQueued) return;
    enforceQueued = true;
    queueMicrotask(() => {
      enforceQueued = false;
      enforce();
      bindAuthorityTargets();
    });
  }

  const authorityObserver = new MutationObserver(() => queueEnforce());

  function bindAuthorityTargets() {
    document.querySelectorAll('[data-rp-simple-nav-item]').forEach((node) => {
      if (observedAuthorityTargets.has(node)) return;
      observedAuthorityTargets.add(node);
      authorityObserver.observe(node, { attributes: true, attributeFilter: ['class', 'aria-current'] });
    });

    document.querySelectorAll('[data-rp-world] [data-world-tab]').forEach((node) => {
      if (observedAuthorityTargets.has(node)) return;
      observedAuthorityTargets.add(node);
      authorityObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
    });

    document.querySelectorAll('[data-rp-world] [data-world-view]').forEach((node) => {
      if (observedAuthorityTargets.has(node)) return;
      observedAuthorityTargets.add(node);
      authorityObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /*
     Important performance boundary: do not observe the entire document.
     The Players directory sorts and decorates rows dynamically; a global
     subtree/attribute observer turned every row mutation into another route
     enforcement pass and could starve the main thread. Only the handful of
     navigation/view elements that this authority actually owns are observed.
  */
  bindAuthorityTargets();

  document.addEventListener('click', () => queueEnforce(), true);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setComingOpen(false);
  });
  window.addEventListener('focus', () => {
    bindAuthorityTargets();
    enforce();
    refreshHomeCommandCenter();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      bindAuthorityTargets();
      enforce();
      refreshHomeCommandCenter();
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === null) refreshHomeCommandCenter();
  });
  window.addEventListener('realplay:visitorchange', refreshHomeCommandCenter);
  window.addEventListener('realplay:home-schedule-changed', refreshHomeCommandCenter);
  window.addEventListener('realplay:ranking-session-changed', refreshOpenRankAvailability);
  window.addEventListener('realplay:ranking-entry-updated', refreshOpenRankAvailability);

  homeRefreshTimer = window.setInterval(() => {
    if (!document.hidden && activeRoute() === 'home') refreshHomeCommandCenter();
  }, 60_000);

  window.addEventListener('beforeunload', () => {
    if (homeRefreshTimer) window.clearInterval(homeRefreshTimer);
  });

  enforce();
  bindAuthorityTargets();
})();