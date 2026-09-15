(() => {
  if (window.__realPlayFuture4v4CardCleanupInstalled) return;
  window.__realPlayFuture4v4CardCleanupInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
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

  function cleanCard() {
    installStyle();
    const card = document.querySelector('[data-rp-home-future-4v4="true"]')
      || document.querySelector('.rp-home-coming-card.is-4v4');
    if (!card) return false;

    card.querySelector(':scope > small')?.remove();
    card.querySelector(':scope > p')?.remove();
    card.querySelector(':scope > .rp-home-4v4-path')?.remove();

    const title = card.querySelector(':scope > strong');
    if (title && title.textContent.trim() !== '4V4 LEAGUE') {
      title.textContent = '4V4 LEAGUE';
    }

    const action = card.querySelector('.rp-home-4v4-explore');
    if (action && action.textContent.trim() !== 'JOIN A TEAM NOW') {
      action.textContent = 'JOIN A TEAM NOW';
      action.setAttribute('aria-label', 'Join a team now');
    }

    return Boolean(title && action);
  }

  cleanCard();

  const observer = new MutationObserver(() => {
    cleanCard();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
