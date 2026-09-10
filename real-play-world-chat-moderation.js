(() => {
  if (window.__realPlayWorldChatModerationInstalled) return;
  window.__realPlayWorldChatModerationInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/community';
  const HOLD_MS = 560;
  const MOVE_CANCEL_PX = 11;

  let holdTimer = 0;
  let holdTarget = null;
  let holdPointerId = null;
  let holdStartX = 0;
  let holdStartY = 0;
  let activeMessage = null;
  let syncing = false;
  let syncQueued = false;
  let syncTimer = 0;
  let adminProbeTimer = 0;
  let adminProbeAttempts = 0;

  function isAdmin() {
    return window.__realPlayAdminVerified === true;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function community(action, payload = {}) {
    const auth = token();
    if (!auth) throw new Error('Please sign in to Real Play first.');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Unable to moderate this message.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function thread() {
    return document.querySelector('[data-chat-thread]');
  }

  function currentChannel() {
    return document.querySelector('[data-chat-channels] .rp-chat-channel.active')?.dataset.chatChannel || 'world';
  }

  function setStatus(copy = '', type = '') {
    const node = document.querySelector('[data-chat-status]');
    if (!node) return;
    node.textContent = copy;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
    if (copy && type !== 'error') {
      window.setTimeout(() => {
        if (node.textContent === copy) {
          node.textContent = '';
          node.classList.remove('success');
        }
      }, 1700);
    }
  }

  async function syncMessageIds() {
    if (!isAdmin()) return;
    const root = thread();
    if (!root) return;
    if (syncing) {
      syncQueued = true;
      return;
    }

    syncing = true;
    try {
      const channel = currentChannel();
      const data = await community('chat', { channel });
      const serverMessages = Array.isArray(data?.messages) ? data.messages : [];
      const domMessages = [...root.querySelectorAll('.rp-chat-message')];

      if (serverMessages.length !== domMessages.length) return;

      domMessages.forEach((node, index) => {
        const id = Number(serverMessages[index]?.id);
        if (!Number.isSafeInteger(id) || id <= 0) return;
        node.dataset.chatMessageId = String(id);
        if (!node.classList.contains('rp-chat-admin-target')) {
          node.classList.add('rp-chat-admin-target');
          node.setAttribute('aria-label', 'Chat message. Admin: press and hold for moderation options.');
        }
      });
    } catch (_error) {
      // Chat itself owns visible loading errors. Moderation sync stays silent.
    } finally {
      syncing = false;
      if (syncQueued) {
        syncQueued = false;
        scheduleSync(80);
      }
    }
  }

  function scheduleSync(delay = 90) {
    if (!isAdmin()) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncMessageIds, delay);
  }

  function ensureSheet() {
    let backdrop = document.querySelector('[data-rp-chat-admin-backdrop]');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.className = 'rp-chat-admin-backdrop';
    backdrop.dataset.rpChatAdminBackdrop = 'true';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `
      <section class="rp-chat-admin-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-chat-admin-title">
        <div class="rp-chat-admin-sheet-head">
          <small>REAL PLAY ADMIN</small>
          <strong id="rp-chat-admin-title">MESSAGE CONTROL</strong>
          <span data-rp-chat-admin-preview>Selected chat message</span>
        </div>
        <button class="rp-chat-admin-action" type="button" data-rp-chat-admin-action="hide">
          <span><strong>HIDE MESSAGE</strong><small>Remove it from player view but preserve a moderation record.</small></span><b>○</b>
        </button>
        <button class="rp-chat-admin-action danger" type="button" data-rp-chat-admin-action="delete">
          <span><strong>DELETE PERMANENTLY</strong><small>Remove this message for everyone.</small></span><b>×</b>
        </button>
        <button class="rp-chat-admin-action cancel" type="button" data-rp-chat-admin-action="cancel"><strong>CANCEL</strong></button>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeSheet();
      const button = event.target.closest('[data-rp-chat-admin-action]');
      if (!button) return;
      const action = button.dataset.rpChatAdminAction;
      if (action === 'cancel') {
        closeSheet();
        return;
      }
      runModeration(action, button);
    });

    return backdrop;
  }

  function previewFor(message) {
    const author = String(message?.querySelector('.rp-chat-bubble strong')?.textContent || 'YOUR MESSAGE').trim();
    const body = String(message?.querySelector('.rp-chat-bubble p')?.textContent || '').trim();
    const compact = body.length > 58 ? `${body.slice(0, 58)}…` : body;
    return compact ? `${author} · ${compact}` : author;
  }

  function openSheet(message) {
    if (!isAdmin() || !message?.dataset.chatMessageId) return;
    activeMessage = message;
    const backdrop = ensureSheet();
    const preview = backdrop.querySelector('[data-rp-chat-admin-preview]');
    if (preview) preview.textContent = previewFor(message);
    backdrop.querySelectorAll('[data-rp-chat-admin-action]').forEach((button) => { button.disabled = false; });
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-chat-admin-menu-open');
    requestAnimationFrame(() => backdrop.querySelector('[data-rp-chat-admin-action="hide"]')?.focus({ preventScroll: true }));
  }

  function closeSheet() {
    const backdrop = document.querySelector('[data-rp-chat-admin-backdrop]');
    backdrop?.classList.remove('open');
    backdrop?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-chat-admin-menu-open');
    activeMessage = null;
  }

  async function runModeration(action, clickedButton) {
    if (!isAdmin() || !activeMessage) return;
    const messageId = Number(activeMessage.dataset.chatMessageId);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) return;

    if (action === 'delete') {
      const confirmed = window.confirm('Permanently delete this chat message for everyone? This cannot be undone.');
      if (!confirmed) return;
    }

    const backdrop = ensureSheet();
    backdrop.querySelectorAll('[data-rp-chat-admin-action]').forEach((button) => { button.disabled = true; });
    if (clickedButton) clickedButton.disabled = true;

    try {
      await community('moderate_chat', {
        messageId,
        moderationAction: action,
      });
      const removed = activeMessage;
      closeSheet();
      removed?.remove();
      setStatus(action === 'hide' ? 'MESSAGE HIDDEN BY ADMIN.' : 'MESSAGE DELETED BY ADMIN.', 'success');
      scheduleSync(180);
    } catch (error) {
      backdrop.querySelectorAll('[data-rp-chat-admin-action]').forEach((button) => { button.disabled = false; });
      setStatus(error.message || 'Unable to moderate this message.', 'error');
    }
  }

  function cancelHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdTarget = null;
    holdPointerId = null;
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isAdmin()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const message = event.target.closest('.rp-chat-message[data-chat-message-id]');
    if (!message || !thread()?.contains(message)) return;

    cancelHold();
    holdTarget = message;
    holdPointerId = event.pointerId;
    holdStartX = event.clientX;
    holdStartY = event.clientY;
    holdTimer = window.setTimeout(() => {
      const target = holdTarget;
      cancelHold();
      if (!target?.isConnected) return;
      try {
        if ('vibrate' in navigator) navigator.vibrate(18);
      } catch (_error) {}
      openSheet(target);
    }, HOLD_MS);
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!holdTimer || event.pointerId !== holdPointerId) return;
    if (Math.hypot(event.clientX - holdStartX, event.clientY - holdStartY) > MOVE_CANCEL_PX) cancelHold();
  }, true);

  document.addEventListener('pointerup', cancelHold, true);
  document.addEventListener('pointercancel', cancelHold, true);
  window.addEventListener('blur', cancelHold);

  document.addEventListener('contextmenu', (event) => {
    if (!isAdmin()) return;
    const message = event.target.closest('.rp-chat-message[data-chat-message-id]');
    if (!message || !thread()?.contains(message)) return;
    event.preventDefault();
    cancelHold();
    openSheet(message);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-rp-chat-admin-backdrop].open')) closeSheet();
  });

  const observer = new MutationObserver((mutations) => {
    if (!isAdmin()) return;
    if (mutations.some((mutation) => mutation.target.closest?.('[data-chat-thread]') || mutation.target.matches?.('[data-chat-thread]'))) {
      scheduleSync();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  adminProbeTimer = window.setInterval(() => {
    adminProbeAttempts += 1;
    if (isAdmin()) {
      window.clearInterval(adminProbeTimer);
      adminProbeTimer = 0;
      scheduleSync(0);
      return;
    }
    if (adminProbeAttempts >= 80) {
      window.clearInterval(adminProbeTimer);
      adminProbeTimer = 0;
    }
  }, 350);

  window.addEventListener('focus', () => scheduleSync(60));
})();
