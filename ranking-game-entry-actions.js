(() => {
  if (window.__realPlayRankingEntryActionsInstalled) return;
  window.__realPlayRankingEntryActionsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-ranking-entry-actions-style';
  let proofDataUrl = '';
  let paymentConfig = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
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
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.message || data?.error || 'Unable to complete this Real Play action.');
        error.code = data?.code || null;
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Real Play took too long to respond. Please try again.');
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-entry-action-flow{padding:2px 2px 8px}
      .rp-entry-action-flow h2{margin:7px 0 7px;color:#f8fbff;font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);font-size:1.32rem;font-style:italic;font-weight:950;line-height:1;text-transform:uppercase}
      .rp-entry-action-flow>p{margin:0 0 14px;color:#8393a8;font-size:.7rem;font-weight:650;line-height:1.48}
      .rp-entry-action-back{position:absolute;left:16px;top:22px;display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.04);color:#dfe8f4;font-size:.95rem;cursor:pointer}
      .rp-entry-action-card{margin:10px 0;padding:12px;border:1px solid rgba(48,210,255,.20);border-radius:13px;background:rgba(9,20,31,.82)}
      .rp-entry-action-card span{display:block;color:#53dcff;font-size:.5rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .rp-entry-action-card strong{display:block;margin-top:5px;color:#f4f8fd;font-size:.72rem;font-weight:850;line-height:1.4}
      .rp-entry-action-methods{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}
      .rp-entry-action-method{padding:13px 10px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:#09111a;color:#fff;text-align:left;cursor:pointer}
      .rp-entry-action-method.gcash{border-color:rgba(44,210,255,.34)}
      .rp-entry-action-method b{display:block;font-size:.78rem}.rp-entry-action-method span{display:block;margin-top:4px;color:#748499;font-size:.56rem;line-height:1.35}
      .rp-entry-action-payment{margin:10px 0;padding:12px;border:1px solid rgba(42,210,255,.16);border-radius:13px;background:rgba(33,195,255,.04);text-align:center}
      .rp-entry-action-payment>*{display:block;margin:3px auto}.rp-entry-action-payment b{color:#fff;font-size:1.04rem}.rp-entry-action-payment span,.rp-entry-action-payment small{color:#8999ad;font-size:.62rem}.rp-entry-action-payment img{max-width:175px;max-height:175px;margin:10px auto;border-radius:12px}
      .rp-entry-action-copy{display:inline-flex!important;width:auto!important;margin:7px auto 0!important;padding:7px 10px!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:9px!important;background:rgba(255,255,255,.04)!important;color:#9edff2!important;font-size:.56rem!important;font-weight:900!important;cursor:pointer}
      .rp-entry-action-proof{display:block;margin:10px 0;padding:13px;border:1px dashed rgba(75,213,255,.26);border-radius:13px;text-align:center;cursor:pointer}.rp-entry-action-proof input{display:none}.rp-entry-action-proof strong{display:block;font-size:.68rem}.rp-entry-action-proof small{display:block;margin-top:4px;color:#708096;font-size:.55rem}
      .rp-entry-action-preview img{display:block;max-width:100%;max-height:170px;margin:8px auto;border-radius:11px}
      .rp-entry-action-primary,.rp-entry-action-secondary{width:100%;margin-top:9px;padding:13px 11px;border-radius:12px;font-size:.66rem;font-weight:950;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
      .rp-entry-action-primary{border:0;background:linear-gradient(90deg,#087cff,#26d4ee);color:#fff}.rp-entry-action-primary:disabled{opacity:.42;cursor:not-allowed}
      .rp-entry-action-secondary{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:#9dacbf}
      .rp-entry-action-status{margin:10px 0 0;color:#8292a7;font-size:.62rem;line-height:1.42;text-align:center}.rp-entry-action-status.error{color:#ff8d9b}
      .rp-entry-action-mark{display:grid;place-items:center;width:56px;height:56px;margin:5px auto 12px;border:1px solid rgba(49,218,255,.34);border-radius:50%;background:rgba(41,207,255,.08);color:#57e2ff;font-size:1.05rem;font-weight:950}
    `;
    document.head.appendChild(style);
  }

  function overlay() {
    return document.querySelector('[data-rp-ranking-entry-options]');
  }

  function sheet() {
    return overlay()?.querySelector('.rp-entry-options-sheet') || null;
  }

  function closeSheet() {
    const node = overlay();
    if (!node) return;
    node.classList.remove('is-open');
    node.setAttribute('aria-hidden', 'true');
  }

  function requireLogin() {
    if (token()) return true;
    closeSheet();
    document.querySelector('[data-auth-open]')?.click();
    return false;
  }

  function frame(inner, showBack = false) {
    const node = sheet();
    if (!node) return false;
    node.innerHTML = `
      <div class="rp-entry-options-grab" aria-hidden="true"></div>
      <div class="rp-entry-options-head"><button class="rp-entry-options-close" type="button" aria-label="Close entry options" data-rp-entry-close>×</button></div>
      ${showBack ? '<button class="rp-entry-action-back" type="button" data-rp-entry-back aria-label="Back">←</button>' : ''}
      ${inner}`;
    return true;
  }

  function optionsMarkup(tokensAvailable = null) {
    const badge = tokensAvailable === null ? '4 PLAY TOKENS' : `${tokensAvailable} TOKEN${tokensAvailable === 1 ? '' : 'S'} AVAILABLE`;
    return `
      <div class="rp-entry-option-stack">
        <button class="rp-entry-option membership" type="button" data-rp-entry-choice="membership">
          <div class="rp-entry-option-badges"><span class="rp-entry-option-badge primary">${badge}</span><span class="rp-entry-option-badge">90-DAY VALIDITY</span></div>
          <div class="rp-entry-option-main"><div class="rp-entry-option-copy"><strong>₱99 MONTHLY MEMBERSHIP</strong><p>Get 4 Play Tokens every month. Use 1 token to secure any eligible Real Play session.</p></div><div class="rp-entry-price"><b>₱99</b><span>PER MONTH</span></div></div>
          <div class="rp-entry-option-note">₱24.75 / TOKEN · 1 TOKEN = 1 SECURED PLAY · CONFIRMED NO-SHOW = TOKEN USED</div>
        </button>
        <button class="rp-entry-option payplay" type="button" data-rp-entry-choice="pay-to-play">
          <div class="rp-entry-option-badges"><span class="rp-entry-option-badge">FLEXIBLE</span></div>
          <div class="rp-entry-option-main"><div class="rp-entry-option-copy"><strong>₱50 PAY TO PLAY</strong><p>No monthly commitment. GCash prepaid gets priority over Cash promises.</p></div><div class="rp-entry-price"><b>₱50</b><span>THIS SESSION</span></div></div>
        </button>
        <button class="rp-entry-option standby" type="button" data-rp-entry-choice="standby">
          <div class="rp-entry-option-badges"><span class="rp-entry-option-badge primary">NO GUARANTEED SPOT</span></div>
          <div class="rp-entry-option-main"><div class="rp-entry-option-copy"><strong>FREE STANDBY</strong><p>No payment and no reserved spot. Play only if a secured spot opens.</p></div><div class="rp-entry-price"><b>FREE</b><span>STANDBY</span></div></div>
          <div class="rp-entry-option-note">Standby never displaces a confirmed paid player.</div>
        </button>
      </div>
      <p class="rp-entry-options-foot">PRIORITY · PLAY TOKEN → GCASH → CASH → FREE STANDBY</p>`;
  }

  function renderOptions(tokensAvailable = null) {
    frame(optionsMarkup(tokensAvailable), false);
  }

  function entryLabel(entry) {
    if (entry?.entryType === 'token') return 'PLAY TOKEN';
    if (entry?.paymentStatus === 'gcash_submitted') return 'GCASH PREPAID';
    if (entry?.paymentStatus === 'cash_due') return 'CASH PROMISE';
    return 'FREE STANDBY';
  }

  function renderExisting(state) {
    const entry = state?.entry;
    if (!entry || entry.status === 'cancelled') return renderOptions(Number(state?.tokens?.available || 0));
    const secured = entry.status === 'secured';
    frame(`
      <div class="rp-entry-action-flow">
        <div class="rp-entry-action-mark">${secured ? '✓' : '…'}</div>
        <h2>${secured ? 'SPOT SECURED' : 'YOU ARE ON STANDBY'}</h2>
        <p>${escapeHtml(entryLabel(entry))} · ${secured ? 'Your spot is currently inside the secured capacity.' : 'Your position can move when the priority queue changes.'}</p>
        <div class="rp-entry-action-card"><span>YOUR ACCESS</span><strong>${escapeHtml(entryLabel(entry))}</strong></div>
        ${entry.paymentStatus === 'cash_due' ? '<div class="rp-entry-action-card"><span>PROVISIONAL</span><strong>Play Token and GCash-prepaid players have higher priority. If capacity fills, Cash moves to standby automatically.</strong></div>' : ''}
        <button class="rp-entry-action-secondary" type="button" data-rp-entry-change>CHANGE ACCESS</button>
        <button class="rp-entry-action-secondary" type="button" data-rp-entry-cancel>${entry.entryType === 'standby' ? 'LEAVE STANDBY' : 'CANCEL ATTENDANCE'}</button>
        <p class="rp-entry-action-status" data-rp-entry-status></p>
      </div>`, false);
  }

  async function refreshOpenSheet() {
    if (!token() || !overlay()?.classList.contains('is-open')) return;
    try {
      const state = await api('/api/real-play/career/access');
      if (state?.entry && state.entry.status !== 'cancelled') renderExisting(state);
      else renderOptions(Number(state?.tokens?.available || 0));
    } catch (_error) {
      // Leave the basic choices usable if the access service is temporarily unavailable.
    }
  }

  async function membershipChoice() {
    if (!requireLogin()) return;
    frame('<div class="rp-entry-action-flow"><p class="rp-entry-action-status">CHECKING PLAY TOKENS…</p></div>', true);
    try {
      const state = await api('/api/real-play/career/access');
      const available = Number(state?.tokens?.available || 0);
      if (available > 0) {
        frame(`
          <div class="rp-entry-action-flow">
            <h2>CONFIRM ATTENDANCE</h2>
            <p>You have ${available} Play Token${available === 1 ? '' : 's'}. Confirming commits 1 token to this Ranking Game.</p>
            <div class="rp-entry-action-card"><span>1 PLAY TOKEN</span><strong>NO-SHOW = TOKEN USED · CANCEL BEFORE THE GAME STARTS TO RELEASE IT</strong></div>
            <button class="rp-entry-action-primary" type="button" data-rp-use-token>CONFIRM · USE 1 TOKEN</button>
            <p class="rp-entry-action-status" data-rp-entry-status></p>
          </div>`, true);
      } else {
        renderMembershipMethods();
      }
    } catch (error) {
      renderError(error);
    }
  }

  function renderMembershipMethods() {
    frame(`
      <div class="rp-entry-action-flow">
        <h2>GET 4 PLAY TOKENS · ₱99</h2>
        <p>Choose how you want to pay for this monthly token pack. Tokens are issued after payment confirmation and stay valid for 90 days.</p>
        <div class="rp-entry-action-methods">
          <button class="rp-entry-action-method gcash" type="button" data-rp-entry-method="membership-gcash"><b>GCASH · ₱99</b><span>Send now and upload your screenshot.</span></button>
          <button class="rp-entry-action-method" type="button" data-rp-entry-method="membership-cash"><b>CASH · ₱99</b><span>Record a cash payment request for admin confirmation.</span></button>
        </div>
      </div>`, true);
  }

  function renderPayMethods() {
    if (!requireLogin()) return;
    frame(`
      <div class="rp-entry-action-flow">
        <h2>₱50 PAY TO PLAY</h2>
        <p>Choose how you want to secure this Ranking Game.</p>
        <div class="rp-entry-action-methods">
          <button class="rp-entry-action-method gcash" type="button" data-rp-entry-method="ptp-gcash"><b>GCASH · ₱50</b><span>Prepaid priority. Moves ahead of unpaid Cash promises.</span></button>
          <button class="rp-entry-action-method" type="button" data-rp-entry-method="ptp-cash"><b>CASH · ₱50</b><span>Provisional spot. Pay at the court.</span></button>
        </div>
      </div>`, true);
  }

  async function loadPaymentConfig() {
    if (paymentConfig) return paymentConfig;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/support/payment-config`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      paymentConfig = response.ok ? await response.json() : {};
    } catch (_error) {
      paymentConfig = {};
    } finally {
      window.clearTimeout(timer);
    }
    return paymentConfig;
  }

  async function renderGcash(kind) {
    const config = await loadPaymentConfig();
    const gcash = config?.gcash || {};
    const amount = kind === 'membership' ? 99 : 50;
    proofDataUrl = '';
    frame(`
      <div class="rp-entry-action-flow" data-rp-gcash-kind="${kind}">
        <h2>PAY ₱${amount} VIA GCASH</h2>
        <p>Send the payment, then upload the screenshot.</p>
        <div class="rp-entry-action-payment">
          <strong>GCASH</strong>
          ${gcash.account_name ? `<span>${escapeHtml(gcash.account_name)}</span>` : ''}
          ${gcash.number ? `<b>${escapeHtml(gcash.number)}</b><button class="rp-entry-action-copy" type="button" data-rp-copy-gcash="${escapeHtml(gcash.number)}">COPY NUMBER</button>` : '<span>GCash number is not configured yet.</span>'}
          ${gcash.qr_image ? `<img src="${gcash.qr_image}" alt="GCash QR code">` : ''}
          <small>Pay exactly ₱${amount}.</small>
        </div>
        <label class="rp-entry-action-proof"><input type="file" accept="image/png,image/jpeg,image/webp" data-rp-entry-proof><strong data-rp-entry-proof-label>UPLOAD GCASH SCREENSHOT</strong><small>PNG, JPG or WEBP</small></label>
        <div class="rp-entry-action-preview" data-rp-entry-proof-preview hidden></div>
        <button class="rp-entry-action-primary" type="button" data-rp-entry-gcash-submit="${kind}" disabled>${kind === 'membership' ? 'SUBMIT FOR VERIFICATION' : 'SUBMIT & SECURE'}</button>
        <p class="rp-entry-action-status" data-rp-entry-status></p>
      </div>`, true);
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
          if (!context) return reject(new Error('Unable to process that screenshot.'));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleProof(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const label = sheet()?.querySelector('[data-rp-entry-proof-label]');
    const preview = sheet()?.querySelector('[data-rp-entry-proof-preview]');
    const submit = sheet()?.querySelector('[data-rp-entry-gcash-submit]');
    const status = sheet()?.querySelector('[data-rp-entry-status]');
    try {
      if (label) label.textContent = 'PROCESSING…';
      proofDataUrl = await compressImage(file);
      if (label) label.textContent = 'SCREENSHOT READY ✓';
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${proofDataUrl}" alt="GCash screenshot preview">`;
      }
      if (submit) submit.disabled = false;
      if (status) { status.textContent = ''; status.classList.remove('error'); }
    } catch (error) {
      proofDataUrl = '';
      if (label) label.textContent = 'UPLOAD GCASH SCREENSHOT';
      if (status) { status.textContent = error.message; status.classList.add('error'); }
    }
  }

  async function submitToken() {
    await submitAccess({ entryType: 'token' }, 'CONFIRMING…');
  }

  async function submitStandby() {
    if (!requireLogin()) return;
    frame('<div class="rp-entry-action-flow"><p class="rp-entry-action-status">JOINING STANDBY…</p></div>', false);
    try {
      renderResult(await api('/api/real-play/career/access', { method: 'POST', body: { entryType: 'standby' } }));
    } catch (error) {
      renderError(error);
    }
  }

  function confirmCash(kind) {
    const amount = kind === 'membership' ? 99 : 50;
    frame(`
      <div class="rp-entry-action-flow">
        <h2>CASH · ₱${amount}</h2>
        <p>${kind === 'membership' ? 'Record your ₱99 cash membership request. Your 4 Play Tokens are issued only after Real Play confirms receipt.' : 'Promise to pay ₱50 at the court. This spot is provisional.'}</p>
        ${kind === 'ptp' ? '<div class="rp-entry-action-card"><span>PROVISIONAL PRIORITY</span><strong>If capacity is later filled by Play Token or GCash-prepaid players, you automatically move to standby.</strong></div>' : ''}
        <button class="rp-entry-action-primary" type="button" data-rp-entry-cash-submit="${kind}">CONFIRM CASH</button>
        <p class="rp-entry-action-status" data-rp-entry-status></p>
      </div>`, true);
  }

  async function submitCash(kind) {
    const button = sheet()?.querySelector('[data-rp-entry-cash-submit]');
    const status = sheet()?.querySelector('[data-rp-entry-status]');
    if (button) { button.disabled = true; button.textContent = 'CONFIRMING…'; }
    try {
      if (kind === 'membership') {
        const result = await api('/api/real-play/membership/payment', { method: 'POST', body: { paymentMethod: 'cash' } });
        renderMembershipPending(result?.message);
      } else {
        renderResult(await api('/api/real-play/career/access', { method: 'POST', body: { entryType: 'pay_to_play', paymentMethod: 'cash' } }));
      }
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CONFIRM CASH'; }
    }
  }

  async function submitGcash(kind) {
    const button = sheet()?.querySelector('[data-rp-entry-gcash-submit]');
    const status = sheet()?.querySelector('[data-rp-entry-status]');
    if (!button || !proofDataUrl) return;
    button.disabled = true;
    button.textContent = 'SUBMITTING…';
    try {
      if (kind === 'membership') {
        const result = await api('/api/real-play/membership/payment', {
          method: 'POST',
          body: { paymentMethod: 'gcash', proofImageDataUrl: proofDataUrl },
        });
        renderMembershipPending(result?.message);
      } else {
        renderResult(await api('/api/real-play/career/access', {
          method: 'POST',
          body: { entryType: 'pay_to_play', paymentMethod: 'gcash', proofImageDataUrl: proofDataUrl },
        }));
      }
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      button.disabled = false;
      button.textContent = kind === 'membership' ? 'SUBMIT FOR VERIFICATION' : 'SUBMIT & SECURE';
    }
  }

  async function submitAccess(body, busyText) {
    const button = sheet()?.querySelector('[data-rp-use-token]');
    const status = sheet()?.querySelector('[data-rp-entry-status]');
    if (button) { button.disabled = true; button.textContent = busyText; }
    try {
      renderResult(await api('/api/real-play/career/access', { method: 'POST', body }));
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CONFIRM · USE 1 TOKEN'; }
    }
  }

  function renderMembershipPending(message) {
    frame(`
      <div class="rp-entry-action-flow">
        <div class="rp-entry-action-mark">✓</div>
        <h2>PAYMENT RECORDED</h2>
        <p>${escapeHtml(message || 'Your membership payment is waiting for Real Play confirmation.')}</p>
        <div class="rp-entry-action-card"><span>AFTER APPROVAL</span><strong>4 PLAY TOKENS · EACH VALID FOR 90 DAYS</strong></div>
        <button class="rp-entry-action-primary" type="button" data-rp-entry-done>DONE</button>
      </div>`, false);
  }

  function renderResult(state) {
    const entry = state?.entry;
    const secured = entry?.status === 'secured';
    frame(`
      <div class="rp-entry-action-flow">
        <div class="rp-entry-action-mark">${secured ? '✓' : '…'}</div>
        <h2>${secured ? 'SPOT SECURED' : 'STANDBY'}</h2>
        <p>${escapeHtml(state?.message || (secured ? 'Your spot is secured.' : 'You are on standby.'))}</p>
        ${entry ? `<div class="rp-entry-action-card"><span>ACCESS</span><strong>${escapeHtml(entryLabel(entry))}</strong></div>` : ''}
        <button class="rp-entry-action-primary" type="button" data-rp-entry-done>DONE</button>
      </div>`, false);
    window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: state }));
  }

  async function cancelEntry() {
    const button = sheet()?.querySelector('[data-rp-entry-cancel]');
    const status = sheet()?.querySelector('[data-rp-entry-status]');
    if (button) { button.disabled = true; button.textContent = 'CANCELLING…'; }
    try {
      const result = await api('/api/real-play/career/access', { method: 'DELETE' });
      frame(`<div class="rp-entry-action-flow"><div class="rp-entry-action-mark">✓</div><h2>SPOT RELEASED</h2><p>${escapeHtml(result?.message || 'Your entry was cancelled.')}</p><button class="rp-entry-action-primary" type="button" data-rp-entry-done>DONE</button></div>`, false);
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: result }));
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CANCEL ATTENDANCE'; }
    }
  }

  function renderError(error) {
    frame(`<div class="rp-entry-action-flow"><div class="rp-entry-action-mark">!</div><h2>NOT COMPLETED</h2><p>${escapeHtml(error?.message || 'Unable to complete this action.')}</p><button class="rp-entry-action-primary" type="button" data-rp-entry-options>BACK</button></div>`, false);
  }

  installStyles();

  // The UI shell owns opening/closing the sheet. This isolated action layer only
  // talks to the backend after the player opens the sheet or chooses an option.
  document.addEventListener('click', (event) => {
    const joinTrigger = event.target instanceof Element ? event.target.closest('[data-rp-ranking-session-action]') : null;
    if (joinTrigger && !joinTrigger.disabled && /JOIN\s+RANKING\s+GAME/i.test(String(joinTrigger.textContent || ''))) {
      window.setTimeout(refreshOpenSheet, 0);
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-rp-entry-close]')) return closeSheet();
    if (target.closest('[data-rp-entry-back], [data-rp-entry-options], [data-rp-entry-change]')) {
      if (!token()) return renderOptions();
      api('/api/real-play/career/access').then((state) => renderOptions(Number(state?.tokens?.available || 0))).catch(() => renderOptions());
      return;
    }
    if (target.closest('[data-rp-entry-choice="membership"]')) return membershipChoice();
    if (target.closest('[data-rp-entry-choice="pay-to-play"]')) return renderPayMethods();
    if (target.closest('[data-rp-entry-choice="standby"]')) return submitStandby();
    if (target.closest('[data-rp-use-token]')) return submitToken();
    if (target.closest('[data-rp-entry-method="ptp-gcash"]')) return renderGcash('ptp');
    if (target.closest('[data-rp-entry-method="ptp-cash"]')) return confirmCash('ptp');
    if (target.closest('[data-rp-entry-method="membership-gcash"]')) return renderGcash('membership');
    if (target.closest('[data-rp-entry-method="membership-cash"]')) return confirmCash('membership');
    const cashSubmit = target.closest('[data-rp-entry-cash-submit]');
    if (cashSubmit) return submitCash(cashSubmit.dataset.rpEntryCashSubmit);
    const gcashSubmit = target.closest('[data-rp-entry-gcash-submit]');
    if (gcashSubmit) return submitGcash(gcashSubmit.dataset.rpEntryGcashSubmit);
    if (target.closest('[data-rp-entry-proof]')) return;
    if (target.closest('[data-rp-entry-cancel]')) return cancelEntry();
    if (target.closest('[data-rp-entry-done]')) return closeSheet();
    const copy = target.closest('[data-rp-copy-gcash]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.rpCopyGcash || '').then(() => { copy.textContent = 'COPIED ✓'; }).catch(() => {});
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target instanceof Element ? event.target.closest('[data-rp-entry-proof]') : null;
    if (input) handleProof(event);
  });
})();
