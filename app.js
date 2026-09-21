(() => {
  const APP_VERSION = '20260921-ui-first-lazy-v113';
  const ROOT = document.documentElement;
  const TOKEN_KEY = 'real_play_access_token';
  const RESOURCE_TIMEOUT_MS = 15000;
  const READY_TIMEOUT_MS = 5000;

  if (window.__rpStaticBootFallback) {
    window.clearTimeout(window.__rpStaticBootFallback);
    window.__rpStaticBootFallback = 0;
  }

  ROOT.classList.add('rp-shell-booting');
  ROOT.classList.remove('rp-shell-failed');

  const bootStyle = document.createElement('style');
  bootStyle.id = 'rp-shell-boot-style';
  bootStyle.textContent = `
    html.rp-shell-booting body{margin:0!important;min-height:100dvh!important;overflow:hidden!important;background:#020306!important}
    html.rp-shell-booting body>*{visibility:hidden!important}
    html.rp-shell-booting body::before,html.rp-shell-booting body::after{position:fixed;left:50%;z-index:2147483647;visibility:visible!important;pointer-events:none;transform:translateX(-50%);text-align:center;white-space:nowrap}
    html.rp-shell-booting body::before{content:'REAL PLAY';top:45%;color:#f6f9ff;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(2rem,9vw,3.25rem);font-style:italic;font-weight:950;letter-spacing:.025em;text-shadow:0 0 30px rgba(77,215,255,.10)}
    html.rp-shell-booting body::after{content:'BASKETBALL  ·  LOADING';top:calc(45% + 58px);color:#42d8ff;font-family:Arial,sans-serif;font-size:.56rem;font-weight:900;letter-spacing:.22em;animation:rpBootPulse 1.1s ease-in-out infinite alternate}
    html.rp-shell-booting.rp-shell-failed body::after{content:'STARTUP FAILED  ·  REFRESH';color:#ff8f9d;animation:none}
    @keyframes rpBootPulse{from{opacity:.38}to{opacity:1}}
    @media(prefers-reduced-motion:reduce){html.rp-shell-booting body::after{animation:none;opacity:.78}}
    .rp-feature-load-notice{position:fixed;z-index:2147482600;left:50%;bottom:calc(var(--rp-simple-nav-height,74px) + env(safe-area-inset-bottom) + 12px);width:min(calc(100% - 24px),420px);transform:translateX(-50%);box-sizing:border-box;padding:11px 12px;border:1px solid rgba(84,219,255,.24);border-radius:13px;background:rgba(4,12,20,.96);box-shadow:0 14px 34px rgba(0,0,0,.46);color:#eaf8ff;font:900 .58rem/1.35 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;visibility:visible!important}
    .rp-feature-load-notice[hidden]{display:none!important}
    .rp-feature-load-notice.is-error{border-color:rgba(255,108,124,.30);color:#ffb1bb}
    .rp-feature-load-notice span{display:block;min-width:0;overflow-wrap:anywhere}
    .rp-feature-load-notice button{display:none;margin-top:9px;min-height:32px;padding:0 11px;border:1px solid rgba(84,219,255,.30);border-radius:9px;background:rgba(17,63,83,.62);color:#eafaff;font:900 .52rem/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
    .rp-feature-load-notice.is-error button{display:inline-flex;align-items:center;justify-content:center}
  `;
  document.head.appendChild(bootStyle);

  const scriptResources = new Map();
  const styleResources = new Map();
  const featureStates = new Map();
  const pendingActions = new Map();
  let featureNotice = null;
  let bootResourcesReady = false;
  let bootFailed = false;

  const resourceUrl = (href) => `${href}${href.includes('?') ? '&' : '?'}v=${encodeURIComponent(APP_VERSION)}`;
  const absolutePath = (href) => {
    try { return new URL(href, location.href).pathname; }
    catch (_error) { return href.split('?')[0]; }
  };

  function sameResource(url, href) {
    try { return new URL(url, location.href).pathname === absolutePath(href); }
    catch (_error) { return String(url || '').split('?')[0].endsWith(href.split('?')[0]); }
  }

  function findLoadedStylesheet(href) {
    return [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find((link) => sameResource(link.href, href));
  }

  function findLoadedScript(href) {
    return [...document.scripts].find((script) => sameResource(script.src, href));
  }

  function loadStylesheetOnce(href) {
    const key = absolutePath(href);
    const tracked = styleResources.get(key);
    if (tracked) return tracked.promise;

    const existing = findLoadedStylesheet(href);
    if (existing?.sheet) {
      const promise = Promise.resolve(true);
      styleResources.set(key, { state: 'READY', promise, element: existing });
      return promise;
    }

    const link = existing || document.createElement('link');
    if (!existing) {
      link.rel = 'stylesheet';
      link.href = resourceUrl(href);
      link.dataset.rpLazyResource = key;
    }

    const record = { state: 'LOADING', promise: null, element: link };
    record.promise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
        if (ok) {
          record.state = 'READY';
          resolve(true);
        } else {
          record.state = 'ERROR';
          if (link.dataset.rpLazyResource) link.remove();
          styleResources.delete(key);
          reject(error || new Error(`Unable to load stylesheet: ${href}`));
        }
      };
      const onLoad = () => finish(true);
      const onError = () => finish(false, new Error(`Unable to load stylesheet: ${href}`));
      const timer = window.setTimeout(() => finish(false, new Error(`Stylesheet timed out: ${href}`)), RESOURCE_TIMEOUT_MS);
      link.addEventListener('load', onLoad, { once: true });
      link.addEventListener('error', onError, { once: true });
      if (!existing) document.head.appendChild(link);
      if (link.sheet) finish(true);
    });
    styleResources.set(key, record);
    return record.promise;
  }

  function loadScriptOnce(src) {
    const key = absolutePath(src);
    const tracked = scriptResources.get(key);
    if (tracked) return tracked.promise;

    const existing = findLoadedScript(src);
    if (existing?.dataset?.rpResourceReady === 'true') {
      const promise = Promise.resolve(true);
      scriptResources.set(key, { state: 'READY', promise, element: existing });
      return promise;
    }

    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = resourceUrl(src);
      script.async = false;
      script.dataset.rpLazyResource = key;
    }

    const record = { state: 'LOADING', promise: null, element: script };
    record.promise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
        if (ok) {
          script.dataset.rpResourceReady = 'true';
          record.state = 'READY';
          resolve(true);
        } else {
          record.state = 'ERROR';
          if (script.dataset.rpLazyResource) script.remove();
          scriptResources.delete(key);
          reject(error || new Error(`Unable to load script: ${src}`));
        }
      };
      const onLoad = () => finish(true);
      const onError = () => finish(false, new Error(`Unable to load script: ${src}`));
      const timer = window.setTimeout(() => finish(false, new Error(`Script timed out: ${src}`)), RESOURCE_TIMEOUT_MS);
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (!existing) document.head.appendChild(script);

      // Scripts already present before this loader are treated as loaded. This
      // keeps legacy auth child-loaders compatible without injecting duplicates.
      if (existing) finish(true);
    });
    scriptResources.set(key, record);
    return record.promise;
  }

  function waitForCondition(check, label, timeout = READY_TIMEOUT_MS) {
    if (check()) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        window.clearTimeout(timer);
        window.removeEventListener('realplay:feature-ready', inspect);
        if (ok) resolve(true);
        else reject(new Error(`${label} did not become ready.`));
      };
      const inspect = () => {
        let ready = false;
        try { ready = Boolean(check()); } catch (_error) {}
        if (ready) finish(true);
      };
      const observer = new MutationObserver(inspect);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      window.addEventListener('realplay:feature-ready', inspect);
      const timer = window.setTimeout(() => finish(false), timeout);
      inspect();
    });
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  const featureDefinitions = {
    world: {
      label: 'WORLD',
      css: [
        'real-play-world.css',
        'real-play-world-chat-cleanup.css',
        'home-main-announcement-art.css',
        'world-results.css',
        'real-play-profile.css',
        'profile-identity-cleanup.css',
      ],
      scripts: [
        'real-play-world.js',
        'real-play-world-chat-cleanup.js',
        'real-play-world-players.js',
        'visitor-world-players.js',
        'public-profile-history.js',
        'real-play-rank-explainer.js',
        'world-results.js',
        'player-id-badge.js',
        'real-play-world-score-order-fix.js',
        'real-play-world-player-filters.js',
        'real-play-captain-eligility.js',
        'real-play-world-player-bar-vector.js',
        'real-play-player-claim.js',
        'visitor-player-claim.js',
        'overlay-focus-release.js',
      ],
      ready: () => Boolean(
        window.__realPlayWorldInstalled &&
        window.__realPlayWorldPlayersInstalled &&
        window.RealPlayWorld?.open &&
        document.querySelector('[data-rp-world]')
      ),
    },
    profile: {
      label: 'PROFILE',
      css: [
        'real-play-profile.css',
        'profile-identity-cleanup.css',
       'real-play-profile-intro.css',
        'real-play-profile-metrics.css',
        'profile-metrics-stability.css',
      ],
      scripts: [
        'profile-share-linked-card.js',
        'profile-load-guard.js',
        'real-play-profile.js',
        'profile-art-owner-access.js',
        'real-play-profile-intro.js',
        'profile-metrics-stability.js',
        'real-play-profile-metrics.js',
        'ranking-reservation-snapshot-standby-fit.js',
        'overlay-focus-release.js',
      ],
      ready: () => Boolean(
        window.__realPlayProfileInstalled &&
        window.RealPlayProfile?.open &&
        document.querySelector('[data-rp-profile]')
      ),
    },
    updates: {
      label: 'UPDATES',
      css: [
        'real-play-updates.css',
        'real-play-updates-cleanup.css',
        'real-play-updates-game-detail.css',
      ],
      scripts: [
        'real-play-updates.js',
        'real-play-updates-info-toggle.js',
        'real-play-updates-game-detail.js',
        'overlay-focus-release.js',
      ],
      ready: () => Boolean(window.__realPlayUpdatesInstalled && window.RealPlayUpdates?.open),
    },
    ranking: {
      label: 'OPEN RANKING',
      css: ['ranking-games.css', 'ranking-games-cleanup.css'],
      scripts: [
        'ranking-games.js',
        'ranking-games-secured-players.js',
        'ranking-games-standby-players.js',
        'ranking-games-info-toggle.js',
        'ranking-games-session-cleanup.js',
        'ranking-spot-priority.js',
        'ranking-reservation-snapshot.js',
        'ranking-reservation-snapshot-standby-fit.js',
        'overlay-focus-release.js',
      ],
      ready: () => Boolean(
        window.__realPlayRankingGamesInstalled &&
        window.RealPlayRankingGames?.open &&
        document.querySelector('[data-rp-ranking-games]')
      ),
    },
    teamFormation: {
      label: 'TEAM FORMATION',
      css: [
        'three-v-three-beta.css',
        'three-v-three-logo-scale.css',
        'three-v-three-club-themes.css',
      ],
      scripts: [],
      ready: () => true,
    },
    '3v3': {
      label: '3V3',
      css: [
        'three-v-three-beta.css',
        'three-v-three-secure-spot.css',
        'three-v-three-refinement.css',
        'three-v-three-participants.css',
        'three-v-three-premium.css',
        'three-v-three-logo-scale.css',
        'three-v-three-club-themes.css',
      ],
      scripts: [
        'three-v-three-beta.js',
        'three-v-three-layout-order.js',
        'three-v-three-refinement.js',
        'three-v-three-participants.js',
        'three-v-three-club-art.js',
      ],
      ready: () => Boolean(document.querySelector('[data-rp-enter-3v3]') && document.querySelector('.rp-3v3-view')),
    },
    replay: {
      label: 'REPLAY',
      css: [
        'career-beta.css',
        'career-beta-play.css',
        'career-game-replay.css',
        'career-game-replay-stats.css',
        'career-game-replay-winner.css',
      ],
      scripts: [
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
        'career-beta-leaderboard.js',
        'profile-game-replay-link.js',
        'overlay-focus-release.js',
      ],
      ready: () => Boolean(window.__realPlayCareerReplayInstalled),
    },
    settings: {
      label: 'SETTINGS',
      css: ['membership.css', 'settings-panel.css', 'auth-welcome-cleanup.css'],
      scripts: [
        'membership-bootstrap.js',
        'settings-panel.js',
        'player-number-recovery.js',
        'admin-access-bootstrap.js',
      ],
      ready: () => Boolean(
        window.__realPlaySettingsPanelInstalled &&
        window.__realPlayAdminAccessBootstrapInstalled &&
        document.querySelector('[data-rp-settings-overlay]')
      ),
    },
    admin: {
      label: 'ADMIN',
      requires: ['settings', 'ranking', 'replay', 'world', 'updates', 'profile'],
      css: [
        'admin-courtside-live.css',
        'admin-shot-breakdown.css',
        'admin-recorded-scoring-winner.css',
        'real-play-world-chat-moderation.css',
        'admin-game-control.css',
        'admin-launcher-mobile-fix.css',
        'admin-game-control-simplify.css',
        'admin-game-rules.css',
        'admin-player-ownership.css',
        'admin-membership-review.css',
        'admin-recorded-scoring.css',
        'admin-recorded-scoring-draft.css',
        'admin-recorded-scoring-score-confirmation.css',
        'admin-recorded-scoring-youtube.css',
        'admin-recorded-scoring-desktop.css',
        'real-play-admin-brand-overrides.css',
      ],
      scripts: [
        'support-admin.js',
        'real-play-world-player-admin.js',
        'player-admin-probe-guard.js',
        'admin-live-stat-stability.js',
        'admin-courtside-live.js',
        'admin-recorded-stat-controls-fix.js',
        'admin-recorded-scoring-winner.js',
        'real-play-world-chat-moderation.js',
        'admin-live-session-expiry.js',
        'admin-game-type-switch.js',
        'admin-session-picker-v5-loader.js',
        'open-rank-auto-id.js',
        'career-game-replay-admin-edit.js',
        'career-game-replay-admin-root.js',
        'admin-game-rotation.js',
        'admin-live-refresh-fix.js',
        'admin-setup-operational-session-hide.js',
        'home-open-rank-admin-edit.js',
        'home-payment-admin.js',
        'updates-session-title-admin.js',
        'admin-recorded-input-stability.js',
        'admin-score-sync.js',
        'admin-game-control.js',
        'admin-session-start.js',
        'admin-game-control-simplify.js',
        'admin-player-search.js',
        'admin-player-ownership.js',
        'admin-membership-review.js',
        'admin-game-rules.js',
        'admin-recorded-start-submit-fix.js',
        'admin-recorded-scoring-draft-guard.js',
        'admin-recorded-scoring-assist-link.js',
        'admin-recorded-scoring-score-confirmation.js',
        'admin-recorded-scoring-draft.js',
        'admin-recorded-scoring-mobile-workspace.js',
        'admin-recorded-scoring-cancel.js',
        'admin-recorded-scoring.js',
        'admin-recorded-scoring-youtube.js',
        'admin-recorded-scoring-stamp-filter.js',
        'admin-recorded-scoring-youtube-keyboard.js',
        'admin-recorded-scoring-desktop.js',
        'admin-recorded-scoring-lock.js',
        'admin-game-entry-mode.js',
        'admin-session-picker.js',
        'admin-score-dom-sync.js',
        'admin-season-control.js',
        'admin-season-players.js',
        'admin-membership-token-control.js',
        'admin-player-temp-password.js',
      ],
      ready: () => Boolean(window.__realPlayAdminGameControlInstalled || window.__realPlayOpenAdminGameControl),
    },
  };

  function stateRecord(name) {
    if (!featureStates.has(name)) featureStates.set(name, { state: 'IDLE', promise: null, error: null });
    return featureStates.get(name);
  }

  function featureState(name) {
    return stateRecord(name).state;
  }

  function emitFeatureState(name, state, error = null) {
    window.dispatchEvent(new CustomEvent('realplay:feature-state', { detail: { feature: name, state, error } }));
  }

  async function ensureFeature(name) {
    const definition = featureDefinitions[name];
    if (!definition) throw new Error(`Unknown Real Play feature: ${name}`);
    const record = stateRecord(name);

    if (record.state === 'READY' && (!definition.ready || definition.ready())) return true;
    if (record.state === 'LOADING' && record.promise) return record.promise;

    record.state = 'LOADING';
    record.error = null;
    emitFeatureState(name, 'LOADING');

    record.promise = (async () => {
      try {
        for (const dependency of definition.requires || []) await ensureFeature(dependency);
        const cssPromise = Promise.all((definition.css || []).map(loadStylesheetOnce));
        for (const src of definition.scripts || []) await loadScriptOnce(src);
        await cssPromise;
        if (definition.ready) await waitForCondition(definition.ready, `${definition.label || name} contract`);
        record.state = 'READY';
        record.error = null;
        emitFeatureState(name, 'READY');
        window.dispatchEvent(new CustomEvent('realplay:feature-ready', { detail: { feature: name } }));
        return true;
      } catch (error) {
        record.state = 'ERROR';
        record.error = error;
        emitFeatureState(name, 'ERROR', error);
        throw error;
      } finally {
        record.promise = null;
      }
    })();

    return record.promise;
  }

  function ensureFeatureNotice() {
    if (featureNotice?.isConnected) return featureNotice;
    featureNotice = document.createElement('div');
    featureNotice.className = 'rp-feature-load-notice';
    featureNotice.hidden = true;
    featureNotice.setAttribute('role', 'status');
    featureNotice.setAttribute('aria-live', 'polite');
    featureNotice.innerHTML = '<span data-rp-feature-notice-text></span><button type="button" data-rp-feature-retry>RETRY</button>';
    document.body.appendChild(featureNotice);
    return featureNotice;
  }

  function hideFeatureNotice(channel = '') {
    const notice = featureNotice;
    if (!notice) return;
    if (channel && notice.dataset.rpFeatureChannel !== channel) return;
    notice.hidden = true;
    notice.classList.remove('is-error');
    delete notice.dataset.rpFeatureChannel;
    const retry = notice.querySelector('[data-rp-feature-retry]');
    if (retry) retry.onclick = null;
  }

  function showFeatureNotice(channel, label, state, retryAction) {
    const notice = ensureFeatureNotice();
    notice.dataset.rpFeatureChannel = channel;
    notice.hidden = false;
    notice.classList.toggle('is-error', state === 'ERROR');
    const text = notice.querySelector('[data-rp-feature-notice-text]');
    const retry = notice.querySelector('[data-rp-feature-retry]');
    if (text) text.textContent = state === 'ERROR'
      ? `${label} COULD NOT LOAD · RETRY`
      : `${label} IS LOADING…`;
    if (retry) retry.onclick = state === 'ERROR' ? retryAction : null;
  }

  function cancelPending(channel) {
    const pending = pendingActions.get(channel);
    if (!pending) return;
    pending.cancelled = true;
    pendingActions.delete(channel);
    hideFeatureNotice(channel);
  }

  function requestFeature(name, onReady, options = {}) {
    const definition = featureDefinitions[name];
    const label = String(options.label || definition?.label || name).toUpperCase();
    const channel = String(options.channel || name);
    const existing = pendingActions.get(channel);

    if (existing && existing.feature === name && existing.promise) {
      existing.onReady = onReady;
      return existing.promise;
    }
    if (existing) cancelPending(channel);

    if (featureState(name) === 'READY' && (!definition?.ready || definition.ready())) {
      hideFeatureNotice(channel);
      try { onReady?.(); } catch (error) { console.error(`[Real Play] ${label} open action failed.`, error); }
      return Promise.resolve(true);
    }

    const pending = { feature: name, onReady, cancelled: false, promise: null };
    pendingActions.set(channel, pending);
    showFeatureNotice(channel, label, 'LOADING');

    pending.promise = ensureFeature(name)
      .then(() => {
        if (pending.cancelled || pendingActions.get(channel) !== pending) return false;
        pendingActions.delete(channel);
        hideFeatureNotice(channel);
        pending.onReady?.();
        return true;
      })
      .catch((error) => {
        if (pending.cancelled || pendingActions.get(channel) !== pending) return false;
        console.warn(`[Real Play] ${label} failed to load.`, error);
        showFeatureNotice(channel, label, 'ERROR', () => {
          if (pendingActions.get(channel) === pending) pendingActions.delete(channel);
          requestFeature(name, pending.onReady, options);
        });
        return false;
      });

    return pending.promise;
  }

  window.RealPlayFeatures = {
    ensure: ensureFeature,
    request: requestFeature,
    cancel: cancelPending,
    cancelAll: () => [...pendingActions.keys()].forEach(cancelPending),
    state: featureState,
    definitions: Object.fromEntries(Object.entries(featureDefinitions).map(([name, definition]) => [name, {
      label: definition.label,
      css: [...(definition.css || [])],
      scripts: [...(definition.scripts || [])],
      requires: [...(definition.requires || [])],
    }])),
  };

  // The current Home 4V4 preview reuses the 3V3 club-card presentation. Its
  // shared visual CSS is loaded only if the player opens Team Formation.
  document.addEventListener('click', (event) => {
    const action = event.target.closest?.('.rp-home-4v4-explore');
    if (!action || featureState('teamFormation') === 'READY') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    requestFeature('teamFormation', () => {
      if (action.isConnected) action.click();
    }, { label: 'TEAM FORMATION', channel: 'team-formation' });
  }, true);

  // Replay is a child action of a player-history card. Keep the profile itself
  // independent from replay resources; the first game-card activation requests
  // Replay, then replays the exact click after the authoritative linker exists.
  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('.rp-profile-history .rp-profile-game');
    if (!card || window.__realPlayProfileGameReplayLinkInstalled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    requestFeature('replay', () => {
      if (!card.isConnected) return;
      card.click();
    }, { label: 'REPLAY', channel: 'profile-replay' });
  }, true);

  const criticalStyles = [
    'mobile-lobby.css',
    'lobby-topbar-cleanup.css',
    'mobile-shell-fix.css',
    'mobile-lobby-cleanup.css',
    'main-menu.css',
    'real-play-brand-system.css',
    'main-menu-brand-overrides.css',
    'main-menu-cinematic.css',
    'main-menu-ball-background.css',
    'main-menu-card-premium.css',
    'main-menu-physics.css',
    'main-menu-fast-snap.css',
    'visitor-mode.css',
    'simple-navigation.css',
    'simple-navigation-arena.css',
    'home-open-rank-art.css',
    'home-main-announcement-art.css',
    'home-why-real-play.css',
  ];

  const criticalScripts = [
    'auth-session-guard.js',
    'auth.js',
    'public-first-entry.js',
    'mobile-lobby.js',
    'legacy-bottom-nav-removal.js',
    'main-menu-fast-snap-bootstrap.js',
    'main-menu.js',
    'main-menu-fast-snap-restore.js',
    'main-menu-touch-lite.js',
    'main-menu-desktop-input-fix.js',
    'visitor-mode.js',
    'login-landing-fix.js',
    'persistent-session-fix.js',
    'simple-navigation.js',
    'simple-navigation-state-authority.js',
    'home-why-real-play.js',
    'home-future-4v4-preview.js',
    'home-future-4v4-card-cleanup.js',
  ];

  function authShellReady() {
    return Boolean(
      document.querySelector('[data-auth-login-form]') &&
      document.querySelector('[data-profile-choice]') &&
      document.querySelector('[data-profile-create-flow]')
    );
  }

  function finalHomeReady() {
    const home = document.querySelector('[data-rp-simple-home]');
    const nav = document.querySelector('[data-rp-simple-nav]');
    const future = home?.querySelector('[data-rp-home-future-4v4="true"]');
    const join = future?.querySelector('.rp-home-4v4-explore');
    return Boolean(
      document.querySelector('[data-rp-app]') &&
      document.querySelector('[data-rp-main-menu]') &&
      home &&
      nav &&
      window.__realPlaySimpleNavigationStateAuthorityInstalled === true &&
      home.dataset.rpHomeCommandCenter === 'true' &&
      home.querySelector('[data-rp-home-open-rank]') &&
      home.querySelector('[data-rp-home-why-real-play]') &&
      future &&
      join &&
      join.textContent.trim() === 'JOIN A TEAM NOW'
    );
  }

  function revealShell() {
    if (bootFailed || !bootResourcesReady || !finalHomeReady()) return false;
    ROOT.classList.remove('rp-shell-booting', 'rp-shell-failed');
    ROOT.classList.add('rp-shell-ready');
    document.getElementById('rp-shell-static-boot-gate')?.remove();
    document.getElementById('rp-shell-boot-style')?.remove();
    return true;
  }

  function showBootFailure(error) {
    bootFailed = true;
    console.error('[Real Play] Critical Home shell failed to load.', error);
    ROOT.classList.add('rp-shell-booting', 'rp-shell-failed');
  }

  (async () => {
    try {
      // Start critical CSS downloads immediately, while shell JS installs in a
      // deterministic order. Optional feature resources are not part of boot.
      const criticalCssPromise = Promise.all(criticalStyles.map(loadStylesheetOnce));
      for (const src of criticalScripts) await loadScriptOnce(src);

      await Promise.all([
        criticalCssPromise,
        waitForCondition(authShellReady, 'Real Play account entry'),
        waitForCondition(finalHomeReady, 'Final Real Play Home shell'),
      ]);

      // One paint is enough to commit the final shell geometry. Fonts, images,
      // World, Profile, Ranking, Replay, Admin and other feature resources are
      // intentionally not global boot requirements.
      await nextPaint();
      bootResourcesReady = true;
      if (revealShell()) {
        window.dispatchEvent(new CustomEvent('realplay:app-ready'));
      }
    } catch (error) {
      showBootFailure(error);
    }
  })();
})();
