(() => {
  const version = '20260910-boot-rescue-v35';
  const html = document.documentElement;
  html.classList.add('js', 'rp-shell-booting');

  // The legacy lobby/main-menu must never paint while the new public-first shell
  // is still assembling. Startup now has only two visible states:
  // loading -> new shell, or loading -> explicit failure. Never legacy fallback.
  const bootStyle = document.createElement('style');
  bootStyle.id = 'rp-shell-boot-style';
  bootStyle.textContent = `
    html.rp-shell-booting body{
      margin:0!important;
      min-height:100dvh!important;
      overflow:hidden!important;
      background:#020306!important;
    }
    html.rp-shell-booting body>*{
      visibility:hidden!important;
    }
    html.rp-shell-booting body::before,
    html.rp-shell-booting body::after{
      position:fixed;
      left:50%;
      z-index:2147483647;
      visibility:visible!important;
      pointer-events:none;
      transform:translateX(-50%);
      text-align:center;
    }
    html.rp-shell-booting body::before{
      content:'REAL PLAY';
      top:45%;
      color:#f6f9ff;
      font-family:Impact,'Arial Narrow',Arial,sans-serif;
      font-size:clamp(2rem,9vw,3.25rem);
      font-style:italic;
      font-weight:950;
      letter-spacing:.025em;
      white-space:nowrap;
    }
    html.rp-shell-booting body::after{
      content:'BASKETBALL  ·  LOADING';
      top:calc(45% + 58px);
      color:#42d8ff;
      font-family:Arial,sans-serif;
      font-size:.56rem;
      font-weight:900;
      letter-spacing:.22em;
      white-space:nowrap;
      animation:rpShellBootPulse 1.1s ease-in-out infinite alternate;
    }
    html.rp-shell-booting.rp-shell-failed body::after{
      content:'LOAD FAILED  ·  REFRESH';
      color:#ff7b8c;
      animation:none;
      opacity:1;
    }
    @keyframes rpShellBootPulse{
      from{opacity:.38}
      to{opacity:1}
    }
    @media(prefers-reduced-motion:reduce){
      html.rp-shell-booting body::after{animation:none;opacity:.78}
    }
  `;
  document.head.appendChild(bootStyle);

  let shellReady = false;
  let shellReadyObserver = null;

  function clearStaticBootFallback() {
    if (window.__rpStaticBootFallback) {
      window.clearTimeout(window.__rpStaticBootFallback);
      window.__rpStaticBootFallback = null;
    }
  }

  // Neutralize any older inline HTML fallback as soon as app.js starts. This
  // prevents cached index.html from uncovering the legacy carousel after 8s.
  clearStaticBootFallback();

  function revealNewShell() {
    if (shellReady) return true;
    const nav = document.querySelector('[data-rp-simple-nav]');
    const home = document.querySelector('[data-rp-simple-home]');
    if (!nav || !home) return false;
    shellReady = true;
    clearStaticBootFallback();
    html.classList.remove('rp-shell-booting', 'rp-shell-failed');
    html.classList.add('rp-shell-ready');
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    return true;
  }

  shellReadyObserver = new MutationObserver(revealNewShell);
  shellReadyObserver.observe(document.documentElement, { childList: true, subtree: true });

  function showBootFailure(message, error) {
    clearStaticBootFallback();
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    html.classList.add('rp-shell-booting', 'rp-shell-failed');
    html.classList.remove('rp-shell-ready');
    console.error(`[Real Play] ${message || 'New shell failed to initialize.'}`, error || '');
  }

  function addStylesheet(href) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${version}`;
    document.head.appendChild(css);
  }

  // Every script request must settle. Previously one stalled optional request
  // could hold the sequential loader forever, meaning main-menu.js and
  // simple-navigation.js were never reached and the loading screen never left.
  function loadScript(href, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      let settled = false;
      let timer = 0;

      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        resolve(Boolean(loaded));
      };

      script.src = `${href}?v=${version}`;
      script.async = false;
      script.addEventListener('load', () => finish(true), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
      timer = window.setTimeout(() => {
        console.warn(`[Real Play] Script load timed out: ${href}`);
        try { script.remove(); } catch (_error) {}
        finish(false);
      }, Math.max(1500, Number(timeoutMs) || 6000));
      document.head.appendChild(script);
    });
  }

  [
    'mobile-lobby.css',
    'lobby-topbar-cleanup.css',
    'mobile-entry.css',
    'public-landing.css',
    'public-pricing-breakdown.css',
    'public-story-carousel.css',
    'ambient-brand-glow.css',
    'public-landing-premium.css',
    'public-landing-ball-focus.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'main-menu.css',
    'ranking-games.css',
    'ranking-games-cleanup.css',
    'three-v-three-beta.css',
    'three-v-three-secure-spot.css',
    'three-v-three-refinement.css',
    'three-v-three-participants.css',
    'three-v-three-premium.css',
    'three-v-three-logo-scale.css',
    'three-v-three-club-themes.css',
    'career-beta.css',
    'career-beta-play.css',
    'career-game-replay.css',
    'career-game-replay-stats.css',
    'career-game-replay-winner.css',
    'real-play-updates.css',
    'real-play-updates-cleanup.css',
    'real-play-updates-game-detail.css',
    'real-play-world.css',
    'real-play-world-chat-cleanup.css',
    'real-play-world-chat-moderation.css',
    'real-play-profile.css',
    'profile-identity-cleanup.css',
    'real-play-profile-intro.css',
    'real-play-profile-metrics.css',
    'profile-metrics-stability.css',
    'membership.css',
    'real-play-brand-system.css',
    'main-menu-brand-overrides.css',
    'main-menu-cinematic.css',
    'main-menu-ball-background.css',
    'main-menu-card-premium.css',
    'main-menu-physics.css',
    'main-menu-fast-snap.css',
    'settings-panel.css',
    'auth-welcome-cleanup.css',
    'public-landing-cleanup.css',
    'public-origin-center.css',
    'public-carousel-center-force.css',
    'public-founder-credit.css',
    'admin-courtside-live.css',
    'admin-shot-breakdown.css',
    'admin-recorded-scoring-winner.css',
    'visitor-mode.css',
    'simple-navigation.css',
    'home-main-announcement-art.css',
    'home-open-rank-art.css',
    'world-results.css',
  ].forEach(addStylesheet);

  (async () => {
    const guardLoaded = await loadScript('auth-session-guard.js', 5000);
    const entryLoaded = await loadScript('public-first-entry.js', 5000);
    if (!guardLoaded) console.warn('[Real Play] Auth session guard did not load during startup.');
    if (!entryLoaded) console.warn('[Real Play] Public-first entry did not load during startup.');

    const lobbyLoaded = await loadScript('mobile-lobby.js', 6500);
    const lobbyMounted = Boolean(document.querySelector('[data-rp-app]'));

    if (!lobbyLoaded || !lobbyMounted) {
      showBootFailure('Mobile lobby failed to mount.');
      return;
    }

    await loadScript('legacy-bottom-nav-removal.js', 3500);

    // Build the visible shell BEFORE optional product layers. These four files
    // are the actual dependency chain for [data-rp-main-menu], Home and bottom nav.
    await loadScript('main-menu-fast-snap-bootstrap.js', 3500);
    const mainMenuLoaded = await loadScript('main-menu.js', 6500);
    const simpleNavLoaded = await loadScript('simple-navigation.js', 6500);
    const navAuthorityLoaded = await loadScript('simple-navigation-state-authority.js', 6500);

    if (!mainMenuLoaded || !simpleNavLoaded) {
      showBootFailure('Critical Real Play navigation failed to initialize.');
      return;
    }
    if (!navAuthorityLoaded) {
      console.warn('[Real Play] Navigation authority layer did not load; base navigation remains available.');
    }

    if (!revealNewShell()) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (!revealNewShell()) {
        showBootFailure('New shell did not initialize.');
        return;
      }
    }

    // Everything below enhances an already-visible, already-usable shell.
    // A slow or failed optional file can no longer trap the user on LOADING.
    const enhancements = [
      'public-landing.js',
      'visitor-mode.js',
      'public-founder-credit.js',
      'login-landing-fix.js',
      'persistent-session-fix.js',
      'career-beta.js',
      'career-beta-play.js',
      'visitor-replay-access.js',
      'career-game-replay.js',
      'career-game-replay-marker-cleanup.js',
      'career-game-replay-assist-authority.js',
      'career-game-replay-positive-events.js',
      'career-game-replay-fullscreen-back.js',
      'career-game-replay-stats.js',
      'career-game-replay-comments-viewport.js',
      'career-game-replay-winner.js',
      'membership-bootstrap.js',
      'career-beta-leaderboard.js',
      'three-v-three-beta.js',
      'three-v-three-layout-order.js',
      'three-v-three-refinement.js',
      'three-v-three-participants.js',
      'three-v-three-club-art.js',
      'real-play-updates.js',
      'real-play-updates-info-toggle.js',
      'updates-session-title-admin.js',
      'real-play-updates-game-detail.js',
      'real-play-world.js',
      'real-play-world-chat-cleanup.js',
      'profile-load-guard.js',
      'real-play-profile.js',
      'real-play-profile-intro.js',
      'profile-metrics-stability.js',
      'real-play-profile-metrics.js',
      'real-play-world-players.js',
      'visitor-world-players.js',
      'world-results.js',
      'player-id-badge.js',
      'real-play-world-score-order-fix.js',
      'profile-game-replay-link.js',
      'real-play-world-player-filters.js',
      'real-play-world-player-admin.js',
      'main-menu-fast-snap-restore.js',
      'main-menu-touch-lite.js',
      'main-menu-desktop-input-fix.js',
      'player-number-recovery.js',
      'ranking-games.js',
      'ranking-games-info-toggle.js',
      'ranking-games-session-cleanup.js',
      'overlay-focus-release.js',
      'settings-panel.js',
      'player-admin-probe-guard.js',
      'admin-live-stat-stability.js',
      'admin-courtside-live.js',
      'admin-recorded-stat-controls-fix.js',
      'admin-recorded-scoring-winner.js',
      'admin-access-bootstrap.js',
      'real-play-world-chat-moderation.js',
      'admin-live-session-expiry.js',
      'admin-game-type-switch.js',
      'admin-session-picker-v5-loader.js',
      'open-rank-auto-id.js',
      'career-game-replay-admin-edit.js',
      'admin-game-rotation.js',
      'admin-live-refresh-fix.js',
    ];

    for (const href of enhancements) {
      const loaded = await loadScript(href, 4500);
      if (!loaded) console.warn(`[Real Play] Optional layer failed to load: ${href}`);
    }
  })().catch((error) => {
    showBootFailure('Startup stopped on an unexpected error.', error);
  });
})();