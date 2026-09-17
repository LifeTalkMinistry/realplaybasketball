(() => {
  if (window.__realPlayAdminLiveRefreshFixInstalled) return;
  window.__realPlayAdminLiveRefreshFixInstalled = true;

  // LIVE-scoring refresh behavior is retired. This file remains in the global
  // enhancement loader, so use it as a lightweight compatibility guard for the
  // old backend placeholder that could exist before an admin actually opened a
  // Career session.

  let rootObserver = null;
  let bootObserver = null;
  let queued = false;

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function queueScrub() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      scrubPhantomSession();
    });
  }

  function isUntouchedLegacyPlaceholder(card) {
    if (!card) return false;

    const title = normalize(card.querySelector('.rp-admin-card-head strong')?.textContent);
    if (title !== 'CAREER SESSION') return false;

    const values = [...card.querySelectorAll('.rp-admin-meta em')].map((item) => normalize(item.textContent));
    if (values.length < 3) return false;

    const [date, court, players] = values;
    const zeroPlayers = /^0(?:\s*\/\s*\d+)?\s+CONFIRMED$/.test(players);

    return date === 'NOT SET' && court === 'NOT SET' && zeroPlayers;
  }

  function scrubPhantomSession() {
    const root = document.querySelector('.rp-admin-control');
    if (!root) return;

    let removed = false;
    for (const card of root.querySelectorAll('.rp-admin-session-summary')) {
      if (!isUntouchedLegacyPlaceholder(card)) continue;
      card.remove();
      removed = true;
    }

    if (!removed) return;

    const toggle = root.querySelector('[data-admin-new-session-toggle]');
    if (toggle && /OPEN NEXT SESSION/i.test(toggle.textContent || '')) {
      toggle.textContent = '+ OPEN SESSION';
    }
  }

  function watchAdminRoot() {
    const root = document.querySelector('.rp-admin-control');
    if (!root || rootObserver) return false;

    rootObserver = new MutationObserver(queueScrub);
    rootObserver.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    queueScrub();
    return true;
  }

  if (!watchAdminRoot()) {
    bootObserver = new MutationObserver(() => {
      if (!watchAdminRoot()) return;
      bootObserver?.disconnect();
      bootObserver = null;
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // admin-game-control-simplify.js performs its compact-card conversion on the
  // next animation frame after this event. Queue two frames so the guard always
  // evaluates the final compact DOM rather than racing the simplifier.
  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(queueScrub));
  });

  // Keep Home-card editing in its own module. This compatibility layer is
  // already loaded globally, so it is also a stable lightweight bootstrap point
  // without forcing the full Game Control bundle onto normal Home visitors.
  if (!window.__realPlayHomeOpenRankAdminEditInstalled
      && ![...document.scripts].some((script) => String(script.src || '').includes('home-open-rank-admin-edit.js'))) {
    const script = document.createElement('script');
    script.src = 'home-open-rank-admin-edit.js?v=20260915-home-open-rank-admin-v1';
    script.async = false;
    script.onerror = () => console.error('[Real Play] Home Open Ranking admin editor failed to load.');
    document.head.appendChild(script);
  }
})();

/*
 * OPEN RANK PLAYER-CAP AUTHORITY
 *
 * The commissioner-controlled PLAYER CAP on the Home Open Rank card is the
 * display authority for the secured-spots denominator. The access API can lag
 * behind that admin setting on an already-created session, so never degrade to
 * "04 SECURED" when the commissioner has explicitly set a cap such as 16.
 *
 * The first cap players share one capacity pool, regardless of whether their
 * entry is Token, GCash, Cash, or Free Standby. Only players beyond that cap are
 * counted as overflow standby.
 */
(() => {
  if (window.__realPlayRankingPlayerCapAuthorityInstalled) return;
  window.__realPlayRankingPlayerCapAuthorityInstalled = true;

  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const REMOTE_REFRESH_MS = 15000;
  let remoteCapacity = null;
  let remoteCheckedAt = 0;
  let remoteLoading = false;
  let applyQueued = false;

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  function pad(value) {
    return String(number(value)).padStart(2, '0');
  }

  function parsePlayerCap(value) {
    const text = String(value || '').toUpperCase();
    const playerCapMatch = text.match(/\b(\d{1,3})\s+PLAYER\s+CAP\b/);
    const simpleMatch = text.match(/\b(\d{1,3})\b/);
    const parsed = Number(playerCapMatch?.[1] ?? simpleMatch?.[1]);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500 ? parsed : null;
  }

  function domCapacity() {
    const node = document.querySelector('[data-rp-home-open-rank-capacity]');
    return parsePlayerCap(node?.textContent);
  }

  function currentCapacity() {
    return domCapacity() ?? remoteCapacity;
  }

  function breakdownCount(selector) {
    return number(document.querySelector(selector)?.textContent);
  }

  function applyCapacityAuthority() {
    applyQueued = false;

    const view = document.querySelector('[data-rp-ranking-games]');
    const totalNode = view?.querySelector('[data-rp-ranking-access-total]');
    const capacity = currentCapacity();
    if (!view || !totalNode || !capacity) return;

    const token = breakdownCount('[data-rp-ranking-access-token]');
    const gcash = breakdownCount('[data-rp-ranking-access-gcash]');
    const cash = breakdownCount('[data-rp-ranking-access-cash]');
    const standby = breakdownCount('[data-rp-ranking-access-standby]');
    const totalPlayers = token + gcash + cash + standby;
    const insideCap = Math.min(totalPlayers, capacity);
    const overflowStandby = Math.max(totalPlayers - capacity, 0);
    const next = `${pad(insideCap)}/${pad(capacity)} SECURED${overflowStandby > 0 ? ` · ${pad(overflowStandby)} STANDBY` : ''}`;

    if (totalNode.textContent !== next) totalNode.textContent = next;
  }

  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    window.queueMicrotask(applyCapacityAuthority);
  }

  function isCommissionerCapUpdate(item) {
    if (!item || String(item.category || '').toLowerCase() !== 'schedule') return false;
    if (item.source_key || item.sourceKey) return false;
    if (!parsePlayerCap(item.body)) return false;
    const eventAt = Date.parse(item.event_at || item.eventAt || '');
    return Number.isFinite(eventAt) && eventAt >= Date.now() - 60000;
  }

  async function refreshRemoteCapacity(force = false) {
    const now = Date.now();
    if (remoteLoading || (!force && now - remoteCheckedAt < REMOTE_REFRESH_MS)) return;
    remoteLoading = true;
    remoteCheckedAt = now;

    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const latest = updates
        .filter(isCommissionerCapUpdate)
        .sort((left, right) => new Date(right.published_at || 0) - new Date(left.published_at || 0))[0];
      const parsed = parsePlayerCap(latest?.body);
      if (parsed) remoteCapacity = parsed;
    } catch (_error) {
      // DOM authority remains available when the public feed is temporarily unavailable.
    } finally {
      remoteLoading = false;
      queueApply();
    }
  }

  const observer = new MutationObserver(() => {
    queueApply();
    refreshRemoteCapacity();
  });
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  window.addEventListener('realplay:ranking-session-changed', () => {
    refreshRemoteCapacity(true);
    queueApply();
  });
  window.addEventListener('focus', () => {
    refreshRemoteCapacity();
    queueApply();
  });

  refreshRemoteCapacity(true);
  queueApply();
})();
