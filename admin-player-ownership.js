(() => {
  if (window.__realPlayAdminPlayerOwnershipInstalled) return;
  window.__realPlayAdminPlayerOwnershipInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SECTION_LABELS = {
    unclaimed: 'UNCLAIMED',
    pending: 'PENDING',
    disputes: 'DISPUTES',
  };

  let ownershipOpen = false;
  let activeSection = 'unclaimed';
  let renderSequence = 0;
  let searchTimer = null;

  async function api(path, options = {}) {
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function adminBody() {
    return adminRoot()?.querySelector('[data-admin-body]') || null;
  }

  function ownershipTab() {
    return adminRoot()?.querySelector('[data-admin-ownership-tab]') || null;
  }

  function setOwnershipTabActive(active) {
    const root = adminRoot();
    if (!root) return;
    root.querySelectorAll('.rp-admin-tab').forEach((tab) => {
      tab.classList.toggle('active', active && tab.hasAttribute('data-admin-ownership-tab'));
    });
  }

  function ensureOwnershipTab() {
    const root = adminRoot();
    const nav = root?.querySelector('.rp-admin-tabs');
    if (!nav) return false;
    if (ownershipTab()) return true;

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'rp-admin-tab';
    tab.dataset.adminOwnershipTab = '1';
    tab.textContent = 'OWNERSHIP';
    tab.setAttribute('aria-label', 'Player ownership management');

    const playersTab = nav.querySelector('[data-admin-tab="players"]');
    if (playersTab) playersTab.insertAdjacentElement('afterend', tab);
    else nav.appendChild(tab);

    tab.addEventListener('click', () => {
      ownershipOpen = true;
      setOwnershipTabActive(true);
      renderOwnership();
    });

    nav.addEventListener('click', (event) => {
      const baseTab = event.target.closest('[data-admin-tab]');
      if (!baseTab || event.target.closest('[data-admin-ownership-tab]')) return;
      ownershipOpen = false;
      tab.classList.remove('active');
    });

    return true;
  }

  function sectionTabsHtml() {
    return `<div class="rp-admin-ownership-tabs" role="tablist" aria-label="Ownership sections">
      ${Object.entries(SECTION_LABELS).map(([key, label]) => `
        <button type="button" class="rp-admin-ownership-tab${activeSection === key ? ' active' : ''}" data-admin-ownership-section="${key}">${label}</button>`).join('')}
    </div>`;
  }

  function shellHtml() {
    return `
      <div class="rp-admin-title rp-admin-ownership-title">
        <span class="rp-admin-kicker">PLAYER IDENTITY</span>
        <h1>OWNERSHIP</h1>
        <p>Manage unclaimed player identities, temporary ownership validation, and disputed claims outside of game-day check-in.</p>
      </div>
      ${sectionTabsHtml()}
      <div class="rp-admin-ownership-workspace" data-admin-ownership-workspace>
        <div class="rp-admin-claims-empty">LOADING ${SECTION_LABELS[activeSection]}…</div>
      </div>`;
  }

  function renderOwnership() {
    if (!ownershipOpen) return;
    if (!ensureOwnershipTab()) return;
    const body = adminBody();
    if (!body) return;
    setOwnershipTabActive(true);
    body.innerHTML = shellHtml();
    bindShell(body);
    loadActiveSection(body, ++renderSequence);
  }

  function bindShell(body) {
    body.querySelectorAll('[data-admin-ownership-section]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.adminOwnershipSection;
        if (!SECTION_LABELS[next] || next === activeSection) return;
        activeSection = next;
        renderOwnership();
      });
    });
  }

  function unclaimedCard(profile) {
    const games = Number(profile.gamesPlayed || 0);
    return `
      <article class="rp-admin-identity-card">
        <div class="rp-admin-identity-head">
          <div><strong>${esc(profile.playerName)}</strong><small>${esc(profile.publicPlayerId || '')}</small></div>
          <span class="rp-admin-identity-status unclaimed">UNCLAIMED</span>
        </div>
        <p>${games} verified game${games === 1 ? '' : 's'} · no account currently owns this player identity.</p>
      </article>`;
  }

  async function loadUnclaimed(body, sequence) {
    const workspace = body.querySelector('[data-admin-ownership-workspace]');
    if (!workspace) return;
    workspace.innerHTML = `
      <section class="rp-admin-ownership-card rp-admin-ownership-create">
        <small>NEW COURT PLAYER</small>
        <strong>CREATE UNCLAIMED PROFILE</strong>
        <p>Create the player's real identity without fake login credentials. They can claim it later from their own Real Play account.</p>
        <form class="rp-admin-unclaimed-form" data-admin-create-unclaimed>
          <input name="playerName" type="text" minlength="2" maxlength="60" autocomplete="off" placeholder="Player name" required>
          <button type="submit">CREATE</button>
        </form>
        <div class="rp-admin-ownership-status" data-admin-create-status></div>
      </section>

      <section class="rp-admin-ownership-card">
        <small>PLAYER IDENTITY DIRECTORY</small>
        <strong>UNCLAIMED PLAYERS</strong>
        <p>These profiles exist in Real Play but currently have no account owner.</p>
        <label class="rp-admin-ownership-search">SEARCH UNCLAIMED PLAYER
          <input type="search" data-admin-unclaimed-search placeholder="Player name or RP-00000" autocomplete="off">
        </label>
        <div class="rp-admin-identities" data-admin-unclaimed-list><div class="rp-admin-claims-empty">LOADING UNCLAIMED PLAYERS…</div></div>
      </section>`;

    const createForm = workspace.querySelector('[data-admin-create-unclaimed]');
    const createStatus = workspace.querySelector('[data-admin-create-status]');
    const search = workspace.querySelector('[data-admin-unclaimed-search]');
    const list = workspace.querySelector('[data-admin-unclaimed-list]');

    async function refreshList(query = '') {
      if (!list?.isConnected) return;
      list.innerHTML = '<div class="rp-admin-claims-empty">LOADING UNCLAIMED PLAYERS…</div>';
      try {
        const data = await api(`/api/real-play/profile-ownership/unclaimed?q=${encodeURIComponent(query)}`);
        if (sequence !== renderSequence || !ownershipOpen || activeSection !== 'unclaimed') return;
        const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
        list.innerHTML = profiles.length
          ? profiles.map(unclaimedCard).join('')
          : '<div class="rp-admin-claims-empty">NO UNCLAIMED PLAYER PROFILES FOUND.</div>';
      } catch (error) {
        list.innerHTML = `<div class="rp-admin-claims-empty error">${esc(error.message || 'Unable to load unclaimed profiles.')}</div>`;
      }
    }

    createForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = createForm.querySelector('[name="playerName"]');
      const button = createForm.querySelector('button');
      const playerName = String(input?.value || '').trim().replace(/\s+/g, ' ');
      if (playerName.length < 2) return;
      button.disabled = true;
      createStatus.className = 'rp-admin-ownership-status';
      createStatus.textContent = 'CREATING PLAYER PROFILE…';
      try {
        const data = await api('/api/real-play/admin/profile-ownership/unclaimed', {
          method: 'POST',
          body: { playerName },
        });
        input.value = '';
        createStatus.textContent = `${data?.profile?.playerName || playerName} created as ${data?.profile?.publicPlayerId || 'an unclaimed player'}.`;
        window.dispatchEvent(new CustomEvent('realplay:unclaimed-player-created', {
          detail: { profile: data?.profile || null },
        }));
        await refreshList(search?.value.trim() || '');
      } catch (error) {
        createStatus.classList.add('error');
        createStatus.textContent = error.message || 'Could not create the player profile.';
      } finally {
        button.disabled = false;
      }
    });

    search?.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => refreshList(search.value.trim()), 180);
    });

    await refreshList('');
  }

  function pendingCard(claim) {
    const games = Number(claim.gamesPlayed || 0);
    return `
      <article class="rp-admin-claim" data-admin-claim-id="${Number(claim.playerId)}">
        <div class="rp-admin-claim-head"><strong>${esc(claim.playerName)}</strong><span>${esc(claim.publicPlayerId)}</span></div>
        <small>${esc(claim.accountName || 'REAL PLAY ACCOUNT')}</small>
        <small>${esc(claim.accountEmail || '')}</small>
        <small>${games} verified game${games === 1 ? '' : 's'} · temporary owner pending validation</small>
        <div class="rp-admin-claim-actions">
          <button class="rp-admin-claim-approve" type="button" data-admin-claim-review="validate">VALIDATE OWNER</button>
          <button class="rp-admin-claim-reject" type="button" data-admin-claim-review="reject">REJECT</button>
        </div>
      </article>`;
  }

  async function loadPending(body, sequence) {
    const workspace = body.querySelector('[data-admin-ownership-workspace]');
    if (!workspace) return;
    workspace.innerHTML = `
      <section class="rp-admin-ownership-card">
        <small>OWNERSHIP VALIDATION</small>
        <strong>PENDING VALIDATION</strong>
        <p>These accounts temporarily own a player profile. Head Admin validation makes the ownership permanent.</p>
        <div class="rp-admin-claims" data-admin-pending-claims><div class="rp-admin-claims-empty">LOADING PENDING OWNERSHIP…</div></div>
      </section>`;
    const wrap = workspace.querySelector('[data-admin-pending-claims]');
    try {
      const data = await api('/api/real-play/admin/profile-ownership/claims');
      if (sequence !== renderSequence || !ownershipOpen || activeSection !== 'pending') return;
      const claims = Array.isArray(data?.claims) ? data.claims : [];
      wrap.innerHTML = claims.length
        ? claims.map(pendingCard).join('')
        : '<div class="rp-admin-claims-empty">NO PENDING OWNERSHIP CLAIMS.</div>';
    } catch (error) {
      wrap.innerHTML = `<div class="rp-admin-claims-empty error">${esc(error.message || 'Unable to load claims.')}</div>`;
    }

    workspace.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-admin-claim-review]');
      if (!button) return;
      const card = button.closest('[data-admin-claim-id]');
      const playerId = Number(card?.dataset.adminClaimId);
      const decision = button.dataset.adminClaimReview;
      if (!playerId) return;
      const question = decision === 'validate'
        ? 'Validate this account as the permanent owner of this player profile?'
        : 'Reject this temporary ownership and return the player profile to the unclaimed list?';
      if (!window.confirm(question)) return;
      button.disabled = true;
      try {
        await api('/api/real-play/admin/profile-ownership/review', {
          method: 'POST',
          body: { playerId, decision },
        });
        renderOwnership();
        if (decision === 'reject') window.dispatchEvent(new Event('realplay:unclaimed-player-created'));
      } catch (error) {
        window.alert(error.message || 'Ownership review failed.');
        button.disabled = false;
      }
    });
  }

  function disputeCard(dispute) {
    const games = Number(dispute.gamesPlayed || 0);
    const current = dispute.currentOwner || {};
    const challenger = dispute.challenger || {};
    return `
      <article class="rp-admin-dispute" data-admin-dispute-id="${Number(dispute.disputeId || dispute.id)}">
        <div class="rp-admin-claim-head"><strong>${esc(dispute.playerName)}</strong><span>${esc(dispute.publicPlayerId)}</span></div>
        <p class="rp-admin-dispute-summary">${games} verified game${games === 1 ? '' : 's'} · two accounts are asking to own the same player identity.</p>
        <div class="rp-admin-dispute-sides">
          <div class="rp-admin-dispute-side current">
            <small>CURRENT TEMPORARY OWNER</small>
            <strong>${esc(current.name || 'REAL PLAY ACCOUNT')}</strong>
            <span>${esc(current.email || '')}</span>
          </div>
          <div class="rp-admin-dispute-vs">VS</div>
          <div class="rp-admin-dispute-side challenger">
            <small>CHALLENGER</small>
            <strong>${esc(challenger.name || 'REAL PLAY ACCOUNT')}</strong>
            <span>${esc(challenger.email || '')}</span>
          </div>
        </div>
        ${dispute.reason ? `<div class="rp-admin-dispute-reason"><small>CHALLENGER NOTE</small><p>${esc(dispute.reason)}</p></div>` : ''}
        <div class="rp-admin-dispute-actions">
          <button type="button" data-admin-dispute-review="keep_current">KEEP CURRENT OWNER</button>
          <button type="button" class="challenger" data-admin-dispute-review="award_challenger">AWARD CHALLENGER</button>
        </div>
      </article>`;
  }

  async function loadDisputes(body, sequence) {
    const workspace = body.querySelector('[data-admin-ownership-workspace]');
    if (!workspace) return;
    workspace.innerHTML = `
      <section class="rp-admin-ownership-card">
        <small>OWNERSHIP CONFLICTS</small>
        <strong>DISPUTED CLAIMS</strong>
        <p>A second account says a temporarily owned profile belongs to them. The current temporary owner keeps control until Head Admin resolves the dispute.</p>
        <div class="rp-admin-disputes" data-admin-disputes><div class="rp-admin-claims-empty">LOADING DISPUTES…</div></div>
      </section>`;
    const wrap = workspace.querySelector('[data-admin-disputes]');
    try {
      const data = await api('/api/real-play/admin/profile-ownership/disputes');
      if (sequence !== renderSequence || !ownershipOpen || activeSection !== 'disputes') return;
      const disputes = Array.isArray(data?.disputes) ? data.disputes : [];
      wrap.innerHTML = disputes.length
        ? disputes.map(disputeCard).join('')
        : '<div class="rp-admin-claims-empty">NO OPEN OWNERSHIP DISPUTES.</div>';
    } catch (error) {
      wrap.innerHTML = `<div class="rp-admin-claims-empty error">${esc(error.message || 'Unable to load disputes.')}</div>`;
    }

    workspace.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-admin-dispute-review]');
      if (!button) return;
      const card = button.closest('[data-admin-dispute-id]');
      const disputeId = Number(card?.dataset.adminDisputeId);
      const decision = button.dataset.adminDisputeReview;
      if (!disputeId) return;
      const question = decision === 'keep_current'
        ? 'Resolve this dispute for the current temporary owner and make that ownership permanent?'
        : 'Transfer this player profile to the challenger and make the challenger the permanent owner?';
      if (!window.confirm(question)) return;
      button.disabled = true;
      try {
        await api('/api/real-play/admin/profile-ownership/disputes/review', {
          method: 'POST',
          body: { disputeId, decision },
        });
        renderOwnership();
        window.dispatchEvent(new Event('realplay:unclaimed-player-created'));
      } catch (error) {
        window.alert(error.message || 'Ownership dispute review failed.');
        button.disabled = false;
      }
    });
  }

  async function loadActiveSection(body, sequence) {
    if (activeSection === 'pending') return loadPending(body, sequence);
    if (activeSection === 'disputes') return loadDisputes(body, sequence);
    return loadUnclaimed(body, sequence);
  }

  function scan() {
    ensureOwnershipTab();
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', () => {
    ensureOwnershipTab();
    if (ownershipOpen) renderOwnership();
  });

  window.addEventListener('realplay:admin-control-refresh', () => {
    ensureOwnershipTab();
    if (ownershipOpen) renderOwnership();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
