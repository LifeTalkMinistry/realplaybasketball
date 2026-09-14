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
  let pageObserver = null;
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

  function titleParts(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.*?)(\s*·\s*(?:WEST WINS|EAST WINS|FINAL SCORE|LIVE))$/i);
    if (!match) return { base: text, suffix: '' };
    return { base: match[1].trim(), suffix: match[2] };
  }

  function canonicalOpenRankNumberForCard(card) {
    const sessionId = sessionIdFromCard(card);
    if (sessionId) {
      const canonical = Number(window.RealPlayOpenRankIdentity?.numberForSession?.(sessionId));
      if (Number.isSafeInteger(canonical) && canonical > 0) return canonical;
    }

    const text = String(card?.textContent || '');
    const match = text.match(/(?:OPEN\s+RANK(?:ING(?:\s+SESSION)?)?|CAREER)\s*#\s*(\d+)/i);
    const number = Number(match?.[1]);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }

  function injectStyles() {
    if (document.querySelector('[data-rp-session-title-admin-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpSessionTitleAdminStyle = '1';
    style.textContent = `
      .rp-update-session-name-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:13px 0 7px}
      .rp-update-session-name-row>h2{margin:0!important;min-width:0;flex:1}
      .rp-update-session-actions{flex:0 0 auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .rp-update-session-action{flex:0 0 auto;margin-top:1px;padding:5px 7px;border:1px solid rgba(55,205,255,.2);border-radius:8px;color:#54d9ff;background:rgba(22,105,190,.08);font-family:var(--rp-display,Arial,sans-serif);font-size:.40rem;font-weight:950;letter-spacing:.06em;white-space:nowrap}
      .rp-update-session-action[data-rp-delete-session]{border-color:rgba(255,74,91,.24);color:#ff6d79;background:rgba(130,18,30,.09)}
      .rp-update-session-action:disabled{opacity:.5}
      .rp-admin-session-manage-action[data-rp-manual-open-rank-number]{border-color:rgba(55,205,255,.38);color:#54d9ff;background:rgba(22,105,190,.10)}
      @media(max-width:380px){.rp-update-session-name-row{gap:7px}.rp-update-session-actions{gap:4px}.rp-update-session-action{padding:4px 6px;font-size:.37rem}}
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

      const actions = document.createElement('div');
      actions.className = 'rp-update-session-actions';

      const renameButton = document.createElement('button');
      renameButton.type = 'button';
      renameButton.className = 'rp-update-session-action';
      renameButton.dataset.rpEditSessionName = String(sessionId);
      renameButton.textContent = 'NAME ✎';

      const numberButton = document.createElement('button');
      numberButton.type = 'button';
      numberButton.className = 'rp-update-session-action';
      numberButton.dataset.rpSetOpenRankNumber = String(sessionId);
      numberButton.textContent = 'SET #';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'rp-update-session-action';
      deleteButton.dataset.rpDeleteSession = String(sessionId);
      deleteButton.textContent = 'DELETE';

      actions.append(renameButton, numberButton, deleteButton);
      row.appendChild(actions);
    });
  }

  function decorateGameControlManage() {
    if (!admin) return;
    const control = document.querySelector('.rp-admin-control');
    if (!control) return;

    const manage = control.querySelector('.rp-admin-session-manage');
    const actions = manage?.querySelector('.rp-admin-session-manage-actions');
    if (!actions || actions.querySelector('[data-rp-manual-open-rank-number]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-admin-session-manage-action';
    button.dataset.rpManualOpenRankNumber = '1';
    button.textContent = 'EDIT OPEN RANK NUMBER';
    actions.appendChild(button);
  }

  async function refreshOpenRankIdentity() {
    try {
      await window.RealPlayOpenRankIdentity?.refresh?.();
    } catch (_error) {
      // The authoritative save already succeeded. A reload below is the fallback.
    }
  }

  async function setActiveOpenRankNumber(button) {
    if (!admin || !button) return;
    const auth = token();
    if (!auth) return;

    button.disabled = true;
    const previousText = button.textContent;
    button.textContent = 'LOADING…';

    try {
      const response = await fetch(CONTROL_URL, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);

      const session = data?.control?.session || null;
      const sessionId = Number(session?.id || 0);
      const current = Number(session?.openRankNumber ?? session?.open_rank_number ?? 0);
      if (!Number.isSafeInteger(sessionId) || sessionId < 1) throw new Error('No active Open Ranking session is available.');

      const proposed = window.prompt(
        'Set the official Open Rank number for this game:',
        current > 0 ? String(current) : ''
      );
      if (proposed === null) return;

      const value = Number(String(proposed).trim());
      if (!Number.isSafeInteger(value) || value < 1 || value > 999999) {
        window.alert('Enter a whole Open Rank number from 1 to 999999.');
        return;
      }

      button.textContent = 'SAVING…';
      const saveResponse = await fetch(CONTROL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ action: 'set-open-rank-number', sessionId, openRankNumber: value }),
        cache: 'no-store',
      });
      const saveData = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(saveData?.message || saveData?.error || 'Could not change this Open Rank number.');

      button.textContent = 'SAVED ✓';
      await refreshOpenRankIdentity();
      window.dispatchEvent(new CustomEvent('realplay:admin-render'));
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      if (error?.message) window.alert(error.message);
      button.textContent = previousText;
    } finally {
      button.disabled = false;
    }
  }

  function queueDecorate() {
    if (!admin || decorateQueued) return;
    decorateQueued = true;
    window.requestAnimationFrame(() => {
      decorateQueued = false;
      decorateCards();
      decorateGameControlManage();
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

  function attachPageObserver() {
    if (pageObserver) return true;
    const control = document.querySelector('.rp-admin-control');
    if (!control) return false;
    pageObserver = new MutationObserver(() => {
      if (!admin) return;
      queueDecorate();
    });
    pageObserver.observe(control, { childList: true, subtree: true });
    return true;
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

      // A custom title must stop being treated as an auto-number-owned heading.
      // Otherwise open-rank-auto-id.js can immediately rewrite it back to the
      // previous numbered label before the refreshed backend payload arrives.
      delete card.dataset.rpOfficialOpenRankNumber;
      heading.textContent = `${title}${current.suffix}`;
      button.textContent = 'SAVED ✓';
      await refreshOpenRankIdentity();
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

  function visibleOpenRankNumber(card) {
    return canonicalOpenRankNumberForCard(card);
  }

  async function setOpenRankNumber(button) {
    if (!admin || !button) return;
    const sessionId = Number(button.dataset.rpSetOpenRankNumber || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const card = button.closest('.rp-update-card');
    const current = visibleOpenRankNumber(card);
    const proposed = window.prompt(
      'Set the official Open Rank number for this game:',
      current ? String(current) : ''
    );
    if (proposed === null) return;

    const value = Number(String(proposed).trim());
    if (!Number.isSafeInteger(value) || value < 1 || value > 999999) {
      window.alert('Enter a whole Open Rank number from 1 to 999999.');
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
          action: 'set-open-rank-number',
          sessionId,
          openRankNumber: value,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Could not change this Open Rank number.');
      }

      const persisted = Number(data?.control?.renumberedSession?.openRankNumber ?? value);
      if (Number.isSafeInteger(persisted) && persisted !== value) {
        throw new Error(`The backend returned Open Rank #${persisted} instead of #${value}.`);
      }

      button.textContent = 'SAVED ✓';
      await refreshOpenRankIdentity();
      window.dispatchEvent(new CustomEvent('realplay:admin-render'));
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      window.alert(error.message || 'Could not change this Open Rank number.');
      button.textContent = previousText;
      button.disabled = false;
    }
  }

  async function deleteSession(button) {
    if (!admin || !button) return;
    const sessionId = Number(button.dataset.rpDeleteSession || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) return;

    const card = button.closest('.rp-update-card');
    const openRankNumber = visibleOpenRankNumber(card);
    const label = openRankNumber ? `OPEN RANK #${String(openRankNumber).padStart(3, '0')}` : `SESSION ${sessionId}`;

    if (!window.confirm(`Delete ${label}?\n\nThis removes the session and its linked game data from Real Play.`)) return;
    const typed = window.prompt(`Type DELETE to permanently remove ${label}.`, '');
    if (typed !== 'DELETE') {
      if (typed !== null) window.alert('Deletion cancelled. Type DELETE exactly to confirm.');
      return;
    }

    const auth = token();
    if (!auth) return;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'DELETING…';

    try {
      const response = await fetch(CONTROL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ action: 'delete-session', sessionId }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Could not delete this session.');
      }
      button.textContent = 'DELETED ✓';
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      window.alert(error.message || 'Could not delete this session.');
      button.textContent = previousText;
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const manualManageNumber = event.target.closest('[data-rp-manual-open-rank-number]');
    const rename = event.target.closest('[data-rp-edit-session-name]');
    const renumber = event.target.closest('[data-rp-set-open-rank-number]');
    const remove = event.target.closest('[data-rp-delete-session]');
    const button = manualManageNumber || rename || renumber || remove;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (manualManageNumber) setActiveOpenRankNumber(manualManageNumber);
    else if (rename) renameSession(rename);
    else if (renumber) setOpenRankNumber(renumber);
    else deleteSession(remove);
  }, true);

  async function refreshAuthorityAndDecorate() {
    const auth = token();
    if (auth !== lastToken) admin = false;
    if (await detectAdmin()) {
      attachFeedObserver();
      attachPageObserver();
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

  injectStyles();
  attachFeedObserver();
  attachPageObserver();
  refreshAuthorityAndDecorate();
})();