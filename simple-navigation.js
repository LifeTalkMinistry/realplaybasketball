(() => {
  if (window.__realPlaySimpleNavigationInstalled) return;
  window.__realPlaySimpleNavigationInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_HOME_URL = 'https://api.clarapmc.com/api/real-play/public/home-summary';
  const NAV_ITEMS = [
    { id: 'home', label: 'HOME', icon: '⌂' },
    { id: 'world', label: 'WORLD', icon: '◎' },
    { id: 'players', label: 'STATS', icon: '▥' },
    { id: 'chats', label: 'CHATS', icon: '◌' },
    { id: 'me', label: 'ME', icon: '●' },
  ];

  let active = 'home';
  let homeRefreshTimer = null;
  let installed = false;
  const featureScriptPromises = new Map();
  const featureStylePromises = new Map();

  function deployVersion() {
    return String(document.documentElement?.dataset?.rpDeploy || 'primary-nav');
  }

  function scriptReady(src, ready) {
    try {
      return typeof ready === 'function' ? Boolean(ready()) : false;
    } catch (_error) {
      return false;
    }
  }

  function existingScript(src) {
    return [...document.scripts].find((script) => {
      const url = String(script.src || '');
      return url.includes('/' + src) || url.endsWith(src) || url.includes(src + '?');
    }) || null;
  }

  function waitForReady(ready, timeoutMs = 1200) {
    return new Promise((resolve) => {
      if (scriptReady('', ready)) {
        resolve(true);
        return;
      }
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (scriptReady('', ready)) {
          window.clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 40);
    });
  }

  function loadFeatureScript(src, ready) {
    if (scriptReady(src, ready)) return Promise.resolve(true);
    if (featureScriptPromises.has(src)) return featureScriptPromises.get(src);

    const promise = (async () => {
      // Another startup loader may already be fetching this exact feature.
      // Give it a short chance to finish before issuing a retry.
      if (existingScript(src) && await waitForReady(ready, 900)) return true;

      return new Promise((resolve) => {
        const script = document.createElement('script');
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(Boolean(ok && scriptReady(src, ready)));
        };

        script.src = `${src}?v=${encodeURIComponent(deployVersion())}&rpNavRetry=1`;
        script.async = false;
        script.dataset.rpPrimaryNavRetry = src;
        script.addEventListener('load', () => finish(true), { once: true });
        script.addEventListener('error', () => finish(false), { once: true });
        document.head.appendChild(script);

        window.setTimeout(() => finish(scriptReady(src, ready)), 6500);
      });
    })().finally(() => {
      featureScriptPromises.delete(src);
    });

    featureScriptPromises.set(src, promise);
    return promise;
  }


  function loadFeatureStylesheet(href, timeoutMs = 6500) {
    const deploy = deployVersion();
    const target = new URL(`${href}?v=${encodeURIComponent(deploy)}`, document.baseURI).href;
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find((link) => link.href === target || new URL(link.href, document.baseURI).pathname.endsWith('/' + href));

    const ready = (link) => {
      if (!link || link.disabled) return false;
      try { return Boolean(link.sheet); } catch (_error) { return false; }
    };

    if (ready(existing)) return Promise.resolve(true);
    if (featureStylePromises.has(href)) return featureStylePromises.get(href);

    const promise = new Promise((resolve) => {
      const link = existing || document.createElement('link');
      let settled = false;
      let poll = 0;
      let timer = 0;

      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (poll) window.clearInterval(poll);
        if (timer) window.clearTimeout(timer);
        resolve(Boolean(ok));
      };

      if (!existing) {
        link.rel = 'stylesheet';
        link.href = target;
        link.dataset.rpRouteStyle = href;
        document.head.appendChild(link);
      }

      link.addEventListener('load', () => finish(true), { once: true });
      link.addEventListener('error', () => finish(false), { once: true });

      poll = window.setInterval(() => {
        if (ready(link)) finish(true);
      }, 40);

      timer = window.setTimeout(() => finish(ready(link)), timeoutMs);
    }).finally(() => featureStylePromises.delete(href));

    featureStylePromises.set(href, promise);
    return promise;
  }

  function setNavBusy(target, busy) {
    const button = nav()?.querySelector(`[data-rp-simple-nav-item="${target}"]`);
    if (!button) return;
    button.classList.toggle('rp-nav-loading', Boolean(busy));
    if (busy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  function waitForRouteReady(successEvent, errorEvent = '', timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = 0;

      const cleanup = () => {
        if (timer) window.clearTimeout(timer);
        window.removeEventListener(successEvent, onSuccess);
        if (errorEvent) window.removeEventListener(errorEvent, onError);
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onSuccess = (event) => finish(resolve, event?.detail || {});
      const onError = (event) => finish(
        reject,
        new Error(event?.detail?.message || 'This Real Play page could not finish loading.')
      );

      window.addEventListener(successEvent, onSuccess, { once: true });
      if (errorEvent) window.addEventListener(errorEvent, onError, { once: true });
      timer = window.setTimeout(
        () => finish(reject, new Error('This Real Play page took too long to load.')),
        Math.max(2000, Number(timeoutMs) || 8000)
      );
    });
  }

  // The official loader is a layer gate, not a whole-page gate. Each route
  // declares only the shell + above-the-fold data needed for the first usable
  // frame. Everything below that contract is free to continue hydrating after
  // the loader disappears.
  const ROUTE_LAYER_CONTRACTS = {
    world: {
      root: '[data-rp-updates]',
      layer: '[data-updates-feed]',
      required: ['[data-rp-world-results-controls]'],
      rootReady: (root) => root.classList.contains('open')
        && root.classList.contains('rp-world-results-entry')
        && document.body.classList.contains('rp-updates-open'),
      dataReady: (layer, detail) => Number(detail?.loaded || 0) <= 0
        || Boolean(layer.querySelector('.rp-update-result:not([hidden])')),
    },
    stats: {
      root: '[data-rp-competition-hub]',
      layer: '[data-rp-competition-view="hub"]',
      required: ['.rp-competition-card-grid'],
      rootReady: (root) => root.classList.contains('open')
        && root.getAttribute('aria-hidden') !== 'true',
      layerReady: (layer) => !layer.hidden,
    },
    players: {
      root: '[data-rp-world]',
      layer: '[data-world-view="players"]',
      required: ['[data-world-player-list]'],
      rootReady: (root) => root.classList.contains('open')
        && root.getAttribute('aria-hidden') !== 'true',
      layerReady: (layer) => !layer.hidden,
      dataReady: (layer, detail) => Number(detail?.count || 0) <= 0
        || Boolean(layer.querySelector('[data-world-player-id]')),
    },
    chats: {
      root: '[data-rp-world]',
      layer: '[data-world-view="chats"]',
      required: ['[data-chat-channels]', '[data-chat-thread]', '[data-chat-form]'],
      rootReady: (root) => root.classList.contains('open')
        && root.getAttribute('aria-hidden') !== 'true',
      layerReady: (layer) => !layer.hidden,
      dataReady: (layer, detail) => Number(detail?.count || 0) > 0
        ? Boolean(layer.querySelector('.rp-chat-message'))
        : Boolean(layer.querySelector('.rp-chat-empty')),
    },
    me: {
      root: '[data-rp-profile]',
      layer: '[data-rp-profile-content]',
      required: [],
      rootReady: (root) => root.classList.contains('open')
        && root.getAttribute('aria-hidden') !== 'true',
      dataReady: (layer) => Boolean(
        layer.querySelector('.rp-profile-hero')
        || layer.querySelector('.rp-profile-empty')
      ),
    },
  };

  function routeLayerSnapshot(target, detail = {}) {
    const contract = ROUTE_LAYER_CONTRACTS[target];
    if (!contract) return { ready: true, root: null, layer: null };

    const root = document.querySelector(contract.root);
    if (!root || (contract.rootReady && !contract.rootReady(root, detail))) {
      return { ready: false, root, layer: null };
    }

    const layer = contract.layer ? root.querySelector(contract.layer) : root;
    if (!layer || (contract.layerReady && !contract.layerReady(layer, detail))) {
      return { ready: false, root, layer };
    }

    if ((contract.required || []).some((selector) => !layer.querySelector(selector) && !root.querySelector(selector))) {
      return { ready: false, root, layer };
    }

    if (contract.dataReady && !contract.dataReady(layer, detail, root)) {
      return { ready: false, root, layer };
    }

    const rootRect = root.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    if (rootRect.width < 40 || rootRect.height < 40 || layerRect.width < 20 || layerRect.height < 20) {
      return { ready: false, root, layer };
    }

    return { ready: true, root, layer };
  }

  function waitForCriticalImages(layer, timeoutMs = 900) {
    if (!layer) return Promise.resolve();
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const images = [...layer.querySelectorAll('img[src]')]
      .filter((img) => {
        if (img.complete) return false;
        const rect = img.getBoundingClientRect();
        return rect.bottom >= 0 && rect.top <= viewportHeight * 1.15;
      })
      .slice(0, 6);
    if (!images.length) return Promise.resolve();

    return Promise.race([
      Promise.all(images.map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  }

  async function waitForRouteLayer(target, detail = {}, timeoutMs = 2200) {
    const contract = ROUTE_LAYER_CONTRACTS[target];
    if (!contract) return true;

    const started = performance.now();
    let snapshot = routeLayerSnapshot(target, detail);
    while (!snapshot.ready && performance.now() - started < timeoutMs) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      snapshot = routeLayerSnapshot(target, detail);
    }
    if (!snapshot.ready) {
      throw new Error('The first visible layer of this Real Play page did not become ready.');
    }

    // Only wait for images that can affect the first visible frame. WORLD is
    // narrowed to its first result card so later cards can keep hydrating.
    const imageLayer = target === 'world'
      ? (snapshot.layer.querySelector('.rp-update-result:not([hidden])') || snapshot.layer)
      : snapshot.layer;
    await waitForCriticalImages(imageLayer);

    // Two committed paints prevent shell/data swaps from flashing half-built UI.
    await new Promise((resolve) => window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    }));

    const finalSnapshot = routeLayerSnapshot(target, detail);
    if (!finalSnapshot.ready) {
      throw new Error('The first visible layer changed before it could be shown.');
    }
    return true;
  }

  async function ensureWorldFeedFeature() {
    // WORLD's real page is not allowed to replace its loading screen until its
    // own visual system is physically attached. Previously the data could win
    // the race before these styles loaded, exposing Home underneath WORLD.
    const [updatesStyle, cleanupStyle, resultsStyle, updatesReady] = await Promise.all([
      loadFeatureStylesheet('real-play-updates.css'),
      loadFeatureStylesheet('real-play-updates-cleanup.css'),
      loadFeatureStylesheet('world-results.css'),
      loadFeatureScript(
        'real-play-updates.js',
        () => Boolean(window.RealPlayUpdates?.open)
      ),
    ]);
    if (!updatesStyle || !cleanupStyle || !resultsStyle || !updatesReady) return false;

    return loadFeatureScript(
      'world-results.js',
      () => Boolean(window.RealPlayWorldResults?.open)
    );
  }

  async function ensureWorldFeature(tab) {
    // WORLD is no longer owned by the legacy community/composer view.
    // Only PLAYERS and CHATS still depend on real-play-world.js.
    if (tab === 'world') return ensureWorldFeedFeature();

    if (!(await loadFeatureScript('real-play-world.js', () => Boolean(window.RealPlayWorld?.open)))) {
      return false;
    }
    if (tab !== 'players') return true;

    const playerReady = await loadFeatureScript(
      'real-play-world-players.js',
      () => Boolean(window.RealPlayPlayers?.refresh)
    );
    if (!playerReady) return false;

    if (!hasAccount()) {
      await loadFeatureScript(
        'visitor-world-players.js',
        () => Boolean(window.__realPlayVisitorWorldPlayersInstalled)
      );
    }
    return true;
  }

  async function ensureStatsFeature() {
    const hubReady = await loadFeatureScript(
      'competition-hub.js',
      () => Boolean(window.RealPlayCompetitionHub?.open)
    );
    if (!hubReady) return false;

    // Keep the established compact Stats presentation, but navigation authority
    // remains in this core file so PLAYERS can never flash before STATS.
    await loadFeatureScript(
      'competition-hub-cleanup.js',
      () => Boolean(window.__realPlayCompetitionHubCleanupInstalled)
    );
    return true;
  }

  async function ensureProfileFeature() {
    await loadFeatureScript(
      'profile-load-guard.js',
      () => Boolean(window.__rpProfileLoadGuard)
    );
    return loadFeatureScript(
      'real-play-profile.js',
      () => Boolean(window.RealPlayProfile?.open)
    );
  }

  const hasAccount = () => Boolean(localStorage.getItem(TOKEN_KEY));
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function formatEvent(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function ensurePublicEntry() {
    if (hasAccount()) return;
    if (window.RealPlayVisitor?.isActive?.()) return;
    window.RealPlayVisitor?.enter?.();
  }

  function menu() {
    return document.querySelector('[data-rp-main-menu]');
  }

  function simpleHome() {
    return document.querySelector('[data-rp-simple-home]');
  }

  function nav() {
    return document.querySelector('[data-rp-simple-nav]');
  }

  function routeShell() {
    return document.querySelector('[data-rp-route-shell]');
  }

  function routeSkeletonRows(count = 4) {
    return Array.from({ length: count }, (_, index) => `
      <div class="rp-route-skeleton-row" aria-hidden="true">
        <span class="rp-route-skeleton-avatar"></span>
        <span class="rp-route-skeleton-copy"><i></i><i></i></span>
        <b></b>
      </div>`).join('');
  }

  function routeShellMarkup() {
    // Official Real Play loading screen used by every route. Keep this loader
    // universal so no section invents its own loading UI.
    return `
      <div class="rp-route-shell-content rp-route-shell-world-premium rp-route-shell-world-minimal rp-route-shell-universal-loader">
        <section class="rp-route-world-premium-stage">
          <div class="rp-route-world-premium-logo-wrap" aria-hidden="true">
            <img src="assets/branding/real-play-official-logo.png" alt="">
          </div>
          <div class="rp-route-world-premium-progress" aria-hidden="true">
            <span></span>
          </div>
        </section>
      </div>`;
  }

  function ensureRouteShell() {
    let shell = routeShell();
    if (shell) {
      // Loading/error destinations must live outside the app content tree so
      // no Home/menu stacking context can cover or clip them.
      if (shell.parentElement !== document.body) document.body.appendChild(shell);
      return shell;
    }

    shell = document.createElement('section');
    shell.className = 'rp-route-shell';
    shell.dataset.rpRouteShell = 'true';
    shell.hidden = true;
    shell.setAttribute('aria-live', 'polite');
    shell.setAttribute('aria-busy', 'true');
    document.body.appendChild(shell);

    shell.addEventListener('click', (event) => {
      const retry = event.target.closest('[data-rp-route-retry]');
      if (!retry) return;
      const target = String(shell.dataset.rpRoute || '');
      if (target === 'me') openMe();
      else if (target === 'stats') openStats();
      else if (target === 'players') openWorldTab('players');
      else if (target === 'chats') openWorldTab('chats');
      else if (target === 'world-results' && window.RealPlayWorldResults?.openResults) {
        window.RealPlayWorldResults.openResults();
      }
      else openWorldTab('world');
    });
    return shell;
  }

  function showRouteShell(target) {
    const shell = ensureRouteShell();
    if (!shell) return;
    shell.dataset.rpRoute = target;
    shell.classList.remove('error');
    shell.setAttribute('aria-busy', 'true');
    shell.innerHTML = routeShellMarkup(target);
    shell.hidden = false;
    document.body.classList.add('rp-route-shell-open', 'rp-simple-subview');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showRouteError(target, message) {
    const shell = ensureRouteShell();
    if (!shell) return;
    shell.dataset.rpRoute = target;
    shell.classList.add('error');
    shell.setAttribute('aria-busy', 'false');
    const label = target === 'me'
      ? 'ME'
      : target === 'stats'
        ? 'STATS'
        : target === 'players'
          ? 'PLAYERS'
        : target === 'chats'
          ? 'CHATS'
          : target === 'world-results'
            ? 'RESULTS'
            : 'WORLD';
    shell.innerHTML = `
      <div class="rp-route-shell-content rp-route-shell-error">
        <header class="rp-route-shell-heading"><small>REAL PLAY BASKETBALL</small><strong>${label}</strong><span>COULD NOT OPEN THIS PAGE</span></header>
        <div class="rp-route-shell-error-card">
          <b>PAGE NOT READY.</b>
          <p>${esc(message || 'Real Play could not finish loading this page.')}</p>
          <button type="button" data-rp-route-retry>TRY AGAIN</button>
        </div>
      </div>`;
    shell.hidden = false;
    document.body.classList.add('rp-route-shell-open', 'rp-simple-subview');
  }

  function hideRouteShell(target = '') {
    const shell = routeShell();
    if (!shell) return;
    if (target && shell.dataset.rpRoute && shell.dataset.rpRoute !== target) return;
    shell.hidden = true;
    shell.classList.remove('error');
    shell.removeAttribute('data-rp-route');
    shell.setAttribute('aria-busy', 'false');
    document.body.classList.remove('rp-route-shell-open');
  }

  function setActive(next) {
    active = NAV_ITEMS.some((item) => item.id === next) ? next : 'home';
    nav()?.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function releaseLayerFocus(selector) {
    const layer = document.querySelector(selector);
    const focused = document.activeElement;
    if (!layer || !focused || !layer.contains(focused)) return;
    try { focused.blur?.(); } catch (_error) {}
    try { nav()?.querySelector(`[data-rp-simple-nav-item="${active}"]`)?.focus({ preventScroll: true }); } catch (_error) {}
  }

  function closeLayer(layer) {
    try {
      if (layer === 'world') {
        releaseLayerFocus('[data-rp-world]');
        window.RealPlayWorld?.close?.();
      }
      if (layer === 'profile') {
        releaseLayerFocus('[data-rp-profile]');
        window.RealPlayProfile?.close?.();
      }
      if (layer === 'updates') {
        releaseLayerFocus('[data-rp-updates]');
        window.RealPlayUpdates?.close?.();
      }
    } catch (_error) {
      // Navigation should stay usable even if an optional layer is unavailable.
    }
  }

  function closePrimaryLayers(except = '') {
    if (except !== 'world') closeLayer('world');
    if (except !== 'profile') closeLayer('profile');
    if (except !== 'updates') closeLayer('updates');
  }

  function updateWorldTitle(tab) {
    const strong = document.querySelector('[data-rp-world] .rp-world-title strong');
    const badge = document.querySelector('[data-rp-world] .rp-world-online');
    if (strong) strong.textContent = tab === 'players' ? 'PLAYERS' : tab === 'chats' ? 'CHATS' : 'WORLD';
    if (badge) badge.textContent = tab === 'chats' && !hasAccount() ? 'READ ONLY' : 'COMMUNITY';
  }

  function forcePlayersView(panel) {
    const playerView = panel?.querySelector('[data-world-view="players"]');
    if (!playerView) return false;

    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.worldTab === 'players');
    });
    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== 'players';
    });
    window.RealPlayPlayers?.refresh?.();
    updateWorldTitle('players');
    return true;
  }

  function activateWorldTab(tab, attempt = 0) {
    const panel = document.querySelector('[data-rp-world]');
    if (!panel) {
      if (attempt < 14) window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
      return;
    }

    if (tab === 'players') {
      if (!forcePlayersView(panel) && attempt < 14) {
        window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
      }
      return;
    }

    const trigger = panel.querySelector(`[data-world-tab="${tab}"]`);
    if (trigger) {
      trigger.click();
      updateWorldTitle(tab);
      return;
    }
    if (attempt < 14) window.setTimeout(() => activateWorldTab(tab, attempt + 1), 60);
  }

  async function openStats() {
    // STATS owns the screen synchronously. Do not open the shared Players
    // directory first and then decorate it; that creates a visible data leak.
    setActive('players');
    showRouteShell('stats');
    setNavBusy('players', true);
    closePrimaryLayers();

    try {
      const ready = await ensureStatsFeature();
      if (!ready || !window.RealPlayCompetitionHub?.open) {
        console.error('[Real Play] Stats navigation could not initialize.');
        showRouteError('stats', 'The Stats page did not finish loading.');
        return;
      }

      window.RealPlayCompetitionHub.open();
      await waitForRouteLayer('stats', {}, 2400);
      hideRouteShell('stats');
    } catch (error) {
      console.error('[Real Play] Stats navigation failed.', error);
      showRouteError('stats', error?.message || 'Real Play could not open Stats.');
    } finally {
      setNavBusy('players', false);
    }
  }

  async function openWorldTab(tab, options = {}) {
    const target = tab === 'players' ? 'players' : tab === 'chats' ? 'chats' : 'world';
    const shellTarget = options?.statsContext === true && target === 'players' ? 'stats' : target;

    // Route ownership is synchronous: the instant a primary destination is
    // tapped, its shell replaces the previous page. Cleanup and network/script
    // work happen only after the new destination is already on screen.
    setActive(target);
    showRouteShell(shellTarget);
    setNavBusy(target, true);
    closePrimaryLayers();

    try {
      const ready = await ensureWorldFeature(tab);

      if (target === 'world') {
        if (!ready || !window.RealPlayWorldResults?.open) {
          console.error('[Real Play] World feed navigation could not initialize.');
          showRouteError('world', 'The World feed did not finish loading.');
          return;
        }

        // Critical routing rule: WORLD must never reveal Home or the old
        // community composer between loading and the real WORLD page.
        try { window.RealPlayWorld?.close?.(); } catch (_error) {}
        closePrimaryLayers('updates');

        const readiness = waitForRouteReady(
          'realplay:world-loaded',
          'realplay:world-load-error',
          9000
        );
        window.RealPlayWorldResults.open();

        try {
          const detail = await readiness;
          await waitForRouteLayer('world', detail, 2600);
          hideRouteShell('world');
        } catch (routeError) {
          showRouteError('world', routeError?.message || 'The World feed could not finish loading.');
        }
        return;
      }

      if (!ready || !window.RealPlayWorld?.open) {
        console.error('[Real Play] Shared World navigation could not initialize.');
        showRouteError(shellTarget, 'This Real Play page did not finish loading. Your Home page remains safe in the background.');
        return;
      }

      closePrimaryLayers('world');
      window.RealPlayWorld.open();

      const readiness = target === 'players'
        ? waitForRouteReady('realplay:players-loaded', 'realplay:players-load-error')
        : waitForRouteReady('realplay:chat-loaded', 'realplay:chat-load-error');
      const statsReadiness = options?.statsContext === true && target === 'players'
        ? waitForRouteReady('realplay:stats-view-ready', '', 14_000)
        : null;

      window.setTimeout(() => activateWorldTab(tab), 30);

      try {
        const detail = await readiness;
        if (statsReadiness) await statsReadiness;
        await waitForRouteLayer(target, detail, 2400);
        hideRouteShell(shellTarget);
      } catch (routeError) {
        showRouteError(shellTarget, routeError?.message || 'This Real Play page could not finish loading.');
        return;
      }
    } catch (error) {
      console.error('[Real Play] World navigation failed.', error);
      showRouteError(shellTarget, error?.message || 'Real Play could not open this page.');
    } finally {
      setNavBusy(target, false);
    }
  }

  function openHome() {
    hideRouteShell();
    closePrimaryLayers();
    document.body.classList.remove('rp-simple-subview');
    setActive('home');
    refreshHome();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function requireAccount(copy) {
    if (hasAccount()) return true;
    if (window.RealPlayVisitor?.requireAccount) {
      window.RealPlayVisitor.requireAccount({
        title: 'CREATE YOUR REAL PLAY PLAYER',
        copy: copy || 'Create your Real Play player when you are ready to participate.',
      });
    } else {
      window.RealPlayVisitor?.openAuth?.('signup');
      document.querySelector('[data-auth-open]')?.click();
    }
    return false;
  }

  function syncMeHeader() {
    const profile = document.querySelector('[data-rp-profile]');
    const title = profile?.querySelector('.rp-profile-topbar strong');
    if (title) title.textContent = 'ME';
  }

  async function openMe() {
    if (!requireAccount('Create your player to unlock your own OVR, stats, game history, membership and settings.')) return;

    setActive('me');
    showRouteShell('me');
    setNavBusy('me', true);
    closePrimaryLayers();

    try {
      const ready = await ensureProfileFeature();
      if (!ready || !window.RealPlayProfile?.open) {
        console.error('[Real Play] Profile navigation could not initialize.');
        showRouteError('me', 'Your profile feature did not finish loading. Try again without leaving the app shell.');
        return;
      }

      closePrimaryLayers('profile');
      const readiness = waitForRouteReady('realplay:profile-loaded', 'realplay:profile-load-error');
      window.RealPlayProfile.open();

      try {
        const detail = await readiness;
        await waitForRouteLayer('me', detail, 2400);
        syncMeHeader();
        ensureProfileSettingsButton();
        hideRouteShell('me');
      } catch (routeError) {
        showRouteError('me', routeError?.message || 'Your profile could not finish loading.');
        return;
      }
    } catch (error) {
      console.error('[Real Play] Profile navigation failed.', error);
      showRouteError('me', error?.message || 'Real Play could not open your profile.');
    } finally {
      setNavBusy('me', false);
    }
  }

  function openSettingsFromMe() {
    const legacy = document.querySelector('[data-rp-main-action="settings"]');
    if (!legacy) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    const alreadyActive = legacy.classList.contains('slot-active');
    legacy.classList.add('slot-active');
    legacy.click();
    if (!alreadyActive) window.setTimeout(() => legacy.classList.remove('slot-active'), 0);
  }

  function ensureProfileSettingsButton() {
    const profile = document.querySelector('[data-rp-profile]');
    const actions = profile?.querySelector('.rp-profile-actions');
    if (!actions || actions.querySelector('[data-rp-simple-settings]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rpSimpleSettings = 'true';
    button.textContent = 'SETTINGS';
    button.addEventListener('click', openSettingsFromMe);
    actions.appendChild(button);
  }

  function installHome() {
    const root = menu();
    if (!root || root.querySelector('[data-rp-simple-home]')) return Boolean(root);
    root.classList.add('rp-simple-menu');
    const section = document.createElement('section');
    section.className = 'rp-simple-home';
    section.dataset.rpSimpleHome = 'true';
    section.innerHTML = `
      <header class="rp-simple-home-head">
        <div><small>REAL PLAY BASKETBALL</small><h1>HOME</h1></div>
        <span data-rp-simple-access>PUBLIC</span>
      </header>
      <section class="rp-simple-next" data-rp-simple-next>
        <small>NEXT REAL PLAY</small>
        <h2>CHECKING THE COURT...</h2>
        <p>Official schedules will appear here.</p>
      </section>
      <section class="rp-simple-home-grid">
        <article data-rp-simple-announcement>
          <small>ANNOUNCEMENT</small>
          <strong>REAL PLAY IS LIVE.</strong>
          <p>Official community announcements will appear here.</p>
        </article>
        <article data-rp-simple-result>
          <small>LATEST RESULT</small>
          <strong>NO RESULT YET.</strong>
          <p>Finalized games will appear here.</p>
        </article>
      </section>
      <button class="rp-simple-home-updates" type="button" data-rp-simple-updates>
        <span><small>OFFICIAL FEED</small><strong>SCHEDULES · RESULTS · ANNOUNCEMENTS</strong></span><b>→</b>
      </button>`;
    root.appendChild(section);
    section.querySelector('[data-rp-simple-next]')?.addEventListener('click', () => {
      setActive('home');
      window.RealPlayUpdates?.open?.();
    });
    section.querySelector('[data-rp-simple-updates]')?.addEventListener('click', () => {
      setActive('home');
      window.RealPlayUpdates?.open?.();
    });
    return true;
  }

  function installNav() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return false;
    if (nav()) return true;
    const bar = document.createElement('nav');
    bar.className = 'rp-simple-nav';
    bar.dataset.rpSimpleNav = 'true';
    bar.setAttribute('aria-label', 'Real Play primary navigation');
    bar.innerHTML = NAV_ITEMS.map((item) => `
      <button type="button" class="rp-simple-nav-item${item.id === 'home' ? ' active' : ''}" data-rp-simple-nav-item="${item.id}" aria-current="${item.id === 'home' ? 'page' : 'false'}">
        <span aria-hidden="true">${item.icon}</span><small>${item.label}</small>
      </button>`).join('');
    app.appendChild(bar);
    ensureRouteShell();

    if (!document.documentElement.dataset.rpPrimaryNavAuthorityBound) {
      document.documentElement.dataset.rpPrimaryNavAuthorityBound = 'true';
      document.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-rp-simple-nav-item]');
        if (!button) return;

        // Primary navigation is core-shell authority. Optional feature scripts
        // are not allowed to intercept or replace this transition.
        event.preventDefault();
        event.stopImmediatePropagation();

        const target = button.dataset.rpSimpleNavItem;
        if (target === 'home') openHome();
        else if (target === 'world') openWorldTab('world');
        else if (target === 'players') {
          if (button.dataset.rpCompetitionBypass === '1') openWorldTab('players', { statsContext: true });
          else openStats();
        }
        else if (target === 'chats') openWorldTab('chats');
        else if (target === 'me') openMe();
      }, true);
    }
    return true;
  }

  function resultLabel(update) {
    const west = Number(update?.metadata?.westScore);
    const east = Number(update?.metadata?.eastScore);
    if (Number.isFinite(west) && Number.isFinite(east)) return `WEST ${west} · ${east} EAST`;
    return String(update?.title || 'FINAL RESULT').trim();
  }

  async function refreshHome() {
    const root = simpleHome();
    if (!root) return;
    const access = root.querySelector('[data-rp-simple-access]');
    if (access) access.textContent = hasAccount() ? 'PLAYER' : 'PUBLIC';

    try {
      const response = await fetch(PUBLIC_HOME_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load public updates.');
      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const now = Date.now();
      const schedules = updates
        .filter((item) => item?.category === 'schedule')
        .map((item) => ({ item, time: Date.parse(item.event_at || item.eventAt || '') }))
        .filter((entry) => Number.isFinite(entry.time) && entry.time >= now - 60_000)
        .sort((a, b) => a.time - b.time);
      const next = schedules[0]?.item || null;
      const announcement = updates.find((item) => item?.category === 'announcement' && item?.pinned)
        || updates.find((item) => item?.category === 'announcement')
        || null;
      const result = updates.find((item) => item?.category === 'result') || null;

      const nextNode = root.querySelector('[data-rp-simple-next]');
      if (nextNode) {
        const when = formatEvent(next?.event_at || next?.eventAt);
        const location = String(next?.location_name || next?.locationName || '').trim();
        nextNode.innerHTML = next
          ? `<small>NEXT REAL PLAY</small><h2>${esc(next.title || 'OFFICIAL SESSION')}</h2><p>${esc([when, location].filter(Boolean).join(' · ') || 'Open the official feed for details.')}</p>`
          : '<small>NEXT REAL PLAY</small><h2>TO BE ANNOUNCED.</h2><p>The next official schedule will appear here as soon as it is published.</p>';
      }

      const announcementNode = root.querySelector('[data-rp-simple-announcement]');
      if (announcementNode) {
        announcementNode.innerHTML = announcement
          ? `<small>${announcement.pinned ? 'PINNED ANNOUNCEMENT' : 'ANNOUNCEMENT'}</small><strong>${esc(announcement.title || 'REAL PLAY UPDATE')}</strong><p>${esc(announcement.body || 'Open the official feed for the full update.')}</p>`
          : '<small>ANNOUNCEMENT</small><strong>NO NEW ANNOUNCEMENT.</strong><p>Official community announcements will appear here.</p>';
      }

      const resultNode = root.querySelector('[data-rp-simple-result]');
      if (resultNode) {
        resultNode.innerHTML = result
          ? `<small>LATEST RESULT</small><strong>${esc(resultLabel(result))}</strong><p>${esc(result.title || 'Official game result')}</p>`
          : '<small>LATEST RESULT</small><strong>NO RESULT YET.</strong><p>Finalized Real Play games will appear here.</p>';
      }
    } catch (_error) {
      const nextNode = root.querySelector('[data-rp-simple-next]');
      if (nextNode) nextNode.innerHTML = '<small>NEXT REAL PLAY</small><h2>HOME IS READY.</h2><p>Open the official feed to check schedules and announcements.</p>';
    }
  }

  function syncLayerClose(event) {
    if (event.target.closest('[data-world-close], [data-rp-profile-close]')) {
      window.setTimeout(() => setActive('home'), 0);
      return;
    }
    if (event.target.closest('[data-updates-close]')) {
      window.setTimeout(() => setActive('home'), 0);
    }
  }

  function install() {
    if (installed) return true;
    if (!document.querySelector('[data-rp-app]') || !menu()) return false;
    ensurePublicEntry();
    if (!installHome() || !installNav()) return false;
    installed = true;
    document.body.classList.add('rp-simple-navigation-active');
    setActive('home');
    refreshHome();
    homeRefreshTimer = window.setInterval(() => {
      if (!document.hidden && active === 'home') refreshHome();
    }, 60_000);

    const profileObserver = new MutationObserver(() => {
      ensureProfileSettingsButton();
      if (active === 'me') syncMeHeader();
    });
    profileObserver.observe(document.body, { childList: true, subtree: true });
    ensureProfileSettingsButton();

    document.addEventListener('click', syncLayerClose, true);
    window.addEventListener('focus', () => {
      ensurePublicEntry();
      if (active === 'home') refreshHome();
      if (active === 'me') syncMeHeader();
      ensureProfileSettingsButton();
    });
    window.addEventListener('storage', () => {
      ensurePublicEntry();
      refreshHome();
    });
    window.addEventListener('realplay:visitorchange', refreshHome);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && active === 'home') refreshHome();
    });
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    if (homeRefreshTimer) window.clearInterval(homeRefreshTimer);
  });

  window.RealPlaySimpleNavigation = {
    home: openHome,
    world: () => openWorldTab('world'),
    stats: openStats,
    players: () => openWorldTab('players'),
    chats: () => openWorldTab('chats'),
    me: openMe,
    refreshHome,
  };

  // Shared route-shell authority for future dedicated pages. A feature can
  // opt into the same transition language without inventing another loader.
  window.RealPlayRouteShell = {
    show: showRouteShell,
    hide: hideRouteShell,
    error: showRouteError,
  };
})();