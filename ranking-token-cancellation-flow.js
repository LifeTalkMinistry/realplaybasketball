(() => {
  if (window.__realPlayTokenCancellationFlowInstalled) return;
  window.__realPlayTokenCancellationFlowInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-token-cancellation-flow-style';
  const FALLBACK_CUTOFF_MINUTES = 120;
  let syncing = false;
  let syncTimer = 0;
  let cutoffTimer = 0;
  let rankingStateLoading = false;
  let rankingWasOpen = document.body.classList.contains('rp-ranking-open');

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function overlay() {
    return document.querySelector('[data-rp-ranking-entry-options]');
  }

  function sheet() {
    return overlay()?.querySelector('.rp-entry-options-sheet') || null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.message || data?.error || 'Unable to complete this Real Play action.');
        error.code = data?.code || null;
        throw error;
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function getAccessState() {
    return api('/api/real-play/career/access');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-token-flow{padding:2px 2px 8px}
      .rp-token-flow-screen{display:block}
      .rp-token-flow .rp-token-balance{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        margin:5px 0 12px;
        padding:0 9px;
        border:1px solid rgba(65,213,255,.18);
        border-radius:999px;
        background:rgba(35,198,255,.055);
        color:#68dcf5;
        font-size:.49rem;
        font-weight:950;
        letter-spacing:.09em;
        text-transform:uppercase;
      }
      .rp-token-flow h2{margin:0 0 7px!important}
      .rp-token-flow .rp-token-lede{
        margin:0 0 14px;
        color:#8797aa;
        font-size:.7rem;
        font-weight:650;
        line-height:1.48;
      }
      .rp-token-flow .rp-token-lede strong{color:#f4f8fd;font-weight:900}
      .rp-token-deadline{
        margin:0 0 14px;
        padding:13px 13px 12px;
        border:1px solid rgba(54,188,230,.20);
        border-radius:14px;
        background:linear-gradient(145deg,rgba(8,21,32,.96),rgba(4,10,17,.98));
      }
      .rp-token-deadline>span{
        display:block;
        margin-bottom:5px;
        color:#61d9f3;
        font-size:.48rem;
        font-weight:950;
        letter-spacing:.11em;
        text-transform:uppercase;
      }
      .rp-token-deadline>strong{
        display:block;
        color:#f7faff;
        font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);
        font-size:1.02rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.025em;
        line-height:1.08;
        text-transform:uppercase;
      }
      .rp-token-deadline>small{
        display:block;
        margin-top:7px;
        color:#8191a4;
        font-size:.6rem;
        font-weight:650;
        line-height:1.42;
      }
      .rp-token-deadline.is-locked{
        border-color:rgba(255,138,105,.18);
        background:linear-gradient(145deg,rgba(27,16,16,.88),rgba(9,9,13,.98));
      }
      .rp-token-deadline.is-locked>span{color:#d9a078}
      .rp-token-flow .rp-entry-action-primary{
        border:1px solid rgba(67,167,214,.34)!important;
        background:linear-gradient(100deg,#081521 0%,#0b2232 55%,#0c2b3d 100%)!important;
        color:#f7fbff!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 20px rgba(0,0,0,.25)!important;
      }
      .rp-token-flow .rp-entry-action-secondary{
        border-color:rgba(255,255,255,.10)!important;
        background:rgba(255,255,255,.025)!important;
        color:#9daabd!important;
      }
      .rp-token-flow .rp-token-state-mark{
        display:grid;
        place-items:center;
        width:48px;
        height:48px;
        margin:2px 0 13px;
        border:1px solid rgba(71,207,242,.24);
        border-radius:50%;
        background:rgba(38,187,226,.055);
        color:#72dff7;
        font-size:1rem;
        font-weight:950;
      }
      .rp-token-flow .rp-token-state-mark.is-locked{
        border-color:rgba(255,157,114,.18);
        background:rgba(255,145,93,.045);
        color:#dca17e;
      }
      .rp-token-flow .rp-token-status{
        margin:9px 0 0;
        color:#8292a7;
        font-size:.62rem;
        line-height:1.42;
        text-align:center;
      }
      .rp-token-flow .rp-token-status.error{color:#ff8d9b}
    `;
    document.head.appendChild(style);
  }

  function headerMarkup() {
    return `
      <div class="rp-entry-options-grab" aria-hidden="true"></div>
      <div class="rp-entry-options-head">
        <button class="rp-entry-options-close" type="button" aria-label="Close entry options" data-rp-entry-close>×</button>
      </div>`;
  }

  function fallbackCutoffAt(state) {
    const raw = state?.session?.startsAt ?? state?.session?.starts_at ?? null;
    if (!raw) return null;
    const startsAt = new Date(raw);
    if (Number.isNaN(startsAt.getTime())) return null;
    return new Date(startsAt.getTime() - FALLBACK_CUTOFF_MINUTES * 60 * 1000).toISOString();
  }

  function policyFromState(state) {
    const server = state?.tokenCancellation || {};
    const cutoffAt = server.cutoffAt || fallbackCutoffAt(state);
    const cutoffTime = cutoffAt ? new Date(cutoffAt).getTime() : NaN;
    const localClosed = Number.isFinite(cutoffTime) && Date.now() >= cutoffTime;
    const windowClosed = server.windowClosed === true || localClosed;
    const committedToken = state?.entry?.entryType === 'token'
      && state?.entry?.paymentStatus === 'token_committed';
    const locked = server.locked === true || Boolean(committedToken && windowClosed);
    return {
      cutoffAt,
      windowClosed,
      locked,
      canCancel: committedToken
        ? server.canCancel !== false && !windowClosed
        : !windowClosed,
    };
  }

  function formatCutoff(value) {
    if (!value) return '2 HOURS BEFORE START';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '2 HOURS BEFORE START';
    const datePart = new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
    const timePart = new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
    return `${datePart} · ${timePart}`;
  }

  function armCutoffRefresh(cutoffAt) {
    if (cutoffTimer) {
      window.clearTimeout(cutoffTimer);
      cutoffTimer = 0;
    }
    if (!cutoffAt) return;
    const delay = new Date(cutoffAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    cutoffTimer = window.setTimeout(() => {
      scheduleSync(80);
      refreshRankingTokenState();
    }, Math.min(delay + 100, 2147483000));
  }

  function renderConfirmation(state) {
    const node = sheet();
    if (!node) return;
    const count = Math.max(0, Number(state?.tokens?.available || 0));
    const policy = policyFromState(state);
    const deadline = formatCutoff(policy.cutoffAt);
    const deadlineMarkup = policy.windowClosed
      ? `<div class="rp-token-deadline is-locked">
          <span>CANCELLATION WINDOW CLOSED</span>
          <strong>BOOKING LOCKS NOW</strong>
          <small>The refund deadline has passed. Confirming now permanently commits 1 token to this Ranking Game.</small>
        </div>`
      : `<div class="rp-token-deadline">
          <span>CANCEL BY</span>
          <strong>${escapeHtml(deadline)}</strong>
          <small>Cancel before this time and your token is returned. After it, the booking is locked and the token cannot be returned.</small>
        </div>`;

    node.innerHTML = `${headerMarkup()}
      <div class="rp-entry-action-flow rp-token-flow rp-token-flow-screen" data-rp-token-flow-screen="confirm">
        <div class="rp-token-balance">${count} TOKEN${count === 1 ? '' : 'S'} AVAILABLE</div>
        <h2>CONFIRM YOUR SPOT</h2>
        <p class="rp-token-lede">Use <strong>1 Play Token</strong> to secure this Ranking Game.</p>
        ${deadlineMarkup}
        <button class="rp-entry-action-primary" type="button" data-rp-use-token>CONFIRM SPOT · 1 TOKEN</button>
        <p class="rp-token-status" data-rp-entry-status></p>
      </div>`;
    armCutoffRefresh(policy.cutoffAt);
  }

  function renderTokenEntry(state) {
    const node = sheet();
    if (!node) return;
    const policy = policyFromState(state);
    const deadline = formatCutoff(policy.cutoffAt);

    if (policy.locked) {
      node.innerHTML = `${headerMarkup()}
        <div class="rp-entry-action-flow rp-token-flow rp-token-flow-screen" data-rp-token-flow-screen="locked">
          <div class="rp-token-state-mark is-locked">✓</div>
          <h2>SPOT LOCKED</h2>
          <p class="rp-token-lede">Cancellation window has closed · <strong>Token committed.</strong></p>
          <div class="rp-token-deadline is-locked">
            <span>LOCKED AT</span>
            <strong>${escapeHtml(deadline)}</strong>
            <small>Your Play Token is committed to this Ranking Game and can no longer be returned.</small>
          </div>
          <button class="rp-entry-action-primary" type="button" data-rp-entry-done>DONE</button>
        </div>`;
      return;
    }

    node.innerHTML = `${headerMarkup()}
      <div class="rp-entry-action-flow rp-token-flow rp-token-flow-screen" data-rp-token-flow-screen="secured">
        <div class="rp-token-state-mark">✓</div>
        <h2>SPOT SECURED · 1 TOKEN</h2>
        <p class="rp-token-lede">Your Play Token is committed to this Ranking Game.</p>
        <div class="rp-token-deadline">
          <span>CANCELABLE UNTIL</span>
          <strong>${escapeHtml(deadline)}</strong>
          <small>Cancel before this time to release your spot and return the token to your balance.</small>
        </div>
        <button class="rp-entry-action-secondary" type="button" data-rp-entry-cancel>CANCEL ATTENDANCE</button>
        <button class="rp-entry-action-primary" type="button" data-rp-entry-done>DONE</button>
        <p class="rp-token-status" data-rp-entry-status></p>
      </div>`;
    armCutoffRefresh(policy.cutoffAt);
  }

  function shouldPreserveLegacyResult() {
    const node = sheet();
    if (!node?.querySelector('[data-rp-entry-done]')) return false;
    const heading = String(node.querySelector('h2')?.textContent || '').trim().toUpperCase();
    return heading === 'SPOT RELEASED' || heading === 'PAYMENT RECORDED';
  }

  function syncRankingCancelControl(state) {
    const button = document.querySelector('[data-rp-ranking-cancel]');
    if (!button) return;
    const entry = state?.entry;
    const activeToken = entry && entry.status !== 'cancelled' && entry.entryType === 'token';
    if (!activeToken) {
      delete button.dataset.rpTokenLocked;
      return;
    }
    const policy = policyFromState(state);
    button.dataset.rpTokenManaged = 'true';
    button.dataset.rpTokenLocked = policy.locked ? 'true' : 'false';
    if (policy.locked) {
      button.hidden = true;
      button.disabled = true;
      button.textContent = 'SPOT LOCKED';
    } else if (document.body.classList.contains('rp-ranking-open')) {
      button.hidden = false;
      button.disabled = false;
      button.textContent = 'CANCEL SPOT';
      armCutoffRefresh(policy.cutoffAt);
    }
  }

  async function refreshRankingTokenState() {
    if (rankingStateLoading || !authToken() || !document.body.classList.contains('rp-ranking-open')) return;
    rankingStateLoading = true;
    try {
      const state = await getAccessState();
      syncRankingCancelControl(state);
    } catch (_error) {
      // Do not alter the base Open Rank controls if access state cannot be verified.
    } finally {
      rankingStateLoading = false;
    }
  }

  function setRankingMessage(message, type = '') {
    const node = document.querySelector('[data-rp-ranking-message]');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  async function cancelFromRanking(button) {
    if (!authToken() || button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'CHECKING…';
    setRankingMessage('');

    try {
      const state = await getAccessState();
      const entry = state?.entry;
      const activeEntry = entry && entry.status !== 'cancelled';

      if (activeEntry) {
        const policy = policyFromState(state);
        if (entry.entryType === 'token' && policy.locked) {
          syncRankingCancelControl(state);
          setRankingMessage('Cancellation window has closed. This Play Token is committed to the Ranking Game.', 'error');
          return;
        }

        const deadline = entry.entryType === 'token' ? formatCutoff(policy.cutoffAt) : null;
        const question = entry.entryType === 'token'
          ? `Cancel this secured spot?\n\nYour Play Token will be returned because you are cancelling before ${deadline}.`
          : 'Cancel your secured spot for this Ranking Game?';
        if (!window.confirm(question)) return;

        button.textContent = 'CANCELLING…';
        const result = await api('/api/real-play/career/access', { method: 'DELETE' });
        window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: result }));
        await window.RealPlayRankingGames?.refresh?.();
        setRankingMessage(entry.entryType === 'token' ? 'Spot released. Your Play Token was returned.' : 'Spot released.', 'success');
        return;
      }

      if (!window.confirm('Cancel your reservation for this Ranking Game?\n\nYour spot will be released for another player.')) return;
      button.textContent = 'CANCELLING…';
      await api('/api/real-play/career/play', { method: 'DELETE' });
      await window.RealPlayRankingGames?.refresh?.();
      setRankingMessage('Spot released.', 'success');
    } catch (error) {
      setRankingMessage(error?.message || 'Unable to cancel this spot right now.', 'error');
      await refreshRankingTokenState();
    } finally {
      if (document.body.contains(button) && !button.hidden) {
        button.disabled = false;
        if (button.textContent === 'CHECKING…' || button.textContent === 'CANCELLING…') button.textContent = originalText || 'CANCEL SPOT';
      }
    }
  }

  async function syncTokenFlow() {
    if (syncing || !authToken() || !overlay()?.classList.contains('is-open')) return;
    syncing = true;
    try {
      const state = await getAccessState();
      if (!overlay()?.classList.contains('is-open')) return;
      syncRankingCancelControl(state);
      const entry = state?.entry;
      const activeEntry = entry && entry.status !== 'cancelled';
      if (activeEntry && entry.entryType === 'token') {
        renderTokenEntry(state);
        return;
      }
      if (!activeEntry && Number(state?.tokens?.available || 0) > 0) {
        renderConfirmation(state);
      }
    } catch (_error) {
      // The existing entry flow remains usable if this refinement cannot refresh.
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(delay = 30) {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = 0;
      syncTokenFlow();
    }, delay);
  }

  function watchDom() {
    const observer = new MutationObserver(() => {
      const activeOverlay = overlay();
      if (!activeOverlay?.classList.contains('is-open')) return;
      const node = sheet();
      if (!node) return;
      const tokenScreen = node.querySelector('[data-rp-token-flow-screen]');
      if (tokenScreen) {
        const confirm = tokenScreen.querySelector('[data-rp-use-token]');
        if (confirm && String(confirm.textContent || '').trim() === 'CONFIRM · USE 1 TOKEN') {
          confirm.textContent = 'CONFIRM SPOT · 1 TOKEN';
        }
        return;
      }
      if (shouldPreserveLegacyResult()) return;
      scheduleSync(50);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    const rankingObserver = new MutationObserver(() => {
      const isOpen = document.body.classList.contains('rp-ranking-open');
      if (isOpen && !rankingWasOpen) refreshRankingTokenState();
      rankingWasOpen = isOpen;
    });
    rankingObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  installStyles();
  watchDom();

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const cancel = target.closest('[data-rp-ranking-cancel]');
    if (cancel) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      cancelFromRanking(cancel);
      return;
    }

    const join = target.closest('[data-rp-ranking-session-action]');
    if (join && !join.disabled && /JOIN\s+RANKING\s+GAME/i.test(String(join.textContent || ''))) {
      scheduleSync(40);
    }
  }, true);

  window.addEventListener('realplay:ranking-entry-updated', (event) => {
    const entry = event?.detail?.entry;
    if (entry?.entryType === 'token') scheduleSync(20);
    if (document.body.classList.contains('rp-ranking-open')) refreshRankingTokenState();
  });

  window.addEventListener('focus', () => {
    if (document.body.classList.contains('rp-ranking-open')) refreshRankingTokenState();
  });

  if (overlay()?.classList.contains('is-open')) scheduleSync(0);
  if (rankingWasOpen) refreshRankingTokenState();
})();
