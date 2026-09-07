(() => {
  if (window.__realPlayCareerReplayProfileLinkInstalled) return;
  window.__realPlayCareerReplayProfileLinkInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const COMMUNITY_URL = `${API_BASE_URL}/api/real-play/community`;
  const TOKEN_KEY = 'real_play_access_token';
  const ROSTER_CACHE_MS = 30000;

  let rosterCache = null;
  let rosterCacheAt = 0;

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function parseBreakdownIdentity(detail) {
    const label = String(detail?.querySelector('.rp-career-player-detail-head strong')?.textContent || '').trim();
    const jerseyMatch = label.match(/^#(\d+)\s+/);
    const name = label.replace(/^#(?:\d+|--|—)\s*/, '').trim();
    return {
      playerName: name || label,
      playerNumber: jerseyMatch ? Number(jerseyMatch[1]) : null,
    };
  }

  async function loadCommunityPlayers() {
    if (rosterCache && Date.now() - rosterCacheAt < ROSTER_CACHE_MS) return rosterCache;
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) throw new Error('Please log in to view player profiles.');

    const response = await fetch(COMMUNITY_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action: 'players' }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not find this player profile.');

    rosterCache = {
      players: Array.isArray(data?.players) ? data.players : [],
      meUserId: Number(data?.meUserId || 0) || null,
    };
    rosterCacheAt = Date.now();
    return rosterCache;
  }

  function findPlayer(players, identity) {
    const targetName = normalizeName(identity?.playerName);
    const targetNumber = identity?.playerNumber;
    if (!targetName) return null;

    const exactName = players.filter((player) => normalizeName(player?.playerName) === targetName);
    if (targetNumber !== null) {
      const exactIdentity = exactName.find((player) => Number(player?.playerNumber) === targetNumber);
      if (exactIdentity) return exactIdentity;
    }
    return exactName[0] || null;
  }

  function setButtonState(button, label, disabled = false) {
    if (!button?.isConnected) return;
    button.textContent = label;
    button.disabled = disabled;
  }

  async function openProfileFromBreakdown(detail, button) {
    const identity = parseBreakdownIdentity(detail);
    setButtonState(button, 'OPENING…', true);

    try {
      const directory = await loadCommunityPlayers();
      const player = findPlayer(directory.players, identity);
      const userId = Number(player?.userId || 0);
      if (!player || !Number.isSafeInteger(userId) || userId < 1) {
        throw new Error('No Real Play profile is attached to this player yet.');
      }

      if (directory.meUserId && userId === directory.meUserId && window.RealPlayProfile?.open) {
        window.RealPlayProfile.open();
      } else if (window.RealPlayPlayers?.openProfile) {
        await window.RealPlayPlayers.openProfile(userId);
      } else {
        throw new Error('Player profiles are still loading.');
      }

      setButtonState(button, 'VIEW PROFILE', false);
    } catch (error) {
      setButtonState(button, 'NO PROFILE', true);
      window.setTimeout(() => setButtonState(button, 'VIEW PROFILE', false), 1800);
      console.warn('[Real Play] Could not open player profile from replay breakdown.', error);
    }
  }

  function decorateBreakdown(detail) {
    if (!detail || detail.dataset.rpProfileLinkReady === '1') return;
    const head = detail.querySelector('.rp-career-player-detail-head');
    const close = head?.querySelector('button[data-rp-career-player-detail-close]');
    if (!head || !close) return;

    detail.dataset.rpProfileLinkReady = '1';
    head.dataset.rpProfileLinkReady = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-career-player-detail-profile';
    button.dataset.rpCareerPlayerProfile = '1';
    button.textContent = 'VIEW PROFILE';
    button.setAttribute('aria-label', `View ${parseBreakdownIdentity(detail).playerName || 'player'} profile`);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openProfileFromBreakdown(detail, button);
    });

    head.insertBefore(button, close);
  }

  function installStyles() {
    if (document.querySelector('[data-rp-replay-profile-link-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpReplayProfileLinkStyles = '1';
    style.textContent = `
      .rp-career-player-detail-head[data-rp-profile-link-ready="1"]{justify-content:flex-start;gap:8px}
      .rp-career-player-detail-head[data-rp-profile-link-ready="1"]>div:first-child{flex:1 1 auto;min-width:0}
      .rp-career-player-detail-profile{flex:0 0 auto!important;width:auto!important;min-width:86px!important;height:34px!important;padding:0 10px!important;border-color:rgba(64,215,245,.28)!important;border-radius:10px!important;background:rgba(25,119,151,.12)!important;color:#65e4fa!important;font-family:var(--rp-display,Arial,sans-serif)!important;font-size:.43rem!important;font-style:italic!important;font-weight:950!important;letter-spacing:.08em!important;white-space:nowrap}
      .rp-career-player-detail-profile:hover,.rp-career-player-detail-profile:focus-visible{border-color:rgba(90,229,250,.5)!important;background:rgba(30,148,184,.18)!important;outline:none}
      .rp-career-player-detail-profile:disabled{opacity:.58;cursor:wait}
      body.rp-career-replay-open .rp-profile.open{z-index:780}
      @media(max-width:390px){.rp-career-player-detail-profile{min-width:76px!important;padding-inline:8px!important;font-size:.39rem!important}.rp-career-player-detail-head[data-rp-profile-link-ready="1"]{gap:6px}}
    `;
    document.head.appendChild(style);
  }

  installStyles();

  const observer = new MutationObserver(() => {
    document.querySelectorAll('[data-rp-career-player-detail]').forEach(decorateBreakdown);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.querySelectorAll('[data-rp-career-player-detail]').forEach(decorateBreakdown);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    rosterCache = null;
    rosterCacheAt = 0;
  });
})();
