(() => {
  if (window.__realPlaySettingsPanelInstalled) return;
  window.__realPlaySettingsPanelInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const ADMIN_CACHE_KEY = 'real_play_admin_ui_bypass_v1';

  const menu = document.querySelector('[data-rp-main-menu]');
  const settingsChoice = document.querySelector('[data-rp-main-action="settings"]');
  const menuList = document.querySelector('[data-rp-main-menu-list]');
  if (!menu || !settingsChoice) return;

  const settingsSummary = settingsChoice.querySelector('span');
  if (settingsSummary) settingsSummary.textContent = 'MEMBERSHIP · COMMUNITY · ACCOUNT';

  const panel = document.createElement('div');
  panel.className = 'rp-settings-overlay';
  panel.dataset.rpSettingsOverlay = 'true';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <section class="rp-settings-panel" data-rp-settings-main role="dialog" aria-modal="true" aria-labelledby="rp-settings-title">
      <header class="rp-settings-head">
        <button class="rp-settings-back" type="button" data-rp-settings-back aria-label="Back to Real Play menu">←</button>
        <div>
          <small>ACCOUNT</small>
          <h2 id="rp-settings-title">SETTINGS</h2>
        </div>
      </header>

      <div class="rp-settings-identity">
        <strong data-rp-settings-name>REAL PLAY PLAYER</strong>
        <span data-rp-settings-email></span>
      </div>

      <div class="rp-settings-list">
        <button type="button" class="rp-settings-row" data-rp-settings-action="membership">
          <span><strong>MEMBERSHIP</strong><small>View status and membership access</small></span><b>→</b>
        </button>
        <button type="button" class="rp-settings-row" data-rp-settings-action="community">
          <span><strong>COMMUNITY STANDARD</strong><small>Christian community, sportsmanship and conduct</small></span><b>→</b>
        </button>
      </div>

      <button class="rp-settings-logout" type="button" data-rp-settings-action="logout">LOG OUT</button>
      <p class="rp-settings-version">REAL PLAY BASKETBALL · BETA SEASON</p>

      <div class="rp-settings-danger-zone">
        <small>DANGER ZONE</small>
        <p>Permanently remove this Real Play account and release its email.</p>
        <button class="rp-settings-delete-entry" type="button" data-rp-settings-action="delete_account">DELETE ACCOUNT</button>
      </div>
    </section>

    <section class="rp-settings-panel rp-settings-community" data-rp-settings-community hidden role="dialog" aria-modal="true" aria-labelledby="rp-community-title">
      <header class="rp-settings-head">
        <button class="rp-settings-back" type="button" data-rp-community-back aria-label="Back to settings">←</button>
        <div>
          <small>REAL PLAY COMMUNITY</small>
          <h2 id="rp-community-title">OUR STANDARD</h2>
        </div>
      </header>
      <div class="rp-settings-community-copy">
        <p><strong>OPEN TO EVERYONE. ROOTED IN CHRIST.</strong></p>
        <p>You do not need to be a Christian to play, but Real Play is openly Christian. Expect opportunities to hear the Gospel of Jesus Christ, prayer and Biblical encouragement.</p>
        <div class="rp-settings-rule"><strong>COMPETE HARD. RESPECT PEOPLE.</strong><span>Direct trash talk, threatening behavior and intentional humiliation are not allowed.</span></div>
        <div class="rp-settings-rule"><strong>GESTURES & CELEBRATIONS ARE OKAY.</strong><span>Competitive emotion is welcome as long as it is not threatening or degrading.</span></div>
        <div class="rp-settings-rule"><strong>CUSSING GETS CALLED OUT.</strong><span>Respect the correction and move forward. Repeated disrespect can lead to removal, suspension or a community ban.</span></div>
      </div>
    </section>

    <section class="rp-settings-panel rp-settings-delete" data-rp-settings-delete hidden role="dialog" aria-modal="true" aria-labelledby="rp-delete-account-title">
      <header class="rp-settings-head rp-settings-head-danger">
        <button class="rp-settings-back" type="button" data-rp-delete-back aria-label="Back to settings">←</button>
        <div>
          <small>DANGER ZONE</small>
          <h2 id="rp-delete-account-title">DELETE ACCOUNT</h2>
        </div>
      </header>

      <div class="rp-settings-delete-copy">
        <p class="rp-settings-delete-kicker">PERMANENT ACCOUNT DELETION</p>
        <p>This permanently deletes your Real Play login and releases the email so it can be used again.</p>
        <div class="rp-settings-delete-rule">
          <strong>YOUR COURT HISTORY IS PROTECTED.</strong>
          <span>If this login was attached to a pre-existing Admin-created player, that player identity and its existing court history are released back to an unclaimed state instead of being erased.</span>
        </div>
        <div class="rp-settings-delete-rule warning">
          <strong>THIS CANNOT BE UNDONE.</strong>
          <span>Type <b>DELETE</b> exactly below to confirm permanent account deletion.</span>
        </div>

        <form class="rp-settings-delete-form" data-rp-delete-form>
          <label for="rp-delete-account-confirm">TYPE DELETE TO CONFIRM</label>
          <input id="rp-delete-account-confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE" data-rp-delete-confirm />
          <p class="rp-settings-delete-status" data-rp-delete-status aria-live="polite"></p>
          <button class="rp-settings-delete-submit" type="submit" data-rp-delete-submit disabled>DELETE MY ACCOUNT</button>
        </form>
      </div>
    </section>
  `;
  document.body.appendChild(panel);

  const mainPanel = panel.querySelector('[data-rp-settings-main]');
  const communityPanel = panel.querySelector('[data-rp-settings-community]');
  const deletePanel = panel.querySelector('[data-rp-settings-delete]');
  const deleteForm = panel.querySelector('[data-rp-delete-form]');
  const deleteInput = panel.querySelector('[data-rp-delete-confirm]');
  const deleteSubmit = panel.querySelector('[data-rp-delete-submit]');
  const deleteStatus = panel.querySelector('[data-rp-delete-status]');
  const nameNode = panel.querySelector('[data-rp-settings-name]');
  const emailNode = panel.querySelector('[data-rp-settings-email]');

  function syncIdentity() {
    const lobby = document.querySelector('[data-rp-lobby]');
    const playerName = String(lobby?.querySelector('[data-rp-name]')?.textContent || document.querySelector('[data-auth-account-name]')?.textContent || 'REAL PLAY PLAYER').trim();
    const email = String(document.querySelector('[data-auth-account-email]')?.textContent || '').trim();
    if (nameNode) nameNode.textContent = playerName || 'REAL PLAY PLAYER';
    if (emailNode) {
      emailNode.textContent = email;
      emailNode.hidden = !email;
    }
  }

  function resetDeleteConfirmation() {
    if (deleteInput) deleteInput.value = '';
    if (deleteSubmit) {
      deleteSubmit.disabled = true;
      deleteSubmit.dataset.busy = 'false';
      deleteSubmit.textContent = 'DELETE MY ACCOUNT';
    }
    if (deleteStatus) {
      deleteStatus.textContent = '';
      deleteStatus.classList.remove('error', 'success');
    }
  }

  function showMainSettings() {
    syncIdentity();
    resetDeleteConfirmation();
    if (mainPanel) mainPanel.hidden = false;
    if (communityPanel) communityPanel.hidden = true;
    if (deletePanel) deletePanel.hidden = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-settings-open');

    // Admin access is session-dependent. The login token can change inside this
    // same browser tab, and the native "storage" event does not fire back into
    // the tab that changed localStorage. Tell the admin bootstrap to re-check
    // the current authenticated session whenever Settings is actually opened.
    window.dispatchEvent(new CustomEvent('realplay:settings-open'));
  }

  function closeSettings({ restoreFocus = true } = {}) {
    const active = document.activeElement;

    if (active && panel.contains(active) && typeof active.blur === 'function') active.blur();
    if (document.body && typeof document.body.focus === 'function') {
      document.body.tabIndex = -1;
      document.body.focus({ preventScroll: true });
    }

    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-settings-open');
    if (mainPanel) mainPanel.hidden = false;
    if (communityPanel) communityPanel.hidden = true;
    if (deletePanel) deletePanel.hidden = true;
    resetDeleteConfirmation();

    if (restoreFocus) {
      window.setTimeout(() => settingsChoice.focus({ preventScroll: true }), 30);
    }
  }

  function showCommunity() {
    if (mainPanel) mainPanel.hidden = true;
    if (communityPanel) communityPanel.hidden = false;
    if (deletePanel) deletePanel.hidden = true;
    communityPanel?.querySelector('[data-rp-community-back]')?.focus();
  }

  function showDeleteAccount() {
    resetDeleteConfirmation();
    if (mainPanel) mainPanel.hidden = true;
    if (communityPanel) communityPanel.hidden = true;
    if (deletePanel) deletePanel.hidden = false;
    window.setTimeout(() => deleteInput?.focus(), 30);
  }

  function openMembership() {
    closeSettings();
    window.setTimeout(() => {
      const membershipCard = document.querySelector('[data-auth-membership-card]');
      if (membershipCard) {
        membershipCard.click();
        return;
      }
      document.querySelector('[data-auth-open]')?.click();
      window.setTimeout(() => document.querySelector('[data-auth-membership-card]')?.click(), 350);
    }, 20);
  }

  function logout() {
    closeSettings();
    const existingLogout = document.querySelector('[data-auth-logout]');
    if (existingLogout) {
      existingLogout.click();
      return;
    }
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }

  async function deleteAccount() {
    if (!deleteInput || !deleteSubmit || deleteSubmit.dataset.busy === 'true') return;
    if (deleteInput.value !== 'DELETE') return;

    const accessToken = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!accessToken) {
      if (deleteStatus) {
        deleteStatus.textContent = 'Your session expired. Log in again before deleting the account.';
        deleteStatus.classList.add('error');
      }
      return;
    }

    deleteSubmit.dataset.busy = 'true';
    deleteSubmit.disabled = true;
    deleteSubmit.textContent = 'DELETING ACCOUNT…';
    if (deleteStatus) {
      deleteStatus.textContent = 'Deleting your Real Play account…';
      deleteStatus.classList.remove('error', 'success');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/account/delete`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ confirmation: 'DELETE' }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.message || 'Real Play could not delete this account.');
        error.code = data?.code || '';
        throw error;
      }

      if (deleteStatus) {
        deleteStatus.textContent = data?.message || 'Account deleted. Returning you to Visitor mode…';
        deleteStatus.classList.add('success');
      }
      deleteSubmit.textContent = 'ACCOUNT DELETED';

      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(ADMIN_CACHE_KEY);
      window.localStorage.setItem(VISITOR_KEY, '1');
      try {
        window.dispatchEvent(new CustomEvent('realplay:visitorchange'));
        window.dispatchEvent(new CustomEvent('realplay:session-expired'));
      } catch (_error) {}

      window.setTimeout(() => {
        window.location.replace(`${window.location.origin}${window.location.pathname}`);
      }, 700);
    } catch (error) {
      if (deleteStatus) {
        deleteStatus.textContent = error?.message || 'Real Play could not delete this account.';
        deleteStatus.classList.remove('success');
        deleteStatus.classList.add('error');
      }
      deleteSubmit.dataset.busy = 'false';
      deleteSubmit.disabled = deleteInput.value !== 'DELETE';
      deleteSubmit.textContent = 'DELETE MY ACCOUNT';
    }
  }

  function interceptSettingsSelection(event) {
    if (!settingsChoice.classList.contains('slot-active')) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    showMainSettings();
    return true;
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-rp-main-action="settings"]');
    if (!target) return;
    interceptSettingsSelection(event);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('.rp-profile-settings-placeholder, [data-rp-profile-settings]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.RealPlayProfile?.close?.();
    window.setTimeout(showMainSettings, 30);
  }, true);

  menuList?.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && settingsChoice.classList.contains('slot-active')) interceptSettingsSelection(event);
  }, true);

  panel.querySelector('[data-rp-settings-back]')?.addEventListener('click', closeSettings);
  panel.querySelector('[data-rp-community-back]')?.addEventListener('click', showMainSettings);
  panel.querySelector('[data-rp-delete-back]')?.addEventListener('click', showMainSettings);

  panel.querySelectorAll('[data-rp-settings-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.rpSettingsAction;
      if (action === 'membership') openMembership();
      else if (action === 'community') showCommunity();
      else if (action === 'logout') logout();
      else if (action === 'delete_account') showDeleteAccount();
    });
  });

  deleteInput?.addEventListener('input', () => {
    if (!deleteSubmit || deleteSubmit.dataset.busy === 'true') return;
    deleteSubmit.disabled = deleteInput.value !== 'DELETE';
    if (deleteStatus) {
      deleteStatus.textContent = '';
      deleteStatus.classList.remove('error', 'success');
    }
  });

  deleteForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    deleteAccount();
  });

  panel.addEventListener('click', (event) => {
    if (event.target === panel) closeSettings();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !panel.classList.contains('open')) return;
    if (deletePanel && !deletePanel.hidden) showMainSettings();
    else if (communityPanel && !communityPanel.hidden) showMainSettings();
    else closeSettings();
  });
})();