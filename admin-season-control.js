(() => {
  if (window.__realPlayAdminSeasonControlRetired) return;
  window.__realPlayAdminSeasonControlRetired = true;

  // The old 3v3 season-authority setup card is retired.
  // Current Real Play operations are session/game based, so this admin asset
  // now only removes any legacy card that may still exist in the DOM.
  function removeLegacySeasonSetup() {
    document
      .querySelectorAll('[data-rp-admin-season-wrap]')
      .forEach((node) => node.remove());
  }

  removeLegacySeasonSetup();
  window.addEventListener('realplay:admin-render', removeLegacySeasonSetup);
  window.addEventListener('realplay:app-ready', removeLegacySeasonSetup);
})();
