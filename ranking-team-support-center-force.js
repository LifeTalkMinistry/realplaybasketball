(() => {
  if (window.__realPlayTeamSupportCenterForceInstalled) return;
  window.__realPlayTeamSupportCenterForceInstalled = true;

  function normalizeOverlay(root = document) {
    const overlay = root?.matches?.('[data-rp-team-support-overlay]')
      ? root
      : root?.querySelector?.('[data-rp-team-support-overlay]');
    if (!overlay) return;

    // Detach this flow from the shared bottom-sheet classes. Those classes are
    // intentionally anchored to the bottom for team creation/join sheets and
    // were overriding the support funnel even when its CSS requested centering.
    overlay.classList.remove('rp-team-sheet-overlay');
    overlay.classList.add('rp-team-support-overlay');

    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (panel) {
      panel.classList.remove('rp-team-sheet');
      panel.classList.add('rp-team-support-card');
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        normalizeOverlay(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  normalizeOverlay(document);
})();
