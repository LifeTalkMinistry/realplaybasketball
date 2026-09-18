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
      opacity:.96;
    }

    .rp-default-profile-art::before{
      content:'';
      position:absolute;
      z-index:0;
      inset:-12%;
      background:
        radial-gradient(circle at 76% 34%,rgba(38,153,255,.14),transparent 33%),
        radial-gradient(circle at 96% 48%,rgba(255,55,72,.11),transparent 29%);
      filter:blur(18px);
    }

    .rp-default-profile-art svg{
      position:absolute;
      z-index:1;
      top:14%;
      right:-3%;
      width:49%;
      height:auto;
      max-width:260px;
      opacity:.74;
      filter:drop-shadow(0 20px 28px rgba(0,0,0,.46));
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
      opacity:.45;
    }

    @media(max-width:420px){
      .rp-default-profile-art svg{
        top:15%;
        right:-5%;
        width:53%;
      }

      .rp-profile.has-rp-default-profile-art .rp-profile-name > h1{
        max-width:53vw!important;
      }
    }

    @media(max-width:355px){
      .rp-default-profile-art svg{
        top:16%;
        right:-7%;
        width:57%;
      }
    }
  `;
  document.head.appendChild(style);

  const silhouette = `
    <svg viewBox="0 0 720 960" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rpDefaultBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#25394d"/>
          <stop offset="0.52" stop-color="#111d29"/>
          <stop offset="1" stop-color="#0a1119"/>
        </linearGradient>
        <linearGradient id="rpDefaultRim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#35cfff" stop-opacity=".76"/>
          <stop offset=".48" stop-color="#6f879a" stop-opacity=".16"/>
          <stop offset="1" stop-color="#ff445c" stop-opacity=".64"/>
        </linearGradient>
        <radialGradient id="rpDefaultFace" cx="48%" cy="35%" r="70%">
          <stop offset="0" stop-color="#31475b"/>
          <stop offset="1" stop-color="#15222f"/>
        </radialGradient>
        <filter id="rpDefaultGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="11"/>
        </filter>
      </defs>

      <ellipse cx="432" cy="430" rx="232" ry="342" fill="#1a9fff" opacity=".09" filter="url(#rpDefaultGlow)"/>
      <ellipse cx="570" cy="464" rx="190" ry="300" fill="#ff4059" opacity=".07" filter="url(#rpDefaultGlow)"/>

      <path d="M355 372c-15 69-41 105-88 133-58 34-96 92-111 174l-25 143h507l-18-139c-11-88-49-146-111-180-49-27-77-65-89-131Z" fill="url(#rpDefaultBody)" stroke="url(#rpDefaultRim)" stroke-width="5" stroke-opacity=".72"/>
      <path d="M315 493c29 28 64 42 104 42 42 0 79-15 109-45l29 28c-39 42-84 62-137 62-53 0-99-20-137-59Z" fill="#08121c" opacity=".86"/>
      <path d="M367 490l51 70 51-70" fill="none" stroke="#4acfff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>

      <ellipse cx="419" cy="262" rx="126" ry="151" fill="url(#rpDefaultFace)" stroke="url(#rpDefaultRim)" stroke-width="5"/>
      <path d="M324 219c23-79 173-108 218-13-19-26-42-41-69-49-55-16-108 6-149 62Z" fill="#0a121a" opacity=".88"/>
      <path d="M339 337c22 50 47 75 80 75 34 0 61-25 82-75-24 24-51 36-82 36-31 0-58-12-80-36Z" fill="#0b151f" opacity=".48"/>

      <circle cx="380" cy="264" r="8" fill="#7f99ad" opacity=".3"/>
      <circle cx="458" cy="264" r="8" fill="#7f99ad" opacity=".3"/>
      <path d="M393 316c18 9 36 9 54 0" fill="none" stroke="#8196a8" stroke-width="7" stroke-linecap="round" opacity=".24"/>

      <circle cx="420" cy="693" r="64" fill="none" stroke="#667f92" stroke-width="6" opacity=".16"/>
      <path d="M357 692h126M420 630c-31 34-31 92 0 126M420 630c31 34 31 92 0 126" fill="none" stroke="#667f92" stroke-width="5" opacity=".14"/>
    </svg>`;

  let scheduled = false;

  function removeDefault(panel) {
    panel.querySelector('[data-rp-default-profile-art]')?.remove();
    panel.classList.remove('has-rp-default-profile-art');
  }

  function syncPanel(panel) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return;
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return;

    const premiumLayer = hero.querySelector('[data-rp-premium-profile-art]');
    const hasPremium = Boolean(
      panel.classList.contains('has-rp-premium-profile-art') ||
      premiumLayer?.classList.contains('is-ready')
    );

    if (hasPremium) {
      removeDefault(panel);
      return;
    }

    let layer = hero.querySelector('[data-rp-default-profile-art]');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rp-default-profile-art';
      layer.dataset.rpDefaultProfileArt = 'true';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = silhouette;
      hero.insertBefore(layer, hero.firstChild);
    }
    panel.classList.add('has-rp-default-profile-art');
  }

  function syncAll() {
    scheduled = false;
    document.querySelectorAll('.rp-profile.open').forEach(syncPanel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(syncAll);
  }

  window.addEventListener('realplay:profile-loaded', schedule);
  window.addEventListener('realplay:public-profile-loaded', schedule);
  window.addEventListener('realplay:profile-art-updated', schedule);
  window.addEventListener('realplay:app-ready', schedule);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        return target instanceof HTMLElement && (
          target.classList.contains('rp-profile') ||
          target.hasAttribute('data-rp-premium-profile-art')
        );
      }
      return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
        node instanceof HTMLElement &&
        (node.matches?.('.rp-profile, .rp-profile-hero, [data-rp-premium-profile-art]') ||
         node.querySelector?.('.rp-profile, .rp-profile-hero, [data-rp-premium-profile-art]'))
      ));
    });
    if (relevant) schedule();
  });

  observer.observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['class'],
  });

  schedule();
})();
