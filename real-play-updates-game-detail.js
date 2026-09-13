(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
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

  const num = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function shotSummary(player) {
    const made = num(player?.onePtMade) + num(player?.twoPtMade);
    const attempts = made + num(player?.onePtMiss) + num(player?.twoPtMiss);
    return { fgPct: attempts > 0 ? made / attempts : 0 };
  }

  // Same Overall MVP authority used by career-game-replay-stats.js.
  // Do not use the generic Updates metadata MVP field because that can be a
  // team-level MVP rather than the game's Overall MVP.
  function impactScore(player) {
    return num(player?.pts)
      + (num(player?.reb) * 1.2)
      + (num(player?.ast) * 1.5)
      + (num(player?.stl) * 2)
      + (num(player?.blk) * 2)
      - (num(player?.tov) * 1.5)
      - (num(player?.foul) * 0.25);
  }

  function compareOverallMvp(a, b) {
    const impactDiff = impactScore(b) - impactScore(a);
    if (Math.abs(impactDiff) > 0.0001) return impactDiff;
    const aShot = shotSummary(a);
    const bShot = shotSummary(b);
    if (bShot.fgPct !== aShot.fgPct) return bShot.fgPct - aShot.fgPct;
    if (num(b?.pts) !== num(a?.pts)) return num(b?.pts) - num(a?.pts);
    if (num(a?.tov) !== num(b?.tov)) return num(a?.tov) - num(b?.tov);
    return String(a?.playerName || a?.player_name || '').localeCompare(String(b?.playerName || b?.player_name || ''));
  }

  function overallMvpName(payload) {
    const players = Array.isArray(payload?.playerStats) ? payload.playerStats : [];
    const valid = players.filter((player) => ['west', 'east'].includes(String(player?.team || '').toLowerCase()));
    if (!valid.length) return '';
    const winner = [...valid].sort(compareOverallMvp)[0];
    return String(winner?.playerName || winner?.player_name || '').trim();
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

  async function fetchOverallMvp(sessionId) {
    const accessToken = localStorage.getItem(TOKEN_KEY) || '';
    const hasRealToken = Boolean(accessToken && accessToken !== '__REAL_PLAY_VISITOR_REPLAY__');
    const url = hasRealToken
      ? `${API_BASE_URL}/api/real-play/career/games/${sessionId}/replay`
      : `${API_BASE_URL}/api/real-play/public/career/games/${sessionId}/replay`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...(hasRealToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      cache: 'no-store',
    });
    if (!response.ok) return '';
    const payload = await response.json().catch(() => ({}));
    return overallMvpName(payload);
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
      // Never fall back to the generic/team-MVP metadata. If the authoritative
      // replay calculation cannot be loaded, the MVP strip stays hidden.
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
