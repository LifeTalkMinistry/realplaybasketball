(() => {
  if (window.__realPlayFuture4v4TeamOvrHeaderInstalled) return;
  window.__realPlayFuture4v4TeamOvrHeaderInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUB_NAMES = Object.freeze({
    lions: 'LIONS',
    valiant: 'VALIANT',
    watchmen: 'WATCHMEN',
    conquerors: 'CONQUERORS',
  });

  let preferencePlayers = [];
  let viewerAccountUserId = null;
  let lastLoadedAt = 0;
  let loadPromise = null;
  let refreshTimer = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function validRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
  }

  function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function activeView() {
    return document.querySelector('[data-rp-4v4-static-view]');
  }

  function activeClub(view = activeView()) {
    const club = String(view?.dataset?.rpActiveClub || '').trim().toLowerCase();
    return CLUB_NAMES[club] ? club : 'lions';
  }

  function clubPlayers(clubId) {
    return preferencePlayers.filter((player) => String(player?.preferredClub || '').trim().toLowerCase() === clubId);
  }

  function sortedClubPlayers(clubId) {
    return clubPlayers(clubId).sort((left, right) => {
      const leftRank = validRank(left?.rank);
      const rightRank = validRank(right?.rank);
      if (leftRank && rightRank) return leftRank - rightRank;
      if (leftRank) return -1;
      if (rightRank) return 1;
      const leftOvr = finite(left?.ovr) ?? -Infinity;
      const rightOvr = finite(right?.ovr) ?? -Infinity;
      if (leftOvr !== rightOvr) return rightOvr - leftOvr;
      const gamesDiff = (Number(right?.verifiedGames ?? right?.games ?? 0) || 0)
        - (Number(left?.verifiedGames ?? left?.games ?? 0) || 0);
      if (gamesDiff) return gamesDiff;
      return String(left?.playerName || '').localeCompare(String(right?.playerName || ''));
    });
  }

  function previewAverage(players) {
    const values = players
      .map((player) => finite(player?.ovr))
      .filter((value) => value !== null && value > 0);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function officialState(data, clubId) {
    const sources = [
      data?.teamOvrByClub?.[clubId],
      data?.teamOvrAuthority?.clubs?.[clubId],
      data?.teamOvrAuthority?.[clubId],
    ].filter(Boolean);
    const state = sources[0] || null;
    if (!state || typeof state !== 'object') return null;

    const teamOvr = finite(state.teamOvr ?? state.ovr ?? state.value);
    const floor = finite(state.minimumFloor ?? state.floor ?? state.min);
    const cap = finite(state.maximumCap ?? state.cap ?? state.max);
    const validation = String(state.validationResult ?? state.status ?? '').trim().toUpperCase();
    const formulaVersion = String(state.formulaVersion ?? '').trim();

    if (teamOvr === null || cap === null || !validation) return null;
    return { teamOvr, floor, cap, validation, formulaVersion };
  }

  function ensureStyle() {
    if (document.querySelector('[data-rp-4v4-team-ovr-header-style]')) return;
    const style = document.createElement('style');
    style.dataset.rp4v4TeamOvrHeaderStyle = '1';
    style.textContent = `
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand{
        min-width:0;text-align:center;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{
        display:block;color:#f5f9ff;font-size:.84rem;font-weight:1000;letter-spacing:.075em;line-height:1;white-space:nowrap;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand span{
        display:none!important;
      }
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link{
        cursor:pointer;touch-action:manipulation;
        transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease;
      }
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link:hover{
        border-color:rgba(80,220,255,.34);
        background:linear-gradient(105deg,rgba(8,25,38,.99),rgba(4,15,24,.99) 58%,rgba(7,25,34,.97));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.2);
      }
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link:active{transform:scale(.995)}
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link:focus-visible{
        outline:2px solid rgba(80,220,255,.68);outline-offset:2px;
      }
      @media(max-width:380px){
        .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{font-size:.78rem;letter-spacing:.055em}
      }
    `;
    document.head.appendChild(style);
  }

  function render(data = null) {
    const view = activeView();
    if (!view) return;
    const brand = view.querySelector('.rp-3v3-brand');
    const strong = brand?.querySelector('strong');
    const span = brand?.querySelector('span');
    if (!brand || !strong || !span) return;

    ensureStyle();
    brand.classList.add('rp-4v4-team-ovr-brand');

    const clubId = activeClub(view);
    const players = clubPlayers(clubId);
    const official = officialState(data, clubId);
    span.textContent = '';

    if (!token()) {
      strong.textContent = 'TEAM OVR —';
      brand.dataset.ovrState = 'signed-out';
      return;
    }

    if (official) {
      const normalized = official.validation.replace(/[^A-Z0-9]+/g, '_');
      const atOrBelowCap = official.teamOvr <= official.cap;
      const atOrAboveFloor = official.floor === null || official.teamOvr >= official.floor;
      if (!atOrBelowCap || normalized.includes('ABOVE')) brand.dataset.ovrState = 'official-over';
      else if (!atOrAboveFloor || normalized.includes('BELOW')) brand.dataset.ovrState = 'official-warning';
      else brand.dataset.ovrState = 'official-ok';
      strong.textContent = `TEAM OVR ${Math.round(official.teamOvr)}`;
      return;
    }

    const preview = previewAverage(players);
    if (preview === null) {
      strong.textContent = 'TEAM OVR —';
      brand.dataset.ovrState = 'empty';
      return;
    }

    strong.textContent = `TEAM OVR ${Math.round(preview)}`;
    brand.dataset.ovrState = 'preview';
  }

  function bindPreferenceCards() {
    const view = activeView();
    if (!view) return;
    ensureStyle();

    const list = view.querySelector('[data-rp-4v4-preference-list]');
    if (!list) return;
    const cards = [...list.querySelectorAll('.rp-4v4-player-card')];
    if (!cards.length) return;

    const players = sortedClubPlayers(activeClub(view));
    cards.forEach((card, index) => {
      const player = players[index] || null;
      const accountUserId = positiveId(player?.userId);
      const playerId = positiveId(player?.playerId);
      const isSelf = Boolean(accountUserId && viewerAccountUserId && accountUserId === viewerAccountUserId);
      const clickable = isSelf || Boolean(playerId);

      card.classList.toggle('is-profile-link', clickable);
      if (!clickable) {
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('aria-label');
        delete card.dataset.rp4v4ProfilePlayerId;
        delete card.dataset.rp4v4ProfileAccountId;
        delete card.dataset.rp4v4ProfileSelf;
        return;
      }

      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `Open ${String(player?.playerName || 'Real Play player')} profile`);
      card.dataset.rp4v4ProfilePlayerId = playerId ? String(playerId) : '';
      card.dataset.rp4v4ProfileAccountId = accountUserId ? String(accountUserId) : '';
      card.dataset.rp4v4ProfileSelf = isSelf ? 'true' : 'false';
    });
  }

  function closeFourVFourView() {
    const view = activeView();
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-4v4-static-open');
  }

  function openPreferencePlayer(card) {
    if (!card?.classList?.contains('is-profile-link')) return;
    const isSelf = card.dataset.rp4v4ProfileSelf === 'true';
    const playerId = positiveId(card.dataset.rp4v4ProfilePlayerId);

    if (isSelf && window.RealPlayProfile?.open) {
      closeFourVFourView();
      window.requestAnimationFrame(() => window.RealPlayProfile.open());
      return;
    }

    if (playerId && window.RealPlayPlayers?.openProfile) {
      closeFourVFourView();
      window.requestAnimationFrame(() => window.RealPlayPlayers.openProfile(playerId));
    }
  }

  async function load({ force = false } = {}) {
    const accessToken = token();
    if (!accessToken) {
      preferencePlayers = [];
      viewerAccountUserId = null;
      render();
      bindPreferenceCards();
      return;
    }
    const now = Date.now();
    if (!force && preferencePlayers.length && now - lastLoadedAt < 15_000) {
      render();
      bindPreferenceCards();
      return;
    }
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/4v4/me`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Could not load 4v4 OVR preview.');
        const data = await response.json().catch(() => ({}));
        preferencePlayers = Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : [];
        viewerAccountUserId = positiveId(data?.userId);
        lastLoadedAt = Date.now();
        render(data);
        bindPreferenceCards();
      } catch (_error) {
        render();
        bindPreferenceCards();
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  function scheduleRefresh(delay = 0, force = false) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      load({ force });
    }, Math.max(0, delay));
  }

  document.addEventListener('click', (event) => {
    const profileCard = event.target.closest?.('.rp-4v4-player-card.is-profile-link');
    if (profileCard) {
      event.preventDefault();
      event.stopPropagation();
      openPreferencePlayer(profileCard);
      return;
    }

    if (event.target.closest?.('[data-rp-4v4-prev],[data-rp-4v4-next],[data-rp-4v4-card]')) {
      requestAnimationFrame(() => {
        render();
        bindPreferenceCards();
      });
      return;
    }
    if (event.target.closest?.('[data-rp-4v4-preference-action],[data-rp-4v4-preference-cancel]')) {
      scheduleRefresh(650, true);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const profileCard = event.target.closest?.('.rp-4v4-player-card.is-profile-link');
    if (!profileCard) return;
    event.preventDefault();
    openPreferencePlayer(profileCard);
  });

  const observer = new MutationObserver((mutations) => {
    let mounted = false;
    let clubChanged = false;
    let preferenceChanged = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && [...mutation.addedNodes].some((node) => node instanceof HTMLElement && (node.matches?.('[data-rp-4v4-static-view]') || node.querySelector?.('[data-rp-4v4-static-view]')))) {
        mounted = true;
      }
      if (mutation.type === 'childList' && mutation.target instanceof HTMLElement && mutation.target.closest?.('[data-rp-4v4-preference-list]')) {
        preferenceChanged = true;
      }
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-rp-active-club') clubChanged = true;
    }
    if (mounted) scheduleRefresh(0, true);
    else if (clubChanged) {
      render();
      bindPreferenceCards();
    } else if (preferenceChanged) {
      bindPreferenceCards();
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-rp-active-club'],
  });

  if (activeView()) scheduleRefresh(0, true);
})();