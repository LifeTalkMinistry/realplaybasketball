(() => {
  if (window.__realPlayCommentaryStatsViewerV2Installed) return;
  window.__realPlayCommentaryStatsViewerV2Installed = true;

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
  let selectedKey = null;
  let pickerSide = null;
  let pickerQuery = '';
  let loading = false;
  let notice = '';
  let pollTimer = null;
  let lastControlSignature = '';
  let hydratedFromSession = false;
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
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function playerId(player) {
    const raw = pick(player?.playerId, player?.player_id, player?.userId, player?.user_id, player?.id);
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function playerName(player) {
    return String(pick(player?.playerName, player?.player_name, player?.name, 'REAL PLAY PLAYER')).trim();
  }

  function jersey(player) {
    const value = pick(player?.playerNumber, player?.player_number, player?.jerseyNumber, player?.jersey_number);
    const number = finite(value);
    return number === null ? null : Math.trunc(number);
  }

  function playerKey(player) {
    const id = playerId(player);
    return id ? `id:${id}` : `name:${playerName(player).toLowerCase()}`;
  }

  function findPlayer(key) {
    return directory.find((player) => playerKey(player) === key || String(playerId(player) || '') === String(key || '')) || null;
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
    const byId = new Map();
    const byName = new Map();
    world.forEach((player) => {
      const id = playerId(player);
      if (id) byId.set(id, player);
      byName.set(playerName(player).toLowerCase(), player);
    });

    const merged = [];
    const seen = new Set();
    sessionPlayers.forEach((sessionPlayer) => {
      const id = playerId(sessionPlayer);
      const match = (id && byId.get(id)) || byName.get(playerName(sessionPlayer).toLowerCase());
      const player = mergePlayers(sessionPlayer, match);
      const key = playerKey(player);
      if (!seen.has(key)) {
        merged.push(player);
        seen.add(key);
      }
    });
    world.forEach((player) => {
      const key = playerKey(player);
      if (!seen.has(key)) {
        merged.push(player);
        seen.add(key);
      }
    });
    directory = merged;
  }

  function sessionPool() {
    const sessionPlayers = Array.isArray(control?.players) ? control.players : [];
    if (!sessionPlayers.length) return directory;
    const allowed = new Set(sessionPlayers.map(playerKey));
    return directory.filter((player) => allowed.has(playerKey(player)));
  }

  function hydrateLineups() {
    if (hydratedFromSession) return;
    const players = Array.isArray(control?.players) ? control.players : [];
    west = players
      .filter((player) => player.checkedIn && String(player.team || '').toLowerCase() === 'west')
      .map(playerKey);
    east = players
      .filter((player) => player.checkedIn && String(player.team || '').toLowerCase() === 'east')
      .map(playerKey);
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
      const [controlResult, playersResult] = await Promise.allSettled([
        adminControl(),
        community('players'),
      ]);

      if (controlResult.status === 'fulfilled') {
        control = controlResult.value || { session: null, players: [] };
        lastControlSignature = JSON.stringify(control);
      } else if (!quiet) {
        throw controlResult.reason;
      }

      if (playersResult.status === 'fulfilled') {
        rebuildDirectory(Array.isArray(playersResult.value?.players) ? playersResult.value.players : []);
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
    if (document.querySelector('[data-rp-commentary-v2-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCommentaryV2Styles = '1';
    style.textContent = `
      .rp-admin-control.rp-commentary-open>.rp-admin-shell{display:none!important}
      .rp-admin-control.rp-commentary-open{overflow:hidden!important;background:#02060b!important}
      .rp-commentary-viewer-v2[hidden]{display:none!important}
      .rp-commentary-viewer-v2{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;overflow:hidden;color:#f4f9ff;background:radial-gradient(circle at 50% -15%,rgba(22,217,244,.13),transparent 34%),linear-gradient(180deg,#030910 0%,#02060b 54%,#010409 100%);font-family:var(--rp-body,Inter,Arial,sans-serif)}
      .rp-cv-entry{border-color:rgba(49,219,248,.22)!important;color:#78eaff!important}.rp-cv-entry.active{color:#fff!important;border-color:rgba(62,229,255,.5)!important;background:rgba(25,115,255,.2)!important}
      .rp-cv2-topbar{height:72px;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 clamp(16px,4vw,42px);border-bottom:1px solid rgba(111,169,199,.16);background:rgba(2,7,12,.9);backdrop-filter:blur(18px)}
      .rp-cv2-brand small{display:block;margin-bottom:5px;color:#31dbf8;font-size:.52rem;font-weight:950;letter-spacing:.16em}.rp-cv2-brand strong{display:block;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.15rem;font-style:italic;font-weight:950;letter-spacing:.04em}.rp-cv2-exit{min-width:58px;height:42px;border:1px solid rgba(122,171,202,.24);border-radius:13px;background:#071321;color:#ddecf6;font-size:.6rem;font-weight:950;letter-spacing:.1em;cursor:pointer}
      .rp-cv2-body{min-height:0;flex:1;overflow:auto;padding:clamp(16px,3vw,30px) clamp(12px,4vw,44px) 36px}.rp-cv2-body::-webkit-scrollbar{width:7px}.rp-cv2-body::-webkit-scrollbar-thumb{background:#132838;border-radius:20px}
      .rp-cv2-idle{min-height:calc(100dvh - 132px);display:grid;place-items:center}.rp-cv2-idle-card{position:relative;width:min(600px,100%);box-sizing:border-box;padding:clamp(36px,6vw,68px) clamp(22px,6vw,58px);overflow:hidden;border:1px solid rgba(77,198,231,.18);border-radius:28px;background:linear-gradient(160deg,rgba(7,22,33,.92),rgba(3,9,15,.86));box-shadow:0 30px 90px rgba(0,0,0,.45);text-align:center}.rp-cv2-idle-card:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0,rgba(49,219,248,.14),transparent 50%);pointer-events:none}.rp-cv2-badge{position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(49,219,248,.24);border-radius:999px;color:#55e8ff;background:rgba(12,51,63,.32);font-size:.5rem;font-weight:950;letter-spacing:.15em}.rp-cv2-badge:before{content:'';width:6px;height:6px;border-radius:50%;background:#41e5ff;box-shadow:0 0 15px #41e5ff}.rp-cv2-idle-card h1{position:relative;margin:22px 0 10px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(2.35rem,7vw,4.8rem);font-style:italic;line-height:.92}.rp-cv2-idle-card p{position:relative;max-width:430px;margin:0 auto;color:#8198aa;font-size:.79rem;line-height:1.65}
      .rp-cv2-primary{position:relative;min-height:56px;padding:0 24px;border:0;border-radius:16px;background:linear-gradient(135deg,#21e0fa,#0db9e5);color:#001118;box-shadow:0 18px 42px rgba(19,199,235,.18);font-size:.67rem;font-weight:1000;letter-spacing:.14em;cursor:pointer}.rp-cv2-idle-card .rp-cv2-primary{width:min(330px,100%);margin-top:30px}.rp-cv2-primary:disabled{opacity:.38;cursor:not-allowed}
      .rp-cv2-head{max-width:1180px;margin:0 auto 20px}.rp-cv2-eyebrow{color:#33daf7;font-size:.54rem;font-weight:950;letter-spacing:.16em}.rp-cv2-head h1{margin:7px 0 5px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(2rem,5vw,3.2rem);font-style:italic;line-height:.95}.rp-cv2-head p{margin:0;color:#70899b;font-size:.69rem;font-weight:700}
      .rp-cv2-notice{max-width:1180px;margin:0 auto 12px;padding:11px 14px;border:1px solid rgba(255,117,117,.2);border-radius:12px;color:#ffadb5;background:rgba(68,12,20,.32);font-size:.61rem;font-weight:800;text-align:center}
      .rp-cv2-sides{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:14px}.rp-cv2-side{min-height:300px;padding:17px;border:1px solid rgba(104,163,194,.14);border-radius:22px;background:rgba(4,12,20,.82)}.rp-cv2-side-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 13px;border-bottom:1px solid rgba(109,165,193,.12)}.rp-cv2-side-head strong{font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.2rem;font-style:italic}.rp-cv2-side-head span{color:#617d91;font-size:.5rem;font-weight:900;letter-spacing:.1em}.rp-cv2-stack{display:grid;gap:8px;padding-top:12px}.rp-cv2-lineup{min-height:58px;display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 9px;border:1px solid rgba(111,166,195,.13);border-radius:14px;background:#06101a}.rp-cv2-no{display:grid;place-items:center;height:42px;border-radius:11px;background:#0a1a28;color:#53e6ff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.8rem}.rp-cv2-copy{min-width:0}.rp-cv2-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.71rem;font-weight:950;text-transform:uppercase}.rp-cv2-copy span{display:block;margin-top:4px;color:#617c90;font-size:.47rem;font-weight:850}.rp-cv2-remove{width:31px;height:31px;border:1px solid rgba(117,164,190,.17);border-radius:9px;background:#07131e;color:#7790a3;font-size:.9rem;cursor:pointer}.rp-cv2-add{width:100%;min-height:51px;margin-top:9px;border:1px dashed rgba(49,219,248,.28);border-radius:14px;background:rgba(7,28,38,.45);color:#50e3fb;font-size:.56rem;font-weight:950;letter-spacing:.12em;cursor:pointer}.rp-cv2-empty{padding:32px 12px;color:#536b7d;text-align:center;font-size:.58rem;font-weight:800}.rp-cv2-setup-foot{max-width:1180px;margin:15px auto 0;display:flex;justify-content:center}.rp-cv2-setup-foot .rp-cv2-primary{width:min(390px,100%)}
      .rp-cv2-picker{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:18px;background:rgba(0,4,8,.8);backdrop-filter:blur(12px)}.rp-cv2-picker-card{width:min(540px,100%);max-height:min(700px,86dvh);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(88,188,217,.2);border-radius:22px;background:#050d15;box-shadow:0 30px 100px rgba(0,0,0,.65)}.rp-cv2-picker-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px;border-bottom:1px solid rgba(103,160,189,.13)}.rp-cv2-picker-head small{display:block;color:#34daf7;font-size:.47rem;font-weight:950;letter-spacing:.14em}.rp-cv2-picker-head strong{display:block;margin-top:4px;font-size:.82rem;font-weight:950}.rp-cv2-picker-close{width:37px;height:37px;border:1px solid rgba(122,171,202,.2);border-radius:11px;background:#091522;color:#d7e5ef;font-size:1rem}.rp-cv2-search{margin:13px;width:calc(100% - 26px);height:47px;box-sizing:border-box;border:1px solid rgba(109,166,195,.18);border-radius:12px;outline:0;background:#030910;color:#fff;padding:0 13px;font:800 .7rem var(--rp-body,Arial,sans-serif)}.rp-cv2-picker-list{min-height:0;overflow:auto;display:grid;gap:7px;padding:0 13px 15px}.rp-cv2-pick{min-height:56px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 9px;border:1px solid rgba(107,164,193,.13);border-radius:13px;background:#07111b;color:#eef7fd;text-align:left}.rp-cv2-pick b{display:grid;place-items:center;height:39px;border-radius:9px;background:#0b1b29;color:#49dff7;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif)}.rp-cv2-pick strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.67rem}.rp-cv2-pick span{color:#5f7a8e;font-size:.48rem;font-weight:900}
      .rp-cv2-live{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:minmax(175px,235px) minmax(0,1fr) minmax(175px,235px);gap:13px;align-items:start}.rp-cv2-live-side{position:sticky;top:0;padding:12px;border:1px solid rgba(104,163,194,.13);border-radius:18px;background:rgba(4,12,20,.84)}.rp-cv2-live-side header{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 10px}.rp-cv2-live-side header strong{font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.96rem;font-style:italic}.rp-cv2-live-side header span{color:#5d788c;font-size:.45rem;font-weight:900}.rp-cv2-player{width:100%;min-height:55px;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:7px;margin-top:7px;padding:6px 7px;border:1px solid rgba(110,165,194,.12);border-radius:12px;background:#06101a;color:#ecf6fc;text-align:left}.rp-cv2-player.active{border-color:rgba(49,219,248,.48);background:linear-gradient(135deg,rgba(10,43,56,.9),rgba(5,18,28,.96))}.rp-cv2-player .no{display:grid;place-items:center;height:36px;border-radius:9px;background:#0a1a28;color:#4ee1f9;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:.68rem}.rp-cv2-player .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.59rem;font-weight:950;text-transform:uppercase}.rp-cv2-player .ovr{color:#8fa5b5;font-size:.49rem;font-weight:900}.rp-cv2-edit{width:100%;min-height:40px;margin-top:9px;border:1px solid rgba(106,165,193,.14);border-radius:11px;background:#07131e;color:#7791a4;font-size:.48rem;font-weight:950;letter-spacing:.1em}
      .rp-cv2-focus{min-width:0;overflow:hidden;border:1px solid rgba(101,169,197,.14);border-radius:22px;background:linear-gradient(160deg,rgba(6,18,28,.96),rgba(3,9,15,.96))}.rp-cv2-focus-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:clamp(17px,3vw,26px);border-bottom:1px solid rgba(107,166,194,.13);background:radial-gradient(circle at 82% 0,rgba(49,219,248,.12),transparent 44%)}.rp-cv2-focus-no{min-width:72px;height:72px;display:grid;place-items:center;border:1px solid rgba(49,219,248,.22);border-radius:20px;background:#071724;color:#4ce2fa;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.4rem}.rp-cv2-focus-name{min-width:0}.rp-cv2-focus-name small{display:block;color:#37d9f6;font-size:.46rem;font-weight:950;letter-spacing:.13em}.rp-cv2-focus-name h2{overflow:hidden;text-overflow:ellipsis;margin:5px 0 0;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:clamp(1.4rem,4vw,2.5rem);font-style:italic;line-height:1;white-space:nowrap}.rp-cv2-rating{display:grid;grid-template-columns:repeat(2,minmax(64px,1fr));gap:7px}.rp-cv2-rating div{padding:10px;border:1px solid rgba(103,164,194,.13);border-radius:12px;background:#06111b;text-align:center}.rp-cv2-rating span{display:block;color:#688397;font-size:.4rem;font-weight:900;letter-spacing:.1em}.rp-cv2-rating strong{display:block;margin-top:4px;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.08rem}.rp-cv2-section{padding:17px clamp(15px,3vw,24px);border-bottom:1px solid rgba(107,166,194,.1)}.rp-cv2-section:last-child{border-bottom:0}.rp-cv2-section-title{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:11px}.rp-cv2-section-title strong{font-size:.57rem;font-weight:950;letter-spacing:.13em}.rp-cv2-section-title span{color:#557083;font-size:.43rem;font-weight:850}.rp-cv2-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.rp-cv2-stat{padding:12px 8px;border:1px solid rgba(103,163,192,.11);border-radius:13px;background:#050e17;text-align:center}.rp-cv2-stat strong{display:block;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.14rem}.rp-cv2-stat span{display:block;margin-top:4px;color:#667f91;font-size:.41rem;font-weight:950;letter-spacing:.1em}.rp-cv2-last{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px;border:1px solid rgba(101,163,192,.11);border-radius:14px;background:#050e17}.rp-cv2-last strong{display:block;font-size:.65rem;font-weight:950}.rp-cv2-last small{display:block;margin-top:5px;color:#617d91;font-size:.46rem;font-weight:800}.rp-cv2-last b{color:#54e5fc;font-size:.61rem}.rp-cv2-readonly{padding:10px 14px;color:#547083;text-align:center;font-size:.45rem;font-weight:800;letter-spacing:.06em}.rp-cv2-loading{padding:48px 14px;color:#6d8799;text-align:center;font-size:.6rem;font-weight:900;letter-spacing:.1em}
      @media(max-width:900px){.rp-cv2-live{grid-template-columns:1fr 1fr}.rp-cv2-focus{grid-column:1/-1;grid-row:2}.rp-cv2-live-side{position:static}.rp-cv2-focus-hero{grid-template-columns:auto minmax(0,1fr)}.rp-cv2-rating{grid-column:1/-1}}
      @media(max-width:640px){.rp-cv2-topbar{height:66px;padding:0 14px}.rp-cv2-body{padding:14px 11px 28px}.rp-cv2-idle{min-height:calc(100dvh - 105px)}.rp-cv2-idle-card{border-radius:22px}.rp-cv2-sides{grid-template-columns:1fr;gap:10px}.rp-cv2-side{min-height:0;padding:13px}.rp-cv2-live{gap:8px}.rp-cv2-live-side{padding:8px}.rp-cv2-player{grid-template-columns:33px minmax(0,1fr);padding:5px;min-height:51px}.rp-cv2-player .no{height:32px}.rp-cv2-player .ovr{grid-column:2}.rp-cv2-focus-hero{grid-template-columns:60px minmax(0,1fr);gap:9px;padding:14px}.rp-cv2-focus-no{min-width:60px;height:60px;border-radius:16px;font-size:1.1rem}.rp-cv2-rating{grid-template-columns:1fr 1fr}.rp-cv2-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-cv2-last{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function currentProfile(player) {
    return profileCache.get(playerKey(player)) || player || {};
  }

  function statsFor(player) {
    const profile = currentProfile(player);
    return profile?.careerStats || profile?.career?.stats || profile?.career || player?.careerStats || {};
  }

  function average(explicit, total, games) {
    const raw = finite(explicit);
    if (raw !== null) return raw.toFixed(1);
    const sum = finite(total);
    const played = finite(games);
    return sum !== null && played && played > 0 ? (sum / played).toFixed(1) : '—';
  }

  function pct(value) {
    const number = finite(value);
    if (number === null) return '—';
    return `${Math.round(number <= 1 ? number * 100 : number)}%`;
  }

  function metric(value) {
    const number = finite(value);
    return number === null ? '—' : String(Math.round(number));
  }

  function playerMetrics(player) {
    const profile = currentProfile(player);
    const stats = statsFor(player);
    const games = finite(pick(stats.games, stats.gamesPlayed, profile.games, profile.gamesPlayed));
    const wins = finite(pick(stats.wins, profile.wins, profile.record?.wins));
    const losses = finite(pick(stats.losses, profile.losses, profile.record?.losses));
    return {
      profile,
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

  function currentGameStats(player) {
    const stats = player?.stats || {};
    return {
      pts: metric(pick(stats.pts, stats.points)),
      ast: metric(pick(stats.ast, stats.assists)),
      reb: metric(pick(stats.reb, stats.rebounds)),
      tov: metric(pick(stats.tov, stats.to, stats.turnovers)),
    };
  }

  function lastGame(profile) {
    return Array.isArray(profile?.recentGames) && profile.recentGames.length ? profile.recentGames[0] : null;
  }

  function gameLabel(game) {
    if (!game) return 'NO FINALIZED GAME YET';
    return String(pick(game.displayLabel, game.label, Number.isFinite(Number(game.sessionId ?? game.id)) ? `GAME #${String(Number(game.sessionId ?? game.id)).padStart(3, '0')}` : 'OFFICIAL GAME'));
  }

  function renderIdle() {
    return `
      <main class="rp-cv2-body">
        <section class="rp-cv2-idle">
          <div class="rp-cv2-idle-card">
            <span class="rp-cv2-badge">BROADCAST DESK</span>
            <h1>STATS VIEWER</h1>
            <p>Your courtside reference for player numbers, current-game stats, career records and recent Real Play history.</p>
            <button type="button" class="rp-cv2-primary" data-cv2-start>START COMMENTARY</button>
          </div>
        </section>
      </main>`;
  }

  function lineupRow(key, side) {
    const player = findPlayer(key);
    if (!player) return '';
    const data = playerMetrics(player);
    const number = jersey(player);
    return `
      <article class="rp-cv2-lineup">
        <div class="rp-cv2-no">${number === null ? '#—' : `#${esc(number)}`}</div>
        <div class="rp-cv2-copy"><strong>${esc(playerName(player))}</strong><span>${data.ovr === null ? 'UNRANKED' : `${data.ovr} OVR`}</span></div>
        <button type="button" class="rp-cv2-remove" data-cv2-remove="${esc(key)}" data-side="${side}" aria-label="Remove ${esc(playerName(player))}">×</button>
      </article>`;
  }

  function renderSide(side, keys) {
    return `
      <section class="rp-cv2-side">
        <div class="rp-cv2-side-head"><strong>${side.toUpperCase()}</strong><span>${keys.length} PLAYER${keys.length === 1 ? '' : 'S'}</span></div>
        <div class="rp-cv2-stack">${keys.length ? keys.map((key) => lineupRow(key, side)).join('') : '<div class="rp-cv2-empty">NO PLAYER SELECTED</div>'}</div>
        <button type="button" class="rp-cv2-add" data-cv2-add="${side}">+ ADD PLAYER</button>
      </section>`;
  }

  function pickerCandidates() {
    const assigned = new Set([...west, ...east]);
    const query = pickerQuery.trim().toLowerCase();
    return sessionPool().filter((player) => {
      const key = playerKey(player);
      if (assigned.has(key)) return false;
      if (!query) return true;
      return playerName(player).toLowerCase().includes(query) || String(jersey(player) ?? '').includes(query);
    });
  }

  function renderPicker() {
    if (!pickerSide) return '';
    const candidates = pickerCandidates();
    return `
      <div class="rp-cv2-picker" data-cv2-picker>
        <section class="rp-cv2-picker-card" role="dialog" aria-modal="true" aria-label="Choose ${pickerSide} player">
          <header class="rp-cv2-picker-head"><div><small>WHO'S PLAYING?</small><strong>ADD TO ${pickerSide.toUpperCase()}</strong></div><button type="button" class="rp-cv2-picker-close" data-cv2-picker-close aria-label="Close">×</button></header>
          <input class="rp-cv2-search" data-cv2-search value="${esc(pickerQuery)}" placeholder="Search player or jersey #" autocomplete="off">
          <div class="rp-cv2-picker-list">
            ${candidates.length ? candidates.map((player) => {
              const data = playerMetrics(player);
              const number = jersey(player);
              return `<button type="button" class="rp-cv2-pick" data-cv2-pick="${esc(playerKey(player))}"><b>${number === null ? '#—' : `#${esc(number)}`}</b><strong>${esc(playerName(player))}</strong><span>${data.ovr === null ? 'UNRANKED' : `${data.ovr} OVR`}</span></button>`;
            }).join('') : '<div class="rp-cv2-empty">NO AVAILABLE PLAYERS</div>'}
          </div>
        </section>
      </div>`;
  }

  function renderSetup() {
    const canStart = west.length > 0 && east.length > 0;
    return `
      <main class="rp-cv2-body">
        <header class="rp-cv2-head"><span class="rp-cv2-eyebrow">COMMENTARY SETUP</span><h1>WHO'S PLAYING?</h1><p>Choose West and East. This selection is for the commentator view only.</p></header>
        ${notice ? `<div class="rp-cv2-notice">${esc(notice)}</div>` : ''}
        <div class="rp-cv2-sides">${renderSide('west', west)}${renderSide('east', east)}</div>
        <div class="rp-cv2-setup-foot"><button type="button" class="rp-cv2-primary" data-cv2-begin ${canStart ? '' : 'disabled'}>START COMMENTARY</button></div>
        ${renderPicker()}
      </main>`;
  }

  function livePlayer(key) {
    const player = findPlayer(key);
    if (!player) return '';
    const data = playerMetrics(player);
    const number = jersey(player);
    return `<button type="button" class="rp-cv2-player${key === selectedKey ? ' active' : ''}" data-cv2-select="${esc(key)}"><span class="no">${number === null ? '#—' : `#${esc(number)}`}</span><span class="nm">${esc(playerName(player))}</span><span class="ovr">${data.ovr === null ? '— OVR' : `${data.ovr} OVR`}</span></button>`;
  }

  function liveSide(side, keys) {
    return `<aside class="rp-cv2-live-side"><header><strong>${side.toUpperCase()}</strong><span>${keys.length} PLAYER${keys.length === 1 ? '' : 'S'}</span></header>${keys.map(livePlayer).join('')}<button type="button" class="rp-cv2-edit" data-cv2-edit>EDIT LINEUP</button></aside>`;
  }

  function renderPlayerFocus() {
    const player = findPlayer(selectedKey) || findPlayer(west[0]) || findPlayer(east[0]);
    if (!player) return '<section class="rp-cv2-focus"><div class="rp-cv2-loading">SELECT A PLAYER</div></section>';
    const data = playerMetrics(player);
    const profile = data.profile;
    const live = currentGameStats(player);
    const recent = lastGame(profile);
    const record = data.wins === null && data.losses === null ? '—' : `${data.wins ?? 0}-${data.losses ?? 0}`;
    const number = jersey(profile) ?? jersey(player);
    const loadingProfile = profileLoading.has(playerKey(player));
    return `
      <section class="rp-cv2-focus">
        <header class="rp-cv2-focus-hero">
          <div class="rp-cv2-focus-no">${number === null ? '#—' : `#${esc(number)}`}</div>
          <div class="rp-cv2-focus-name"><small>REAL PLAY PLAYER</small><h2>${esc(playerName(profile) || playerName(player))}</h2></div>
          <div class="rp-cv2-rating"><div><span>OVR</span><strong>${data.ovr === null ? '—' : data.ovr}</strong></div><div><span>RANK</span><strong>${data.rank === null ? '—' : `#${Math.round(data.rank)}`}</strong></div></div>
        </header>
        <div class="rp-cv2-section"><div class="rp-cv2-section-title"><strong>CURRENT GAME</strong><span>${esc(sessionStatusText())}</span></div><div class="rp-cv2-stats"><div class="rp-cv2-stat"><strong>${live.pts}</strong><span>PTS</span></div><div class="rp-cv2-stat"><strong>${live.ast}</strong><span>AST</span></div><div class="rp-cv2-stat"><strong>${live.reb}</strong><span>REB</span></div><div class="rp-cv2-stat"><strong>${live.tov}</strong><span>TO</span></div></div></div>
        <div class="rp-cv2-section"><div class="rp-cv2-section-title"><strong>CAREER SNAPSHOT</strong><span>OFFICIAL GAMES</span></div><div class="rp-cv2-stats"><div class="rp-cv2-stat"><strong>${data.ppg}</strong><span>PPG</span></div><div class="rp-cv2-stat"><strong>${data.apg}</strong><span>APG</span></div><div class="rp-cv2-stat"><strong>${data.rpg}</strong><span>RPG</span></div><div class="rp-cv2-stat"><strong>${record}</strong><span>W-L</span></div><div class="rp-cv2-stat"><strong>${data.spg}</strong><span>SPG</span></div><div class="rp-cv2-stat"><strong>${data.bpg}</strong><span>BPG</span></div><div class="rp-cv2-stat"><strong>${data.topg}</strong><span>TOPG</span></div><div class="rp-cv2-stat"><strong>${data.games === null ? '—' : Math.round(data.games)}</strong><span>GAMES</span></div></div></div>
        <div class="rp-cv2-section"><div class="rp-cv2-section-title"><strong>SHOOTING</strong><span>VERIFIED DATA WHEN AVAILABLE</span></div><div class="rp-cv2-stats"><div class="rp-cv2-stat"><strong>${data.shooting}</strong><span>SHOOTING %</span></div><div class="rp-cv2-stat"><strong>${data.onePct}</strong><span>1PT %</span></div><div class="rp-cv2-stat"><strong>${data.twoPct}</strong><span>2PT %</span></div><div class="rp-cv2-stat"><strong>${data.ovr === null ? '—' : data.ovr}</strong><span>OVR</span></div></div></div>
        <div class="rp-cv2-section"><div class="rp-cv2-section-title"><strong>LAST GAME</strong><span>${loadingProfile ? 'LOADING HISTORY…' : 'QUICK COMMENTARY NOTE'}</span></div><div class="rp-cv2-last"><div><strong>${esc(gameLabel(recent))}</strong><small>${recent ? `${metric(pick(recent.pts, recent.points))} PTS · ${metric(pick(recent.ast, recent.assists))} AST · ${metric(pick(recent.reb, recent.rebounds))} REB · ${metric(pick(recent.tov, recent.to, recent.turnovers))} TO` : 'No finalized game returned for this player yet.'}</small></div><b>${recent ? esc(String(recent.result || 'FINAL').toUpperCase()) : '—'}</b></div></div>
        <div class="rp-cv2-readonly">COMMENTARY VIEW ONLY · OFFICIAL STATS REMAIN CONTROLLED BY REAL PLAY GAME RECORDS</div>
      </section>`;
  }

  function renderLive() {
    if (!selectedKey) selectedKey = west[0] || east[0] || null;
    return `
      <main class="rp-cv2-body">
        <header class="rp-cv2-head"><span class="rp-cv2-eyebrow">${esc(sessionStatusText())} · COMMENTARY DESK</span><h1>${esc(control?.session?.title || 'STATS VIEWER')}</h1><p>Tap a player for a quick courtside profile.</p></header>
        ${notice ? `<div class="rp-cv2-notice">${esc(notice)}</div>` : ''}
        <div class="rp-cv2-live">${liveSide('west', west)}${renderPlayerFocus()}${liveSide('east', east)}</div>
      </main>`;
  }

  function shellHtml() {
    const content = view === 'setup' ? renderSetup() : view === 'live' ? renderLive() : renderIdle();
    return `<header class="rp-cv2-topbar"><div class="rp-cv2-brand"><small>REAL PLAY ADMIN</small><strong>STATS VIEWER</strong></div><button type="button" class="rp-cv2-exit" data-cv2-exit>EXIT</button></header>${content}`;
  }

  function render() {
    if (!viewer || viewer.hidden) return;
    viewer.innerHTML = shellHtml();
    bindViewerEvents();
  }

  async function loadProfile(player) {
    const key = playerKey(player);
    const id = playerId(player);
    if (!id || profileCache.has(key) || profileLoading.has(key)) return;
    profileLoading.add(key);
    render();
    try {
      const data = await community('player_profile', { playerId: id });
      if (data?.player) profileCache.set(key, data.player);
    } catch (_error) {
      // Directory and current-game data remain available even if history fails.
    } finally {
      profileLoading.delete(key);
      render();
    }
  }

  function selectPlayer(key) {
    selectedKey = key;
    render();
    const player = findPlayer(key);
    if (player) loadProfile(player);
  }

  function startCommentarySetup() {
    view = 'setup';
    notice = '';
    render();
    refreshData();
  }

  function beginCommentary() {
    if (!west.length || !east.length) return;
    view = 'live';
    pickerSide = null;
    pickerQuery = '';
    selectedKey = west[0] || east[0] || null;
    render();
    const first = findPlayer(selectedKey);
    if (first) loadProfile(first);
    startPolling();
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
    if (selectedKey === key) selectedKey = west[0] || east[0] || null;
    render();
  }

  function bindViewerEvents() {
    viewer.querySelector('[data-cv2-exit]')?.addEventListener('click', closeViewer);
    viewer.querySelector('[data-cv2-start]')?.addEventListener('click', startCommentarySetup);
    viewer.querySelector('[data-cv2-begin]')?.addEventListener('click', beginCommentary);
    viewer.querySelectorAll('[data-cv2-add]').forEach((button) => button.addEventListener('click', () => {
      pickerSide = button.dataset.cv2Add;
      pickerQuery = '';
      render();
      window.requestAnimationFrame(() => viewer.querySelector('[data-cv2-search]')?.focus());
    }));
    viewer.querySelectorAll('[data-cv2-remove]').forEach((button) => button.addEventListener('click', () => removePlayer(button.dataset.cv2Remove, button.dataset.side)));
    viewer.querySelector('[data-cv2-picker-close]')?.addEventListener('click', () => { pickerSide = null; pickerQuery = ''; render(); });
    viewer.querySelector('[data-cv2-picker]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) { pickerSide = null; pickerQuery = ''; render(); }
    });
    viewer.querySelector('[data-cv2-search]')?.addEventListener('input', (event) => {
      pickerQuery = event.currentTarget.value;
      const value = pickerQuery;
      render();
      const input = viewer.querySelector('[data-cv2-search]');
      if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
    });
    viewer.querySelectorAll('[data-cv2-pick]').forEach((button) => button.addEventListener('click', () => assignPlayer(button.dataset.cv2Pick)));
    viewer.querySelectorAll('[data-cv2-select]').forEach((button) => button.addEventListener('click', () => selectPlayer(button.dataset.cv2Select)));
    viewer.querySelectorAll('[data-cv2-edit]').forEach((button) => button.addEventListener('click', () => { view = 'setup'; render(); }));
  }

  function ensureEntryButton() {
    if (!adminRoot) return;
    const nav = adminRoot.querySelector(':scope>.rp-admin-shell .rp-admin-tabs');
    if (!nav) return;
    let button = nav.querySelector('[data-cv2-entry]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-admin-tab rp-cv-entry';
      button.dataset.cv2Entry = '1';
      button.textContent = 'STATS';
      button.setAttribute('aria-label', 'Open Stats Viewer');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openViewer();
      });
      nav.appendChild(button);
    }
    button.classList.toggle('active', adminRoot.classList.contains('rp-commentary-open'));
  }

  function openViewer() {
    if (!adminRoot || !viewer || !adminRoot.classList.contains('open')) return;
    view = 'idle';
    pickerSide = null;
    pickerQuery = '';
    selectedKey = null;
    notice = '';
    west = [];
    east = [];
    hydratedFromSession = false;
    stopPolling();
    viewer.hidden = false;
    viewer.setAttribute('aria-hidden', 'false');
    adminRoot.classList.add('rp-commentary-open');
    ensureEntryButton();
    render();
  }

  function closeViewer() {
    if (!adminRoot || !viewer) return;
    pickerSide = null;
    pickerQuery = '';
    stopPolling();
    adminRoot.classList.remove('rp-commentary-open');
    viewer.hidden = true;
    viewer.setAttribute('aria-hidden', 'true');
    ensureEntryButton();
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(async () => {
      if (!adminRoot?.classList.contains('open') || !adminRoot.classList.contains('rp-commentary-open') || view === 'idle' || loading) return;
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

  function mount(root) {
    if (!root || root.dataset.commentaryV2Mounted === 'true') return;
    adminRoot = root;
    root.dataset.commentaryV2Mounted = 'true';
    installStyles();

    viewer = document.createElement('section');
    viewer.className = 'rp-commentary-viewer-v2';
    viewer.hidden = true;
    viewer.setAttribute('aria-hidden', 'true');
    viewer.setAttribute('aria-label', 'Real Play Stats Viewer');
    root.appendChild(viewer);
    ensureEntryButton();

    const observer = new MutationObserver(() => {
      ensureEntryButton();
      if (!root.classList.contains('open') && root.classList.contains('rp-commentary-open')) closeViewer();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
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
    ensureEntryButton();
    if (adminRoot?.classList.contains('rp-commentary-open') && view !== 'idle') refreshData({ quiet: true });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !adminRoot?.classList.contains('rp-commentary-open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pickerSide) {
      pickerSide = null;
      pickerQuery = '';
      render();
      return;
    }
    closeViewer();
  }, true);

  window.RealPlayCommentaryStatsViewer = { open: openViewer, close: closeViewer };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
