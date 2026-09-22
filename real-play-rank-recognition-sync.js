(() => {
  if (window.__realPlayRankRecognitionSyncInstalled) return;
  window.__realPlayRankRecognitionSyncInstalled = true;

  const CAPTAIN_TYPE = 'captain_eligible';
  let scheduled = false;

  function isPositiveRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0;
  }

  function trimCaptainFromBadges(owner) {
    if (!Array.isArray(owner?.__realPlayBadges)) return [];
    const next = owner.__realPlayBadges.filter((badge) => (
      String(badge?.type || '').trim().toLowerCase() !== CAPTAIN_TYPE
    ));
    owner.__realPlayBadges = next;
    return next;
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
    const featuredType = String(row.dataset.recognitionType || '').trim().toLowerCase();

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
    if (!(profile instanceof HTMLElement) || !profileExplicitlyUnranked(profile)) return;

    trimCaptainFromBadges(profile);
    profile.__realPlayBadgeRank = null;

    const strip = profile.querySelector('[data-rp-profile-badges]');
    strip?.querySelector('[data-rp-profile-recognition="captain_eligible"]')?.remove();

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