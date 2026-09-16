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

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

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

  // The permanent nav was originally mounted inside [data-rp-app]. That app
  // creates its own visual/stacking context, so full-screen profile surfaces can
  // cover the nav even when the nav itself has a higher z-index. Promote the nav
  // to <body> so it is a true viewport-level sibling of profiles and can remain
  // permanently visible everywhere the simple navigation system allows it.
  function promotePermanentNav() {
    const bar = document.querySelector('[data-rp-simple-nav]');
    if (!bar) return false;
    if (bar.parentElement !== document.body) document.body.appendChild(bar);
    return true;
  }

  if (!promotePermanentNav()) {
    const navObserver = new MutationObserver(() => {
      if (promotePermanentNav()) navObserver.disconnect();
    });
    navObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

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

    promotePermanentNav();
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

/*
 * NEXT RANKING GAME capacity badge.
 * Reuse the secured-player roster as the single source of truth so the compact
 * header count always matches the player list below (for example 02/16).
 */
(() => {
  if (window.__realPlayRankingCapacityBadgeInstalled) return;
  window.__realPlayRankingCapacityBadgeInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  const head = view?.querySelector('.rp-ranking-next .rp-ranking-section-head');
  if (!view || !head) return;

  const style = document.createElement('style');
  style.dataset.rpRankingCapacityBadge = 'true';
  style.textContent = `
    .rp-ranking-next .rp-ranking-capacity-badge{
      position:absolute;
      left:0;
      top:50%;
      z-index:2;
      min-width:50px;
      height:38px;
      padding:5px 8px 4px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      box-sizing:border-box;
      border:1px solid rgba(66,217,255,.30);
      border-radius:12px;
      background:linear-gradient(180deg,rgba(6,24,36,.96),rgba(3,12,20,.96));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 7px 18px rgba(0,0,0,.22);
      transform:translateY(-50%);
      pointer-events:none;
    }
    .rp-ranking-next .rp-ranking-capacity-badge[hidden]{display:none!important}
    .rp-ranking-next .rp-ranking-capacity-badge small{
      margin:0 0 3px!important;
      color:#667f95!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.31rem!important;
      font-style:normal!important;
      font-weight:950!important;
      letter-spacing:.13em!important;
      line-height:1!important;
      text-transform:uppercase!important;
    }
    .rp-ranking-next .rp-ranking-capacity-badge strong{
      margin:0!important;
      color:#61e3ff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.68rem!important;
      font-style:italic!important;
      font-weight:950!important;
      letter-spacing:.035em!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    @media(max-width:390px){
      .rp-ranking-next .rp-ranking-capacity-badge{
        min-width:46px;
        height:36px;
        padding-left:6px;
        padding-right:6px;
      }
      .rp-ranking-next .rp-ranking-capacity-badge small{font-size:.29rem!important}
      .rp-ranking-next .rp-ranking-capacity-badge strong{font-size:.62rem!important}
    }
  `;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.className = 'rp-ranking-capacity-badge';
  badge.dataset.rpRankingCapacityBadge = 'true';
  badge.hidden = true;
  badge.innerHTML = '<small>PLAYERS</small><strong data-rp-ranking-capacity-value>00/00</strong>';
  head.appendChild(badge);

  const value = badge.querySelector('[data-rp-ranking-capacity-value]');

  function pad(number) {
    return String(Math.max(0, Math.trunc(Number(number) || 0))).padStart(2, '0');
  }

  function setHidden(hidden) {
    if (badge.hidden !== hidden) badge.hidden = hidden;
  }

  function syncCapacity() {
    const roster = view.querySelector('[data-rp-ranking-secured]');
    const countNode = view.querySelector('[data-rp-ranking-secured-count]');
    const text = String(countNode?.textContent || '').trim();
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);

    if (!roster || roster.hidden || !match) {
      setHidden(true);
      return;
    }

    const joined = Number(match[1]);
    const capacity = Number(match[2]);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setHidden(true);
      return;
    }

    const nextValue = `${pad(joined)}/${pad(capacity)}`;
    if (value && value.textContent !== nextValue) value.textContent = nextValue;
    setHidden(false);
  }

  const observer = new MutationObserver(syncCapacity);
  observer.observe(view, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  syncCapacity();
})();
