(() => {
  const ADMIN_EMAIL = 'jeromemirabuenos62@gmail.com';
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_CONFIG_URL = `${API_BASE_URL}/api/real-play/support/payment-config`;
  const ADMIN_CONFIG_URL = `${API_BASE_URL}/api/real-play/admin/support/payment-config`;

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentAccountEmail() {
    return normalize(document.querySelector('[data-auth-account-email]')?.textContent);
  }

  function isVisibleAdmin() {
    return Boolean(window.localStorage.getItem(TOKEN_KEY)) && currentAccountEmail() === ADMIN_EMAIL;
  }

  function selectedMethod() {
    return document.querySelector('[data-support-form] input[name="payment_method"]:checked')?.value || '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function emptyConfig() {
    return {
      gcash: { enabled: true, account_name: '', number: '', qr_image: '' },
      maya: { enabled: true, account_name: '', number: '', qr_image: '' },
      cash_on_hand: { enabled: true },
    };
  }

  async function loadConfig() {
    try {
      const response = await fetch(PUBLIC_CONFIG_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return emptyConfig();
      const data = await response.json().catch(() => ({}));
      return { ...emptyConfig(), ...(data || {}) };
    } catch (_error) {
      return emptyConfig();
    }
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
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare that QR image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 1.8 * 1024 * 1024) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    }
    if (dataUrl.length > 2 * 1024 * 1024) {
      throw new Error('That image is still too large. Crop it closer to the QR code and try again.');
    }
    return dataUrl;
  }

  function renderPublishedState(body, method, config) {
    const label = method === 'maya' ? 'MAYA' : 'GCASH';
    const state = body.querySelector('.support-pay-state');
    if (!state) return;

    const qr = config.qr_image
      ? `<img class="support-gcash-qr" src="${config.qr_image}" alt="Real Play verified ${label} QR code" />`
      : '';
    const account = config.account_name
      ? `<div class="support-recipient"><span>ACCOUNT NAME</span><strong>${escapeHtml(config.account_name)}</strong></div>`
      : '';
    const number = config.number
      ? `<div class="support-recipient"><span>${label} NUMBER</span><strong>${escapeHtml(config.number)}</strong></div>`
      : '';

    state.className = 'support-pay-state ready';
    state.innerHTML = `
      <span>PAY WITH ${label}</span>
      <h4>${label} receiving details are live.</h4>
      <p>Supporters can now use the verified Real Play ${label} details below.</p>
      ${qr}
      <div class="support-recipient-grid">${account}${number}</div>
      <div class="support-pay-callout">VERIFY THE RECIPIENT BEFORE SENDING. ONLY MONEY ACTUALLY RECEIVED AND CONFIRMED COUNTS AS REAL PLAY SUPPORT.</div>
    `;
  }

  async function mountAdminEditor() {
    if (!isVisibleAdmin()) return;

    const body = document.querySelector('[data-support-payment-body]');
    if (!body || body.querySelector('.support-admin-editor')) return;

    const method = selectedMethod();
    if (!['gcash', 'maya'].includes(method)) return;

    const configSet = await loadConfig();
    if (!isVisibleAdmin()) return;
    if (!document.body.contains(body) || body.querySelector('.support-admin-editor')) return;

    const config = configSet[method] || {};
    const label = method === 'maya' ? 'MAYA' : 'GCASH';
    const editor = document.createElement('div');
    editor.className = 'support-admin-editor';
    editor.innerHTML = `
      <div class="support-admin-editor-head">
        <span class="support-admin-badge">ADMIN PAYMENT SETUP</span>
        <strong>Upload / Manage ${label}</strong>
        <small>Admin account: ${ADMIN_EMAIL}. This panel is hidden from regular users.</small>
      </div>
      <div class="support-admin-field-grid">
        <label class="support-admin-field">
          <span>ACCOUNT NAME</span>
          <input type="text" data-rp-admin-account maxlength="120" value="${escapeHtml(config.account_name || '')}" placeholder="Name shown in ${label}" />
        </label>
        <label class="support-admin-field">
          <span>${label} NUMBER</span>
          <input type="text" data-rp-admin-number maxlength="64" value="${escapeHtml(config.number || '')}" placeholder="09XX XXX XXXX" />
        </label>
      </div>
      <label class="support-admin-upload">
        <span>UPLOAD ${label} QR</span>
        <input type="file" data-rp-admin-file accept="image/png,image/jpeg,image/webp" />
        <strong>CHOOSE QR IMAGE</strong>
        <small>PNG, JPG, or WEBP. Choose the QR image from this device.</small>
      </label>
      <div class="support-admin-preview" data-rp-admin-preview ${config.qr_image ? '' : 'hidden'}>
        ${config.qr_image ? `<img src="${config.qr_image}" alt="Current ${label} QR preview" />` : ''}
      </div>
      <button type="button" class="support-admin-save" data-rp-admin-save>SAVE ${label} DETAILS</button>
      <p class="support-admin-status" data-rp-admin-status aria-live="polite"></p>
    `;
    body.append(editor);

    const accountInput = editor.querySelector('[data-rp-admin-account]');
    const numberInput = editor.querySelector('[data-rp-admin-number]');
    const fileInput = editor.querySelector('[data-rp-admin-file]');
    const preview = editor.querySelector('[data-rp-admin-preview]');
    const save = editor.querySelector('[data-rp-admin-save]');
    const status = editor.querySelector('[data-rp-admin-status]');
    let qrDataUrl = config.qr_image || '';

    function setStatus(message = '', type = '') {
      status.textContent = message;
      status.className = `support-admin-status${type ? ` ${type}` : ''}`;
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      setStatus('Preparing QR image...');
      try {
        qrDataUrl = await prepareQrImage(file);
        preview.hidden = false;
        preview.innerHTML = `<img src="${qrDataUrl}" alt="New ${label} QR preview" />`;
        setStatus('QR image ready. Press save to publish it.', 'success');
      } catch (error) {
        fileInput.value = '';
        setStatus(error.message || 'QR image could not be prepared.', 'error');
      }
    });

    save.addEventListener('click', async () => {
      const token = window.localStorage.getItem(TOKEN_KEY) || '';
      if (!token || !isVisibleAdmin()) {
        setStatus('Log in with the Real Play admin account first.', 'error');
        return;
      }

      const accountName = String(accountInput.value || '').trim();
      const number = String(numberInput.value || '').trim();
      if (!accountName && !number && !qrDataUrl) {
        setStatus(`Add an account name, ${label} number, or QR image first.`, 'error');
        return;
      }

      save.disabled = true;
      save.textContent = 'SAVING...';
      setStatus('');

      try {
        const response = await fetch(ADMIN_CONFIG_URL, {
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
            qr_image_data_url: qrDataUrl,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(data?.message || `${label} details could not be saved.`);
        }

        const nextConfig = data.paymentConfig?.[method] || {
          account_name: accountName,
          number,
          qr_image: qrDataUrl,
        };
        renderPublishedState(body, method, nextConfig);
        setStatus(`${label} details saved and published.`, 'success');
      } catch (error) {
        setStatus(error.message || `${label} details could not be saved.`, 'error');
      } finally {
        save.disabled = false;
        save.textContent = `SAVE ${label} DETAILS`;
      }
    });
  }

  let queued = false;
  function queueMount() {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      mountAdminEditor();
    }, 40);
  }

  const observer = new MutationObserver(queueMount);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  document.addEventListener('change', queueMount, true);
  window.addEventListener('hashchange', queueMount);
  queueMount();
})();