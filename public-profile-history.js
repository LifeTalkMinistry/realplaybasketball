(() => {
  if (window.__realPlayPublicProfileHistoryInstalled) return;
  window.__realPlayPublicProfileHistoryInstalled = true;

  const API = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const PREVIEW_LIMIT = 3;

  let archive = null;
  let sourceProfile = null;
  let sourcePlayerId = null;
  let sourcePlayerName = 'PLAYER';
  let allGames = [];
  let resultFilter = 'all';
  let modeFilter = 'all';
  let loading = false;

  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function visitorActive() {
    return !token() && localStorage.getItem(VISITOR_KEY) === '1';
  }

  function publicProfileFor(node) {
    return node?.closest?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]') || null;
  }

  function playerIdFromProfile(profile) {
    if (!profile) return null;

    const direct = positiveId(profile.dataset?.rpPublicPlayerId);
    if (direct) return direct;

    // Authenticated public profiles retain the loaded player object on the panel.
    // Use userId as the account profile id when playerId is not present.
    const loaded = profile.__realPlayPublicPlayer || null;
    const loadedId = positiveId(loaded?.playerId ?? loaded?.userId ?? loaded?.accountUserId);
    if (loadedId) {
      profile.dataset.rpPublicPlayerId = String(loadedId);
      return loadedId;
    }

    // Visitor/manual profiles expose an RP-xxxxx identity in the header.
    const publicId = String(profile.querySelector('.rp-profile-identity-line b')?.textContent || '').trim();
    const match = publicId.match(/\bRP-0*(\d+)\b/i);
    return positiveId(match?.[1]);
  }

  function playerNameFromProfile(profile) {
    return String(profile?.querySelector('.rp-profile-name h1')?.textContent || 'PLAYER').trim().toUpperCase() || 'PLAYER';
  }

  function modeKey(game) {
    const mode = String(pick(game?.mode, game?.gameMode, game?.game_mode, 'ranking')).trim().toLowerCase();
    if (['ranking', 'open-rank', 'open_rank', 'open rank'].includes(mode)) return 'open-rank';
    if (['3v3', 'three-v-three', 'three_v_three'].includes(mode)) return '3v3';
    if (['5v5', 'five-v-five', 'full-court', 'full_court'].includes(mode)) return '5v5';
    return mode || 'other';
  }

  function modeLabel(mode) {
    if (mode === 'open-rank') return 'OPEN RANK';
    if (mode === '3v3') return '3V3';
    if (mode === '5v5') return '5V5 / FULL COURT';
    return String(mode).replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase();
  }

  function sessionId(game) {
    return positiveId(pick(game?.sessionId, game?.session_id, game?.id));
  }

  function resultOf(game) {
    return String(game?.result || 'FINAL').toUpperCase();
  }

  function side(game, key) {
    return String((game?.teamLabels || game?.team_labels || {})[key] || key).toUpperCase();
  }

  function score(game, key) {
    return num(key === 'east' ? pick(game?.eastScore, game?.east_score) : pick(game?.westScore, game?.west_score));
  }

  function labelOf(game) {
    if (game?.displayLabel || game?.officialGameId || game?.official_game_id) {
      return String(game.displayLabel || game.officialGameId || game.official_game_id);
    }
    const openRankNumber = Number(pick(game?.openRankNumber, game?.open_rank_number));
    if (openRankNumber > 0) return `OPEN RANK #${String(openRankNumber).padStart(3, '0')}`;
    return String(game?.label || game?.title || `OFFICIAL GAME #${sessionId(game) || ''}`);
  }

  function dateOf(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function installStyles() {
    if (document.querySelector('[data-rp-public-history-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpPublicHistoryStyle = '1';
    style.textContent = `
      .rp-public-player-profile .rp-profile-history>.rp-profile-game[data-rp-public-preview-hidden="1"]{display:none!important}
      .rp-public-player-profile .rp-history-more{width:100%;min-height:46px;margin-top:2px;border:1px solid rgba(55,202,255,.22);border-radius:13px;color:#54d9ff;background:rgba(13,78,119,.09);font-family:var(--rp-display,Impact,sans-serif);font-size:.56rem;font-weight:950;letter-spacing:.09em;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function syncPublicPreview(profile) {
    if (!profile?.matches?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]')) return;
    const history = profile.querySelector('.rp-profile-history');
    if (!history) return;

    const cards = [...history.querySelectorAll(':scope > .rp-profile-game')];
    cards.forEach((card, index) => {
      if (index >= PREVIEW_LIMIT) card.dataset.rpPublicPreviewHidden = '1';
      else delete card.dataset.rpPublicPreviewHidden;
    });

    let more = history.querySelector(':scope > [data-rp-public-history-more]');
    if (cards.length > PREVIEW_LIMIT) {
      if (!more) {
        more = document.createElement('button');
        more.type = 'button';
        more.className = 'rp-history-more';
        more.dataset.rpPublicHistoryMore = '1';
        more.textContent = 'SEE ALL GAMES  →';
        history.appendChild(more);
      }
    } else {
      more?.remove();
    }
  }

  function syncAllPublicPreviews(root = document) {
    if (root.matches?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]')) {
      syncPublicPreview(root);
    }
    root.querySelectorAll?.('.rp-public-player-profile, [data-rp-public-profile], [data-rp-visitor-public-profile]')
      .forEach(syncPublicPreview);
  }

  function makeArchive() {
    if (archive) return archive;
    archive = document.createElement('section');
    archive.className = 'rp-history-overlay';
    archive.dataset.rpPublicHistoryOverlay = '1';
    archive.setAttribute('aria-hidden', 'true');
    archive.innerHTML = `
      <div class="rp-history-shell">
        <header class="rp-history-head">
          <button class="rp-history-back" type="button" data-rp-public-history-close>←</button>
          <div><strong>GAME HISTORY</strong><span data-rp-public-history-player>PLAYER · REAL PLAY RECORD</span></div>
          <b class="rp-history-count" data-rp-public-history-count>0 GAMES</b>
        </header>
        <div class="rp-history-filters">
          <div class="rp-history-results">
            <button class="rp-history-filter active" type="button" data-rp-public-result="all">ALL</button>
            <button class="rp-history-filter" type="button" data-rp-public-result="win">WINS</button>
            <button class="rp-history-filter" type="button" data-rp-public-result="loss">LOSSES</button>
          </div>
          <select class="rp-history-mode" data-rp-public-mode><option value="all">ALL GAME TYPES</option></select>
        </div>
        <div class="rp-history-list rp-profile-history" data-rp-public-history-list></div>
      </div>`;
    document.body.appendChild(archive);

    archive.querySelector('[data-rp-public-history-close]')?.addEventListener('click', closeArchive);
    archive.querySelectorAll('[data-rp-public-result]').forEach((button) => {
      button.addEventListener('click', () => {
        resultFilter = button.dataset.rpPublicResult || 'all';
        archive.querySelectorAll('[data-rp-public-result]').forEach((item) => item.classList.toggle('active', item === button));
        renderArchive();
      });
    });
    archive.querySelector('[data-rp-public-mode]')?.addEventListener('change', (event) => {
      modeFilter = event.target.value || 'all';
      renderArchive();
    });
    return archive;
  }

  function gameMarkup(game) {
    const result = resultOf(game);
    const id = sessionId(game);
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const meta = [
      dateOf(pick(game?.finalizedAt, game?.finalized_at, game?.startsAt, game?.starts_at)),
      String(pick(game?.locationName, game?.location_name, '')).toUpperCase(),
      modeLabel(modeKey(game)),
    ].filter(Boolean).join(' · ');

    return `
      <details class="rp-profile-game"${id ? ` data-rp-profile-game-session="${id}"` : ''}>
        <summary class="rp-profile-game-summary">
          <div class="rp-profile-game-main"><strong>${esc(labelOf(game))}</strong><span>${esc(meta)}</span></div>
          <b class="${resultClass}">${esc(result)}</b>
          <div class="rp-profile-game-score">
            <span>${esc(side(game, 'east'))}</span><strong>${score(game, 'east')}</strong><i>—</i><strong>${score(game, 'west')}</strong><span>${esc(side(game, 'west'))}</span>
          </div>
          <div class="rp-profile-game-stats">
            <span>${num(pick(game?.pts, game?.points))} PTS</span>
            <span>${num(pick(game?.ast, game?.assists))} AST</span>
            <span>${num(pick(game?.reb, game?.rebounds))} REB</span>
            <span>${num(pick(game?.tov, game?.to, game?.turnovers))} TO</span>
          </div>
          <div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>›</b></div>
        </summary>
      </details>`;
  }

  function renderArchive(status = '') {
    const root = archive?.querySelector('[data-rp-public-history-list]');
    const count = archive?.querySelector('[data-rp-public-history-count]');
    if (!root || !count) return;

    if (status) {
      root.innerHTML = `<div class="rp-history-status">${esc(status)}</div>`;
      count.textContent = '…';
      return;
    }

    const games = allGames.filter((game) => {
      const resultMatches = resultFilter === 'all' || resultOf(game).toLowerCase() === resultFilter;
      const modeMatches = modeFilter === 'all' || modeKey(game) === modeFilter;
      return resultMatches && modeMatches;
    });

    count.textContent = `${games.length} GAME${games.length === 1 ? '' : 'S'}`;
    root.innerHTML = games.length
      ? games.map(gameMarkup).join('')
      : '<div class="rp-history-status">NO GAMES MATCH THIS FILTER.</div>';
  }

  async function loadFullHistory(playerId) {
    const auth = token();
    const visitor = visitorActive();
    if (!auth && !visitor) throw new Error('PLEASE SIGN IN TO REAL PLAY FIRST.');

    const response = await fetch(visitor ? `${API}/api/real-play/public/community` : `${API}/api/real-play/community`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ action: 'player_profile', playerId }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'COULD NOT LOAD GAME HISTORY.');
    return Array.isArray(data?.player?.recentGames)
      ? data.player.recentGames
      : Array.isArray(data?.player?.recent_games)
        ? data.player.recent_games
        : [];
  }

  async function openArchive(button) {
    if (loading) return;
    const profile = publicProfileFor(button);
    const playerId = playerIdFromProfile(profile);
    if (!profile || !playerId) return;

    sourceProfile = profile;
    sourcePlayerId = playerId;
    sourcePlayerName = playerNameFromProfile(profile);
    makeArchive();

    resultFilter = 'all';
    modeFilter = 'all';
    allGames = [];
    archive.querySelectorAll('[data-rp-public-result]').forEach((item) => {
      item.classList.toggle('active', item.dataset.rpPublicResult === 'all');
    });
    const playerLabel = archive.querySelector('[data-rp-public-history-player]');
    if (playerLabel) playerLabel.textContent = `${sourcePlayerName} · REAL PLAY RECORD`;
    archive.classList.add('open');
    archive.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-history-open');
    archive.scrollTop = 0;
    renderArchive('LOADING COMPLETE GAME HISTORY…');

    loading = true;
    try {
      allGames = await loadFullHistory(sourcePlayerId);
      const modes = [...new Set(allGames.map(modeKey))];
      const select = archive.querySelector('[data-rp-public-mode]');
      if (select) {
        select.innerHTML = '<option value="all">ALL GAME TYPES</option>'
          + modes.map((mode) => `<option value="${esc(mode)}">${esc(modeLabel(mode))}</option>`).join('');
        select.value = 'all';
      }
      renderArchive();
    } catch (error) {
      allGames = [];
      renderArchive(error.message || 'COULD NOT LOAD GAME HISTORY.');
    } finally {
      loading = false;
    }
  }

  function closeArchive() {
    if (!archive) return;
    archive.classList.remove('open');
    archive.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-history-open');
  }

  function closeSourceProfile() {
    const profile = sourceProfile?.classList?.contains('open')
      ? sourceProfile
      : document.querySelector('.rp-public-player-profile.open, [data-rp-public-profile].open, [data-rp-visitor-public-profile].open');
    if (!profile) return;
    const close = profile.querySelector('[data-rp-public-profile-close], [data-visitor-profile-close], [data-rp-player-profile-close], [data-rp-profile-close]');
    if (close) close.click();
    else {
      profile.classList.remove('open');
      profile.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-profile-open');
    }
  }

  function openReplay(id) {
    if (!positiveId(id)) return;
    closeArchive();
    closeSourceProfile();
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.rpCareerReplaySession = String(id);
    document.body.appendChild(proxy);
    requestAnimationFrame(() => {
      proxy.click();
      setTimeout(() => proxy.remove(), 0);
    });
  }

  document.addEventListener('click', (event) => {
    const more = event.target.closest('[data-rp-public-history-more]');
    if (more) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openArchive(more);
      return;
    }

    const card = archive?.classList.contains('open')
      ? event.target.closest('[data-rp-public-history-list] .rp-profile-game')
      : null;
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = positiveId(card.dataset.rpProfileGameSession);
    if (id) openReplay(id);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !archive?.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeArchive();
  }, true);

  installStyles();
  syncAllPublicPreviews();

  new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1))) return;
    requestAnimationFrame(() => syncAllPublicPreviews());
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
