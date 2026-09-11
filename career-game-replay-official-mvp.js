(() => {
  if (window.__realPlayReplayOfficialMvpInstalled) return;
  window.__realPlayReplayOfficialMvpInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const replayPayloads = new Map();
  const originalFetch = window.fetch.bind(window);
  let activePayload = null;

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function sessionIdFromUrl(value) {
    try {
      const url = new URL(typeof value === 'string' ? value : value?.url || '', location.href);
      const match = url.pathname.match(/\/api\/real-play\/career\/games\/(\d+)\/replay$/i);
      return match ? Number(match[1]) : 0;
    } catch (_) {
      return 0;
    }
  }

  function playerMatchesMvp(player, mvp) {
    if (!player || !mvp) return false;
    const playerId = Number(player.playerId ?? player.player_id ?? player.userId ?? player.user_id ?? 0);
    const mvpId = Number(mvp.playerId ?? mvp.player_id ?? mvp.userId ?? mvp.user_id ?? 0);
    if (Number.isFinite(playerId) && playerId !== 0 && Number.isFinite(mvpId) && mvpId !== 0) {
      return playerId === mvpId;
    }
    return normalizeName(player.playerName ?? player.player_name) === normalizeName(mvp.name ?? mvp.playerName ?? mvp.player_name);
  }

  function removeOldOverallMvp(section) {
    section.querySelectorAll('.rp-recognition-overall_mvp').forEach((badge) => {
      const wrapper = badge.closest('.rp-career-replay-recognition-badges');
      if (wrapper) wrapper.remove();
      else badge.remove();
    });
  }

  function officialBadgeHtml(mvp) {
    const rating = Number(mvp?.gameRating ?? mvp?.ovr);
    const ratingLabel = Number.isFinite(rating) ? ` · ${Math.round(rating)} OVR` : '';
    return `<span class="rp-career-replay-recognition-badges" aria-label="Official Overall MVP">
      <span class="rp-career-replay-recognition-badge rp-recognition-overall_mvp rp-official-game-mvp-badge" data-rp-official-game-mvp title="OVERALL MVP${ratingLabel}">👑</span>
    </span>`;
  }

  function applyOfficialMvp(payload, attempt = 0) {
    const sessionId = Number(payload?.game?.sessionId || 0);
    const mvp = payload?.gameMvp || payload?.game_mvp || null;
    if (!sessionId || !mvp) return;

    const viewer = document.querySelector('[data-rp-career-replay].open');
    const section = viewer?.querySelector('[data-rp-career-replay-stats]');
    if (!section) {
      if (attempt < 24) window.setTimeout(() => applyOfficialMvp(payload, attempt + 1), 125);
      return;
    }

    const stats = Array.isArray(payload?.playerStats) ? payload.playerStats : [];
    const index = stats.findIndex((player) => playerMatchesMvp(player, mvp));
    if (index < 0) return;

    const row = section.querySelector(`[data-rp-career-stat-player="${index}"]`);
    const identity = row?.querySelector('.rp-career-replay-stat-identity');
    if (!identity) {
      if (attempt < 24) window.setTimeout(() => applyOfficialMvp(payload, attempt + 1), 125);
      return;
    }

    removeOldOverallMvp(section);
    identity.querySelector('.rp-career-replay-recognition-badges')?.remove();
    identity.insertAdjacentHTML('beforeend', officialBadgeHtml(mvp));
    activePayload = payload;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function closeModal() {
    document.querySelector('[data-rp-official-mvp-modal]')?.remove();
  }

  function openModal() {
    const payload = activePayload;
    const mvp = payload?.gameMvp || payload?.game_mvp;
    const stats = Array.isArray(payload?.playerStats) ? payload.playerStats : [];
    const player = stats.find((item) => playerMatchesMvp(item, mvp));
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!mvp || !player || !viewer) return;

    closeModal();
    const gameRating = Number(mvp.gameRating ?? mvp.ovr);
    const modal = document.createElement('div');
    modal.className = 'rp-career-recognition-modal open';
    modal.dataset.rpOfficialMvpModal = '1';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Official Overall MVP details');
    modal.innerHTML = `
      <div class="rp-career-recognition-backdrop" data-rp-official-mvp-close></div>
      <section class="rp-career-recognition-card">
        <button type="button" class="rp-career-recognition-close" data-rp-official-mvp-close aria-label="Close MVP details">×</button>
        <div class="rp-career-recognition-icon">👑</div>
        <small>OFFICIAL GAME RECOGNITION</small>
        <h2>OVERALL MVP</h2>
        <h3>${esc(mvp.name || player.playerName || 'REAL PLAY PLAYER')}</h3>
        <p class="rp-career-recognition-headline">Highest Real Play Game Rating in this official game.</p>
        <p class="rp-career-recognition-copy">The Overall MVP uses the same contextual Game Rating authority shown in Game Results, so the replay page and result card cannot choose different MVPs.</p>
        <div class="rp-career-recognition-metrics">
          <span><b>${Number.isFinite(gameRating) ? Math.round(gameRating) : '—'}</b><small>GAME OVR</small></span>
          <span><b>${Number(player.pts || 0)}</b><small>PTS</small></span>
          <span><b>${Number(player.reb || 0)}</b><small>REB</small></span>
          <span><b>${Number(player.ast || 0)}</b><small>AST</small></span>
          <span><b>${Number(player.stl || 0)}</b><small>STL</small></span>
          <span><b>${Number(player.blk || 0)}</b><small>BLK</small></span>
        </div>
        <p class="rp-career-recognition-note">Official source: ${esc(mvp.ratingVersion || player.ratingVersion || 'Real Play OVR engine')}.</p>
      </section>`;
    viewer.appendChild(modal);
    modal.querySelector('[data-rp-official-mvp-close]')?.focus({ preventScroll: true });
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const sessionId = sessionIdFromUrl(args[0]);
    if (sessionId && response.ok) {
      response.clone().json().then((payload) => {
        const resolvedId = Number(payload?.game?.sessionId || sessionId);
        replayPayloads.set(resolvedId, payload);
        window.setTimeout(() => applyOfficialMvp(payload), 0);
      }).catch(() => {});
    }
    return response;
  };

  const observer = new MutationObserver(() => {
    const section = document.querySelector('[data-rp-career-replay].open [data-rp-career-replay-stats]');
    if (!section) return;
    const sessionId = Number(activePayload?.game?.sessionId || 0);
    if (sessionId && replayPayloads.has(sessionId)) applyOfficialMvp(replayPayloads.get(sessionId));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-rp-official-mvp-close]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeModal();
      return;
    }
    if (!event.target.closest?.('[data-rp-official-game-mvp]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openModal();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !document.querySelector('[data-rp-official-mvp-modal]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeModal();
  }, true);
})();