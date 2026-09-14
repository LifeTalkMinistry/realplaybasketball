(() => {
  if (window.__realPlayWorldPlayerFiltersInstalled) return;
  window.__realPlayWorldPlayerFiltersInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const PROFILE_URL = `${API_BASE_URL}/api/real-play/me`;

  let panel = null;
  let controls = null;
  let list = null;
  let listObserver = null;
  let sortKey = 'name';
  let filterMode = 'all';
  const directions = { ovr: 'desc', name: 'asc', jersey: 'asc' };
  let scheduled = false;
  let rankByUserId = new Map();
  let rankAuthorityReady = false;
  let rankRefreshPromise = null;
  let profileRankRefreshPromise = null;

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-filter-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerFilterStyles = '1';
    style.textContent = `
      .rp-world-player-sort{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:2px 0 1px}
      .rp-world-player-sort button{min-width:0;min-height:36px;padding:0 7px;border:1px solid rgba(255,255,255,.07);border-radius:11px;color:#64758a;background:#060b12;font-family:var(--rp-display,Arial,sans-serif);font-size:.48rem;font-weight:950;letter-spacing:.06em;white-space:nowrap}
      .rp-world-player-sort button.active{color:#dff9ff;border-color:rgba(54,205,255,.25);background:rgba(24,111,164,.11)}
      .rp-world-player-sort button.active b{color:#49d8ff}
      .rp-world-player-sort button:focus-visible{outline:2px solid rgba(72,215,255,.65);outline-offset:2px}
      .rp-world-player-sort b{margin-left:3px;color:#52667b;font-size:.55rem}
      .rp-world-player-directory-head{position:relative}
      .rp-world-player-ovr-info{position:absolute;top:0;right:1px;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(72,216,255,.24);border-radius:50%;background:rgba(5,12,19,.82);color:#48d8ff;font-family:Georgia,serif;font-size:1rem;font-style:italic;font-weight:900;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);z-index:2}
      .rp-world-player-ovr-info:hover{border-color:rgba(72,216,255,.46);background:rgba(13,54,72,.35)}
      .rp-world-player-ovr-info:active{transform:scale(.96)}
      .rp-world-player-ovr-info:focus-visible{outline:2px solid rgba(72,215,255,.7);outline-offset:2px}
      @media(max-width:420px){
        .rp-world-player-sort{gap:5px}
        .rp-world-player-sort button{padding-inline:4px;font-size:.43rem;letter-spacing:.045em}
      }
      @media(max-width:360px){.rp-world-player-sort button{font-size:.39rem;letter-spacing:.03em}.rp-world-player-ovr-info{width:34px;height:34px}}
    `;
    document.head.appendChild(style);
  }

  async function refreshRankAuthority() {
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
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        const next = new Map();
        (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
          const userId = String(player?.userId ?? '').trim();
          const rank = Number(player?.rank);
          if (userId && Number.isFinite(rank) && rank > 0) next.set(userId, rank);
        });
        rankByUserId = next;
        rankAuthorityReady = true;
      } finally {
        rankRefreshPromise = null;
      }
    })();
    return rankRefreshPromise;
  }

  async function refreshOwnProfileRank() {
    if (profileRankRefreshPromise) return profileRankRefreshPromise;
    profileRankRefreshPromise = (async () => {
      try {
        const accessToken = localStorage.getItem(TOKEN_KEY) || '';
        if (!accessToken) return null;
        const response = await fetch(PROFILE_URL, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        return data?.rank ?? data?.career?.rank ?? data?.careerStats?.rank ?? null;
      } finally {
        profileRankRefreshPromise = null;
      }
    })();
    return profileRankRefreshPromise;
  }

  function renderAuthoritativeProfileRank(rank) {
    const numericRank = Number(rank);
    const hasRank = Number.isFinite(numericRank) && numericRank > 0;
    document.querySelectorAll('.rp-profile-rank').forEach((node) => {
      const strong = node.querySelector('strong');
      const small = node.querySelector('small');
      if (!strong) return;
      strong.textContent = hasRank ? `#${numericRank}` : '—';
      if (small) small.textContent = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
    });
  }

  function enforcePublicProfileRank() {
    document.querySelectorAll('.rp-public-player-profile').forEach((profile) => {
      const player = profile.__realPlayPublicPlayer || null;
      if (!player) return;
      const rank = player?.rank ?? player?.career?.rank ?? player?.careerStats?.rank ?? null;
      const numericRank = Number(rank);
      const hasRank = Number.isFinite(numericRank) && numericRank > 0;
      profile.querySelectorAll('.rp-profile-rank').forEach((node) => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (!strong) return;
        strong.textContent = hasRank ? `#${numericRank}` : '—';
        if (small) small.textContent = hasRank ? 'OFFICIAL RANK' : 'UNRANKED';
      });
    });
  }

  async function enforceRankAuthority() {
    enforcePublicProfileRank();
    const profileRank = await refreshOwnProfileRank();
    if (profileRank !== null && profileRank !== undefined) renderAuthoritativeProfileRank(profileRank);
    else if (document.querySelector('.rp-profile.open .rp-profile-rank')) renderAuthoritativeProfileRank(null);
  }

  function rowMeta(row) {
    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || '').trim();
    const jerseyText = String(row.querySelector('.rp-world-player-name b')?.textContent || '').trim();
    const jerseyMatch = jerseyText.match(/#\s*(\d{1,2})/);
    const jersey = jerseyMatch ? Number(jerseyMatch[1]) : null;
    const ovrNode = row.querySelector('.rp-world-player-ovr');
    const ovr = ovrNode && !ovrNode.classList.contains('unranked')
      ? Number.parseFloat(String(ovrNode.textContent || '').replace(/[^0-9.\-]/g, ''))
      : null;
    const userId = String(row.dataset.worldPlayerId || '').trim();
    const ranked = rankAuthorityReady ? rankByUserId.has(userId) : false;
    return {
      row,
      name,
      jersey: Number.isFinite(jersey) ? jersey : null,
      ovr: Number.isFinite(ovr) ? ovr : null,
      rank: rankByUserId.get(userId) ?? null,
      ranked,
    };
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
      if (sortKey === 'ovr') return compareNullableNumber(a, b, 'ovr', direction);
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
      const visible = matchesFilter(meta);
      row.hidden = !visible;
      row.setAttribute('aria-hidden', String(!visible));
    });
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
    const alreadyOrdered = allRows.length === ordered.length && allRows.every((row, index) => row === ordered[index]);
    if (!alreadyOrdered) {
      const fragment = document.createDocumentFragment();
      ordered.forEach((row) => fragment.appendChild(row));
      list.appendChild(fragment);
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
      enforceRankAuthority();
    });
  }

  function directionArrow(key) {
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
    if (!['ranked', 'unranked', 'name', 'jersey'].includes(key)) return;

    if (key === 'ranked') {
      filterMode = 'ranked';
      sortKey = 'ovr';
      directions.ovr = 'desc';
      refreshRankAuthority().then(scheduleSort);
    } else if (key === 'unranked') {
      filterMode = 'unranked';
      sortKey = 'name';
      directions.name = 'asc';
      refreshRankAuthority().then(scheduleSort);
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
    listObserver.observe(list, { childList: true });
    scheduleSort();
    return true;
  }

  installStyles();
  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  const profileObserver = new MutationObserver(() => enforceRankAuthority());
  profileObserver.observe(document.documentElement, { childList: true, subtree: true });
  enforceRankAuthority();
})();