(() => {
  if (window.__realPlayAdminGameRecapCareerStandingInstalled) return;
  window.__realPlayAdminGameRecapCareerStandingInstalled = true;

  /*
   * RETIRED DUPLICATE CAREER-STANDING AUTHORITY
   *
   * admin-game-recap.js already owns the recap's CURRENT PLAYER STANDING panel
   * and reads the canonical /api/real-play/community player authority. It also
   * correctly keeps public OVR hidden while a player is UNRANKED and preserves
   * the backend's canonical official rank.
   *
   * This former enhancement independently re-hydrated the same panel, mixed
   * directory/profile fallbacks, exposed provisional OVR for UNRANKED players,
   * and could overwrite the correct recap with stale/competing rank data.
   *
   * Keep this asset as a no-op compatibility shim because older admin loaders
   * may still request it. The single rendering/data authority is now:
   *
   *   admin-game-recap.js -> community('players') -> canonical backend ranking
   *
   * Do not write to .rp-recap-career-list from this compatibility file.
   */
})();
