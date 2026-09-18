(() => {
  if (window.__realPlayReservationSnapshotStandbyFitInstalled) return;
  window.__realPlayReservationSnapshotStandbyFitInstalled = true;

  /*
    Premium Profile Art admin compatibility
    ---------------------------------------
    During the Profile Art Studio rollout, the frontend may arrive before the
    newer /admin/profile-art/access backend route. In that case we keep the
    editor admin-only by falling back to the already-established Real Play
    admin permission endpoint. Normal players still receive a 403 response.
  */
  const PROFILE_ART_ACCESS_PATH = '/api/real-play/admin/profile-art/access';
  const EXISTING_ADMIN_ACCESS_PATH = '/api/real-play/admin/career/control';
  const TOKEN_KEY = 'real_play_access_token';

  function installProfileArtAdminAccessCompat() {
    if (window.__realPlayProfileArtAdminAccessCompatInstalled) return;
    window.__realPlayProfileArtAdminAccessCompatInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.__realPlayNativeFetch = window.__realPlayNativeFetch || nativeFetch;

    window.fetch = async (input, init) => {
      const inputUrl = typeof input === 'string'
        ? input
        : (typeof Request !== 'undefined' && input instanceof Request)
          ? input.url
          : String(input?.url || input || '');

      if (!inputUrl.includes(PROFILE_ART_ACCESS_PATH)) {
        return nativeFetch(input, init);
      }

      // Prefer the dedicated Profile Art permission route as soon as the
      // backend has it. Compatibility is used only when that route is absent.
      const primary = await nativeFetch(input, init);
      if (primary.status !== 404 && primary.status !== 405) return primary;

      const headers = new Headers(
        init?.headers ||
        ((typeof Request !== 'undefined' && input instanceof Request) ? input.headers : undefined)
      );

      const fallbackUrl = inputUrl.replace(PROFILE_ART_ACCESS_PATH, EXISTING_ADMIN_ACCESS_PATH);
      const fallback = await nativeFetch(fallbackUrl, {
        ...init,
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      const data = await fallback.clone().json().catch(() => ({}));
      const admin = Boolean(fallback.ok && data?.admin === true);

      return new Response(JSON.stringify({
        admin,
        compatibilityFallback: true,
      }), {
        status: admin ? 200 : 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    };
  }

  function refreshProfileArtAdminAccess() {
    // The Profile Art module caches a failed admin probe. A synthetic storage
    // event resets that cache without changing the user's auth token.
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: TOKEN_KEY,
        storageArea: window.localStorage,
      }));
    } catch (_error) {
      const event = new Event('storage');
      try { Object.defineProperty(event, 'key', { value: TOKEN_KEY }); } catch (_ignore) {}
      window.dispatchEvent(event);
    }

    try {
      window.RealPlayPremiumProfileArt?.refresh?.();
    } catch (_error) {}
  }

  installProfileArtAdminAccessCompat();

  // Cover both load orders: this direct script can run before or after the
  // dynamically loaded profile-art module.
  [0, 250, 900, 1800].forEach((delay) => {
    window.setTimeout(refreshProfileArtAdminAccess, delay);
  });

  ['realplay:app-ready', 'realplay:profile-loaded', 'realplay:public-profile-loaded'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      window.setTimeout(refreshProfileArtAdminAccess, 0);
    });
  });

  const style = document.createElement('style');
  style.id = 'rp-reservation-snapshot-standby-fit-style';
  style.textContent = `
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-cell{
      min-width:0!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name-line{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      gap:5px!important;
      overflow:hidden!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-secured-name{
      flex:1 1 0!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    .rp-snapshot-capture-mode .rp-ranking-standby-player .rp-ranking-standby-access{
      flex:0 0 auto!important;
      box-sizing:border-box!important;
      padding-left:4px!important;
      padding-right:4px!important;
      font-size:.28rem!important;
      letter-spacing:.055em!important;
      line-height:1!important;
      overflow:hidden!important;
      white-space:nowrap!important;
    }
  `;
  document.head.appendChild(style);
})();

