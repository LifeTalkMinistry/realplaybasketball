(() => {
  if (window.__realPlayVisitorWorldPlayersInstalled) return;
  window.__realPlayVisitorWorldPlayersInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PROFILE_ART_REGISTRY_URL = 'assets/profile-art/registry.json';
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const isVisitor = () => Boolean(window.RealPlayVisitor?.isActive?.());

  let profilePanel = null;
  let loadingPlayers = false;
  let loadingProfile = false;
  let visitorArtRequest = 0;

  function world() {
    return document.querySelector('[data-rp-world]');
  }

  function ensureVisitorProfileStyles() {
    if (document.querySelector('[data-rp-visitor-profile-nav-fix]')) return;
    const style = document.createElement('style');
    style.dataset.rpVisitorProfileNavFix = 'true';
    style.textContent = `
      body.rp-simple-navigation-active [data-rp-visitor-public-profile] .rp-profile-topbar{display:none!important}
      body.rp-simple-navigation-active [data-rp-visitor-public-profile] .rp-profile-shell{
        padding-top:0!important;
        padding-bottom:calc(var(--rp-simple-nav-height,68px) + env(safe-area-inset-bottom) + 24px)!important;
      }
      body.rp-simple-navigation-active [data-rp-visitor-public-profile] .rp-profile-body{
        padding-top:14px!important;
        padding-bottom:calc(var(--rp-simple-nav-height,68px) + env(safe-area-inset-bottom) + 18px)!important;
      }
      body.rp-simple-navigation-active:has([data-rp-visitor-public-profile].open) [data-rp-simple-nav]{
        visibility:visible!important;
        pointer-events:auto!important;
        z-index:700!important;
      }
    `;
    document.head.appendChild(style);
  }

  function activatePlayersView() {
    const panel = world();
    if (!panel) return false;
    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.worldTab === 'players');
    });
    panel.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== 'players';
    });
    return true;
  }

  function syncBottomNavToPlayers() {
    const nav = document.querySelector('[data-rp-simple-nav]');
    if (!nav) return;
    nav.querySelectorAll('[data-rp-simple-nav-item]').forEach((button) => {
      const selected = button.dataset.rpSimpleNavItem === 'players';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function setStatus(message = '', type = '') {
    const node = world()?.querySelector('[data-world-player-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
  }

  async function loadPlayers() {
    if (loadingPlayers || !isVisitor()) return;
    loadingPlayers = true;
    setStatus('LOADING PLAYERS...');
    try {
      const data = await window.RealPlayWorld?.community?.('players');
      const players = Array.isArray(data?.players) ? data.players : [];
      const root = world()?.querySelector('[data-world-player-list]');
      const count = world()?.querySelector('[data-world-player-count]');
      if (count) count.textContent = `${players.length} PLAYER${players.length === 1 ? '' : 'S'}`;
      if (root) {
        root.innerHTML = players.length ? players.map((player) => {
          const jersey = player.playerNumber === null || player.playerNumber === undefined ? '#—' : `#${Number(player.playerNumber)}`;
          const rating = player.ovr === null || player.ovr === undefined
            ? '<span class="rp-world-player-ovr unranked">UNRANKED</span>'
            : `<span class="rp-world-player-ovr">${esc(player.ovr)} <small>OVR</small></span>`;
          return `<button type="button" class="rp-world-player-row" data-world-player-id="${esc(player.playerId || player.userId)}"><span class="rp-world-player-name"><strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong><b>${esc(jersey)}</b></span>${rating}</button>`;
        }).join('') : '<div class="rp-world-player-empty">NO REAL PLAY PLAYER PROFILES YET.</div>';
      }
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'Could not load players.', 'error');
    } finally {
      loadingPlayers = false;
    }
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date).toUpperCase();
  }

  function createProfilePanel() {
    if (profilePanel) return profilePanel;
    ensureVisitorProfileStyles();
    profilePanel = document.createElement('section');
    profilePanel.className = 'rp-profile rp-public-player-profile';
    profilePanel.dataset.rpVisitorPublicProfile = 'true';
    profilePanel.setAttribute('aria-hidden', 'true');
    // Public player profiles are a bottom-navigation drill-down. The permanent
    // app navigation is the chrome, so do not duplicate it with a PROFILE header.
    profilePanel.innerHTML = `<div class="rp-profile-shell"><main class="rp-profile-body"><p class="rp-profile-status" data-visitor-profile-status aria-live="polite"></p><div data-visitor-profile-content></div></main></div>`;
    document.body.appendChild(profilePanel);
    return profilePanel;
  }

  function closeProfile() {
    if (!profilePanel) return;
    visitorArtRequest += 1;
    const focused = document.activeElement;
    if (focused && profilePanel.contains(focused)) {
      try { focused.blur?.(); } catch (_error) {}
    }
    profilePanel.classList.remove('open');
    profilePanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-profile-open');
  }

  function publicPassLabel(player) {
    const rawTokens = pick(
      player?.playTokensAvailable,
      player?.play_tokens_available,
      player?.publicPass?.playTokensAvailable,
      player?.public_pass?.play_tokens_available
    );
    const parsedTokens = Number(rawTokens);
    const tokenCount = Number.isFinite(parsedTokens) ? Math.max(0, parsedTokens) : 0;
    const passHolder = player?.passHolder === true
      || player?.pass_holder === true
      || player?.publicPass?.passHolder === true
      || player?.public_pass?.pass_holder === true
      || tokenCount > 0;
    return passHolder ? `PASS HOLDER - TOKEN: ${tokenCount}` : 'PLAYER PROFILE';
  }

  function normalizeVisitorArt(raw) {
    if (!raw || typeof raw !== 'object' || !String(raw.src || '').trim()) return null;
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    return {
      src: String(raw.src || '').trim(),
      positionX: clamp(finite(raw.positionX ?? raw.position_x, 72), -50, 150),
      positionY: clamp(finite(raw.positionY ?? raw.position_y, 44), -50, 150),
      scale: clamp(finite(raw.scale, 1.15), 0.4, 4),
      opacity: clamp(finite(raw.opacity, 1), 0, 1),
      enabled: raw.enabled !== false,
    };
  }

  function resolveVisitorArtSrc(art) {
    const src = String(art?.src || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/api/')) return `${API_BASE_URL}${src}`;
    return src;
  }

  async function loadLegacyVisitorArt(accountUserId) {
    try {
      const response = await fetch(`${PROFILE_ART_REGISTRY_URL}?v=20260919-visitor-art-account-bridge-v1`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      const rows = Array.isArray(data?.players) ? data.players : [];
      const row = rows.find((candidate) => positiveId(candidate?.playerId ?? candidate?.player_id) === accountUserId);
      return normalizeVisitorArt(row);
    } catch (_error) {
      return null;
    }
  }

  async function renderVisitorProfileArt(player) {
    const requestId = ++visitorArtRequest;
    const panel = profilePanel;
    const hero = panel?.querySelector('.rp-profile-hero');
    if (!panel || !hero || !panel.classList.contains('open')) return;

    // Public directory identity uses the canonical/manual Player ID (RP-xxxxx),
    // while premium art is stored against the claimed Real Play account ID.
    // Use accountUserId only for artwork so replay/history keep their canonical ID.
    const accountUserId = positiveId(player?.accountUserId ?? player?.account_user_id);
    const existing = hero.querySelector('[data-rp-visitor-premium-profile-art]');
    if (!accountUserId) {
      existing?.remove();
      return;
    }

    let art = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/profile-art?playerId=${encodeURIComponent(accountUserId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (Object.prototype.hasOwnProperty.call(data, 'art') && data.art !== null) {
          art = normalizeVisitorArt(data.art);
        } else {
          art = await loadLegacyVisitorArt(accountUserId);
        }
      } else {
        art = await loadLegacyVisitorArt(accountUserId);
      }
    } catch (_error) {
      art = await loadLegacyVisitorArt(accountUserId);
    }

    if (requestId !== visitorArtRequest || !panel.classList.contains('open')) return;
    if (!art || art.enabled === false) {
      existing?.remove();
      return;
    }

    let layer = hero.querySelector('[data-rp-visitor-premium-profile-art]');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rp-premium-profile-art rp-visitor-premium-profile-art';
      layer.dataset.rpVisitorPremiumProfileArt = 'true';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<img alt="" draggable="false" /><span class="rp-premium-profile-art-atmosphere"></span>';
      hero.insertBefore(layer, hero.firstChild);
    }

    layer.style.setProperty('--rp-art-x', `${art.positionX}%`);
    layer.style.setProperty('--rp-art-y', `${art.positionY}%`);
    layer.style.setProperty('--rp-art-scale', String(art.scale));
    layer.style.setProperty('--rp-art-opacity', String(art.opacity));

    const image = layer.querySelector('img');
    const src = resolveVisitorArtSrc(art);
    if (!image || !src) return;
    layer.classList.remove('is-ready');
    image.onload = () => {
      if (requestId !== visitorArtRequest || !panel.classList.contains('open')) return;
      layer.classList.add('is-ready');
      panel.classList.add('has-rp-premium-profile-art');
    };
    image.onerror = () => {
      if (requestId !== visitorArtRequest) return;
      layer.classList.remove('is-ready');
    };
    image.src = src;
    if (image.complete && image.naturalWidth > 0) image.onload();
  }

  function renderProfile(player) {
    const root = profilePanel?.querySelector('[data-visitor-profile-content]');
    if (!root) return;
    const stats = player?.careerStats || {};
    const rating = player?.ovr === null || player?.ovr === undefined ? null : Number(player.ovr);
    const rank = player?.rank === null || player?.rank === undefined ? null : Number(player.rank);
    const jersey = player?.playerNumber === null || player?.playerNumber === undefined ? null : Number(player.playerNumber);
    const games = number(pick(stats.games, stats.gamesPlayed));
    const wins = number(stats.wins);
    const losses = number(stats.losses);
    const recent = Array.isArray(player?.recentGames) ? player.recentGames.slice(0, 4) : [];
    const passLabel = publicPassLabel(player);

    root.innerHTML = `
      <section class="rp-profile-hero">
        <div class="rp-profile-hero-glow" aria-hidden="true"></div>
        <div class="rp-profile-identity-line"><span>REAL PLAY PLAYER</span><b>${esc(passLabel)}</b></div>
        <div class="rp-profile-player"><div class="rp-profile-number"><small>PLAYER</small><strong>${jersey === null ? '#—' : `#${jersey}`}</strong></div><div class="rp-profile-name"><small>PUBLIC PROFILE</small><h1>${esc(player?.playerName || 'REAL PLAY PLAYER')}</h1><p>LESS SCREEN. REAL POINTS.</p></div></div>
        <div class="rp-profile-rating-row"><div class="rp-profile-ovr"><span>OVR</span><strong>${rating === null ? '—' : rating}</strong><small>${rating === null ? 'UNRANKED' : 'BETA RATING'}</small></div><div class="rp-profile-rank"><span>RANK</span><strong>${rank === null ? '—' : `#${rank}`}</strong><small>REAL PLAY</small></div><div class="rp-profile-record"><span>RECORD</span><strong>${wins}-${losses}</strong><small>${games} GAME${games === 1 ? '' : 'S'}</small></div></div>
      </section>
      <section class="rp-profile-section"><div class="rp-profile-section-head"><div><small>CAREER NUMBERS</small><h2>THE COURT KEEPS THE RECEIPTS.</h2></div><span>OFFICIAL GAMES ONLY</span></div><div class="rp-profile-stat-grid"><article><strong>${number(pick(stats.pts, stats.points))}</strong><span>PTS</span></article><article><strong>${number(pick(stats.ast, stats.assists))}</strong><span>AST</span></article><article><strong>${number(pick(stats.reb, stats.rebounds))}</strong><span>REB</span></article><article><strong>${number(pick(stats.to, stats.tov, stats.turnovers))}</strong><span>TO</span></article></div></section>
      <section class="rp-profile-section rp-profile-history"><div class="rp-profile-section-head"><div><small>RECENT HISTORY</small><h2>RECENT REAL PLAY.</h2></div><span>FINALIZED GAMES</span></div>${recent.length ? recent.map((game) => {
        const sessionId = positiveId(game?.sessionId ?? game?.session_id);
        const sessionAttr = sessionId ? ` data-rp-profile-game-session="${sessionId}"` : '';
        return `<article class="rp-profile-game"${sessionAttr}><div class="rp-profile-game-summary"><div class="rp-profile-game-main"><strong>${esc(game.displayLabel || game.title || game.label || 'OFFICIAL GAME')}</strong><span>${esc([formatDate(game.finalizedAt || game.startsAt), game.locationName].filter(Boolean).join(' · '))}</span></div><b class="${String(game.result || '').toLowerCase()}">${esc(game.result || 'FINAL')}</b><div class="rp-profile-game-stats"><span>${number(pick(game.pts, game.points))} PTS</span><span>${number(pick(game.ast, game.assists))} AST</span><span>${number(pick(game.reb, game.rebounds))} REB</span><span>${number(pick(game.tov, game.to, game.turnovers))} TO</span></div><div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>›</b></div></div></article>`;
      }).join('') : '<div class="rp-profile-no-games"><strong>NO OFFICIAL GAMES YET.</strong><p>This player’s verified game history will build here automatically.</p></div>'}</section>`;
  }

  async function openProfile(playerId) {
    if (loadingProfile || !isVisitor()) return;
    const requestedPlayerId = positiveId(playerId);
    if (!requestedPlayerId) return;

    createProfilePanel();
    // The replay linker must know which public player owns these cards. Visitor
    // row clicks are captured here before other listeners can see them, so keep
    // the identity directly on the profile panel instead of relying on click
    // propagation.
    profilePanel.dataset.rpPublicPlayerId = String(requestedPlayerId);
    profilePanel.__realPlayPublicPlayer = { playerId: requestedPlayerId };
    syncBottomNavToPlayers();
    profilePanel.classList.add('open');
    profilePanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-profile-open');
    profilePanel.scrollTop = 0;
    const status = profilePanel.querySelector('[data-visitor-profile-status]');
    const root = profilePanel.querySelector('[data-visitor-profile-content]');
    if (status) status.textContent = 'LOADING PLAYER PROFILE...';
    if (root) root.innerHTML = '';
    loadingProfile = true;
    try {
      const data = await window.RealPlayWorld?.community?.('player_profile', { playerId: requestedPlayerId });
      const player = data?.player || null;
      const loadedPlayerId = positiveId(player?.playerId ?? player?.userId) || requestedPlayerId;
      profilePanel.dataset.rpPublicPlayerId = String(loadedPlayerId);
      profilePanel.__realPlayPublicPlayer = player || { playerId: loadedPlayerId };
      renderProfile(player);
      window.dispatchEvent(new CustomEvent('realplay:public-profile-loaded', {
        detail: { playerId: loadedPlayerId, player },
      }));
      // The public/canonical Player ID and account ID are intentionally different
      // identity domains. Premium art is stored by account ID, so bridge only the
      // art lookup while preserving the canonical ID for history and replay.
      renderVisitorProfileArt(player);
      if (status) status.textContent = '';
    } catch (error) {
      if (status) status.textContent = error.message || 'Could not load this player profile.';
    } finally {
      loadingProfile = false;
    }
  }

  // Keep the public profile subordinate to the permanent bottom navigation.
  // A nav tap closes the drill-down first, then the normal navigation handler
  // continues and opens HOME / WORLD / PLAYERS / CHATS / ME as requested.
  document.addEventListener('click', (event) => {
    const navItem = event.target.closest?.('[data-rp-simple-nav-item]');
    if (navItem && profilePanel?.classList.contains('open')) {
      closeProfile();
      return;
    }

    if (!isVisitor()) return;
    const playersTab = event.target.closest('[data-world-tab="players"]');
    if (playersTab) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (activatePlayersView()) loadPlayers();
      return;
    }
    const row = event.target.closest('[data-world-player-id]');
    if (row) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const playerId = Number(row.dataset.worldPlayerId);
      if (Number.isSafeInteger(playerId) && playerId > 0) openProfile(playerId);
    }
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profilePanel?.classList.contains('open')) {
      event.stopImmediatePropagation();
      closeProfile();
    }
  }, true);

  window.RealPlayVisitorPublicProfile = {
    close: closeProfile,
    isOpen: () => Boolean(profilePanel?.classList.contains('open')),
  };
})();
