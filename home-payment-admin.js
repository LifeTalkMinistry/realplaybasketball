(() => {
  if (window.__realPlayHomePaymentAdminInstalled) return;
  window.__realPlayHomePaymentAdminInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_CONFIG_URL = `${API_BASE_URL}/api/real-play/support/payment-config`;
  const ADMIN_CONFIG_URL = `${API_BASE_URL}/api/real-play/admin/support/payment-config`;

  let configSet = emptyConfig();
  let activeMethod = 'gcash';
  let qrDataUrl = '';
  let loadingConfig = false;
  let mounted = false;

  function emptyConfig() {
    return {
      gcash: { enabled: true, account_name: '', number: '', qr_image: '' },
      maya: { enabled: true, account_name: '', number: '', qr_image: '' },
      cash_on_hand: { enabled: true },
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function labelFor(method) {
    if (method === 'maya') return 'MAYA';
    if (method === 'cash_on_hand') return 'CASH';
    return 'GCASH';
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-home-payment-admin-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomePaymentAdminStyle = '1';
    style.textContent = `
      .rp-home-payment-admin{margin-top:3px;padding:13px;border:1px solid rgba(86,215,246,.17);border-radius:14px;background:rgba(4,14,23,.72)}
      .rp-home-payment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      .rp-home-payment-head span{display:block;margin-bottom:4px;color:#55ddff;font:900 .5rem/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      .rp-home-payment-head strong{display:block;color:#eff8fd;font:900 .83rem/1.15 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.04em}
      .rp-home-payment-head small{display:block;margin-top:4px;color:#6e879a;font:700 .59rem/1.35 system-ui,sans-serif}
      .rp-home-payment-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:11px}
      .rp-home-payment-tab{min-height:38px;border:1px solid rgba(119,160,185,.18);border-radius:10px;background:#06101a;color:#8199aa;font:900 .58rem/1 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
      .rp-home-payment-tab.active{border-color:rgba(60,220,249,.55);background:#08202d;color:#78e9ff;box-shadow:inset 0 0 0 1px rgba(60,220,249,.08)}
      .rp-home-payment-panel{display:grid;gap:10px}
      .rp-home-payment-enabled{display:flex!important;grid-template-columns:none!important;align-items:center;justify-content:space-between;gap:10px;min-height:42px;padding:0 11px;border:1px solid rgba(114,164,193,.18);border-radius:10px;background:#06101a;color:#a9bac7!important}
      .rp-home-payment-enabled input{width:18px!important;min-height:18px!important;height:18px!important;margin:0;accent-color:#18c9e5}
      .rp-home-payment-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .rp-home-payment-upload{display:grid;gap:7px;padding:11px;border:1px dashed rgba(80,211,240,.32);border-radius:11px;background:rgba(4,19,29,.55);cursor:pointer}
      .rp-home-payment-upload input{position:absolute;width:1px!important;height:1px!important;min-height:1px!important;opacity:0;pointer-events:none}
      .rp-home-payment-upload strong{color:#8eeeff;font:900 .64rem/1.2 system-ui,sans-serif;letter-spacing:.07em}
      .rp-home-payment-upload small{color:#6f8798;font:700 .58rem/1.35 system-ui,sans-serif;text-transform:none;letter-spacing:0}
      .rp-home-payment-preview{display:flex;align-items:center;gap:10px;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#040b12}
      .rp-home-payment-preview[hidden]{display:none!important}
      .rp-home-payment-preview img{width:78px;height:78px;object-fit:contain;border-radius:8px;background:#fff}
      .rp-home-payment-preview div{min-width:0;color:#71899b;font:700 .59rem/1.35 system-ui,sans-serif}
      .rp-home-payment-preview strong{display:block;margin-bottom:3px;color:#dcebf4;font:900 .64rem/1.2 system-ui,sans-serif}
      .rp-home-payment-save{min-height:43px;border:1px solid rgba(65,226,255,.38);border-radius:11px;background:linear-gradient(180deg,#102936,#0a1c26);color:#76eaff;font:950 .6rem/1 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
      .rp-home-payment-save:disabled{opacity:.5;cursor:wait}
      .rp-home-payment-status{min-height:16px;margin:0;color:#7f9aac;font:700 .6rem/1.4 system-ui,sans-serif;text-transform:none;letter-spacing:0}
      .rp-home-payment-status.success{color:#7fe9bf}.rp-home-payment-status.error{color:#ff9b9b}
      .rp-home-payment-cash{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#06101a;color:#8399aa;font:700 .64rem/1.5 system-ui,sans-serif}
      .rp-home-payment-cash strong{display:block;margin-bottom:4px;color:#d9e7ef;font:900 .72rem/1.2 system-ui,sans-serif}
      @media(max-width:420px){.rp-home-payment-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function loadConfig() {
    if (loadingConfig) return configSet;
    loadingConfig = true;
    try {
      const response = await fetch(PUBLIC_CONFIG_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        configSet = { ...emptyConfig(), ...(data || {}) };
      }
    } catch (_error) {
      // Keep the current local defaults if the public config is temporarily unavailable.
    } finally {
      loadingConfig = false;
    }
    return configSet;
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
    if (dataUrl.length > 1.8 * 1024 * 1024) dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    if (dataUrl.length > 2 * 1024 * 1024) {
      throw new Error('That image is still too large. Crop it closer to the QR code and try again.');
    }
    return dataUrl;
  }

  function setStatus(message = '', type = '') {
    const status = document.querySelector('[data-rp-home-payment-status]');
    if (!status) return;
    status.textContent = message;
    status.className = `rp-home-payment-status${type ? ` ${type}` : ''}`;
  }

  function renderMethod() {
    const root = document.querySelector('[data-rp-home-payment-admin]');
    const panel = root?.querySelector('[data-rp-home-payment-panel]');
    if (!root || !panel) return;

    root.querySelectorAll('[data-rp-home-payment-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.rpHomePaymentTab === activeMethod);
    });

    if (activeMethod === 'cash_on_hand') {
      qrDataUrl = '';
      panel.innerHTML = `
        <div class="rp-home-payment-cash">
          <strong>CASH / ON-SITE PAYMENT</strong>
          Cash is already an available Real Play payment method and does not need a QR code or recipient number.
        </div>
        <p class="rp-home-payment-status" data-rp-home-payment-status></p>`;
      return;
    }

    const config = configSet[activeMethod] || {};
    const label = labelFor(activeMethod);
    qrDataUrl = config.qr_image || '';
    panel.innerHTML = `
      <label class="rp-home-payment-enabled">
        <span>ENABLE ${label}</span>
        <input type="checkbox" data-rp-home-payment-enabled ${config.enabled !== false ? 'checked' : ''}>
      </label>
      <div class="rp-home-payment-fields">
        <label>Account name<input type="text" data-rp-home-payment-account maxlength="120" value="${escapeHtml(config.account_name || '')}" placeholder="Name shown in ${label}"></label>
        <label>${label} number<input type="text" data-rp-home-payment-number maxlength="64" value="${escapeHtml(config.number || '')}" placeholder="09XX XXX XXXX"></label>
      </div>
      <label class="rp-home-payment-upload">
        <input type="file" data-rp-home-payment-file accept="image/png,image/jpeg,image/webp">
        <strong>${config.qr_image ? `REPLACE ${label} QR` : `UPLOAD ${label} QR`}</strong>
        <small>PNG, JPG, or WEBP. The image is resized before publishing.</small>
      </label>
      <div class="rp-home-payment-preview" data-rp-home-payment-preview ${config.qr_image ? '' : 'hidden'}>
        ${config.qr_image ? `<img src="${config.qr_image}" alt="Current ${label} QR preview"><div><strong>CURRENT QR</strong>Upload a new image above if you want to replace it.</div>` : ''}
      </div>
      <button type="button" class="rp-home-payment-save" data-rp-home-payment-save>SAVE ${label} PAYMENT</button>
      <p class="rp-home-payment-status" data-rp-home-payment-status aria-live="polite"></p>`;

    const fileInput = panel.querySelector('[data-rp-home-payment-file]');
    const preview = panel.querySelector('[data-rp-home-payment-preview]');
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      setStatus('Preparing QR image…');
      try {
        qrDataUrl = await prepareQrImage(file);
        if (preview) {
          preview.hidden = false;
          preview.innerHTML = `<img src="${qrDataUrl}" alt="New ${label} QR preview"><div><strong>NEW QR READY</strong>Press save to publish this QR.</div>`;
        }
        setStatus('QR image ready. Press save to publish it.', 'success');
      } catch (error) {
        fileInput.value = '';
        setStatus(error?.message || 'QR image could not be prepared.', 'error');
      }
    });

    panel.querySelector('[data-rp-home-payment-save]')?.addEventListener('click', saveMethod);
  }

  async function saveMethod(event) {
    const method = activeMethod;
    if (!['gcash', 'maya'].includes(method)) return;
    const root = document.querySelector('[data-rp-home-payment-admin]');
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    const label = labelFor(method);
    const button = event.currentTarget;
    if (!root || !token) {
      setStatus('Admin session is not available. Log in again.', 'error');
      return;
    }

    const accountName = String(root.querySelector('[data-rp-home-payment-account]')?.value || '').trim();
    const number = String(root.querySelector('[data-rp-home-payment-number]')?.value || '').trim();
    const enabled = Boolean(root.querySelector('[data-rp-home-payment-enabled]')?.checked);

    if (enabled && !accountName && !number && !qrDataUrl) {
      setStatus(`Add an account name, ${label} number, or QR image first.`, 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'SAVING…';
    setStatus('Publishing payment details…');

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
          enabled,
          account_name: accountName,
          number,
          qr_image_data_url: qrDataUrl,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || `${label} details could not be saved.`);
      }

      configSet = { ...emptyConfig(), ...(data.paymentConfig || configSet) };
      const next = configSet[method] || {};
      qrDataUrl = next.qr_image || qrDataUrl;
      setStatus(`${label} payment details saved and published.`, 'success');
      window.dispatchEvent(new CustomEvent('realplay:payment-config-changed', { detail: { method } }));
    } catch (error) {
      setStatus(error?.message || `${label} details could not be saved.`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = `SAVE ${label} PAYMENT`;
    }
  }

  async function refreshAndRender() {
    const root = document.querySelector('[data-rp-home-payment-admin]');
    if (!root) return;
    root.querySelector('[data-rp-home-payment-panel]').innerHTML = '<p class="rp-home-payment-status">Loading payment methods…</p>';
    await loadConfig();
    renderMethod();
  }

  function mount() {
    const form = document.querySelector('[data-rp-home-open-rank-edit-form]');
    if (!form) return false;
    if (form.querySelector('[data-rp-home-payment-admin]')) {
      mounted = true;
      return true;
    }

    ensureStyles();
    const section = document.createElement('section');
    section.className = 'rp-home-payment-admin';
    section.dataset.rpHomePaymentAdmin = '1';
    section.innerHTML = `
      <div class="rp-home-payment-head">
        <div>
          <span>PAYMENT METHODS</span>
          <strong>REAL PLAY PAYMENT SETUP</strong>
          <small>Upload or replace the QR code players see when paying.</small>
        </div>
      </div>
      <div class="rp-home-payment-tabs" role="tablist" aria-label="Payment methods">
        <button type="button" class="rp-home-payment-tab active" data-rp-home-payment-tab="gcash">GCASH</button>
        <button type="button" class="rp-home-payment-tab" data-rp-home-payment-tab="maya">MAYA</button>
        <button type="button" class="rp-home-payment-tab" data-rp-home-payment-tab="cash_on_hand">CASH</button>
      </div>
      <div class="rp-home-payment-panel" data-rp-home-payment-panel>
        <p class="rp-home-payment-status">Loading payment methods…</p>
      </div>`;

    const status = form.querySelector('[data-rp-home-open-rank-edit-status]');
    if (status) form.insertBefore(section, status);
    else form.appendChild(section);

    section.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-rp-home-payment-tab]');
      if (!tab) return;
      activeMethod = tab.dataset.rpHomePaymentTab || 'gcash';
      renderMethod();
    });

    mounted = true;
    refreshAndRender();
    return true;
  }

  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (!mount()) {
    window.addEventListener('load', mount, { once: true });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(() => {
      if (!mounted) mount();
      refreshAndRender();
    }, 0);
  }, true);

  window.addEventListener('realplay:payment-config-changed', () => {
    configSet = emptyConfig();
  });
})();