(() => {
  if (window.__realPlaySimpleNavigationStateAuthorityInstalled) return;
  window.__realPlaySimpleNavigationStateAuthorityInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  let enforcing = false;
  let homeRefreshTimer = 0;
  let homeLoading = false;

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
      const shouldBeActive = button.dataset.worldTab === 'players';
      if (button.classList.contains('active') !== shouldBeActive) {
        button.classList.toggle('active', shouldBeActive);
      }
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      const shouldBeHidden = view.dataset.worldView !== 'players';
      if (view.hidden !== shouldBeHidden) view.hidden = shouldBeHidden;
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
      const shouldBeActive = button.dataset.worldTab === 'chats';
      if (button.classList.contains('active') !== shouldBeActive) {
        button.classList.toggle('active', shouldBeActive);
      }
    });

    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      const shouldBeHidden = view.dataset.worldView !== 'chats';
      if (view.hidden !== shouldBeHidden) view.hidden = shouldBeHidden;
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

    if (/\b5\s*v\s*5\b|\b5-on-5\b|\bfive v five\b|\bfull court\b/.test(text)) return '5v5';
    if (/\b3\s*v\s*3\b|\b3-on-3\b|\bthree v three\b|\bfounding four\b|\brace to 8\b/.test(text)) return '3v3';
    if (/\bopen[\s-]?rank(?:ing)?\b|\branking session\b|\bcareer session\b|\beast vs west\b/.test(text)) return 'open-rank';
    return '';
  }

  function injectHomeStyles() {
    if (document.getElementById('rp-home-command-center-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-home-command-center-style';
    style.textContent = `
      body.rp-simple-navigation-active .rp-simple-home.rp-home-command-center{
        gap:12px;
      }
      body.rp-simple-navigation-active .rp-home-main-announcement{
        min-height:142px;
        cursor:pointer;
      }
      body.rp-simple-navigation-active .rp-home-command-grid{
        display:grid;
        grid-template-columns:1fr;
        gap:10px;
      }
      body.rp-simple-navigation-active .rp-home-command-grid article{
        position:relative;
        min-height:108px;
        cursor:pointer;
        transition:border-color .16s ease,transform .16s ease,background .16s ease;
      }
      body.rp-simple-navigation-active .rp-home-command-grid article::after{
        content:'→';
        position:absolute;
        top:14px;
        right:15px;
        color:#45d8ff;
        font-size:.8rem;
        font-weight:950;
        opacity:.68;
      }
      body.rp-simple-navigation-active .rp-home-command-grid article:active,
      body.rp-simple-navigation-active .rp-home-main-announcement:active{
        transform:scale(.992);
      }
      body.rp-simple-navigation-active .rp-home-main-announcement h2,
      body.rp-simple-navigation-active .rp-home-command-grid article strong{
        padding-right:26px;
      }

      /* Home brand lockup: sits directly on the premium basketball, not in a card. */
      body.rp-simple-navigation-active .rp-home-brand-lockup{
        position:relative;
        z-index:4;
        min-height:158px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        padding:18px 10px 14px;
        text-align:center;
        pointer-events:none;
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup::before,
      body.rp-simple-navigation-active .rp-home-brand-lockup::after{
        content:'';
        position:absolute;
        top:50%;
        width:18%;
        height:1px;
        opacity:.75;
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup::before{
        left:5%;
        background:linear-gradient(90deg,transparent,rgba(55,211,255,.9));
        box-shadow:0 0 12px rgba(55,211,255,.38);
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup::after{
        right:5%;
        background:linear-gradient(90deg,rgba(255,55,70,.9),transparent);
        box-shadow:0 0 12px rgba(255,55,70,.32);
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup strong{
        display:block;
        margin:0;
        color:#f7fbff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:clamp(1.72rem,8vw,2.5rem);
        font-style:italic;
        font-weight:950;
        letter-spacing:.035em;
        line-height:.92;
        text-shadow:0 3px 18px rgba(0,0,0,.95),0 0 18px rgba(53,194,255,.13);
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup span{
        display:block;
        margin-top:7px;
        color:#eef5ff;
        font-size:clamp(.58rem,2.8vw,.82rem);
        font-weight:850;
        letter-spacing:.32em;
        line-height:1;
        text-shadow:0 2px 12px rgba(0,0,0,.95);
      }
      body.rp-simple-navigation-active .rp-home-brand-lockup small{
        display:block;
        margin-top:13px;
        color:#9fb3c9;
        font-size:clamp(.42rem,2vw,.56rem);
        font-style:italic;
        font-weight:800;
        letter-spacing:.22em;
        line-height:1.2;
        text-shadow:0 2px 10px rgba(0,0,0,.95);
      }

      @media(max-height:720px){
        body.rp-simple-navigation-active .rp-home-brand-lockup{
          min-height:132px;
          padding-top:10px;
        }
        body.rp-simple-navigation-active .rp-home-brand-lockup strong{
          font-size:clamp(1.45rem,7.2vw,2.15rem);
        }
      }

      @media(hover:hover){
        body.rp-simple-navigation-active .rp-home-command-grid article:hover,
        body.rp-simple-navigation-active .rp-home-main-announcement:hover{
          border-color:rgba(69,216,255,.28);
          background:linear-gradient(145deg,rgba(6,15,25,.98),rgba(2,6,12,.985));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function homeRoot() {
    return document.querySelector('[data-rp-simple-home]');
  }

  function openOfficialFeed() {
    window.RealPlayUpdates?.open?.();
  }

  function installHomeCommandCenter() {
    const root = homeRoot();
    if (!root) return false;
    if (root.dataset.rpHomeCommandCenter === 'true') return true;

    injectHomeStyles();
    root.dataset.rpHomeCommandCenter = 'true';
    root.classList.add('rp-home-command-center');
    root.innerHTML = `
      <header class="rp-simple-home-head">
        <div><small>REAL PLAY BASKETBALL</small><h1>HOME</h1></div>
        <span data-rp-simple-access>${localStorage.getItem(TOKEN_KEY) ? 'PLAYER' : 'PUBLIC'}</span>
      </header>
      <section class="rp-simple-next rp-home-main-announcement" data-rp-home-main-announcement data-rp-home-command-card>
        <small>MAIN ANNOUNCEMENT</small>
        <h2>NO MAIN ANNOUNCEMENT.</h2>
        <p>Important Real Play updates will appear here.</p>
      </section>
      <section class="rp-simple-home-grid rp-home-command-grid">
        <article data-rp-home-open-rank data-rp-home-command-card>
          <small>OPEN RANK SCHEDULE</small>
          <strong>TO BE ANNOUNCED.</strong>
          <p>The next Open Rank schedule will appear here.</p>
        </article>
        <article data-rp-home-3v3 data-rp-home-command-card>
          <small>3V3 LEAGUE</small>
          <strong>TO BE ANNOUNCED.</strong>
          <p>The next 3v3 League schedule will appear here.</p>
        </article>
        <article data-rp-home-5v5 data-rp-home-command-card>
          <small>5V5 LEAGUE</small>
          <strong>COMING SOON.</strong>
          <p>The next 5v5 League schedule will appear here.</p>
        </article>
      </section>
      <div class="rp-home-brand-lockup" aria-label="Real Play Basketball — Less Screen. Real Points.">
        <strong>REAL PLAY</strong>
        <span>BASKETBALL</span>
        <small>LESS SCREEN. REAL POINTS.</small>
      </div>`;

    root.addEventListener('click', (event) => {
      if (!event.target.closest('[data-rp-home-command-card]')) return;
      openOfficialFeed();
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

  function renderSchedule(selector, label, update, fallbackTitle, fallbackCopy) {
    const node = homeRoot()?.querySelector(selector);
    if (!node) return;
    if (!update) {
      node.innerHTML = `<small>${label}</small><strong>${fallbackTitle}</strong><p>${fallbackCopy}</p>`;
      return;
    }

    const when = formatEvent(update.event_at || update.eventAt);
    const location = String(update.location_name || update.locationName || '').trim();
    const meta = [when, location].filter(Boolean).join(' · ');
    node.innerHTML = `<small>${label}</small><strong>${esc(update.title || label)}</strong><p>${esc(meta || update.body || 'Official schedule published.')}</p>`;
  }

  async function refreshHomeCommandCenter() {
    if (!installHomeCommandCenter() || homeLoading) return;
    homeLoading = true;

    const access = homeRoot()?.querySelector('[data-rp-simple-access]');
    if (access) access.textContent = localStorage.getItem(TOKEN_KEY) ? 'PLAYER' : 'PUBLIC';

    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not load Real Play Home.');
      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const announcement = updates.find((item) => item?.category === 'announcement' && item?.pinned)
        || updates.find((item) => item?.category === 'announcement')
        || null;

      const now = Date.now();
      const schedules = updates
        .filter((item) => item?.category === 'schedule')
        .map((item) => ({
          item,
          time: Date.parse(item.event_at || item.eventAt || ''),
          type: scheduleType(item),
        }))
        .filter((entry) => Number.isFinite(entry.time) && entry.time >= now - 60_000)
        .sort((a, b) => a.time - b.time);

      const openRank = schedules.find((entry) => entry.type === 'open-rank')?.item || null;
      const threeVThree = schedules.find((entry) => entry.type === '3v3')?.item || null;
      const fiveVFive = schedules.find((entry) => entry.type === '5v5')?.item || null;

      renderAnnouncement(announcement);
      renderSchedule(
        '[data-rp-home-open-rank]',
        'OPEN RANK SCHEDULE',
        openRank,
        'TO BE ANNOUNCED.',
        'The next Open Rank schedule will appear here.'
      );
      renderSchedule(
        '[data-rp-home-3v3]',
        '3V3 LEAGUE',
        threeVThree,
        'TO BE ANNOUNCED.',
        'The next 3v3 League schedule will appear here.'
      );
      renderSchedule(
        '[data-rp-home-5v5]',
        '5V5 LEAGUE',
        fiveVFive,
        'COMING SOON.',
        'The next 5v5 League schedule will appear here.'
      );
    } catch (_error) {
      // Keep the four stable Home blocks visible even if the public feed is temporarily unavailable.
    } finally {
      homeLoading = false;
    }
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

  const observer = new MutationObserver(() => enforce());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class', 'aria-current', 'aria-hidden'],
  });

  document.addEventListener('click', () => queueMicrotask(enforce), true);
  window.addEventListener('focus', () => {
    enforce();
    refreshHomeCommandCenter();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      enforce();
      refreshHomeCommandCenter();
    }
  });
  window.addEventListener('storage', refreshHomeCommandCenter);
  window.addEventListener('realplay:visitorchange', refreshHomeCommandCenter);

  homeRefreshTimer = window.setInterval(() => {
    if (!document.hidden && activeRoute() === 'home') refreshHomeCommandCenter();
  }, 60_000);

  window.addEventListener('beforeunload', () => {
    if (homeRefreshTimer) window.clearInterval(homeRefreshTimer);
  });

  enforce();
})();