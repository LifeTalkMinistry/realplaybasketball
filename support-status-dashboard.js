(() => {
  if (window.__realPlaySupportStatusDashboardInstalled) return;
  window.__realPlaySupportStatusDashboardInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STATE_ENDPOINT = `${API_BASE_URL}/api/real-play/support/tier`;

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      }).format(date).toUpperCase();
    } catch (_error) {
      return date.toLocaleDateString();
    }
  }

  function paymentMethodLabel(value) {
    const method = String(value || '').trim().toLowerCase();
    if (method === 'cash_on_hand') return 'CASH ON HAND';
    if (method === 'maya') return 'MAYA';
    if (method === 'gcash') return 'GCASH';
    return method ? method.replaceAll('_', ' ').toUpperCase() : '—';
  }

  function ensureStyle() {
    if (document.getElementById('rp-support-status-dashboard-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-support-status-dashboard-style';
    style.textContent = `
      .rp-support-status-card{display:grid;gap:12px;margin:2px 0 14px;padding:16px;border:1px solid rgba(76,214,255,.2);border-radius:15px;background:rgba(4,20,29,.72)}
      .rp-support-status-hero{text-align:center;padding:4px 2px 8px}
      .rp-support-status-check{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 auto 10px;border-radius:999px;background:rgba(66,216,255,.13);color:#62e2ff;font-size:1.3rem;font-weight:950}
      .rp-support-status-hero small{display:block;color:#62e2ff;font-size:.53rem;font-weight:950;letter-spacing:.13em}
      .rp-support-status-hero strong{display:block;margin-top:5px;color:#f7fbff;font-size:1rem;letter-spacing:.015em}
      .rp-support-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rp-support-status-item{min-width:0;padding:10px 11px;border:1px solid rgba(76,214,255,.12);border-radius:11px;background:rgba(1,10,17,.46)}
      .rp-support-status-item.wide{grid-column:1/-1}
      .rp-support-status-item span{display:block;color:#7893a2;font-size:.49rem;font-weight:950;letter-spacing:.1em}
      .rp-support-status-item strong{display:block;margin-top:4px;color:#f2f9ff;font-size:.72rem;line-height:1.3;word-break:break-word}
      .rp-support-status-note{margin:0;color:#8199a7;font-size:.6rem;line-height:1.48;text-align:center}
      .rp-support-status-note strong{color:#dff7ff}
      .rp-support-status-actions{display:grid;gap:8px;margin-top:12px}
      .rp-support-status-actions button{width:100%}
      .rp-support-status-secondary{min-height:43px;padding:10px 12px;border:1px solid rgba(76,214,255,.17);border-radius:12px;background:rgba(4,20,29,.72);color:#dff7ff;font-size:.62rem;font-weight:950;letter-spacing:.06em;cursor:pointer}
      @media (max-width:380px){.rp-support-status-grid{grid-template-columns:1fr}.rp-support-status-item.wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function isTierChoice(panel) {
    if (!panel) return false;
    return Boolean(
      panel.querySelector('[data-rp-team-support-money-tier="supporter"]') &&
      panel.querySelector('[data-rp-team-support-money-tier="builder"]')
    );
  }

  async function loadSupportState() {
    const auth = token();
    if (!auth) return null;
    const response = await fetch(STATE_ENDPOINT, {
      headers: { Authorization: `Bearer ${auth}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Support state unavailable.');
    const data = await response.json().catch(() => ({}));
    return data?.support || null;
  }

  function supportStateMarkup(support) {
    const verified = String(support?.verificationStatus || '').toLowerCase() === 'verified';
    const active = Boolean(support?.active || (verified && support?.periodStatus === 'active'));
    const pending = !verified || String(support?.periodStatus || '').toLowerCase() === 'pending';
    const amount = Number(support?.amountPhp || 0);
    const tier = String(support?.tierName || support?.tierCode || 'Real Play Supporter').trim();
    const title = pending ? 'PAYMENT UNDER REVIEW' : active ? 'YOUR SUPPORT IS ACTIVE' : 'YOUR SUPPORT';
    const kicker = pending ? 'SUPPORT SUBMITTED' : active ? 'ACTIVE MONTHLY SUPPORT' : 'MONTHLY SUPPORT';
    const status = pending ? 'PENDING VERIFICATION' : active ? 'ACTIVE' : String(support?.periodStatus || 'ACTIVE').toUpperCase();
    const mainDateLabel = pending ? 'SUBMITTED' : 'CURRENT PERIOD STARTED';
    const mainDateValue = pending ? support?.createdAt : (support?.startedAt || support?.verifiedAt);
    const renewalLabel = pending ? 'RENEWAL' : 'NEXT RENEWAL DUE';
    const renewalValue = pending ? 'STARTS AFTER VERIFICATION' : formatDate(support?.endsAt);

    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><small>${escapeHtml(kicker)}</small><h3 id="rp-team-support-title">${escapeHtml(title)}</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Close support status" data-rp-support-status-close>×</button>
      </div>
      <div class="rp-support-status-card">
        <div class="rp-support-status-hero">
          <span class="rp-support-status-check" aria-hidden="true">${pending ? '…' : '✓'}</span>
          <small>${escapeHtml(status)}</small>
          <strong>${escapeHtml(tier.toUpperCase())}${amount ? ` · ₱${amount}/MONTH` : ''}</strong>
        </div>
        <div class="rp-support-status-grid">
          <div class="rp-support-status-item"><span>SUPPORT LEVEL</span><strong>${escapeHtml(tier.toUpperCase())}</strong></div>
          <div class="rp-support-status-item"><span>PAYMENT METHOD</span><strong>${escapeHtml(paymentMethodLabel(support?.paymentMethod))}</strong></div>
          <div class="rp-support-status-item"><span>${escapeHtml(mainDateLabel)}</span><strong>${escapeHtml(formatDate(mainDateValue))}</strong></div>
          <div class="rp-support-status-item"><span>${escapeHtml(renewalLabel)}</span><strong>${escapeHtml(renewalValue)}</strong></div>
        </div>
        <p class="rp-support-status-note">${pending
          ? 'Your support period and next renewal date will appear here after Real Play verifies the payment.'
          : '<strong>No automatic charge.</strong> Renew manually when your current monthly support period ends.'}</p>
      </div>
      <div class="rp-support-status-actions">
        <button class="rp-team-sheet-submit" type="button" data-rp-support-status-manage>${pending ? 'CHOOSE A DIFFERENT SUPPORT LEVEL' : 'RENEW / CHANGE SUPPORT LEVEL'}</button>
        <button class="rp-support-status-secondary" type="button" data-rp-support-status-close>DONE</button>
      </div>
    `;
  }

  function closeOverlay(overlay) {
    if (typeof window.RealPlayTeamSupport?.close === 'function') {
      window.RealPlayTeamSupport.close();
      return;
    }
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function renderStatus(overlay, support) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel || !support) return;
    ensureStyle();
    overlay.dataset.rpSupportStatusView = 'true';
    panel.innerHTML = supportStateMarkup(support);

    panel.querySelectorAll('[data-rp-support-status-close]').forEach((button) => {
      button.addEventListener('click', () => closeOverlay(overlay));
    });

    panel.querySelector('[data-rp-support-status-manage]')?.addEventListener('click', () => {
      overlay.dataset.rpSupportStatusBypass = 'true';
      delete overlay.dataset.rpSupportStatusView;
      delete overlay.dataset.rpSupportStateChecked;
      if (typeof window.RealPlayTeamSupport?.open === 'function') {
        window.RealPlayTeamSupport.open('money');
      }
    });
  }

  async function syncOverlay(overlay) {
    if (!overlay?.isConnected) return;
    if (overlay.dataset.rpSupportStatusBypass === 'true') return;
    if (overlay.dataset.rpSupportStatusView === 'true') return;

    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (!isTierChoice(panel)) return;
    if (overlay.dataset.rpSupportStateChecked) return;

    overlay.dataset.rpSupportStateChecked = 'loading';
    try {
      const support = await loadSupportState();
      if (!overlay.isConnected || overlay.dataset.rpSupportStatusBypass === 'true') return;
      if (support) {
        overlay.dataset.rpSupportStateChecked = 'found';
        renderStatus(overlay, support);
      } else {
        overlay.dataset.rpSupportStateChecked = 'none';
      }
    } catch (_error) {
      // Do not block support choices if the state request is temporarily unavailable.
      overlay.dataset.rpSupportStateChecked = 'error';
    }
  }

  function scan(root = document) {
    const overlays = [];
    if (root?.matches?.('[data-rp-team-support-overlay]')) overlays.push(root);
    root?.querySelectorAll?.('[data-rp-team-support-overlay]').forEach((overlay) => overlays.push(overlay));
    overlays.forEach((overlay) => syncOverlay(overlay));
  }

  const observer = new MutationObserver((mutations) => {
    const overlays = new Set();
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        const owner = mutation.target.closest('[data-rp-team-support-overlay]');
        if (owner) overlays.add(owner);
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-rp-team-support-overlay]')) overlays.add(node);
        node.querySelectorAll?.('[data-rp-team-support-overlay]').forEach((overlay) => overlays.add(overlay));
      }
    }
    overlays.forEach((overlay) => syncOverlay(overlay));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
