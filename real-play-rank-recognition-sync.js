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
  let authorityByCanonicalId = new Map();
  let authorityByAccountId = new Map();
  let authorityPlayers = [];

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

  function sourceCanonicalIds(source) {
    const values = [
      source?.playerId,
      source?.player_id,
      source?.player?.playerId,
      source?.player?.player_id,
      source?.profile?.playerId,
      source?.profile?.player_id,
    ];
    return [...new Set(values.map(positiveIdString).filter(Boolean))];
  }

  function sourceAccountIds(source) {
    const values = [
      source?.accountUserId,
      source?.account_user_id,
      source?.userAccountId,
      source?.user_account_id,
      source?.player?.accountUserId,
      source?.player?.account_user_id,
      source?.profile?.accountUserId,
      source?.profile?.account_user_id,
    ];
    return [...new Set(values.map(positiveIdString).filter(Boolean))];
  }

  function sourceAmbiguousIds(source) {
    const values = [
      source?.userId,
      source?.user_id,
      source?.id,
      source?.player?.userId,
      source?.player?.user_id,
      source?.player?.id,
      source?.profile?.userId,
      source?.profile?.user_id,
      source?.profile?.id,
    ];
    return [...new Set(values.map(positiveIdString).filter(Boolean))];
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

  function displayedProfileName(profile) {
    return normalizeName(profile?.querySelector('.rp-profile-name h1')?.textContent);
  }

  function chooseCandidate(candidates, profile) {
    const unique = [...new Set(candidates.filter(Boolean))];
    if (unique.length === 1) return unique[0];
    if (!unique.length) return null;

    const wantedName = displayedProfileName(profile);
    if (!wantedName) return null;
    const nameMatches = unique.filter((player) => normalizeName(
      player?.playerName || player?.player_name || player?.name
    ) === wantedName);
    return nameMatches.length === 1 ? nameMatches[0] : null;
  }

  function matchingAuthorityPlayer(profile) {
    const source = profileSource(profile);
    const canonicalIds = [...new Set([
      positiveIdString(profile?.dataset?.rpPublicPlayerId),
      positiveIdString(profile?.dataset?.rpProfilePlayerId),
      ...sourceCanonicalIds(source),
    ].filter(Boolean))];
    const accountIds = sourceAccountIds(source);
    const ambiguousIds = sourceAmbiguousIds(source);

    const directCandidates = [];
    canonicalIds.forEach((id) => {
      if (authorityByCanonicalId.has(id)) directCandidates.push(authorityByCanonicalId.get(id));
    });
    accountIds.forEach((id) => {
      if (authorityByAccountId.has(id)) directCandidates.push(authorityByAccountId.get(id));
    });

    // userId/id fields are legacy-ambiguous: some surfaces used account ids,
    // newer World surfaces use canonical player ids. Check both namespaces but
    // never collapse them into one map because the numeric values can collide.
    ambiguousIds.forEach((id) => {
      if (authorityByCanonicalId.has(id)) directCandidates.push(authorityByCanonicalId.get(id));
      if (authorityByAccountId.has(id)) directCandidates.push(authorityByAccountId.get(id));
    });

    const direct = chooseCandidate(directCandidates, profile);
    if (direct) return direct;

    const wantedName = displayedProfileName(profile);
    if (!wantedName) return null;
    const nameMatches = authorityPlayers.filter((player) => normalizeName(
      player?.playerName || player?.player_name || player?.name
    ) === wantedName);
    return nameMatches.length === 1 ? nameMatches[0] : null;
  }

  function rowName(row) {
    return normalizeName(row?.querySelector('.rp-world-player-name strong')?.textContent);
  }

  function rowMatchesProfile(row, profile) {
    if (!(row instanceof HTMLElement)) return false;
    const wantedName = displayedProfileName(profile);
    if (!wantedName) return true;
    return rowName(row) === wantedName;
  }

  function matchingWorldRow(profile) {
    const source = profileSource(profile);
    const explicitCanonicalIds = [...new Set([
      positiveIdString(profile?.dataset?.rpPublicPlayerId),
      positiveIdString(profile?.dataset?.rpProfilePlayerId),
      ...sourceCanonicalIds(source),
    ].filter(Boolean))];
    const rows = [...document.querySelectorAll('.rp-world-player-row')];

    // IDs on older profile surfaces can be account IDs even when the Players
    // row is keyed by canonical basketball ID. Never accept a numeric match by
    // itself when the displayed player name says it is a different person.
    for (const explicitId of explicitCanonicalIds) {
      const byId = rows.find((row) => (
        String(row?.dataset?.worldPlayerId || '').trim() === explicitId
        && rowMatchesProfile(row, profile)
      ));
      if (byId) return byId;
    }

    const authorityPlayer = matchingAuthorityPlayer(profile);
    const authorityCanonicalId = playerId(authorityPlayer);
    if (authorityCanonicalId) {
      const byAuthority = rows.find((row) => (
        String(row?.dataset?.worldPlayerId || '').trim() === authorityCanonicalId
        && rowMatchesProfile(row, profile)
      ));
      if (byAuthority) return byAuthority;
    }

    const wantedName = displayedProfileName(profile);
    if (!wantedName) return null;
    const matches = rows.filter((row) => rowName(row) === wantedName);
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
    if (!force && authorityLoadedAt && now - authorityLoadedAt < AUTHORITY_TTL_MS) {
      return authorityPlayers;
    }
    if (authorityPromise) return authorityPromise;
    if (typeof window.RealPlayWorld?.community !== 'function') return authorityPlayers;

    authorityPromise = (async () => {
      try {
        const data = await window.RealPlayWorld.community('players');
        const players = Array.isArray(data?.players) ? data.players : [];
        const byCanonical = new Map();
        const byAccount = new Map();

        players.forEach((player) => {
          const canonicalId = playerId(player);
          const accountId = accountPlayerId(player);
          if (canonicalId) byCanonical.set(canonicalId, player);
          if (accountId) byAccount.set(accountId, player);
        });

        authorityPlayers = players;
        authorityByCanonicalId = byCanonical;
        authorityByAccountId = byAccount;
        authorityLoadedAt = Date.now();
      } catch (_error) {
        // Keep the last known authority. DOM-row fallback still protects the UI.
      } finally {
        authorityPromise = null;
        scheduleSync();
      }
      return authorityPlayers;
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

  function syncProfileButtons(profile, allowedTypes) {
    if (!(allowedTypes instanceof Set)) return;
    const strip = profile.querySelector('[data-rp-profile-badges]');
    if (!strip) return;

    let visibleCount = 0;
    strip.querySelectorAll('[data-rp-profile-recognition]').forEach((button) => {
      const type = normalizeType(button.dataset.rpProfileRecognition);
      const disallowed = KNOWN_RECOGNITION_TYPES.has(type) && !allowedTypes.has(type);

      // Do not remove stale buttons. The legacy recognition renderer watches
      // child-list mutations and can immediately rebuild a removed badge. Hide
      // the button in place instead, while the source data is trimmed above.
      button.hidden = disallowed;
      if (disallowed) button.style.setProperty('display', 'none', 'important');
      else {
        button.style.removeProperty('display');
        visibleCount += 1;
      }
    });

    const hideStrip = visibleCount === 0;
    strip.hidden = hideStrip;
    if (hideStrip) strip.style.setProperty('display', 'none', 'important');
    else strip.style.removeProperty('display');
    profile.classList.toggle('has-rp-profile-badges', !hideStrip);
  }

  function allowedTypesFromWorldRow(row) {
    if (!(row instanceof HTMLElement)) return null;

    // __realPlayBadges is written by the live recognition renderer for the exact
    // Players row. An empty array is authoritative: it means the row currently
    // owns no recognition badge, which is exactly the condition the profile
    // must mirror.
    if (Array.isArray(row.__realPlayBadges)) {
      return new Set(row.__realPlayBadges.map((badge) => normalizeType(badge?.type)).filter(Boolean));
    }

    const featured = normalizeType(row.dataset.recognitionType);
    if (featured && KNOWN_RECOGNITION_TYPES.has(featured)) return new Set([featured]);
    return null;
  }

  function syncProfile(profile) {
    if (!(profile instanceof HTMLElement)) return;

    // The rendered Players row is the first authority because it is the exact
    // UI the user is comparing the profile against. This also avoids allowing a
    // stale recognition from a profile payload or an ambiguous account/canonical
    // ID collision to survive on the profile.
    const worldRow = matchingWorldRow(profile);
    let allowedTypes = allowedTypesFromWorldRow(worldRow);

    // Fall back to the current Players API only when the row is not mounted.
    if (!(allowedTypes instanceof Set)) {
      const authorityPlayer = matchingAuthorityPlayer(profile);
      allowedTypes = authorityPlayer ? authorityRecognitionTypes(authorityPlayer) : null;
    }

    if (allowedTypes instanceof Set) {
      syncProfileSource(profile, allowedTypes);
      syncProfileButtons(profile, allowedTypes);
    }

    if (profileExplicitlyUnranked(profile)) {
      trimCaptainFromBadges(profile);
      profile.__realPlayBadgeRank = null;
      const strip = profile.querySelector('[data-rp-profile-badges]');
      const captain = strip?.querySelector('[data-rp-profile-recognition="captain_eligible"]');
      if (captain) {
        captain.hidden = true;
        captain.style.setProperty('display', 'none', 'important');
      }
      if (strip) {
        const visible = [...strip.querySelectorAll('[data-rp-profile-recognition]')].some((button) => !button.hidden);
        strip.hidden = !visible;
        if (!visible) strip.style.setProperty('display', 'none', 'important');
        profile.classList.toggle('has-rp-profile-badges', visible);
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