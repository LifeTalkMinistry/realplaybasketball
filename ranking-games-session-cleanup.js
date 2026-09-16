(() => {
  if (window.__realPlayRankingSessionCleanupInstalled) return;
  window.__realPlayRankingSessionCleanupInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const style = document.createElement('style');
  style.dataset.rpRankingSectionCenter = 'true';
  style.textContent = `
    .rp-ranking-next .rp-ranking-section-head,
    .rp-ranking-rules .rp-ranking-section-head{
      position:relative;
      justify-content:center;
    }

    .rp-ranking-next .rp-ranking-section-head>div,
    .rp-ranking-rules .rp-ranking-section-head>div{
      width:100%;
      text-align:center;
    }

    .rp-ranking-next .rp-ranking-section-head h2,
    .rp-ranking-rules .rp-ranking-section-head h2{
      margin-left:auto!important;
      margin-right:auto!important;
      text-align:center!important;
    }

    /* Keep the optional reservation cancel action independent from the centered title. */
    .rp-ranking-next [data-rp-ranking-cancel]:not([hidden]){
      position:absolute;
      right:0;
      top:50%;
      transform:translateY(-50%);
    }

    /* Preserve the earlier cleanup request even if older cached markup is still mounted. */
    .rp-ranking-rules .rp-ranking-rule-row{
      display:none!important;
    }
  `;
  document.head.appendChild(style);

  const status = view.querySelector('[data-rp-ranking-session-status]');
  const title = view.querySelector('[data-rp-ranking-session-title]');
  if (!status || !title) return;

  function sync() {
    const statusText = String(status.textContent || '').trim().toUpperCase();
    const titleText = String(title.textContent || '').trim().toUpperCase();
    const hideStatus = statusText === 'RANKING GAME ANNOUNCED';

    // Session titles are operational/admin labels (for example,
    // "BETA CAREER SESSION #001"). Players only need the court, date,
    // time, capacity and reservation state. Keep the empty-state placeholder,
    // but never expose a posted session's internal title in the player view.
    const hideTitle = titleText !== 'TO BE ANNOUNCED';

    status.hidden = hideStatus;
    title.hidden = hideTitle;

    // ranking-games.css explicitly sets the session title to display:block,
    // which can visually override the browser's native [hidden] rule.
    // Apply the display state inline so internal session names stay hidden.
    if (hideTitle) {
      title.style.setProperty('display', 'none', 'important');
    } else {
      title.style.removeProperty('display');
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  observer.observe(title, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  sync();
})();

/*
 * A secured-player profile is a navigation destination, not another modal
 * stacked on top of Open Rank. Close Open Rank before its player-card click
 * handler opens the profile so the permanent app navigation remains visible.
 */
(() => {
  if (window.__realPlayRankingProfileNavigationInstalled) return;
  window.__realPlayRankingProfileNavigationInstalled = true;

  const style = document.createElement('style');
  style.dataset.rpRankingProfileNavigation = 'true';
  style.textContent = `
    body.rp-simple-navigation-active .rp-public-player-profile{
      padding-bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom));
    }
    body.rp-simple-navigation-active .rp-public-player-profile .rp-profile-body{
      padding-bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom) + 18px)!important;
    }
  `;
  document.head.appendChild(style);

  function closeOpenRank() {
    if (!view.classList.contains('open')) return;

    if (window.RealPlayRankingGames?.close) {
      window.RealPlayRankingGames.close();
      return;
    }

    // Defensive fallback if the Open Rank controller is still initializing.
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-ranking-open');
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-rp-ranking-secured] .rp-ranking-secured-player');
    if (!card || !view.classList.contains('open')) return;

    const isYou = card.classList.contains('is-you')
      || Boolean(card.querySelector('.rp-ranking-secured-you'));

    closeOpenRank();

    // For the logged-in player's own card, use the permanent ME navigation
    // route so its active state and profile lifecycle stay in sync.
    if (isYou) {
      const meButton = document.querySelector('[data-rp-simple-nav-item="me"]');
      if (meButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.setTimeout(() => meButton.click(), 0);
      }
    }
  }, true);
})();
