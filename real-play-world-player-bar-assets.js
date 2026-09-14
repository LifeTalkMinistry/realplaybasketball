(function exposeRealPlayWorldPlayerBarAssets(global) {
  "use strict";

  if (global.__realPlayWorldPlayerBarAssetsInstalled) return;
  global.__realPlayWorldPlayerBarAssetsInstalled = true;

  const ROOT = "assets/world/player-bars";
  const BADGE_DOMINANT = `${ROOT}/badge-dominant`;
  const LEGACY_CAPTAIN_RANKING_BAR = "assets/recognitions/bars/bar-captain-eligible.png";

  const paths = {
    root: ROOT,
    default: `${ROOT}/default`,
    ranking: `${ROOT}/ranking`,
    badgeDominant: BADGE_DOMINANT,

    badgeDominantAsset(slug) {
      const safeSlug = String(slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      return safeSlug ? `${BADGE_DOMINANT}/${safeSlug}.png` : "";
    },

    captainEligible: `${BADGE_DOMINANT}/player-row-bar-captain-eligible.png`,
    captainEligibleRanking: LEGACY_CAPTAIN_RANKING_BAR,
  };

  global.RealPlayWorldPlayerBarAssets = Object.freeze(paths);

  function activeFilterKey() {
    const active = document.querySelector('.rp-world-player-sort [data-player-sort].active');
    return String(active?.dataset?.playerSort || 'ranked').trim().toLowerCase();
  }

  function expectedCaptainBar() {
    return activeFilterKey() === 'ranked'
      ? paths.captainEligibleRanking
      : paths.captainEligible;
  }

  function applyCaptainBar(row) {
    if (!(row instanceof HTMLElement)) return;

    if (String(row.dataset.recognitionType || '').toLowerCase() !== 'captain_eligible') {
      row.removeAttribute('data-rp-captain-bar-variant');
      return;
    }

    const filter = activeFilterKey();
    const variant = filter === 'ranked' ? 'ranking' : 'badge-dominant';
    const asset = expectedCaptainBar();
    const cssValue = `url("${asset}")`;
    const current = row.style.getPropertyValue('--rp-recognition-bar');

    if (current !== cssValue) row.style.setProperty('--rp-recognition-bar', cssValue);
    if (row.dataset.rpCaptainBarVariant !== variant) row.dataset.rpCaptainBarVariant = variant;
  }

  function applyAllCaptainBars() {
    document.querySelectorAll('.rp-world-player-row').forEach(applyCaptainBar);
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyAllCaptainBars();
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-player-sort]')) return;
    scheduleApply();
    window.setTimeout(scheduleApply, 0);
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') return true;
      if (mutation.type !== 'attributes') return false;
      const target = mutation.target;
      if (!(target instanceof HTMLElement)) return false;
      return target.matches('.rp-world-player-row, [data-player-sort]');
    })) scheduleApply();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-recognition-type'],
  });

  scheduleApply();
})(window);
