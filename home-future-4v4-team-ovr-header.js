(() => {
  if (window.__realPlayFuture4v4TeamOvrHeaderInstalled) return;
  window.__realPlayFuture4v4TeamOvrHeaderInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-4v4-team-ovr-header-style';
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
  let lastData = null;

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

    if (teamOvr === null || cap === null || !validation) return null;
    return { teamOvr, floor, cap, validation };
  }

  function ensureStyle() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) return;

    document
      .querySelectorAll('style[data-rp4v4-team-ovr-header-style],style[data-rp-4v4-team-ovr-header-style]')
      .forEach((style) => style.remove());

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-4v4-static-view{
        --rp4v4-ovr-accent:#ff3340;
        --rp4v4-ovr-mid:#a70f19;
        --rp4v4-ovr-deep:#8f0d17;
        --rp4v4-ovr-dark:#21070b;
        --rp4v4-ovr-line:#ff3040;
        --rp4v4-ovr-line-deep:#7a0912;
        --rp4v4-ovr-soft:rgba(255,45,56,.22);
        --rp4v4-ovr-glow:rgba(235,28,42,.22);
        --rp4v4-ovr-shadow:#5a060c;
        --rp4v4-ovr-label:#f0d8db;
      }
      .rp-4v4-static-view[data-rp-active-club="lions"]{
        --rp4v4-ovr-accent:#1b9cff;
        --rp4v4-ovr-mid:#0870db;
        --rp4v4-ovr-deep:#0755ad;
        --rp4v4-ovr-dark:#061d3b;
        --rp4v4-ovr-line:#26a9ff;
        --rp4v4-ovr-line-deep:#07539e;
        --rp4v4-ovr-soft:rgba(27,156,255,.24);
        --rp4v4-ovr-glow:rgba(27,156,255,.26);
        --rp4v4-ovr-shadow:#043d78;
        --rp4v4-ovr-label:#9fdcff;
      }
      .rp-4v4-static-view[data-rp-active-club="valiant"]{
        --rp4v4-ovr-accent:#ff3340;
        --rp4v4-ovr-mid:#a70f19;
        --rp4v4-ovr-deep:#8f0d17;
        --rp4v4-ovr-dark:#21070b;
        --rp4v4-ovr-line:#ff3040;
        --rp4v4-ovr-line-deep:#7a0912;
        --rp4v4-ovr-soft:rgba(255,45,56,.22);
        --rp4v4-ovr-glow:rgba(235,28,42,.22);
        --rp4v4-ovr-shadow:#5a060c;
        --rp4v4-ovr-label:#ffd3d7;
      }
      .rp-4v4-static-view[data-rp-active-club="watchmen"]{
        --rp4v4-ovr-accent:#f4c23f;
        --rp4v4-ovr-mid:#bd8215;
        --rp4v4-ovr-deep:#94620b;
        --rp4v4-ovr-dark:#352406;
        --rp4v4-ovr-line:#ffd257;
        --rp4v4-ovr-line-deep:#8d5d08;
        --rp4v4-ovr-soft:rgba(244,194,63,.24);
        --rp4v4-ovr-glow:rgba(244,194,63,.24);
        --rp4v4-ovr-shadow:#6c4905;
        --rp4v4-ovr-label:#ffe39a;
      }
      .rp-4v4-static-view[data-rp-active-club="conquerors"]{
        --rp4v4-ovr-accent:#a454ff;
        --rp4v4-ovr-mid:#7225d1;
        --rp4v4-ovr-deep:#54179f;
        --rp4v4-ovr-dark:#21093f;
        --rp4v4-ovr-line:#b46cff;
        --rp4v4-ovr-line-deep:#51148f;
        --rp4v4-ovr-soft:rgba(164,84,255,.24);
        --rp4v4-ovr-glow:rgba(164,84,255,.25);
        --rp4v4-ovr-shadow:#451176;
        --rp4v4-ovr-label:#d8b5ff;
      }

      .rp-4v4-static-view .rp-3v3-select-head{display:none!important}

      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand{
        min-width:0;display:flex;align-items:center;justify-content:center;text-align:center;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{
        display:block;margin:0;color:#f5f9ff;font-family:var(--rp-display,Arial,sans-serif);
        font-size:.54rem;font-weight:1000;letter-spacing:.16em;line-height:1;text-transform:uppercase;white-space:nowrap;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand span{display:none!important}

      .rp-4v4-static-view .rp-4v4-team-ovr-plaque{
        position:relative;z-index:7;width:214px;height:68px;margin:1px auto -19px;
        display:grid;place-items:center;pointer-events:none;
        filter:drop-shadow(0 8px 16px rgba(0,0,0,.62)) drop-shadow(0 0 11px var(--rp4v4-ovr-glow));
        transition:filter .22s ease;
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque::before{
        content:"";position:absolute;inset:0;
        clip-path:polygon(12% 0,88% 0,100% 20%,96% 72%,80% 100%,20% 100%,4% 72%,0 20%);
        background:linear-gradient(145deg,var(--rp4v4-ovr-accent) 0%,var(--rp4v4-ovr-deep) 16%,var(--rp4v4-ovr-dark) 33%,#070b10 52%,var(--rp4v4-ovr-dark) 69%,var(--rp4v4-ovr-mid) 84%,var(--rp4v4-ovr-accent) 100%);
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);
        transition:background .22s ease;
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque::after{
        content:"";position:absolute;inset:5px 9px 6px;
        clip-path:polygon(10% 0,90% 0,100% 23%,95% 78%,78% 100%,22% 100%,5% 78%,0 23%);
        background:linear-gradient(90deg,var(--rp4v4-ovr-soft),transparent 19%,transparent 81%,var(--rp4v4-ovr-soft)),linear-gradient(180deg,#161d25 0%,#080b10 42%,#020305 100%);
        border-top:1px solid rgba(255,255,255,.17);
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core{
        position:relative;z-index:2;min-width:118px;height:58px;padding:7px 22px 5px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        clip-path:polygon(10% 0,90% 0,100% 22%,96% 78%,79% 100%,21% 100%,4% 78%,0 22%);
        background:linear-gradient(180deg,rgba(28,35,44,.98),rgba(7,10,14,.99) 56%,rgba(1,2,4,.99));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.11),inset 0 -1px 0 var(--rp4v4-ovr-soft);
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::before,
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::after{
        content:"";position:absolute;top:11px;width:26px;height:32px;opacity:.9;
        border-top:2px solid var(--rp4v4-ovr-line);border-bottom:2px solid var(--rp4v4-ovr-line-deep);
        transition:border-color .22s ease;
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::before{left:7px;transform:skewX(-18deg)}
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core::after{right:7px;transform:skewX(18deg)}
      .rp-4v4-static-view .rp-4v4-team-ovr-label{
        position:relative;z-index:2;margin:0 0 1px;color:var(--rp4v4-ovr-label);font-family:var(--rp-display,Arial,sans-serif);
        font-size:.43rem;font-style:italic;font-weight:1000;letter-spacing:.13em;line-height:1;text-transform:uppercase;
        text-shadow:0 1px 0 #000;transition:color .22s ease;
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-value{
        position:relative;z-index:2;display:block;min-width:70px;margin:0;color:#fff;
        font-family:var(--rp-display,Arial,sans-serif);font-size:2.05rem;font-style:italic;font-weight:1000;
        letter-spacing:-.045em;line-height:.88;text-align:center;
        text-shadow:0 2px 0 var(--rp4v4-ovr-shadow),0 0 8px rgba(255,255,255,.18),0 0 14px var(--rp4v4-ovr-glow);
        transition:text-shadow .22s ease;
      }
      .rp-4v4-static-view .rp-4v4-team-ovr-plaque[data-ovr-empty="true"] .rp-4v4-team-ovr-value{
        font-size:1.72rem;letter-spacing:0;color:#d7e0e8;
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
      .rp-4v4-static-view .rp-4v4-player-card.is-profile-link:focus-visible{outline:2px solid rgba(80,220,255,.68);outline-offset:2px}

      @media(max-width:380px){
        .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{font-size:.49rem;letter-spacing:.13em}
        .rp-4v4-static-view .rp-4v4-team-ovr-plaque{width:196px;height:64px;margin-bottom:-18px}
        .rp-4v4-static-view .rp-4v4-team-ovr-plaque-core{height:54px;min-width:110px;padding-inline:20px}
        .rp-4v4-static-view .rp-4v4-team-ovr-value{font-size:1.9rem}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePlaque(view) {
    if (!view) return null;

    const plaques = [...view.querySelectorAll('.rp-4v4-team-ovr-plaque')];
    let plaque = plaques[0] || null;

    plaques.slice(1).forEach((duplicate) => duplicate.remove());

    if (plaque) {
      plaque.setAttribute('data-rp-4v4-team-ovr-plaque', '1');
      plaque.removeAttribute('data-rp4v4-team-ovr-plaque');
      return plaque;
    }

    const topbar = view.querySelector('.rp-3v3-topbar');
    if (!topbar) return null;

    plaque = document.createElement('div');
    plaque.className = 'rp-4v4-team-ovr-plaque';
    plaque.setAttribute('data-rp-4v4-team-ovr-plaque', '1');
    plaque.dataset.ovrEmpty = 'true';
    plaque.setAttribute('aria-label', 'Team OVR unavailable');
    plaque.innerHTML = `
      <div class="rp-4v4-team-ovr-plaque-core">
        <small class="rp-4v4-team-ovr-label">TEAM OVR</small>
        <strong class="rp-4v4-team-ovr-value" data-rp-4v4-team-ovr-value>—</strong>
      </div>`;

    topbar.insertAdjacentElement('afterend', plaque);
    return plaque;
  }

  function setPlaqueValue(view, value, state) {
    const plaque = ensurePlaque(view);
    const target = plaque?.querySelector?.('[data-rp-4v4-team-ovr-value]');
    if (!plaque || !target) return;

    const number = finite(value);
    const hasValue = number !== null && number > 0;
    const display = hasValue ? String(Math.round(number)) : '—';

    target.textContent = display;
    plaque.dataset.ovrEmpty = hasValue ? 'false' : 'true';
    plaque.dataset.ovrState = state || (hasValue ? 'preview' : 'empty');
    plaque.setAttribute('aria-label', hasValue ? `Team OVR ${display}` : 'Team OVR unavailable');
  }

  function render(data = lastData) {
    const view = activeView();
    if (!view) return;

    view.querySelector('.rp-3v3-select-head')?.remove();
    ensureStyle();
    ensurePlaque(view);

    const brand = view.querySelector('.rp-3v3-brand');
    const strong = brand?.querySelector('strong');
    const span = brand?.querySelector('span');
    if (!brand || !strong || !span) return;

    brand.classList.add('rp-4v4-team-ovr-brand');
    strong.textContent = 'SELECT YOUR TEAM';
    span.textContent = '';

    const clubId = activeClub(view);
    const players = clubPlayers(clubId);
    const official = officialState(data, clubId);

    if (!token()) {
      brand.dataset.ovrState = 'signed-out';
      setPlaqueValue(view, null, 'signed-out');
      return;
    }

    if (official) {
      const normalized = official.validation.replace(/[^A-Z0-9]+/g, '_');
      const atOrBelowCap = official.teamOvr <= official.cap;
      const atOrAboveFloor = official.floor === null || official.teamOvr >= official.floor;

      if (!atOrBelowCap || normalized.includes('ABOVE')) brand.dataset.ovrState = 'official-over';
      else if (!atOrAboveFloor || normalized.includes('BELOW')) brand.dataset.ovrState = 'official-warning';
      else brand.dataset.ovrState = 'official-ok';

      setPlaqueValue(view, official.teamOvr, brand.dataset.ovrState);
      return;
    }

    const preview = previewAverage(players);
    if (preview === null) {
      brand.dataset.ovrState = 'empty';
      setPlaqueValue(view, null, 'empty');
      return;
    }

    brand.dataset.ovrState = 'preview';
    setPlaqueValue(view, preview, 'preview');
  }

  function bindPreferenceCards() {
    const view = activeView();
    if (!view) return;

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
      lastData = null;
      render(null);
      bindPreferenceCards();
      return;
    }

    const now = Date.now();
    if (!force && preferencePlayers.length && now - lastLoadedAt < 15_000) {
      render(lastData);
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
        lastData = data;
        preferencePlayers = Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : [];
        viewerAccountUserId = positiveId(data?.userId);
        lastLoadedAt = Date.now();

        render(data);
        bindPreferenceCards();
      } catch (_error) {
        render(lastData);
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

  ensureStyle();

  document.addEventListener('click', (event) => {
    const profileCard = event.target.closest?.('.rp-4v4-player-card.is-profile-link');
    if (profileCard) {
      event.preventDefault();
      event.stopPropagation();
      openPreferencePlayer(profileCard);
      return;
    }

    if (event.target.closest?.('[data-rp-4v4-prev],[data-rp-4v4-next],[data-rp-4v4-card]')) {
      window.requestAnimationFrame(() => {
        render(lastData);
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
      if (
        mutation.type === 'childList'
        && [...mutation.addedNodes].some((node) => node instanceof HTMLElement && (
          node.matches?.('[data-rp-4v4-static-view]')
          || node.querySelector?.('[data-rp-4v4-static-view]')
        ))
      ) {
        mounted = true;
      }

      if (
        mutation.type === 'childList'
        && mutation.target instanceof HTMLElement
        && mutation.target.closest?.('[data-rp-4v4-preference-list]')
      ) {
        preferenceChanged = true;
      }

      if (mutation.type === 'attributes' && mutation.attributeName === 'data-rp-active-club') {
        clubChanged = true;
      }
    }

    if (mounted) {
      scheduleRefresh(0, true);
    } else if (clubChanged) {
      render(lastData);
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