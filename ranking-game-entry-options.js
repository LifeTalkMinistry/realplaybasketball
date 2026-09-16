(() => {
  if (window.__realPlayRankingGameEntryOptionsInstalled) return;
  window.__realPlayRankingGameEntryOptionsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-ranking-entry-options-style';
  const SHEET_ATTR = 'data-rp-ranking-entry-options';
  let paymentConfig = null;
  let proofDataUrl = '';

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

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-entry-options-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:18px 12px 0;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility .2s ease}
      .rp-entry-options-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .rp-entry-options-sheet{position:relative;width:min(100%,430px);max-height:calc(100dvh - 20px);overflow:auto;overscroll-behavior:contain;padding:10px 16px calc(18px + env(safe-area-inset-bottom));border:1px solid rgba(45,205,255,.24);border-bottom:0;border-radius:28px 28px 0 0;background:radial-gradient(circle at 88% 8%,rgba(30,191,255,.14),transparent 28%),linear-gradient(180deg,#07111b 0%,#03070c 48%,#020407 100%);box-shadow:0 -24px 70px rgba(0,0,0,.65),0 -1px 28px rgba(20,174,255,.08);transform:translateY(32px);transition:transform .24s cubic-bezier(.2,.85,.3,1);color:#f5f8ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .rp-entry-options-overlay.is-open .rp-entry-options-sheet{transform:translateY(0)}
      .rp-entry-options-grab{width:52px;height:4px;margin:2px auto 8px;border-radius:999px;background:rgba(255,255,255,.18)}
      .rp-entry-options-head{display:flex;align-items:center;justify-content:flex-end;margin-bottom:8px}
      .rp-entry-options-close,.rp-entry-options-back{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.04);color:#dfe8f4;font-size:1.12rem;line-height:1;cursor:pointer}
      .rp-entry-options-back{position:absolute;left:16px;top:22px;font-size:.95rem}
      .rp-entry-option-stack{display:grid;gap:10px}
      .rp-entry-option{position:relative;width:100%;overflow:hidden;padding:15px 14px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:linear-gradient(145deg,rgba(15,23,34,.96),rgba(6,11,18,.98));color:#fff;text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;transition:transform .16s ease,border-color .16s ease,background .16s ease}
      .rp-entry-option:active{transform:scale(.985)}
      .rp-entry-option.membership{border-color:rgba(45,209,255,.5);background:radial-gradient(circle at 100% 0,rgba(22,206,255,.2),transparent 38%),linear-gradient(135deg,rgba(10,43,75,.98),rgba(4,17,29,.99));box-shadow:inset 0 0 0 1px rgba(20,150,255,.08),0 8px 24px rgba(0,130,255,.08)}
      .rp-entry-option.payplay{border-color:rgba(52,145,255,.24)}
      .rp-entry-option.standby{border-color:rgba(255,255,255,.07);background:linear-gradient(145deg,rgba(10,14,20,.92),rgba(4,7,11,.98))}
      .rp-entry-option-badges{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
      .rp-entry-option-badge{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.06);color:#91a1b6;font-size:.45rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .membership .rp-entry-option-badge.primary{background:rgba(35,214,255,.14);color:#5fe4ff;border:1px solid rgba(74,219,255,.2)}
      .standby .rp-entry-option-badge.primary{background:rgba(255,190,74,.08);color:#d8b16e;border:1px solid rgba(255,190,74,.12)}
      .rp-entry-option-main{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .rp-entry-option-copy{min-width:0}
      .rp-entry-option-copy strong,.rp-entry-flow h2{display:block;color:#f8fbff;font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);font-size:.98rem;font-style:italic;font-weight:950;letter-spacing:.02em;line-height:1.1;text-transform:uppercase}
      .membership .rp-entry-option-copy strong{font-size:1.04rem}
      .rp-entry-option-copy p{margin:6px 0 0;color:#7e8da2;font-size:.66rem;font-weight:650;line-height:1.42}
      .membership .rp-entry-option-copy p{color:#98a9bd}
      .rp-entry-price{flex:0 0 auto;min-width:58px;text-align:right}
      .rp-entry-price b{display:block;color:#f8fbff;font-family:var(--rp-display,Impact,"Arial Narrow",sans-serif);font-size:1.2rem;font-style:italic;font-weight:950;line-height:1}
      .membership .rp-entry-price b{color:#49dfff;font-size:1.35rem}
      .rp-entry-price span{display:block;margin-top:4px;color:#657387;font-size:.43rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .rp-entry-option-note{position:relative;z-index:1;margin-top:11px;padding:8px 10px;border:1px solid rgba(53,213,255,.13);border-radius:10px;background:rgba(37,204,255,.055);color:#8fdff2;font-size:.57rem;font-weight:800;line-height:1.35}
      .standby .rp-entry-option-note{border-color:rgba(255,190,74,.10);background:rgba(255,190,74,.035);color:#a79577}
      .rp-entry-flow{padding:4px 2px 8px}
      .rp-entry-flow h2{margin:10px 0 7px;font-size:1.35rem}
      .rp-entry-flow>p{margin:0 0 15px;color:#8595aa;font-size:.72rem;font-weight:650;line-height:1.48}
      .rp-entry-flow-card{padding:14px;border:1px solid rgba(48,210,255,.22);border-radius:16px;background:rgba(9,20,31,.82);margin-bottom:10px}
      .rp-entry-flow-card span{display:block;color:#53dcff;font-size:.52rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .rp-entry-flow-card strong{display:block;margin-top:5px;color:#f7fbff;font-size:.86rem;font-weight:850;line-height:1.3}
      .rp-entry-methods{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}
      .rp-entry-method{padding:14px 10px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:#0a111a;color:#fff;text-align:left;cursor:pointer}
      .rp-entry-method b{display:block;font-size:.82rem}.rp-entry-method span{display:block;margin-top:4px;color:#758499;font-size:.58rem;line-height:1.35}
      .rp-entry-method.gcash{border-color:rgba(44,210,255,.34)}
      .rp-entry-payment-detail{margin:10px 0;padding:12px;border:1px solid rgba(42,210,255,.16);border-radius:13px;background:rgba(33,195,255,.04);text-align:center}
      .rp-entry-payment-detail strong,.rp-entry-payment-detail span,.rp-entry-payment-detail b,.rp-entry-payment-detail small{display:block;margin:3px 0}.rp-entry-payment-detail b{font-size:1.1rem;color:#fff}.rp-entry-payment-detail span,.rp-entry-payment-detail small{color:#8999ad;font-size:.65rem}.rp-entry-payment-detail img{display:block;max-width:180px;max-height:180px;margin:10px auto;border-radius:12px}
      .rp-entry-proof{display:block;margin:10px 0;padding:14px;border:1px dashed rgba(75,213,255,.26);border-radius:13px;text-align:center;cursor:pointer}.rp-entry-proof input{display:none}.rp-entry-proof strong{display:block;font-size:.7rem}.rp-entry-proof small{display:block;margin-top:4px;color:#708096;font-size:.56rem}
      .rp-entry-proof-preview img{display:block;max-width:100%;max-height:180px;margin:8px auto;border-radius:12px}
      .rp-entry-primary,.rp-entry-secondary{width:100%;margin-top:9px;padding:14px 12px;border-radius:13px;font-weight:900;font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
      .rp-entry-primary{border:0;background:linear-gradient(90deg,#087cff,#26d4ee);color:#fff}.rp-entry-primary:disabled{opacity:.42;cursor:not-allowed}.rp-entry-secondary{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:#9dacbf}
      .rp-entry-status{margin-top:10px;color:#8d9cb0;font-size:.65rem;line-height:1.4;text-align:center}.rp-entry-status.error{color:#ff8a99}
      .rp-entry-result-mark{display:grid;place-items:center;width:58px;height:58px;margin:7px auto 13px;border-radius:50%;border:1px solid rgba(49,218,255,.34);background:rgba(41,207,255,.08);color:#57e2ff;font-weight:950;font-size:1.1rem}
      @media (min-width:700px){.rp-entry-options-overlay{align-items:center;padding:18px}.rp-entry-options-sheet{border-bottom:1px solid rgba(45,205,255,.24);border-radius:26px;padding-bottom:20px}}
      @media (prefers-reduced-motion:reduce){.rp-entry-options-overlay,.rp-entry-options-sheet,.rp-entry-option{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function makeSheet() {
    const existing = document.querySelector(`[${SHEET_ATTR}]`);
    if (existing) return existing;
    const overlay = document.createElement('div');
    overlay.className = 'rp-entry-options-overlay';
    overlay.setAttribute(SHEET_ATTR, 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-entry-options-sheet" role="dialog" aria-modal="true" aria-label="Real Play access options">
        <div class="rp-entry-options-grab" aria-hidden="true"></div>
        <div class="rp-entry-options-head"><button class="rp-entry-options-close" type="button" aria-label="Close entry options" data-rp-entry-close>×</button></div>
        <div data-rp-entry-content></div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-rp-entry-close]')?.addEventListener('click', () => closeSheet(overlay));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeSheet(overlay); });
    return overlay;
  }

  function contentNode() {
    return makeSheet().querySelector('[data-rp-entry-content]');
  }

  function requireLogin() {
    if (authToken()) return true;
    closeSheet();
    document.querySelector('[data-auth-open]')?.click();
    return false;
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

  function optionsMarkup(tokensAvailable = null) {
    const tokenBadge = tokensAvailable === null ? '4 PLAY TOKENS' : `${tokensAvailable} TOKEN${tokensAvailable === 1 ? '' : 'S'} AVAILABLE`;
    return `
      <div class="rp-entry-option-stack">
        <button class="rp-entry-option membership" type="button" data-rp-entry-choice="membership">
          <div class="rp-entry-option-badges"><span class="rp-entry-option-badge primary">${tokenBadge}</span><span class="rp-entry-option-badge">90-DAY VALIDITY</span></div>
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
      </div>`;
  }

  function bindOptions() {
    const content = contentNode();
    content.querySelector('[data-rp-entry-choice="membership"]')?.addEventListener('click', handleMembershipChoice);
    content.querySelector('[data-rp-entry-choice="pay-to-play"]')?.addEventListener('click', renderPayToPlay);
    content.querySelector('[data-rp-entry-choice="standby"]')?.addEventListener('click', joinStandby);
  }

  async function renderOptions() {
    const content = contentNode();
    let tokenCount = null;
    if (authToken()) {
      try {
        const state = await api('/api/real-play/career/entry');
        tokenCount = Number(state?.tokens?.available || 0);
      } catch (_error) {}
    }
    content.innerHTML = optionsMarkup(tokenCount);
    bindOptions();
  }

  function entryLabel(entry) {
    if (entry.entryType === 'token') return 'PLAY TOKEN';
    if (entry.paymentStatus === 'gcash_submitted') return 'GCASH PREPAID';
    if (entry.paymentStatus === 'cash_due') return 'CASH PROMISE';
    return 'FREE STANDBY';
  }

  async function renderExisting(state) {
    const content = contentNode();
    const entry = state?.entry;
    if (!entry || entry.status === 'cancelled') return renderOptions();
    const secured = entry.status === 'secured';
    content.innerHTML = `
      <div class="rp-entry-flow">
        <div class="rp-entry-result-mark">${secured ? '✓' : '…'}</div>
        <h2>${secured ? 'SPOT SECURED' : 'YOU ARE ON STANDBY'}</h2>
        <p>${entryLabel(entry)} · ${secured ? 'Your name is currently inside the secured capacity.' : 'You will move in only if capacity opens or your priority moves up.'}</p>
        <div class="rp-entry-flow-card"><span>YOUR ACCESS</span><strong>${entryLabel(entry)}</strong></div>
        ${entry.paymentStatus === 'cash_due' ? '<div class="rp-entry-flow-card"><span>IMPORTANT</span><strong>Cash is provisional. A Play Token or GCash-prepaid player can move this spot to standby if capacity fills.</strong></div>' : ''}
        <button class="rp-entry-secondary" type="button" data-entry-change>CHANGE ACCESS</button>
        <button class="rp-entry-secondary" type="button" data-entry-cancel>${entry.entryType === 'standby' ? 'LEAVE STANDBY' : 'CANCEL ATTENDANCE'}</button>
        <p class="rp-entry-status" data-entry-status></p>
      </div>`;
    content.querySelector('[data-entry-change]')?.addEventListener('click', renderOptions);
    content.querySelector('[data-entry-cancel]')?.addEventListener('click', cancelEntry);
  }

  async function handleMembershipChoice() {
    if (!requireLogin()) return;
    const content = contentNode();
    content.innerHTML = '<div class="rp-entry-flow"><p class="rp-entry-status">CHECKING YOUR PLAY TOKENS…</p></div>';
    try {
      const state = await api('/api/real-play/career/entry');
      const available = Number(state?.tokens?.available || 0);
      if (available < 1) {
        await window.__realPlayEnsureMembership?.();
        closeSheet();
        let attempts = 0;
        const openWhenReady = () => {
          if (window.__realPlayOpenMembership) return window.__realPlayOpenMembership();
          attempts += 1;
          if (attempts < 12) window.setTimeout(openWhenReady, 100);
        };
        openWhenReady();
        return;
      }
      content.innerHTML = `
        <div class="rp-entry-flow">
          <button class="rp-entry-options-back" type="button" data-entry-back>←</button>
          <h2>CONFIRM ATTENDANCE</h2>
          <p>You have ${available} Play Token${available === 1 ? '' : 's'}. Confirming commits 1 token to this Ranking Game.</p>
          <div class="rp-entry-flow-card"><span>1 PLAY TOKEN</span><strong>NO-SHOW = TOKEN USED · CANCEL BEFORE THE GAME STARTS TO RELEASE IT</strong></div>
          <button class="rp-entry-primary" type="button" data-use-token>CONFIRM · USE 1 TOKEN</button>
          <p class="rp-entry-status" data-entry-status></p>
        </div>`;
      content.querySelector('[data-entry-back]')?.addEventListener('click', renderOptions);
      content.querySelector('[data-use-token]')?.addEventListener('click', useToken);
    } catch (error) {
      renderError(error);
    }
  }

  async function useToken() {
    const button = contentNode().querySelector('[data-use-token]');
    const status = contentNode().querySelector('[data-entry-status]');
    if (button) { button.disabled = true; button.textContent = 'CONFIRMING…'; }
    try {
      const state = await api('/api/real-play/career/entry', { method: 'POST', body: { mode: 'token' } });
      await renderResult(state);
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CONFIRM · USE 1 TOKEN'; }
    }
  }

  async function renderPayToPlay() {
    if (!requireLogin()) return;
    const content = contentNode();
    content.innerHTML = `
      <div class="rp-entry-flow">
        <button class="rp-entry-options-back" type="button" data-entry-back>←</button>
        <h2>₱50 PAY TO PLAY</h2>
        <p>Choose how you want to pay for this Ranking Game.</p>
        <div class="rp-entry-methods">
          <button class="rp-entry-method gcash" type="button" data-entry-method="gcash"><b>GCASH · ₱50</b><span>Prepaid priority. Can move ahead of unpaid Cash promises.</span></button>
          <button class="rp-entry-method" type="button" data-entry-method="cash"><b>CASH · ₱50</b><span>Promise to pay at court. Spot stays provisional.</span></button>
        </div>
      </div>`;
    content.querySelector('[data-entry-back]')?.addEventListener('click', renderOptions);
    content.querySelector('[data-entry-method="gcash"]')?.addEventListener('click', renderGcashPayment);
    content.querySelector('[data-entry-method="cash"]')?.addEventListener('click', confirmCash);
  }

  async function renderGcashPayment() {
    const config = await loadPaymentConfig();
    const gcash = config?.gcash || {};
    proofDataUrl = '';
    const content = contentNode();
    content.innerHTML = `
      <div class="rp-entry-flow">
        <button class="rp-entry-options-back" type="button" data-entry-back>←</button>
        <h2>PAY ₱50 VIA GCASH</h2>
        <p>Send the ₱50 first. Upload the screenshot to place yourself in the prepaid priority queue.</p>
        <div class="rp-entry-payment-detail">
          <strong>GCASH</strong>
          ${gcash.account_name ? `<span>${gcash.account_name}</span>` : ''}
          ${gcash.number ? `<b>${gcash.number}</b>` : '<span>GCash number is not configured yet.</span>'}
          ${gcash.qr_image ? `<img src="${gcash.qr_image}" alt="GCash QR code">` : ''}
          <small>Pay exactly ₱50.</small>
        </div>
        <label class="rp-entry-proof"><input type="file" accept="image/png,image/jpeg,image/webp" data-entry-proof><strong data-entry-proof-label>UPLOAD GCASH SCREENSHOT</strong><small>PNG, JPG or WEBP</small></label>
        <div class="rp-entry-proof-preview" data-entry-proof-preview hidden></div>
        <button class="rp-entry-primary" type="button" data-entry-gcash-submit disabled>SUBMIT & SECURE</button>
        <p class="rp-entry-status" data-entry-status></p>
      </div>`;
    content.querySelector('[data-entry-back]')?.addEventListener('click', renderPayToPlay);
    content.querySelector('[data-entry-proof]')?.addEventListener('change', handleProofFile);
    content.querySelector('[data-entry-gcash-submit]')?.addEventListener('click', submitGcash);
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
    const label = contentNode().querySelector('[data-entry-proof-label]');
    const preview = contentNode().querySelector('[data-entry-proof-preview]');
    const submit = contentNode().querySelector('[data-entry-gcash-submit]');
    const status = contentNode().querySelector('[data-entry-status]');
    try {
      if (label) label.textContent = 'PROCESSING…';
      proofDataUrl = await compressImage(file);
      if (label) label.textContent = 'SCREENSHOT READY ✓';
      if (preview) { preview.hidden = false; preview.innerHTML = `<img src="${proofDataUrl}" alt="GCash screenshot preview">`; }
      if (submit) submit.disabled = false;
      if (status) status.textContent = '';
    } catch (error) {
      proofDataUrl = '';
      if (label) label.textContent = 'UPLOAD GCASH SCREENSHOT';
      if (status) { status.textContent = error.message; status.classList.add('error'); }
    }
  }

  async function submitGcash() {
    const button = contentNode().querySelector('[data-entry-gcash-submit]');
    const status = contentNode().querySelector('[data-entry-status]');
    if (!proofDataUrl || !button) return;
    button.disabled = true;
    button.textContent = 'SUBMITTING…';
    try {
      const state = await api('/api/real-play/career/entry', {
        method: 'POST',
        body: { mode: 'pay_to_play', paymentMethod: 'gcash', proofImageDataUrl: proofDataUrl },
      });
      await renderResult(state);
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      button.disabled = false;
      button.textContent = 'SUBMIT & SECURE';
    }
  }

  async function confirmCash() {
    const content = contentNode();
    content.innerHTML = `
      <div class="rp-entry-flow">
        <button class="rp-entry-options-back" type="button" data-entry-back>←</button>
        <h2>CASH · ₱50</h2>
        <p>You are promising to pay ₱50 at the court. This can hold a provisional spot, but Play Token and GCash-prepaid players have priority.</p>
        <div class="rp-entry-flow-card"><span>LOWER SECURED PRIORITY</span><strong>If the 16-player capacity is later filled by prepaid/token players, you automatically move to standby.</strong></div>
        <button class="rp-entry-primary" type="button" data-entry-cash-confirm>CONFIRM CASH</button>
        <p class="rp-entry-status" data-entry-status></p>
      </div>`;
    content.querySelector('[data-entry-back]')?.addEventListener('click', renderPayToPlay);
    content.querySelector('[data-entry-cash-confirm]')?.addEventListener('click', submitCash);
  }

  async function submitCash() {
    const button = contentNode().querySelector('[data-entry-cash-confirm]');
    const status = contentNode().querySelector('[data-entry-status]');
    if (button) { button.disabled = true; button.textContent = 'CONFIRMING…'; }
    try {
      const state = await api('/api/real-play/career/entry', { method: 'POST', body: { mode: 'pay_to_play', paymentMethod: 'cash' } });
      await renderResult(state);
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CONFIRM CASH'; }
    }
  }

  async function joinStandby() {
    if (!requireLogin()) return;
    const content = contentNode();
    content.innerHTML = '<div class="rp-entry-flow"><p class="rp-entry-status">JOINING STANDBY…</p></div>';
    try {
      const state = await api('/api/real-play/career/entry', { method: 'POST', body: { mode: 'standby' } });
      await renderResult(state);
    } catch (error) {
      renderError(error);
    }
  }

  async function cancelEntry() {
    const button = contentNode().querySelector('[data-entry-cancel]');
    const status = contentNode().querySelector('[data-entry-status]');
    if (button) { button.disabled = true; button.textContent = 'CANCELLING…'; }
    try {
      const state = await api('/api/real-play/career/entry', { method: 'DELETE' });
      contentNode().innerHTML = `<div class="rp-entry-flow"><div class="rp-entry-result-mark">✓</div><h2>SPOT RELEASED</h2><p>${state.message || 'Your entry was cancelled.'}</p><button class="rp-entry-primary" type="button" data-entry-done>DONE</button></div>`;
      contentNode().querySelector('[data-entry-done]')?.addEventListener('click', closeSheet);
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: state }));
    } catch (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      if (button) { button.disabled = false; button.textContent = 'CANCEL ATTENDANCE'; }
    }
  }

  async function renderResult(state) {
    const entry = state?.entry;
    const secured = entry?.status === 'secured';
    const message = state?.message || (secured ? 'Your spot is secured.' : 'You are on standby.');
    const content = contentNode();
    content.innerHTML = `
      <div class="rp-entry-flow">
        <div class="rp-entry-result-mark">${secured ? '✓' : '…'}</div>
        <h2>${secured ? 'SPOT SECURED' : 'STANDBY'}</h2>
        <p>${message}</p>
        ${entry ? `<div class="rp-entry-flow-card"><span>ACCESS</span><strong>${entryLabel(entry)}</strong></div>` : ''}
        <button class="rp-entry-primary" type="button" data-entry-done>DONE</button>
      </div>`;
    content.querySelector('[data-entry-done]')?.addEventListener('click', closeSheet);
    window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: state }));
  }

  function renderError(error) {
    const content = contentNode();
    content.innerHTML = `<div class="rp-entry-flow"><div class="rp-entry-result-mark">!</div><h2>NOT COMPLETED</h2><p>${error?.message || 'Unable to complete this action.'}</p><button class="rp-entry-primary" type="button" data-entry-back>BACK</button></div>`;
    content.querySelector('[data-entry-back]')?.addEventListener('click', renderOptions);
  }

  async function openSheet() {
    installStyles();
    const overlay = makeSheet();
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    if (!authToken()) {
      await renderOptions();
      return;
    }
    const content = contentNode();
    content.innerHTML = '<div class="rp-entry-flow"><p class="rp-entry-status">LOADING…</p></div>';
    try {
      const state = await api('/api/real-play/career/entry');
      if (state?.entry && state.entry.status !== 'cancelled') await renderExisting(state);
      else {
        content.innerHTML = optionsMarkup(Number(state?.tokens?.available || 0));
        bindOptions();
      }
    } catch (_error) {
      await renderOptions();
    }
  }

  function closeSheet(overlay = document.querySelector(`[${SHEET_ATTR}]`)) {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  installStyles();

  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-rp-ranking-session-action]') : null;
    if (!trigger || trigger.disabled) return;
    if (!/JOIN\s+RANKING\s+GAME/i.test(String(trigger.textContent || ''))) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    openSheet();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const overlay = document.querySelector(`[${SHEET_ATTR}]`);
    if (overlay?.classList.contains('is-open')) closeSheet(overlay);
  });
})();
