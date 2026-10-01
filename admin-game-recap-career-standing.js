(() => {
  if (window.__realPlayAdminGameRecapCareerStandingInstalled) return;
  window.__realPlayAdminGameRecapCareerStandingInstalled = true;

  function isCareerStandingPanel(panel) {
    if (!(panel instanceof Element) || !panel.matches('.rp-recap-panel')) return false;

    const small = String(panel.querySelector('.rp-recap-panel-head small')?.textContent || '')
      .trim()
      .toUpperCase();
    const title = String(panel.querySelector('.rp-recap-panel-head strong')?.textContent || '')
      .trim()
      .toUpperCase();
    const text = String(panel.textContent || '').toUpperCase();

    return Boolean(
      panel.querySelector('.rp-recap-career-list')
      || small === 'CANONICAL CAREER STATE'
      || title === 'CURRENT PLAYER STANDING'
      || title === 'PLAYER RESULTS / CURRENT STANDING'
      || text.includes('PLAYER STANDING UNAVAILABLE')
    );
  }

  function removeCareerStanding(root = document) {
    const panels = root instanceof Element && root.matches('.rp-recap-panel')
      ? [root]
      : [...(root.querySelectorAll?.('.rp-recap-panel') || [])];

    panels.forEach((panel) => {
      if (isCareerStandingPanel(panel)) panel.remove();
    });
  }

  removeCareerStanding();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        removeCareerStanding(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
