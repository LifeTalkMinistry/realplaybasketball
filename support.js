(() => {
  const API_BASE_URL = 'https://api.clarapmc.com';
  const ENDPOINT = `${API_BASE_URL}/api/real-play/support/plans`;
  const PAYMENT_CONFIG_URL = `${API_BASE_URL}/api/real-play/support/payment-config`;
  const ADMIN_PAYMENT_CONFIG_URL = `${API_BASE_URL}/api/real-play/admin/support/payment-config`;
  const TOKEN_KEY = 'real_play_access_token';
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

  let paymentConfig = emptyPaymentConfig();
  let adminAccess = null;
  let adminAccessToken = '';
  submit.textContent = originalSubmitText;

  function emptyPaymentConfig() {
    return {
      gcash: { enabled: true, account_name: '', number: '', qr_image: '' },
      maya: { enabled: true, account_name: '', number: '', qr_image: '' },
      cash_on_hand: { enabled: true },
    };
  }

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
      methodNote.innerHTML = '<strong>MAYA</strong><span>Continue to payment. Real Play’s current Maya receiving details will appear in Step 2.</span>';
    } else {
      methodNote.innerHTML = '<strong>GCASH</strong><span>Continue to payment. Real Play’s current GCash receiving details will appear in Step 2.</span>';
    }
    syncChoiceStates();
  }

  async function loadPaymentConfig() {
    try {
      const response = await fetch(PAYMENT_CONFIG_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Payment configuration unavailable.');
      const data = await response.json();
      paymentConfig = { ...emptyPaymentConfig(), ...(data || {}) };
    } catch (_error) {
      paymentConfig = emptyPaymentConfig();
    }
  }

  async function loadAdminPaymentConfig() {
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      adminAccess = false;
      adminAccessToken = '';
      return null;
    }

    if (adminAccessToken === token && adminAccess === true) {
      return { admin: true, paymentConfig };
    }

    adminAccessToken = token;
    try {
      const response = await fetch(ADMIN_PAYMENT_CONFIG_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        adminAccess = false;
        return null;
      }
      if (!response.ok) throw new Error('Admin payment settings are unavailable.');

      const data = await response.json();
      adminAccess = Boolean(data?.admin);
      if (data?.paymentConfig) {
        paymentConfig = { ...emptyPaymentConfig(), ...data.paymentConfig };
      }
      return adminAccess ? data : null;
    } catch (_error) {
      adminAccess = false;
      return null;
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
        ? `<div class="support-recipient"><span>${label} NUMBER</span><strong>${escapeHtml(config.number)}</strong></div>`
        : '';
      const accountName = config.account_name
        ? `<div class="support-recipient"><span>ACCOUNT NAME</span><strong>${escapeHtml(config.account_name)}</strong></div>`
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
        <h4>${label} receiving details are not published yet.</h4>
        <p>Your support plan is saved. The verified Real Play ${label} QR or recipient number will appear here as soon as the admin adds it.</p>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read that image.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to open that image.'));
      image.src = src;
    });
  }

  async function prepareQrImage(file) {
    if (!file) return '';
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) {
      throw new Error('Upload a PNG, JPG, JPEG, or WEBP image.');
    }
    if (file.size > 6 * 1024 * 1024) {
      throw new Error('Choose a QR image smaller than 6 MB.');
    }

    const raw = await readFileAsDataUrl(file);
    const image = await loadImage(raw);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare that QR image.');
    context.drawImage(image, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 1.8 * 1024 * 1024) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    }
    if (dataUrl.length > 2 * 1024 * 1024) {
      throw new Error('That image is still too large. Crop it closer to the QR code and try again.');
    }
    return dataUrl;
  }

  async function attachAdminPaymentEditor(body, method, payload) {
    if (!['gcash', 'maya'].includes(method)) return;
    const adminData = await loadAdminPaymentConfig();
    if (!adminData?.admin) return;

    const config = methodConfig(method);
    const label = method === 'maya' ? 'MAYA' : 'GCASH';
    const editor = document.createElement('div');
    editor.className = 'support-admin-editor';
    editor.innerHTML = `
      <div class="support-admin-editor-head">
        <span class="support-admin-badge">ADMIN PAYMENT SETUP</span>
        <strong>Manage ${label}</strong>
        <small>Only the authorized Real Play admin can see and save this panel.</small>
      </div>
      <div class="support-admin-field-grid">
        <label class="support-admin-field">
          <span>ACCOUNT NAME</span>
          <input type="text" data-admin-account-name maxlength="120" value="${escapeHtml(config.account_name || '')}" placeholder="Name shown in ${label}" />
        </label>
        <label class="support-admin-field">
          <span>${label} NUMBER</span>
          <input type="text" data-admin-recipient-number maxlength="64" value="${escapeHtml(config.number || '')}" placeholder="09XX XXX XXXX" />
        </label>
      </div>
      <label class="support-admin-upload">
        <span>UPLOAD ${label} QR</span>
        <input type="file" data-admin-qr-file accept="image/png,image/jpeg,image/webp" />
        <strong>CHOOSE QR IMAGE</strong>
        <small>PNG, JPG, or WEBP. The image will be optimized before it is saved.</small>
      </label>
      <div class="support-admin-preview" data-admin-qr-preview ${config.qr_image ? '' : 'hidden'}>
        ${config.qr_image ? `<img src="${config.qr_image}" alt="Current ${label} QR preview" />` : ''}
      </div>
      <button type="button" class="support-admin-save" data-admin-payment-save>SAVE ${label} DETAILS</button>
      <p class="support-admin-status" data-admin-payment-status aria-live="polite"></p>
    `;

    body.append(editor);

    const accountNameInput = editor.querySelector('[data-admin-account-name]');
    const numberInput = editor.querySelector('[data-admin-recipient-number]');
    const fileInput = editor.querySelector('[data-admin-qr-file]');
    const previewWrap = editor.querySelector('[data-admin-qr-preview]');
    const saveButton = editor.querySelector('[data-admin-payment-save]');
    const adminStatus = editor.querySelector('[data-admin-payment-status]');
    let nextQrDataUrl = config.qr_image || '';

    function setAdminStatus(message = '', type = '') {
      adminStatus.textContent = message;
      adminStatus.className = `support-admin-status${type ? ` ${type}` : ''}`;
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      setAdminStatus('Preparing QR image...');
      try {
        nextQrDataUrl = await prepareQrImage(file);
        previewWrap.hidden = false;
        previewWrap.innerHTML = `<img src="${nextQrDataUrl}" alt="New ${label} QR preview" />`;
        setAdminStatus('QR image ready to save.', 'success');
      } catch (error) {
        fileInput.value = '';
        setAdminStatus(error.message || 'QR image could not be prepared.', 'error');
      }
    });

    saveButton.addEventListener('click', async () => {
      const token = window.localStorage.getItem(TOKEN_KEY) || '';
      if (!token) {
        setAdminStatus('Log in again before saving payment details.', 'error');
        return;
      }

      const accountName = String(accountNameInput.value || '').trim();
      const number = String(numberInput.value || '').trim();
      if (!accountName && !number && !nextQrDataUrl) {
        setAdminStatus(`Add at least an account name, ${label} number, or QR image.`, 'error');
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = 'SAVING...';
      setAdminStatus('');

      try {
        const response = await fetch(ADMIN_PAYMENT_CONFIG_URL, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            method,
            enabled: true,
            account_name: accountName,
            number,
            qr_image_data_url: nextQrDataUrl,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(data?.message || `${label} details could not be saved.`);
        }

        paymentConfig = { ...emptyPaymentConfig(), ...(data.paymentConfig || {}) };
        adminAccess = true;
        setAdminStatus(`${label} payment details saved.`, 'success');
        renderPaymentStep(payload);
      } catch (error) {
        setAdminStatus(error.message || `${label} details could not be saved.`, 'error');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = `SAVE ${label} DETAILS`;
      }
    });
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
      attachAdminPaymentEditor(body, payload.payment_method, payload);
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

      await loadPaymentConfig();
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
