(() => {
  if (window.__realPlayCompetitionHubCleanupInstalled) return;
  window.__realPlayCompetitionHubCleanupInstalled = true;

  function installCleanupStyles() {
    if (document.querySelector('[data-rp-competition-hub-cleanup-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCompetitionHubCleanupStyles = '1';
    style.textContent = `
      [data-rp-competition-hub] .rp-competition-heading strong{margin-top:0}
      [data-rp-competition-hub] [data-rp-competition-view="hub"]{padding-top:2px}
      [data-rp-competition-hub] [data-rp-competition-view="hub"] .rp-competition-card-grid{margin-top:0}
    `;
    document.head.appendChild(style);
  }

  function cleanHub() {
    const hub = document.querySelector('[data-rp-competition-hub]');
    if (!hub) return false;

    hub.querySelector('.rp-competition-heading small')?.remove();

    const hubView = hub.querySelector('[data-rp-competition-view="hub"]');
    hubView?.querySelector('.rp-competition-intro')?.remove();
    hubView?.querySelector('.rp-competition-footnote')?.remove();

    return true;
  }

  installCleanupStyles();
  cleanHub();

  const observer = new MutationObserver(() => {
    if (cleanHub()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();