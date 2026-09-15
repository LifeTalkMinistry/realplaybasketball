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
  let feedObserver = null;
  let decorateQueued = false;

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

  function isResultCard(card) {
    return /^career-\d+-result$/i.test(String(card?.dataset?.updateId || ''));
  }

  function titleParts(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.*?)(\s*·\s*(?:WEST WINS|EAST WINS|FINAL SCORE|TIED|FINAL|LIVE))$/i);
    if (!match) return { base: text, suffix: '' };
    return { base: match[1].trim(), suffix: match[2] };
  }

  function injectStyles() {
    if (document.querySelector('[data-rp-session-title-admin-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpSessionTitleAdminStyle = '1';
    style.textContent = `
      .rp-update-session-name-row{display:flex;align-items:center;justify-content:space-between;gap:7px;margin:13px 0 7px}
      .rp-update-session-name-row>h2{margin:0!important;min-width:0;flex:1}
      .rp-update-session-actions{flex:0 0 auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .rp-update-session-action{flex:0 0 auto;margin-top:1px;padding:5px 7px;border:1px solid rgba(55,205,255,.2);border-radius:8px;color:#54d9ff;background:rgba(22,105,190,.08);font-family:var(--rp-display,Arial,sans-serif);font-size:.40rem;font-weight:950;letter-spacing:.06em;white-space:nowrap}
      .rp-update-session-action[data-rp-delete-session]{border-color:rgba(255,74,91,.24);color:#ff6d79;background:rgba(130,18,30,.09)}
      .rp-update-session-action:disabled{opacity:.5}

      .rp-result-title-editable{cursor:text;outline:none;transition:opacity .15s ease,text-shadow .15s ease}
      .rp-result-title-editable:hover,.rp-result-title-editable:focus{opacity:.88;text-shadow:0 0 12px rgba(86,218,255,.32)}
      .rp-result-title-edit-trigger{flex:0 0 25px;width:25px;height:25px;padding:0;border:1px solid rgba(70,214,255,.28);border-radius:999px;color:#70dcff;background:rgba(10,66,103,.28);font-family:Arial,sans-serif;font-size:.66rem;font-weight:900;line-height:1;display:grid;place-items:center;cursor:pointer;opacity:.78}
      .rp-result-title-edit-trigger:hover,.rp-result-title-edit-trigger:focus{opacity:1;border-color:rgba(70,214,255,.58);box-shadow:0 0 10px rgba(51,208,255,.18)}

      .rp-result-title-editor{min-width:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:5px}
      .rp-result-title-editor input{min-width:0;width:100%;height:31px;padding:0 9px;border:1px solid rgba(69,213,255,.42);border-radius:9px;outline:none;color:#fff;background:rgba(2,15,25,.92);font-family:var(--rp-display,Arial,sans-serif);font-size:.55rem;font-weight:950;letter-spacing:.035em;text-transform:uppercase;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015),0 0 11px rgba(40,191,255,.08)}
      .rp-result-title-editor input:focus{border-color:#54d9ff;box-shadow:0 0 0 2px rgba(84,217,255,.10),0 0 14px rgba(40,191,255,.12)}
      .rp-result-title-suffix{color:#7d8b9a;font-family:var(--rp-display,Arial,sans-serif);font-size:.42rem;font-weight:900;letter-spacing:.04em;white-space:nowrap}
      .rp-result-title-editor button{height:29px;padding:0 8px;border-radius:8px;font-family:var(--rp-display,Arial,sans-serif);font-size:.39rem;font-weight:950;letter-spacing:.055em;cursor:pointer}
      .rp-result-title-save{border:1px solid rgba(58,221,255,.38);color:#70e6ff;background:rgba(13,105,147,.20)}
      .rp-result-title-cancel{border:1px solid rgba(148,164,184,.22);color:#aeb8c5;background:rgba(38,48,60,.24)}
      .rp-result-title-editor button:disabled{opacity:.45;cursor:default}

      @media(max-width:480px){
        .rp-update-session-name-row{gap:5px}
        .rp-update-session-actions{gap:4px}
        .rp-update-session-action{padding:4px 6px;font-size:.37rem}
        .rp-result-title-edit-trigger{width:23px;height:23px;flex-basis:23px;font-size:.60rem}
        .rp-result-title-editor{grid-template-columns:minmax(0,1fr) auto auto;gap:4px}
        .rp-result-title-suffix{grid-column:1/-1;grid-row:2;font-size:.37rem;padding-left:2px}
        .rp-result-title-editor input{height:29px;font-size:.48rem}
        .rp-result-title-editor button{height:27px;padding:0 6px;font-size:.35rem}
      }
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

  function ensureActions(row) {
    let actions = row?.querySelector('.rp-update-session-actions');
    if (!row) return null;
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'rp-update-session-actions';
      row.appendChild(actions);
    }
    return actions;
  }

  function ensureDeleteButton(actions, sessionId) {
    let button = actions.querySelector('[data-rp-delete-session]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-update-session-action';
      button.dataset.rpDeleteSession = String(sessionId);
      button.textContent = 'DELETE';
      actions.appendChild(button);
    }
  }

  function ensureRegularRenameButton(actions, sessionId) {
    let button = actions.querySelector('[data-rp-edit-session-name]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-update-session-action';
      button.dataset.rpEditSessionName = String(sessionId);
      button.textContent = 'NAME ✎';
      actions.insertBefore(button, actions.firstChild);
    }
  }

  function syncResultTitleEditUi(card, row, heading, actions, sessionId) {
    // Root-number repair is intentionally not part of the result-card UI.
    actions.querySelectorAll('[data-rp-set-open-rank-number]').forEach((button) => button.remove());

    if (!isResultCard(card)) {
      heading.classList.remove('rp-result-title-editable');
      heading.removeAttribute('data-rp-edit-result-title-heading');
      heading.removeAttribute('tabindex');
      row.querySelectorAll('[data-rp-edit-result-title]').forEach((button) => button.remove());
      ensureRegularRenameButton(actions, sessionId);
      return;
    }

    actions.querySelectorAll('[data-rp-edit-session-name]').forEach((button) => button.remove());
    heading.classList.add('rp-result-title-editable');
    heading.dataset.rpEditResultTitleHeading = String(sessionId);
    heading.tabIndex = 0;
    heading.setAttribute('aria-label', 'Edit result display title');

    let editButton = row.querySelector('[data-rp-edit-result-title]');
    if (!editButton) {
      editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'rp-result-title-edit-trigger';
      editButton.dataset.rpEditResultTitle = String(sessionId);
      editButton.setAttribute('aria-label', 'Edit result display title');
      editButton.title = 'Edit display title';
      editButton.textContent = '✎';
      row.insertBefore(editButton, actions);
    }
  }

  function decorateCards() {
    if (!admin) return;
    const panel = document.querySelector('[data-rp-updates]');
    if (!panel) return;

    panel.querySelectorAll('.rp-update-card[data-update-id]').forEach((card) => {
      const sessionId = sessionIdFromCard(card);
      if (!sessionId) return;

      let row = card.querySelector('.rp-update-session-name-row');
      let heading = row?.querySelector(':scope > h2');

      if (!row) {
        heading = card.querySelector(':scope > h2');
        if (!heading) return;
        row = document.createElement('div');
        row.className = 'rp-update-session-name-row';
        heading.parentNode.insertBefore(row, heading);
        row.appendChild(heading);
      }

      if (!heading) heading = row.querySelector(':scope > h2');
      if (!heading) return;

      const actions = ensureActions(row);
      if (!actions) return;

      ensureDeleteButton(actions, sessionId);
      syncResultTitleEditUi(card, row, heading, actions, sessionId);
    });
  }

  async function refreshResultFeedTitle() {
    try {
      await window.RealPlayOpenRankIdentity?.refresh?.();
    } catch (_error) {
      // Save already succeeded. The local heading remains correct even if the
      // public feed refresh is temporarily unavailable.
    }
  }

  function queueDecorate() {
    if (!admin || decorateQueued) return;
    decorateQueued = true;
    window.requestAnimationFrame(() => {
      decorateQueued = false;
      decorateCards();
    });
  }

  function attachFeedObserver() {
    if (feedObserver) return true;
    const feed = document.querySelector('[data-rp-updates] [data-updates-feed]');
    if (!feed) return false;

    feedObserver = new MutationObserver((mutations) => {
      if (!admin) return;
      const hasNewCard = mutations.some((mutation) => [...mutation.addedNodes].some((node) => (
        node instanceof HTMLElement
        && (node.matches?.('.rp-update-card') || node.querySelector?.('.rp-update-card'))
      )));
      if (hasNewCard) queueDecorate();
    });
    feedObserver.observe(feed, { childList: true });
    return true;
  }

  async function postControl(body) {
    const auth = token();
    if (!auth) throw new Error('Please sign in to edit this result.');

    const response = await fetch(CONTROL_URL, {
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
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    }
    return data;
  }

  function resultEditorFromNode(node) {
    return node?.closest?.('[data-rp-result-title-editor]') || null;
  }

  function closeResultTitleEditor(editor) {
    if (!editor) return;
    const row = editor.closest('.rp-update-session-name-row');
    const heading = row?.querySelector(':scope > h2');
    const editButton = row?.querySelector('[data-rp-edit-result-title]');
    const actions = row?.querySelector('.rp-update-session-actions');

    editor.remove();
    if (heading) heading.hidden = false;
    if (editButton) editButton.hidden = false;
    if (actions) actions.hidden = false;
  }

  function beginResultTitleEdit(target) {
    if (!admin || !target) return;
    const card = target.closest('.rp-update-card');
    if (!card || !isResultCard(card)) return;

    const sessionId = sessionIdFromCard(card);
    const row = card.querySelector('.rp-update-session-name-row');
    const heading = row?.querySelector(':scope > h2');
    if (!sessionId || !row || !heading) return;

    const existing = row.querySelector('[data-rp-result-title-editor]');
    if (existing) {
      existing.querySelector('input')?.focus();
      return;
    }

    const current = titleParts(heading.textContent);
    const editor = document.createElement('div');
    editor.className = 'rp-result-title-editor';
    editor.dataset.rpResultTitleEditor = String(sessionId);
    editor.dataset.rpResultTitleSuffix = current.suffix;
    editor.innerHTML = `
      <input type="text" maxlength="100" autocomplete="off" aria-label="Result display title">
      <span class="rp-result-title-suffix"></span>
      <button type="button" class="rp-result-title-save" data-rp-save-result-title>SAVE</button>
      <button type="button" class="rp-result-title-cancel" data-rp-cancel-result-title>CANCEL</button>`;

    const input = editor.querySelector('input');
    const suffix = editor.querySelector('.rp-result-title-suffix');
    input.value = current.base;
    suffix.textContent = current.suffix;

    const editButton = row.querySelector('[data-rp-edit-result-title]');
    const actions = row.querySelector('.rp-update-session-actions');
    heading.hidden = true;
    if (editButton) editButton.hidden = true;
    if (actions) actions.hidden = true;
    row.insertBefore(editor, actions || null);

    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  async function saveResultTitle(button) {
    if (!admin || !button) return;
    const editor = resultEditorFromNode(button);
    const card = editor?.closest('.rp-update-card');
    const row = editor?.closest('.rp-update-session-name-row');
    const heading = row?.querySelector(':scope > h2');
    const input = editor?.querySelector('input');
    const sessionId = Number(editor?.dataset?.rpResultTitleEditor || 0);
    const suffix = String(editor?.dataset?.rpResultTitleSuffix || '');
    if (!editor || !card || !heading || !input || !Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const displayTitle = input.value.trim();
    if (!displayTitle) {
      window.alert('Result display title cannot be empty.');
      input.focus();
      return;
    }
    if (displayTitle.length > 100) {
      window.alert('Keep the result display title within 100 characters.');
      input.focus();
      return;
    }

    const buttons = [...editor.querySelectorAll('button')];
    buttons.forEach((item) => { item.disabled = true; });
    button.textContent = 'SAVING…';

    try {
      const data = await postControl({
        action: 'set-result-display-title',
        sessionId,
        displayTitle,
      });
      const persisted = String(data?.control?.resultDisplayTitle?.displayTitle || displayTitle).trim() || displayTitle;

      // This changes presentation only. The result suffix remains automatic and
      // the technical session/Open Rank/recording identities are untouched.
      heading.textContent = `${persisted}${suffix}`;
      closeResultTitleEditor(editor);
      await refreshResultFeedTitle();
      window.dispatchEvent(new CustomEvent('realplay:admin-render'));
    } catch (error) {
      window.alert(error.message || 'Could not save this result display title.');
      buttons.forEach((item) => { item.disabled = false; });
      button.textContent = 'SAVE';
      input.focus();
    }
  }

  async function renameSession(button) {
    if (!admin || !button) return;
    const sessionId = Number(button.dataset.rpEditSessionName || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const card = button.closest('.rp-update-card');
    const heading = card?.querySelector('.rp-update-session-name-row > h2, :scope > h2');
    if (!card || !heading || isResultCard(card)) return;

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

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'SAVING…';

    try {
      await postControl({ action: 'rename-session', sessionId, title });
      heading.textContent = `${title}${current.suffix}`;
      button.textContent = 'SAVED ✓';
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = 'NAME ✎';
      }, 1200);
    } catch (error) {
      window.alert(error.message || 'Could not rename this session.');
      button.textContent = previousText;
    } finally {
      button.disabled = false;
    }
  }

  async function deleteSession(button) {
    if (!admin || !button) return;
    const sessionId = Number(button.dataset.rpDeleteSession || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const card = button.closest('.rp-update-card');
    const heading = card?.querySelector('.rp-update-session-name-row > h2, :scope > h2');
    const label = titleParts(heading?.textContent || '').base || `SESSION ${sessionId}`;

    if (!window.confirm(`Delete ${label}?\
\
This removes the session and its linked game data from Real Play.`)) return;
    const typed = window.prompt(`Type DELETE to permanently remove ${label}.`, '');
    if (typed !== 'DELETE') {
      if (typed !== null) window.alert('Deletion cancelled. Type DELETE exactly to confirm.');
      return;
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'DELETING…';

    try {
      await postControl({ action: 'delete-session', sessionId });
      button.textContent = 'DELETED ✓';
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      window.alert(error.message || 'Could not delete this session.');
      button.textContent = previousText;
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const save = event.target.closest('[data-rp-save-result-title]');
    const cancel = event.target.closest('[data-rp-cancel-result-title]');
    const editButton = event.target.closest('[data-rp-edit-result-title]');
    const editHeading = event.target.closest('[data-rp-edit-result-title-heading]');
    const rename = event.target.closest('[data-rp-edit-session-name]');
    const remove = event.target.closest('[data-rp-delete-session]');
    const target = save || cancel || editButton || editHeading || rename || remove;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    if (save) saveResultTitle(save);
    else if (cancel) closeResultTitleEditor(resultEditorFromNode(cancel));
    else if (editButton || editHeading) beginResultTitleEdit(editButton || editHeading);
    else if (rename) renameSession(rename);
    else deleteSession(remove);
  }, true);

  document.addEventListener('keydown', (event) => {
    const heading = event.target.closest?.('[data-rp-edit-result-title-heading]');
    if (heading && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      beginResultTitleEdit(heading);
      return;
    }

    const editor = resultEditorFromNode(event.target);
    if (!editor) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeResultTitleEditor(editor);
      return;
    }
    if (event.key === 'Enter' && event.target.matches('input')) {
      event.preventDefault();
      const save = editor.querySelector('[data-rp-save-result-title]');
      if (save && !save.disabled) saveResultTitle(save);
    }
  }, true);

  async function refreshAuthorityAndDecorate() {
    const auth = token();
    if (auth !== lastToken) admin = false;
    if (await detectAdmin()) {
      attachFeedObserver();
      queueDecorate();
    }
  }

  document.addEventListener('click', (event) => {
    const opensUpdates = event.target.closest?.('[data-rp-simple-nav-item="world"], [data-rp-main-action="updates"], [data-rp-open-updates], [data-rp-action="updates"]');
    if (!opensUpdates) return;
    window.setTimeout(refreshAuthorityAndDecorate, 0);
  }, true);

  window.addEventListener('focus', () => {
    refreshAuthorityAndDecorate();
  });

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
  window.addEventListener('realplay:admin-render', () => {
    queueDecorate();
  });

  injectStyles();
  attachFeedObserver();
  refreshAuthorityAndDecorate();
})();