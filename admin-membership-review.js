(() => {
  if (window.__realPlayMembershipReviewInstalled || !window.__realPlayAdminVerified) return;
  window.__realPlayMembershipReviewInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const TOKEN_COUNT = 4;
  const TOKEN_VALID_DAYS = 90;
  const TOKEN_SUPPORT_TIERS = new Set(['builder', 'founding', 'sponsor']);
  let pending = [];

  const root = document.createElement('div');
  root.className = 'rp-membership-admin';
  root.innerHTML = `
    <button class="rp-membership-admin-launch" type="button" data-membership-admin-launch>
      PENDING APPROVAL <b data-membership-admin-count>0</b>
    </button>
    <div class="rp-membership-admin-backdrop" data-membership-admin-backdrop aria-hidden="true">
      <section class="rp-membership-admin-panel" role="dialog" aria-modal="true" aria-labelledby="rp-membership-admin-title">
        <header>
          <div><small>REAL PLAY ADMIN</small><h2 id="rp-membership-admin-title">SUPPORT APPROVAL</h2></div>
          <button type="button" data-membership-admin-close aria-label="Close support approval">×</button>
        </header>
        <p class="rp-membership-admin-lede">Support payments and cash requests appear here automatically. Verify the contribution before approval. Builder, Founding Supporter, and Sponsor approvals issue 4 Play Tokens, each valid for 90 days.</p>
        <div data-membership-admin-list></div>
      </section>
    </div>
  `;
  document.body.appendChild(root);

  const launch = root.querySelector('[data-membership-admin-launch]');
  const count = root.querySelector('[data-membership-admin-count]');
  const backdrop = root.querySelector('[data-membership-admin-backdrop]');
  const list = root.querySelector('[data-membership-admin-list]');

  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function amountPhp(item) {
    const value = Number(item?.amountPhp);
    return Number.isFinite(value) && value > 0 ? value : 99;
  }

  function tokensFor(item) {
    if (item?.reviewKind === 'support') {
      return TOKEN_SUPPORT_TIERS.has(String(item.tierCode || '').toLowerCase()) ? TOKEN_COUNT : 0;
    }
    return TOKEN_COUNT;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token()}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Support operation failed.');
    return data;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
    }).format(date);
  }

  function paymentLabel(item) {
    const method = String(item?.paymentMethod || '').toLowerCase();
    if (method === 'cash_on_hand' || method === 'cash') return 'CASH ON HAND';
    if (method === 'maya') return 'MAYA';
    return 'GCASH';
  }

  function proofMarkup(item) {
    const proof = String(item?.proofImageDataUrl || '');
    if (proof.startsWith('data:image/')) {
      return `<button class="rp-membership-proof-open" type="button" data-proof-open><img src="${proof}" alt="Payment proof for ${escapeHtml(item.playerName)}"></button>`;
    }
    const cash = ['cash', 'cash_on_hand'].includes(String(item?.paymentMethod || '').toLowerCase());
    return `
      <div class="rp-membership-proof-empty">
        <strong>${cash ? 'CASH PAYMENT' : 'NO SCREENSHOT'}</strong>
        <span>${cash ? 'Confirm the cash was received before approving.' : 'No payment image was attached to this request.'}</span>
      </div>`;
  }

  function render() {
    count.textContent = String(pending.length);
    launch.classList.toggle('has-pending', pending.length > 0);
    launch.setAttribute('aria-label', `${pending.length} support payment${pending.length === 1 ? '' : 's'} pending approval`);

    if (!pending.length) {
      list.innerHTML = '<div class="rp-membership-admin-empty">NO PENDING SUPPORT PAYMENTS</div>';
      return;
    }

    list.innerHTML = pending.map((item) => {
      const amount = amountPhp(item);
      const tokenCount = tokensFor(item);
      const tierLabel = item.reviewKind === 'support'
        ? String(item.tierName || item.tierCode || 'SUPPORT').toUpperCase()
        : 'LEGACY MEMBERSHIP';
      return `
        <article class="rp-membership-review-card" data-review-key="${item.reviewKind}:${item.id}">
          <div class="rp-membership-review-head">
            <div><strong>${escapeHtml(item.playerName)}</strong><span>${escapeHtml(item.email)}</span></div>
            <b>₱${amount}</b>
          </div>
          <div class="rp-membership-review-meta">
            <span>${escapeHtml(tierLabel)}</span>
            <span>${escapeHtml(paymentLabel(item))}</span>
            <span>${escapeHtml(formatDate(item.submittedAt))}</span>
            <span>PENDING</span>
          </div>
          ${item.sponsorName ? `<div class="rp-membership-token-note"><span>SPONSOR DISPLAY</span><strong>${escapeHtml(item.sponsorName)}</strong></div>` : ''}
          ${proofMarkup(item)}
          <div class="rp-membership-token-note"><span>AFTER APPROVAL</span><strong>${tokenCount ? `${tokenCount} PLAY TOKENS · ${TOKEN_VALID_DAYS} DAYS EACH` : 'SUPPORT STATUS ACTIVATES'}</strong></div>
          <div class="rp-membership-review-actions">
            <button class="approve" type="button" data-review="approve">APPROVE ₱${amount}</button>
            <button class="reject" type="button" data-review="reject">REJECT</button>
          </div>
          <p data-review-status></p>
        </article>`;
    }).join('');

    list.querySelectorAll('[data-proof-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const src = button.querySelector('img')?.src || '';
        if (src) window.open(src, '_blank', 'noopener');
      });
    });
    list.querySelectorAll('[data-review]').forEach((button) => button.addEventListener('click', () => review(button)));
  }

  async function refresh() {
    if (!token()) {
      root.hidden = true;
      return;
    }

    try {
      const [supportResult, legacyResult] = await Promise.allSettled([
        api('/api/real-play/admin/support-tiers/pending'),
        api('/api/real-play/admin/memberships/pending'),
      ]);

      const supportItems = supportResult.status === 'fulfilled' && Array.isArray(supportResult.value?.pending)
        ? supportResult.value.pending.map((item) => ({
            ...item,
            reviewKind: 'support',
            submittedAt: item.createdAt || item.submittedAt || null,
          }))
        : [];
      const legacyItems = legacyResult.status === 'fulfilled' && Array.isArray(legacyResult.value?.pending)
        ? legacyResult.value.pending.map((item) => ({ ...item, reviewKind: 'membership' }))
        : [];

      if (supportResult.status === 'rejected' && legacyResult.status === 'rejected') {
        throw supportResult.reason || legacyResult.reason || new Error('Approval queue unavailable.');
      }

      pending = [...supportItems, ...legacyItems].sort((a, b) => {
        const at = new Date(a.submittedAt || 0).getTime() || 0;
        const bt = new Date(b.submittedAt || 0).getTime() || 0;
        return at - bt;
      });
      render();
      root.hidden = false;
    } catch (_error) {
      root.hidden = true;
    }
  }

  async function review(button) {
    const card = button.closest('[data-review-key]');
    const reviewKey = card?.dataset.reviewKey || '';
    const item = pending.find((entry) => `${entry.reviewKind}:${entry.id}` === reviewKey);
    const decision = button.dataset.review;
    if (!item) return;

    const amount = amountPhp(item);
    const tokenCount = tokensFor(item);
    let note = '';
    if (decision === 'approve') {
      const tokenCopy = tokenCount ? ` and issue ${tokenCount} Play Tokens` : '';
      if (!window.confirm(`Approve ${item.playerName}'s ₱${amount} ${item.tierName || 'Real Play support'} payment${tokenCopy}?`)) return;
    } else {
      note = window.prompt(
        'Why could this contribution not be verified? This note may be shown to the player.',
        ['cash', 'cash_on_hand'].includes(String(item.paymentMethod || '').toLowerCase())
          ? 'Cash payment could not be confirmed.'
          : 'Payment proof could not be verified.'
      ) || '';
      if (!note) return;
      if (!window.confirm(`Reject ${item.playerName}'s support payment?`)) return;
    }

    const status = card.querySelector('[data-review-status]');
    card.querySelectorAll('[data-review]').forEach((control) => { control.disabled = true; });
    if (status) {
      status.textContent = decision === 'approve'
        ? (tokenCount ? `APPROVING · ISSUING ${tokenCount} PLAY TOKENS…` : 'APPROVING SUPPORT STATUS…')
        : 'REJECTING PAYMENT…';
    }

    try {
      if (item.reviewKind === 'support') {
        await api(`/api/real-play/admin/support-tiers/${item.id}/review`, {
          method: 'POST',
          body: { decision: decision === 'approve' ? 'verify' : 'reject', note },
        });
      } else {
        await api(`/api/real-play/admin/memberships/${item.id}/review`, {
          method: 'POST',
          body: { decision, note },
        });
      }

      pending = pending.filter((entry) => `${entry.reviewKind}:${entry.id}` !== reviewKey);
      render();
      window.dispatchEvent(new CustomEvent('realplay:membership-reviewed', {
        detail: { id: Number(item.id), kind: item.reviewKind, decision },
      }));
    } catch (error) {
      if (status) status.textContent = error.message || 'Review failed.';
      card.querySelectorAll('[data-review]').forEach((control) => { control.disabled = false; });
    }
  }

  function open() {
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-membership-review-open');
    refresh();
  }

  function close() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-membership-review-open');
  }

  launch.addEventListener('click', open);
  root.querySelector('[data-membership-admin-close]')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('realplay:support-tier-submitted', refresh);

  window.__realPlayOpenMembershipReview = open;
  window.__realPlayRefreshMembershipReview = refresh;

  root.hidden = true;
  refresh();
  window.setInterval(() => {
    if (!document.hidden) refresh();
  }, 10000);
})();