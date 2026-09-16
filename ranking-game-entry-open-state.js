(() => {
  if (window.__realPlayRankingEntryOpenStateInstalled) return;
  window.__realPlayRankingEntryOpenStateInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let observedOverlay = null;
  let overlayObserver = null;

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

  function label(entry) {
    if (entry?.entryType === 'token') return 'PLAY TOKEN';
    if (entry?.paymentStatus === 'gcash_submitted') return 'GCASH PREPAID';
    if (entry?.paymentStatus === 'cash_due') return 'CASH PROMISE';
    return 'FREE STANDBY';
  }

  function baseOptions(tokensAvailable = null, entry = null) {
    const badge = tokensAvailable === null ? '4 PLAY TOKENS' : `${tokensAvailable} TOKEN${tokensAvailable === 1 ? '' : 'S'} AVAILABLE`;
    const current = entry && entry.status !== 'cancelled'
      ? `<div style="margin:0 0 10px;padding:11px 12px;border:1px solid rgba(65,215,255,.18);border-radius:13px;background:rgba(32,190,255,.045)"><span style="display:block;color:#53dcff;font-size:.48rem;font-weight:950;letter-spacing:.1em">YOUR CURRENT ACCESS</span><strong style="display:block;margin-top:5px;color:#f5f9fd;font-size:.72rem">${escapeHtml(label(entry))} · ${entry.status === 'secured' ? 'SPOT SECURED' : 'STANDBY'}</strong><button type="button" data-rp-entry-cancel style="margin-top:8px;border:0;background:none;color:#8fa2b7;font-size:.55rem;font-weight:900;cursor:pointer">${entry.entryType === 'standby' ? 'LEAVE STANDBY' : 'CANCEL ATTENDANCE'}</button><p data-rp-entry-status style="margin:5px 0 0;color:#8292a7;font-size:.56rem"></p></div>`
      : '';
    return `${current}
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

  async function syncOpenState() {
    const overlay = observedOverlay || document.querySelector('[data-rp-ranking-entry-options]');
    if (!overlay?.classList.contains('is-open')) return;
    const sheet = overlay.querySelector('.rp-entry-options-sheet');
    if (!sheet) return;

    const body = document.createElement('div');
    body.innerHTML = baseOptions(null, null);
    if (!token()) {
      sheet.querySelector('.rp-entry-option-stack')?.replaceWith(body.querySelector('.rp-entry-option-stack'));
      const foot = sheet.querySelector('.rp-entry-options-foot');
      if (foot) foot.textContent = 'PRIORITY · PLAY TOKEN → GCASH → CASH → FREE STANDBY';
      return;
    }

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/access`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timer));
      if (!response.ok || !overlay.classList.contains('is-open')) return;
      const state = await response.json();
      const content = baseOptions(Number(state?.tokens?.available || 0), state?.entry || null);
      const header = sheet.querySelector('.rp-entry-options-head')?.outerHTML || '<div class="rp-entry-options-head"><button class="rp-entry-options-close" type="button" data-rp-entry-close>×</button></div>';
      sheet.innerHTML = `<div class="rp-entry-options-grab" aria-hidden="true"></div>${header}${content}`;
    } catch (_error) {
      // Never block the booking sheet if state refresh fails.
    }
  }

  function watchOverlay(node) {
    if (!node || node === observedOverlay) return;
    observedOverlay = node;
    overlayObserver?.disconnect();
    overlayObserver = new MutationObserver(() => {
      if (node.classList.contains('is-open')) syncOpenState();
    });
    overlayObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
    if (node.classList.contains('is-open')) syncOpenState();
  }

  const existing = document.querySelector('[data-rp-ranking-entry-options]');
  if (existing) watchOverlay(existing);

  const insertionObserver = new MutationObserver(() => {
    const node = document.querySelector('[data-rp-ranking-entry-options]');
    if (node) {
      watchOverlay(node);
      insertionObserver.disconnect();
    }
  });
  insertionObserver.observe(document.body, { childList: true, subtree: true });
})();
