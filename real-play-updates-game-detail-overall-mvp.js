(() => {
  if (window.__realPlayUpdatesOverallMvpInstalled) return;
  window.__realPlayUpdatesOverallMvpInstalled = true;
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const requests = new Map();

  const num = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function sessionIdFromCard(card) {
    const match = String(card?.dataset.updateId || '').match(/^career-(\d+)-result$/);
    const id = Number(match?.[1] || 0);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  }

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

  function ensureStyles() {
    if (document.getElementById('rp-results-overall-mvp-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-results-overall-mvp-authority-style';
    style.textContent = '.rp-update-mvp[data-rp-overall-mvp-pending="true"]{display:none!important}';
    document.head.appendChild(style);
  }

  function setMvp(card, name) {
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
    block.querySelector('strong').textContent = name;
    block.dataset.rpOverallMvpPending = 'false';
    block.dataset.rpOverallMvpVerified = 'true';
    block.setAttribute('aria-label', `Overall MVP: ${name}`);
  }

  async function fetchOverallMvp(sessionId) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return '';
    const response = await fetch(`${API_BASE_URL}/api/real-play/career/games/${sessionId}/replay`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return '';
    return overallMvpName(await response.json().catch(() => ({})));
  }

  function hydrateCard(card) {
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    ensureStyles();
    const block = card.querySelector('.rp-update-mvp');
    if (block?.dataset.rpOverallMvpVerified === 'true') return;
    if (block) block.dataset.rpOverallMvpPending = 'true';

    const request = requests.get(sessionId) || fetchOverallMvp(sessionId);
    if (!requests.has(sessionId)) requests.set(sessionId, request);
    request.then((name) => {
      if (name) setMvp(card, name);
    }).catch(() => {
      // Keep the team/generic MVP hidden when Overall MVP authority cannot be verified.
    }).finally(() => {
      if (requests.get(sessionId) === request) requests.delete(sessionId);
    });
  }

  function hydrateAll() {
    document.querySelectorAll('[data-rp-updates] .rp-update-card.rp-update-result[data-update-id]').forEach(hydrateCard);
  }

  function install() {
    ensureStyles();
    const observer = new MutationObserver(hydrateAll);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    hydrateAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
