(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

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

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-update-delete]')) return;
    const card = event.target.closest('.rp-update-card.rp-update-result');
    if (!card) return;
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    event.preventDefault();
    openReplay(sessionId);
  });
})();
