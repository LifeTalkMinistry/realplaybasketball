(() => {
  const ENDPOINT = 'https://api.clarapmc.com/api/real-play/support/plans';
  const TOKEN_KEY = 'real_play_access_token';
  const PAYMENT_CONFIG_URL = 'data/support-payment.json';
  const form = document.querySelector('[data-support-form]');
  if (!form) return;

  const status = form.querySelector('[data-support-status]');
  const customAmount = form.querySelector('[data-support-custom-amount]');
  const amountButtons = [...form.querySelectorAll('[data-support-amount]')];
  const weeklyWrap = form.querySelector('[data-support-weekly]');
  const monthlyWrap = form.querySelector('[data-support-monthly]');
  const consent = form.querySelector('[data-support-consent]');
  const preview = form.querySelector('[data-support-reminder-preview]');
  const previewValue = form.querySelector('[data-support-next-reminder]');
  const methodNote = form.querySelector('[data-support-method-note]');
  const emailInput = form.querySelector('input[name="email"]');
  const submit = form.querySelector('.support-submit');
  const originalSubmitText = 'CONTINUE TO PAYMENT';

  let paymentConfig = null;
  submit.textContent = originalSubmitText;

  function setStatus(message = '', type = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `support-form-status${type ? ` ${type}` : ''}`;
  }

  function selected(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }

  function methodConfig(method) {
    return paymentConfig?.[method] || {};
  }

  function isMethodReady(method) {
    return ['gcash', 'maya', 'cash_on_hand'].includes(method);
  }

  function hasDigitalDestination(method) {
    const config = methodConfig(method);
    return Boolean(config.qr_image || config.number);
  }

  function syncChoiceStates() {
    form.querySelectorAll('.support-choice').forEach((label) => {
      label.classList.toggle('active', Boolean(label.querySelector('input:checked')));
    });
    form.querySelectorAll('.support-method').forEach((label) => {
      label.classList.toggle('active', Boolean(label.querySelector('input:checked')));
    });
  }

  function nextWeekly(day) {
    const now = new Date();
    const target = new Date(now);
    const delta = (Number(day) - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + delta);
    target.setHours(9, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
    return target;
  }

  function nextMonthly(day) {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), Number(day), 9, 0, 0, 0);
    if (target <= now) target = new Date(now.getFullYear(), now.getMonth() + 1, Number(day), 9, 0, 0, 0);
    return target;
  }

  function renderPreview() {
    const frequency = selected('frequency');
    if (frequency === 'one_time') {
      preview.hidden = true;
      return;
    }
    const target = frequency === 'weekly'
      ? nextWeekly(form.weekly_day.value)
      : nextMonthly(form.monthly_day.value);
    preview.hidden = false;
    previewValue.textContent = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(target);
  }

  function syncFrequency() {
    const frequency = selected('frequency');
    weeklyWrap.hidden = frequency !== 'weekly';
    monthlyWrap.hidden = frequency !== 'monthly';
    consent.hidden = frequency === 'one_time';
    const checkbox = consent.querySelector('input');
    checkbox.required = frequency !== 'one_time';
    if (frequency === 'one_time') checkbox.checked = false;
    renderPreview();
    syncChoiceStates();
  }

  function updateMethodLabel(method, readyText) {
    const input = form.querySelector(`input[name="payment_method"][value="${method}"]`);
    const label = input?.closest('.support-method');
    if (!input || !label) return;
    input.disabled = false;
    label.classList.remove('support-method-coming');
    const small = label.querySelector('small');
    if (small) small.textContent = readyText;
  }

  function syncPaymentAvailability() {
    updateMethodLabel('gcash', 'Digital transfer');
    updateMethodLabel('maya', 'Digital transfer');
    updateMethodLabel('cash_on_hand', 'Give personally');
    syncMethod();
  }

  function syncMethod() {
    const method = selected('payment_method');
    if (!methodNote) return;

    if (method === 'cash_on_hand') {
      methodNote.innerHTML = '<strong>CASH ON HAND</strong><span>Continue to the handoff step. Cash becomes official support only after an authorized Real Play organizer confirms it was physically received.</span>';
    } else if (method === 'maya') {
      methodNote.innerHTML = '<strong>MAYA</strong><span>Continue to payment. Maya stays available as a support option; the verified recipient details will be shown whenever they are configured.</span>';
    } else {
      methodNote.innerHTML = '<strong>GCASH</strong><span>Continue to payment. GCash stays available as a support option; the verified recipient details will be shown whenever they are configured.</span>';
    }
    syncChoiceStates();
  }

  async function loadPaymentConfig() {
    try {
      const response = await fetch(PAYMENT_CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Payment configuration unavailable.');
      paymentConfig = await response.json();
    } catch (_error) {
      paymentConfig = {
        gcash: { enabled: true },
        maya: { enabled: true },
        cash_on_hand: { enabled: true },
      };
    }
  }

  function peso(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  }

  function frequencyLabel(frequency) {
    if (frequency === 'weekly') return 'Weekly support';
    if (frequency === 'monthly') return 'Monthly support';
    return 'One-time support';
  }

  function paymentMethodLabel(method) {
    if (method === 'cash_on_hand') return 'Cash on Hand';
    if (method === 'maya') return 'Maya';
    return 'GCash';
  }

  function ensurePaymentStep() {
    let step = form.querySelector('[data-support-payment-step]');
    if (step) return step;

    step = document.createElement('section');
    step.className = 'support-payment-step';
    step.dataset.supportPaymentStep = '';
    step.hidden = true;
    step.innerHTML = `
      <div class="support-payment-head">
        <span>STEP 2</span>
        <strong>COMPLETE YOUR SUPPORT</strong>
      </div>
      <div class="support-payment-summary" data-support-payment-summary></div>
      <div class="support-payment-body" data-support-payment-body></div>
      <div class="support-payment-actions">
        <button type="button" class="support-payment-back" data-support-payment-back>CHANGE DETAILS</button>
      </div>
    `;

    form.append(step);
    step.querySelector('[data-support-payment-back]').addEventListener('click', () => {
      form.classList.remove('support-payment-mode');
      step.hidden = true;
      setStatus('');
      submit.textContent = originalSubmitText;
      submit.disabled = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return step;
  }

  function renderDigitalPayment(body, payload, method) {
    const config = methodConfig(method);
    const label = method === 'maya' ? 'MAYA' : 'GCASH';

    if (hasDigitalDestination(method)) {
      const qr = config.qr_image
        ? `<img class="support-gcash-qr" src="${config.qr_image}" alt="Real Play verified ${label} QR code" />`
        : '';
      const recipient = config.number
        ? `<div class="support-recipient"><span>${label} NUMBER</span><strong>${config.number}</strong></div>`
        : '';
      const accountName = config.account_name
        ? `<div class="support-recipient"><span>ACCOUNT NAME</span><strong>${config.account_name}</strong></div>`
        : '';

      body.innerHTML = `
        <div class="support-pay-state ready">
          <span>PAY WITH ${label}</span>
          <h4>Send ${peso(payload.amount_php)} now.</h4>
          <p>Use the verified Real Play ${label} details below and verify the recipient before sending.</p>
          ${qr}
          <div class="support-recipient-grid">${accountName}${recipient}</div>
          <div class="support-pay-callout">AFTER SENDING, KEEP YOUR ${label} REFERENCE NUMBER. REAL PLAY COUNTS SUPPORT ONLY AFTER THE MONEY IS RECEIVED AND VERIFIED.</div>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="support-pay-state pending">
        <span>${label} SELECTED</span>
        <h4>Your ${label} support plan is saved.</h4>
        <p>${label} remains an available support method. The verified receiving number or QR has not been entered on the site yet, so no destination is shown here today.</p>
        <div class="support-pay-callout">YOU CAN KEEP THIS SUPPORT PLAN. ONCE THE VERIFIED ${label} DETAILS ARE ADDED, THIS PAYMENT STEP WILL SHOW THEM.</div>
      </div>
    `;
  }

  function renderPaymentStep(payload) {
    const step = ensurePaymentStep();
    const summary = step.querySelector('[data-support-payment-summary]');
    const body = step.querySelector('[data-support-payment-body]');

    summary.innerHTML = `
      <div><span>AMOUNT</span><strong>${peso(payload.amount_php)}</strong></div>
      <div><span>PLAN</span><strong>${frequencyLabel(payload.frequency)}</strong></div>
      <div><span>METHOD</span><strong>${paymentMethodLabel(payload.payment_method)}</strong></div>
    `;

    if (payload.payment_method === 'cash_on_hand') {
      body.innerHTML = `
        <div class="support-pay-state ready">
          <span>READY FOR HANDOFF</span>
          <h4>Give ${peso(payload.amount_php)} personally.</h4>
          <p>Hand the cash to an authorized Real Play organizer. Your support plan is recorded, but this amount enters the Community Fund only after the cash is physically received and confirmed.</p>
          <div class="support-pay-callout">NO DIGITAL PAYMENT IS REQUIRED FOR CASH ON HAND.</div>
        </div>
      `;
    } else {
      renderDigitalPayment(body, payload, payload.payment_method);
    }

    step.hidden = false;
    form.classList.add('support-payment-mode');
    setStatus('');
    step.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  amountButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const amount = Number(button.dataset.supportAmount);
      customAmount.value = String(amount);
      amountButtons.forEach((item) => item.classList.toggle('active', item === button));
    });
  });

  customAmount.addEventListener('input', () => {
    const amount = Number(customAmount.value);
    amountButtons.forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.supportAmount) === amount);
    });
  });

  form.querySelectorAll('input[name="frequency"]').forEach((input) => input.addEventListener('change', syncFrequency));
  form.querySelectorAll('input[name="payment_method"]').forEach((input) => input.addEventListener('change', syncMethod));
  form.querySelectorAll('select').forEach((select) => select.addEventListener('change', renderPreview));

  const profileEmail = document.querySelector('[data-auth-account-email]');
  if (profileEmail?.textContent?.trim() && !emailInput.value) {
    emailInput.value = profileEmail.textContent.trim();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const frequency = selected('frequency');
    const paymentMethod = selected('payment_method');
    const amount = Number(customAmount.value);
    const email = String(emailInput.value || '').trim();
    const emailOptIn = Boolean(form.querySelector('input[name="email_opt_in"]')?.checked);

    if (!paymentMethod || !isMethodReady(paymentMethod)) {
      setStatus('Choose GCash, Maya, or Cash on Hand to continue.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus('Enter a valid support amount.', 'error');
      return;
    }
    if (!email || !emailInput.checkValidity()) {
      setStatus('Enter a valid email address.', 'error');
      return;
    }
    if (frequency !== 'one_time' && !emailOptIn) {
      setStatus('Please agree to email reminders for recurring support.', 'error');
      return;
    }

    const payload = {
      email,
      amount_php: amount,
      frequency,
      payment_method: paymentMethod,
      weekly_day: frequency === 'weekly' ? Number(form.weekly_day.value) : null,
      monthly_day: frequency === 'monthly' ? Number(form.monthly_day.value) : null,
      email_opt_in: frequency === 'one_time' ? false : emailOptIn,
    };

    submit.disabled = true;
    submit.textContent = 'PREPARING PAYMENT...';

    try {
      const token = window.localStorage.getItem(TOKEN_KEY) || '';
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(ENDPOINT, {
        method: 'POST', headers, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.message || 'Support plan could not be saved.');

      renderPaymentStep(payload);
    } catch (error) {
      setStatus(error?.message || 'Support plan could not be saved.', 'error');
      submit.disabled = false;
      submit.textContent = originalSubmitText;
    }
  });

  loadPaymentConfig().finally(() => {
    syncFrequency();
    syncPaymentAvailability();
  });
})();