(() => {
  if (window.__realPlayLegacyBottomNavRemovalInstalled) return;
  window.__realPlayLegacyBottomNavRemovalInstalled = true;

  function removeLegacyBottomNav(root = document) {
    root.querySelectorAll?.('.rp-bottom-nav,[data-rp-bottom-nav]').forEach((node) => node.remove());
  }

  removeLegacyBottomNav();
  document.documentElement.classList.add('rp-legacy-bottom-nav-removed');

  const app = document.querySelector('[data-rp-app]');
  if (!app) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.rp-bottom-nav,[data-rp-bottom-nav]')) node.remove();
        else removeLegacyBottomNav(node);
      }
    }
  });

  observer.observe(app, { childList: true, subtree: true });
})();
