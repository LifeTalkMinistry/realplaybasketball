(() => {
  if (window.__realPlay4v4RotationCleanUiInstalled) return;
  window.__realPlay4v4RotationCleanUiInstalled = true;

  const HOME_META_FALLBACK = 'SUNDAY · 8:00 PM – 10:00 PM';
  const TEAM_TITLE = 'SELECT YOUR TEAM';
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
      body .rp-4v4-static-view [data-rp-4v4-team-slot]{
        display:grid!important;
      }
      .rp-4v4-static-view .rp-4v4-team-slot ~ .rp-4v4-team-slot{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function currentHomeMeta() {
    const active = (Array.isArray(window.__realPlay4v4RotationDays) ? window.__realPlay4v4RotationDays : [])
      .filter((rotation) => rotation?.enabled);
    if (!active.length) return HOME_META_FALLBACK;
    if (active.length === 1) return active[0].label || HOME_META_FALLBACK;
    const sameWindow = active.every((rotation) => rotation.start === active[0].start && rotation.end === active[0].end);
    if (!sameWindow) return `${active.length} ACTIVE ROTATION DAYS`;
    const firstLabel = String(active[0].label || '');
    const timeLabel = firstLabel.includes(' · ') ? firstLabel.split(' · ').slice(1).join(' · ') : '8:00 PM – 10:00 PM';
    return `${active.map((rotation) => String(rotation.day || '').slice(0, 3)).join(' + ')} · ${timeLabel}`;
  }

  function cleanHomeCard() {
    const card = document.querySelector('[data-rp-home-open-rank]');
    if (!card) return;

    const meta = card.querySelector('[data-rp-home-open-rank-meta]');
    const nextMeta = currentHomeMeta();
    if (meta && meta.textContent.trim() !== nextMeta) meta.textContent = nextMeta;

    const capacity = card.querySelector('[data-rp-home-open-rank-capacity]');
    if (capacity && !capacity.hidden) capacity.hidden = true;

    if (card.getAttribute('aria-label') !== 'Current 4v4 team schedule rotation') {
      card.setAttribute('aria-label', 'Current 4v4 team schedule rotation');
    }
  }

  function cleanTeamScreen() {
    const view = document.querySelector('[data-rp-4v4-static-view]');
    if (!view) return;

    let head = view.querySelector('.rp-3v3-select-head');
    if (!head) {
      head = document.createElement('section');
      head.className = 'rp-3v3-select-head';
      head.innerHTML = `<h1>${TEAM_TITLE}</h1>`;
      const topbar = view.querySelector('.rp-3v3-topbar');
      if (topbar) topbar.insertAdjacentElement('afterend', head);
      else view.prepend(head);
    }

    let heading = head.querySelector('h1');
    if (!heading) {
      heading = document.createElement('h1');
      head.prepend(heading);
    }
    if (heading.textContent.trim() !== TEAM_TITLE) heading.textContent = TEAM_TITLE;
    heading.removeAttribute('data-rp-4v4-slot-heading');
    heading.removeAttribute('aria-label');
    heading.removeAttribute('role');
    heading.removeAttribute('tabindex');

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
    cleanTeamScreen();
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
      // Keep one stable page heading and one canonical schedule banner.
      // Changes are conditional so the observer cannot feed itself forever.
      cleanTeamScreen();
      queueEnforce();
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('realplay:home-schedule-changed', queueEnforce);
    window.addEventListener('realplay:4v4-rotation-schedule', queueEnforce);
    window.addEventListener('realplay:4v4-open', () => {
      cleanTeamScreen();
      queueEnforce();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
