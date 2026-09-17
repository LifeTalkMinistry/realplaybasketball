(() => {
  if (window.__realPlayFuture4v4TeamOvrHeaderInstalled) return;
  window.__realPlayFuture4v4TeamOvrHeaderInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-4v4-team-ovr-header-style';
  const CLUB_NAMES = Object.freeze({ lions:'LIONS', valiant:'VALIANT', watchmen:'WATCHMEN', conquerors:'CONQUERORS' });

  let preferencePlayers = [];
  let viewerAccountUserId = null;
  let lastLoadedAt = 0;
  let loadPromise = null;
  let refreshTimer = null;
  let lastData = null;

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const finite = (value) => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  const validRank = (value) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
  const positiveId = (value) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
  const activeView = () => document.querySelector('[data-rp-4v4-static-view]');
  const activeClub = (view = activeView()) => {
    const club = String(view?.dataset?.rpActiveClub || '').trim().toLowerCase();
    return CLUB_NAMES[club] ? club : 'lions';
  };
  const clubPlayers = (clubId) => preferencePlayers.filter((p) => String(p?.preferredClub || '').trim().toLowerCase() === clubId);
  const sortedClubPlayers = (clubId) => clubPlayers(clubId).sort((a,b) => {
    const ar = validRank(a?.rank), br = validRank(b?.rank);
    if (ar && br) return ar - br;
    if (ar) return -1;
    if (br) return 1;
    const ao = finite(a?.ovr) ?? -Infinity, bo = finite(b?.ovr) ?? -Infinity;
    if (ao !== bo) return bo - ao;
    const gd = (Number(b?.verifiedGames ?? b?.games ?? 0) || 0) - (Number(a?.verifiedGames ?? a?.games ?? 0) || 0);
    return gd || String(a?.playerName || '').localeCompare(String(b?.playerName || ''));
  });
  const previewAverage = (players) => {
    const values = players.map((p) => finite(p?.ovr)).filter((v) => v !== null && v > 0);
    return values.length ? values.reduce((s,v) => s + v, 0) / values.length : null;
  };
  function officialState(data, clubId) {
    const state = [data?.teamOvrByClub?.[clubId], data?.teamOvrAuthority?.clubs?.[clubId], data?.teamOvrAuthority?.[clubId]].find(Boolean) || null;
    if (!state || typeof state !== 'object') return null;
    const teamOvr = finite(state.teamOvr ?? state.ovr ?? state.value);
    const floor = finite(state.minimumFloor ?? state.floor ?? state.min);
    const cap = finite(state.maximumCap ?? state.cap ?? state.max);
    const validation = String(state.validationResult ?? state.status ?? '').trim().toUpperCase();
    return teamOvr === null || cap === null || !validation ? null : { teamOvr, floor, cap, validation };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.querySelectorAll('style[data-rp4v4-team-ovr-header-style],style[data-rp-4v4-team-ovr-header-style]').forEach((el) => el.remove());
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-4v4-static-view{--rp4v4-ovr-accent:#ff3340;--rp4v4-ovr-mid:#a70f19;--rp4v4-ovr-deep:#8f0d17;--rp4v4-ovr-dark:#21070b;--rp4v4-ovr-line:#ff3040;--rp4v4-ovr-line-deep:#7a0912;--rp4v4-ovr-soft:rgba(255,45,56,.22);--rp4v4-ovr-glow:rgba(235,28,42,.22);--rp4v4-ovr-shadow:#5a060c;--rp4v4-ovr-label:#f0d8db}
      .rp-4v4-static-view[data-rp-active-club="lions"]{--rp4v4-ovr-accent:#1b9cff;--rp4v4-ovr-mid:#0870db;--rp4v4-ovr-deep:#0755ad;--rp4v4-ovr-dark:#061d3b;--rp4v4-ovr-line:#26a9ff;--rp4v4-ovr-line-deep:#07539e;--rp4v4-ovr-soft:rgba(27,156,255,.24);--rp4v4-ovr-glow:rgba(27,156,255,.26);--rp4v4-ovr-shadow:#043d78;--rp4v4-ovr-label:#9fdcff}
      .rp-4v4-static-view[data-rp-active-club="valiant"]{--rp4v4-ovr-accent:#ff3340;--rp4v4-ovr-mid:#a70f19;--rp4v4-ovr-deep:#8f0d17;--rp4v4-ovr-dark:#21070b;--rp4v4-ovr-line:#ff3040;--rp4v4-ovr-line-deep:#7a0912;--rp4v4-ovr-soft:rgba(255,45,56,.22);--rp4v4-ovr-glow:rgba(235,28,42,.22);--rp4v4-ovr-shadow:#5a060c;--rp4v4-ovr-label:#ffd3d7}
      .rp-4v4-static-view[data-rp-active-club="watchmen"]{--rp4v4-ovr-accent:#f4c23f;--rp4v4-ovr-mid:#bd8215;--rp4v4-ovr-deep:#94620b;--rp4v4-ovr-dark:#352406;--rp4v4-ovr-line:#ffd257;--rp4v4-ovr-line-deep:#8d5d08;--rp4v4-ovr-soft:rgba(244,194,63,.24);--rp4v4-ovr-glow:rgba(244,194,63,.24);--rp4v4-ovr-shadow:#6c4905;--rp4v4-ovr-label:#ffe39a}
      .rp-4v4-static-view[data-rp-active-club="conquerors"]{--rp4v4-ovr-accent:#a454ff;--rp4v4-ovr-mid:#7225d1;--rp4v4-ovr-deep:#54179f;--rp4v4-ovr-dark:#21093f;--rp4v4-ovr-line:#b46cff;--rp4v4-ovr-line-deep:#51148f;--rp4v4-ovr-soft:rgba(164,84,255,.24);--rp4v4-ovr-glow:rgba(164,84,255,.25);--rp4v4-ovr-shadow:#451176;--rp4v4-ovr-label:#d8b5ff}
      .rp-4v4-static-view .rp-3v3-select-head{display:none!important}.rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand{min-width:0;display:flex;align-items:center;justify-content:center;text-align:center}.rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{display:block;margin:0;color:#f5f9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.05rem;font-weight:1000;letter-spacing:.09em;line-height:1;text-transform:uppercase;white-space:nowrap}.rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand span{display:none!important}
      .rp-4v4-static-view .rp-3v3-topmark.rp-4v4-info-button{appearance:none;width:40px;height:40px;padding:0;display:grid;place-items:center;cursor:pointer;border:1px solid rgba(126,173,232,.16);border-radius:13px;color:#fff;background:#07111e;font-family:Georgia,serif;font-size:1.15rem;font-style:italic;font-weight:800;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque{position:relative;z-index:7;width:214px;height:68px;margin:1px auto -19px;display:grid;place-items:center;pointer-events:none;filter:drop-shadow(0 8px 16px rgba(0,0,0,.62)) drop-shadow(0 0 11px var(--rp4v4-ovr-glow))}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque::before{content:"";position:absolute;inset:0;clip-path:polygon(12% 0,88% 0,100% 20%,96% 72%,80% 100%,20% 100%,4% 72%,0 20%);background:linear-gradient(145deg,var(--rp4v4-ovr-accent),var(--rp4v4-ovr-deep) 16%,var(--rp4v4-ovr-dark) 33%,#070b10 52%,var(--rp4v4-ovr-dark) 69%,var(--rp4v4-ovr-mid) 84%,var(--rp4v4-ovr-accent));box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque::after{content:"";position:absolute;inset:5px 9px 6px;clip-path:polygon(10% 0,90% 0,100% 23%,95% 78%,78% 100%,22% 100%,5% 78%,0 23%);background:linear-gradient(90deg,var(--rp4v4-ovr-soft),transparent 19%,transparent 81%,var(--rp4v4-ovr-soft)),linear-gradient(180deg,#161d25,#080b10 42%,#020305);border-top:1px solid rgba(255,255,255,.17)}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core{position:relative;z-index:2;min-width:118px;height:58px;padding:7px 22px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;clip-path:polygon(10% 0,90% 0,100% 22%,96% 78%,79% 100%,21% 100%,4% 78%,0 22%);background:linear-gradient(180deg,rgba(28,35,44,.98),rgba(7,10,14,.99) 56%,rgba(1,2,4,.99));box-shadow:inset 0 1px 0 rgba(255,255,255,.11),inset 0 -1px 0 var(--rp4v4-ovr-soft)}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::before,.rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::after{content:"";position:absolute;top:11px;width:26px;height:32px;opacity:.9;border-top:2px solid var(--rp4v4-ovr-line);border-bottom:2px solid var(--rp4v4-ovr-line-deep)}.rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::before{left:7px;transform:skewX(-18deg)}.rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::after{right:7px;transform:skewX(18deg)}
      .rp-4v4-static-view .rp-4v4-team-ovr-label{position:relative;z-index:2;margin:0 0 1px;color:var(--rp4v4-ovr-label);font-family:var(--rp-display,Arial,sans-serif);font-size:.43rem;font-style:italic;font-weight:1000;letter-spacing:.13em;line-height:1;text-transform:uppercase;text-shadow:0 1px 0 #000}.rp-4v4-static-view .rp-4v4-team-ovr-value{position:relative;z-index:2;display:block;min-width:70px;margin:0;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:2.05rem;font-style:italic;font-weight:1000;letter-spacing:-.045em;line-height:.88;text-align:center;text-shadow:0 2px 0 var(--rp4v4-ovr-shadow),0 0 8px rgba(255,255,255,.18),0 0 14px var(--rp4v4-ovr-glow)}.rp-4v4-static-view .rp-4v4-team-ovr-plaque[data-ovr-empty="true"] .rp-4v4-team-ovr-value{font-size:1.72rem;letter-spacing:0;color:#d7e0e8}
      .rp-4v4-info-backdrop{position:fixed;z-index:910;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:14px;background:rgba(0,4,10,.78);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .2s ease}.rp-4v4-info-backdrop.open{opacity:1;pointer-events:auto}.rp-4v4-info-sheet{width:min(100%,520px);max-height:min(82vh,720px);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(107,168,211,.18);border-radius:24px;background:linear-gradient(180deg,#08131f,#03070d 72%);box-shadow:0 30px 80px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.04)}
      .rp-4v4-info-head{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;padding:18px 18px 13px;border-bottom:1px solid rgba(255,255,255,.07)}.rp-4v4-info-head small{display:block;margin-bottom:4px;color:#5fdfff;font-size:.46rem;font-weight:1000;letter-spacing:.15em;text-transform:uppercase}.rp-4v4-info-head h2{margin:0;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;line-height:1;text-transform:uppercase}.rp-4v4-info-close{width:38px;height:38px;border:1px solid rgba(126,173,232,.14);border-radius:12px;color:#dceaff;background:#07111e;font-size:1.1rem;cursor:pointer}
      .rp-4v4-info-tabs{display:flex;gap:7px;padding:11px 12px 10px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid rgba(255,255,255,.055)}.rp-4v4-info-tabs::-webkit-scrollbar{display:none}.rp-4v4-info-tab{flex:0 0 auto;min-height:36px;padding:0 12px;border:1px solid rgba(126,173,232,.12);border-radius:999px;color:#7f94a8;background:#06101b;font-size:.48rem;font-weight:1000;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}.rp-4v4-info-tab.active{color:#fff;border-color:rgba(71,216,255,.38);background:linear-gradient(180deg,#10283b,#0a1927)}
      .rp-4v4-info-body{overflow-y:auto;padding:16px 16px 20px;color:#b4c3d0}.rp-4v4-info-panel[hidden]{display:none!important}.rp-4v4-info-kicker{margin:0 0 7px;color:#6ce2ff;font-size:.47rem;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}.rp-4v4-info-title{margin:0 0 8px;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.08rem;font-style:italic;font-weight:1000;line-height:1.05;text-transform:uppercase}.rp-4v4-info-copy{margin:0;color:#97aabc;font-size:.72rem;line-height:1.55}.rp-4v4-info-card{margin-top:13px;padding:13px;border:1px solid rgba(126,173,232,.11);border-radius:16px;background:rgba(255,255,255,.025)}.rp-4v4-info-card strong{display:block;margin-bottom:6px;color:#e9f4fd;font-size:.62rem;font-weight:1000;letter-spacing:.05em;text-transform:uppercase}.rp-4v4-info-card p{margin:0;color:#879cad;font-size:.68rem;line-height:1.5}
      .rp-4v4-info-formula{margin-top:13px;padding:15px;border:1px solid rgba(78,202,255,.22);border-radius:18px;background:linear-gradient(180deg,rgba(78,202,255,.05),#04090f)}.rp-4v4-info-formula small{display:block;color:#88a6ba;font-size:.45rem;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}.rp-4v4-info-formula-line{margin-top:8px;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:.94rem;font-weight:1000;text-align:center}.rp-4v4-info-formula-step{display:block;margin:4px 0}.rp-4v4-info-formula-step.final{color:var(--rp4v4-ovr-accent);font-size:1.08rem}.rp-4v4-info-formula-help{margin:7px 0 0;color:#6f8799;font-size:.62rem;line-height:1.45;text-align:center}.rp-4v4-info-formula-help[hidden]{display:none!important}
      .rp-4v4-info-panel[data-rp-4v4-info-panel="ovr"]{width:min(100%,360px);margin-inline:auto;text-align:left}.rp-4v4-info-panel[data-rp-4v4-info-panel="ovr"] .rp-4v4-info-formula-line,.rp-4v4-info-panel[data-rp-4v4-info-panel="ovr"] .rp-4v4-info-formula-help{text-align:left}
      .rp-4v4-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.rp-4v4-info-stat{padding:12px;border:1px solid rgba(126,173,232,.1);border-radius:14px;background:rgba(255,255,255,.02)}.rp-4v4-info-stat small{display:block;color:#60768a;font-size:.4rem;font-weight:1000;letter-spacing:.1em;text-transform:uppercase}.rp-4v4-info-stat strong{display:block;margin-top:5px;color:#ecf6ff;font-size:.75rem;font-weight:1000;line-height:1.25;text-transform:uppercase}.rp-4v4-info-note{margin-top:13px;padding:11px 12px;border-left:2px solid #42d9ff;border-radius:0 12px 12px 0;background:rgba(66,217,255,.05);color:#7f9bb0;font-size:.64rem;line-height:1.48}
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link{cursor:pointer;touch-action:manipulation}.rp-4v4-static-view .rp-4v4-player-card.is-profile-link:focus-visible{outline:2px solid rgba(80,220,255,.68);outline-offset:2px}
      @media(max-width:380px){.rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{font-size:.94rem;letter-spacing:.075em}.rp-4v4-static-view .rp-4v4-team-ovr-plaque{width:196px;height:64px;margin-bottom:-18px}.rp-4v4-info-grid{grid-template-columns:1fr}}@media(min-width:700px){.rp-4v4-info-backdrop{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function ensureInfoButton(view) {
    if (!view) return null;
    const topbar = view.querySelector('.rp-3v3-topbar');
    if (!topbar) return null;
    let button = topbar.querySelector('[data-rp-4v4-info-button], [data-rp4v4-info-button], .rp-4v4-info-button');
    if (button) {
      button.setAttribute('data-rp-4v4-info-button','1');
      button.removeAttribute('data-rp4v4-info-button');
      return button;
    }
    const oldTopmark = topbar.querySelector('.rp-3v3-topmark');
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-3v3-topmark rp-4v4-info-button';
    button.setAttribute('data-rp-4v4-info-button','1');
    button.setAttribute('aria-label','4V4 information');
    button.setAttribute('aria-haspopup','dialog');
    button.textContent = 'i';
    oldTopmark ? oldTopmark.replaceWith(button) : topbar.appendChild(button);
    return button;
  }

  function currentOvrFormula(view) {
    const clubId = activeClub(view);
    const values = clubPlayers(clubId).map((p) => finite(p?.ovr)).filter((v) => v !== null && v > 0).map((v) => Math.round(v));
    const official = officialState(lastData, clubId);
    return { values, teamOvr: official?.teamOvr ?? previewAverage(clubPlayers(clubId)), official: Boolean(official) };
  }

  function ensureInfoModal(view) {
    if (!view) return null;
    let backdrop = document.querySelector('[data-rp-4v4-info-backdrop], [data-rp4v4-info-backdrop], .rp-4v4-info-backdrop');
    if (backdrop) {
      backdrop.setAttribute('data-rp-4v4-info-backdrop','1');
      backdrop.removeAttribute('data-rp4v4-info-backdrop');
      return backdrop;
    }
    backdrop = document.createElement('div');
    backdrop.className = 'rp-4v4-info-backdrop';
    backdrop.setAttribute('data-rp-4v4-info-backdrop','1');
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML = `
      <section class="rp-4v4-info-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-4v4-info-title">
        <header class="rp-4v4-info-head"><div><small>REAL PLAY 4V4</small><h2 id="rp-4v4-info-title">4V4 INFO</h2></div><button class="rp-4v4-info-close" type="button" aria-label="Close 4V4 information" data-rp-4v4-info-close>×</button></header>
        <nav class="rp-4v4-info-tabs" aria-label="4V4 information sections"><button class="rp-4v4-info-tab active" type="button" data-rp-4v4-info-tab="ovr">TEAM OVR</button><button class="rp-4v4-info-tab" type="button" data-rp-4v4-info-tab="setup">GAME SETUP</button><button class="rp-4v4-info-tab" type="button" data-rp-4v4-info-tab="rules">GAME RULES</button><button class="rp-4v4-info-tab" type="button" data-rp-4v4-info-tab="selection">TEAM SELECTION</button></nav>
        <div class="rp-4v4-info-body">
          <section class="rp-4v4-info-panel" data-rp-4v4-info-panel="ovr">
            <p class="rp-4v4-info-kicker">WHY IT EXISTS</p><h3 class="rp-4v4-info-title">TEAM STRENGTH AT A GLANCE</h3>
            <p class="rp-4v4-info-copy">Team OVR summarizes a team's overall strength and helps Real Play keep teams balanced.</p>
            <div class="rp-4v4-info-formula"><small data-rp-4v4-info-formula-label>SAMPLE CALCULATION</small><div class="rp-4v4-info-formula-line" data-rp-4v4-info-formula-line><span class="rp-4v4-info-formula-step">72 + 70 + 71 + 71 = 284</span><span class="rp-4v4-info-formula-step final">284 ÷ 4 = TEAM OVR 71</span></div></div>
            <div class="rp-4v4-info-card"><strong>INDIVIDUAL RATINGS STAY SEPARATE</strong><p>Team OVR does not change a player's OVR or World Rank.</p></div>
          </section>
          <section class="rp-4v4-info-panel" data-rp-4v4-info-panel="setup" hidden><p class="rp-4v4-info-kicker">CURRENT PLANNED FORMAT</p><h3 class="rp-4v4-info-title">FAST, ACTIVE 4V4 BASKETBALL</h3><div class="rp-4v4-info-grid"><div class="rp-4v4-info-stat"><small>FORMAT</small><strong>4 VS 4</strong></div><div class="rp-4v4-info-stat"><small>SET LENGTH</small><strong>15 MINUTES</strong></div><div class="rp-4v4-info-stat"><small>SHOT CLOCK</small><strong>12 SECONDS</strong></div><div class="rp-4v4-info-stat"><small>FRESH BALL</small><strong>OUTSIDE THE 3PT LINE</strong></div></div><p class="rp-4v4-info-note">Set allocation is tracked so playing time stays organized. Late arrivals can still enter the rotation, but completed sets remain counted toward their session total.</p></section>
          <section class="rp-4v4-info-panel" data-rp-4v4-info-panel="rules" hidden><p class="rp-4v4-info-kicker">REAL PLAY STANDARD</p><h3 class="rp-4v4-info-title">COMPETE HARD. KEEP IT CLEAN.</h3><div class="rp-4v4-info-card"><strong>PACE</strong><p>The 12-second shot clock is designed to prevent stalling and keep possessions active.</p></div><div class="rp-4v4-info-card"><strong>FRESH BALL</strong><p>When a fresh possession is required, the ball is established outside the three-point line before attacking.</p></div><div class="rp-4v4-info-card"><strong>SPORTSMANSHIP</strong><p>No cussing, intimidation, or aggressive behavior. Competitive play is welcome; disrespect is not.</p></div><p class="rp-4v4-info-note">Specific scoring targets, foul procedures, and event-specific adjustments can be published here once the official 4V4 ruleset is locked.</p></section>
          <section class="rp-4v4-info-panel" data-rp-4v4-info-panel="selection" hidden><p class="rp-4v4-info-kicker">EARLY TEAM FORMATION</p><h3 class="rp-4v4-info-title">PREFERENCE IS NOT THE FINAL ROSTER</h3><p class="rp-4v4-info-copy">Choosing a team tells Real Play which club you currently prefer. It helps reveal demand around each club before official rosters are finalized.</p><div class="rp-4v4-info-card"><strong>WHAT YOUR PREFERENCE DOES</strong><p>Your name appears under the selected club's preference list and contributes to its preview Team OVR when you have a valid player OVR.</p></div><div class="rp-4v4-info-card"><strong>WHAT IT DOES NOT DO</strong><p>It does not guarantee an official roster position. Final team formation can still consider balance, availability, eligibility, and the official 4V4 structure.</p></div></section>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function updateInfoOvr(view) {
    const modal = ensureInfoModal(view);
    if (!modal) return;
    const { values, teamOvr, official } = currentOvrFormula(view);
    const line = modal.querySelector('[data-rp-4v4-info-formula-line]');
    const label = modal.querySelector('[data-rp-4v4-info-formula-label]');
    const help = modal.querySelector('[data-rp-4v4-info-formula-help]');
    if (!line || !label) return;
    if (official && finite(teamOvr) !== null) {
      label.textContent = 'OFFICIAL TEAM OVR';
      line.innerHTML = `<span class="rp-4v4-info-formula-step final">TEAM OVR ${Math.round(teamOvr)}</span>`;
      if (help) help.hidden = true;
      return;
    }
    if (!values.length || finite(teamOvr) === null) {
      label.textContent = 'SAMPLE CALCULATION';
      line.innerHTML = '<span class="rp-4v4-info-formula-step">72 + 70 + 71 + 71 = 284</span><span class="rp-4v4-info-formula-step final">284 ÷ 4 = TEAM OVR 71</span>';
      if (help) {
        help.hidden = false;
        help.textContent = 'Example only. During team selection, Team OVR is a preview based on valid player OVRs associated with the team. Once rosters are finalized, the official roster determines Team OVR.';
      }
      return;
    }
    label.textContent = 'PREVIEW CALCULATION';
    if (help) help.hidden = true;
    const sum = values.reduce((s,v) => s + v, 0);
    line.innerHTML = `<span class="rp-4v4-info-formula-step">${values.join(' + ')} = ${sum}</span><span class="rp-4v4-info-formula-step final">${sum} ÷ ${values.length} = TEAM OVR ${Math.round(teamOvr)}</span>`;
  }

  function selectInfoTab(name) {
    const modal = document.querySelector('[data-rp-4v4-info-backdrop], .rp-4v4-info-backdrop');
    if (!modal) return;
    modal.querySelectorAll('[data-rp-4v4-info-tab]').forEach((tab) => {
      const active = tab.getAttribute('data-rp-4v4-info-tab') === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-rp-4v4-info-panel]').forEach((panel) => { panel.hidden = panel.getAttribute('data-rp-4v4-info-panel') !== name; });
  }
  function openInfo(view = activeView()) {
    const modal = ensureInfoModal(view);
    if (!modal) return;
    updateInfoOvr(view); selectInfoTab('ovr'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    document.body.classList.add('rp-4v4-info-open');
    window.setTimeout(() => modal.querySelector('[data-rp-4v4-info-close]')?.focus({ preventScroll:true }), 0);
  }
  function closeInfo() {
    const modal = document.querySelector('[data-rp-4v4-info-backdrop], .rp-4v4-info-backdrop');
    if (!modal?.classList.contains('open')) return;
    modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('rp-4v4-info-open');
    activeView()?.querySelector('[data-rp-4v4-info-button], .rp-4v4-info-button')?.focus({ preventScroll:true });
  }

  function ensurePlaque(view) {
    if (!view) return null;
    const plaques = [...view.querySelectorAll('.rp-4v4-team-ovr-plaque')];
    let plaque = plaques[0] || null;
    plaques.slice(1).forEach((el) => el.remove());
    if (plaque) {
      plaque.setAttribute('data-rp-4v4-team-ovr-plaque','1');
      plaque.removeAttribute('data-rp4v4-team-ovr-plaque');
      return plaque;
    }
    const topbar = view.querySelector('.rp-3v3-topbar');
    if (!topbar) return null;
    plaque = document.createElement('div');
    plaque.className = 'rp-4v4-team-ovr-plaque';
    plaque.setAttribute('data-rp-4v4-team-ovr-plaque','1');
    plaque.dataset.ovrEmpty = 'true';
    plaque.setAttribute('aria-label','Team OVR unavailable');
    plaque.innerHTML = '<div class="rp-4v4-team-ovr-plaque-core"><small class="rp-4v4-team-ovr-label">TEAM OVR</small><strong class="rp-4v4-team-ovr-value" data-rp-4v4-team-ovr-value>—</strong></div>';
    topbar.insertAdjacentElement('afterend', plaque);
    return plaque;
  }
  function setPlaqueValue(view, value, state) {
    const plaque = ensurePlaque(view), target = plaque?.querySelector('[data-rp-4v4-team-ovr-value]');
    if (!plaque || !target) return;
    const n = finite(value), hasValue = n !== null && n > 0, display = hasValue ? String(Math.round(n)) : '—';
    target.textContent = display;
    plaque.dataset.ovrEmpty = hasValue ? 'false' : 'true';
    plaque.dataset.ovrState = state || (hasValue ? 'preview' : 'empty');
    plaque.setAttribute('aria-label', hasValue ? `Team OVR ${display}` : 'Team OVR unavailable');
  }

  function render(data = lastData) {
    const view = activeView();
    if (!view) return;
    view.querySelector('.rp-3v3-select-head')?.remove();
    ensureStyle(); ensureInfoButton(view); ensurePlaque(view);
    const brand = view.querySelector('.rp-3v3-brand'), strong = brand?.querySelector('strong'), span = brand?.querySelector('span');
    if (!brand || !strong || !span) return;
    brand.classList.add('rp-4v4-team-ovr-brand'); strong.textContent = 'SELECT YOUR TEAM'; span.textContent = '';
    const clubId = activeClub(view), players = clubPlayers(clubId), official = officialState(data, clubId);
    if (!token()) { brand.dataset.ovrState = 'signed-out'; setPlaqueValue(view,null,'signed-out'); updateInfoOvr(view); return; }
    if (official) {
      const normalized = official.validation.replace(/[^A-Z0-9]+/g,'_');
      const okCap = official.teamOvr <= official.cap, okFloor = official.floor === null || official.teamOvr >= official.floor;
      brand.dataset.ovrState = !okCap || normalized.includes('ABOVE') ? 'official-over' : (!okFloor || normalized.includes('BELOW') ? 'official-warning' : 'official-ok');
      setPlaqueValue(view, official.teamOvr, brand.dataset.ovrState); updateInfoOvr(view); return;
    }
    const preview = previewAverage(players);
    brand.dataset.ovrState = preview === null ? 'empty' : 'preview';
    setPlaqueValue(view, preview, brand.dataset.ovrState); updateInfoOvr(view);
  }

  function bindPreferenceCards() {
    const view = activeView(), list = view?.querySelector('[data-rp-4v4-preference-list]');
    if (!list) return;
    const cards = [...list.querySelectorAll('.rp-4v4-player-card')], players = sortedClubPlayers(activeClub(view));
    cards.forEach((card,index) => {
      const player = players[index] || null, accountUserId = positiveId(player?.userId), playerId = positiveId(player?.playerId);
      const isSelf = Boolean(accountUserId && viewerAccountUserId && accountUserId === viewerAccountUserId), clickable = isSelf || Boolean(playerId);
      card.classList.toggle('is-profile-link', clickable);
      if (!clickable) { card.removeAttribute('role'); card.removeAttribute('tabindex'); card.removeAttribute('aria-label'); delete card.dataset.rp4v4ProfilePlayerId; delete card.dataset.rp4v4ProfileAccountId; delete card.dataset.rp4v4ProfileSelf; return; }
      card.setAttribute('role','button'); card.tabIndex = 0; card.setAttribute('aria-label',`Open ${String(player?.playerName || 'Real Play player')} profile`);
      card.dataset.rp4v4ProfilePlayerId = playerId ? String(playerId) : ''; card.dataset.rp4v4ProfileAccountId = accountUserId ? String(accountUserId) : ''; card.dataset.rp4v4ProfileSelf = isSelf ? 'true' : 'false';
    });
  }
  function closeFourVFourView() {
    const view = activeView(); if (!view) return; closeInfo(); view.classList.remove('open'); view.setAttribute('aria-hidden','true'); document.body.classList.remove('rp-4v4-static-open');
  }
  function openPreferencePlayer(card) {
    if (!card?.classList?.contains('is-profile-link')) return;
    const isSelf = card.dataset.rp4v4ProfileSelf === 'true', playerId = positiveId(card.dataset.rp4v4ProfilePlayerId);
    if (isSelf && window.RealPlayProfile?.open) { closeFourVFourView(); requestAnimationFrame(() => window.RealPlayProfile.open()); return; }
    if (playerId && window.RealPlayPlayers?.openProfile) { closeFourVFourView(); requestAnimationFrame(() => window.RealPlayPlayers.openProfile(playerId)); }
  }

  async function load({ force = false } = {}) {
    const accessToken = token();
    if (!accessToken) { preferencePlayers=[]; viewerAccountUserId=null; lastData=null; render(null); bindPreferenceCards(); return; }
    const now = Date.now();
    if (!force && preferencePlayers.length && now - lastLoadedAt < 15000) { render(lastData); bindPreferenceCards(); return; }
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/4v4/me`, { headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`}, cache:'no-store' });
        if (!response.ok) throw new Error('Could not load 4v4 OVR preview.');
        const data = await response.json().catch(() => ({}));
        lastData=data; preferencePlayers=Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : []; viewerAccountUserId=positiveId(data?.userId); lastLoadedAt=Date.now();
        render(data); bindPreferenceCards();
      } catch (_) { render(lastData); bindPreferenceCards(); }
      finally { loadPromise = null; }
    })();
    return loadPromise;
  }
  function scheduleRefresh(delay=0, force=false) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { refreshTimer=null; load({force}); }, Math.max(0,delay));
  }

  ensureStyle();
  document.addEventListener('click', (event) => {
    const infoButton = event.target.closest?.('[data-rp-4v4-info-button], .rp-4v4-info-button');
    if (infoButton) { event.preventDefault(); event.stopPropagation(); openInfo(activeView()); return; }
    const tab = event.target.closest?.('[data-rp-4v4-info-tab]');
    if (tab) { selectInfoTab(tab.getAttribute('data-rp-4v4-info-tab') || 'ovr'); return; }
    if (event.target.closest?.('[data-rp-4v4-info-close]')) { closeInfo(); return; }
    const backdrop = event.target.closest?.('[data-rp-4v4-info-backdrop], .rp-4v4-info-backdrop');
    if (backdrop && event.target === backdrop) { closeInfo(); return; }
    const profileCard = event.target.closest?.('.rp-4v4-player-card.is-profile-link');
    if (profileCard) { event.preventDefault(); event.stopPropagation(); openPreferencePlayer(profileCard); return; }
    if (event.target.closest?.('[data-rp-4v4-prev],[data-rp-4v4-next],[data-rp-4v4-card]')) { requestAnimationFrame(() => { render(lastData); bindPreferenceCards(); }); return; }
    if (event.target.closest?.('[data-rp-4v4-preference-action],[data-rp-4v4-preference-cancel]')) scheduleRefresh(650,true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-rp-4v4-info-backdrop].open, .rp-4v4-info-backdrop.open')) { event.preventDefault(); closeInfo(); return; }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const profileCard = event.target.closest?.('.rp-4v4-player-card.is-profile-link');
    if (!profileCard) return;
    event.preventDefault(); openPreferencePlayer(profileCard);
  });

  const observer = new MutationObserver((mutations) => {
    let mounted=false, clubChanged=false, preferenceChanged=false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && [...mutation.addedNodes].some((node) => node instanceof HTMLElement && (node.matches?.('[data-rp-4v4-static-view]') || node.querySelector?.('[data-rp-4v4-static-view]')))) mounted=true;
      if (mutation.type === 'childList' && mutation.target instanceof HTMLElement && mutation.target.closest?.('[data-rp-4v4-preference-list]')) preferenceChanged=true;
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-rp-active-club') clubChanged=true;
    }
    if (mounted) scheduleRefresh(0,true); else if (clubChanged) { render(lastData); bindPreferenceCards(); } else if (preferenceChanged) bindPreferenceCards();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-rp-active-club']});
  if (activeView()) scheduleRefresh(0,true);
})();