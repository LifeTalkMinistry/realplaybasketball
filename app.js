(() => {
  const version = '20260923-profile-hero-contract-v119';
  const html = document.documentElement;
  html.classList.add('js', 'rp-shell-booting');

  // Startup has only three visible states:
  // loading -> usable core shell, loading -> explicit critical failure, then
  // progressive enhancement continues without owning the boot gate.
  const bootStyle = document.createElement('style');
  bootStyle.id = 'rp-shell-boot-style';
  bootStyle.textContent = `
    html.rp-shell-booting body{
      margin:0!important;
      min-height:100dvh!important;
      overflow:hidden!important;
      background:#020306!important;
      pointer-events:none!important;
      user-select:none!important;
    }
    html.rp-shell-booting body>*{
      visibility:hidden!important;
      pointer-events:none!important;
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
  let bootResourcesReady = false;
  let shellReadyObserver = null;

  function clearStaticBootFallback() {
    if (window.__rpStaticBootFallback) {
      window.clearTimeout(window.__rpStaticBootFallback);
      window.__rpStaticBootFallback = null;
    }
  }

  // Neutralize the older inline HTML fallback as soon as app.js starts. The
  // loader must never uncover a partially initialized interface after 8s.
  clearStaticBootFallback();

  function hasNewShell() {
    return Boolean(
      document.querySelector('[data-rp-simple-nav]') &&
      document.querySelector('[data-rp-simple-home]')
    );
  }

  function revealNewShell() {
    if (shellReady) return true;
    if (!bootResourcesReady || !hasNewShell()) return false;

    shellReady = true;
    clearStaticBootFallback();
    html.classList.remove('rp-shell-booting', 'rp-shell-failed');
    html.classList.add('rp-shell-ready');
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;

    try {
      window.dispatchEvent(new CustomEvent('realplay:app-ready'));
    } catch (_error) {}

    return true;
  }

  shellReadyObserver = new MutationObserver(revealNewShell);
  shellReadyObserver.observe(document.documentElement, { childList: true, subtree: true });

  function showBootFailure(message, error) {
    // Once the usable shell is visible, an optional enhancement is never
    // allowed to throw the player back onto the black loading/failure screen.
    if (shellReady) {
      console.error(`[Real Play] ${message || 'Optional startup layer failed.'}`, error || '');
      return;
    }

    clearStaticBootFallback();
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    html.classList.add('rp-shell-booting', 'rp-shell-failed');
    html.classList.remove('rp-shell-ready');
    console.error(`[Real Play] ${message || 'New shell failed to initialize.'}`, error || '');
  }

  function addStylesheet(href, timeoutMs = 6500) {
    return new Promise((resolve) => {
      const css = document.createElement('link');
      let settled = false;
      let timer = 0;

      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        resolve(Boolean(loaded));
      };

      css.rel = 'stylesheet';
      css.href = `${href}?v=${version}`;
      css.addEventListener('load', () => finish(true), { once: true });
      css.addEventListener('error', () => finish(false), { once: true });
      timer = window.setTimeout(() => {
        console.warn(`[Real Play] Stylesheet load timed out: ${href}`);
        finish(false);
      }, Math.max(1500, Number(timeoutMs) || 6500));
      document.head.appendChild(css);
    });
  }

  // Every script request must settle so one optional network request cannot
  // permanently trap startup or the later enhancement chain.
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

  function nextPaint() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
  }

  async function waitForVisualStability() {
    const fontReady = document.fonts?.ready
      ? Promise.resolve(document.fonts.ready).catch(() => undefined)
      : Promise.resolve();

    await Promise.race([
      fontReady,
      new Promise((resolve) => window.setTimeout(resolve, 1500)),
    ]);

    const images = Array.from(document.images || []);
    if (images.length) {
      const imageReady = Promise.all(images.map((image) => {
        if (image.complete) {
          if (typeof image.decode === 'function') return image.decode().catch(() => undefined);
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));

      await Promise.race([
        imageReady,
        new Promise((resolve) => window.setTimeout(resolve, 3000)),
      ]);
    }

    await nextPaint();
  }

  const stylesheetHrefs = [
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
    'ranking-session-teams.css',
    'ranking-team-support-center-force.css',
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
    'public-origin-center-force.css',
    'public-founder-credit.css',
    'admin-courtside-live.css',
    'admin-shot-breakdown.css',
    'admin-recorded-scoring-winner.css',
    'visitor-mode.css',
    'simple-navigation.css',
    'home-main-announcement-art.css',
    'home-open-rank-art.css',
    'home-why-real-play.css',
    'world-results.css',
  ];

  // Only these first-frame styles are allowed to participate in the boot gate.
  // All feature-specific CSS loads after the usable Home/navigation shell is up.
  const criticalStylesheetHrefs = new Set([
    'mobile-lobby.css',
    'mobile-entry.css',
    'public-landing.css',
    'public-landing-cleanup.css',
    'mobile-shell-fix.css',
    'main-menu.css',
    'simple-navigation.css',
  ]);

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
    await loadScript('main-menu-fast-snap-bootstrap.js', 3500);

    const mainMenuLoaded = await loadScript('main-menu.js', 6500);
    const simpleNavLoaded = await loadScript('simple-navigation.js', 6500);

    if (!mainMenuLoaded || !simpleNavLoaded) {
      showBootFailure('Critical Real Play navigation failed to initialize.');
      return;
    }

    if (!hasNewShell()) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (!hasNewShell()) {
        showBootFailure('New shell did not initialize.');
        return;
      }
    }

    // First usable frame: wait only for the handful of CSS files that define
    // entry visibility plus Home/navigation structure. Optional product layers
    // must never keep the player on LOADING.
    const criticalStyleResults = await Promise.all(
      [...criticalStylesheetHrefs].map((href) => addStylesheet(href, 3500))
    );
    criticalStyleResults.forEach((loaded, index) => {
      if (!loaded) console.warn(`[Real Play] Critical shell stylesheet did not settle at index ${index}.`);
    });

    bootResourcesReady = true;
    if (!revealNewShell()) {
      showBootFailure('Real Play core shell is unavailable.');
      return;
    }

    // Home schedule authority enhances an already-visible shell. If it is slow
    // or unavailable, base Home/navigation remains usable.
    const navAuthorityLoaded = await loadScript('simple-navigation-state-authority.js', 6500);
    if (!navAuthorityLoaded) {
      console.warn('[Real Play] Navigation authority layer did not load; base navigation remains available.');
    }

    const enhancements = [
      'public-landing.js',
      'home-why-real-play.js',
      'visitor-mode.js',
      'public-founder-credit.js',
      'home-future-4v4-preview.js',
      'home-future-4v4-card-cleanup.js',
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
      'career-game-replay-official-mvp.js',
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
      'settings-panel.js',
      'profile-art-owner-access.js',
      'real-play-profile-intro.js',
      'profile-metrics-stability.js',
      'real-play-profile-metrics.js',
      'real-play-world-players.js',
      'visitor-world-players.js',
      'public-profile-history.js',
      'real-play-rank-explainer.js',
      'world-results.js',
      'player-id-badge.js',
      'real-play-world-score-order-fix.js',
      'profile-game-replay-link.js',
      'real-play-world-player-filters.js',
      'real-play-captain-eligibility.js',
      'real-play-world-player-bar-vector.js',
      'real-play-world-player-admin.js',
      'real-play-player-claim.js',
      'main-menu-fast-snap-restore.js',
      'main-menu-touch-lite.js',
      'main-menu-desktop-input-fix.js',
      'player-number-recovery.js',
      'player-identity-manager.js',
      'ranking-games.js',
      'ranking-games-secured-players.js',
      'ranking-games-standby-players.js',
      'ranking-games-info-toggle.js',
      'ranking-games-session-cleanup.js',
      'ranking-team-support-center-force.js',
      'ranking-team-support-tiers.js',
      'ranking-session-teams.js',
      'ranking-spot-priority.js',
      'ranking-reservation-snapshot.js',
      'overlay-focus-release.js',
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
      'career-game-replay-admin-root.js',
      'admin-game-rotation.js',
      'admin-live-refresh-fix.js',
    ];

    for (const href of enhancements) {
      const loaded = await loadScript(href, 4500);
      if (!loaded) console.warn(`[Real Play] Optional layer failed to load: ${href}`);
    }

    const remainingStyles = stylesheetHrefs.filter((href) => !criticalStylesheetHrefs.has(href));
    const stylesheetLoads = remainingStyles.map((href) => addStylesheet(href));
    const stylesheetResults = await Promise.all(stylesheetLoads);
    stylesheetResults.forEach((loaded, index) => {
      if (!loaded) console.warn(`[Real Play] Optional stylesheet failed to settle at index ${index}.`);
    });

    await waitForVisualStability();

    try {
      window.dispatchEvent(new CustomEvent('realplay:enhancements-ready'));
    } catch (_error) {}
  })().catch((error) => {
    if (shellReady) {
      console.error('[Real Play] Progressive enhancement startup stopped after the core shell was ready.', error);
      return;
    }
    showBootFailure('Startup stopped on an unexpected error.', error);
  });
})();