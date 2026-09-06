(() => {
  if (window.__realPlayAdminPlayerOwnershipInstalled) return;
  window.__realPlayAdminPlayerOwnershipInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

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

  async function loadClaims(container) {
    const claimsWrap = container.querySelector('[data-admin-pending-claims]');
    if (!claimsWrap) return;
    claimsWrap.innerHTML = '<div class="rp-admin-claims-empty">LOADING PENDING OWNERSHIP…</div>';
    try {
      const data = await api('/api/real-play/admin/profile-ownership/claims');
      const claims = Array.isArray(data?.claims) ? data.claims : [];
      if (!claims.length) {
        claimsWrap.innerHTML = '<div class="rp-admin-claims-empty">NO PENDING OWNERSHIP CLAIMS.</div>';
        return;
      }
      claimsWrap.innerHTML = claims.map((claim) => `
        <div class="rp-admin-claim" data-admin-claim-id="${Number(claim.playerId)}">
          <div class="rp-admin-claim-head"><strong>${esc(claim.playerName)}</strong><span>${esc(claim.publicPlayerId)}</span></div>
          <small>${esc(claim.accountEmail || claim.accountName || 'REAL PLAY ACCOUNT')}</small>
          <small>${Number(claim.gamesPlayed || 0)} verified game${Number(claim.gamesPlayed || 0) === 1 ? '' : 's'} · temporary owner pending validation</small>
          <div class="rp-admin-claim-actions">
            <button class="rp-admin-claim-approve" type="button" data-admin-claim-review="validate">VALIDATE</button>
            <button class="rp-admin-claim-reject" type="button" data-admin-claim-review="reject">REJECT</button>
          </div>
        </div>`).join('');
    } catch (error) {
      claimsWrap.innerHTML = `<div class="rp-admin-claims-empty">${esc(error.message || 'Unable to load claims.')}</div>`;
    }
  }

  function mount(form) {
    if (!form || form.dataset.rpOwnershipMounted === '1') return;
    form.dataset.rpOwnershipMounted = '1';

    const panel = document.createElement('section');
    panel.className = 'rp-admin-ownership';
    panel.innerHTML = `
      <div class="rp-admin-ownership-card">
        <small>PLAYER DOESN'T HAVE AN ACCOUNT YET?</small>
        <strong>CREATE UNCLAIMED PROFILE</strong>
        <p>Create the real player identity now without making fake login credentials. The player can claim this profile later from their own account.</p>
        <form class="rp-admin-unclaimed-form" data-admin-create-unclaimed>
          <input name="playerName" type="text" minlength="2" maxlength="60" autocomplete="off" placeholder="Player name" required>
          <button type="submit">CREATE</button>
        </form>
        <div class="rp-admin-ownership-status" data-admin-create-status></div>
      </div>

      <div class="rp-admin-ownership-card">
        <small>OWNERSHIP VALIDATION</small>
        <strong>PENDING CLAIMS</strong>
        <p>Claims and newly created player profiles are temporary until Head Admin validates the account-to-player ownership.</p>
        <div class="rp-admin-claims" data-admin-pending-claims></div>
      </div>`;

    form.insertAdjacentElement('afterend', panel);
    loadClaims(panel);

    const createForm = panel.querySelector('[data-admin-create-unclaimed]');
    const createStatus = panel.querySelector('[data-admin-create-status]');
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = createForm.querySelector('[name="playerName"]');
      const button = createForm.querySelector('button');
      const playerName = String(input.value || '').trim().replace(/\s+/g, ' ');
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
      } catch (error) {
        createStatus.classList.add('error');
        createStatus.textContent = error.message || 'Could not create the player profile.';
      } finally {
        button.disabled = false;
      }
    });

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-admin-claim-review]');
      if (!button) return;
      const claim = button.closest('[data-admin-claim-id]');
      const playerId = Number(claim?.dataset.adminClaimId);
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
        await loadClaims(panel);
        if (decision === 'reject') {
          window.dispatchEvent(new Event('realplay:unclaimed-player-created'));
        }
      } catch (error) {
        window.alert(error.message || 'Ownership review failed.');
        button.disabled = false;
      }
    });
  }

  function scan() {
    document.querySelectorAll('[data-admin-manual-player-form]').forEach(mount);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-control-refresh', scan);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();