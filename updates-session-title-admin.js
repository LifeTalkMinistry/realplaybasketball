(() => {
  if (window.__realPlayUpdatesSessionTitleAdminInstalled) return;
  window.__realPlayUpdatesSessionTitleAdminInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const UPDATES_URL = `${API_BASE_URL}/api/real-play/updates`;
  const CONTROL_URL = `${API_BASE_URL}/api/real-play/admin/career/control`;

  let admin = false;
  let checkingAdmin = false;
  let lastToken = '';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function visitor() {
    return localStorage.getItem(VISITOR_KEY) === '1' || Boolean(window.RealPlayVisitor?.isActive?.());
  }

  function sessionIdFromCard(card) {
    const value = String(card?.dataset?.updateId || '');
    const match = value.match(/^career-(\d+)-(?:result|live|schedule)$/i);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function titleParts(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.*?)(\s*·\s*(?:WEST WINS|EAST WINS|FINAL SCORE|LIVE))$/i);
    if (!match) return { base: text, suffix: '' };
    return { base: match[1].trim(), suffix: match[2] };
  }

  function injectStyles() {
    if (document.querySelector('[data-rp-session-title-admin-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpSessionTitleAdminStyle = '1';
    style.textContent = `
      .rp-update-session-name-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:13px 0 7px}
      .rp-update-session-name-row>h2{margin:0!important;min-width:0;flex:1}
      .rp-update-edit-session-name{flex:0 0 auto;margin-top:1px;padding:5px 7px;border:1px solid rgba(55,205,255,.2);border-radius:8px;color:#54d9ff;background:rgba(22,105,190,.08);font-family:var(--rp-display,Arial,sans-serif);font-size:.42rem;font-weight:950;letter-spacing:.07em;white-space:nowrap}
      .rp-update-edit-session-name:disabled{opacity:.5}
      @media(max-width:380px){.rp-update-session-name-row{gap:7px}.rp-update-edit-session-name{padding:4px 6px;font-size:.39rem}}
    `;
    document.head.appendChild(style);
  }

  async function detectAdmin() {
    const auth = token();
    if (!auth || visitor()) {
      admin = false;
      lastToken = auth;
      return false;
    }
    if (checkingAdmin) return admin;
    if (admin && auth === lastToken) return true;

    checkingAdmin = true;
    lastToken = auth;
    try {
      const response = await fetch(UPDATES_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ action: 'admin_status' }),
        cache: 'no-store',
      });
      admin = response.ok;
    } catch (_error) {
      admin = false;
    } finally {
      checkingAdmin = false;
    }
    return admin;
  }

  function decorateCards() {
    if (!admin) return;
    const panel = document.querySelector('[data-rp-updates]');
    if (!panel) return;

    panel.querySelectorAll('.rp-update-card[data-update-id]').forEach((card) => {
      const sessionId = sessionIdFromCard(card);
      if (!sessionId || card.querySelector('[data-rp-edit-session-name]')) return;
      const heading = card.querySelector(':scope > h2');
      if (!heading) return;

      const row = document.createElement('div');
      row.className = 'rp-update-session-name-row';
      heading.parentNode.insertBefore(row, heading);
      row.appendChild(heading);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-update-edit-session-name';
      button.dataset.rpEditSessionName = String(sessionId);
      button.textContent = 'EDIT NAME ✎';
      row.appendChild(button);
    });
  }

  async function renameSession(button) {
    if (!admin || !button) return;
    const sessionId = Number(button.dataset.rpEditSessionName || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const card = button.closest('.rp-update-card');
    const heading = card?.querySelector('.rp-update-session-name-row > h2, :scope > h2');
    if (!card || !heading) return;

    const current = titleParts(heading.textContent);
    const proposed = window.prompt('Edit the Real Play session name:', current.base);
    if (proposed === null) return;
    const title = proposed.trim();

    if (!title) {
      window.alert('Session name cannot be empty.');
      return;
    }
    if (title.length > 100) {
      window.alert('Keep the session name within 100 characters.');
      return;
    }

    const auth = token();
    if (!auth) return;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'SAVING…';

    try {
      const response = await fetch(CONTROL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          action: 'rename-session',
          sessionId,
          title,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Could not rename this session.');
      }

      heading.textContent = `${title}${current.suffix}`;
      button.textContent = 'SAVED ✓';
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = 'EDIT NAME ✎';
      }, 1200);
    } catch (error) {
      window.alert(error.message || 'Could not rename this session.');
      button.textContent = previousText;
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-edit-session-name]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    renameSession(button);
  }, true);

  const observer = new MutationObserver(() => {
    if (admin) decorateCards();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  async function refreshAuthorityAndDecorate() {
    const auth = token();
    if (auth !== lastToken) admin = false;
    if (await detectAdmin()) decorateCards();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === VISITOR_KEY) {
      admin = false;
      lastToken = '';
      refreshAuthorityAndDecorate();
    }
  });
  window.addEventListener('realplay:visitorchange', () => {
    admin = false;
    lastToken = '';
    refreshAuthorityAndDecorate();
  });

  injectStyles();
  refreshAuthorityAndDecorate();
  window.setInterval(() => {
    const panel = document.querySelector('[data-rp-updates].open');
    if (panel) refreshAuthorityAndDecorate();
  }, 2500);
})();
