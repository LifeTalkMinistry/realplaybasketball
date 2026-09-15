(function exposeRealPlayWorldPlayerBarAssets(global) {
  "use strict";

  if (global.__realPlayWorldPlayerBarAssetsInstalled) return;
  global.__realPlayWorldPlayerBarAssetsInstalled = true;

  const ROOT = "assets/world/player-bars";
  const BADGE_DOMINANT = `${ROOT}/badge-dominant`;
  const LEGACY_CAPTAIN_RANKING_BAR = "assets/recognitions/bars/bar-captain-eligible.png";
  const FILTER_ATTRIBUTE = "data-rp-player-bar-filter";

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

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-bar-variant-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerBarVariantStyles = '1';
    style.textContent = `
      html[${FILTER_ATTRIBUTE}="ranked"] .rp-world-player-row[data-recognition-type="captain_eligible"]{
        --rp-recognition-bar:url("${paths.captainEligibleRanking}")!important;
      }
      html:not([${FILTER_ATTRIBUTE}="ranked"]) .rp-world-player-row[data-recognition-type="captain_eligible"]{
        --rp-recognition-bar:url("${paths.captainEligible}")!important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncFilterVariant() {
    const next = activeFilterKey() || 'ranked';
    if (document.documentElement.getAttribute(FILTER_ATTRIBUTE) !== next) {
      document.documentElement.setAttribute(FILTER_ATTRIBUTE, next);
    }
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncFilterVariant();
    });
  }

  // IMPORTANT: this layer never writes --rp-recognition-bar inline anymore.
  // real-play-captain-eligibility.js owns row rendering; this file only selects
  // which Captain Eligible artwork wins through one CSS authority. That avoids
  // the two MutationObservers repeatedly overwriting the same inline variable.
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-player-sort]')) scheduleSync();
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') return true;
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return false;
      return mutation.target instanceof HTMLElement && mutation.target.matches('[data-player-sort]');
    })) scheduleSync();
  });

  installStyles();
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  syncFilterVariant();
})(window);
