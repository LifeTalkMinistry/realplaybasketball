(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const hydrationRequests = new Map();

  function sessionIdFromCard(card) {
    const id = String(card?.dataset.updateId || '');
    const match = id.match(/^career-(\d+)-result$/);
    const sessionId = Number(match?.[1] || 0);
    return Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : 0;
  }

  function openReplay(sessionId) {
    const bridge = document.createElement('button');
    bridge.type = 'button';
    bridge.hidden = true;
    bridge.dataset.rpCareerReplaySession = String(sessionId);
    document.body.appendChild(bridge);
    bridge.click();
    setTimeout(() => bridge.remove(), 0);
  }

  function ensureOverallMvpStyles() {
    if (document.getElementById('rp-results-overall-mvp-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-results-overall-mvp-authority-style';
    style.textContent = '.rp-update-mvp[data-rp-overall-mvp-pending="true"]{display:none!important}';
    document.head.appendChild(style);
  }

  function setOverallMvp(card, name) {
    if (!card || !name) return;
    let block = card.querySelector('.rp-update-mvp');
    if (!block) {
      const score = card.querySelector('.rp-update-score');
      if (!score) return;
      block = document.createElement('div');
      block.className = 'rp-update-mvp';
      block.innerHTML = '<span>GAME MVP</span><strong></strong>';
      score.insertAdjacentElement('afterend', block);
    }
    const nameNode = block.querySelector('strong');
    if (!nameNode) return;
    nameNode.textContent = name;
    block.dataset.rpOverallMvpPending = 'false';
    block.dataset.rpOverallMvpVerified = 'true';
    block.setAttribute('aria-label', `Overall MVP: ${name}`);
  }

  // One finalized game has one authoritative Game MVP. The backend builds the
  // official result metadata from the canonical Game MVP service, so result
  // cards must read that value instead of independently recalculating a winner
  // from replay stats in the browser.
  async function fetchOverallMvp(sessionId) {
    const response = await fetch(PUBLIC_UPDATES_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return '';

    const payload = await response.json().catch(() => ({}));
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    const result = updates.find((item) => (
      String(item?.category || '').toLowerCase() === 'result'
      && Number(item?.metadata?.sessionId || 0) === Number(sessionId)
    ));
    const mvp = result?.metadata?.gameMvp || null;
    return String(mvp?.playerName || mvp?.name || '').trim();
  }

  function hydrateCard(card) {
    if (!card || !card.isConnected) return;
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    ensureOverallMvpStyles();

    const block = card.querySelector('.rp-update-mvp');
    if (block?.dataset.rpOverallMvpVerified === 'true') return;
    if (block) block.dataset.rpOverallMvpPending = 'true';

    const existing = hydrationRequests.get(sessionId);
    const request = existing || fetchOverallMvp(sessionId);
    if (!existing) hydrationRequests.set(sessionId, request);

    request.then((name) => {
      if (name) setOverallMvp(card, name);
    }).catch(() => {
      // Never replace the official MVP with a browser-side guess. If official
      // result metadata cannot load, keep the MVP strip hidden until it can.
    }).finally(() => {
      if (!existing) hydrationRequests.delete(sessionId);
    });
  }

  function hydrateResultCards() {
    document.querySelectorAll('[data-rp-updates] .rp-update-card.rp-update-result[data-update-id]').forEach(hydrateCard);
  }

  function installOverallMvpAuthority() {
    ensureOverallMvpStyles();
    const observer = new MutationObserver(hydrateResultCards);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    hydrateResultCards();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-update-delete]')) return;
    const card = event.target.closest('.rp-update-card.rp-update-result');
    if (!card) return;
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    event.preventDefault();
    openReplay(sessionId);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installOverallMvpAuthority, { once: true });
  } else {
    installOverallMvpAuthority();
  }
})();
