(() => {
  const version = '20260924-lazy-start-v1';
  const html = document.documentElement;
  const bootStartedAt = performance.now();
  const MIN_BOOT_DISPLAY_MS = 450;
  html.classList.add('js', 'rp-shell-booting');

  const bootStyle = document.createElement('style');
  bootStyle.id = 'rp-shell-boot-style';
  bootStyle.textContent = `
    html.rp-shell-booting body{margin:0!important;min-height:100dvh!important;overflow:hidden!important;background:#020306!important;pointer-events:none!important;user-select:none!important}
    html.rp-shell-booting body>*{visibility:hidden!important;pointer-events:none!important}
    html.rp-shell-booting body::before,html.rp-shell-booting body::after{position:fixed;left:50%;z-index:2147483647;visibility:visible!important;pointer-events:none;transform:translateX(-50%);text-align:center}
    html.rp-shell-booting body::before{content:'REAL PLAY';top:45%;color:#f6f9ff;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(2rem,9vw,3.25rem);font-style:italic;font-weight:950;letter-spacing:.025em;white-space:nowrap}
    html.rp-shell-booting body::after{content:'BASKETBALL  ·  LOADING';top:calc(45% + 58px);color:#42d8ff;font-family:Arial,sans-serif;font-size:.56rem;font-weight:900;letter-spacing:.22em;white-space:nowrap;animation:rpShellBootPulse 1.1s ease-in-out infinite alternate}
    html.rp-shell-booting.rp-shell-failed body::after{content:'LOAD FAILED  ·  REFRESH';color:#ff7b8c;animation:none;opacity:1}
    @keyframes rpShellBootPulse{from{opacity:.38}to{opacity:1}}
    @media(prefers-reduced-motion:reduce){html.rp-shell-booting body::after{animation:none;opacity:.78}}
  `;
  document.head.appendChild(bootStyle);

  let shellReady = false;
  let shellReadyObserver = null;
  const scriptPromises = new Map();
  const stylePromises = new Map();

  function clearStaticBootFallback() {
    if (!window.__rpStaticBootFallback) return;
    window.clearTimeout(window.__rpStaticBootFallback);
    window.__rpStaticBootFallback = null;
  }
  clearStaticBootFallback();

  function sameAsset(urlA, urlB) {
    try {
      const a = new URL(urlA, document.baseURI);
      const b = new URL(urlB, document.baseURI);
      return a.origin === b.origin && a.pathname === b.pathname;
    } catch (_error) {
      return false;
    }
  }

  function loadScript(href, timeoutMs = 8000) {
    const key = new URL(href, document.baseURI).pathname;
    if (scriptPromises.has(key)) return scriptPromises.get(key);
    const existing = Array.from(document.scripts).find((script) => sameAsset(script.src, href));
    if (existing) {
      const ready = Promise.resolve(true);
      scriptPromises.set(key, ready);
      return ready;
    }

    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) scriptPromises.delete(key);
        resolve(Boolean(ok));
      };
      script.src = `${href}${href.includes('?') ? '&' : '?'}v=${version}`;
      script.async = false;
      script.addEventListener('load', () => finish(true), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      document.head.appendChild(script);
    });
    scriptPromises.set(key, promise);
    return promise;
  }

  function loadStyle(href, timeoutMs = 8000) {
    const key = new URL(href, document.baseURI).pathname;
    if (stylePromises.has(key)) return stylePromises.get(key);
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => sameAsset(link.href, href));
    if (existing) {
      const ready = Promise.resolve(true);
      stylePromises.set(key, ready);
      return ready;
    }

    const promise = new Promise((resolve) => {
      const link = document.createElement('link');
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) stylePromises.delete(key);
        resolve(Boolean(ok));
      };
      link.rel = 'stylesheet';
      link.href = `${href}${href.includes('?') ? '&' : '?'}v=${version}`;
      link.addEventListener('load', () => finish(true), { once: true });
      link.addEventListener('error', () => finish(false), { once: true });
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      document.head.appendChild(link);
    });
    stylePromises.set(key, promise);
    return promise;
  }

  // Share the same deduped transport with the on-demand feature loader.
  if (window.RealPlayFeatureLoader) {
    window.RealPlayFeatureLoader.loadScript = loadScript;
    window.RealPlayFeatureLoader.loadStyle = loadStyle;
  }

  function hasCoreShell() {
    const navItems = document.querySelectorAll('[data-rp-simple-nav-item]');
    return Boolean(
      document.querySelector('[data-rp-simple-nav]') &&
      document.querySelector('[data-rp-simple-home][data-rp-home-command-center="true"]') &&
      document.querySelector('[data-rp-home-save-slot]') &&
      document.querySelector('[data-rp-home-whats-coming]') &&
      navItems.length === 5
    );
  }

  function revealShell() {
    if (shellReady || !hasCoreShell()) return false;
    shellReady = true;
    clearStaticBootFallback();
    html.classList.remove('rp-shell-booting', 'rp-shell-failed');
    html.classList.add('rp-shell-ready');
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    try { window.dispatchEvent(new CustomEvent('realplay:app-ready')); } catch (_error) {}
    return true;
  }

  function showBootFailure(message, error) {
    if (shellReady) {
      console.error(`[Real Play] ${message || 'Optional layer failed.'}`, error || '');
      return;
    }
    clearStaticBootFallback();
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    html.classList.add('rp-shell-booting', 'rp-shell-failed');
    html.classList.remove('rp-shell-ready');
    console.error(`[Real Play] ${message || 'Core shell failed to initialize.'}`, error || '');
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function waitForMinimumBootDisplay() {
    const remaining = MIN_BOOT_DISPLAY_MS - (performance.now() - bootStartedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  async function waitForHomeQuiet(timeoutMs = 1400, quietMs = 180) {
    const root = document.querySelector('[data-rp-simple-home]');
    if (!root) return;
    await new Promise((resolve) => {
      let done = false;
      let quietTimer = 0;
      const observer = new MutationObserver(() => {
        window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(finish, quietMs);
      });
      const finish = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        window.clearTimeout(quietTimer);
        window.clearTimeout(hardTimer);
        resolve();
      };
      observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
      quietTimer = window.setTimeout(finish, quietMs);
      const hardTimer = window.setTimeout(finish, timeoutMs);
    });
  }

  const CORE_STYLES = [
    'mobile-lobby.css',
    'lobby-topbar-cleanup.css',
    'mobile-entry.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'simple-navigation.css',
    'home-main-announcement-art.css',
    'home-open-rank-art.css',
    'home-why-real-play.css',
    'public-founder-credit.css',
    'visitor-mode.css',
    'auth-welcome-cleanup.css',
  ];

  (async () => {
    const coreStyleLoad = Promise.all(CORE_STYLES.map((href) => loadStyle(href, 5000)));

    const [guardLoaded, entryLoaded] = await Promise.all([
      loadScript('auth-session-guard.js', 6000),
      loadScript('public-first-entry.js', 6000),
    ]);
    if (!guardLoaded) console.warn('[Real Play] Auth session guard did not load during startup.');
    if (!entryLoaded) console.warn('[Real Play] Public-first entry did not load during startup.');

    const lobbyLoaded = await loadScript('mobile-lobby.js', 6500);
    if (!lobbyLoaded || !document.querySelector('[data-rp-app]')) {
      showBootFailure('Mobile lobby failed to mount.');
      return;
    }

    await Promise.all([
      loadScript('legacy-bottom-nav-removal.js', 3500),
      loadScript('simple-navigation.js', 6500),
    ]);

    if (!document.querySelector('[data-rp-simple-nav]') || !document.querySelector('[data-rp-simple-home]')) {
      showBootFailure('Critical Real Play navigation failed to initialize.');
      return;
    }

    const navAuthorityLoaded = await loadScript('simple-navigation-state-authority.js', 6500);
    if (!navAuthorityLoaded) {
      showBootFailure('Home navigation authority failed to initialize.');
      return;
    }

    // HOME-only enhancements. Deep feature screens are owned by lazy-feature-loader.js.
    for (const href of [
      'home-why-real-play.js',
      'visitor-mode.js',
      'public-founder-credit.js',
      'login-landing-fix.js',
      'persistent-session-fix.js',
    ]) {
      const loaded = await loadScript(href, 5000);
      if (!loaded) console.warn(`[Real Play] Home layer failed to load: ${href}`);
    }

    await coreStyleLoad;
    await waitForHomeQuiet();
    await waitForMinimumBootDisplay();
    await nextPaint();

    if (!revealShell()) {
      showBootFailure('Real Play core shell is unavailable.');
      return;
    }

    // Do not start a whole-app background download here. The next feature is
    // fetched only when the player asks for it.
    try { window.dispatchEvent(new CustomEvent('realplay:enhancements-ready', { detail: { lazy: true } })); } catch (_error) {}
  })().catch((error) => showBootFailure('Startup stopped on an unexpected error.', error));

  shellReadyObserver = new MutationObserver(() => {
    if (shellReady) return;
    if (hasCoreShell()) revealShell();
  });
  shellReadyObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
