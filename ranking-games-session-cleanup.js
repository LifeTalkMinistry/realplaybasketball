(() => {
  if (window.__realPlayRankingSessionCleanupInstalled) return;
  window.__realPlayRankingSessionCleanupInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const style = document.createElement('style');
  style.dataset.rpRankingSectionCenter = 'true';
  style.textContent = `
    .rp-ranking-next .rp-ranking-section-head,
    .rp-ranking-rules .rp-ranking-section-head{
      position:relative;
      justify-content:center;
    }

    .rp-ranking-next .rp-ranking-section-head>div,
    .rp-ranking-rules .rp-ranking-section-head>div{
      width:100%;
      text-align:center;
    }

    .rp-ranking-next .rp-ranking-section-head h2,
    .rp-ranking-rules .rp-ranking-section-head h2{
      margin-left:auto!important;
      margin-right:auto!important;
      text-align:center!important;
    }

    /* Keep the optional reservation cancel action independent from the centered title. */
    .rp-ranking-next [data-rp-ranking-cancel]:not([hidden]){
      position:absolute;
      right:0;
      top:50%;
      transform:translateY(-50%);
    }

    /* Preserve the earlier cleanup request even if older cached markup is still mounted. */
    .rp-ranking-rules .rp-ranking-rule-row{
      display:none!important;
    }
  `;
  document.head.appendChild(style);

  const status = view.querySelector('[data-rp-ranking-session-status]');
  const title = view.querySelector('[data-rp-ranking-session-title]');
  if (!status || !title) return;

  function sync() {
    const statusText = String(status.textContent || '').trim().toUpperCase();
    const titleText = String(title.textContent || '').trim().toUpperCase();
    const hideStatus = statusText === 'RANKING GAME ANNOUNCED';

    // Session titles are operational/admin labels (for example,
    // "BETA CAREER SESSION #001"). Players only need the court, date,
    // time, capacity and reservation state. Keep the empty-state placeholder,
    // but never expose a posted session's internal title in the player view.
    const hideTitle = titleText !== 'TO BE ANNOUNCED';

    status.hidden = hideStatus;
    title.hidden = hideTitle;

    // ranking-games.css explicitly sets the session title to display:block,
    // which can visually override the browser's native [hidden] rule.
    // Apply the display state inline so internal session names stay hidden.
    if (hideTitle) {
      title.style.setProperty('display', 'none', 'important');
    } else {
      title.style.removeProperty('display');
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  observer.observe(title, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  sync();
})();

/*
 * A secured-player profile is a navigation destination, not another modal
 * stacked on top of Open Rank. Close Open Rank before its player-card click
 * handler opens the profile so the permanent app navigation remains visible.
 */
(() => {
  if (window.__realPlayRankingProfileNavigationInstalled) return;
  window.__realPlayRankingProfileNavigationInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const style = document.createElement('style');
  style.dataset.rpRankingProfileNavigation = 'true';
  style.textContent = `
    body.rp-simple-navigation-active .rp-public-player-profile{
      padding-bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom));
    }
    body.rp-simple-navigation-active .rp-public-player-profile .rp-profile-body{
      padding-bottom:calc(var(--rp-simple-nav-height) + env(safe-area-inset-bottom) + 18px)!important;
    }
  `;
  document.head.appendChild(style);

  // The permanent nav was originally mounted inside [data-rp-app]. That app
  // creates its own visual/stacking context, so full-screen profile surfaces can
  // cover the nav even when the nav itself has a higher z-index. Promote the nav
  // to <body> so it is a true viewport-level sibling of profiles and can remain
  // permanently visible everywhere the simple navigation system allows it.
  function promotePermanentNav() {
    const bar = document.querySelector('[data-rp-simple-nav]');
    if (!bar) return false;
    if (bar.parentElement !== document.body) document.body.appendChild(bar);
    return true;
  }

  if (!promotePermanentNav()) {
    const navObserver = new MutationObserver(() => {
      if (promotePermanentNav()) navObserver.disconnect();
    });
    navObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function closeOpenRank() {
    if (!view.classList.contains('open')) return;

    if (window.RealPlayRankingGames?.close) {
      window.RealPlayRankingGames.close();
      return;
    }

    // Defensive fallback if the Open Rank controller is still initializing.
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-ranking-open');
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-rp-ranking-secured] .rp-ranking-secured-player');
    if (!card || !view.classList.contains('open')) return;

    const isYou = card.classList.contains('is-you')
      || Boolean(card.querySelector('.rp-ranking-secured-you'));

    promotePermanentNav();
    closeOpenRank();

    // For the logged-in player's own card, use the permanent ME navigation
    // route so its active state and profile lifecycle stay in sync.
    if (isYou) {
      const meButton = document.querySelector('[data-rp-simple-nav-item="me"]');
      if (meButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.setTimeout(() => meButton.click(), 0);
      }
    }
  }, true);
})();

/*
 * NEXT RANKING GAME capacity badge.
 * Prefer the combined session-capacity summary so secured + standby players
 * share the same first-16 pool. Fall back to the secured roster during startup.
 */
(() => {
  if (window.__realPlayRankingCapacityBadgeInstalled) return;
  window.__realPlayRankingCapacityBadgeInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  const head = view?.querySelector('.rp-ranking-next .rp-ranking-section-head');
  if (!view || !head) return;

  const style = document.createElement('style');
  style.dataset.rpRankingCapacityBadge = 'true';
  style.textContent = `
    .rp-ranking-next .rp-ranking-capacity-badge{
      position:absolute;
      left:0;
      top:50%;
      z-index:2;
      min-width:50px;
      height:38px;
      padding:5px 8px 4px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      box-sizing:border-box;
      border:1px solid rgba(66,217,255,.30);
      border-radius:12px;
      background:linear-gradient(180deg,rgba(6,24,36,.96),rgba(3,12,20,.96));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 7px 18px rgba(0,0,0,.22);
      transform:translateY(-50%);
      pointer-events:none;
    }
    .rp-ranking-next .rp-ranking-capacity-badge[hidden]{display:none!important}
    .rp-ranking-next .rp-ranking-capacity-badge small{
      margin:0 0 3px!important;
      color:#667f95!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.31rem!important;
      font-style:normal!important;
      font-weight:950!important;
      letter-spacing:.13em!important;
      line-height:1!important;
      text-transform:uppercase!important;
    }
    .rp-ranking-next .rp-ranking-capacity-badge strong{
      margin:0!important;
      color:#61e3ff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.68rem!important;
      font-style:italic!important;
      font-weight:950!important;
      letter-spacing:.035em!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    @media(max-width:390px){
      .rp-ranking-next .rp-ranking-capacity-badge{
        min-width:46px;
        height:36px;
        padding-left:6px;
        padding-right:6px;
      }
      .rp-ranking-next .rp-ranking-capacity-badge small{font-size:.29rem!important}
      .rp-ranking-next .rp-ranking-capacity-badge strong{font-size:.62rem!important}
    }
  `;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.className = 'rp-ranking-capacity-badge';
  badge.dataset.rpRankingCapacityBadge = 'true';
  badge.hidden = true;
  badge.innerHTML = '<small>PLAYERS</small><strong data-rp-ranking-capacity-value>00/00</strong>';
  head.appendChild(badge);

  const value = badge.querySelector('[data-rp-ranking-capacity-value]');

  function pad(number) {
    return String(Math.max(0, Math.trunc(Number(number) || 0))).padStart(2, '0');
  }

  function setHidden(hidden) {
    if (badge.hidden !== hidden) badge.hidden = hidden;
  }

  function syncCapacity() {
    const accessTotal = view.querySelector('[data-rp-ranking-access-total]');
    const securedCount = view.querySelector('[data-rp-ranking-secured-count]');
    const text = String(accessTotal?.textContent || securedCount?.textContent || '').trim();
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);

    if (!match) {
      setHidden(true);
      return;
    }

    const joined = Number(match[1]);
    const capacity = Number(match[2]);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setHidden(true);
      return;
    }

    const nextValue = `${pad(joined)}/${pad(capacity)}`;
    if (value && value.textContent !== nextValue) value.textContent = nextValue;
    setHidden(false);
  }

  const observer = new MutationObserver(syncCapacity);
  observer.observe(view, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  syncCapacity();
})();

/*
 * NEXT RANKING GAME session-status summary.
 * Replace the redundant "YOU'RE IN · SCHEDULED" line with a compact live view
 * of how the session is being secured: Play Token, GCash, Cash and Standby.
 */
(() => {
  if (window.__realPlayRankingSessionStatusSummaryInstalled) return;
  window.__realPlayRankingSessionStatusSummaryInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const POLL_MS = 3500;
  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  let loading = false;
  let pollTimer = 0;
  let lastState = null;
  let actionSyncQueued = false;

  const style = document.createElement('style');
  style.dataset.rpRankingSessionStatusSummary = 'true';
  style.textContent = `
    .rp-ranking-session.has-access-summary>[data-rp-ranking-session-status]{display:none!important}
    .rp-ranking-access-summary{
      margin:0 0 11px;
      padding:0 0 11px;
      border-bottom:1px solid rgba(108,151,190,.12);
    }
    .rp-ranking-access-summary[hidden]{display:none!important}
    .rp-ranking-access-summary-head{
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:12px;
      margin-bottom:9px;
    }
    .rp-ranking-access-summary-head span,
    .rp-ranking-access-summary-head strong{
      font-family:var(--rp-display,Arial,sans-serif);
      font-weight:950;
      text-transform:uppercase;
    }
    .rp-ranking-access-summary-head span{
      color:#71869a;
      font-size:.45rem;
      letter-spacing:.12em;
    }
    .rp-ranking-access-summary-head strong{
      color:#eef8ff;
      font-size:.62rem;
      letter-spacing:.05em;
      white-space:nowrap;
    }
    .rp-ranking-access-breakdown{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:0;
      border:1px solid rgba(83,145,181,.13);
      border-radius:11px;
      overflow:hidden;
      background:rgba(5,15,24,.48);
    }
    .rp-ranking-access-breakdown div{
      min-width:0;
      padding:8px 5px 7px;
      border-right:1px solid rgba(83,145,181,.10);
      text-align:center;
    }
    .rp-ranking-access-breakdown div:last-child{border-right:0}
    .rp-ranking-access-breakdown span{
      display:block;
      margin-bottom:4px;
      color:#61778b;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.34rem;
      font-weight:950;
      letter-spacing:.09em;
      line-height:1;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-ranking-access-breakdown strong{
      display:block;
      color:#d9e7f0;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.62rem;
      font-weight:950;
      line-height:1;
    }
    .rp-ranking-access-breakdown .is-token strong{color:#75e9c5}
    .rp-ranking-access-breakdown .is-standby strong{color:#b9a77d}
    @media(max-width:390px){
      .rp-ranking-access-summary-head span{font-size:.41rem}
      .rp-ranking-access-summary-head strong{font-size:.57rem}
      .rp-ranking-access-breakdown span{font-size:.31rem;letter-spacing:.07em}
      .rp-ranking-access-breakdown strong{font-size:.57rem}
      .rp-ranking-access-breakdown div{padding-left:3px;padding-right:3px}
    }
  `;
  document.head.appendChild(style);

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  function pad(numberValue) {
    return String(number(numberValue)).padStart(2, '0');
  }

  function ensureSummary() {
    const card = view.querySelector('[data-rp-ranking-session]');
    if (!card) return null;

    let summary = card.querySelector('[data-rp-ranking-access-summary]');
    if (summary) return summary;

    summary = document.createElement('section');
    summary.className = 'rp-ranking-access-summary';
    summary.dataset.rpRankingAccessSummary = 'true';
    summary.hidden = true;
    summary.innerHTML = `
      <div class="rp-ranking-access-summary-head">
        <span>SECURED SPOTS</span>
        <strong data-rp-ranking-access-total>00/00 SECURED</strong>
      </div>
      <div class="rp-ranking-access-breakdown" aria-label="Session access breakdown">
        <div class="is-token"><span>TOKEN</span><strong data-rp-ranking-access-token>0</strong></div>
        <div><span>GCASH</span><strong data-rp-ranking-access-gcash>0</strong></div>
        <div><span>CASH</span><strong data-rp-ranking-access-cash>0</strong></div>
        <div class="is-standby"><span>STANDBY</span><strong data-rp-ranking-access-standby>0</strong></div>
      </div>`;

    const action = card.querySelector('[data-rp-ranking-session-action]');
    if (action) action.insertAdjacentElement('beforebegin', summary);
    else card.appendChild(summary);
    return summary;
  }

  function ownAccessLabel(entry) {
    if (entry?.entryType === 'token') return 'TOKEN';
    if (entry?.paymentStatus === 'gcash_submitted') return 'GCASH';
    if (entry?.paymentStatus === 'cash_due') return 'CASH';
    if (entry?.entryType === 'standby') return 'FREE STANDBY';
    return '';
  }

  function syncOwnAction() {
    actionSyncQueued = false;
    const state = lastState;
    const action = view.querySelector('[data-rp-ranking-session-action]');
    const entry = state?.entry;
    if (!action || !entry || entry.status === 'cancelled') return;

    const label = ownAccessLabel(entry);
    if (!label) return;

    if (entry.status === 'secured') {
      const next = `✓ SECURED · ${label}`;
      if (action.textContent !== next) action.textContent = next;
      action.disabled = true;
      return;
    }

    if (entry.status === 'standby' && entry.entryType === 'standby') {
      const next = 'STANDBY · FREE';
      if (action.textContent !== next) action.textContent = next;
    }
  }

  function queueOwnActionSync() {
    if (actionSyncQueued) return;
    actionSyncQueued = true;
    window.queueMicrotask(syncOwnAction);
  }

  function render(state = {}) {
    lastState = state;
    const card = view.querySelector('[data-rp-ranking-session]');
    const summary = ensureSummary();
    const session = state?.session;
    if (!card || !summary) return;

    if (!session || String(session.gameStatus || session.game_status || 'setup').toLowerCase() !== 'setup') {
      summary.hidden = true;
      card.classList.remove('has-access-summary');
      return;
    }

    const counts = state?.counts || {};
    const secured = number(counts.secured);
    const tokenSecured = number(counts.tokenSecured ?? counts.token_secured);
    const gcashSecured = number(counts.gcashSecured ?? counts.gcash_secured);
    const cashSecured = number(counts.cashSecured ?? counts.cash_secured);
    const adminPrioritySecured = number(counts.adminPrioritySecured ?? counts.admin_priority_secured);
    const standby = number(counts.standby);
    const capacityRaw = Number(session.capacity);
    const capacity = Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.trunc(capacityRaw) : null;
    const totalPlayers = secured + standby;
    const securedCapacityCount = capacity ? Math.min(totalPlayers, capacity) : totalPlayers;
    const overflowStandby = capacity ? Math.max(totalPlayers - capacity, 0) : 0;

    summary.querySelector('[data-rp-ranking-access-total]').textContent = capacity
      ? `${pad(securedCapacityCount)}/${pad(capacity)} SECURED${overflowStandby > 0 ? ` · ${pad(overflowStandby)} STANDBY` : ''}`
      : `${pad(securedCapacityCount)} SECURED`;
    summary.querySelector('[data-rp-ranking-access-token]').textContent = String(tokenSecured);
    summary.querySelector('[data-rp-ranking-access-gcash]').textContent = String(gcashSecured);
    summary.querySelector('[data-rp-ranking-access-cash]').textContent = String(cashSecured);
    summary.querySelector('[data-rp-ranking-access-standby]').textContent = String(standby);
    summary.dataset.rpAdminPrioritySecured = String(adminPrioritySecured);

    summary.hidden = false;
    card.classList.add('has-access-summary');
    queueOwnActionSync();
  }

  async function refresh() {
    if (loading || !view.classList.contains('open')) return;
    const auth = token();
    if (!auth) return;

    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/access`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const state = await response.json().catch(() => ({}));
      render(state || {});
    } catch (_error) {
      // Keep the reservation and roster surfaces usable if this optional summary read fails.
    } finally {
      loading = false;
    }
  }

  const viewObserver = new MutationObserver(() => {
    ensureSummary();
    if (view.classList.contains('open')) refresh();
  });
  viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] });

  const action = view.querySelector('[data-rp-ranking-session-action]');
  if (action) {
    const actionObserver = new MutationObserver(queueOwnActionSync);
    actionObserver.observe(action, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(refresh, 60));
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  ensureSummary();
  refresh();
  pollTimer = window.setInterval(refresh, POLL_MS);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
})();