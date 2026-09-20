(() => {
  if (window.__realPlayRecordedStampFilterInstalled) return;
  window.__realPlayRecordedStampFilterInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_PREFIX = 'rp-recorded-score-sheet:v2:';
  const FILTER_KEY = 'rp-recorded-audit-stamp-filter';
  const FILTERS = [
    ['all', 'ALL STAMPS'],
    ['score', 'SCORE'],
    ['miss', 'MISS'],
    ['ast', 'ASSIST'],
    ['reb', 'REBOUND'],
    ['to', 'TURNOVER'],
    ['stl', 'STEAL'],
    ['blk', 'BLOCK'],
    ['foul', 'FOUL'],
  ];

  let screenRef = null;
  let draftKey = '';
  let resolvingKey = null;
  let draftEvents = [];
  let filter = readFilter();
  let menuOpen = false;
  let tickTimer = null;

  window.__realPlayAuditStampFilter = filter;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function readFilter() {
    try {
      const value = String(localStorage.getItem(FILTER_KEY) || 'all').toLowerCase();
      return FILTERS.some(([key]) => key === value) ? value : 'all';
    } catch (_) {
      return 'all';
    }
  }

  function writeFilter(value) {
    filter = FILTERS.some(([key]) => key === value) ? value : 'all';
    window.__realPlayAuditStampFilter = filter;
    try { localStorage.setItem(FILTER_KEY, filter); } catch (_) {}
  }

  function filterLabel(value = filter) {
    return FILTERS.find(([key]) => key === value)?.[1] || 'ALL STAMPS';
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function eventCategory(event) {
    if (String(event?.eventType || '').toLowerCase() === 'shot') {
      return String(event?.shotResult || '').toLowerCase() === 'make' ? 'score' : 'miss';
    }
    if (String(event?.eventType || '').toLowerCase() !== 'stat') return null;
    const key = String(event?.statKey || '').toLowerCase();
    if (['ast', 'assist', 'assists'].includes(key)) return 'ast';
    if (['reb', 'rebound', 'rebounds'].includes(key)) return 'reb';
    if (['to', 'tov', 'turnover', 'turnovers'].includes(key)) return 'to';
    if (['stl', 'steal', 'steals'].includes(key)) return 'stl';
    if (['blk', 'block', 'blocks'].includes(key)) return 'blk';
    if (['foul', 'fouls'].includes(key)) return 'foul';
    return null;
  }

  function markerText(category) {
    return {
      score: '🏀',
      miss: '×',
      ast: 'A',
      reb: 'R',
      to: 'TO',
      stl: 'S',
      blk: 'B',
      foul: 'F',
    }[category] || '•';
  }

  function categoryTitle(category) {
    return {
      score: 'Score',
      miss: 'Miss',
      ast: 'Assist',
      reb: 'Rebound',
      to: 'Turnover',
      stl: 'Steal',
      blk: 'Block',
      foul: 'Foul',
    }[category] || 'Audit event';
  }

  function installStyle() {
    if (document.getElementById('rp-audit-stamp-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-audit-stamp-filter-style';
    style.textContent = `
      .rp-audit-filter-host{position:relative;display:block!important;color:inherit!important;font:inherit!important;letter-spacing:normal!important;text-align:left!important;z-index:12}
      .rp-audit-filter-inline{margin:0 2px}
      .rp-audit-filter{position:relative;width:100%}
      .rp-audit-filter-toggle{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:26px;padding:0 9px;border:1px solid rgba(76,170,198,.22);border-radius:8px;background:rgba(5,22,31,.82);color:#84b8c9;font:900 7px/1 system-ui,sans-serif;letter-spacing:.1em;cursor:pointer}
      .rp-audit-filter-toggle strong{color:#dff9ff;font:950 7px/1 system-ui,sans-serif;letter-spacing:.09em}
      .rp-audit-filter-toggle b{color:#44d9f4;font-size:9px;line-height:1}
      .rp-audit-filter-toggle:hover,.rp-audit-filter-toggle:focus-visible{border-color:rgba(54,216,245,.52);background:rgba(7,35,47,.94);outline:none}
      .rp-audit-filter-menu{position:absolute;left:50%;bottom:calc(100% + 6px);z-index:40;display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:min(420px,calc(100vw - 34px));padding:8px;box-sizing:border-box;border:1px solid rgba(76,170,198,.32);border-radius:11px;background:#06131d;box-shadow:0 14px 34px rgba(0,0,0,.46);transform:translateX(-50%)}
      .rp-audit-filter.open .rp-audit-filter-menu{display:grid}
      .rp-audit-filter-option{min-height:32px;padding:0 6px;border:1px solid rgba(96,149,171,.2);border-radius:8px;background:#081b27;color:#8fb7c7;font:900 7px/1 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
      .rp-audit-filter-option.active{border-color:rgba(42,218,248,.62);background:#0a3040;color:#f0fcff}
      .rp-audit-filter-option:hover,.rp-audit-filter-option:focus-visible{border-color:rgba(42,218,248,.48);outline:none}
      .rp-video-scoring-screen .rp-video-marker-rail>[data-rp-video-markers]{visibility:hidden!important;pointer-events:none!important}
      .rp-audit-stamp-markers{position:absolute;inset:0;z-index:3;pointer-events:none}
      .rp-audit-stamp-marker{position:absolute;top:2px;display:grid;place-items:center;transform:translateX(-50%);width:24px;height:24px;padding:0;border:1px solid rgba(111,174,196,.28);border-radius:50%;background:#071824;color:#dff8ff;font:950 7px/1 system-ui,sans-serif;letter-spacing:-.02em;box-shadow:0 1px 4px rgba(0,0,0,.58);cursor:pointer;pointer-events:auto}
      .rp-audit-stamp-marker[data-rp-audit-category="score"]{border-color:rgba(244,157,51,.56);background:#24170a;font-size:13px}
      .rp-audit-stamp-marker[data-rp-audit-category="miss"]{border-color:rgba(210,101,101,.42);background:#231015;color:#ffb2b8;font-size:13px}
      .rp-audit-stamp-marker[data-rp-audit-category="ast"]{border-color:rgba(54,216,245,.5);color:#9cefff}
      .rp-audit-stamp-marker[data-rp-audit-category="reb"]{border-color:rgba(121,214,171,.46);color:#adf2d1}
      .rp-audit-stamp-marker[data-rp-audit-category="to"],.rp-audit-stamp-marker[data-rp-audit-category="foul"]{border-color:rgba(232,120,120,.42);color:#ffb3b3}
      .rp-audit-stamp-marker[data-rp-audit-category="stl"],.rp-audit-stamp-marker[data-rp-audit-category="blk"]{border-color:rgba(167,142,245,.46);color:#d2c5ff}
      @media(max-width:699px){.rp-audit-filter-menu{grid-template-columns:repeat(2,minmax(0,1fr));bottom:auto;top:calc(100% + 6px)}.rp-audit-filter-toggle{min-height:28px}}
    `;
    document.head.appendChild(style);
  }

  async function api(path) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function latestDraftKeyFallback() {
    let bestKey = '';
    let bestTime = 0;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(DRAFT_PREFIX)) continue;
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        const time = Date.parse(parsed?.updatedAt || '') || 0;
        if (time >= bestTime) {
          bestTime = time;
          bestKey = key;
        }
      }
    } catch (_) {}
    return bestKey;
  }

  async function resolveDraftKey() {
    if (draftKey || resolvingKey) return resolvingKey;
    resolvingKey = (async () => {
      try {
        const controlData = await api('/api/real-play/admin/career/control');
        const sessionId = Number(controlData?.control?.session?.id || 0);
        if (!Number.isSafeInteger(sessionId) || sessionId < 1) return '';
        const state = await api(`/api/real-play/admin/recorded-scoring?session_id=${encodeURIComponent(sessionId)}`);
        const uploadedAt = state?.recording?.uploadedAt || null;
        if (!uploadedAt) return '';
        return `${DRAFT_PREFIX}${sessionId}:${uploadedAt}`;
      } catch (_) {
        return latestDraftKeyFallback();
      }
    })();

    const resolved = await resolvingKey;
    resolvingKey = null;
    if (resolved) draftKey = resolved;
    return draftKey;
  }

  function loadEvents() {
    const key = draftKey;
    if (!key) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(parsed?.events) ? parsed.events : [];
    } catch (_) {
      return [];
    }
  }

  function filterMarkup() {
    const buttons = FILTERS.map(([key, label]) => (
      `<button type="button" class="rp-audit-filter-option ${filter === key ? 'active' : ''}" data-rp-audit-filter-option="${key}">${label}</button>`
    )).join('');
    return `<div class="rp-audit-filter ${menuOpen ? 'open' : ''}" data-rp-audit-filter>
      <button type="button" class="rp-audit-filter-toggle" data-rp-audit-filter-toggle aria-expanded="${menuOpen ? 'true' : 'false'}"><span>AUDIT STAMPS</span><strong>${filterLabel()}</strong><b>▾</b></button>
      <div class="rp-audit-filter-menu" data-rp-audit-filter-menu>${buttons}</div>
    </div>`;
  }

  function ensureFilterUi(screen) {
    if (!screen) return;
    const youtubeHost = screen.querySelector('.rp-youtube-player-shell.scoring .rp-youtube-host-note:not(.error)');
    if (youtubeHost) {
      youtubeHost.classList.add('rp-audit-filter-host');
      const next = filterMarkup();
      if (youtubeHost.innerHTML !== next) youtubeHost.innerHTML = next;
      return;
    }

    const wrap = screen.querySelector('.rp-video-player-wrap');
    if (!wrap) return;
    let inline = wrap.querySelector('[data-rp-audit-filter-inline]');
    if (!inline) {
      inline = document.createElement('div');
      inline.className = 'rp-audit-filter-host rp-audit-filter-inline';
      inline.dataset.rpAuditFilterInline = '1';
      const timebar = wrap.querySelector('.rp-video-timebar');
      if (timebar) wrap.insertBefore(inline, timebar);
      else wrap.appendChild(inline);
    }
    const next = filterMarkup();
    if (inline.innerHTML !== next) inline.innerHTML = next;
  }

  function durationMs(screen) {
    const media = screen?.querySelector('[data-rp-recorded-video]');
    const seconds = Number(media?.duration || 0);
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
  }

  function visibleEvents() {
    return draftEvents
      .map((event) => ({ event, category: eventCategory(event) }))
      .filter(({ category }) => category && (filter === 'all' || category === filter));
  }

  function renderMarkers(screen) {
    const rail = screen?.querySelector('.rp-video-marker-rail');
    if (!rail) return;
    let overlay = rail.querySelector('[data-rp-audit-stamp-markers]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'rp-audit-stamp-markers';
      overlay.dataset.rpAuditStampMarkers = '1';
      rail.appendChild(overlay);
    }

    const duration = durationMs(screen);
    if (!duration) return;
    const items = visibleEvents();
    const nextHtml = items.map(({ event, category }) => {
      const timestamp = Math.max(0, Number(event?.videoTimestampMs || 0));
      const left = Math.max(0, Math.min(100, timestamp / duration * 100));
      const replay = category === 'score'
        ? Number(event?.replayStartMs ?? Math.max(0, timestamp - 7000))
        : Math.max(0, timestamp - 5000);
      const title = `${categoryTitle(category)} at ${formatTime(timestamp)}`;
      return `<button type="button" class="rp-audit-stamp-marker" style="left:${left}%" data-rp-audit-category="${category}" data-rp-video-marker="${replay}" title="${title}" aria-label="${title}">${markerText(category)}</button>`;
    }).join('');
    if (overlay.innerHTML !== nextHtml) overlay.innerHTML = nextHtml;

    const key = screen.querySelector('.rp-video-marker-key');
    if (key) {
      const nextKey = `<span>${items.length} ${filterLabel()} · AUDIT STAMPS</span><small>Tap a stamp to replay from just before the audited event.</small>`;
      if (key.innerHTML !== nextKey) key.innerHTML = nextKey;
    }

    const note = screen.querySelector('.rp-video-auto-note');
    if (note) {
      const nextNote = '<strong>REVIEW LEAD-IN IS AUTOMATIC</strong><span>Every audited event gets an exact video timestamp. Filter the stamps above, then tap one to replay the moment from just before it happens.</span>';
      if (note.innerHTML !== nextNote) note.innerHTML = nextNote;
    }
  }

  function refresh() {
    installStyle();
    const screen = scoringScreen();
    if (!screen) {
      screenRef = null;
      draftKey = '';
      resolvingKey = null;
      draftEvents = [];
      menuOpen = false;
      return;
    }

    if (screen !== screenRef) {
      screenRef = screen;
      draftKey = '';
      resolvingKey = null;
      draftEvents = [];
      menuOpen = false;
      resolveDraftKey().then(() => scheduleRefresh(0));
    }

    ensureFilterUi(screen);
    draftEvents = loadEvents();
    renderMarkers(screen);
  }

  function scheduleRefresh(delay = 25) {
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = setTimeout(() => {
      tickTimer = null;
      refresh();
    }, delay);
  }

  document.addEventListener('click', (event) => {
    const screen = scoringScreen();
    if (!screen || !screen.contains(event.target)) return;

    const toggle = event.target.closest('[data-rp-audit-filter-toggle]');
    if (toggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      menuOpen = !menuOpen;
      ensureFilterUi(screen);
      return;
    }

    const option = event.target.closest('[data-rp-audit-filter-option]');
    if (option) {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeFilter(String(option.dataset.rpAuditFilterOption || 'all').toLowerCase());
      menuOpen = false;
      ensureFilterUi(screen);
      draftEvents = loadEvents();
      renderMarkers(screen);
      return;
    }

    if (event.target.closest('[data-rp-video-shot],[data-rp-video-stat],[data-rp-draft-remove-shot],[data-rp-draft-remove-stat],[data-rp-video-undo]')) {
      scheduleRefresh(0);
      setTimeout(() => scheduleRefresh(0), 40);
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (!menuOpen || event.target.closest('[data-rp-audit-filter]')) return;
    menuOpen = false;
    scheduleRefresh(0);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === FILTER_KEY) {
      writeFilter(readFilter());
      menuOpen = false;
      scheduleRefresh(0);
      return;
    }
    if (event.key?.startsWith(DRAFT_PREFIX)) scheduleRefresh(0);
  });

  window.addEventListener('realplay:admin-render', () => scheduleRefresh(0));
  window.addEventListener('realplay:recorded-scoring-cancelled', () => {
    draftKey = '';
    draftEvents = [];
    scheduleRefresh(0);
  });

  const observer = new MutationObserver((mutations) => {
    if (!scoringScreen()) return;
    const relevant = mutations.some((mutation) => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return nodes.some((node) => {
        if (node.nodeType !== 1) return false;
        return node.matches?.('.rp-video-scoring-screen,.rp-youtube-player-shell,.rp-video-marker-rail,[data-rp-video-markers]')
          || Boolean(node.querySelector?.('.rp-video-scoring-screen,.rp-youtube-player-shell,.rp-video-marker-rail,[data-rp-video-markers]'));
      });
    });
    if (relevant) scheduleRefresh(20);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    if (scoringScreen()) refresh();
  }, 500);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleRefresh(0), { once: true });
  else scheduleRefresh(0);
})();
