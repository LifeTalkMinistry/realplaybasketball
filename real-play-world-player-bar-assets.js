(function exposeRealPlayWorldPlayerBarAssets(global) {
  "use strict";

  const ROOT = "assets/world/player-bars";
  const BADGE_DOMINANT = `${ROOT}/badge-dominant`;

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

    captainEligible: `${BADGE_DOMINANT}/captain-eligible.png`,
  };

  global.RealPlayWorldPlayerBarAssets = Object.freeze(paths);
})(window);
