(() => {
  if (window.__realPlayOwnershipDisputesInstalled) return;
  window.__realPlayOwnershipDisputesInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let searchTimer = null;
  let searchSequence = 0;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Please log in first.');
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

  function setStatus(message, type = '') {
    const status = document.querySelector('[data-auth-status]');
    if (!status) return;
    status.textContent = message || '';
    status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function refs() {
    const complete = document.querySelector('[data-auth-view="complete"]');
    return {
      complete,
      choice: complete?.querySelector('[data-profile-choice]') || null,
      choiceClaim: complete?.querySelector('[data-profile-choice-claim]') || null,
      claimFlow: complete?.querySelector('[data-profile-claim-flow]') || null,
      createFlow: complete?.querySelector('[data-profile-create-flow]') || null,
      search: complete?.querySelector('[data-profile-claim-search]') || null,
      results: complete?.querySelector('[data-profile-claim-results]') || null,
    };
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-ownership-dispute-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpOwnershipDisputeStyles = '1';
    style.textContent = `
      .auth-claim-card.pending-owner{border-color:rgba(255,181,72,.25);background:rgba(37,23,8,.34)}
      .auth-claim-card.pending-owner>div>span{color:#ffc56f}
      .auth-claim-card button.dispute{border-color:rgba(255,181,72,.32);color:#ffd08a;background:rgba(128,75,10,.18)}
      .auth-claim-card button:disabled{opacity:.45;cursor:not-allowed}
      .auth-dispute-pending{padding:16px;border:1px solid rgba(255,181,72,.24);border-radius:15px;background:linear-gradient(145deg,rgba(41,26,8,.45),rgba(5,13,22,.88))}
      .auth-dispute-pending>small{display:block;color:#ffc56f;font:900 9px/1 system-ui,sans-serif;letter-spacing:.12em}
      .auth-dispute-pending>strong{display:block;margin-top:7px;color:#fff;font:italic 900 20px/1 var(--rp-display,Impact,sans-serif)}
      .auth-dispute-pending>span{display:block;margin-top:5px;color:#68def4;font:900 9px/1 system-ui,sans-serif;letter-spacing:.08em}
      .auth-dispute-pending>p{margin:10px 0 0;color:#8aa0b1;font:600 11px/1.5 system-ui,sans-serif}
    `;
    document.head.appendChild(style);
  }

  async function renderClaimOptions(query = '') {
    const { results, search } = refs();
    if (!results) return;
    const sequence = ++searchSequence;
    results.innerHTML = '<div class="auth-claim-empty">Searching Real Play player profiles…</div>';
    try {
      const data = await api(`/api/real-play/profile-ownership/search?q=${encodeURIComponent(query)}`);
      if (sequence !== searchSequence || !results.isConnected) return;
      const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
      if (!profiles.length) {
        results.innerHTML = '<div class="auth-claim-empty">No matching player profile found. Try another name or Player ID, or go back and create a new profile.</div>';
        return;
      }

      results.innerHTML = profiles.map((profile) => {
        const games = Number(profile.gamesPlayed || 0);
        const pending = profile.ownershipStatus === 'pending';
        const action = profile.claimAction || (pending ? 'dispute' : 'claim');
        const disabled = action === 'dispute_pending';
        return `
          <div class="auth-claim-card${pending ? ' pending-owner' : ''}" data-rp-ownership-option="${Number(profile.playerId)}" data-rp-ownership-action="${esc(action)}">
            <div>
              <strong>${esc(profile.playerName || 'REAL PLAY PLAYER')}</strong>
              <span>${esc(profile.publicPlayerId || `RP-${profile.playerId}`)}</span>
              <small>${games} VERIFIED GAME${games === 1 ? '' : 'S'} · ${pending ? (disabled ? 'OWNERSHIP DISPUTE UNDER REVIEW' : 'TEMPORARILY OWNED · CAN BE DISPUTED') : 'UNCLAIMED'}</small>
            </div>
            <button type="button" class="${pending ? 'dispute' : ''}" ${disabled ? 'disabled' : ''}>${pending ? (disabled ? 'UNDER REVIEW' : 'DISPUTE') : 'CLAIM'}</button>
          </div>`;
      }).join('');

      results.querySelectorAll('[data-rp-ownership-option] button:not(:disabled)').forEach((button) => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-rp-ownership-option]');
          const playerId = Number(card?.dataset.rpOwnershipOption);
          const action = card?.dataset.rpOwnershipAction;
          const profile = profiles.find((item) => Number(item.playerId) === playerId);
          if (!profile) return;

          if (action === 'claim') {
            if (!window.confirm(`Claim ${profile.playerName} (${profile.publicPlayerId}) as your Real Play player profile?\n\nOwnership will remain temporary until Head Admin validates it.`)) return;
            button.disabled = true;
            button.textContent = 'CLAIMING…';
            try {
              await api('/api/real-play/profile-ownership/claim', {
                method: 'POST',
                body: { playerId },
              });
              setStatus('Profile claimed. Ownership is temporary until Head Admin validates it.', 'success');
              window.setTimeout(() => window.location.reload(), 250);
            } catch (error) {
              setStatus(error.message || 'Unable to claim this player profile.', 'error');
              await renderClaimOptions(search?.value || '');
            }
            return;
          }

          if (action === 'dispute') {
            const confirmed = window.confirm(
              `${profile.playerName} (${profile.publicPlayerId}) is temporarily attached to another account.\n\nSubmit an ownership dispute for Head Admin review? The current temporary owner will keep the profile until the dispute is resolved.`
            );
            if (!confirmed) return;
            button.disabled = true;
            button.textContent = 'SUBMITTING…';
            try {
              await api('/api/real-play/profile-ownership/dispute', {
                method: 'POST',
                body: { playerId },
              });
              setStatus('Ownership dispute submitted. Head Admin will decide who permanently owns this player profile.', 'success');
              await syncDisputeState(true);
            } catch (error) {
              setStatus(error.message || 'Unable to submit the ownership dispute.', 'error');
              await renderClaimOptions(search?.value || '');
            }
          }
        });
      });
    } catch (error) {
      results.innerHTML = `<div class="auth-claim-empty">${esc(error.message || 'Could not load player profiles.')}</div>`;
    }
  }

  async function syncDisputeState(force = false) {
    if (!token()) return;
    const { complete, choice, claimFlow, createFlow } = refs();
    if (!complete) return;
    try {
      const data = await api('/api/real-play/profile-ownership/me');
      let pendingCard = complete.querySelector('[data-profile-dispute-pending]');
      const dispute = data?.dispute || null;
      if (!dispute) {
        pendingCard?.remove();
        return;
      }

      if (!pendingCard) {
        pendingCard = document.createElement('div');
        pendingCard.dataset.profileDisputePending = '1';
        pendingCard.className = 'auth-dispute-pending';
        complete.appendChild(pendingCard);
      }
      pendingCard.innerHTML = `
        <small>OWNERSHIP DISPUTE · HEAD ADMIN REVIEW</small>
        <strong>${esc(dispute.playerName || 'PLAYER PROFILE')}</strong>
        <span>${esc(dispute.publicPlayerId || '')}</span>
        <p>You challenged a profile that is temporarily owned by another account. The current temporary owner keeps control while Head Admin reviews both accounts. You cannot create or claim another player profile while this dispute is open.</p>`;
      if (choice) choice.hidden = true;
      if (claimFlow) claimFlow.hidden = true;
      if (createFlow) createFlow.hidden = true;
      pendingCard.hidden = false;
      if (force) pendingCard.scrollIntoView({ block: 'nearest' });
    } catch (_error) {
      // Core auth remains usable if the dispute layer is temporarily unavailable.
    }
  }

  function install() {
    ensureStyles();
    const { complete, choiceClaim, claimFlow, search, results } = refs();
    if (!complete || !choiceClaim || !claimFlow || !search || !results) return false;
    if (search.dataset.rpDisputeSearchReady === '1') return true;
    search.dataset.rpDisputeSearchReady = '1';

    const note = claimFlow.querySelector('.auth-choice-note');
    if (note) {
      note.textContent = 'Unclaimed profiles can be claimed immediately. If your player profile is temporarily owned by another account, you can submit an ownership dispute for Head Admin review.';
    }

    search.addEventListener('input', (event) => {
      event.stopImmediatePropagation();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderClaimOptions(search.value), 200);
    }, true);

    choiceClaim.addEventListener('click', () => {
      window.setTimeout(() => renderClaimOptions(''), 0);
    });

    const observer = new MutationObserver(() => {
      if (!complete.hidden) syncDisputeState();
    });
    observer.observe(complete, { attributes: true, attributeFilter: ['hidden'] });

    syncDisputeState();
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
