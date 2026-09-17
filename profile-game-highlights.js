(() => {
  if (window.__realPlayProfileHighlightsInstalled) return;
  window.__realPlayProfileHighlightsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const PUBLIC_COMMUNITY_URL = `${API_BASE_URL}/api/real-play/public/community`;
  const PRE_ROLL_MS = 7000;
  const POST_ROLL_MS = 7000;
  const TICK_MS = 80;
  const CACHE_MS = 5000;

  let currentPublicPlayerId = null;
  let ownGamesCache = null;
  let ownGamesCacheAt = 0;
  const publicGamesCache = new Map();
  let observer = null;

  let viewer = null;
  let replayData = null;
  let highlights = [];
  let activeIndex = 0;
  let activeSessionId = 0;
  let activeContext = null;
  let directVideo = null;
  let youtubePlayer = null;
  let ticker = null;
  let durationMs = 0;
  let playing = false;
  let mediaReady = false;
  let loadToken = 0;

  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const positiveId = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function visitorActive() {
    return !token() && localStorage.getItem(VISITOR_KEY) === '1';
  }

  function isIPhoneBrowser() {
    return /iPhone|iPod/i.test(String(navigator.userAgent || ''));
  }

  function recentGamesFrom(value) {
    const career = value?.career || value?.careerSummary || value?.career_summary || value?.profile?.career || {};
    const rows = value?.recentGames || value?.recent_games || career?.recentGames || career?.recent_games || value?.games;
    return Array.isArray(rows) ? rows : [];
  }

  function sessionIdFrom(game) {
    return positiveId(game?.sessionId ?? game?.session_id ?? game?.id);
  }

  function openRankNumberFrom(game) {
    return positiveId(game?.openRankNumber ?? game?.open_rank_number ?? game?.rankingNumber ?? game?.ranking_number);
  }

  function visibleOpenRankNumberFrom(card) {
    const label = String(card?.querySelector('.rp-profile-game-main strong')?.textContent || '').trim();
    const match = label.match(/\bOPEN\s+RANK(?:ING)?(?:\s+(?:SESSION|GAME))?\s*#\s*0*(\d+)\b/i);
    return positiveId(match?.[1]);
  }

  function gameIndex(card) {
    const history = card?.closest('.rp-profile-history');
    if (!history) return -1;
    return [...history.querySelectorAll(':scope > .rp-profile-game')].indexOf(card);
  }

  function publicPlayerIdFrom(profile) {
    const values = [
      profile?.dataset?.rpPublicPlayerId,
      profile?.__realPlayPublicPlayer?.playerId,
      profile?.__realPlayPublicPlayer?.userId,
      profile?.__realPlayPublicPlayer?.accountUserId,
      currentPublicPlayerId,
    ];
    for (const value of values) {
      const id = positiveId(value);
      if (id) return id;
    }
    return null;
  }

  function contextFromCard(card) {
    const publicProfile = card?.closest('[data-rp-public-profile], [data-rp-visitor-public-profile], .rp-public-player-profile');
    const profile = publicProfile || card?.closest('[data-rp-profile]');
    const name = String(profile?.querySelector('.rp-profile-name h1')?.textContent || 'REAL PLAY PLAYER').trim();
    const numberText = String(profile?.querySelector('.rp-profile-number strong')?.textContent || '').trim();
    return {
      isPublic: Boolean(publicProfile),
      playerId: publicProfile ? publicPlayerIdFrom(publicProfile) : null,
      playerName: name || 'REAL PLAY PLAYER',
      playerNumber: /^#\d+$/.test(numberText) ? numberText : '',
      gameLabel: String(card?.querySelector('.rp-profile-game-main strong')?.textContent || 'REAL PLAY GAME').trim(),
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Real Play request failed.');
    return data;
  }

  async function loadOwnGames() {
    if (ownGamesCache && Date.now() - ownGamesCacheAt < CACHE_MS) return ownGamesCache;
    const auth = token();
    if (!auth) throw new Error('Sign in to Real Play to watch highlights.');
    const data = await fetchJson(`${API_BASE_URL}/api/real-play/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
    });
    ownGamesCache = recentGamesFrom(data);
    ownGamesCacheAt = Date.now();
    return ownGamesCache;
  }

  async function loadPublicGames(playerId) {
    const id = positiveId(playerId);
    if (!id) throw new Error('Player profile is unavailable.');
    const cached = publicGamesCache.get(id);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.games;

    const auth = token();
    const visitor = visitorActive();
    if (!auth && !visitor) throw new Error('Sign in to Real Play to watch highlights.');
    const data = await fetchJson(visitor ? PUBLIC_COMMUNITY_URL : COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ action: 'player_profile', playerId: id }),
    });
    const games = recentGamesFrom(data?.player || data);
    publicGamesCache.set(id, { games, at: Date.now() });
    return games;
  }

  async function resolveSessionId(card, context) {
    const cached = positiveId(card?.dataset?.rpProfileGameSession);
    if (cached) return cached;

    const index = gameIndex(card);
    if (index < 0) throw new Error('Game could not be identified.');
    const games = context?.isPublic
      ? await loadPublicGames(context.playerId)
      : await loadOwnGames();

    const visibleNumber = visibleOpenRankNumberFrom(card);
    let id = null;
    if (visibleNumber) {
      const matched = games.find((game) => openRankNumberFrom(game) === visibleNumber);
      id = sessionIdFrom(matched);
    }
    if (!id) id = sessionIdFrom(games[index]);
    if (!id) throw new Error('This game does not have a verified replay yet.');
    card.dataset.rpProfileGameSession = String(id);
    return id;
  }

  async function fetchReplay(sessionId) {
    const id = positiveId(sessionId);
    if (!id) throw new Error('Invalid game.');
    const auth = token();
    if (!auth && !visitorActive()) throw new Error('Sign in to Real Play to watch highlights.');
    return fetchJson(`${API_BASE_URL}/api/real-play/career/games/${encodeURIComponent(id)}/replay`, {
      headers: { Accept: 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    });
  }

  function eventPlayerId(event) {
    const raw = event?.playerId ?? event?.player_id ?? event?.userId ?? event?.user_id;
    return raw === undefined || raw === null || raw === '' ? '' : String(raw);
  }

  function playerPools(data) {
    return [data?.playerStats, data?.players, data?.roster, data?.game?.players, data?.game?.roster]
      .filter(Array.isArray);
  }

  function playerById(data, id) {
    if (id === undefined || id === null || id === '') return null;
    const target = String(id);
    for (const pool of playerPools(data)) {
      const match = pool.find((player) => {
        const raw = player?.playerId ?? player?.player_id ?? player?.id ?? player?.userId ?? player?.user_id;
        return raw !== undefined && raw !== null && String(raw) === target;
      });
      if (match) return match;
    }
    return null;
  }

  function playerByName(data, name) {
    const target = normalize(name);
    if (!target) return null;
    for (const pool of playerPools(data)) {
      const match = pool.find((player) => normalize(player?.playerName ?? player?.player_name ?? player?.name) === target);
      if (match) return match;
    }
    return null;
  }

  function eventPlayerName(data, event) {
    const direct = event?.playerName ?? event?.player_name ?? event?.name;
    if (String(direct || '').trim()) return String(direct).trim();
    const record = playerById(data, eventPlayerId(event));
    return String(record?.playerName ?? record?.player_name ?? record?.name ?? '').trim();
  }

  function timestampMs(event) {
    return number(
      event?.videoTimestampMs
      ?? event?.video_timestamp_ms
      ?? event?.timestampMs
      ?? event?.timestamp_ms
      ?? event?.timeMs
      ?? event?.time_ms,
      -1
    );
  }

  function eventLabel(event) {
    const type = normalize(event?.eventType ?? event?.event_type ?? event?.type);
    const stat = normalize(event?.statKey ?? event?.stat_key ?? event?.stat ?? event?.key);
    const labels = new Map([
      ['ast', 'ASSIST'], ['assist', 'ASSIST'], ['assists', 'ASSIST'],
      ['reb', 'REBOUND'], ['rebound', 'REBOUND'], ['rebounds', 'REBOUND'],
      ['stl', 'STEAL'], ['steal', 'STEAL'], ['steals', 'STEAL'],
      ['blk', 'BLOCK'], ['block', 'BLOCK'], ['blocks', 'BLOCK'],
      ['one_point_make', '1PT MAKE'], ['one point make', '1PT MAKE'], ['1pt make', '1PT MAKE'], ['1pt_make', '1PT MAKE'],
      ['two_point_make', '2PT MAKE'], ['two point make', '2PT MAKE'], ['2pt make', '2PT MAKE'], ['2pt_make', '2PT MAKE'],
    ]);
    return labels.get(stat) || labels.get(type) || '';
  }

  function playerMatches(data, event, context) {
    const expectedId = context?.playerId === undefined || context?.playerId === null ? '' : String(context.playerId);
    const actualId = eventPlayerId(event);
    if (expectedId && actualId && expectedId === actualId) return true;
    return normalize(context?.playerName) === normalize(eventPlayerName(data, event));
  }

  function identityFrom(data, context) {
    const record = playerById(data, context?.playerId) || playerByName(data, context?.playerName);
    const name = String(record?.playerName ?? record?.player_name ?? record?.name ?? context?.playerName ?? 'REAL PLAY PLAYER').trim();
    const rawNumber = record?.playerNumber ?? record?.player_number;
    const direct = rawNumber === undefined || rawNumber === null || rawNumber === '' ? '' : `#${Number(rawNumber)}`;
    const playerNumber = /^#\d+$/.test(direct) ? direct : (context?.playerNumber || '#--');
    return { name, playerNumber };
  }

  function collectHighlights(data, context) {
    const output = [];
    const seen = new Set();

    function add(event, label, stamp) {
      if (!playerMatches(data, event, context)) return;
      const at = number(stamp, -1);
      if (at < 0) return;
      const rawId = event?.eventId ?? event?.event_id ?? event?.id ?? '';
      const key = rawId ? `id:${rawId}` : `${normalize(label)}:${Math.round(at / 100)}`;
      if (seen.has(key)) return;
      seen.add(key);
      output.push({
        key,
        label,
        stamp: at,
        start: Math.max(0, at - PRE_ROLL_MS),
        end: at + POST_ROLL_MS,
      });
    }

    const markers = Array.isArray(data?.markers) ? data.markers : [];
    markers.forEach((marker) => {
      const value = number(marker?.shotValue ?? marker?.shot_value ?? marker?.points ?? marker?.value, 0);
      add(marker, value >= 2 ? '2PT MAKE' : '1PT MAKE', timestampMs(marker));
    });

    const walked = new Set();
    function walk(value, depth) {
      if (depth > 7 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (typeof value !== 'object' || walked.has(value)) return;
      walked.add(value);
      const label = eventLabel(value);
      if (label) add(value, label, timestampMs(value));
      Object.values(value).forEach((child) => walk(child, depth + 1));
    }
    walk(data, 0);

    output.sort((a, b) => a.stamp - b.stamp);
    return output.filter((item, index, all) => !all.slice(0, index).some((earlier) =>
      earlier.label === item.label && Math.abs(earlier.stamp - item.stamp) < 250
    ));
  }

  function installStyles() {
    if (document.querySelector('[data-rp-profile-highlight-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileHighlightStyles = '1';
    style.textContent = `
      .rp-profile-game .rp-profile-game-open-hint{display:none!important}
      .rp-profile-game-media-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%;margin-top:10px}
      .rp-profile-game-media-action{min-height:40px;padding:0 7px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:linear-gradient(160deg,#090d13,#05070a);color:#cbd4de;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:.5rem;font-style:italic;font-weight:950;letter-spacing:.055em;cursor:pointer}
      .rp-profile-game-media-action strong{margin-right:5px;color:#fff;font-size:.66rem}
      .rp-profile-game-media-action.highlight{border-color:rgba(72,215,255,.28);background:linear-gradient(160deg,rgba(6,35,48,.92),rgba(4,11,17,.98));color:#61ddff}
      .rp-profile-game-media-action:focus-visible{outline:1px solid rgba(72,215,255,.55);outline-offset:2px}
      .rp-profile-game-media-action:disabled{opacity:.5;cursor:wait}
      @media(max-width:390px){.rp-profile-game-media-actions{gap:5px}.rp-profile-game-media-action{font-size:.45rem;padding-inline:5px}}

      body.rp-profile-highlight-open{overflow:hidden!important;background:#000!important}
      .rp-highlight-viewer{position:fixed;z-index:3300;inset:0;display:none;width:100vw;height:100dvh;overflow:hidden;background:#000;color:#fff;font-family:var(--rp-body,Arial,sans-serif)}
      .rp-highlight-viewer.open{display:block}
      .rp-highlight-stage{position:relative;width:100vw;height:100dvh;overflow:hidden;background:#000}
      .rp-highlight-media,.rp-highlight-media>div,.rp-highlight-media video,.rp-highlight-media iframe{position:absolute;inset:0;width:100%!important;height:100%!important;border:0!important;background:#000}
      .rp-highlight-media video{object-fit:contain!important}
      .rp-highlight-media iframe{pointer-events:none}
      .rp-highlight-stage::after{content:'';position:absolute;z-index:1;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent 23%,transparent 64%,rgba(0,0,0,.76))}
      .rp-highlight-topbar{position:absolute;z-index:5;top:0;left:0;right:0;display:grid;grid-template-columns:42px minmax(0,1fr) 44px;align-items:center;gap:9px;padding:calc(11px + env(safe-area-inset-top)) 13px 10px}
      .rp-highlight-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.17);border-radius:50%;background:rgba(3,6,10,.66);color:#fff;font-size:1.35rem;line-height:1;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      .rp-highlight-identity{min-width:0;text-align:center}.rp-highlight-identity small{display:block;color:#4bd8ff;font-size:.46rem;font-weight:950;letter-spacing:.16em}.rp-highlight-identity strong{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:.84rem;font-style:italic;letter-spacing:.04em}
      .rp-highlight-count{min-width:40px;padding:6px 7px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(3,6,10,.58);color:#d5dee8;font-size:.52rem;font-weight:950;text-align:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .rp-highlight-event{position:absolute;z-index:5;left:16px;bottom:calc(24px + env(safe-area-inset-bottom));display:grid;gap:3px;max-width:74%;padding:10px 12px;border-left:3px solid #4bd8ff;background:linear-gradient(90deg,rgba(0,0,0,.7),rgba(0,0,0,.12));pointer-events:none}
      .rp-highlight-event strong{font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:1.05rem;font-style:italic;letter-spacing:.05em}.rp-highlight-event span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b3bec8;font-size:.5rem;font-weight:850;letter-spacing:.07em}
      .rp-highlight-play{position:absolute;z-index:6;left:50%;top:50%;width:64px;height:64px;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(1,5,8,.64);color:#fff;font-size:1.35rem;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;pointer-events:none;transition:opacity .18s ease}
      .rp-highlight-play.show{opacity:1;pointer-events:auto}
      .rp-highlight-end{position:absolute;z-index:7;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));width:min(92vw,520px);transform:translateX(-50%);box-sizing:border-box;padding:15px;border:1px solid rgba(72,215,255,.22);border-radius:16px;background:linear-gradient(160deg,rgba(4,10,16,.95),rgba(1,4,8,.97));box-shadow:0 20px 60px rgba(0,0,0,.52);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
      .rp-highlight-end[hidden]{display:none!important}.rp-highlight-end>small{display:block;margin-bottom:10px;color:#8b9aa8;font-size:.45rem;font-weight:950;letter-spacing:.16em;text-align:center}
      .rp-highlight-end-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px}.rp-highlight-end button,.rp-highlight-empty button{min-height:44px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:#090d13;color:#e7edf3;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:.54rem;font-style:italic;font-weight:950;letter-spacing:.06em}.rp-highlight-end .primary{border-color:rgba(72,215,255,.34);background:linear-gradient(160deg,#07354a,#06131e);color:#63e0ff}.rp-highlight-end .primary:disabled{opacity:.45}.rp-highlight-full-game{width:100%;margin-top:8px!important;color:#9aa7b4!important;background:rgba(5,8,12,.74)!important}
      .rp-highlight-empty{position:absolute;z-index:8;left:50%;top:50%;width:min(88vw,470px);transform:translate(-50%,-50%);box-sizing:border-box;padding:22px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(4,8,13,.95);text-align:center}.rp-highlight-empty[hidden]{display:none!important}.rp-highlight-empty strong{display:block;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:1rem;font-style:italic}.rp-highlight-empty p{margin:8px 0 16px;color:#8fa0ad;font-size:.69rem;line-height:1.5}.rp-highlight-empty button{width:100%;border-color:rgba(72,215,255,.28);color:#64ddff}
      .rp-highlight-loading{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);color:#66dcff;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:.68rem;font-style:italic;font-weight:950;letter-spacing:.11em;white-space:nowrap}.rp-highlight-loading[hidden]{display:none!important}
      @media(orientation:landscape){.rp-highlight-topbar{padding-top:max(8px,env(safe-area-inset-top));padding-left:max(14px,env(safe-area-inset-left));padding-right:max(14px,env(safe-area-inset-right))}.rp-highlight-event{left:max(18px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));max-width:44%}.rp-highlight-end{width:min(620px,70vw);bottom:max(14px,env(safe-area-inset-bottom))}.rp-highlight-identity strong{font-size:.94rem}}
      @media(max-width:620px) and (orientation:portrait){.rp-highlight-topbar{grid-template-columns:38px minmax(0,1fr) 40px}.rp-highlight-close{width:38px;height:38px}.rp-highlight-end{bottom:calc(18px + env(safe-area-inset-bottom))}}
      @media(prefers-reduced-motion:reduce){.rp-highlight-play{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureViewer() {
    if (viewer?.isConnected) return viewer;
    viewer = document.createElement('section');
    viewer.className = 'rp-highlight-viewer';
    viewer.dataset.rpProfileHighlightViewer = '1';
    viewer.setAttribute('aria-hidden', 'true');
    viewer.innerHTML = `
      <div class="rp-highlight-stage">
        <div class="rp-highlight-media" data-rp-highlight-media></div>
        <div class="rp-highlight-topbar">
          <button type="button" class="rp-highlight-close" data-rp-highlight-close aria-label="Close highlights">×</button>
          <div class="rp-highlight-identity"><small>MY HIGHLIGHTS</small><strong data-rp-highlight-player>REAL PLAY PLAYER</strong></div>
          <span class="rp-highlight-count" data-rp-highlight-count>—</span>
        </div>
        <div class="rp-highlight-event"><strong data-rp-highlight-event>HIGHLIGHT</strong><span data-rp-highlight-game>REAL PLAY GAME</span></div>
        <button type="button" class="rp-highlight-play" data-rp-highlight-toggle aria-label="Play or pause highlight">▶</button>
        <div class="rp-highlight-end" data-rp-highlight-end hidden>
          <small>HIGHLIGHT COMPLETE</small>
          <div class="rp-highlight-end-actions">
            <button type="button" data-rp-highlight-replay>↻ REPLAY</button>
            <button type="button" class="primary" data-rp-highlight-next>NEXT HIGHLIGHT →</button>
          </div>
          <button type="button" class="rp-highlight-full-game" data-rp-highlight-full-game>WATCH FULL VIDEO</button>
        </div>
        <div class="rp-highlight-empty" data-rp-highlight-empty hidden>
          <strong>NO TIMESTAMPED HIGHLIGHTS YET.</strong>
          <p>The full game is available, but this player does not have highlight moments with video timestamps yet.</p>
          <button type="button" data-rp-highlight-full-game>WATCH FULL VIDEO</button>
        </div>
        <div class="rp-highlight-loading" data-rp-highlight-loading>BUILDING YOUR HIGHLIGHTS…</div>
      </div>`;
    document.body.appendChild(viewer);

    viewer.addEventListener('click', (event) => {
      if (event.target.closest('[data-rp-highlight-close]')) return closeViewer();
      if (event.target.closest('[data-rp-highlight-toggle]')) {
        if (playing) pauseMedia(); else playMedia();
        return;
      }
      if (event.target.closest('[data-rp-highlight-replay]')) return playAt(activeIndex);
      if (event.target.closest('[data-rp-highlight-next]')) {
        if (activeIndex + 1 < highlights.length) playAt(activeIndex + 1);
        return;
      }
      if (event.target.closest('[data-rp-highlight-full-game]')) {
        const id = activeSessionId;
        closeViewer();
        window.setTimeout(() => openFullGame(id), 100);
      }
    });
    return viewer;
  }

  function decorateCard(card) {
    if (!card || card.querySelector('[data-rp-profile-game-media-actions]')) return;
    const summary = card.querySelector(':scope > .rp-profile-game-summary');
    if (!summary) return;
    const publicProfile = card.closest('[data-rp-public-profile], [data-rp-visitor-public-profile], .rp-public-player-profile');
    const actions = document.createElement('div');
    actions.className = 'rp-profile-game-media-actions';
    actions.dataset.rpProfileGameMediaActions = '1';
    actions.innerHTML = `
      <button type="button" class="rp-profile-game-media-action" data-rp-profile-full-video>
        <strong>▶</strong> WATCH FULL VIDEO
      </button>
      <button type="button" class="rp-profile-game-media-action highlight" data-rp-profile-highlight-action>
        <strong>🏀</strong> ${publicProfile ? 'WATCH HIGHLIGHTS' : 'WATCH MY HIGHLIGHTS'}
      </button>`;
    summary.appendChild(actions);
  }

  function decorateAll(root = document) {
    if (root?.matches?.('.rp-profile-history .rp-profile-game')) decorateCard(root);
    root?.querySelectorAll?.('.rp-profile-history .rp-profile-game').forEach(decorateCard);
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) decorateAll(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function openFullGame(sessionId) {
    const id = positiveId(sessionId);
    if (!id) return;
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.rpCareerReplaySession = String(id);
    document.body.appendChild(proxy);
    proxy.click();
    window.setTimeout(() => proxy.remove(), 0);
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__realPlayHighlightYouTubePromise) return window.__realPlayHighlightYouTubePromise;
    window.__realPlayHighlightYouTubePromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch (_) {}
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube player could not initialize.'));
      };
      let script = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('YouTube player could not load.'));
        document.head.appendChild(script);
      }
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          resolve(window.YT);
        } else if (Date.now() - started > 12000) {
          window.clearInterval(poll);
          reject(new Error('YouTube player took too long to load.'));
        }
      }, 120);
    });
    return window.__realPlayHighlightYouTubePromise;
  }

  function destroyMedia() {
    if (ticker) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (directVideo) {
      try { directVideo.pause(); } catch (_) {}
      directVideo.removeAttribute('src');
      try { directVideo.load(); } catch (_) {}
      directVideo = null;
    }
    if (youtubePlayer) {
      try { youtubePlayer.destroy(); } catch (_) {}
      youtubePlayer = null;
    }
    durationMs = 0;
    playing = false;
    mediaReady = false;
    viewer?.querySelector('[data-rp-highlight-media]')?.replaceChildren();
  }

  function currentMs() {
    if (directVideo) return Math.max(0, Math.round(number(directVideo.currentTime) * 1000));
    if (youtubePlayer) {
      try {
        const seconds = number(youtubePlayer.getCurrentTime?.(), 0);
        return Math.max(0, Math.round(seconds * 1000));
      } catch (_) {}
    }
    return 0;
  }

  function seek(ms) {
    const seconds = Math.max(0, number(ms) / 1000);
    if (directVideo) {
      try { directVideo.currentTime = seconds; } catch (_) {}
    } else if (youtubePlayer) {
      try { youtubePlayer.seekTo(seconds, true); } catch (_) {}
    }
  }

  function playMedia() {
    if (directVideo) {
      directVideo.play().then(() => {
        playing = true;
        syncPlayButton();
      }).catch(() => {
        playing = false;
        syncPlayButton();
      });
      return;
    }
    if (youtubePlayer) {
      try { youtubePlayer.playVideo(); playing = true; } catch (_) { playing = false; }
      syncPlayButton();
    }
  }

  function pauseMedia() {
    if (directVideo) {
      try { directVideo.pause(); } catch (_) {}
    } else if (youtubePlayer) {
      try { youtubePlayer.pauseVideo(); } catch (_) {}
    }
    playing = false;
    syncPlayButton();
  }

  function syncPlayButton() {
    const button = viewer?.querySelector('[data-rp-highlight-toggle]');
    if (!button) return;
    const endVisible = !viewer.querySelector('[data-rp-highlight-end]')?.hidden;
    button.textContent = playing ? '❚❚' : '▶';
    button.classList.toggle('show', mediaReady && !playing && !endVisible);
  }

  function hideEnd() {
    const end = viewer?.querySelector('[data-rp-highlight-end]');
    if (end) end.hidden = true;
  }

  function showEnd() {
    pauseMedia();
    const end = viewer?.querySelector('[data-rp-highlight-end]');
    const next = end?.querySelector('[data-rp-highlight-next]');
    if (!end || !next) return;
    const last = activeIndex >= highlights.length - 1;
    next.textContent = last ? 'ALL HIGHLIGHTS COMPLETE' : 'NEXT HIGHLIGHT →';
    next.disabled = last;
    end.hidden = false;
    syncPlayButton();
  }

  function updateChrome() {
    const item = highlights[activeIndex];
    if (!item || !viewer) return;
    const identity = identityFrom(replayData, activeContext || {});
    const player = viewer.querySelector('[data-rp-highlight-player]');
    const count = viewer.querySelector('[data-rp-highlight-count]');
    const label = viewer.querySelector('[data-rp-highlight-event]');
    const game = viewer.querySelector('[data-rp-highlight-game]');
    if (player) player.textContent = `${identity.playerNumber || '#--'} ${identity.name}`;
    if (count) count.textContent = `${activeIndex + 1} / ${highlights.length}`;
    if (label) label.textContent = item.label;
    if (game) game.textContent = activeContext?.gameLabel || replayData?.game?.title || 'REAL PLAY GAME';
  }

  function playAt(index) {
    if (!mediaReady || !highlights.length) return;
    activeIndex = Math.max(0, Math.min(highlights.length - 1, number(index, 0)));
    const item = highlights[activeIndex];
    if (durationMs > 0) item.end = Math.min(item.end, durationMs);
    updateChrome();
    hideEnd();
    seek(item.start);
    window.setTimeout(playMedia, 70);
  }

  function startTicker() {
    if (ticker) return;
    ticker = window.setInterval(() => {
      if (!viewer?.classList.contains('open') || !mediaReady || !playing) return;
      const item = highlights[activeIndex];
      if (!item) return;
      if (currentMs() >= Math.max(item.start + 400, item.end - 70)) showEnd();
    }, TICK_MS);
  }

  async function mountYouTube(videoId, requestId) {
    const media = viewer?.querySelector('[data-rp-highlight-media]');
    if (!media || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) throw new Error('This YouTube replay source is invalid.');
    media.innerHTML = '<div data-rp-highlight-youtube></div>';
    await loadYouTubeApi();
    if (requestId !== loadToken || !viewer?.classList.contains('open')) return;
    const host = media.querySelector('[data-rp-highlight-youtube]');
    const hostId = `rp-highlight-yt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    host.id = hostId;
    youtubePlayer = new window.YT.Player(hostId, {
      videoId: String(videoId),
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3, enablejsapi: 1, origin: window.location.origin },
      events: {
        onReady: (event) => {
          if (requestId !== loadToken) return;
          const seconds = number(event.target.getDuration?.(), 0);
          if (seconds > 0) durationMs = Math.round(seconds * 1000);
          try {
            const iframe = event.target.getIframe?.();
            if (iframe) { iframe.setAttribute('tabindex', '-1'); iframe.setAttribute('aria-hidden', 'true'); iframe.style.pointerEvents = 'none'; }
          } catch (_) {}
          mediaReady = true;
          const loading = viewer?.querySelector('[data-rp-highlight-loading]');
          if (loading) loading.hidden = true;
          startTicker();
          playAt(0);
        },
        onStateChange: (event) => {
          if (!window.YT?.PlayerState) return;
          playing = event.data === window.YT.PlayerState.PLAYING;
          if (event.data === window.YT.PlayerState.ENDED) playing = false;
          syncPlayButton();
        },
        onError: () => showMediaError('YouTube could not play this highlight.'),
      },
    });
  }

  function mountDirect(streamUrl, requestId) {
    const media = viewer?.querySelector('[data-rp-highlight-media]');
    if (!media || !streamUrl) throw new Error('The game video stream is unavailable.');
    const video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'metadata';
    video.controls = false;
    video.src = String(streamUrl).startsWith('http') ? String(streamUrl) : `${API_BASE_URL}${streamUrl}`;
    media.replaceChildren(video);
    directVideo = video;
    video.addEventListener('loadedmetadata', () => {
      if (requestId !== loadToken) return;
      if (Number.isFinite(video.duration) && video.duration > 0) durationMs = Math.round(video.duration * 1000);
      mediaReady = true;
      const loading = viewer?.querySelector('[data-rp-highlight-loading]');
      if (loading) loading.hidden = true;
      startTicker();
      playAt(0);
    });
    video.addEventListener('play', () => { playing = true; syncPlayButton(); });
    video.addEventListener('pause', () => { playing = false; syncPlayButton(); });
    video.addEventListener('ended', showEnd);
    video.addEventListener('error', () => showMediaError('The verified game video could not be loaded.'));
  }

  function showMediaError(message) {
    destroyMedia();
    const loading = viewer?.querySelector('[data-rp-highlight-loading]');
    const empty = viewer?.querySelector('[data-rp-highlight-empty]');
    if (loading) loading.hidden = true;
    if (empty) {
      empty.hidden = false;
      const title = empty.querySelector('strong');
      const copy = empty.querySelector('p');
      if (title) title.textContent = 'HIGHLIGHT VIDEO UNAVAILABLE.';
      if (copy) copy.textContent = message || 'The video could not be loaded.';
    }
  }

  function tryFullscreen(node) {
    if (!node || isIPhoneBrowser()) return;
    try {
      if (node.requestFullscreen && !document.fullscreenElement) node.requestFullscreen().catch(() => {});
      else if (node.webkitRequestFullscreen && !document.webkitFullscreenElement) node.webkitRequestFullscreen();
    } catch (_) {}
  }

  async function openViewer(card) {
    const context = contextFromCard(card);
    const root = ensureViewer();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-profile-highlight-open');
    tryFullscreen(root);

    const requestId = ++loadToken;
    destroyMedia();
    replayData = null;
    highlights = [];
    activeIndex = 0;
    activeContext = context;

    const loading = root.querySelector('[data-rp-highlight-loading]');
    const empty = root.querySelector('[data-rp-highlight-empty]');
    const end = root.querySelector('[data-rp-highlight-end]');
    if (loading) { loading.hidden = false; loading.textContent = 'BUILDING YOUR HIGHLIGHTS…'; }
    if (empty) empty.hidden = true;
    if (end) end.hidden = true;

    try {
      const sessionId = await resolveSessionId(card, context);
      if (requestId !== loadToken) return;
      activeSessionId = sessionId;
      const data = await fetchReplay(sessionId);
      if (requestId !== loadToken) return;
      replayData = data;
      highlights = collectHighlights(data, context);

      const identity = identityFrom(data, context);
      const player = root.querySelector('[data-rp-highlight-player]');
      const count = root.querySelector('[data-rp-highlight-count]');
      if (player) player.textContent = `${identity.playerNumber || '#--'} ${identity.name}`;
      if (count) count.textContent = highlights.length ? `1 / ${highlights.length}` : '0 / 0';

      if (!highlights.length) {
        if (loading) loading.hidden = true;
        if (empty) empty.hidden = false;
        return;
      }

      updateChrome();
      const sourceType = data?.recording?.sourceType === 'youtube' ? 'youtube' : 'uploaded';
      if (sourceType === 'youtube') await mountYouTube(data?.recording?.youtubeVideoId, requestId);
      else mountDirect(data?.streamUrl ?? data?.recording?.streamUrl ?? data?.recording?.stream_url, requestId);
    } catch (error) {
      console.warn('[Real Play] Highlight viewer could not open.', error);
      if (loading) loading.hidden = true;
      if (empty) {
        empty.hidden = false;
        const title = empty.querySelector('strong');
        const copy = empty.querySelector('p');
        if (title) title.textContent = 'HIGHLIGHTS UNAVAILABLE.';
        if (copy) copy.textContent = error?.message || 'This game does not have highlight footage yet.';
      }
    }
  }

  function closeViewer() {
    ++loadToken;
    destroyMedia();
    replayData = null;
    highlights = [];
    activeIndex = 0;
    activeSessionId = 0;
    activeContext = null;
    if (viewer) {
      viewer.classList.remove('open');
      viewer.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('rp-profile-highlight-open');
    try {
      if (document.fullscreenElement === viewer && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement === viewer && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {}
  }

  document.addEventListener('click', (event) => {
    const playerRow = event.target.closest('[data-world-player-id]');
    if (playerRow) {
      const id = positiveId(playerRow.dataset.worldPlayerId);
      if (id) currentPublicPlayerId = id;
    }

    const highlightButton = event.target.closest('[data-rp-profile-highlight-action]');
    if (!highlightButton) return;
    const card = highlightButton.closest('.rp-profile-game');
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    card.removeAttribute('open');
    openViewer(card);
  }, true);

  window.addEventListener('realplay:public-profile-loaded', (event) => {
    const id = positiveId(event?.detail?.playerId);
    if (id) currentPublicPlayerId = id;
    window.setTimeout(() => decorateAll(), 0);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !viewer?.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeViewer();
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY && event.key !== VISITOR_KEY) return;
    ownGamesCache = null;
    ownGamesCacheAt = 0;
    publicGamesCache.clear();
    if (viewer?.classList.contains('open')) closeViewer();
  });

  installStyles();
  ensureViewer();
  decorateAll();
  startObserver();

  window.RealPlayProfileHighlights = { open: openViewer, close: closeViewer };
})();