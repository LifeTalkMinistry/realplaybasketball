(() => {
  if (window.__realPlayReplayCommentsViewportInstalled) return;
  window.__realPlayReplayCommentsViewportInstalled = true;

  const STYLE_ID = 'rp-replay-comments-viewport-styles';
  const LIST_SELECTOR = '[data-rp-career-comments-list]';
  const COMMENT_SELECTOR = ':scope > .rp-career-replay-comment';
  let syncQueued = false;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-career-replay-comments-panel{
        grid-template-rows:auto auto!important;
        min-height:0!important;
      }
      .rp-career-replay-comments-list{
        max-height:none!important;
        overflow-y:visible!important;
        overscroll-behavior:contain;
      }
      .rp-career-replay-comments-list.rp-comments-scrollable{
        height:var(--rp-comments-viewport-height,192px)!important;
        max-height:var(--rp-comments-viewport-height,192px)!important;
        overflow-y:auto!important;
        overscroll-behavior-y:contain;
        -webkit-overflow-scrolling:touch;
        scroll-snap-type:y proximity;
        scrollbar-width:none;
        touch-action:pan-y;
      }
      .rp-career-replay-comments-list.rp-comments-scrollable::-webkit-scrollbar{
        display:none;
      }
      .rp-career-replay-comments-list.rp-comments-scrollable>.rp-career-replay-comment{
        scroll-snap-align:start;
        scroll-snap-stop:normal;
      }
    `;
    document.head.appendChild(style);
  }

  function signatureFor(articles) {
    return articles.map((article) => article.textContent || '').join('\u241E');
  }

  function measureThree(list) {
    if (!list.classList.contains('rp-comments-scrollable')) return;
    const visible = [...list.querySelectorAll(COMMENT_SELECTOR)].slice(0, 3);
    if (visible.length < 3) return;

    const measured = visible.reduce((total, article) => {
      const rect = article.getBoundingClientRect();
      return total + Math.max(0, rect.height);
    }, 0);

    if (measured > 24) {
      list.style.setProperty('--rp-comments-viewport-height', `${Math.ceil(measured)}px`);
    }
  }

  function syncList(list) {
    if (!(list instanceof HTMLElement)) return;
    const articles = [...list.querySelectorAll(COMMENT_SELECTOR)];

    if (!articles.length) {
      list.classList.remove('rp-comments-scrollable');
      list.style.removeProperty('--rp-comments-viewport-height');
      delete list.dataset.rpCommentsProcessedSignature;
      return;
    }

    const beforeSignature = signatureFor(articles);
    if (list.dataset.rpCommentsProcessedSignature !== beforeSignature) {
      const newestFirst = [...articles].reverse();
      newestFirst.forEach((article) => list.appendChild(article));
      list.dataset.rpCommentsProcessedSignature = signatureFor(newestFirst);
    }

    const current = [...list.querySelectorAll(COMMENT_SELECTOR)];
    const scrollable = current.length > 3;
    list.classList.toggle('rp-comments-scrollable', scrollable);

    if (!scrollable) {
      list.style.removeProperty('--rp-comments-viewport-height');
      list.scrollTop = 0;
      return;
    }

    list.scrollTop = 0;
    requestAnimationFrame(() => {
      if (!list.isConnected) return;
      measureThree(list);
      list.scrollTop = 0;
    });
  }

  function syncAll() {
    syncQueued = false;
    document.querySelectorAll(LIST_SELECTOR).forEach(syncList);
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(syncAll);
  }

  installStyles();
  syncAll();

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      const target = mutation.target;
      if (target instanceof Element && (target.matches(LIST_SELECTOR) || target.closest(LIST_SELECTOR))) return true;
      return [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches?.(LIST_SELECTOR) || node.querySelector?.(LIST_SELECTOR)));
    })) {
      queueSync();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('resize', () => {
    document.querySelectorAll(`${LIST_SELECTOR}.rp-comments-scrollable`).forEach((list) => {
      requestAnimationFrame(() => measureThree(list));
    });
  }, { passive: true });
})();
