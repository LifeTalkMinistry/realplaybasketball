(() => {
  // The old self-service profile-intro experiment used this already-loaded
  // script slot. It is now the authority for MANUAL premium profile artwork.
  // There is intentionally no player-facing upload/crop/editor flow here.
  if (window.__realPlayPremiumProfileArtInstalled) return;
  window.__realPlayPremiumProfileArtInstalled = true;
  window.__realPlayProfileIntroInstalled = true;

  const REGISTRY_URL = 'assets/profile-art/registry.json';
  const DEFAULTS = Object.freeze({
    positionX: '72%',
    positionY: '44%',
    scale: 1,
    opacity: 1,
  });

  let registry = [];
  let registryPromise = null;
  let scheduled = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  function firstPositiveInteger(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function firstJerseyNumber(...values) {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      const match = String(value).match(/-?\d+/);
      if (!match) continue;
      const parsed = Number(match[0]);
      if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 99) return parsed;
    }
    return null;
  }

  async function loadRegistry(force = false) {
    if (registryPromise) return registryPromise;
    if (!force && registry.length) return registry;

    registryPromise = (async () => {
      try {
        const response = await fetch(`${REGISTRY_URL}?v=20260918-premium-profile-art-v1`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Profile art registry returned ${response.status}.`);
        const data = await response.json();
        registry = Array.isArray(data?.players)
          ? data.players.filter((entry) => entry && typeof entry === 'object' && String(entry.src || '').trim())
          : [];
      } catch (error) {
        registry = [];
        console.warn('[Real Play] Premium profile art registry could not be loaded.', error);
      } finally {
        registryPromise = null;
      }

      scheduleRender();
      return registry;
    })();

    return registryPromise;
  }

  function panelSource(panel) {
    if (!panel) return null;
    return panel.classList.contains('rp-public-player-profile')
      ? panel.__realPlayPublicPlayer
      : panel.__realPlayProfileState;
  }

  function panelIdentity(panel) {
    const source = panelSource(panel) || {};
    const profile = source?.profile || source?.player || source || {};
    const playerId = firstPositiveInteger(
      panel?.dataset?.rpPublicPlayerId,
      panel?.dataset?.rpProfilePlayerId,
      source?.playerId,
      source?.userId,
      source?.id,
      source?.player?.playerId,
      source?.player?.userId,
      source?.player?.id,
      source?.profile?.playerId,
      source?.profile?.player_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      source?.profile?.id,
      profile?.playerId,
      profile?.player_id,
      profile?.userId,
      profile?.user_id,
      profile?.id
    );

    const visibleName = panel?.querySelector('.rp-profile-name h1')?.textContent;
    const playerName = normalizeName(
      source?.playerName ||
      source?.player_name ||
      profile?.playerName ||
      profile?.player_name ||
      profile?.name ||
      visibleName
    );

    const visibleNumber = panel?.querySelector('.rp-profile-number strong')?.textContent;
    const jerseyNumber = firstJerseyNumber(
      source?.playerNumber,
      source?.player_number,
      source?.currentNumber?.number,
      source?.current_number?.number,
      profile?.playerNumber,
      profile?.player_number,
      visibleNumber
    );

    return { playerId, playerName, jerseyNumber };
  }

  function entryMatches(entry, identity) {
    const configuredId = firstPositiveInteger(entry?.playerId, entry?.player_id, entry?.userId, entry?.user_id);
    if (configuredId !== null) return identity.playerId !== null && configuredId === identity.playerId;

    const configuredName = normalizeName(entry?.playerName || entry?.player_name || entry?.name);
    if (!configuredName || !identity.playerName || configuredName !== identity.playerName) return false;

    const configuredJersey = firstJerseyNumber(entry?.jerseyNumber, entry?.jersey_number, entry?.playerNumber, entry?.player_number);
    return configuredJersey === null || configuredJersey === identity.jerseyNumber;
  }

  function artForPanel(panel) {
    const identity = panelIdentity(panel);
    return registry.find((entry) => entryMatches(entry, identity)) || null;
  }

  function removeArt(panel) {
    panel?.querySelector('[data-rp-premium-profile-art]')?.remove();
    panel?.classList.remove('has-rp-premium-profile-art');
  }

  function applyArt(panel) {
    if (!(panel instanceof HTMLElement) || !panel.classList.contains('open')) return;
    const hero = panel.querySelector('.rp-profile-hero');
    if (!hero) return;

    const entry = artForPanel(panel);
    if (!entry) {
      removeArt(panel);
      return;
    }

    const src = String(entry.src || '').trim();
    if (!src) {
      removeArt(panel);
      return;
    }

    const positionX = String(entry.positionX || entry.position_x || DEFAULTS.positionX);
    const positionY = String(entry.positionY || entry.position_y || DEFAULTS.positionY);
    const rawScale = Number(entry.scale ?? DEFAULTS.scale);
    const rawOpacity = Number(entry.opacity ?? DEFAULTS.opacity);
    const scale = Number.isFinite(rawScale) ? clamp(rawScale, 0.72, 1.7) : DEFAULTS.scale;
    const opacity = Number.isFinite(rawOpacity) ? clamp(rawOpacity, 0, 1) : DEFAULTS.opacity;
    const signature = [src, positionX, positionY, scale, opacity].join('|');

    let layer = hero.querySelector('[data-rp-premium-profile-art]');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rp-premium-profile-art';
      layer.dataset.rpPremiumProfileArt = 'true';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<img alt="" draggable="false" /><span class="rp-premium-profile-art-shade"></span>';
      hero.insertBefore(layer, hero.querySelector('.rp-profile-identity-line')?.nextSibling || hero.firstChild);
    }

    layer.style.setProperty('--rp-premium-art-x', positionX);
    layer.style.setProperty('--rp-premium-art-y', positionY);
    layer.style.setProperty('--rp-premium-art-scale', String(scale));
    layer.style.setProperty('--rp-premium-art-opacity', String(opacity));

    if (layer.dataset.signature !== signature) {
      layer.dataset.signature = signature;
      layer.classList.remove('is-ready');
      const image = layer.querySelector('img');
      if (image) {
        image.onload = () => {
          if (layer.dataset.signature !== signature) return;
          layer.classList.add('is-ready');
          panel.classList.add('has-rp-premium-profile-art');
        };
        image.onerror = () => {
          if (layer.dataset.signature !== signature) return;
          console.warn(`[Real Play] Premium profile artwork could not be loaded: ${src}`);
          removeArt(panel);
        };
        image.src = src;
        if (image.complete && image.naturalWidth > 0) image.onload();
      }
    } else if (layer.classList.contains('is-ready')) {
      panel.classList.add('has-rp-premium-profile-art');
    }
  }

  function renderAll() {
    scheduled = false;
    document.querySelectorAll('.rp-profile.open').forEach(applyArt);
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderAll);
  }

  function handleProfileLoaded() {
    loadRegistry().finally(scheduleRender);
  }

  window.addEventListener('realplay:profile-loaded', handleProfileLoaded);
  window.addEventListener('realplay:public-profile-loaded', handleProfileLoaded);
  window.addEventListener('realplay:app-ready', handleProfileLoaded);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') {
        return mutation.target instanceof HTMLElement && mutation.target.classList.contains('rp-profile');
      }
      return [...mutation.addedNodes].some((node) => (
        node instanceof HTMLElement &&
        (node.matches?.('.rp-profile, .rp-profile-hero') || node.querySelector?.('.rp-profile, .rp-profile-hero'))
      ));
    });
    if (relevant) scheduleRender();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.RealPlayPremiumProfileArt = {
    refresh: scheduleRender,
    reloadRegistry: async () => {
      registry = [];
      await loadRegistry(true);
      scheduleRender();
    },
    configuredPlayerCount: () => registry.length,
  };

  loadRegistry();
})();
