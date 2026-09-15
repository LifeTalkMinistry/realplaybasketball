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

  // This is intentionally a preview only. Real Play's official Team OVR formula,
  // floor and cap are competitive-authority values and are not invented here.
  // The preview uses authoritative player OVR values returned by the 4v4 API.
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
        display:block;color:#f5f9ff;font-size:.72rem;font-weight:1000;letter-spacing:.075em;line-height:1.05;white-space:nowrap;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand span{
        display:block;margin-top:3px;color:#55ddff;font-size:.46rem;font-weight:1000;letter-spacing:.085em;line-height:1.05;white-space:nowrap;
      }
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand[data-ovr-state="official-ok"] span{color:#71f0b0}
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand[data-ovr-state="official-warning"] span{color:#ffc56b}
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand[data-ovr-state="official-over"] span{color:#ff8493}
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand[data-ovr-state="empty"] span,
      .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand[data-ovr-state="signed-out"] span{color:#70869a}
      @media(max-width:380px){
        .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand strong{font-size:.66rem;letter-spacing:.055em}
        .rp-4v4-static-view .rp-3v3-brand.rp-4v4-team-ovr-brand span{font-size:.41rem;letter-spacing:.055em}
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
    const clubName = CLUB_NAMES[clubId] || 'TEAM';
    const players = clubPlayers(clubId);
    const official = officialState(data, clubId);

    strong.textContent = 'CURRENT TEAM OVR';

    if (!token()) {
      span.textContent = `${clubName} · SIGN IN TO VIEW`;
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
      span.textContent = `${clubName} · ${official.teamOvr.toFixed(1)} / ${official.cap.toFixed(1)} CAP`;
      return;
    }

    const preview = previewAverage(players);
    if (preview === null) {
      span.textContent = `${clubName} · — · CAP PENDING`;
      brand.dataset.ovrState = 'empty';
      return;
    }

    span.textContent = `${clubName} · ${preview.toFixed(1)} PREVIEW · CAP PENDING`;
    brand.dataset.ovrState = 'preview';
  }

  async function load({ force = false } = {}) {
    const accessToken = token();
    if (!accessToken) {
      preferencePlayers = [];
      render();
      return;
    }
    const now = Date.now();
    if (!force && preferencePlayers.length && now - lastLoadedAt < 15_000) {
      render();
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
        lastLoadedAt = Date.now();
        render(data);
      } catch (_error) {
        render();
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
    if (event.target.closest?.('[data-rp-4v4-prev],[data-rp-4v4-next],[data-rp-4v4-card]')) {
      requestAnimationFrame(() => render());
      return;
    }
    if (event.target.closest?.('[data-rp-4v4-preference-action],[data-rp-4v4-preference-cancel]')) {
      scheduleRefresh(650, true);
    }
  });

  const observer = new MutationObserver((mutations) => {
    let mounted = false;
    let clubChanged = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && [...mutation.addedNodes].some((node) => node instanceof HTMLElement && (node.matches?.('[data-rp-4v4-static-view]') || node.querySelector?.('[data-rp-4v4-static-view]')))) {
        mounted = true;
      }
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-rp-active-club') clubChanged = true;
    }
    if (mounted) scheduleRefresh(0, true);
    else if (clubChanged) render();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-rp-active-club'],
  });

  if (activeView()) scheduleRefresh(0, true);
})();
