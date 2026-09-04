(() => {
  if (!window.__realPlayAdminVerified) return;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let pending = [];

  const root = document.createElement('div');
  root.className = 'rp-membership-admin';
  root.innerHTML = `
    <button class="rp-membership-admin-launch" type="button" data-membership-admin-launch>MEMBERSHIPS <b data-membership-admin-count>0</b></button>
    <div class="rp-membership-admin-backdrop" data-membership-admin-backdrop aria-hidden="true">
      <section class="rp-membership-admin-panel" role="dialog" aria-modal="true" aria-labelledby="rp-membership-admin-title">
        <header><div><small>REAL PLAY OPERATIONS</small><h2 id="rp-membership-admin-title">MEMBERSHIP REVIEW</h2></div><button type="button" data-membership-admin-close>×</button></header>
        <p class="rp-membership-admin-lede">Approve only after the ₱399 payment proof matches the payment received.</p>
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

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token()}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Membership operation failed.');
    return data;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(date);
  }

  function render() {
    count.textContent = String(pending.length);
    launch.classList.toggle('has-pending', pending.length > 0);
    if (!pending.length) {
      list.innerHTML = '<div class="rp-membership-admin-empty">NO PENDING MEMBERSHIP PAYMENTS</div>';
      return;
    }
    list.innerHTML = pending.map((item) => `
      <article class="rp-membership-review-card" data-payment-id="${item.id}">
        <div class="rp-membership-review-head"><div><strong>${escapeHtml(item.playerName)}</strong><span>${escapeHtml(item.email)}</span></div><b>₱${Number(item.amountPhp || 399)}</b></div>
        <div class="rp-membership-review-meta"><span>${String(item.paymentMethod || '').toUpperCase()}</span><span>${formatDate(item.submittedAt)}</span></div>
        <button class="rp-membership-proof-open" type="button" data-proof-open><img src="${item.proofImageDataUrl}" alt="Payment proof for ${escapeHtml(item.playerName)}"></button>
        <div class="rp-membership-review-actions"><button class="approve" type="button" data-review="approve">APPROVE ₱399</button><button class="reject" type="button" data-review="reject">REJECT</button></div>
        <p data-review-status></p>
      </article>
    `).join('');

    list.querySelectorAll('[data-proof-open]').forEach((button) => button.addEventListener('click', () => window.open(button.querySelector('img')?.src, '_blank', 'noopener')));
    list.querySelectorAll('[data-review]').forEach((button) => button.addEventListener('click', () => review(button)));
  }

  async function refresh() {
    if (!token()) return;
    try {
      const data = await api('/api/real-play/admin/memberships/pending');
      pending = Array.isArray(data.pending) ? data.pending : [];
      render();
      root.hidden = false;
    } catch (_error) {
      root.hidden = true;
    }
  }

  async function review(button) {
    const card = button.closest('[data-payment-id]');
    const paymentId = card?.dataset.paymentId;
    const decision = button.dataset.review;
    const item = pending.find((entry) => String(entry.id) === String(paymentId));
    if (!paymentId || !item) return;

    let note = '';
    if (decision === 'approve') {
      if (!window.confirm(`Approve ${item.playerName}'s ₱399 Real Play membership payment?`)) return;
    } else {
      note = window.prompt('Why could this payment not be verified? This note may be shown to the player.', 'Payment screenshot could not be verified.') || '';
      if (!note) return;
      if (!window.confirm(`Reject ${item.playerName}'s membership payment?`)) return;
    }

    const status = card.querySelector('[data-review-status]');
    card.querySelectorAll('[data-review]').forEach((control) => { control.disabled = true; });
    if (status) status.textContent = decision === 'approve' ? 'ACTIVATING MEMBERSHIP…' : 'REJECTING PAYMENT…';
    try {
      await api(`/api/real-play/admin/memberships/${paymentId}/review`, { method: 'POST', body: { decision, note } });
      pending = pending.filter((entry) => String(entry.id) !== String(paymentId));
      render();
    } catch (error) {
      if (status) status.textContent = error.message || 'Review failed.';
      card.querySelectorAll('[data-review]').forEach((control) => { control.disabled = false; });
    }
  }

  function open() { backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); refresh(); }
  function close() { backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden', 'true'); }
  launch.addEventListener('click', open);
  root.querySelector('[data-membership-admin-close]')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  root.hidden = true;
  refresh();
  window.setInterval(refresh, 10000);
})();
