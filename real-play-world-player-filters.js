(() => {
  if (window.__realPlayWorldPlayerFiltersInstalled) return;
  window.__realPlayWorldPlayerFiltersInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;

  // Rank authority is relatively stable. Do not turn ordinary DOM changes into
  // network traffic. A one-minute cache is more than fresh enough for the World
  // list while keeping the community endpoint healthy.
  const RANK_AUTHORITY_TTL_MS = 60_000;
  const DEFAULT_429_BACKOFF_MS = 60_000;

  let panel = null;
  let controls = null;
  let list = null;
  let listObserver = null;
  let sortKey = 'name';
  let filterMode = 'all';
  const directions = { rank: 'asc', ovr: 'desc', winrate: 'desc', name: 'asc', jersey: 'asc' };
  let scheduled = false;
  let rankByUserId = new Map();
  let rankByAccountUserId = new Map();
  let rankAuthorityReady = false;
  let rankRefreshPromise = null;
  let rankAuthorityAt = 0;
  let rankBackoffUntil = 0;
  let ownWorldPlayerId = '';
  let ownAccountUserId = '';

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-filter-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerFilterStyles = '1';
    style.textContent = `
      .rp-world-player-sort{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:2px 0 1px}
      .rp-world-player-sort button{min-width:0;min-height:36px;padding:0 5px;border:1px solid rgba(255,255,255,.07);border-radius:11px;color:#64758a;background:#060b12;font-family:var(--rp-display,Arial,sans-serif);font-size:.45rem;font-weight:950;letter-spacing:.045em;white-space:nowrap}
      .rp-world-player-sort button.active{color:#dff9ff;border-color:rgba(54,205,255,.25);background:rgba(24,111,164,.11)}
      .rp-world-player-sort button.active b{color:#49d8ff}
      .rp-world-player-sort button:focus-visible{outline:2px solid rgba(72,215,255,.65);outline-offset:2px}
      .rp-world-player-sort b{margin-left:3px;color:#52667b;font-size:.55rem}
      .rp-world-player-directory-head{position:relative}
      .rp-world-player-row[hidden]{display:none!important}
      .rp-world-player-row{min-height:58px}
      .rp-world-player-row .rp-world-player-winrate{display:none!important}
      .rp-world-player-row .rp-world-player-metrics{gap:0}
      .rp-world-player-rank-badge{display:none;flex:none;min-width:38px;margin-right:2px;color:#48d8ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.18rem;font-style:italic;font-weight:1000;line-height:1;letter-spacing:-.035em;text-align:left;text-shadow:0 0 16px rgba(72,216,255,.28)}
      .rp-world-player-rank-badge.is-visible{display:inline-block}
      .rp-world-player-ovr-info{position:absolute;top:0;right:1px;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(72,216,255,.24);border-radius:50%;background:rgba(5,12,19,.82);color:#48d8ff;font-family:Georgia,serif;font-size:1rem;font-style:italic;font-weight:900;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);z-index:2}
      .rp-world-player-ovr-info:hover{border-color:rgba(72,216,255,.46);background:rgba(13,54,72,.35)}
      .rp-world-player-ovr-info:active{transform:scale(.96)}
      .rp-world-player-ovr-info:focus-visible{outline:2px solid rgba(72,215,255,.7);outline-offset:2px}
      @media(max-width:420px){
        .rp-world-player-sort{gap:4px}
        .rp-world-player-sort button{padding-inline:3px;font-size:.39rem;letter-spacing:.025em}
        .rp-world-player-rank-badge{min-width:34px;font-size:1.08rem}
        .rp-world-player-row{min-height:56px}
      }
      @media(max-width:360px){.rp-world-player-sort button{font-size:.36rem;letter-spacing:.015em}.rp-world-player-ovr-info{width:34px;height:34px}.rp-world-player-rank-badge{min-width:31px;font-size:1rem}}
    `;
    document.head.appendChild(style);
  }

  function retryAfterMs(response) {
    const raw = String(response?.headers?.get?.('Retry-After') || '').trim();
    if (!raw) return DEFAULT_429_BACKOFF_MS;

    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.max(DEFAULT_429_BACKOFF_MS, seconds * 1000);
    }

    const date = new Date(raw);
    const delta = date.getTime() - Date.now();
    return Number.isFinite(delta) && delta > 0
      ? Math.max(DEFAULT_429_BACKOFF_MS, delta)
      : DEFAULT_429_BACKOFF_MS;
  }

  function absorbRankAuthority(data) {
    const nextByPlayer = new Map();
    const nextByAccount = new Map();

    (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
      const playerId = String(player?.playerId ?? player?.userId ?? '').trim();
      const accountUserId = String(player?.accountUserId ?? '').trim();
      const rank = Number(player?.rank);
      if (!Number.isFinite(rank) || rank <= 0) return;
      if (playerId) nextByPlayer.set(playerId, rank);
      if (accountUserId) nextByAccount.set(accountUserId, rank);
    });

    rankByUserId = nextByPlayer;
    rankByAccountUserId = nextByAccount;
    ownWorldPlayerId = String(data?.meUserId ?? '').trim();
    ownAccountUserId = String(data?.meAccountUserId ?? '').trim();
    rankAuthorityReady = true;
    rankAuthorityAt = Date.now();
    rankBackoffUntil = 0;
  }

  async function refreshRankAuthority(force = false) {
    const now = Date.now();

    // 429 backoff is absolute. A forced UI refresh is never allowed to bypass it.
    if (now < rankBackoffUntil) return;
    if (!force && rankAuthorityReady && now - rankAuthorityAt < RANK_AUTHORITY_TTL_MS) return;
    if (rankRefreshPromise) return rankRefreshPromise;

    rankRefreshPromise = (async () => {
      try {
        const accessToken = localStorage.getItem(TOKEN_KEY) || '';
        if (!accessToken) return;

        const response = await fetch(COMMUNITY_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action: 'players' }),
          cache: 'no-store',
        });

        if (response.status === 429) {
          rankBackoffUntil = Date.now() + retryAfterMs(response);
          return;
        }
        if (!response.ok) return;

        const data = await response.json().catch(() => ({}));
        absorbRankAuthority(data);
      } catch (_error) {
        // Keep the last known authority. World sorting must remain usable even
        // when the network is temporarily unavailable.
      } finally {
        rankRefreshPromise = null;
      }
    })();

    return rankRefreshPromise;
  }

  function ownRankFromAuthority() {
    if (!rankAuthorityReady) return null;
    if (ownWorldPlayerId && rankByUserId.has(ownWorldPlayerId)) {
      return rankByUserId.get(ownWorldPlayerId);
    }
    if (ownAccountUserId && rankByAccountUserId.has(ownAccountUserId)) {
      return rankByAccountUserId.get(ownAccountUserId);
    }
    return null;
  }

  function renderAuthoritativeProfileRank(rank) {
    const numericRank = Number(rank);
    const hasRank = Number.isFinite(numericRank) && numericRank > 0;
    const ownProfile = document.querySelector('.rp-profile.open:not(.rp-public-player-profile)');
    if (!ownProfile) return;

    ownProfile.querySelectorAll('.rp-profile-rank').forEach((node) => {
      const strong = node.querySelector('strong');
      const small = node.querySelector('small');
      if (!strong) return;
      const nextStrong = hasRank ? `#${numericRank}` : '—';
      const nextSmall = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
      if (strong.textContent !== nextStrong) strong.textContent = nextStrong;
      if (small && small.textContent !== nextSmall) small.textContent = nextSmall;
    });
  }

  function publicRankFromAuthority(profile, player) {
    if (!rankAuthorityReady) return null;
    const playerId = String(player?.playerId ?? profile?.dataset?.rpPublicPlayerId ?? player?.userId ?? '').trim();
    const accountUserId = String(player?.accountUserId ?? '').trim();
    if (playerId && rankByUserId.has(playerId)) return rankByUserId.get(playerId);
    if (accountUserId && rankByAccountUserId.has(accountUserId)) return rankByAccountUserId.get(accountUserId);
    return null;
  }

  function enforcePublicProfileRank() {
    if (!rankAuthorityReady) return;
    document.querySelectorAll('.rp-public-player-profile').forEach((profile) => {
      const player = profile.__realPlayPublicPlayer || null;
      if (!player) return;
      const rank = publicRankFromAuthority(profile, player);
      const numericRank = Number(rank);
      const hasRank = Number.isFinite(numericRank) && numericRank > 0;
      profile.querySelectorAll('.rp-profile-rank').forEach((node) => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (!strong) return;
        const nextStrong = hasRank ? `#${numericRank}` : '—';
        const nextSmall = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
        if (strong.textContent !== nextStrong) strong.textContent = nextStrong;
        if (small && small.textContent !== nextSmall) small.textContent = nextSmall;
      });
    });
  }

  function applyCachedRankAuthority() {
    if (!rankAuthorityReady) return;
    enforcePublicProfileRank();
    renderAuthoritativeProfileRank(ownRankFromAuthority());
  }

  async function enforceRankAuthority(force = false) {
    await refreshRankAuthority(force);
    applyCachedRankAuthority();
    scheduleSort();
  }

  function rowMeta(row) {
    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || '').trim();
    const jerseyText = String(row.querySelector('.rp-world-player-name b')?.textContent || '').trim();
    const jerseyMatch = jerseyText.match(/#\s*(\d{1,2})/);
    const jersey = jerseyMatch ? Number(jerseyMatch[1]) : null;
    const ovrNode = row.querySelector('.rp-world-player-ovr');
    const ovrText = String(ovrNode?.textContent || '').trim();
    const missingOvr = !ovrNode || ovrNode.classList.contains('unranked') || /UNRANKED/i.test(ovrText);
    const ovr = missingOvr
      ? null
      : Number.parseFloat(ovrText.replace(/[^0-9.\-]/g, ''));
    const winRateNode = row.querySelector('.rp-world-player-winrate');
    const winRateText = String(winRateNode?.textContent || '').trim();
    const missingWinRate = !winRateNode || winRateNode.classList.contains('empty') || /^—/.test(winRateText);
    const winrate = missingWinRate
      ? null
      : Number.parseFloat(winRateText.replace(/[^0-9.\-]/g, ''));
    const userId = String(row.dataset.worldPlayerId || '').trim();
    const ranked = rankAuthorityReady ? rankByUserId.has(userId) : false;

    return {
      row,
      name,
      jersey: Number.isFinite(jersey) ? jersey : null,
      ovr: Number.isFinite(ovr) ? ovr : null,
      winrate: Number.isFinite(winrate) ? winrate : null,
      rank: rankByUserId.get(userId) ?? null,
      ranked,
    };
  }

  function renderRowRank(meta) {
    const nameNode = meta?.row?.querySelector('.rp-world-player-name');
    if (!nameNode) return;

    let badge = nameNode.querySelector('.rp-world-player-rank-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-world-player-rank-badge';
      badge.setAttribute('aria-hidden', 'true');
      nameNode.prepend(badge);
    }

    const numericRank = Number(meta.rank);
    const hasOfficialRank = Number.isSafeInteger(numericRank) && numericRank > 0;
    badge.textContent = hasOfficialRank ? `#${numericRank}` : '';
    badge.classList.toggle('is-visible', filterMode === 'ranked' && hasOfficialRank);
    meta.row.dataset.officialRank = hasOfficialRank ? String(numericRank) : '';
  }

  function compareName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  }

  function compareNullableNumber(a, b, key, direction) {
    const av = a[key];
    const bv = b[key];
    const aMissing = av === null || av === undefined;
    const bMissing = bv === null || bv === undefined;
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (aMissing && bMissing) return compareName(a, b);
    if (av === bv) return compareName(a, b);
    return direction === 'asc' ? av - bv : bv - av;
  }

  function matchesFilter(meta) {
    if (filterMode === 'ranked') return meta.ranked;
    if (filterMode === 'unranked') return !meta.ranked;
    return true;
  }

  function visibleRows() {
    if (!list) return [];
    return [...list.querySelectorAll('.rp-world-player-row')].map(rowMeta).filter(matchesFilter);
  }

  function sortedRows() {
    const rows = visibleRows();
    const direction = directions[sortKey];
    rows.sort((a, b) => {
      if (sortKey === 'rank') return compareNullableNumber(a, b, 'rank', direction);
      if (sortKey === 'ovr') return compareNullableNumber(a, b, 'ovr', direction);
      if (sortKey === 'winrate') return compareNullableNumber(a, b, 'winrate', direction);
      if (sortKey === 'jersey') return compareNullableNumber(a, b, 'jersey', direction);
      const result = compareName(a, b);
      return direction === 'asc' ? result : -result;
    });
    return rows.map((item) => item.row);
  }

  function updateVisibility() {
    if (!list) return;
    [...list.querySelectorAll('.rp-world-player-row')].forEach((row) => {
      const meta = rowMeta(row);
      renderRowRank(meta);
      const visible = matchesFilter(meta);
      row.hidden = !visible;
      row.setAttribute('aria-hidden', String(!visible));
      if (visible) row.style.removeProperty('display');
      else row.style.setProperty('display', 'none', 'important');
    });
  }

  function observeList() {
    if (!listObserver || !list) return;
    listObserver.observe(list, { childList: true });
  }

  function applySort() {
    scheduled = false;
    if (!list) return;

    updateVisibility();
    const allRows = [...list.querySelectorAll('.rp-world-player-row')];
    const nextVisible = sortedRows();
    if (!allRows.length) return;

    const hiddenRows = allRows.filter((row) => row.hidden);
    const ordered = [...nextVisible, ...hiddenRows];
    const alreadyOrdered = allRows.length === ordered.length
      && allRows.every((row, index) => row === ordered[index]);

    if (!alreadyOrdered) {
      // Do not let our own DOM reorder wake the observer and schedule another
      // sorting cycle.
      listObserver?.disconnect();
      const fragment = document.createDocumentFragment();
      ordered.forEach((row) => fragment.appendChild(row));
      list.appendChild(fragment);
      observeList();
    }

    const count = panel?.querySelector('[data-world-player-count]');
    if (count) {
      const visibleCount = nextVisible.length;
      count.textContent = `${visibleCount} PLAYER${visibleCount === 1 ? '' : 'S'}`;
    }
  }

  function scheduleSort() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      applySort();
      // Important: sorting and DOM mutations are local-only operations. They
      // must never perform a community API request.
      applyCachedRankAuthority();
    });
  }

  function directionArrow(key) {
    if (key === 'ranked' && filterMode === 'ranked') return '↑';
    if (key !== sortKey) return '';
    return directions[key] === 'asc' ? '↑' : '↓';
  }

  function renderControls() {
    if (!controls) return;
    controls.querySelectorAll('[data-player-sort]').forEach((button) => {
      const key = button.dataset.playerSort;
      const active = key === filterMode || (key === sortKey && filterMode === 'all');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const arrow = button.querySelector('b');
      if (arrow) arrow.textContent = directionArrow(key);
    });
  }

  function selectControl(key) {
    if (!['ranked', 'unranked', 'winrate', 'name', 'jersey'].includes(key)) return;

    if (key === 'ranked') {
      filterMode = 'ranked';
      sortKey = 'rank';
      directions.rank = 'asc';
      refreshRankAuthority(false).then(scheduleSort);
    } else if (key === 'unranked') {
      filterMode = 'unranked';
      sortKey = 'name';
      directions.name = 'asc';
      refreshRankAuthority(false).then(scheduleSort);
    } else if (key === 'winrate') {
      filterMode = 'all';
      if (sortKey === 'winrate') directions.winrate = directions.winrate === 'desc' ? 'asc' : 'desc';
      else {
        sortKey = 'winrate';
        directions.winrate = 'desc';
      }
    } else if (key === 'name') {
      filterMode = 'all';
      if (sortKey === 'name') directions.name = directions.name === 'asc' ? 'desc' : 'asc';
      else {
        sortKey = 'name';
        directions.name = 'asc';
      }
    } else if (key === 'jersey') {
      filterMode = 'all';
      if (sortKey === 'jersey') directions.jersey = directions.jersey === 'asc' ? 'desc' : 'asc';
      else {
        sortKey = 'jersey';
        directions.jersey = 'asc';
      }
    }

    renderControls();
    scheduleSort();
  }

  function ensureOvrInfoButton(playersView) {
    const header = playersView?.querySelector('.rp-world-player-directory-head');
    if (!header || header.querySelector('[data-world-ovr-simulator]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-world-player-ovr-info';
    button.dataset.worldOvrSimulator = 'true';
    button.setAttribute('aria-label', 'Open OVR simulator and calculation guide');
    button.title = 'How OVR works';
    button.textContent = 'i';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = 'ovr-simulator.html';
    });
    header.appendChild(button);
  }

  function install() {
    panel = document.querySelector('[data-rp-world]');
    if (!panel) return false;

    const playersView = panel.querySelector('[data-world-view="players"]');
    list = playersView?.querySelector('[data-world-player-list]') || null;
    const status = playersView?.querySelector('[data-world-player-status]') || null;
    if (!playersView || !list || !status) return false;

    ensureOvrInfoButton(playersView);

    controls = playersView.querySelector('[data-world-player-sort]');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'rp-world-player-sort';
      controls.dataset.worldPlayerSort = 'true';
      controls.setAttribute('aria-label', 'Filter and sort players');
      controls.innerHTML = `
        <button type="button" data-player-sort="ranked" aria-pressed="false">RANK OVR <b></b></button>
        <button type="button" data-player-sort="unranked" aria-pressed="false">UNRANK OVR <b></b></button>
        <button type="button" data-player-sort="winrate" aria-pressed="false">WIN RATE <b></b></button>
        <button type="button" data-player-sort="name" aria-pressed="true">NAME <b></b></button>
        <button type="button" data-player-sort="jersey" aria-pressed="false">JERSEY # <b></b></button>`;
      status.insertAdjacentElement('beforebegin', controls);
      controls.addEventListener('click', (event) => {
        const button = event.target.closest('[data-player-sort]');
        if (!button) return;
        selectControl(button.dataset.playerSort);
      });
    }

    renderControls();
    if (listObserver) listObserver.disconnect();
    listObserver = new MutationObserver(() => scheduleSort());
    observeList();
    scheduleSort();

    // One authority request at installation. After this, normal rendering,
    // profile opening and DOM mutations reuse the cached result.
    enforceRankAuthority(false);
    return true;
  }

  installStyles();
  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('realplay:public-profile-loaded', () => {
    // A public profile already carries its own player data. Reuse cached rank
    // authority immediately, and only refresh if the minute-long cache expired.
    applyCachedRankAuthority();
    refreshRankAuthority(false).then(applyCachedRankAuthority);
  });

  // This observer is intentionally render-only. The old implementation called
  // the API from here, which meant unrelated class animations across the entire
  // document could trigger /community requests every few seconds.
  const profileObserver = new MutationObserver(() => {
    window.clearTimeout(window.__rpRankAuthorityRenderTimer);
    window.__rpRankAuthorityRenderTimer = window.setTimeout(applyCachedRankAuthority, 60);
  });
  profileObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
})();