(() => {
  if (window.__realPlayRankRecognitionSyncInstalled) return;
  window.__realPlayRankRecognitionSyncInstalled = true;

  const AUTHORITY_TTL_MS = 60_000;
  const CAPTAIN_TYPE = 'captain_eligible';
  const CAPTAIN_RANK_LIMIT = 4;
  const KNOWN_RECOGNITION_TYPES = new Set([
    'most_overall_mvp',
    'most_team_mvp',
    'best_shooting',
    'best_rebounder',
    CAPTAIN_TYPE,
  ]);

  let scheduled = false;
  let authorityLoadedAt = 0;
  let authorityPromise = null;
  let authorityById = new Map();

  function normalizeType(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isPositiveRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0;
  }

  function positiveIdString(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? String(id) : '';
  }

  function playerId(player) {
    return positiveIdString(player?.playerId ?? player?.userId ?? player?.id);
  }

  function accountPlayerId(player) {
    return positiveIdString(
      player?.accountUserId
      ?? player?.account_user_id
      ?? player?.userAccountId
      ?? player?.user_account_id
    );
  }

  function sourcePlayerIds(source) {
    const candidates = [
      source?.playerId,
      source?.userId,
      source?.id,
      source?.accountUserId,
      source?.account_user_id,
      source?.player?.playerId,
      source?.player?.userId,
      source?.player?.id,
      source?.player?.accountUserId,
      source?.player?.account_user_id,
      source?.profile?.playerId,
      source?.profile?.player_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      source?.profile?.id,
      source?.profile?.accountUserId,
      source?.profile?.account_user_id,
    ];
    return [...new Set(candidates.map(positiveIdString).filter(Boolean))];
  }

  function sourcePlayerId(source) {
    return sourcePlayerIds(source)[0] || '';
  }

  function profileSource(profile) {
    return profile?.classList?.contains('rp-public-player-profile')
      ? profile.__realPlayPublicPlayer
      : profile.__realPlayProfileState;
  }

  function nestedRecognitionSources(source) {
    if (!source || typeof source !== 'object') return [];
    return [source, source?.player, source?.profile, source?.career, source?.careerStats].filter(Boolean);
  }

  function authorityRecognitionTypes(player) {
    const allowed = new Set();
    nestedRecognitionSources(player).forEach((candidate) => {
      ['badges', 'recognitions'].forEach((key) => {
        if (!Array.isArray(candidate?.[key])) return;
        candidate[key].forEach((badge) => {
          const type = normalizeType(badge?.type);
          if (KNOWN_RECOGNITION_TYPES.has(type)) allowed.add(type);
        });
      });
    });

    const rankCandidates = [
      player?.rank,
      player?.career?.rank,
      player?.careerStats?.rank,
      player?.ranking?.rank,
      player?.profile?.rank,
    ];
    const rank = rankCandidates.map(Number).find((value) => Number.isSafeInteger(value) && value > 0) || null;
    if (rank && rank <= CAPTAIN_RANK_LIMIT) allowed.add(CAPTAIN_TYPE);
    else allowed.delete(CAPTAIN_TYPE);

    return allowed;
  }

  function trimCaptainFromBadges(owner) {
    if (!Array.isArray(owner?.__realPlayBadges)) return [];
    const next = owner.__realPlayBadges.filter((badge) => normalizeType(badge?.type) !== CAPTAIN_TYPE);
    owner.__realPlayBadges = next;
    return next;
  }

  function trimKnownRecognitions(candidate, allowedTypes) {
    if (!candidate || typeof candidate !== 'object') return;
    ['badges', 'recognitions'].forEach((key) => {
      if (!Array.isArray(candidate[key])) return;
      candidate[key] = candidate[key].filter((badge) => {
        const type = normalizeType(badge?.type);
        return !KNOWN_RECOGNITION_TYPES.has(type) || allowedTypes.has(type);
      });
    });
  }

  function profileExplicitIds(profile) {
    const source = profileSource(profile);
    return [...new Set([
      positiveIdString(profile?.dataset?.rpPublicPlayerId),
      positiveIdString(profile?.dataset?.rpProfilePlayerId),
      ...sourcePlayerIds(source),
    ].filter(Boolean))];
  }

  function uniqueAuthorityPlayers() {
    return [...new Set(authorityById.values())];
  }

  function matchingAuthorityPlayer(profile) {
    const explicitIds = profileExplicitIds(profile);
    for (const explicitId of explicitIds) {
      if (authorityById.has(explicitId)) return authorityById.get(explicitId);
    }

    const wantedName = normalizeName(profile?.querySelector('.rp-profile-name h1')?.textContent);
    if (!wantedName) return null;
    const matches = uniqueAuthorityPlayers().filter((player) => normalizeName(
      player?.playerName || player?.player_name || player?.name
    ) === wantedName);
    return matches.length === 1 ? matches[0] : null;
  }

  function matchingWorldRow(profile) {
    const explicitIds = profileExplicitIds(profile);
    const rows = [...document.querySelectorAll('.rp-world-player-row')];

    for (const explicitId of explicitIds) {
      const byId = rows.find((row) => String(row?.dataset?.worldPlayerId || '').trim() === explicitId);
      if (byId) return byId;
    }

    const wantedName = normalizeName(profile?.querySelector('.rp-profile-name h1')?.textContent);
    if (!wantedName) return null;
    const matches = rows.filter((row) => normalizeName(
      row?.querySelector('.rp-world-player-name strong')?.textContent
    ) === wantedName);
    return matches.length === 1 ? matches[0] : null;
  }

  function syncProfileSource(profile, allowedTypes) {
    if (!(allowedTypes instanceof Set)) return;
    const source = profileSource(profile);
    nestedRecognitionSources(source).forEach((candidate) => trimKnownRecognitions(candidate, allowedTypes));

    if (Array.isArray(profile.__realPlayBadges)) {
      profile.__realPlayBadges = profile.__realPlayBadges.filter((badge) => {
        const type = normalizeType(badge?.type);
        return !KNOWN_RECOGNITION_TYPES.has(type) || allowedTypes.has(type);
      });
    }
  }

  async function loadAuthority(force = false) {
    const now = Date.now();
    if (!force && authorityLoadedAt && now - authorityLoadedAt < AUTHORITY_TTL_MS) return authorityById;
    if (authorityPromise) return authorityPromise;
    if (typeof window.RealPlayWorld?.community !== 'function') return authorityById;

    authorityPromise = (async () => {
      try {
        const data = await window.RealPlayWorld.community('players');
        const next = new Map();
        (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
          // World rows are keyed by canonical basketball identity, while some
          // profile surfaces still carry the registered account id. Index the
          // exact same authority object under both namespaces so either surface
          // resolves to the same player instead of keeping stale recognitions.
          const canonicalId = playerId(player);
          const accountId = accountPlayerId(player);
          if (canonicalId) next.set(canonicalId, player);
          if (accountId) next.set(accountId, player);
        });
        authorityById = next;
        authorityLoadedAt = Date.now();
      } catch (_error) {
        // Keep the last known authority. DOM-row fallback still protects the UI.
      } finally {
        authorityPromise = null;
        scheduleSync();
      }
      return authorityById;
    })();

    return authorityPromise;
  }

  function syncFeaturedCount(row, badges) {
    const trigger = row.querySelector('[data-rp-featured-recognition]');
    if (!trigger) return;
    const extra = Math.max(0, Number(badges?.length || 0) - 1);
    let count = trigger.querySelector('.rp-player-featured-count');
    if (extra <= 0) {
      count?.remove();
      return;
    }
    if (!count) {
      count = document.createElement('span');
      count.className = 'rp-player-featured-count';
      trigger.appendChild(count);
    }
    count.textContent = `+${extra}`;
    count.setAttribute('aria-label', `${badges.length} owned badges`);
  }

  function syncRow(row) {
    if (!(row instanceof HTMLElement)) return;
    if (!row.hasAttribute('data-official-rank')) return;
    if (isPositiveRank(row.dataset.officialRank)) return;

    const badges = trimCaptainFromBadges(row);
    const featuredType = normalizeType(row.dataset.recognitionType);

    if (featuredType === CAPTAIN_TYPE) {
      row.querySelector('[data-rp-featured-recognition]')?.remove();
      row.classList.remove('rp-recognition-themed');
      row.removeAttribute('data-recognition-type');
      row.style.removeProperty('--rp-recognition-bar');
      return;
    }

    syncFeaturedCount(row, badges);
  }

  function profileExplicitlyUnranked(profile) {
    const rankNode = profile?.querySelector('.rp-profile-rank');
    if (!rankNode) return false;
    const label = String(rankNode.querySelector('small')?.textContent || '').trim();
    return /UNRANKED/i.test(label);
  }

  function removeDisallowedProfileButtons(profile, allowedTypes) {
    if (!(allowedTypes instanceof Set)) return;
    const strip = profile.querySelector('[data-rp-profile-badges]');
    strip?.querySelectorAll('[data-rp-profile-recognition]').forEach((button) => {
      const type = normalizeType(button.dataset.rpProfileRecognition);
      if (KNOWN_RECOGNITION_TYPES.has(type) && !allowedTypes.has(type)) button.remove();
    });
    if (strip && !strip.querySelector('[data-rp-profile-recognition]')) {
      strip.remove();
      profile.classList.remove('has-rp-profile-badges');
    }
  }

  function syncProfile(profile) {
    if (!(profile instanceof HTMLElement)) return;

    // Prefer the same current Players API authority used to build the directory.
    // This still works after opening a profile, when the Players rows may no
    // longer exist in the DOM. That was the gap that allowed stale MVP badges
    // to survive on a player's profile.
    const authorityPlayer = matchingAuthorityPlayer(profile);
    let allowedTypes = authorityPlayer ? authorityRecognitionTypes(authorityPlayer) : null;

    // Fast fallback while authority is loading: use the matching rendered row.
    if (!allowedTypes) {
      const worldRow = matchingWorldRow(profile);
      if (Array.isArray(worldRow?.__realPlayBadges)) {
        allowedTypes = new Set(worldRow.__realPlayBadges.map((badge) => normalizeType(badge?.type)).filter(Boolean));
      }
    }

    if (allowedTypes) {
      syncProfileSource(profile, allowedTypes);
      removeDisallowedProfileButtons(profile, allowedTypes);
    }

    if (profileExplicitlyUnranked(profile)) {
      trimCaptainFromBadges(profile);
      profile.__realPlayBadgeRank = null;
      const strip = profile.querySelector('[data-rp-profile-badges]');
      strip?.querySelector('[data-rp-profile-recognition="captain_eligible"]')?.remove();
      if (strip && !strip.querySelector('[data-rp-profile-recognition]')) {
        strip.remove();
        profile.classList.remove('has-rp-profile-badges');
      }
    }
  }

  function syncAll() {
    scheduled = false;
    document.querySelectorAll('.rp-world-player-row').forEach(syncRow);
    document.querySelectorAll('.rp-profile.open').forEach(syncProfile);

    if (document.querySelector('.rp-profile.open')
      && (!authorityLoadedAt || Date.now() - authorityLoadedAt >= AUTHORITY_TTL_MS)) {
      loadAuthority();
    }
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(syncAll, 0);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => (
      mutation.type === 'childList'
      || mutation.type === 'characterData'
      || mutation.attributeName === 'data-official-rank'
      || mutation.attributeName === 'data-recognition-type'
      || mutation.attributeName === 'class'
    ))) {
      scheduleSync();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-official-rank', 'data-recognition-type', 'class'],
  });

  window.addEventListener('realplay:profile-loaded', () => {
    loadAuthority(true);
    scheduleSync();
  });
  window.addEventListener('realplay:public-profile-loaded', () => {
    loadAuthority(true);
    scheduleSync();
  });
  window.addEventListener('focus', () => {
    if (document.querySelector('.rp-profile.open')) loadAuthority();
    scheduleSync();
  });

  loadAuthority();
  scheduleSync();
})();