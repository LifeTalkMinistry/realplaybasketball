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
