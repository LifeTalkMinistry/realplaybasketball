(() => {
  if (window.__realPlay4v4RotationCleanUiInstalled) return;
  window.__realPlay4v4RotationCleanUiInstalled = true;

  const HOME_META = 'SAT + SUN · 8:00 PM – 10:00 PM';
  let queued = false;

  function installStyles() {
    if (document.getElementById('rp-4v4-rotation-clean-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-4v4-rotation-clean-ui-style';
    style.textContent = `
      body.rp-simple-navigation-active [data-rp-home-open-rank]{
        min-height:0!important;
        height:auto!important;
        justify-content:flex-start!important;
        gap:12px!important;
        padding-top:17px!important;
        padding-bottom:17px!important;
      }
      body.rp-simple-navigation-active [data-rp-home-open-rank] .rp-home-session-copy{
        min-height:0!important;
        height:auto!important;
        flex:0 0 auto!important;
      }
      body.rp-simple-navigation-active [data-rp-home-open-rank-meta]{
        margin-top:7px!important;
      }
      body.rp-simple-navigation-active [data-rp-home-open-rank-capacity]{
        display:none!important;
      }
      body.rp-simple-navigation-active [data-rp-home-open-rank] .rp-home-save-slot{
        margin:0!important;
        flex:0 0 auto!important;
      }
      .rp-4v4-static-view .rp-4v4-team-slot ~ .rp-4v4-team-slot{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanHomeCard() {
    const card = document.querySelector('[data-rp-home-open-rank]');
    if (!card) return;

    const meta = card.querySelector('[data-rp-home-open-rank-meta]');
    if (meta && meta.textContent.trim() !== HOME_META) meta.textContent = HOME_META;

    const capacity = card.querySelector('[data-rp-home-open-rank-capacity]');
    if (capacity && !capacity.hidden) capacity.hidden = true;

    if (card.getAttribute('aria-label') !== 'Current 4v4 team schedule rotation') {
      card.setAttribute('aria-label', 'Current 4v4 team schedule rotation');
    }
  }

  function cleanTeamScheduleBanner() {
    const view = document.querySelector('[data-rp-4v4-static-view]');
    if (!view) return;

    const banners = [...view.querySelectorAll('.rp-4v4-team-slot')];
    if (!banners.length) return;

    const keep = banners[0];
    if (!keep.hasAttribute('data-rp-4v4-team-slot')) {
      keep.setAttribute('data-rp-4v4-team-slot', '1');
    }
    if (keep.hasAttribute('data-rp4v4-team-slot')) {
      keep.removeAttribute('data-rp4v4-team-slot');
    }

    banners.slice(1).forEach((banner) => banner.remove());
  }

  function enforce() {
    installStyles();
    cleanHomeCard();
    cleanTeamScheduleBanner();
  }

  function queueEnforce() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      enforce();
    });
  }

  function start() {
    enforce();
    new MutationObserver(() => {
      // Canonicalize/remove schedule banners immediately. The rotation runtime
      // also reacts to DOM changes on the next animation frame, so waiting for
      // our own frame here can allow it to create another banner first.
      cleanTeamScheduleBanner();
      queueEnforce();
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('realplay:home-schedule-changed', queueEnforce);
    window.addEventListener('realplay:4v4-open', () => {
      cleanTeamScheduleBanner();
      queueEnforce();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
