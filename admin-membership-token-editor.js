(() => {
  if (window.__realPlayAdminMembershipTokenEditorInstalled) return;
  window.__realPlayAdminMembershipTokenEditorInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let activePlayerId = null;
  let balance = null;
  let busy = false;
  let requestSequence = 0;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(body) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}/api/real-play/admin/player`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Play Token operation failed.');
    return data;
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-token-editor-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpTokenEditorStyles = '1';
    style.textContent = `
      .rp-member-token-admin{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border:1px solid rgba(67,232,255,.16);border-radius:13px;background:linear-gradient(145deg,rgba(8,27,40,.86),rgba(4,13,22,.92))}
      .rp-member-token-copy{min-width:0}
      .rp-member-token-copy>span{display:block;color:#68eaff;font-size:.52rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .rp-member-token-copy>strong{display:block;margin-top:4px;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:.78rem;font-weight:950}
      .rp-member-token-copy>small{display:block;margin-top:3px;color:#6f8497;font-size:.52rem;line-height:1.35}
      .rp-member-token-stepper{display:grid;grid-template-columns:34px 54px 34px;align-items:stretch;overflow:hidden;border:1px solid rgba(67,232,255,.24);border-radius:11px;background:#040c14}
      .rp-member-token-stepper button{min-height:44px;border:0;background:#081a28;color:#75ebff;font:950 1.15rem/1 var(--rp-display,Arial,sans-serif);cursor:pointer}
      .rp-member-token-stepper button:first-child{border-right:1px solid rgba(67,232,255,.13)}
      .rp-member-token-stepper button:last-child{border-left:1px solid rgba(67,232,255,.13)}
      .rp-member-token-stepper button:disabled{cursor:default;opacity:.35}
      .rp-member-token-value{display:grid;place-items:center;align-content:center;min-width:0;text-align:center}
      .rp-member-token-value strong{color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1rem;font-weight:950;line-height:1}
      .rp-member-token-value small{margin-top:3px;color:#617a8f;font-size:.39rem;font-weight:950;letter-spacing:.08em}
      .rp-member-token-message{grid-column:1/-1;min-height:14px;margin:0;color:#758da0;font-size:.52rem;line-height:1.35}
      .rp-member-token-message.error{color:#ff9aac}
      .rp-member-token-message.success{color:#73e8b2}
      @media(max-width:380px){.rp-member-token-admin{grid-template-columns:1fr}.rp-member-token-stepper{grid-template-columns:40px 1fr 40px}.rp-member-token-message{grid-column:1}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    const fields = document.querySelector('.rp-member-editor-fields');
    if (!fields) return null;
    let panel = fields.querySelector('[data-member-token-admin]');
    if (panel) return panel;

    ensureStyles();
    panel = document.createElement('div');
    panel.className = 'rp-member-token-admin';
    panel.dataset.memberTokenAdmin = '1';
    panel.innerHTML = `
      <div class="rp-member-token-copy">
        <span>Play Tokens</span>
        <strong>ADMIN TOKEN BALANCE</strong>
        <small>Monthly Member includes 4 Play Tokens per membership cycle.</small>
      </div>
      <div class="rp-member-token-stepper" aria-label="Edit Play Token balance">
        <button type="button" data-member-token-adjust="-1" aria-label="Remove one Play Token" title="Remove 1 token">−</button>
        <div class="rp-member-token-value"><strong data-member-token-balance>—</strong><small>TOKENS</small></div>
        <button type="button" data-member-token-adjust="1" aria-label="Add one Play Token" title="Add 1 token">+</button>
      </div>
      <p class="rp-member-token-message" data-member-token-message>Loading token balance…</p>`;

    const note = fields.querySelector('[data-member-editor-note]');
    fields.insertBefore(panel, note || null);
    return panel;
  }

  function renderState(message = '', state = '') {
    const panel = ensurePanel();
    if (!panel) return;
    const value = panel.querySelector('[data-member-token-balance]');
    const status = panel.querySelector('[data-member-token-message]');
    const minus = panel.querySelector('[data-member-token-adjust="-1"]');
    const controls = panel.querySelectorAll('[data-member-token-adjust]');

    if (value) value.textContent = balance === null ? '—' : String(balance);
    controls.forEach((button) => { button.disabled = busy || balance === null; });
    if (minus && balance !== null && balance <= 0) minus.disabled = true;
    if (status) {
      status.textContent = message || 'Use − or + to make an admin correction.';
      status.className = `rp-member-token-message${state ? ` ${state}` : ''}`;
    }
  }

  async function loadBalance(playerId) {
    const sequence = ++requestSequence;
    activePlayerId = Number(playerId) || null;
    balance = null;
    busy = true;
    renderState('Loading token balance…');
    if (!activePlayerId) {
      busy = false;
      renderState('Player token balance is unavailable.', 'error');
      return;
    }

    try {
      const data = await api({ action: 'membership_token_get', playerId: activePlayerId });
      if (sequence !== requestSequence || Number(data.playerId) !== activePlayerId) return;
      balance = Number.isFinite(Number(data.balance)) ? Number(data.balance) : 0;
      busy = false;
      renderState(
        Number(data.grantApplied) > 0
          ? `${data.grantApplied} monthly Play Tokens added for this membership cycle.`
          : 'Use − or + to make an admin correction.',
        Number(data.grantApplied) > 0 ? 'success' : ''
      );
    } catch (error) {
      if (sequence !== requestSequence) return;
      busy = false;
      balance = null;
      renderState(error.message || 'Could not load Play Tokens.', 'error');
    }
  }

  async function adjust(delta) {
    if (!activePlayerId || busy || balance === null) return;
    const requested = Number(delta);
    if (!Number.isInteger(requested) || requested === 0) return;

    busy = true;
    renderState(requested > 0 ? 'Adding Play Token…' : 'Removing Play Token…');
    try {
      const data = await api({
        action: 'membership_token_adjust',
        playerId: activePlayerId,
        delta: requested,
      });
      balance = Number.isFinite(Number(data.balance)) ? Number(data.balance) : balance;
      busy = false;
      const applied = Number(data.appliedDelta || 0);
      renderState(
        applied > 0
          ? `Added ${applied} Play Token${applied === 1 ? '' : 's'}.`
          : applied < 0
            ? `Removed ${Math.abs(applied)} Play Token${Math.abs(applied) === 1 ? '' : 's'}.`
            : 'Token balance is already at 0.',
        applied !== 0 ? 'success' : ''
      );
    } catch (error) {
      busy = false;
      renderState(error.message || 'Could not update Play Tokens.', 'error');
    }
  }

  document.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-member-edit]');
    if (edit) {
      const playerId = Number(edit.dataset.memberEdit);
      window.requestAnimationFrame(() => {
        ensurePanel();
        loadBalance(playerId);
      });
      return;
    }

    const tokenButton = event.target.closest?.('[data-member-token-adjust]');
    if (tokenButton) {
      event.preventDefault();
      adjust(Number(tokenButton.dataset.memberTokenAdjust));
      return;
    }

    if (event.target.closest?.('[data-member-editor-close]') ||
        (event.target.matches?.('[data-member-editor-backdrop]') && event.target.classList.contains('open'))) {
      requestSequence += 1;
      activePlayerId = null;
      balance = null;
      busy = false;
    }
  });
})();