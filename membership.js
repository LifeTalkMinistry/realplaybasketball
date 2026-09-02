(() => {
  if (document.querySelector('[data-rp-membership-overlay]')) return;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const MEMBERSHIP_PRICE = 399;
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
  const closeButton = overlay.querySelector('[data-membership-close]');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const authToken = token();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || 'Unable to complete this Real Play action.');
      error.code = data?.code || null;
      error.details = data?.details || null;
      throw error;
    }
    return data;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date);
  }

  function membership() {
    return state?.membership || { status: 'free', active: false, amountPhp: MEMBERSHIP_PRICE };
  }

  function relabelAuth() {
    const kicker = document.querySelector('.auth-kicker');
    const signupTab = document.querySelector('[data-auth-tab="signup"]');
    const signupSubmit = document.querySelector('[data-auth-signup-form] button[type="submit"]');
    const completeSubmit = document.querySelector('[data-auth-complete-form] button[type="submit"]');
    if (kicker) kicker.textContent = 'REAL PLAY PLAYER ACCESS';
    if (signupTab) signupTab.textContent = 'CREATE FREE PLAYER';
    if (signupSubmit) signupSubmit.textContent = 'CREATE MY PLAYER';
    if (completeSubmit) completeSubmit.textContent = 'CREATE MY PLAYER';
  }

  function ensureAccountMembershipCard() {
    const accountCard = document.querySelector('.auth-account-card');
    if (!accountCard) return null;
    let card = document.querySelector('[data-auth-membership-card]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'auth-membership-card';
      card.dataset.authMembershipCard = 'true';
      card.addEventListener('click', openMembership);
      accountCard.insertAdjacentElement('afterend', card);
    }
    return card;
  }

  function renderAccountMembership() {
    const card = ensureAccountMembershipCard();
    if (!card) return;
    const m = membership();
    const status = m.active ? 'ACTIVE MEMBER' : m.status === 'pending' ? 'PAYMENT UNDER REVIEW' : m.status === 'expired' ? 'MEMBERSHIP EXPIRED' : 'FREE PLAYER';
    const detail = m.active && m.validUntil
      ? `ACTIVE THROUGH ${formatDate(m.validUntil).toUpperCase()}`
      : m.status === 'pending'
        ? 'WE’LL UNLOCK SCHEDULE BOOKING AFTER VERIFICATION'
        : 'ACTIVATE ₱399/MONTH TO SECURE OFFICIAL SUNDAY SLOTS';
    card.innerHTML = `<span>${status}</span><strong>${detail}</strong><b>→</b>`;
    card.classList.toggle('active', Boolean(m.active));
    card.classList.toggle('pending', m.status === 'pending');
  }

  function isSessionTerminal(action) {
    const text = String(action?.textContent || '').toUpperCase();
    return text.includes('SESSION FULL') || text.includes('LIVE') || text.includes('FINAL') || text.includes('YOU’RE IN');
  }

  function syncCareerAction() {
    const action = document.querySelector('[data-session-action]');
    if (!action || !token() || isSessionTerminal(action)) return;
    const m = membership();
    if (m.active) {
      if (action.dataset.membershipGate === 'true') {
        action.dataset.membershipGate = 'false';
        action.disabled = false;
        action.textContent = 'PLAY';
      }
      return;
    }
    action.dataset.membershipGate = 'true';
    if (m.status === 'pending') {
      action.disabled = true;
      action.textContent = 'PAYMENT UNDER REVIEW';
    } else {
      action.disabled = false;
      action.textContent = m.status === 'expired' ? 'RENEW MEMBERSHIP' : 'ACTIVATE MEMBERSHIP';
    }
  }

  function syncPlusOnePrompt() {
    const action = document.querySelector('[data-session-action]');
    if (!action) return;
    let prompt = document.querySelector('[data-plus-one-prompt]');
    const joined = String(action.textContent || '').toUpperCase().includes('YOU’RE IN');
    if (!membership().active || !joined) {
      prompt?.remove();
      return;
    }
    if (!prompt) {
      prompt = document.createElement('button');
      prompt.type = 'button';
      prompt.className = 'rp-plus-one-prompt';
      prompt.dataset.plusOnePrompt = 'true';
      action.insertAdjacentElement('afterend', prompt);
      prompt.addEventListener('click', () => openMembership(true));
    }
    prompt.textContent = state?.plusOne ? `PLUS 1 · ${state.plusOne.toUpperCase()} ✓` : '+ ADD YOUR PLUS 1 SUBSTITUTE';
  }

  function syncUI() {
    renderAccountMembership();
    syncCareerAction();
    syncPlusOnePrompt();
  }

  async function refreshState() {
    if (!token() || refreshing) {
      if (!token()) {
        state = null;
        syncUI();
      }
      return state;
    }
    refreshing = true;
    try {
      state = await api('/api/real-play/membership');
    } catch (_error) {
      // Keep the existing app usable if the membership service is temporarily unavailable.
    } finally {
      refreshing = false;
      syncUI();
    }
    return state;
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

  function paymentMethodCard(method, config) {
    const label = method === 'maya' ? 'MAYA' : 'GCASH';
    const detail = config?.account_name || config?.number
      ? `${config.account_name || ''}${config.account_name && config.number ? ' · ' : ''}${config.number || ''}`
      : 'Ask Real Play admin for payment details.';
    return `<button class="rp-pay-method${selectedMethod === method ? ' selected' : ''}" type="button" data-pay-method="${method}" ${config?.enabled === false ? 'disabled' : ''}><span>${label}</span><strong>${detail}</strong></button>`;
  }

  function renderActive() {
    const m = membership();
    const plusOne = state?.plusOne || '';
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBER</p>
      <div class="rp-membership-active-mark">✓</div>
      <h2 id="rp-membership-title">MEMBERSHIP ACTIVE.</h2>
      <p class="rp-membership-lede">Your official weekly Real Play booking access is unlocked.</p>
      <div class="rp-membership-status-card"><span>₱399 / MONTH</span><strong>${m.validUntil ? `ACTIVE THROUGH ${formatDate(m.validUntil).toUpperCase()}` : 'ACTIVE'}</strong></div>
      <div class="rp-plus-one-box">
        <span>YOUR PLUS 1 SUBSTITUTE</span>
        <p>Your Plus 1 can rotate into your playing slot. Their play does not create Career stats.</p>
        <div class="rp-plus-one-row"><input data-plus-one-input maxlength="60" placeholder="Guest name" value="${plusOne.replace(/"/g, '&quot;')}"><button type="button" data-plus-one-save>${plusOne ? 'UPDATE' : 'ADD'}</button></div>
        <small data-plus-one-status>${plusOne ? `${plusOne} is attached to your current reserved slot.` : 'Secure your Sunday spot first, then add your guest here.'}</small>
      </div>
      <button class="rp-membership-primary" type="button" data-membership-done>BACK TO REAL PLAY</button>
    `;
    content.querySelector('[data-membership-done]')?.addEventListener('click', closeMembership);
    content.querySelector('[data-plus-one-save]')?.addEventListener('click', savePlusOne);
  }

  function renderPending() {
    const m = membership();
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBERSHIP</p>
      <div class="rp-membership-pending-mark">•••</div>
      <h2 id="rp-membership-title">PAYMENT UNDER REVIEW.</h2>
      <p class="rp-membership-lede">We received your payment screenshot. Your Sunday booking unlocks as soon as Real Play confirms it.</p>
      <div class="rp-membership-status-card"><span>₱${m.amountPhp || MEMBERSHIP_PRICE} / MONTH</span><strong>VERIFICATION IN PROGRESS</strong></div>
      <p class="rp-membership-fine">You can keep using your free player account, profile and Career area while your payment is being checked.</p>
      <button class="rp-membership-primary" type="button" data-membership-done>BACK TO REAL PLAY</button>
    `;
    content.querySelector('[data-membership-done]')?.addEventListener('click', closeMembership);
  }

  async function renderOffer() {
    const m = membership();
    const config = await loadPaymentConfig();
    const latestRejected = m.payment?.status === 'rejected';
    content.innerHTML = `
      <p class="rp-membership-kicker">REAL PLAY MEMBERSHIP</p>
      <h2 id="rp-membership-title">YOUR SUNDAY BASKETBALL.<br><span>READY EVERY WEEK.</span></h2>
      <div class="rp-membership-price"><strong>₱399</strong><span>/ MONTH</span><small>AROUND ₱100 / WEEK</small></div>
      <div class="rp-membership-inclusions">
        <div><b>01</b><span><strong>WEEKLY REAL PLAY</strong><small>One official playing slot on scheduled Sundays</small></span></div>
        <div><b>02</b><span><strong>OFFICIAL CAREER</strong><small>PTS · AST · REB · TO · W/L · OVR eligibility</small></span></div>
        <div><b>03</b><span><strong>YOUR PLAYER HISTORY</strong><small>Profile, Play Time, games and community recognition</small></span></div>
        <div><b>04</b><span><strong>BRING A PLUS 1</strong><small>Your guest can substitute into your one playing slot</small></span></div>
        <div><b>05</b><span><strong>GAME FOOTAGE</strong><small>Recorded Real Play games when media is available</small></span></div>
      </div>
      ${latestRejected ? `<div class="rp-membership-alert"><strong>PAYMENT NEEDS ATTENTION</strong><span>${m.payment?.reviewNote || 'Your previous screenshot could not be verified. Submit a new proof below.'}</span></div>` : ''}
      <div class="rp-membership-payment">
        <span class="rp-payment-label">1 · CHOOSE HOW YOU PAID</span>
        <div class="rp-pay-methods">${paymentMethodCard('gcash', config?.gcash)}${paymentMethodCard('maya', config?.maya)}</div>
        <div class="rp-pay-detail" data-pay-detail></div>
        <span class="rp-payment-label">2 · UPLOAD PAYMENT SCREENSHOT</span>
        <label class="rp-proof-drop"><input type="file" accept="image/png,image/jpeg,image/webp" data-proof-input><strong data-proof-label>SELECT SCREENSHOT</strong><small>PNG, JPG or WEBP · processed securely before upload</small></label>
        <div class="rp-proof-preview" data-proof-preview hidden></div>
        <button class="rp-membership-primary" type="button" data-submit-payment disabled>SUBMIT FOR VERIFICATION</button>
        <p class="rp-membership-submit-status" data-submit-status></p>
      </div>
      <p class="rp-membership-fine">Creating a Real Play player account is free. Membership is only required to secure official weekly game slots.</p>
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
    const selected = selectedMethod ? config?.[selectedMethod] : null;
    if (detail) {
      if (!selectedMethod) {
        detail.innerHTML = '<span>Select GCash or Maya to see the payment details.</span>';
      } else if (selected?.account_name || selected?.number || selected?.qr_image) {
        detail.innerHTML = `
          <strong>${selectedMethod === 'maya' ? 'MAYA' : 'GCASH'} PAYMENT DETAILS</strong>
          ${selected.account_name ? `<span>${selected.account_name}</span>` : ''}
          ${selected.number ? `<b>${selected.number}</b>` : ''}
          ${selected.qr_image ? `<img src="${selected.qr_image}" alt="${selectedMethod === 'maya' ? 'Maya' : 'GCash'} payment QR code">` : ''}
          <small>Pay exactly ₱399, then upload your payment screenshot below.</small>
        `;
      } else {
        detail.innerHTML = '<strong>PAYMENT DETAILS</strong><span>Real Play payment details are not configured here yet. Ask the admin assisting you, then upload your screenshot after payment.</span>';
      }
    }
    syncSubmitButton();
  }

  function syncSubmitButton() {
    const submit = content.querySelector('[data-submit-payment]');
    if (submit) submit.disabled = !(selectedMethod && proofDataUrl);
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
    const label = content.querySelector('[data-proof-label]');
    const preview = content.querySelector('[data-proof-preview]');
    const status = content.querySelector('[data-submit-status]');
    if (!file) return;
    try {
      if (label) label.textContent = 'PROCESSING…';
      if (status) status.textContent = '';
      proofDataUrl = await compressImage(file);
      if (label) label.textContent = 'SCREENSHOT READY ✓';
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${proofDataUrl}" alt="Payment screenshot preview">`;
      }
      syncSubmitButton();
    } catch (error) {
      proofDataUrl = '';
      if (label) label.textContent = 'SELECT SCREENSHOT';
      if (status) status.textContent = error.message || 'Unable to process screenshot.';
      syncSubmitButton();
    }
  }

  async function submitPayment() {
    const submit = content.querySelector('[data-submit-payment]');
    const status = content.querySelector('[data-submit-status]');
    if (!selectedMethod || !proofDataUrl || !submit) return;
    submit.disabled = true;
    submit.textContent = 'SUBMITTING…';
    if (status) status.textContent = '';
    try {
      await api('/api/real-play/membership/payment', {
        method: 'POST',
        body: { paymentMethod: selectedMethod, proofImageDataUrl: proofDataUrl },
      });
      selectedMethod = '';
      proofDataUrl = '';
      await refreshState();
      renderMembership();
    } catch (error) {
      if (status) status.textContent = error.message || 'Unable to submit payment proof.';
      submit.disabled = false;
      submit.textContent = 'SUBMIT FOR VERIFICATION';
    }
  }

  async function savePlusOne() {
    const input = content.querySelector('[data-plus-one-input]');
    const button = content.querySelector('[data-plus-one-save]');
    const status = content.querySelector('[data-plus-one-status]');
    if (!input || !button) return;
    button.disabled = true;
    button.textContent = 'SAVING…';
    try {
      const result = await api('/api/real-play/career/plus-one', { method: 'POST', body: { name: input.value.trim() } });
      state.plusOne = result.plusOne || null;
      if (status) status.textContent = result.message || 'Plus 1 saved.';
      syncPlusOnePrompt();
      button.textContent = state.plusOne ? 'UPDATE' : 'ADD';
    } catch (error) {
      if (status) status.textContent = error.message || 'Unable to save Plus 1.';
      button.textContent = state?.plusOne ? 'UPDATE' : 'ADD';
    } finally {
      button.disabled = false;
    }
  }

  function renderMembership() {
    const m = membership();
    if (m.active) renderActive();
    else if (m.status === 'pending') renderPending();
    else renderOffer();
  }

  async function openMembership(focusPlusOne = false) {
    if (!token()) {
      document.querySelector('[data-auth-open]')?.click();
      return;
    }
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-membership-open');
    content.innerHTML = '<div class="rp-membership-loading">LOADING REAL PLAY…</div>';
    await refreshState();
    renderMembership();
    if (focusPlusOne) window.setTimeout(() => content.querySelector('[data-plus-one-input]')?.focus(), 60);
  }

  function closeMembership() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-membership-open');
  }

  closeButton.addEventListener('click', closeMembership);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeMembership(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) closeMembership(); });

  document.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-session-action]');
    if (!action || !token() || membership().active || isSessionTerminal(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMembership();
  }, true);

  const observer = new MutationObserver(() => {
    relabelAuth();
    syncUI();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

  window.addEventListener('focus', refreshState);
  window.addEventListener('storage', (event) => { if (event.key === TOKEN_KEY) refreshState(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); });

  relabelAuth();
  refreshState();
  window.setInterval(() => { if (token()) refreshState(); }, 15000);
})();
