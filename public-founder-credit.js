(() => {
  const FUTURE_4V4_CLEANUP_STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';
  let future4v4CleanupObserver = null;

  function installFuture4v4CardCleanupStyle() {
    if (document.getElementById(FUTURE_4V4_CLEANUP_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = FUTURE_4V4_CLEANUP_STYLE_ID;
    style.textContent = `
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4{
        min-height:108px!important;
        padding:18px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>strong{
        display:block!important;
        margin:0!important;
        font-size:1.08rem!important;
        line-height:1.05!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4 .rp-home-4v4-explore{
        margin-top:16px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanFuture4v4Card() {
    installFuture4v4CardCleanupStyle();

    const card = document.querySelector('[data-rp-home-future-4v4="true"]')
      || document.querySelector('.rp-home-coming-card.is-4v4');
    if (!card) return false;

    card.querySelector(':scope > small')?.remove();
    card.querySelector(':scope > p')?.remove();
    card.querySelector(':scope > .rp-home-4v4-path')?.remove();

    const title = card.querySelector(':scope > strong');
    if (title && title.textContent.trim() !== '4V4 LEAGUE') title.textContent = '4V4 LEAGUE';

    const action = card.querySelector('.rp-home-4v4-explore');
    if (action) {
      action.textContent = 'JOIN A TEAM NOW';
      action.setAttribute('aria-label', 'Join a team now');
    }

    return Boolean(title && action);
  }

  function startFuture4v4CardCleanup() {
    cleanFuture4v4Card();
    if (future4v4CleanupObserver) return;

    future4v4CleanupObserver = new MutationObserver(() => cleanFuture4v4Card());
    future4v4CleanupObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function loadFuture4v4Preview() {
    if (window.__realPlayFuture4v4PreviewInstalled) {
      startFuture4v4CardCleanup();
      return;
    }
    if (document.querySelector('script[data-rp-home-future-4v4-loader]')) {
      startFuture4v4CardCleanup();
      return;
    }

    const script = document.createElement('script');
    script.src = 'home-future-4v4-preview.js?v=20260915-future-4v4-preview-v1';
    script.async = false;
    script.dataset.rpHomeFuture4v4Loader = 'true';
    script.addEventListener('load', startFuture4v4CardCleanup, { once: true });
    document.head.appendChild(script);
  }

  function buildCredit({ home = false } = {}) {
    const credit = document.createElement('p');
    credit.className = home
      ? 'rp-public-founder-credit rp-home-project-credit'
      : 'rp-public-founder-credit';
    if (home) credit.dataset.rpHomeProjectCredit = 'true';
    else credit.dataset.publicFounderCredit = 'true';
    credit.setAttribute('aria-label', 'Project by Max Emorej');
    credit.innerHTML = '<span>PROJECT BY:</span><strong>MAX EMOREJ</strong>';
    return credit;
  }

  const hero = document.querySelector('[data-public-hero-default]');
  if (hero && !hero.querySelector('[data-public-founder-credit]')) {
    const credit = buildCredit();
    const more = hero.querySelector('.rp-public-more');
    if (more) more.insertAdjacentElement('afterend', credit);
    else hero.appendChild(credit);
  }

  const home = document.querySelector('[data-rp-simple-home]');
  if (home && !home.querySelector('[data-rp-home-project-credit]')) {
    const credit = buildCredit({ home: true });
    const whatsComing = home.querySelector('[data-rp-home-whats-coming]');
    if (whatsComing) whatsComing.insertAdjacentElement('afterend', credit);
    else home.appendChild(credit);
  }

  loadFuture4v4Preview();
  startFuture4v4CardCleanup();
})();
