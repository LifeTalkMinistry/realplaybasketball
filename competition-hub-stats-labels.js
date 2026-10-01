(() => {
  if (window.__realPlayCompetitionHubStatsLabelsInstalled) return;
  window.__realPlayCompetitionHubStatsLabelsInstalled = true;

  const style = document.createElement('style');
  style.dataset.rpCompetitionHubStatsLabels = '1';
  style.textContent = `
    [data-rp-simple-nav-item="players"] > small{
      font-size:0!important;
    }
    [data-rp-simple-nav-item="players"] > small::after{
      content:'STATS';
      font-size:.5rem;
      font-weight:900;
      letter-spacing:.08em;
    }
    [data-rp-competition-hub][data-rp-competition-current-view="hub"] [data-rp-competition-title]{
      font-size:0!important;
    }
    [data-rp-competition-hub][data-rp-competition-current-view="hub"] [data-rp-competition-title]::after{
      content:'STATS';
      font-size:1.15rem;
    }
    [data-rp-competition-view="hub"] .rp-competition-intro h1{
      font-size:0!important;
    }
    [data-rp-competition-view="hub"] .rp-competition-intro h1::after{
      content:'STATS.';
      font-size:clamp(2rem,9vw,3.25rem);
    }
  `;
  document.head.appendChild(style);

  function applyAccessibleLabels() {
    const navButton = document.querySelector('[data-rp-simple-nav-item="players"]');
    if (navButton) navButton.setAttribute('aria-label', 'Open Real Play stats');

    const hub = document.querySelector('[data-rp-competition-hub]');
    const hubTitle = hub?.querySelector('[data-rp-competition-title]');
    const hubHeading = hub?.querySelector('[data-rp-competition-view="hub"] .rp-competition-intro h1');
    if (hubTitle) hubTitle.setAttribute('aria-label', 'STATS');
    if (hubHeading) hubHeading.setAttribute('aria-label', 'STATS');
  }

  applyAccessibleLabels();
  const observer = new MutationObserver(applyAccessibleLabels);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();