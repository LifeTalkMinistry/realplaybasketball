(() => {
  if (window.__realPlayThreeVThreeRefinementInstalled) return;
  window.__realPlayThreeVThreeRefinementInstalled = true;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function refine() {
    const view = document.querySelector('.rp-3v3-view');
    if (!view) return false;

    const fixedCard = view.querySelector('[data-rp-team-fixed-card]');
    const kicker = view.querySelector('[data-rp-fixed-kicker]');
    const badge = view.querySelector('[data-rp-fixed-badge]');
    const change = view.querySelector('[data-rp-team-change]');
    const action = view.querySelector('[data-rp-session-action]');

    if (fixedCard) {
      const official = fixedCard.classList.contains('official');
      setText(kicker, official ? 'YOUR OFFICIAL TEAM' : 'PREFERRED TEAM');
      setText(badge, official ? 'OFFICIAL TEAM' : 'FINAL TEAM ASSIGNMENT PENDING');
      if (!official) setText(change, 'CHANGE PREFERENCE');
    }

    if (action && action.textContent.trim() === 'SECURE SPOT') {
      setText(action, 'SECURE MY SPOT');
    }

    return true;
  }

  let queued = false;
  function queueRefine() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      refine();
    });
  }

  if (!refine()) {
    const mountObserver = new MutationObserver(() => {
      if (refine()) mountObserver.disconnect();
    });
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const viewObserver = new MutationObserver(queueRefine);
  const attachObserver = () => {
    const view = document.querySelector('.rp-3v3-view');
    if (!view || view.dataset.rpRefinementObserved === 'true') return false;
    view.dataset.rpRefinementObserved = 'true';
    viewObserver.observe(view, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'disabled'],
    });
    refine();
    return true;
  };

  if (!attachObserver()) {
    const observer = new MutationObserver(() => {
      if (attachObserver()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
