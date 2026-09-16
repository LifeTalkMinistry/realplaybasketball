(() => {
  if (window.__realPlayMembershipV2Installed) return;
  window.__realPlayMembershipV2Installed = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const MEMBERSHIP_PRICE = 99;
  let state = null;
  let paymentConfig = null;
  let selectedMethod = '';
  let proofDataUrl = '';
  let refreshing = false;

  const overlay = document.createElement('div');
  overlay.className = 'rp-membership-overlay';
  overlay.dataset.rpMembershipOverlay = 'true';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <section class="rp-membership-panel" role="dialog" aria-modal="true" aria-labelledby="rp-membership-title">
      <button class="rp-membership-close" type="button" data-membership-close aria-label="Close membership">×</button>
      <div data-membership-content></div>
    </section>
  `;
  document.body.appendChild(overlay);
  const content = overlay.querySelector('[data-membership-content]');

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const token = authToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Unable to complete this Real Play action.');
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
  }

  async function loadPaymentConfig() {
    if (paymentConfig) return paymentConfig;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/support/payment-config`, { headers: { Accept: 'application/json' } });
      paymentConfig = response.ok ? await response.json() : {};
    } catch (_error) {
      paymentConfig = {};
    }
    return paymentConfig;
  }

  async function refreshState() {
    if (!authToken() || refreshing) return state;
    refreshing = true;
    try {
      state = await api('/api/real-play/membership');
    } finally {
      refreshing = false;
    }
    renderAccountCard();
    return state;
  }

  function ensureAccountCard() {
    const accountCard = document.querySelector('.auth-account-card');
    if (!accountCard) return null;
    let card = document.querySelector('[data-auth-membership-card]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'auth-membership-card';
      card.dataset.authMembershipCard = 'true';
      accountCard.insertAdjacentElement('afterend', card);
    }
    card.onclick = () => openMembership();
    return card;
  }

  function renderAccountCard() {
    const card = ensureAccountCard();
    if (!card) return;
    const membership = state?.membership || {};
    const tokens = state?.tokens || {};
    const available = Number(tokens.available || 0);
    const status = membership.status === 'pending'
      ? 'PAYMENT PENDING'
      : available > 0
        ? 'REAL PLAY MEMBER'
        : 'FREE PLAYER';
    const detail = available > 0
      ? `${available} PLAY TOKEN${available === 1 ? '' : 'S'} AVAILABLE`
      : membership.status === 'pending'
        ? 'TOKENS RELEASE AFTER PAYMENT CONFIRMATION'
        : '₱99 · 4 PLAY TOKENS · 90-DAY VALIDITY';
    card.innerHTML = `<span>${status}</span><strong>${detail}</strong><b>→</b>`;
    card.classList.toggle('active', available > 0);
    card.classList.toggle('pending', membership.status === 'pending');
  }

  function paymentMethodCard(method, config) {
    if (method === 'cash') {
      return `<button class="rp-pay-method${selectedMethod === 'cash' ? ' selected' : ''}" type="button" data-pay-method="cash"><span>CASH</span><strong>PAY DIRECTLY TO REAL PLAY</strong></button>`;
    }
    const detail = config?.account_name || config?.number
      ? `${config.account_name || ''}${config.account_name && config.number ? ' · ' : ''}${config.number || ''}`
      : 'GCash payment details';
    return `<button class="rp-pay-method${selectedMethod === 'gcash' ? ' selected' : ''}" type="button" data-pay-method="gcash" ${config?.enabled === false ? 'disabled' : ''}><span>GCASH</span><strong>${detail}</strong></button>`;
  }

  function renderActive() {
    const tokens = state?.tokens || {};
    const available = Number(tokens.available || 0);
    const nextExpiry = formatDate(tokens.nextExpiry);
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBERSHIP</p>
      <div class="rp-membership-active-mark">${available}</div>
      <h2 id="rp-membership-title">PLAY TOKENS READY.</h2>
      <p class="rp-membership-lede">Use 1 token when you confirm a Ranking Game. A confirmed no-show still uses that token.</p>
      <div class="rp-membership-status-card"><span>${available} TOKEN${available === 1 ? '' : 'S'} AVAILABLE</span><strong>${nextExpiry ? `NEXT EXPIRY · ${nextExpiry.toUpperCase()}` : '90-DAY TOKEN VALIDITY'}</strong></div>
      <button class="rp-membership-primary" type="button" data-membership-buy>BUY 4 MORE · ₱99</button>
      <button class="rp-membership-primary" type="button" data-membership-done>BACK TO REAL PLAY</button>
    `;
    content.querySelector('[data-membership-buy]')?.addEventListener('click', renderOffer);
    content.querySelector('[data-membership-done]')?.addEventListener('click', closeMembership);
  }

  function renderPending() {
    const payment = state?.membership?.payment || {};
    const method = payment.paymentMethod === 'cash' ? 'CASH' : 'GCASH';
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBERSHIP</p>
      <div class="rp-membership-pending-mark">•••</div>
      <h2 id="rp-membership-title">${method} PAYMENT PENDING.</h2>
      <p class="rp-membership-lede">Your 4 Play Tokens will be issued once Real Play confirms the ₱99 payment.</p>
      <div class="rp-membership-status-card"><span>₱99 · 4 PLAY TOKENS</span><strong>90-DAY VALIDITY AFTER ISSUE</strong></div>
      <button class="rp-membership-primary" type="button" data-membership-done>BACK TO REAL PLAY</button>
    `;
    content.querySelector('[data-membership-done]')?.addEventListener('click', closeMembership);
  }

  async function renderOffer() {
    const config = await loadPaymentConfig();
    selectedMethod = '';
    proofDataUrl = '';
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBERSHIP</p>
      <h2 id="rp-membership-title">4 PLAY TOKENS.</h2>
      <div class="rp-membership-price"><strong>₱99</strong><span>/ MONTH</span><small>₱24.75 / TOKEN</small></div>
      <div class="rp-membership-inclusions">
        <div><b>01</b><span><strong>4 PLAY TOKENS</strong><small>1 token secures 1 eligible Real Play session</small></span></div>
        <div><b>02</b><span><strong>90-DAY VALIDITY</strong><small>Unused tokens roll over until their individual expiry</small></span></div>
        <div><b>03</b><span><strong>CONFIRM WHEN YOU PLAY</strong><small>Membership does not automatically occupy a Sunday spot</small></span></div>
        <div><b>04</b><span><strong>NO-SHOW = TOKEN USED</strong><small>Cancel before the game starts to release the spot and token</small></span></div>
      </div>
      <div class="rp-membership-payment">
        <span class="rp-payment-label">1 · CHOOSE PAYMENT</span>
        <div class="rp-pay-methods">${paymentMethodCard('gcash', config?.gcash)}${paymentMethodCard('cash')}</div>
        <div class="rp-pay-detail" data-pay-detail></div>
        <div data-proof-step hidden>
          <span class="rp-payment-label">2 · UPLOAD GCASH SCREENSHOT</span>
          <label class="rp-proof-drop"><input type="file" accept="image/png,image/jpeg,image/webp" data-proof-input><strong data-proof-label>SELECT SCREENSHOT</strong><small>PNG, JPG or WEBP</small></label>
          <div class="rp-proof-preview" data-proof-preview hidden></div>
        </div>
        <button class="rp-membership-primary" type="button" data-submit-payment disabled>CONTINUE</button>
        <p class="rp-membership-submit-status" data-submit-status></p>
      </div>
    `;
    content.querySelectorAll('[data-pay-method]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedMethod = button.dataset.payMethod;
        renderPaymentSelection(config);
      });
    });
    content.querySelector('[data-proof-input]')?.addEventListener('change', handleProofFile);
    content.querySelector('[data-submit-payment]')?.addEventListener('click', submitPayment);
    renderPaymentSelection(config);
  }

  function renderPaymentSelection(config) {
    content.querySelectorAll('[data-pay-method]').forEach((button) => button.classList.toggle('selected', button.dataset.payMethod === selectedMethod));
    const detail = content.querySelector('[data-pay-detail]');
    const proofStep = content.querySelector('[data-proof-step]');
    const submit = content.querySelector('[data-submit-payment]');
    if (!detail || !submit) return;

    if (!selectedMethod) {
      detail.innerHTML = '<span>Choose GCash for prepaid confirmation or Cash if you will pay Real Play directly.</span>';
      if (proofStep) proofStep.hidden = true;
      submit.disabled = true;
      submit.textContent = 'CONTINUE';
      return;
    }

    if (selectedMethod === 'cash') {
      detail.innerHTML = '<strong>CASH</strong><span>Mark the ₱99 membership as cash pending. Your 4 tokens are issued only after Real Play confirms the cash was received.</span>';
      if (proofStep) proofStep.hidden = true;
      submit.disabled = false;
      submit.textContent = 'MARK CASH PAYMENT PENDING';
      return;
    }

    const gcash = config?.gcash || {};
    detail.innerHTML = `
      <strong>GCASH PAYMENT DETAILS</strong>
      ${gcash.account_name ? `<span>${gcash.account_name}</span>` : ''}
      ${gcash.number ? `<b>${gcash.number}</b>` : ''}
      ${gcash.qr_image ? `<img src="${gcash.qr_image}" alt="GCash payment QR code">` : ''}
      <small>Send exactly ₱99, then upload the screenshot.</small>
    `;
    if (proofStep) proofStep.hidden = false;
    submit.disabled = !proofDataUrl;
    submit.textContent = 'SUBMIT GCASH PAYMENT';
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read that screenshot.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('That screenshot could not be processed.'));
        image.onload = () => {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleProofFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const label = content.querySelector('[data-proof-label]');
    const preview = content.querySelector('[data-proof-preview]');
    try {
      if (label) label.textContent = 'PROCESSING…';
      proofDataUrl = await compressImage(file);
      if (label) label.textContent = 'SCREENSHOT READY ✓';
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${proofDataUrl}" alt="GCash screenshot preview">`;
      }
      const submit = content.querySelector('[data-submit-payment]');
      if (submit && selectedMethod === 'gcash') submit.disabled = false;
    } catch (error) {
      proofDataUrl = '';
      if (label) label.textContent = 'SELECT SCREENSHOT';
      const status = content.querySelector('[data-submit-status]');
      if (status) status.textContent = error.message || 'Unable to process screenshot.';
    }
  }

  async function submitPayment() {
    const submit = content.querySelector('[data-submit-payment]');
    const status = content.querySelector('[data-submit-status]');
    if (!submit || !selectedMethod) return;
    if (selectedMethod === 'gcash' && !proofDataUrl) return;
    submit.disabled = true;
    submit.textContent = 'SUBMITTING…';
    if (status) status.textContent = '';
    try {
      await api('/api/real-play/membership/payment', {
        method: 'POST',
        body: {
          paymentMethod: selectedMethod,
          ...(selectedMethod === 'gcash' ? { proofImageDataUrl: proofDataUrl } : {}),
        },
      });
      await refreshState();
      renderMembership();
      window.dispatchEvent(new CustomEvent('realplay:membership-updated', { detail: state }));
    } catch (error) {
      if (status) status.textContent = error.message || 'Unable to submit payment.';
      submit.disabled = false;
      submit.textContent = selectedMethod === 'gcash' ? 'SUBMIT GCASH PAYMENT' : 'MARK CASH PAYMENT PENDING';
    }
  }

  function renderMembership() {
    const membership = state?.membership || {};
    const available = Number(state?.tokens?.available || 0);
    if (membership.status === 'pending') renderPending();
    else if (available > 0) renderActive();
    else renderOffer();
  }

  async function openMembership() {
    if (!authToken()) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-membership-open');
    content.innerHTML = '<div class="rp-membership-loading">LOADING REAL PLAY…</div>';
    try {
      await refreshState();
      renderMembership();
    } catch (error) {
      content.innerHTML = `<div class="rp-membership-loading">${error.message || 'Unable to load membership.'}</div>`;
    }
  }

  function closeMembership() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-membership-open');
  }

  overlay.querySelector('[data-membership-close]')?.addEventListener('click', closeMembership);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeMembership(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) closeMembership(); });
  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-membership-open], [data-rp-settings-action="membership"]');
    if (target) openMembership();
  });

  const observer = new MutationObserver(renderAccountCard);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.__realPlayOpenMembership = openMembership;
  window.__realPlayRefreshMembership = refreshState;
  refreshState().catch(() => {});
})();
