(() => {
  if (window.__realPlayReplayOfficialMvpInstalled) return;
  window.__realPlayReplayOfficialMvpInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const UPDATES_URL = `${API_BASE_URL}/api/real-play/updates`;
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const TOKEN_KEY = 'real_play_access_token';
  const RETRY_MS = 120;
  const MAX_RENDER_ATTEMPTS = 45;

  let activeSessionId = 0;
  let requestSequence = 0;
  let activeOfficialMvp = null;

  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const number = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function canonicalPlayerKey(mvp) {
    const identity = String(mvp?.identityKey || '').trim();
    const userMatch = identity.match(/^user:(\d+)$/i);
    if (userMatch) return `id:${userMatch[1]}`;
    const manualMatch = identity.match(/^manual:(\d+)$/i);
    if (manualMatch) return `id:-${manualMatch[1]}`;
    return '';
  }

  async function loadOfficialGameMvp(sessionId) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    let response;

    if (token) {
      response = await fetch(UPDATES_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'feed' }),
        cache: 'no-store',
      });
    } else {
      response = await fetch(PUBLIC_UPDATES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Official game result could not be loaded.');

    const updates = Array.isArray(data?.updates) ? data.updates : [];
    const result = updates.find((item) => {
      if (String(item?.category || '').toLowerCase() !== 'result') return false;
      return Number(item?.metadata?.sessionId || 0) === Number(sessionId);
    });

    return result?.metadata?.gameMvp || null;
  }

  function removeRenderedOverallMvp(root) {
    root.querySelectorAll('[data-rp-career-recognition="overall_mvp"]').forEach((badge) => {
      const wrap = badge.closest('.rp-career-replay-recognition-badges');
      if (wrap && wrap.children.length <= 1) wrap.remove();
      else badge.remove();
    });
    root.querySelectorAll('[data-rp-official-game-mvp]').forEach((badge) => {
      const wrap = badge.closest('.rp-career-replay-recognition-badges');
      if (wrap && wrap.children.length <= 1) wrap.remove();
      else badge.remove();
    });
  }

  function findOfficialMvpRow(root, mvp) {
    const targetName = normalizeName(mvp?.playerName || mvp?.name);
    const targetTeam = String(mvp?.team || '').trim().toLowerCase();
    if (!targetName) return null;

    const rows = [...root.querySelectorAll('[data-rp-career-stat-player]')];
    return rows.find((row) => {
      const rowName = normalizeName(row.querySelector('.rp-career-replay-stat-player-name')?.textContent);
      if (!rowName || rowName !== targetName) return false;
      if (!targetTeam) return true;
      return String(row.closest('[data-rp-career-stat-panel]')?.dataset?.rpCareerStatPanel || '').toLowerCase() === targetTeam;
    }) || rows.find((row) => (
      normalizeName(row.querySelector('.rp-career-replay-stat-player-name')?.textContent) === targetName
    )) || null;
  }

  function renderOfficialBadge(row, mvp) {
    const identity = row.querySelector('.rp-career-replay-stat-identity');
    if (!identity) return false;

    // Overall MVP is a single finalized-game authority. Remove any locally
    // calculated highest-recognition badge from the official winner's row so
    // the crown is the one recognition shown there.
    identity.querySelector('.rp-career-replay-recognition-badges')?.remove();

    const wrap = document.createElement('span');
    wrap.className = 'rp-career-replay-recognition-badges';
    wrap.setAttribute('aria-label', 'Highest player recognition');

    const badge = document.createElement('span');
    badge.className = 'rp-career-replay-recognition-badge rp-recognition-overall_mvp';
    badge.dataset.rpOfficialGameMvp = '1';
    badge.dataset.rpOfficialMvpPlayer = canonicalPlayerKey(mvp);
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', `Overall MVP: ${mvp?.playerName || mvp?.name || 'player'}`);
    badge.title = 'OVERALL MVP';
    badge.textContent = '👑';

    wrap.appendChild(badge);
    identity.appendChild(wrap);
    return true;
  }

  function applyOfficialMvp(sessionId, mvp, attempt = 0) {
    if (Number(sessionId) !== activeSessionId || mvp !== activeOfficialMvp) return;
    const viewer = document.querySelector('[data-rp-career-replay].open');
    const stats = viewer?.querySelector('[data-rp-career-replay-stats]');
    if (!stats) {
      if (attempt < MAX_RENDER_ATTEMPTS) {
        window.setTimeout(() => applyOfficialMvp(sessionId, mvp, attempt + 1), RETRY_MS);
      }
      return;
    }

    const row = findOfficialMvpRow(stats, mvp);
    if (!row) {
      if (attempt < MAX_RENDER_ATTEMPTS) {
        window.setTimeout(() => applyOfficialMvp(sessionId, mvp, attempt + 1), RETRY_MS);
      }
      return;
    }

    removeRenderedOverallMvp(stats);
    renderOfficialBadge(row, mvp);
  }

  async function syncOfficialMvp(sessionId) {
    const id = Number(sessionId || 0);
    if (!Number.isSafeInteger(id) || id < 1) return;

    activeSessionId = id;
    activeOfficialMvp = null;
    const sequence = ++requestSequence;

    try {
      const mvp = await loadOfficialGameMvp(id);
      if (sequence !== requestSequence || activeSessionId !== id) return;
      if (!mvp) {
        console.warn('[Real Play] Finalized game did not return an official Game MVP.', { sessionId: id });
        return;
      }
      activeOfficialMvp = mvp;
      applyOfficialMvp(id, mvp);
    } catch (error) {
      if (sequence !== requestSequence || activeSessionId !== id) return;
      console.warn('[Real Play] Official replay MVP could not be synchronized.', error);
    }
  }

  function officialMvpModal(mvp) {
    document.querySelector('[data-rp-official-mvp-modal]')?.remove();
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer || !mvp) return;

    const made = number(mvp.madeShots);
    const missed = number(mvp.missedShots);
    const attempts = made + missed;
    const fg = attempts > 0 ? `${Math.round((made / attempts) * 100)}%` : '—';
    const modal = document.createElement('div');
    modal.className = 'rp-career-recognition-modal';
    modal.dataset.rpOfficialMvpModal = '1';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Overall MVP recognition details');
    modal.innerHTML = `
      <div class="rp-career-recognition-backdrop" data-rp-official-mvp-close></div>
      <section class="rp-career-recognition-card">
        <button type="button" class="rp-career-recognition-close" data-rp-official-mvp-close aria-label="Close recognition details">×</button>
        <div class="rp-career-recognition-icon">👑</div>
        <small>OFFICIAL GAME RECOGNITION</small>
        <h2>OVERALL MVP</h2>
        <h3>${String(mvp.playerName || mvp.name || 'REAL PLAY PLAYER').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</h3>
        <p class="rp-career-recognition-headline">Official finalized Game MVP.</p>
        <p class="rp-career-recognition-copy">This recognition is read from the same finalized Game MVP authority used by Game Results.</p>
        <div class="rp-career-recognition-metrics">
          <span><b>${number(mvp.points)}</b><small>PTS</small></span>
          <span><b>${number(mvp.rebounds)}</b><small>REB</small></span>
          <span><b>${number(mvp.assists)}</b><small>AST</small></span>
          <span><b>${number(mvp.steals)}</b><small>STL</small></span>
          <span><b>${number(mvp.blocks)}</b><small>BLK</small></span>
          <span><b>${fg}</b><small>FG%</small></span>
        </div>
      </section>`;
    viewer.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));
    modal.querySelector('[data-rp-official-mvp-close]')?.focus({ preventScroll: true });
  }

  document.addEventListener('click', (event) => {
    const replayButton = event.target.closest('[data-rp-career-replay-session]');
    if (replayButton) {
      const sessionId = Number(replayButton.dataset.rpCareerReplaySession || 0);
      if (Number.isSafeInteger(sessionId) && sessionId > 0) syncOfficialMvp(sessionId);
      return;
    }

    if (event.target.closest('[data-rp-official-mvp-close]')) {
      event.preventDefault();
      event.stopPropagation();
      document.querySelector('[data-rp-official-mvp-modal]')?.remove();
      return;
    }

    if (event.target.closest('[data-rp-official-game-mvp]')) {
      event.preventDefault();
      event.stopPropagation();
      officialMvpModal(activeOfficialMvp);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    const badge = event.target.closest?.('[data-rp-official-game-mvp]');
    if (!badge || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    officialMvpModal(activeOfficialMvp);
  });

  // Recorded Game Audit should behave as one continuous scroll surface.
  // The replay page itself already owns vertical scrolling; remove the sticky
  // header behavior so the back/title/admin row scrolls away with the score,
  // video, timeline, stats, and comments instead of remaining pinned above them.
  if (!document.getElementById('rp-career-replay-scrollable-header-fix')) {
    const scrollableHeaderStyle = document.createElement('style');
    scrollableHeaderStyle.id = 'rp-career-replay-scrollable-header-fix';
    scrollableHeaderStyle.textContent = `
      .rp-career-replay-topbar{
        position:relative!important;
        top:auto!important;
      }
    `;
    document.head.appendChild(scrollableHeaderStyle);
  }

  // iPhone replay coverage refinement.
  // IMPORTANT: this layer does NOT own, replace, or intercept the fullscreen
  // button. The existing fullscreen-back layer remains the sole click authority.
  // This script only resizes the media after pseudo-fullscreen is already active.
  if (!window.__realPlayReplaySafariCoverV3Requested) {
    window.__realPlayReplaySafariCoverV3Requested = true;
    const safariCover = document.createElement('script');
    safariCover.src = 'career-game-replay-safari-cover-v3.js?v=20260917-safari-cover-v3';
    safariCover.async = false;
    document.head.appendChild(safariCover);
  }

  // iPhone native fullscreen cannot display Real Play HTML overlays. Keep the
  // working native fullscreen button and provide a second GAME SKIPS control.
  // Tapping a basket reuses the official seven-second marker, then immediately
  // opens the selected play in the same native fullscreen path.
  if (!window.__realPlayIPhoneGameSkipsRequested) {
    window.__realPlayIPhoneGameSkipsRequested = true;
    const gameSkips = document.createElement('script');
    gameSkips.src = 'career-game-replay-iphone-game-skips.js?v=20260917-iphone-game-skips-v1';
    gameSkips.async = false;
    document.head.appendChild(gameSkips);
  }

  // Load the replay-admin bridge after the existing replay editor has installed.
  // This keeps the pencil responsive even when the heavy Admin/Game Control
  // bundle has not been opened yet in the current browser session.
  const loadBridge = () => {
    if (window.__realPlayReplayAdminEditBridgeInstalled) return;
    if (!window.__realPlayReplayAdminEditInstalled) {
      window.setTimeout(loadBridge, 120);
      return;
    }
    const script = document.createElement('script');
    script.src = 'career-game-replay-admin-edit-bridge.js?v=20260915-replay-edit-bridge-v1';
    script.async = false;
    document.head.appendChild(script);
  };
  loadBridge();
})();
