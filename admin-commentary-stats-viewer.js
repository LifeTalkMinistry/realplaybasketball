(() => {
  if (window.__realPlayCommentaryStatsViewerInstalled) return;
  window.__realPlayCommentaryStatsViewerInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const CONTROL_URL = `${API_BASE_URL}/api/real-play/admin/career/control`;
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const POLL_MS = 5000;

  let adminRoot = null;
  let viewer = null;
  let view = 'idle';
  let control = { session: null, players: [] };
  let directory = [];
  let west = [];
  let east = [];
  let selectedId = null;
  let pickerSide = null;
  let pickerQuery = '';
  let loading = false;
  let notice = '';
  let hydratedFromSession = false;
  let pollTimer = null;
  let lastControlSignature = '';
  const profileCache = new Map();
  const profileLoading = new Set();

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function playerId(player) {
    const raw = pick(player?.playerId, player?.player_id, player?.userId, player?.user_id, player?.id);
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }

  function playerName(player) {
    return String(pick(player?.playerName, player?.player_name, player?.name, 'REAL PLAY PLAYER')).trim();
  }

  function jersey(player) {
    const value = pick(player?.playerNumber, player?.player_number, player?.jerseyNumber, player?.jersey_number);
    const n = finite(value);
    return n === null ? null : Math.trunc(n);
  }

  function keyFor(player) {
    const id = playerId(player);
    if (id) return `id:${id}`;
    return `name:${playerName(player).toLowerCase()}`;
  }

  async function adminControl() {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(CONTROL_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load the current session.');
    return data?.control || { session: null, players: [] };
  }

  async function community(action, payload = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load player information.');
    return data;
  }

  function mergePlayers(controlPlayer, directoryPlayer) {
    if (!controlPlayer) return directoryPlayer || {};
    if (!directoryPlayer) return controlPlayer || {};
    return {
      ...directoryPlayer,
      ...controlPlayer,
      careerStats: directoryPlayer.careerStats || controlPlayer.careerStats,
      record: directoryPlayer.record || controlPlayer.record,
      ovr: pick(directoryPlayer.ovr, controlPlayer.ovr),
      rank: pick(directoryPlayer.rank, controlPlayer.rank),
      playerNumber: pick(controlPlayer.playerNumber, directoryPlayer.playerNumber),
      playerName: pick(controlPlayer.playerName, directoryPlayer.playerName),
      stats: controlPlayer.stats || directoryPlayer.stats,
    };
  }

  function rebuildDirectory(rawDirectory = directory) {
    const world = Array.isArray(rawDirectory) ? rawDirectory : [];
    const sessionPlayers = Array.isArray(control?.players) ? control.players : [];
    const worldById = new Map();
    const worldByName = new Map();

    world.forEach((player) => {
      const id = playerId(player);
      if (id) worldById.set(id, player);
      worldByName.set(playerName(player).toLowerCase(), player);
    });

    const merged = [];
    const seen = new Set();
    sessionPlayers.forEach((sessionPlayer) => {
      const id = playerId(sessionPlayer);
      const match = (id && worldById.get(id)) || worldByName.get(playerName(sessionPlayer).toLowerCase());
      const player = mergePlayers(sessionPlayer, match);
      const key = keyFor(player);
      if (!seen.has(key)) {
        merged.push(player);
        seen.add(key);
      }
    });

    world.forEach((player) => {
      const key = keyFor(player);
      if (!seen.has(key)) {
        merged.push(player);
        seen.add(key);
      }
    });

    directory = merged;
  }

  function sessionPool() {
    const sessionPlayers = Array.isArray(control?.players) ? control.players : [];
    if (sessionPlayers.length) {
      const allowed = new Set(sessionPlayers.map(keyFor));
      return directory.filter((player) => allowed.has(keyFor(player)));
    }
    return directory;
  }

  function findPlayer(idOrKey) {
    return directory.find((player) => keyFor(player) === idOrKey || String(playerId(player) || '') === String(idOrKey || '')) || null;
  }

  function hydrateLineups() {
    if (hydratedFromSession) return;
    const players = Array.isArray(control?.players) ? control.players : [];
    west = players.filter((player) => player.checkedIn && String(player.team || '').toLowerCase() === 'west').map(keyFor);
    east = players.filter((player) => player.checkedIn && String(player.team || '').toLowerCase() === 'east').map(keyFor);
    hydratedFromSession = true;
  }

  async function refreshData({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    if (!quiet) {
      notice = '';
      render();
    }
    try {
      const [controlResult, directoryResult] = await Promise.allSettled([
        adminControl(),
        community('players'),
      ]);

      if (controlResult.status === 'fulfilled') {
        const next = controlResult.value || { session: null, players: [] };
        const signature = JSON.stringify(next);
        control = next;
        lastControlSignature = signature;
      } else if (!quiet) {
        throw controlResult.reason;
      }

      if (directoryResult.status === 'fulfilled') {
        rebuildDirectory(Array.isArray(directoryResult.value?.players) ? directoryResult.value.players : []);
      } else {
        rebuildDirectory(directory);
      }

      hydrateLineups();
    } catch (error) {
      notice = error?.message || 'Could not load Stats Viewer.';
    } finally {
      loading = false;
      render();
    }
  }

  function installStyles() {
    if (document.querySelector('[data-rp-commentary-stats-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCommentaryStatsStyles = '1';
    style.textContent = `
      .rp-admin-control.rp-commentary-mounted>.rp-admin-shell{display:none!important}
      .rp-admin-control.rp-commentary-mounted{background:#02060b!important;overflow:hidden!important}
      .rp-commentary-viewer{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;overflow:hidden;color:#f4f9ff;background:radial-gradient(circle at 50% -15%,rgba(22,217,244,.13),transparent 34%),linear-gradient(180deg,#030910 0%,#02060b 54%,#010409 100%);font-family:var(--rp-body,Inter,Arial,sans-serif)}
      .rp-cv-topbar{height:78px;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 clamp(18px,4vw,52px);border-bottom:1px solid rgba(111,169,199,.16);background:rgba(2,7,12,.86);backdrop-filter:blur(18px)}
      .rp-cv-brand small{display:block;margin-bottom:6px;color:#31dbf8;font-size:.55rem;font-weight:950;letter-spacing:.16em}.rp-cv-brand strong{display:block;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(1.05rem,2.2vw,1.35rem);font-style:italic;font-weight:950;letter-spacing:.03em}.rp-cv-exit{min-width:58px;height:42px;border:1px solid rgba(122,171,202,.24);border-radius:13px;background:#071321;color:#ddecf6;font-size:.6rem;font-weight:950;letter-spacing:.1em;cursor:pointer}.rp-cv-exit:hover{border-color:rgba(49,219,248,.55);color:#fff}
      .rp-cv-body{min-height:0;flex:1;overflow:auto;padding:clamp(18px,3vw,34px) clamp(16px,4vw,52px) 42px}.rp-cv-body::-webkit-scrollbar{width:8px}.rp-cv-body::-webkit-scrollbar-thumb{background:#132838;border-radius:20px}
      .rp-cv-idle{min-height:calc(100dvh - 155px);display:grid;place-items:center}.rp-cv-idle-card{width:min(620px,100%);padding:clamp(34px,6vw,70px) clamp(24px,6vw,62px);border:1px solid rgba(77,198,231,.18);border-radius:30px;background:linear-gradient(160deg,rgba(7,22,33,.9),rgba(3,9,15,.82));box-shadow:0 30px 90px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.035);text-align:center;position:relative;overflow:hidden}.rp-cv-idle-card:before{content:'';position:absolute;inset:-1px;pointer-events:none;background:radial-gradient(circle at 50% 0,rgba(49,219,248,.14),transparent 48%)}
      .rp-cv-badge{position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(49,219,248,.24);border-radius:999px;color:#55e8ff;background:rgba(12,51,63,.32);font-size:.5rem;font-weight:950;letter-spacing:.15em}.rp-cv-badge:before{content:'';width:6px;height:6px;border-radius:50%;background:#41e5ff;box-shadow:0 0 15px #41e5ff}.rp-cv-idle-card h1{position:relative;margin:22px 0 10px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(2.4rem,7vw,5rem);font-style:italic;line-height:.9;letter-spacing:.01em}.rp-cv-idle-card p{position:relative;max-width:430px;margin:0 auto;color:#8198aa;font-size:.8rem;line-height:1.65}.rp-cv-primary{position:relative;min-height:58px;padding:0 24px;border:0;border-radius:17px;background:linear-gradient(135deg,#21e0fa,#0db9e5);color:#001118;box-shadow:0 18px 42px rgba(19,199,235,.18);font-size:.68rem;font-weight:1000;letter-spacing:.14em;cursor:pointer}.rp-cv-idle-card .rp-cv-primary{width:min(330px,100%);margin-top:30px}.rp-cv-primary:hover{filter:brightness(1.08);transform:translateY(-1px)}.rp-cv-primary:disabled{opacity:.38;cursor:not-allowed;transform:none}
      .rp-cv-head{max-width:1180px;margin:0 auto 22px}.rp-cv-eyebrow{color:#33daf7;font-size:.56rem;font-weight:950;letter-spacing:.16em}.rp-cv-head h1{margin:7px 0 4px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(2rem,5vw,3.35rem);font-style:italic;line-height:.95;letter-spacing:.01em}.rp-cv-head p{margin:0;color:#70899b;font-size:.7rem;font-weight:700;letter-spacing:.02em}
      .rp-cv-sides{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:14px}.rp-cv-side{min-height:360px;padding:18px;border:1px solid rgba(104,163,194,.14);border-radius:22px;background:rgba(4,12,20,.8)}.rp-cv-side-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 14px;border-bottom:1px solid rgba(109,165,193,.12)}.rp-cv-side-head strong{font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.25rem;font-style:italic;letter-spacing:.04em}.rp-cv-side-head span{color:#617d91;font-size:.52rem;font-weight:900;letter-spacing:.1em}.rp-cv-player-stack{display:grid;gap:8px;padding-top:13px}.rp-cv-lineup-player{min-height:62px;display:grid;grid-template-columns:47px minmax(0,1fr) auto;align-items:center;gap:10px;padding:7px 9px;border:1px solid rgba(111,166,195,.13);border-radius:15px;background:#06101a}.rp-cv-player-no{display:grid;place-items:center;height:45px;border-radius:12px;background:#0a1a28;color:#53e6ff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.84rem}.rp-cv-player-copy{min-width:0}.rp-cv-player-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.74rem;font-weight:950;text-transform:uppercase}.rp-cv-player-copy span{display:block;margin-top:4px;color:#617c90;font-size:.48rem;font-weight:850;letter-spacing:.06em}.rp-cv-remove{width:32px;height:32px;border:1px solid rgba(117,164,190,.17);border-radius:10px;background:#07131e;color:#7790a3;font-size:.9rem;cursor:pointer}.rp-cv-add{width:100%;min-height:54px;margin-top:9px;border:1px dashed rgba(49,219,248,.28);border-radius:15px;background:rgba(7,28,38,.45);color:#50e3fb;font-size:.58rem;font-weight:950;letter-spacing:.12em;cursor:pointer}.rp-cv-empty{padding:34px 14px;color:#536b7d;text-align:center;font-size:.6rem;font-weight:800;letter-spacing:.05em}
      .rp-cv-setup-foot{max-width:1180px;margin:16px auto 0;display:flex;justify-content:center}.rp-cv-setup-foot .rp-cv-primary{width:min(390px,100%)}.rp-cv-notice{max-width:1180px;margin:0 auto 14px;padding:11px 14px;border:1px solid rgba(255,117,117,.2);border-radius:12px;color:#ffadb5;background:rgba(68,12,20,.32);font-size:.61rem;font-weight:800;text-align:center}
      .rp-cv-picker{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:rgba(0,4,8,.78);backdrop-filter:blur(12px)}.rp-cv-picker-card{width:min(560px,100%);max-height:min(720px,86dvh);display:flex;flex-direction:column;border:1px solid rgba(88,188,217,.2);border-radius:24px;background:#050d15;box-shadow:0 30px 100px rgba(0,0,0,.65);overflow:hidden}.rp-cv-picker-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px;border-bottom:1px solid rgba(103,160,189,.13)}.rp-cv-picker-head div small{display:block;color:#34daf7;font-size:.48rem;font-weight:950;letter-spacing:.14em}.rp-cv-picker-head div strong{display:block;margin-top:4px;font-size:.86rem;font-weight:950}.rp-cv-picker-close{width:38px;height:38px;border:1px solid rgba(122,171,202,.2);border-radius:12px;background:#091522;color:#d7e5ef;font-size:1rem;cursor:pointer}.rp-cv-search{margin:14px 14px 6px;width:calc(100% - 28px);height:48px;box-sizing:border-box;border:1px solid rgba(109,166,195,.18);border-radius:13px;outline:0;background:#030910;color:#fff;padding:0 14px;font:800 .72rem var(--rp-body,Arial,sans-serif)}.rp-cv-search:focus{border-color:rgba(49,219,248,.55)}.rp-cv-picker-list{min-height:0;overflow:auto;display:grid;gap:7px;padding:8px 14px 16px}.rp-cv-pick-player{min-height:58px;display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid rgba(107,164,193,.13);border-radius:14px;background:#07111b;color:#eef7fd;text-align:left;padding:7px 10px;cursor:pointer}.rp-cv-pick-player:hover{border-color:rgba(49,219,248,.35)}.rp-cv-pick-player b{display:grid;place-items:center;height:40px;border-radius:10px;background:#0b1b29;color:#49dff7;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif)}.rp-cv-pick-player strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.69rem}.rp-cv-pick-player span{color:#5f7a8e;font-size:.5rem;font-weight:900}
      .rp-cv-live{max-width:1460px;margin:0 auto;display:grid;grid-template-columns:minmax(185px,245px) minmax(0,1fr) minmax(185px,245px);gap:14px;align-items:start}.rp-cv-live-side{position:sticky;top:0;padding:13px;border:1px solid rgba(104,163,194,.13);border-radius:19px;background:rgba(4,12,20,.82)}.rp-cv-live-side header{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 11px}.rp-cv-live-side header strong{font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1rem;font-style:italic}.rp-cv-live-side header span{color:#5d788c;font-size:.46rem;font-weight:900;letter-spacing:.09em}.rp-cv-live-player{width:100%;min-height:58px;display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:8px;margin-top:7px;padding:6px 8px;border:1px solid rgba(110,165,194,.12);border-radius:13px;background:#06101a;color:#ecf6fc;text-align:left;cursor:pointer}.rp-cv-live-player.active{border-color:rgba(49,219,248,.48);background:linear-gradient(135deg,rgba(10,43,56,.9),rgba(5,18,28,.96));box-shadow:0 0 0 1px rgba(49,219,248,.05)}.rp-cv-live-player .no{display:grid;place-items:center;height:38px;border-radius:10px;background:#0a1a28;color:#4ee1f9;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.7rem}.rp-cv-live-player .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.62rem;font-weight:950;text-transform:uppercase}.rp-cv-live-player .ovr{color:#8fa5b5;font-size:.52rem;font-weight:900}.rp-cv-edit-lineup{width:100%;min-height:42px;margin-top:10px;border:1px solid rgba(106,165,193,.14);border-radius:12px;background:#07131e;color:#7791a4;font-size:.5rem;font-weight:950;letter-spacing:.1em;cursor:pointer}
      .rp-cv-player-focus{min-width:0;border:1px solid rgba(101,169,197,.14);border-radius:24px;background:linear-gradient(160deg,rgba(6,18,28,.96),rgba(3,9,15,.96));overflow:hidden}.rp-cv-focus-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;padding:clamp(18px,3vw,28px);border-bottom:1px solid rgba(107,166,194,.13);background:radial-gradient(circle at 82% 0,rgba(49,219,248,.12),transparent 44%)}.rp-cv-focus-number{min-width:78px;height:78px;display:grid;place-items:center;border:1px solid rgba(49,219,248,.22);border-radius:22px;background:#071724;color:#4ce2fa;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.55rem}.rp-cv-focus-name{min-width:0}.rp-cv-focus-name small{display:block;color:#37d9f6;font-size:.48rem;font-weight:950;letter-spacing:.13em}.rp-cv-focus-name h2{overflow:hidden;text-overflow:ellipsis;margin:5px 0 0;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(1.45rem,4vw,2.7rem);font-style:italic;line-height:1;white-space:nowrap}.rp-cv-focus-rating{display:grid;grid-template-columns:repeat(2,minmax(68px,1fr));gap:7px}.rp-cv-focus-rating div{min-width:68px;padding:11px;border:1px solid rgba(103,164,194,.13);border-radius:13px;background:#06111b;text-align:center}.rp-cv-focus-rating span{display:block;color:#688397;font-size:.42rem;font-weight:900;letter-spacing:.1em}.rp-cv-focus-rating strong{display:block;margin-top:4px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.15rem}.rp-cv-section{padding:18px clamp(16px,3vw,26px);border-bottom:1px solid rgba(107,166,194,.1)}.rp-cv-section:last-child{border-bottom:0}.rp-cv-section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.rp-cv-section-title strong{font-size:.6rem;font-weight:950;letter-spacing:.13em}.rp-cv-section-title span{color:#557083;font-size:.45rem;font-weight:850;letter-spacing:.08em}.rp-cv-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.rp-cv-stat{padding:13px 10px;border:1px solid rgba(103,163,192,.11);border-radius:14px;background:#050e17;text-align:center}.rp-cv-stat strong{display:block;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.2rem}.rp-cv-stat span{display:block;margin-top:4px;color:#667f91;font-size:.43rem;font-weight:950;letter-spacing:.1em}.rp-cv-last-game{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid rgba(101,163,192,.11);border-radius:15px;background:#050e17}.rp-cv-last-game strong{display:block;font-size:.68rem;font-weight:950}.rp-cv-last-game small{display:block;margin-top:5px;color:#617d91;font-size:.48rem;font-weight:800}.rp-cv-last-game b{color:#54e5fc;font-size:.64rem;white-space:nowrap}.rp-cv-loading{padding:52px 16px;color:#6d8799;text-align:center;font-size:.62rem;font-weight:900;letter-spacing:.1em}.rp-cv-readonly{padding:11px 15px;color:#547083;text-align:center;font-size:.47rem;font-weight:800;letter-spacing:.06em}
      @media(max-width:900px){.rp-cv-live{grid-template-columns:1fr 1fr}.rp-cv-player-focus{grid-column:1/-1;grid-row:2}.rp-cv-live-side{position:static}.rp-cv-focus-hero{grid-template-columns:auto minmax(0,1fr)}.rp-cv-focus-rating{grid-column:1/-1}}
      @media(max-width:640px){.rp-cv-topbar{height:66px;padding:0 14px}.rp-cv-body{padding:16px 12px 30px}.rp-cv-sides{grid-template-columns:1fr;gap:10px}.rp-cv-side{min-height:0;padding:13px}.rp-cv-focus-hero{grid-template-columns:62px minmax(0,1fr);gap:10px;padding:15px}.rp-cv-focus-number{min-width:62px;height:62px;border-radius:17px;font-size:1.15rem}.rp-cv-focus-rating{grid-template-columns:1fr 1fr}.rp-cv-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-cv-live{gap:9px}.rp-cv-live-side{padding:9px}.rp-cv-live-player{grid-template-columns:34px minmax(0,1fr);min-height:53px;padding:5px}.rp-cv-live-player .no{height:33px}.rp-cv-live-player .ovr{grid-column:2}.rp-cv-edit-lineup{min-height:38px}.rp-cv-last-game{grid-template-columns:1fr}.rp-cv-idle{min-height:calc(100dvh - 120px)}.rp-cv-idle-card{border-radius:23px}}
    `;
    document.head.appendChild(style);
  }

  function currentProfile(player) {
    const key = keyFor(player);
    return profileCache.get(key) || player || {};
  }

  function statsFor(player) {
    const profile = currentProfile(player);
    return profile?.careerStats || profile?.career?.stats || profile?.career || player?.careerStats || {};
  }

  function average(explicit, total, games) {
    const raw = finite(explicit);
    if (raw !== null) return raw.toFixed(1);
    const t = finite(total);
    const g = finite(games);
    return t !== null && g && g > 0 ? (t / g).toFixed(1) : '—';
  }

  function pct(value) {
    const n = finite(value);
    if (n === null) return '—';
    const normalized = n <= 1 ? n * 100 : n;
    return `${Math.round(normalized)}%`;
  }

  function displayMetric(value, digits = 0) {
    const n = finite(value);
    if (n === null) return '—';
    return digits ? n.toFixed(digits) : String(Math.round(n));
  }

  function playerMetrics(player) {
    const profile = currentProfile(player);
    const stats = statsFor(player);
    const games = finite(pick(stats.games, stats.gamesPlayed, profile.games, profile.gamesPlayed));
    const wins = finite(pick(stats.wins, profile.wins, profile.record?.wins));
    const losses = finite(pick(stats.losses, profile.losses, profile.record?.losses));
    return {
      profile,
      stats,
      games,
      wins,
      losses,
      ovr: finite(pick(profile.ovr, player.ovr, stats.ovr)),
      rank: finite(pick(profile.rank, player.rank)),
      ppg: average(pick(stats.ppg, stats.pointsPerGame), pick(stats.pts, stats.points), games),
      apg: average(pick(stats.apg, stats.assistsPerGame), pick(stats.ast, stats.assists), games),
      rpg: average(pick(stats.rpg, stats.reboundsPerGame), pick(stats.reb, stats.rebounds), games),
      spg: average(pick(stats.spg, stats.stealsPerGame), pick(stats.stl, stats.steals), games),
      bpg: average(pick(stats.bpg, stats.blocksPerGame), pick(stats.blk, stats.blocks), games),
      topg: average(pick(stats.topg, stats.tovPerGame, stats.turnoversPerGame), pick(stats.tov, stats.to, stats.turnovers), games),
      shooting: pct(pick(stats.shootingPct, stats.shootingPercentage, stats.fgPct, stats.fieldGoalPercentage)),
      onePct: pct(pick(stats.onePointPct, stats.one_point_pct, stats.onePtPct)),
      twoPct: pct(pick(stats.twoPointPct, stats.two_point_pct, stats.twoPtPct)),
    };
  }

  function sessionStatusText() {
    const session = control?.session;
    if (!session) return 'NO ACTIVE SESSION';
    if (session.gameStatus === 'live') return 'LIVE GAME';
    if (session.gameStatus === 'final') return 'FINAL';
    return 'READY';
  }

  function lineupPlayerHtml(key, side, removable = true) {
    const player = findPlayer(key);
    if (!player) return '';
    const metrics = playerMetrics(player);
    return `
      <article class="rp-cv-lineup-player">
        <div class="rp-cv-player-no">${jersey(player) === null ? '#—' : `#${esc(jersey(player))}`}</div>
        <div class="rp-cv-player-copy"><strong>${esc(playerName(player))}</strong><span>${metrics.ovr === null ? 'UNRANKED' : `${metrics.ovr} OVR`}</span></div>
        ${removable ? `<button type="button" class="rp-cv-remove" data-cv-remove="${esc(key)}" data-side="${side}" aria-label="Remove ${esc(playerName(player))}">×</button>` : ''}
      </article>`;
  }

  function renderIdle() {
    return `
      <main class="rp-cv-body">
        <section class="rp-cv-idle">
          <div class="rp-cv-idle-card">
            <span class="rp-cv-badge">BROADCAST DESK</span>
            <h1>STATS VIEWER</h1>
            <p>Your courtside reference for player numbers, current-game stats, career records and recent Real Play history.</p>
            <button type="button" class="rp-cv-primary" data-cv-start>START COMMENTARY</button>
          </div>
        </section>
      </main>`;
  }

  function renderSetupSide(side, keys) {
    return `
      <section class="rp-cv-side">
        <div class="rp-cv-side-head"><strong>${side.toUpperCase()}</strong><span>${keys.length} PLAYER${keys.length === 1 ? '' : 'S'}</span></div>
        <div class="rp-cv-player-stack">
          ${keys.length ? keys.map((key) => lineupPlayerHtml(key, side)).join('') : '<div class="rp-cv-empty">NO PLAYER SELECTED</div>'}
        </div>
        <button type="button" class="rp-cv-add" data-cv-add="${side}">+ ADD PLAYER</button>
      </section>`;
  }

  function renderSetup() {
    const canStart = west.length > 0 && east.length > 0;
    return `
      <main class="rp-cv-body">
        <header class="rp-cv-head"><span class="rp-cv-eyebrow">COMMENTARY SETUP</span><h1>WHO'S PLAYING?</h1><p>Choose the players on West and East. This viewer does not change the official game roster.</p></header>
        ${notice ? `<div class="rp-cv-notice">${esc(notice)}</div>` : ''}
        <div class="rp-cv-sides">${renderSetupSide('west', west)}${renderSetupSide('east', east)}</div>
        <div class="rp-cv-setup-foot"><button type="button" class="rp-cv-primary" data-cv-begin ${canStart ? '' : 'disabled'}>START COMMENTARY</button></div>
        ${renderPicker()}
      </main>`;
  }

  function pickerCandidates() {
    const assigned = new Set([...west, ...east]);
    const q = pickerQuery.trim().toLowerCase();
    return sessionPool().filter((player) => {
      const key = keyFor(player);
      if (assigned.has(key)) return false;
      if (!q) return true;
      return playerName(player).toLowerCase().includes(q) || String(jersey(player) ?? '').includes(q);
    });
  }

  function renderPicker() {
    if (!pickerSide) return '';
    const candidates = pickerCandidates();
    return `
      <div class="rp-cv-picker" data-cv-picker>
        <section class="rp-cv-picker-card" role="dialog" aria-modal="true" aria-label="Choose ${pickerSide} player">
          <header class="rp-cv-picker-head"><div><small>WHO'S PLAYING?</small><strong>ADD TO ${pickerSide.toUpperCase()}</strong></div><button type="button" class="rp-cv-picker-close" data-cv-picker-close aria-label="Close">×</button></header>
          <input class="rp-cv-search" data-cv-search value="${esc(pickerQuery)}" placeholder="Search player or jersey #" autocomplete="off">
          <div class="rp-cv-picker-list">
            ${candidates.length ? candidates.map((player) => {
              const metrics = playerMetrics(player);
              return `<button type="button" class="rp-cv-pick-player" data-cv-pick="${esc(keyFor(player))}"><b>${jersey(player) === null ? '#—' : `#${esc(jersey(player))}`}</b><strong>${esc(playerName(player))}</strong><span>${metrics.ovr === null ? 'UNRANKED' : `${metrics.ovr} OVR`}</span></button>`;
            }).join('') : '<div class="rp-cv-empty">NO AVAILABLE PLAYERS</div>'}
          </div>
        </section>
      </div>`;
  }

  function livePlayerButton(key, side) {
    const player = findPlayer(key);
    if (!player) return '';
    const metrics = playerMetrics(player);
    return `<button type="button" class="rp-cv-live-player${key === selectedId ? ' active' : ''}" data-cv-select="${esc(key)}"><span class="no">${jersey(player) === null ? '#—' : `#${esc(jersey(player))}`}</span><span class="nm">${esc(playerName(player))}</span><span class="ovr">${metrics.ovr === null ? '— OVR' : `${metrics.ovr} OVR`}</span></button>`;
  }

  function liveSide(side, keys) {
    return `
      <aside class="rp-cv-live-side">
        <header><strong>${side.toUpperCase()}</strong><span>${keys.length} PLAYER${keys.length === 1 ? '' : 'S'}</span></header>
        ${keys.map((key) => livePlayerButton(key, side)).join('')}
        <button type="button" class="rp-cv-edit-lineup" data-cv-edit-lineup>EDIT LINEUP</button>
      </aside>`;
  }

  function currentGameStats(player) {
    const stats = player?.stats || {};
    return {
      pts: displayMetric(pick(stats.pts, stats.points)),
      ast: displayMetric(pick(stats.ast, stats.assists)),
      reb: displayMetric(pick(stats.reb, stats.rebounds)),
      tov: displayMetric(pick(stats.tov, stats.to, stats.turnovers)),
    };
  }

  function lastGame(profile) {
    return Array.isArray(profile?.recentGames) && profile.recentGames.length ? profile.recentGames[0] : null;
  }

  function gameLabel(game) {
    if (!game) return 'NO FINALIZED GAME YET';
    return String(pick(game.displayLabel, game.label, Number.isFinite(Number(game.sessionId ?? game.id)) ? `GAME #${String(Number(game.sessionId ?? game.id)).padStart(3, '0')}` : 'OFFICIAL GAME'));
  }

  function renderPlayerFocus() {
    const player = findPlayer(selectedId) || findPlayer(west[0]) || findPlayer(east[0]);
    if (!player) return '<section class="rp-cv-player-focus"><div class="rp-cv-loading">SELECT A PLAYER</div></section>';
    const metrics = playerMetrics(player);
    const current = currentGameStats(player);
    const profile = metrics.profile;
    const recent = lastGame(profile);
    const recentPts = recent ? displayMetric(pick(recent.pts, recent.points)) : '—';
    const recentAst = recent ? displayMetric(pick(recent.ast, recent.assists)) : '—';
    const recentReb = recent ? displayMetric(pick(recent.reb, recent.rebounds)) : '—';
    const recentTov = recent ? displayMetric(pick(recent.tov, recent.to, recent.turnovers)) : '—';
    const record = metrics.wins === null && metrics.losses === null ? '—' : `${metrics.wins ?? 0}-${metrics.losses ?? 0}`;
    const loadingProfile = profileLoading.has(keyFor(player));

    return `
      <section class="rp-cv-player-focus">
        <header class="rp-cv-focus-hero">
          <div class="rp-cv-focus-number">${jersey(profile) ?? jersey(player) ?? '—'}</div>
          <div class="rp-cv-focus-name"><small>REAL PLAY PLAYER</small><h2>${esc(playerName(profile) || playerName(player))}</h2></div>
          <div class="rp-cv-focus-rating"><div><span>OVR</span><strong>${metrics.ovr === null ? '—' : metrics.ovr}</strong></div><div><span>RANK</span><strong>${metrics.rank === null ? '—' : `#${Math.round(metrics.rank)}`}</strong></div></div>
        </header>
        <div class="rp-cv-section">
          <div class="rp-cv-section-title"><strong>CURRENT GAME</strong><span>${esc(sessionStatusText())}</span></div>
          <div class="rp-cv-stat-grid"><div class="rp-cv-stat"><strong>${current.pts}</strong><span>PTS</span></div><div class="rp-cv-stat"><strong>${current.ast}</strong><span>AST</span></div><div class="rp-cv-stat"><strong>${current.reb}</strong><span>REB</span></div><div class="rp-cv-stat"><strong>${current.tov}</strong><span>TO</span></div></div>
        </div>
        <div class="rp-cv-section">
          <div class="rp-cv-section-title"><strong>CAREER SNAPSHOT</strong><span>OFFICIAL GAMES</span></div>
          <div class="rp-cv-stat-grid"><div class="rp-cv-stat"><strong>${metrics.ppg}</strong><span>PPG</span></div><div class="rp-cv-stat"><strong>${metrics.apg}</strong><span>APG</span></div><div class="rp-cv-stat"><strong>${metrics.rpg}</strong><span>RPG</span></div><div class="rp-cv-stat"><strong>${record}</strong><span>W-L</span></div><div class="rp-cv-stat"><strong>${metrics.spg}</strong><span>SPG</span></div><div class="rp-cv-stat"><strong>${metrics.bpg}</strong><span>BPG</span></div><div class="rp-cv-stat"><strong>${metrics.topg}</strong><span>TOPG</span></div><div class="rp-cv-stat"><strong>${metrics.games === null ? '—' : Math.round(metrics.games)}</strong><span>GAMES</span></div></div>
        </div>
        <div class="rp-cv-section">
          <div class="rp-cv-section-title"><strong>SHOOTING</strong><span>VERIFIED DATA WHEN AVAILABLE</span></div>
          <div class="rp-cv-stat-grid"><div class="rp-cv-stat"><strong>${metrics.shooting}</strong><span>SHOOTING %</span></div><div class="rp-cv-stat"><strong>${metrics.onePct}</strong><span>1PT %</span></div><div class="rp-cv-stat"><strong>${metrics.twoPct}</strong><span>2PT %</span></div><div class="rp-cv-stat"><strong>${metrics.ovr === null ? '—' : metrics.ovr}</strong><span>OVR</span></div></div>
        </div>
        <div class="rp-cv-section">
          <div class="rp-cv-section-title"><strong>LAST GAME</strong><span>${loadingProfile ? 'LOADING HISTORY…' : 'QUICK COMMENTARY NOTE'}</span></div>
          <div class="rp-cv-last-game"><div><strong>${esc(gameLabel(recent))}</strong><small>${recent ? `${recentPts} PTS · ${recentAst} AST · ${recentReb} REB · ${recentTov} TO` : 'No finalized game returned for this player yet.'}</small></div><b>${recent ? esc(String(recent.result || 'FINAL').toUpperCase()) : '—'}</b></div>
        </div>
        <div class="rp-cv-readonly">COMMENTARY VIEW ONLY · OFFICIAL STATS REMAIN CONTROLLED BY REAL PLAY GAME RECORDS</div>
      </section>`;
  }

  function renderLive() {
    if (!selectedId) selectedId = west[0] || east[0] || null;
    return `
      <main class="rp-cv-body">
        <header class="rp-cv-head"><span class="rp-cv-eyebrow">${esc(sessionStatusText())} · COMMENTARY DESK</span><h1>${esc(control?.session?.title || 'STATS VIEWER')}</h1><p>Tap any player for a fast courtside profile.</p></header>
        ${notice ? `<div class="rp-cv-notice">${esc(notice)}</div>` : ''}
        <div class="rp-cv-live">${liveSide('west', west)}${renderPlayerFocus()}${liveSide('east', east)}</div>
      </main>`;
  }

  function shellHtml() {
    const content = view === 'setup' ? renderSetup() : view === 'live' ? renderLive() : renderIdle();
    return `
      <header class="rp-cv-topbar">
        <div class="rp-cv-brand"><small>REAL PLAY ADMIN</small><strong>STATS VIEWER</strong></div>
        <button type="button" class="rp-cv-exit" data-cv-exit>EXIT</button>
      </header>
      ${content}`;
  }

  function render() {
    if (!viewer) return;
    viewer.innerHTML = shellHtml();
    bindRenderedEvents();
  }

  function startCommentarySetup() {
    view = 'setup';
    notice = '';
    refreshData();
  }

  function beginCommentary() {
    if (!west.length || !east.length) return;
    view = 'live';
    pickerSide = null;
    pickerQuery = '';
    selectedId = west[0] || east[0] || null;
    render();
    const first = findPlayer(selectedId);
    if (first) loadProfile(first);
  }

  function assignPlayer(key) {
    if (!pickerSide || !findPlayer(key)) return;
    west = west.filter((item) => item !== key);
    east = east.filter((item) => item !== key);
    if (pickerSide === 'west') west.push(key);
    else east.push(key);
    pickerSide = null;
    pickerQuery = '';
    render();
  }

  function removePlayer(key, side) {
    if (side === 'west') west = west.filter((item) => item !== key);
    if (side === 'east') east = east.filter((item) => item !== key);
    if (selectedId === key) selectedId = west[0] || east[0] || null;
    render();
  }

  async function loadProfile(player) {
    const key = keyFor(player);
    const id = playerId(player);
    if (!id || profileCache.has(key) || profileLoading.has(key)) return;
    profileLoading.add(key);
    render();
    try {
      const data = await community('player_profile', { playerId: id });
      if (data?.player) profileCache.set(key, data.player);
    } catch (_error) {
      // The viewer remains useful with directory/current-game data.
    } finally {
      profileLoading.delete(key);
      render();
    }
  }

  function selectPlayer(key) {
    selectedId = key;
    render();
    const player = findPlayer(key);
    if (player) loadProfile(player);
  }

  function exitViewer() {
    view = 'idle';
    pickerSide = null;
    pickerQuery = '';
    selectedId = null;
    notice = '';
    stopPolling();
    render();
    const legacyExit = adminRoot?.querySelector(':scope>.rp-admin-shell [data-admin-exit]');
    if (legacyExit) legacyExit.click();
    else {
      adminRoot?.classList.remove('open');
      adminRoot?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-admin-open');
    }
  }

  function bindRenderedEvents() {
    viewer.querySelector('[data-cv-exit]')?.addEventListener('click', exitViewer);
    viewer.querySelector('[data-cv-start]')?.addEventListener('click', startCommentarySetup);
    viewer.querySelector('[data-cv-begin]')?.addEventListener('click', beginCommentary);
    viewer.querySelectorAll('[data-cv-add]').forEach((button) => button.addEventListener('click', () => {
      pickerSide = button.dataset.cvAdd;
      pickerQuery = '';
      render();
      window.requestAnimationFrame(() => viewer.querySelector('[data-cv-search]')?.focus());
    }));
    viewer.querySelectorAll('[data-cv-remove]').forEach((button) => button.addEventListener('click', () => removePlayer(button.dataset.cvRemove, button.dataset.side)));
    viewer.querySelector('[data-cv-picker-close]')?.addEventListener('click', () => { pickerSide = null; pickerQuery = ''; render(); });
    viewer.querySelector('[data-cv-picker]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) { pickerSide = null; pickerQuery = ''; render(); }
    });
    viewer.querySelector('[data-cv-search]')?.addEventListener('input', (event) => {
      pickerQuery = event.currentTarget.value;
      const value = pickerQuery;
      render();
      const input = viewer.querySelector('[data-cv-search]');
      if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
    });
    viewer.querySelectorAll('[data-cv-pick]').forEach((button) => button.addEventListener('click', () => assignPlayer(button.dataset.cvPick)));
    viewer.querySelectorAll('[data-cv-select]').forEach((button) => button.addEventListener('click', () => selectPlayer(button.dataset.cvSelect)));
    viewer.querySelectorAll('[data-cv-edit-lineup]').forEach((button) => button.addEventListener('click', () => { view = 'setup'; render(); }));
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(async () => {
      if (!adminRoot?.classList.contains('open') || view === 'idle' || loading) return;
      try {
        const next = await adminControl();
        const signature = JSON.stringify(next);
        if (signature === lastControlSignature) return;
        control = next;
        lastControlSignature = signature;
        rebuildDirectory(directory);
        render();
      } catch (_error) {}
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function onOpenChanged() {
    if (!adminRoot) return;
    if (adminRoot.classList.contains('open')) {
      startPolling();
      if (view !== 'idle') refreshData({ quiet: true });
    } else {
      stopPolling();
    }
  }

  function mount(root) {
    if (!root || root.classList.contains('rp-commentary-mounted')) return;
    adminRoot = root;
    installStyles();
    viewer = document.createElement('section');
    viewer.className = 'rp-commentary-viewer';
    viewer.setAttribute('aria-label', 'Real Play commentator stats viewer');
    root.appendChild(viewer);
    root.classList.add('rp-commentary-mounted');
    render();

    const observer = new MutationObserver(onOpenChanged);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    onOpenChanged();
  }

  function boot() {
    const root = document.querySelector('.rp-admin-control');
    if (root) {
      mount(root);
      return;
    }
    const observer = new MutationObserver(() => {
      const found = document.querySelector('.rp-admin-control');
      if (!found) return;
      observer.disconnect();
      mount(found);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('realplay:admin-render', () => {
    if (!adminRoot) return;
    if (adminRoot.classList.contains('open') && view !== 'idle') refreshData({ quiet: true });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !adminRoot?.classList.contains('open')) return;
    if (pickerSide) {
      pickerSide = null;
      pickerQuery = '';
      render();
      return;
    }
    exitViewer();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
