(() => {
  if (window.__realPlayPlayerConnectionsInstalled) return;
  window.__realPlayPlayerConnectionsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CACHE_MS = 20000;
  const cache = new Map();
  let page = null;
  let pageState = null;
  let scanQueued = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function isVisitor() {
    return Boolean(window.RealPlayVisitor?.isActive?.());
  }

  function installStyles() {
    if (document.querySelector('[data-rp-player-connections-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPlayerConnectionsStyle = 'true';
    style.textContent = `
      .rp-player-connections-section{position:relative;overflow:hidden}
      .rp-player-connections-section::after{content:'';position:absolute;inset:auto -18% -60% 45%;height:120px;background:radial-gradient(circle,rgba(44,206,255,.08),transparent 68%);pointer-events:none}
      .rp-player-connections-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;position:relative;z-index:1}
      .rp-player-connection-preview{appearance:none;-webkit-appearance:none;min-width:0;min-height:118px;padding:13px 12px 12px;border:1px solid rgba(122,151,178,.18);border-radius:15px;background:linear-gradient(145deg,rgba(9,15,22,.96),rgba(4,8,13,.98));color:#eef8ff;text-align:left;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:9px;cursor:pointer;position:relative;overflow:hidden}
      .rp-player-connection-preview::before{content:'';position:absolute;left:0;top:15px;bottom:15px;width:2px;border-radius:3px;background:#2bcfff;opacity:.9}
      .rp-player-connection-preview.against::before{background:#ff4777}
      .rp-player-connection-preview>small{font-size:.52rem;line-height:1.18;font-weight:900;letter-spacing:.09em;color:#7c8d9e;max-width:100%}
      .rp-player-connection-preview>strong{font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.03rem;font-style:italic;font-weight:900;letter-spacing:.015em;line-height:1.02;color:#f7fbff;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rp-player-connection-preview>span{font-size:.55rem;font-weight:900;letter-spacing:.055em;color:#42d8ff;line-height:1.35}
      .rp-player-connection-preview.against>span{color:#ff6d91}
      .rp-player-connection-preview .rp-connection-arrow{position:absolute;right:10px;top:10px;color:#66798b;font-size:.8rem}
      .rp-player-connection-preview:focus-visible,.rp-connection-tab:focus-visible,.rp-connection-row:focus-visible,.rp-connections-back:focus-visible{outline:2px solid #42d8ff;outline-offset:2px}
      .rp-player-connection-preview[disabled]{cursor:default;opacity:.65}
      .rp-player-connections-page{position:fixed;inset:0;z-index:5200;background:radial-gradient(circle at 8% 5%,rgba(30,174,232,.09),transparent 30%),radial-gradient(circle at 95% 8%,rgba(231,42,91,.07),transparent 32%),#03070b;color:#eff8ff;overflow:auto;-webkit-overflow-scrolling:touch;display:none}
      .rp-player-connections-page.open{display:block}
      .rp-connections-shell{width:min(100%,720px);min-height:100%;margin:0 auto;padding:0 14px calc(28px + env(safe-area-inset-bottom))}
      .rp-connections-topbar{position:sticky;top:0;z-index:5;min-height:67px;padding:calc(10px + env(safe-area-inset-top)) 2px 10px;display:grid;grid-template-columns:44px minmax(0,1fr) 60px;align-items:center;gap:8px;background:linear-gradient(180deg,rgba(3,7,11,.98) 72%,rgba(3,7,11,.84));border-bottom:1px solid rgba(106,137,165,.12);backdrop-filter:blur(14px)}
      .rp-connections-back{width:42px;height:42px;border:1px solid rgba(118,151,181,.2);border-radius:12px;background:#071019;color:#e9f7ff;font-size:1.22rem;font-weight:900;cursor:pointer}
      .rp-connections-title{min-width:0;text-align:center;display:flex;flex-direction:column;gap:2px}
      .rp-connections-title small{font-size:.49rem;font-weight:900;letter-spacing:.15em;color:#42d8ff}
      .rp-connections-title strong{font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.08rem;font-style:italic;letter-spacing:.035em;color:#f7fbff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rp-connections-topbar>b{text-align:right;font-size:.48rem;letter-spacing:.1em;color:#657789}
      .rp-connections-identity{padding:24px 4px 16px}
      .rp-connections-identity small{display:block;font-size:.52rem;font-weight:900;letter-spacing:.13em;color:#6f8294;margin-bottom:5px}
      .rp-connections-identity h1{margin:0;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-style:italic;font-size:clamp(1.7rem,8vw,2.4rem);font-weight:900;line-height:1;color:#f8fbff}
      .rp-connection-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:5px;border:1px solid rgba(109,143,173,.18);border-radius:14px;background:#050b11;position:sticky;top:68px;z-index:4}
      .rp-connection-tab{min-height:44px;border:0;border-radius:10px;background:transparent;color:#788a9b;font-size:.57rem;font-weight:950;letter-spacing:.055em;cursor:pointer;padding:7px 6px}
      .rp-connection-tab.active{background:#0b1720;color:#4ad9ff;box-shadow:inset 0 0 0 1px rgba(63,211,255,.24)}
      .rp-connection-tab[data-mode="against"].active{color:#ff7597;box-shadow:inset 0 0 0 1px rgba(255,77,122,.24)}
      .rp-connections-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:19px 3px 10px}
      .rp-connections-summary strong{font-size:.66rem;letter-spacing:.08em;color:#aebdca}
      .rp-connections-summary span{font-size:.51rem;font-weight:900;letter-spacing:.08em;color:#607386}
      .rp-connections-list{display:grid;gap:9px;padding-bottom:24px}
      .rp-connection-row{appearance:none;-webkit-appearance:none;width:100%;border:1px solid rgba(107,139,167,.17);border-radius:16px;background:linear-gradient(145deg,#081019,#05090e);color:#eff8ff;padding:12px;display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:11px;text-align:left;cursor:pointer}
      .rp-connection-avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#0b1b25;border:1px solid rgba(69,207,247,.2);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:.95rem;font-style:italic;color:#43d7ff}
      .rp-connection-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .rp-connection-main{min-width:0}
      .rp-connection-main small{display:block;margin-bottom:3px;font-size:.48rem;font-weight:900;letter-spacing:.08em;color:#6f8293}
      .rp-connection-main strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-style:italic;font-size:1rem;letter-spacing:.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f7fbff}
      .rp-connection-main span{display:block;margin-top:4px;font-size:.51rem;font-weight:900;letter-spacing:.055em;color:#42d8ff}
      .rp-connection-list-against .rp-connection-main span{color:#ff7597}
      .rp-connection-numbers{display:grid;grid-template-columns:repeat(2,auto);gap:5px 11px;text-align:right;align-items:end}
      .rp-connection-numbers b{font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:.94rem;font-style:italic;color:#f8fbff;line-height:1}
      .rp-connection-numbers small{font-size:.42rem;font-weight:900;letter-spacing:.06em;color:#637587}
      .rp-connections-empty{padding:28px 18px;border:1px dashed rgba(111,145,175,.2);border-radius:16px;text-align:center;background:#050a0f}
      .rp-connections-empty strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-style:italic;font-size:1.1rem;color:#edf8ff}
      .rp-connections-empty span{display:block;margin-top:7px;font-size:.56rem;font-weight:800;line-height:1.5;letter-spacing:.04em;color:#708397}
      body.rp-player-connections-open{overflow:hidden!important}
      @media(max-width:360px){
        .rp-player-connections-preview{gap:7px}
        .rp-player-connection-preview{padding:12px 9px;min-height:112px}
        .rp-player-connection-preview>small{font-size:.47rem;letter-spacing:.055em}
        .rp-connection-row{grid-template-columns:42px minmax(0,1fr);gap:9px}
        .rp-connection-avatar{width:42px;height:42px}
        .rp-connection-numbers{grid-column:2;justify-content:start;text-align:left;grid-template-columns:repeat(4,auto);gap:4px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  async function requestConnections(playerId = null) {
    const accessToken = token();
    const visitor = isVisitor();
    const url = accessToken
      ? `${API_BASE_URL}/api/real-play/community`
      : `${API_BASE_URL}/api/real-play/public/community`;

    if (!accessToken && !visitor) throw new Error('Please log in to Real Play first.');
    if (!accessToken && !positiveId(playerId)) throw new Error('Player connection history is unavailable.');

    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const body = { action: 'player_connections' };
    if (positiveId(playerId)) body.playerId = positiveId(playerId);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load player connections.');
    return data?.connections || { mostPlayedWith: [], mostPlayedAgainst: [] };
  }

  function profileName(profile) {
    return String(
      profile?.__realPlayPublicPlayer?.playerName
      || profile?.querySelector('.rp-profile-name h1')?.textContent
      || profile?.querySelector('.rp-profile-player h1')?.textContent
      || 'REAL PLAY PLAYER'
    ).trim();
  }

  function previewMarkup(mode, item, loading = false) {
    const withPlayer = mode === 'with';
    const label = withPlayer ? 'MOST PLAYED WITH' : 'MOST PLAYED AGAINST';
    const className = withPlayer ? '' : ' against';
    if (loading) {
      return `<button type="button" class="rp-player-connection-preview${className}" disabled><small>${label}</small><strong>LOADING...</strong><span>FINALIZED GAMES</span></button>`;
    }
    if (!item) {
      return `<button type="button" class="rp-player-connection-preview${className}" data-rp-connections-open="${mode}"><small>${label}</small><strong>NO HISTORY YET</strong><span>0 FINALIZED GAMES</span><b class="rp-connection-arrow">›</b></button>`;
    }
    const gamesLabel = `${item.games} GAME${Number(item.games) === 1 ? '' : 'S'}`;
    const rate = item.winRate === null || item.winRate === undefined ? '—' : `${Math.round(Number(item.winRate) || 0)}%`;
    return `<button type="button" class="rp-player-connection-preview${className}" data-rp-connections-open="${mode}"><small>${label}</small><strong>${esc(item.playerName || 'REAL PLAY PLAYER')}</strong><span>${esc(gamesLabel)} · ${esc(rate)} WIN RATE</span><b class="rp-connection-arrow">›</b></button>`;
  }

  function renderSection(section, connections, name) {
    const withList = Array.isArray(connections?.mostPlayedWith) ? connections.mostPlayedWith : [];
    const againstList = Array.isArray(connections?.mostPlayedAgainst) ? connections.mostPlayedAgainst : [];
    const data = {
      playerId: positiveId(connections?.playerId),
      playerName: connections?.playerName || name || 'REAL PLAY PLAYER',
      mostPlayedWith: withList,
      mostPlayedAgainst: againstList,
    };
    section.__rpConnectionsData = data;
    section.innerHTML = `
      <div class="rp-profile-section-head"><div><small>PLAYER CONNECTIONS</small><h2>WHO YOU SHARE THE COURT WITH.</h2></div><span>FINALIZED GAMES</span></div>
      <div class="rp-player-connections-preview">
        ${previewMarkup('with', withList[0])}
        ${previewMarkup('against', againstList[0])}
      </div>`;
    section.querySelectorAll('[data-rp-connections-open]').forEach((button) => {
      button.addEventListener('click', () => openPage(button.dataset.rpConnectionsOpen, data));
    });
  }

  function renderLoading(section) {
    section.innerHTML = `
      <div class="rp-profile-section-head"><div><small>PLAYER CONNECTIONS</small><h2>WHO YOU SHARE THE COURT WITH.</h2></div><span>FINALIZED GAMES</span></div>
      <div class="rp-player-connections-preview">
        ${previewMarkup('with', null, true)}
        ${previewMarkup('against', null, true)}
      </div>`;
  }

  function renderUnavailable(section, name) {
    const data = { playerName: name || 'REAL PLAY PLAYER', mostPlayedWith: [], mostPlayedAgainst: [] };
    section.__rpConnectionsData = data;
    section.innerHTML = `
      <div class="rp-profile-section-head"><div><small>PLAYER CONNECTIONS</small><h2>WHO YOU SHARE THE COURT WITH.</h2></div><span>FINALIZED GAMES</span></div>
      <div class="rp-connections-empty"><strong>CONNECTION DATA UNAVAILABLE.</strong><span>YOUR PROFILE AND RECENT GAMES ARE STILL AVAILABLE.</span></div>`;
  }

  function createSection(profile) {
    const statGrid = profile.querySelector('.rp-profile-stat-grid');
    const metricsSection = statGrid?.closest('.rp-profile-section');
    if (!metricsSection) return null;

    let section = profile.querySelector('[data-rp-player-connections]');
    if (section) return section;

    section = document.createElement('section');
    section.className = 'rp-profile-section rp-player-connections-section';
    section.dataset.rpPlayerConnections = 'true';
    metricsSection.insertAdjacentElement('afterend', section);
    return section;
  }

  async function enhanceProfile(profile) {
    if (!profile?.classList?.contains('open')) return;
    const section = createSection(profile);
    if (!section || section.dataset.rpConnectionsLoading === 'true' || section.dataset.rpConnectionsReady === 'true') return;

    const playerId = positiveId(profile.dataset.rpPublicPlayerId);
    const ownProfile = Boolean(profile.matches('[data-rp-profile]') && !profile.matches('.rp-public-player-profile'));
    if (!playerId && !ownProfile) return;

    const key = playerId ? `player:${playerId}` : 'me';
    const name = profileName(profile);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      section.dataset.rpConnectionsReady = 'true';
      renderSection(section, cached.data, name);
      return;
    }

    section.dataset.rpConnectionsLoading = 'true';
    renderLoading(section);
    try {
      const data = await requestConnections(playerId);
      if (!section.isConnected || !profile.classList.contains('open')) return;
      cache.set(key, { at: Date.now(), data });
      section.dataset.rpConnectionsReady = 'true';
      renderSection(section, data, name);
    } catch (_error) {
      if (section.isConnected) renderUnavailable(section, name);
    } finally {
      if (section.isConnected) delete section.dataset.rpConnectionsLoading;
    }
  }

  function connectionInitials(item) {
    if (item?.playerNumber !== null && item?.playerNumber !== undefined && item?.playerNumber !== '') {
      return `#${Number(item.playerNumber)}`;
    }
    const parts = String(item?.playerName || 'RP').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]).join('') || 'RP').toUpperCase();
  }

  function avatarMarkup(item) {
    if (item?.avatarUrl) return `<img src="${esc(item.avatarUrl)}" alt="">`;
    return esc(connectionInitials(item));
  }

  function listMarkup(mode, data) {
    const isWith = mode === 'with';
    const items = isWith ? data.mostPlayedWith : data.mostPlayedAgainst;
    if (!items.length) {
      return `<div class="rp-connections-empty"><strong>${isWith ? 'NO TEAMMATE HISTORY YET.' : 'NO OPPONENT HISTORY YET.'}</strong><span>FINALIZED GAMES WILL BUILD THIS CONNECTION HISTORY AUTOMATICALLY.</span></div>`;
    }

    return items.map((item) => {
      const games = Math.max(0, Number(item.games || 0));
      const wins = Math.max(0, Number(item.wins || item.record?.wins || 0));
      const losses = Math.max(0, Number(item.losses || item.record?.losses || 0));
      const rate = item.winRate === null || item.winRate === undefined
        ? (games > 0 ? Math.round((wins / games) * 100) : 0)
        : Math.round(Number(item.winRate) || 0);
      const context = isWith
        ? `${games} GAME${games === 1 ? '' : 'S'} TOGETHER`
        : `${games} GAME${games === 1 ? '' : 'S'} AGAINST`;
      return `
        <button type="button" class="rp-connection-row" data-rp-connection-player="${esc(item.playerId)}">
          <span class="rp-connection-avatar">${avatarMarkup(item)}</span>
          <span class="rp-connection-main"><small>${esc(context)}</small><strong>${esc(item.playerName || 'REAL PLAY PLAYER')}</strong><span>${isWith ? 'TEAMMATE HISTORY' : 'MATCHUP HISTORY'}</span></span>
          <span class="rp-connection-numbers"><b>${wins}-${losses}</b><small>RECORD</small><b>${rate}%</b><small>WIN RATE</small></span>
        </button>`;
    }).join('');
  }

  function createPage() {
    if (page) return page;
    page = document.createElement('section');
    page.className = 'rp-player-connections-page';
    page.dataset.rpPlayerConnectionsPage = 'true';
    page.setAttribute('aria-hidden', 'true');
    page.innerHTML = `
      <div class="rp-connections-shell">
        <header class="rp-connections-topbar">
          <button type="button" class="rp-connections-back" data-rp-connections-back aria-label="Back to player profile">←</button>
          <div class="rp-connections-title"><small>PLAYER PROFILE</small><strong>PLAYER CONNECTIONS</strong></div>
          <b>REAL PLAY</b>
        </header>
        <main>
          <div class="rp-connections-identity"><small>CONNECTION HISTORY</small><h1 data-rp-connections-name>REAL PLAY PLAYER</h1></div>
          <div class="rp-connection-tabs" role="tablist" aria-label="Player connection filters">
            <button type="button" class="rp-connection-tab" data-rp-connections-mode="with" role="tab">MOST PLAYED WITH</button>
            <button type="button" class="rp-connection-tab" data-rp-connections-mode="against" role="tab">MOST PLAYED AGAINST</button>
          </div>
          <div class="rp-connections-summary"><strong data-rp-connections-heading></strong><span>FINALIZED GAMES ONLY</span></div>
          <div class="rp-connections-list" data-rp-connections-list></div>
        </main>
      </div>`;
    document.body.appendChild(page);
    page.querySelector('[data-rp-connections-back]')?.addEventListener('click', closePage);
    page.querySelectorAll('[data-rp-connections-mode]').forEach((button) => {
      button.addEventListener('click', () => renderPage(button.dataset.rpConnectionsMode));
    });
    page.querySelector('[data-rp-connections-list]')?.addEventListener('click', handleConnectionPlayerClick);
    return page;
  }

  function renderPage(mode = 'with') {
    if (!pageState) return;
    const safeMode = mode === 'against' ? 'against' : 'with';
    pageState.mode = safeMode;
    const list = safeMode === 'with' ? pageState.data.mostPlayedWith : pageState.data.mostPlayedAgainst;
    page.querySelectorAll('[data-rp-connections-mode]').forEach((button) => {
      const active = button.dataset.rpConnectionsMode === safeMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const name = page.querySelector('[data-rp-connections-name]');
    if (name) name.textContent = pageState.data.playerName || 'REAL PLAY PLAYER';
    const heading = page.querySelector('[data-rp-connections-heading]');
    if (heading) heading.textContent = safeMode === 'with' ? 'TEAMMATES BY GAMES PLAYED' : 'OPPONENTS BY GAMES PLAYED';
    const root = page.querySelector('[data-rp-connections-list]');
    if (root) {
      root.classList.toggle('rp-connection-list-against', safeMode === 'against');
      root.innerHTML = listMarkup(safeMode, pageState.data);
    }
  }

  function openPage(mode, data) {
    createPage();
    pageState = { mode, data };
    renderPage(mode);
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-player-connections-open');
    page.scrollTop = 0;
  }

  function closePage() {
    if (!page) return;
    page.classList.remove('open');
    page.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-player-connections-open');
  }

  function handleConnectionPlayerClick(event) {
    const row = event.target.closest('[data-rp-connection-player]');
    const playerId = positiveId(row?.dataset.rpConnectionPlayer);
    if (!playerId) return;
    closePage();

    if (document.querySelector('[data-rp-profile].open:not(.rp-public-player-profile)')) {
      window.RealPlayProfile?.close?.();
    }
    if (isVisitor()) window.RealPlayVisitorPublicProfile?.close?.();

    window.setTimeout(() => {
      const directoryRow = [...document.querySelectorAll('[data-world-player-id]')]
        .find((node) => positiveId(node.dataset.worldPlayerId) === playerId);
      if (directoryRow) {
        directoryRow.click();
        return;
      }
      window.RealPlayPlayers?.openProfile?.(playerId);
    }, 40);
  }

  function scanProfiles() {
    scanQueued = false;
    document.querySelectorAll('.rp-profile.open').forEach((profile) => {
      if (profile.matches('[data-rp-player-connections-page]')) return;
      enhanceProfile(profile);
    });
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    window.setTimeout(scanProfiles, 0);
  }

  installStyles();
  createPage();

  const observer = new MutationObserver(queueScan);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-rp-public-player-id'] });
  window.addEventListener('realplay:public-profile-loaded', queueScan);
  window.addEventListener('realplay:app-ready', queueScan);
  window.addEventListener('focus', queueScan);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && page?.classList.contains('open')) {
      event.stopImmediatePropagation();
      closePage();
    }
  }, true);
  queueScan();
})();