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

(() => {
  if (window.__realPlaySafariReplayFillInstalled) return;
  window.__realPlaySafariReplayFillInstalled = true;

  const STYLE_ID = 'rp-replay-safari-pseudo-fullscreen-fill';
  const PSEUDO = 'rp-career-replay-pseudo-fullscreen';
  const PSEUDO_OPEN = 'rp-career-replay-pseudo-fullscreen-open';

  function installFillStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${PSEUDO_OPEN},
      body.${PSEUDO_OPEN}{
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
        background:#000!important;
      }
      .rp-career-replay-stage.${PSEUDO}{
        position:fixed!important;
        top:var(--rp-replay-vtop,0px)!important;
        left:var(--rp-replay-vleft,0px)!important;
        right:auto!important;
        bottom:auto!important;
        width:var(--rp-replay-vw,100vw)!important;
        height:var(--rp-replay-vh,100dvh)!important;
        max-width:none!important;
        max-height:none!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        aspect-ratio:auto!important;
        overflow:hidden!important;
        background:#000!important;
        transform:none!important;
        box-shadow:none!important;
      }
      .rp-career-replay-stage.${PSEUDO} [data-rp-career-replay-media]{
        position:absolute!important;
        inset:0!important;
        width:100%!important;
        height:100%!important;
        max-width:none!important;
        max-height:none!important;
        overflow:hidden!important;
        background:#000!important;
      }
      .rp-career-replay-stage.${PSEUDO} [data-rp-career-replay-media] > div,
      .rp-career-replay-stage.${PSEUDO} .rp-career-replay-yt-host{
        position:absolute!important;
        inset:0!important;
        width:100%!important;
        height:100%!important;
        max-width:none!important;
        max-height:none!important;
        overflow:hidden!important;
        background:#000!important;
      }
      .rp-career-replay-stage.${PSEUDO} video{
        position:absolute!important;
        inset:0!important;
        width:100%!important;
        height:100%!important;
        max-width:none!important;
        max-height:none!important;
        object-fit:cover!important;
        object-position:center center!important;
        transform:none!important;
        background:#000!important;
      }
      .rp-career-replay-stage.${PSEUDO} iframe{
        position:absolute!important;
        top:50%!important;
        left:50%!important;
        right:auto!important;
        bottom:auto!important;
        width:var(--rp-replay-cover-w,100%)!important;
        height:var(--rp-replay-cover-h,100%)!important;
        min-width:0!important;
        min-height:0!important;
        max-width:none!important;
        max-height:none!important;
        margin:0!important;
        transform:translate(-50%,-50%)!important;
        border:0!important;
        background:#000!important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncReplayViewport() {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const offsetLeft = Math.max(0, Math.round(vv?.offsetLeft || 0));
    const offsetTop = Math.max(0, Math.round(vv?.offsetTop || 0));
    const ratio = 16 / 9;
    let coverWidth = width;
    let coverHeight = height;

    if (width / height >= ratio) {
      coverWidth = width;
      coverHeight = Math.ceil(width / ratio);
    } else {
      coverHeight = height;
      coverWidth = Math.ceil(height * ratio);
    }

    const root = document.documentElement;
    root.style.setProperty('--rp-replay-vw', `${width}px`);
    root.style.setProperty('--rp-replay-vh', `${height}px`);
    root.style.setProperty('--rp-replay-vleft', `${offsetLeft}px`);
    root.style.setProperty('--rp-replay-vtop', `${offsetTop}px`);
    root.style.setProperty('--rp-replay-cover-w', `${coverWidth}px`);
    root.style.setProperty('--rp-replay-cover-h', `${coverHeight}px`);
  }

  installFillStyles();
  syncReplayViewport();

  window.addEventListener('resize', syncReplayViewport, { passive: true });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(syncReplayViewport, 60);
    window.setTimeout(syncReplayViewport, 240);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', syncReplayViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncReplayViewport, { passive: true });
})();
