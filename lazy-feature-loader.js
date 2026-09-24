(() => {
  if (window.__realPlayLazyFeatureLoaderInstalled) return;
  window.__realPlayLazyFeatureLoaderInstalled = true;

  const VERSION = '20260924-lazy-features-v1';
  const featurePromises = new Map();
  const loadedScripts = new Map();
  const loadedStyles = new Map();

  function absolute(src) {
    return new URL(src, document.baseURI).href;
  }

  function sameAsset(urlA, urlB) {
    try {
      const a = new URL(urlA, document.baseURI);
      const b = new URL(urlB, document.baseURI);
      return a.origin === b.origin && a.pathname === b.pathname;
    } catch (_error) {
      return false;
    }
  }

  function loadScript(src, timeoutMs = 12000) {
    const key = absolute(src).split('?')[0];
    if (loadedScripts.has(key)) return loadedScripts.get(key);

    const existing = Array.from(document.scripts).find((script) => sameAsset(script.src, src));
    if (existing) {
      const ready = Promise.resolve(true);
      loadedScripts.set(key, ready);
      return ready;
    }

    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) loadedScripts.delete(key);
        resolve(Boolean(ok));
      };
      script.src = `${src}${src.includes('?') ? '&' : '?'}v=${VERSION}`;
      script.async = false;
      script.addEventListener('load', () => finish(true), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      document.head.appendChild(script);
    });

    loadedScripts.set(key, promise);
    return promise;
  }

  function loadStyle(href, timeoutMs = 12000) {
    const key = absolute(href).split('?')[0];
    if (loadedStyles.has(key)) return loadedStyles.get(key);

    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => sameAsset(link.href, href));
    if (existing) {
      const ready = Promise.resolve(true);
      loadedStyles.set(key, ready);
      return ready;
    }

    const promise = new Promise((resolve) => {
      const link = document.createElement('link');
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) loadedStyles.delete(key);
        resolve(Boolean(ok));
      };
      link.rel = 'stylesheet';
      link.href = `${href}${href.includes('?') ? '&' : '?'}v=${VERSION}`;
      link.addEventListener('load', () => finish(true), { once: true });
      link.addEventListener('error', () => finish(false), { once: true });
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      document.head.appendChild(link);
    });

    loadedStyles.set(key, promise);
    return promise;
  }

  const FEATURES = {
    updates: {
      styles: [
        'real-play-updates.css',
        'real-play-updates-cleanup.css',
        'real-play-updates-game-detail.css',
      ],
      scripts: [
        'real-play-updates.js',
        'real-play-updates-info-toggle.js',
        'updates-session-title-admin.js',
        'real-play-updates-game-detail.js',
      ],
    },
    world: {
      styles: [
        'real-play-world.css',
        'real-play-world-chat-cleanup.css',
        'real-play-world-chat-moderation.css',
        'world-results.css',
      ],
      scripts: [
        'real-play-world.js',
        'real-play-world-chat-cleanup.js',
        'world-results.js',
        'real-play-world-score-order-fix.js',
        'real-play-world-chat-moderation.js',
      ],
    },
    players: {
      dependsOn: ['world'],
      scripts: [
        'real-play-world-players.js',
        'visitor-world-players.js',
        'real-play-world-player-filters.js',
        'real-play-captain-eligibility.js',
        'real-play-world-player-bar-vector.js',
        'real-play-world-player-admin.js',
        'real-play-player-claim.js',
        'player-number-recovery.js',
        'player-identity-manager.js',
        'player-id-badge.js',
      ],
    },
    profile: {
      styles: [
        'real-play-profile.css',
        'profile-identity-cleanup.css',
        'real-play-profile-intro.css',
        'real-play-profile-metrics.css',
        'profile-metrics-stability.css',
        'membership.css',
        'settings-panel.css',
      ],
      scripts: [
        'profile-load-guard.js',
        'real-play-profile.js',
        'profile-art-owner-access.js',
        'real-play-profile-intro.js',
        'profile-metrics-stability.js',
        'real-play-profile-metrics.js',
        'public-profile-history.js',
        'profile-game-replay-link.js',
        'membership-bootstrap.js',
        'ranking-reservation-snapshot-standby-fit.js',
        'settings-panel.js',
      ],
    },
    ranking: {
      styles: [
        'ranking-games.css',
        'ranking-games-cleanup.css',
        'ranking-session-teams.css',
        'ranking-team-support-center-force.css',
      ],
      scripts: [
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
        'ranking-reservation-snapshot-standby-fit.js',
      ],
    },
    replay: {
      styles: [
        'career-game-replay.css',
        'career-game-replay-stats.css',
        'career-game-replay-winner.css',
      ],
      scripts: [
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
      ],
    },
  };

  async function ensure(name) {
    if (featurePromises.has(name)) return featurePromises.get(name);
    const feature = FEATURES[name];
    if (!feature) return false;

    const promise = (async () => {
      for (const dependency of feature.dependsOn || []) {
        if (!await ensure(dependency)) return false;
      }

      const styleResults = await Promise.all((feature.styles || []).map((href) => loadStyle(href)));
      if (styleResults.some((ok) => !ok)) {
        console.warn(`[Real Play] Some ${name} styles did not load.`);
      }

      for (const src of feature.scripts || []) {
        const loaded = await loadScript(src);
        if (!loaded) {
          console.warn(`[Real Play] ${name} feature failed to load: ${src}`);
          return false;
        }
      }
      return true;
    })().catch((error) => {
      console.error(`[Real Play] Could not load ${name}.`, error);
      return false;
    });

    featurePromises.set(name, promise);
    const ok = await promise;
    if (!ok) featurePromises.delete(name);
    return ok;
  }

  function featureApi(name) {
    if (name === 'world') return window.RealPlayWorld;
    if (name === 'profile') return window.RealPlayProfile;
    if (name === 'ranking') return window.RealPlayRankingGames;
    return window.RealPlayUpdates;
  }

  function makeStub(name, methods) {
    const stub = {};
    methods.forEach((method) => {
      stub[method] = async (...args) => {
        // Closing an unopened feature must be a true no-op. Navigation calls
        // close() defensively and should never download a feature just to hide it.
        if (method === 'close' && !featurePromises.has(name)) return false;
        const ok = method === 'close' ? true : await ensure(name);
        if (!ok) return false;
        const current = featureApi(name);
        if (!current || current === stub || typeof current[method] !== 'function') return false;
        return current[method](...args);
      };
    });
    return stub;
  }

  const worldStub = makeStub('world', ['open', 'openTab', 'close']);
  const profileStub = makeStub('profile', ['open', 'close']);
  const rankingStub = makeStub('ranking', ['open', 'close']);
  const updatesStub = makeStub('updates', ['open', 'close']);

  if (!window.RealPlayWorld) window.RealPlayWorld = worldStub;
  if (!window.RealPlayProfile) window.RealPlayProfile = profileStub;
  if (!window.RealPlayRankingGames) window.RealPlayRankingGames = rankingStub;
  if (!window.RealPlayUpdates) window.RealPlayUpdates = updatesStub;

  // Players share the World shell but need additional player-specific modules.
  worldStub.openTab = async (tab) => {
    const normalized = tab === 'players' ? 'players' : tab === 'chats' ? 'chats' : 'world';
    const ok = await ensure(normalized === 'players' ? 'players' : 'world');
    if (!ok) return false;
    const current = window.RealPlayWorld;
    if (!current || current === worldStub) return false;
    if (typeof current.openTab === 'function') return current.openTab(normalized);
    current.open?.();
    return true;
  };

  // Replay is loaded only when a replay entry is actually clicked.
  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-rp-career-replay-session]');
    if (!button || window.__realPlayCareerReplayInstalled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const ok = await ensure('replay');
    if (!ok) return;
    button.click();
  }, true);

  window.RealPlayFeatureLoader = {
    ensure,
    loadScript,
    loadStyle,
    loaded: (name) => featurePromises.has(name),
  };
})();
