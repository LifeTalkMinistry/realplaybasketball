(() => {
  if (window.__realPlayInactivePlayerStateInstalled) return;
  window.__realPlayInactivePlayerStateInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const PUBLIC_COMMUNITY_URL = `${API_BASE_URL}/api/real-play/public/community`;
  const REFRESH_MS = 30_000;

  let playersById = new Map();
  let loadedAt = 0;
  let loading = null;
  let inactiveMode = false;
  let scheduled = false;
  let timer = null;

  function installStyles() {
    if (document.querySelector('[data-rp-inactive-player-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpInactivePlayerStyles = '1';
    style.textContent = `
      .rp-inactive-rank-badge{
        display:none;flex:none;min-width:38px;margin-right:2px;color:#95a8bc;
        font-family:var(--rp-display,Arial,sans-serif);font-size:1.18rem;font-style:italic;
        font-weight:1000;line-height:1;letter-spacing:-.035em;text-align:left;
        text-shadow:0 0 16px rgba(140,164,190,.18)
      }
      .rp-world-inactive-mode .rp-inactive-rank-badge{display:inline-block}
      .rp-world-inactive-mode .rp-world-player-rank-badge{display:none!important}
      .rp-world-inactive-mode .rp-world-player-row[data-ranking-status="inactive"]{
        border-color:rgba(135,158,183,.16)
      }
      @media(max-width:420px){.rp-inactive-rank-badge{min-width:34px;font-size:1.08rem}}
      @media(max-width:360px){.rp-inactive-rank-badge{min-width:31px;font-size:1rem}}
    `;
    document.head.appendChild(style);
  }

  function playerIds(player) {
    const values = [player?.playerId, player?.userId, player?.accountUserId]
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0);
    return [...new Set(values)].map(String);
  }

  async function fetchPlayers() {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    const request = async (url, accessToken = '') => {
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'players' }),
        cache: 'no-store',
      });
    };

    let response = await request(token ? COMMUNITY_URL : PUBLIC_COMMUNITY_URL, token);
    if ((response.status === 401 || response.status === 403) && token) {
      response = await request(PUBLIC_COMMUNITY_URL);
    }
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function refreshAuthority(force = false) {
    const now = Date.now();
    if (!force && loadedAt && now - loadedAt < REFRESH_MS) return;
    if (loading) return loading;

    loading = (async () => {
      try {
        const data = await fetchPlayers();
        if (!data || !Array.isArray(data.players)) return;
        const next = new Map();
        data.players.forEach((player) => {
          playerIds(player).forEach((id) => next.set(id, player));
        });
        playersById = next;
        loadedAt = Date.now();
      } catch (_error) {
        // Keep the last authoritative state during a temporary network failure.
      } finally {
        loading = null;
        scheduleApply();
      }
    })();

    return loading;
  }

  function worldPanel() {
    return document.querySelector('[data-rp-world]');
  }

  function playerForRow(row) {
    const id = String(row?.dataset?.worldPlayerId || '').trim();
    return id ? playersById.get(id) || null : null;
  }

  function rankingStatus(player) {
    const value = String(
      player?.rankingStatus
      || player?.competitiveStatus
      || player?.ranking?.rankingStatus
      || player?.ranking?.status
      || ''
    ).trim().toLowerCase();
    if (value === 'inactive' || player?.inactive === true) return 'inactive';
    if (value === 'ranked') return 'ranked';
    if (value === 'unranked') return 'unranked';
    return Number(player?.rank || 0) > 0 ? 'ranked' : 'unranked';
  }

  function inactiveRank(player) {
    const rank = Number(player?.inactiveRank ?? player?.ranking?.inactiveRank);
    return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
  }

  function ovr(player, row) {
    const direct = Number(player?.ovr ?? player?.rating);
    if (Number.isFinite(direct)) return direct;
    const text = String(row?.querySelector('.rp-world-player-ovr')?.textContent || '');
    const parsed = Number.parseFloat(text.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function ensureInactiveButton() {
    const controls = document.querySelector('[data-world-player-sort]');
    if (!controls) return null;
    let button = controls.querySelector('[data-rp-inactive-sort]');

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.rpInactiveSort = 'true';
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<span>INACTIVE OVR</span><b></b>';

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        inactiveMode = true;
        void refreshAuthority(true).then(scheduleApply);
        scheduleApply();
      });
    }

    const jersey = controls.querySelector('[data-player-sort="jersey"]');
    if (jersey) {
      if (jersey.nextElementSibling !== button) jersey.insertAdjacentElement('afterend', button);
    } else if (controls.lastElementChild !== button) {
      controls.appendChild(button);
    }

    return button;
  }

  function setControlState() {
    const controls = document.querySelector('[data-world-player-sort]');
    const inactiveButton = ensureInactiveButton();
    if (!controls || !inactiveButton) return;

    if (inactiveMode) {
      controls.querySelectorAll('[data-player-sort]').forEach((button) => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      });
    }
    inactiveButton.classList.toggle('active', inactiveMode);
    inactiveButton.setAttribute('aria-pressed', String(inactiveMode));
    const arrow = inactiveButton.querySelector('b');
    if (arrow) arrow.textContent = inactiveMode ? '↓' : '';
  }

  function ensureInactiveRankBadge(row, rank) {
    const name = row?.querySelector('.rp-world-player-name');
    if (!name) return;
    let badge = name.querySelector('.rp-inactive-rank-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-inactive-rank-badge';
      badge.setAttribute('aria-hidden', 'true');
      name.prepend(badge);
    }
    badge.textContent = rank ? `#${rank}` : '';
  }

  function clearCurrentRecognitions(row) {
    row.__realPlayBadges = [];
    row.querySelector('[data-rp-featured-recognition]')?.remove();
    row.classList.remove('rp-recognition-themed');
    row.removeAttribute('data-recognition-type');
    row.style.removeProperty('--rp-recognition-bar');
  }

  function setRowVisible(row, visible) {
    if (row.hidden === visible) row.hidden = !visible;
    row.setAttribute('aria-hidden', String(!visible));
    if (visible) row.style.removeProperty('display');
    else row.style.setProperty('display', 'none', 'important');
  }

  function applyRows() {
    const panel = worldPanel();
    const list = panel?.querySelector('[data-world-player-list]');
    if (!panel || !list) return;

    panel.classList.toggle('rp-world-inactive-mode', inactiveMode);
    const rows = [...list.querySelectorAll('.rp-world-player-row')];
    const inactive = [];

    rows.forEach((row) => {
      const player = playerForRow(row);
      if (!player) return;
      const status = rankingStatus(player);
      row.dataset.rankingStatus = status;

      if (status === 'inactive') {
        const rank = inactiveRank(player);
        row.dataset.inactiveRank = rank ? String(rank) : '';
        ensureInactiveRankBadge(row, rank);
        clearCurrentRecognitions(row);
        inactive.push({ row, player, rank, ovr: ovr(player, row) });
      } else {
        row.removeAttribute('data-inactive-rank');
        row.querySelector('.rp-inactive-rank-badge')?.remove();
      }
    });

    inactive.sort((left, right) => {
      if (left.rank && right.rank && left.rank !== right.rank) return left.rank - right.rank;
      if (left.ovr !== right.ovr) return right.ovr - left.ovr;
      return String(left.row.dataset.worldPlayerId || '').localeCompare(String(right.row.dataset.worldPlayerId || ''), undefined, { numeric: true });
    });
    inactive.forEach((item, index) => {
      const rank = item.rank || index + 1;
      item.row.dataset.inactiveRank = String(rank);
      ensureInactiveRankBadge(item.row, rank);
    });

    if (inactiveMode) {
      rows.forEach((row) => {
        const isInactive = row.dataset.rankingStatus === 'inactive';
        setRowVisible(row, isInactive);
        if (isInactive) {
          const order = Number(row.dataset.inactiveRank || 999999);
          row.style.setProperty('order', String(order));
        } else {
          row.style.setProperty('order', '999999');
        }
      });
    } else {
      rows.forEach((row) => {
        row.style.removeProperty('order');
        if (row.dataset.rankingStatus === 'inactive') setRowVisible(row, false);
      });
    }

    const count = panel.querySelector('[data-world-player-count]');
    if (count) {
      const visibleCount = inactiveMode
        ? inactive.length
        : rows.filter((row) => !row.hidden && row.dataset.rankingStatus !== 'inactive').length;
      count.textContent = `${visibleCount} PLAYER${visibleCount === 1 ? '' : 'S'}`;
    }
  }

  function profilePlayer(profile) {
    const source = profile?.classList?.contains('rp-public-player-profile')
      ? profile.__realPlayPublicPlayer
      : profile.__realPlayProfileState;
    const candidates = [
      profile?.dataset?.rpPublicPlayerId,
      profile?.dataset?.rpProfilePlayerId,
      source?.playerId,
      source?.userId,
      source?.accountUserId,
      source?.player?.playerId,
      source?.player?.userId,
      source?.profile?.playerId,
      source?.profile?.userId,
    ];
    for (const candidate of candidates) {
      const id = Number(candidate);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const player = playersById.get(String(id));
      if (player) return player;
    }
    return null;
  }

  function applyProfiles() {
    document.querySelectorAll('.rp-profile.open').forEach((profile) => {
      const player = profilePlayer(profile);
      if (!player || rankingStatus(player) !== 'inactive') return;

      profile.dataset.rankingStatus = 'inactive';
      profile.__realPlayBadges = [];
      profile.__realPlayBadgeRank = null;
      profile.querySelector('[data-rp-profile-badges]')?.remove();
      profile.classList.remove('has-rp-profile-badges');

      profile.querySelectorAll('.rp-profile-rank').forEach((node) => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (strong) strong.textContent = '—';
        if (small) small.textContent = 'INACTIVE';
      });
    });
  }

  function apply() {
    scheduled = false;
    ensureInactiveButton();
    setControlState();
    applyRows();
    applyProfiles();
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  }

  document.addEventListener('click', (event) => {
    const baseButton = event.target.closest?.('[data-player-sort]');
    if (!baseButton) return;
    inactiveMode = false;
    scheduleApply();
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) scheduleApply();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:profile-loaded', scheduleApply);
  window.addEventListener('realplay:public-profile-loaded', scheduleApply);
  window.addEventListener('focus', () => {
    void refreshAuthority(true);
  });

  timer = window.setInterval(() => {
    if (document.hidden || !document.querySelector('.rp-world-player-row, .rp-profile.open')) return;
    void refreshAuthority(true);
  }, REFRESH_MS);

  window.addEventListener('pagehide', () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  }, { once: true });

  window.RealPlayInactivePlayers = {
    refresh() {
      return refreshAuthority(true);
    },
    open() {
      inactiveMode = true;
      scheduleApply();
      return refreshAuthority(true);
    },
  };

  installStyles();
  void refreshAuthority(true);
  scheduleApply();
})();