(() => {
  if (window.__realPlayDefaultProfileArtInstalled) return;
  window.__realPlayDefaultProfileArtInstalled = true;

  const DEFAULT_PROFILE_ART_SRC = 'assets/profile-art/default-player.png';

  const style = document.createElement('style');
  style.id = 'rp-default-profile-art-style';
  style.textContent = `
    .rp-profile .rp-profile-hero{
      position:relative!important;
      isolation:isolate!important;
      overflow:hidden!important;
    }

    .rp-default-profile-art{
      position:absolute;
      z-index:1;
      inset:0;
      overflow:hidden;
      pointer-events:none;
      opacity:.94;
    }

    .rp-default-profile-art::before{
      content:'';
      position:absolute;
      z-index:0;
      inset:-12%;
      background:
        radial-gradient(circle at 76% 34%,rgba(38,153,255,.12),transparent 33%),
        radial-gradient(circle at 96% 48%,rgba(255,55,72,.10),transparent 29%);
      filter:blur(18px);
    }

    .rp-default-profile-art img{
      position:absolute;
      z-index:1;
      top:7%;
      right:-8%;
      width:61%;
      height:auto;
      max-width:320px;
      object-fit:contain;
      opacity:.96;
      filter:drop-shadow(0 20px 28px rgba(0,0,0,.46));
      user-select:none;
      -webkit-user-drag:none;
    }

    .rp-default-profile-art::after{
      content:'';
      position:absolute;
      z-index:2;
      inset:0;
      background:
        linear-gradient(90deg,
          rgba(3,7,13,.96) 0%,
          rgba(3,7,13,.84) 18%,
          rgba(3,7,13,.54) 31%,
          rgba(3,7,13,.20) 45%,
          transparent 64%),
        linear-gradient(0deg,
          rgba(3,7,13,.98) 0%,
          rgba(3,7,13,.78) 15%,
          rgba(3,7,13,.31) 29%,
          transparent 48%);
    }

    .rp-profile.has-rp-default-profile-art .rp-profile-name > h1{
      max-width:min(56vw,305px)!important;
    }

    .rp-profile.has-rp-default-profile-art .rp-profile-rating-row > div{
      position:relative;
      z-index:2;
      background:rgba(4,9,16,.84)!important;
      backdrop-filter:blur(3px);
      -webkit-backdrop-filter:blur(3px);
    }

    .rp-profile.rp-profile-art-editing .rp-default-profile-art{
      opacity:.42;
    }

    @media(max-width:420px){
      .rp-default-profile-art img{
        top:8%;
        right:-10%;
        width:65%;
      }

      .rp-profile.has-rp-default-profile-art .rp-profile-name > h1{
        max-width:53vw!important;
      }
    }

    @media(max-width:355px){
      .rp-default-profile-art img{
        top:9%;
        right:-12%;
        width:69%;
      }
    }
  `;
  document.head.appendChild(style);

  let scheduled = false;

  function removeDefault(panel) {
    panel.querySelector('[data-rp-default-profile-art]')?.remove();
    panel.classList.remove('has-rp-default-profile-art');
  }

  function syncPanel(panel) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return;
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return;

    const premium = hero.querySelector('[data-rp-premium-profile-art]');
    const premiumVisible = Boolean(
      premium &&
      premium.classList.contains('is-ready') &&
      panel.classList.contains('has-rp-premium-profile-art')
    );

    if (premiumVisible) {
      removeDefault(panel);
      return;
    }

    let fallback = hero.querySelector('[data-rp-default-profile-art]');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'rp-default-profile-art';
      fallback.dataset.rpDefaultProfileArt = 'true';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.innerHTML = `<img src="${DEFAULT_PROFILE_ART_SRC}" alt="" draggable="false" />`;
      hero.insertBefore(fallback, hero.firstChild);
    }

    panel.classList.add('has-rp-default-profile-art');
  }

  function renderAll() {
    scheduled = false;
    document.querySelectorAll('.rp-profile.open').forEach(syncPanel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderAll);
  }

  ['realplay:profile-loaded', 'realplay:public-profile-loaded', 'realplay:profile-art-updated', 'realplay:app-ready'].forEach((eventName) => {
    window.addEventListener(eventName, schedule);
  });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['class'],
  });

  schedule();
})();
