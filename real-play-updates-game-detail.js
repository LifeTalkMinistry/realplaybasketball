(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  let mvpRaceLeader = null;
  let mvpLoading = false;
  let mvpFetchedAt = 0;

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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderMvpRaceLeader() {
    const panel = document.querySelector('[data-rp-updates]');
    if (!panel) return;

    panel.querySelectorAll('.rp-update-card.rp-update-result').forEach((card) => {
      const score = card.querySelector('.rp-update-score');
      if (!score) return;

      let node = card.querySelector('.rp-update-mvp');
      if (!mvpRaceLeader?.playerName) {
        node?.remove();
        return;
      }

      if (!node) {
        node = document.createElement('div');
        node.className = 'rp-update-mvp';
        score.insertAdjacentElement('afterend', node);
      }

      const games = Number(mvpRaceLeader.games || 0);
      const label = mvpRaceLeader.eligible ? 'CURRENT MVP LEADER' : 'MVP RACE LEADER';
      const gameCopy = games > 0 ? ` · ${games} ${games === 1 ? 'GAME' : 'GAMES'}` : '';
      node.innerHTML = `<span>${label}</span><strong>${escapeHtml(mvpRaceLeader.playerName)}${gameCopy}</strong>`;
    });
  }

  async function refreshMvpRaceLeader({ force = false } = {}) {
    if (mvpLoading) return;
    if (!force && Date.now() - mvpFetchedAt < 15000) {
      renderMvpRaceLeader();
      return;
    }

    mvpLoading = true;
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data.updates) ? data.updates : [];
      const source = updates.find((item) => item?.category === 'result' && item?.metadata?.mvpRaceLeader?.playerName);
      mvpRaceLeader = source?.metadata?.mvpRaceLeader || null;
      mvpFetchedAt = Date.now();
      renderMvpRaceLeader();
    } catch (_error) {
      // Updates remains fully usable even if the MVP race receipt cannot refresh.
    } finally {
      mvpLoading = false;
    }
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

  const observer = new MutationObserver(() => {
    const panel = document.querySelector('[data-rp-updates]');
    if (!panel?.classList.contains('open')) return;
    renderMvpRaceLeader();
    refreshMvpRaceLeader();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('focus', () => {
    if (document.querySelector('[data-rp-updates].open')) refreshMvpRaceLeader({ force: true });
  });

  if (document.querySelector('[data-rp-updates].open')) refreshMvpRaceLeader({ force: true });
})();
