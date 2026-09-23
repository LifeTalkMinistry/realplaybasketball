(() => {
  // Stable profile badge authority bridge.
  // The Players directory is the visible/current source of truth. This layer
  // deliberately does NOT toggle the legacy has-rp-profile-badges class, because
  // the older recognition renderer also owns that class and the two renderers
  // can otherwise fight each other and make the hero jump vertically.
  if (window.__realPlayProfileRecognitionAuthorityInstalled) return;
  window.__realPlayProfileRecognitionAuthorityInstalled = true;

  // Block the older mutation-heavy sync if a cached loader tries to execute it
  // after this file. The legacy file exits immediately when this flag is set.
  window.__realPlayRankRecognitionSyncInstalled = true;

  const AUTHORITY_TTL_MS = 60_000;
  const CAPTAIN_RANK_LIMIT = 4;
  const KNOWN_TYPES = new Set([
    'most_overall_mvp',
    'most_team_mvp',
    'best_shooting',
    'best_rebounder',
    'captain_eligible',
  ]);

  let scheduled = false;
  let authorityPlayers = [];
  let authorityLoadedAt = 0;
  let authorityPromise = null;

  function normalizeType(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function profileName(profile) {
    return normalizeName(profile?.querySelector('.rp-profile-name h1')?.textContent);
  }

  function rowName(row) {
    return normalizeName(row?.querySelector('.rp-world-player-name strong')?.textContent);
  }

  function profileSource(profile) {
    return profile?.classList?.contains('rp-public-player-profile')
      ? profile.__realPlayPublicPlayer
      : profile.__realPlayProfileState;
  }

  function nestedSources(source) {
    if (!source || typeof source !== 'object') return [];
    return [source, source?.player, source?.profile, source?.career, source?.careerStats].filter(Boolean);
  }

  function recognitionTypesFromPlayer(player) {
    const allowed = new Set();
    nestedSources(player).forEach((candidate) => {
      ['badges', 'recognitions'].forEach((key) => {
        if (!Array.isArray(candidate?.[key])) return;
        candidate[key].forEach((badge) => {
          const type = normalizeType(badge?.type);
          if (KNOWN_TYPES.has(type)) allowed.add(type);
        });
      });
    });

    const rank = [
      player?.rank,
      player?.career?.rank,
      player?.careerStats?.rank,
      player?.ranking?.rank,
      player?.profile?.rank,
    ].map(Number).find((value) => Number.isSafeInteger(value) && value > 0) || null;

    if (rank && rank <= CAPTAIN_RANK_LIMIT) allowed.add('captain_eligible');
    else allowed.delete('captain_eligible');
    return allowed;
  }

  function matchingWorldRow(profile) {
    const wanted = profileName(profile);
    if (!wanted) return null;
    const matches = [...document.querySelectorAll('.rp-world-player-row')]
      .filter((row) => rowName(row) === wanted);
    return matches.length === 1 ? matches[0] : null;
  }

  function allowedTypesFromRow(row) {
    if (!(row instanceof HTMLElement)) return null;

    // The live recognition renderer writes this property on every Players row.
    // An empty array is meaningful and authoritative: zero current badges.
    if (Array.isArray(row.__realPlayBadges)) {
      return new Set(
        row.__realPlayBadges
          .map((badge) => normalizeType(badge?.type))
          .filter((type) => KNOWN_TYPES.has(type))
      );
    }

    const featured = normalizeType(row.dataset.recognitionType);
    if (featured && KNOWN_TYPES.has(featured)) return new Set([featured]);
    return null;
  }

  async function loadAuthority(force = false) {
    const now = Date.now();
    if (!force && authorityLoadedAt && now - authorityLoadedAt < AUTHORITY_TTL_MS) {
      return authorityPlayers;
    }
    if (authorityPromise) return authorityPromise;
    if (typeof window.RealPlayWorld?.community !== 'function') return authorityPlayers;

    authorityPromise = (async () => {
      try {
        const data = await window.RealPlayWorld.community('players');
        authorityPlayers = Array.isArray(data?.players) ? data.players : [];
        authorityLoadedAt = Date.now();
      } catch (_error) {
        // Keep the last successful snapshot. The mounted Players row remains the
        // preferred authority whenever it is available.
      } finally {
        authorityPromise = null;
        scheduleSync();
      }
      return authorityPlayers;
    })();

    return authorityPromise;
  }

  function allowedTypesFromApi(profile) {
    const wanted = profileName(profile);
    if (!wanted) return null;
    const matches = authorityPlayers.filter((player) => normalizeName(
      player?.playerName || player?.player_name || player?.name
    ) === wanted);
    return matches.length === 1 ? recognitionTypesFromPlayer(matches[0]) : null;
  }

  function trimSource(profile, allowedTypes) {
    const source = profileSource(profile);
    nestedSources(source).forEach((candidate) => {
      ['badges', 'recognitions'].forEach((key) => {
        if (!Array.isArray(candidate?.[key])) return;
        candidate[key] = candidate[key].filter((badge) => {
          const type = normalizeType(badge?.type);
          return !KNOWN_TYPES.has(type) || allowedTypes.has(type);
        });
      });
    });

    if (Array.isArray(profile.__realPlayBadges)) {
      profile.__realPlayBadges = profile.__realPlayBadges.filter((badge) => {
        const type = normalizeType(badge?.type);
        return !KNOWN_TYPES.has(type) || allowedTypes.has(type);
      });
    }
  }

  function applyButtons(profile, allowedTypes) {
    const strip = profile.querySelector('[data-rp-profile-badges]');
    const hasAny = allowedTypes.size > 0;

    profile.classList.toggle('rp-profile-recognition-none-authoritative', !hasAny);
    profile.dataset.rpRecognitionAuthority = 'players';

    if (!strip) return;

    strip.querySelectorAll('[data-rp-profile-recognition]').forEach((button) => {
      const type = normalizeType(button.dataset.rpProfileRecognition);
      const disallowed = KNOWN_TYPES.has(type) && !allowedTypes.has(type);
      if (disallowed) {
        button.setAttribute('aria-hidden', 'true');
        button.style.setProperty('display', 'none', 'important');
      } else {
        button.removeAttribute('aria-hidden');
        button.style.removeProperty('display');
      }
    });
  }

  function syncProfile(profile) {
    if (!(profile instanceof HTMLElement) || !profile.classList.contains('open')) return;

    const row = matchingWorldRow(profile);
    let allowedTypes = allowedTypesFromRow(row);
    if (!(allowedTypes instanceof Set)) allowedTypes = allowedTypesFromApi(profile);

    if (!(allowedTypes instanceof Set)) {
      // No trustworthy authority yet. Never carry a previous player's zero-badge
      // class into a different profile while data is still loading.
      profile.classList.remove('rp-profile-recognition-none-authoritative');
      return;
    }

    trimSource(profile, allowedTypes);
    applyButtons(profile, allowedTypes);
  }

  function installStyles() {
    if (document.querySelector('[data-rp-profile-recognition-authority-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpProfileRecognitionAuthorityStyles = '1';
    style.textContent = `
      /* Zero authoritative badges: keep the legacy strip out of layout even if
         its older renderer recreates the DOM. This prevents the 80-100px hero
         jump that occurred when two scripts alternated badge ownership. */
      .rp-profile.rp-profile-recognition-none-authoritative .rp-profile-hero .rp-profile-badges{
        display:none!important;
        min-height:0!important;
        height:0!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
      }
      .rp-profile.rp-profile-recognition-none-authoritative .rp-profile-hero .rp-profile-player,
      .rp-profile.rp-profile-recognition-none-authoritative.has-rp-profile-badges .rp-profile-hero .rp-profile-player{
        margin-top:24px!important;
        padding-top:0!important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncAll() {
    scheduled = false;
    document.querySelectorAll('.rp-profile.open').forEach(syncProfile);

    if (document.querySelector('.rp-profile.open')
      && (!authorityLoadedAt || Date.now() - authorityLoadedAt >= AUTHORITY_TTL_MS)) {
      loadAuthority();
    }
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncAll);
  }

  installStyles();

  // Watch only structural/profile-recognition changes. Do NOT watch class/style
  // changes; this layer intentionally avoids the render-feedback loop that made
  // the profile jump between two hero heights.
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => (
      mutation.type === 'childList'
      || mutation.attributeName === 'data-recognition-type'
      || mutation.attributeName === 'data-official-rank'
    ))) scheduleSync();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-recognition-type', 'data-official-rank'],
  });

  window.addEventListener('realplay:profile-loaded', () => {
    scheduleSync();
    loadAuthority();
  });
  window.addEventListener('realplay:public-profile-loaded', () => {
    scheduleSync();
    loadAuthority();
  });
  window.addEventListener('focus', scheduleSync);

  loadAuthority();
  scheduleSync();
})();
