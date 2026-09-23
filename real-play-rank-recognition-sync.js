(() => {
  if (window.__realPlayRankRecognitionSyncInstalled) return;
  window.__realPlayRankRecognitionSyncInstalled = true;

  const CAPTAIN_TYPE = 'captain_eligible';
  const KNOWN_RECOGNITION_TYPES = new Set([
    'most_overall_mvp',
    'most_team_mvp',
    'best_shooting',
    'best_rebounder',
    CAPTAIN_TYPE,
  ]);
  let scheduled = false;

  function normalizeType(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isPositiveRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0;
  }

  function trimCaptainFromBadges(owner) {
    if (!Array.isArray(owner?.__realPlayBadges)) return [];
    const next = owner.__realPlayBadges.filter((badge) => normalizeType(badge?.type) !== CAPTAIN_TYPE);
    owner.__realPlayBadges = next;
    return next;
  }

  function sourcePlayerId(source) {
    const candidates = [
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
    ];
    for (const value of candidates) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0) return String(id);
    }
    return '';
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function profileSource(profile) {
    return profile?.classList?.contains('rp-public-player-profile')
      ? profile.__realPlayPublicPlayer
      : profile.__realPlayProfileState;
  }

  function matchingWorldRow(profile) {
    const source = profileSource(profile);
    const explicitId = String(
      profile?.dataset?.rpPublicPlayerId
      || profile?.dataset?.rpProfilePlayerId
      || sourcePlayerId(source)
      || ''
    ).trim();
    const rows = [...document.querySelectorAll('.rp-world-player-row')];

    if (explicitId) {
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

  function syncProfileSourceToWorld(profile, authoritativeBadges) {
    if (!Array.isArray(authoritativeBadges)) return null;
    const allowedTypes = new Set(authoritativeBadges.map((badge) => normalizeType(badge?.type)).filter(Boolean));
    const source = profileSource(profile);
    [source, source?.player, source?.profile, source?.career, source?.careerStats]
      .filter(Boolean)
      .forEach((candidate) => trimKnownRecognitions(candidate, allowedTypes));

    if (Array.isArray(profile.__realPlayBadges)) {
      profile.__realPlayBadges = profile.__realPlayBadges.filter((badge) => {
        const type = normalizeType(badge?.type);
        return !KNOWN_RECOGNITION_TYPES.has(type) || allowedTypes.has(type);
      });
    }

    return allowedTypes;
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

    // The filter/ranking layer writes data-official-rank from the canonical
    // backend rank authority. Once that attribute exists, an empty value means
    // the player is currently UNRANKED even if the recognition layer still has
    // a short-lived cached copy of their old rank.
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

    // Captain eligibility is the lowest-priority recognition. If another badge
    // is featured, keep that badge but remove the stale captain from its +count
    // and from the details collection opened from this row.
    syncFeaturedCount(row, badges);
  }

  function profileExplicitlyUnranked(profile) {
    const rankNode = profile?.querySelector('.rp-profile-rank');
    if (!rankNode) return false;
    const label = String(rankNode.querySelector('small')?.textContent || '').trim();
    return /UNRANKED/i.test(label);
  }

  function syncProfile(profile) {
    if (!(profile instanceof HTMLElement)) return;

    // The Players directory is the current recognition authority. A profile may
    // still carry an older badge array in its own response, so reconcile that
    // cached profile payload to the exact badge types owned by the matching
    // World/Players row before the recognition renderer gets another pass.
    const worldRow = matchingWorldRow(profile);
    const authoritativeBadges = Array.isArray(worldRow?.__realPlayBadges)
      ? worldRow.__realPlayBadges
      : null;
    const allowedTypes = syncProfileSourceToWorld(profile, authoritativeBadges);

    const strip = profile.querySelector('[data-rp-profile-badges]');
    if (allowedTypes) {
      strip?.querySelectorAll('[data-rp-profile-recognition]').forEach((button) => {
        const type = normalizeType(button.dataset.rpProfileRecognition);
        if (KNOWN_RECOGNITION_TYPES.has(type) && !allowedTypes.has(type)) button.remove();
      });
    }

    // Keep the existing explicit UNRANKED protection as a fallback when the
    // matching Players row has not rendered yet.
    if (profileExplicitlyUnranked(profile)) {
      trimCaptainFromBadges(profile);
      profile.__realPlayBadgeRank = null;
      strip?.querySelector('[data-rp-profile-recognition="captain_eligible"]')?.remove();
    }

    if (strip && !strip.querySelector('[data-rp-profile-recognition]')) {
      strip.remove();
      profile.classList.remove('has-rp-profile-badges');
    }
  }

  function syncAll() {
    scheduled = false;
    document.querySelectorAll('.rp-world-player-row').forEach(syncRow);
    document.querySelectorAll('.rp-profile.open').forEach(syncProfile);
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

  window.addEventListener('realplay:profile-loaded', scheduleSync);
  window.addEventListener('realplay:public-profile-loaded', scheduleSync);
  window.addEventListener('focus', scheduleSync);

  scheduleSync();
})();