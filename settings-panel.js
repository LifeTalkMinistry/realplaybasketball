(() => {
  if (window.__realPlaySettingsPanelInstalled) return;
  window.__realPlaySettingsPanelInstalled = true;

  const menu = document.querySelector('[data-rp-main-menu]');
  const settingsChoice = document.querySelector('[data-rp-main-action="settings"]');
  const menuList = document.querySelector('[data-rp-main-menu-list]');
  if (!menu || !settingsChoice) return;

  const panel = document.createElement('div');
  panel.className = 'rp-settings-overlay';
  panel.dataset.rpSettingsOverlay = 'true';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <section class="rp-settings-panel" role="dialog" aria-modal="true" aria-labelledby="rp-settings-title">
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
        <button type="button" class="rp-settings-row" data-rp-settings-action="account">
          <span><strong>PLAYER ACCOUNT</strong><small>Name, email and player number</small></span><b>→</b>
        </button>
        <button type="button" class="rp-settings-row" data-rp-settings-action="membership">
          <span><strong>MEMBERSHIP</strong><small>View status and membership access</small></span><b>→</b>
        </button>
        <button type="button" class="rp-settings-row" data-rp-settings-action="community">
          <span><strong>COMMUNITY STANDARD</strong><small>Christian community, sportsmanship and conduct</small></span><b>→</b>
        </button>
      </div>

      <button class="rp-settings-logout" type="button" data-rp-settings-action="logout">LOG OUT</button>
      <p class="rp-settings-version">REAL PLAY BASKETBALL · BETA SEASON</p>
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
  `;
  document.body.appendChild(panel);

  const mainPanel = panel.querySelector('.rp-settings-panel:not(.rp-settings-community)');
  const communityPanel = panel.querySelector('[data-rp-settings-community]');
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

  function showMainSettings() {
    syncIdentity();
    if (mainPanel) mainPanel.hidden = false;
    if (communityPanel) communityPanel.hidden = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-settings-open');
  }

  function closeSettings() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-settings-open');
    if (mainPanel) mainPanel.hidden = false;
    if (communityPanel) communityPanel.hidden = true;
    window.setTimeout(() => settingsChoice.focus(), 30);
  }

  function showCommunity() {
    if (mainPanel) mainPanel.hidden = true;
    if (communityPanel) communityPanel.hidden = false;
    communityPanel?.querySelector('[data-rp-community-back]')?.focus();
  }

  function openAccount() {
    closeSettings();
    window.setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 20);
  }

  function openMembership() {
    closeSettings();
    window.setTimeout(() => {
      const membershipCard = document.querySelector('[data-auth-membership-card]');
      if (membershipCard) {
        membershipCard.click();
        return;
      }

      const authOpen = document.querySelector('[data-auth-open]');
      authOpen?.click();
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
    window.localStorage.removeItem('real_play_access_token');
    window.location.reload();
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

  menuList?.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && settingsChoice.classList.contains('slot-active')) {
      interceptSettingsSelection(event);
    }
  }, true);

  panel.querySelector('[data-rp-settings-back]')?.addEventListener('click', closeSettings);
  panel.querySelector('[data-rp-community-back]')?.addEventListener('click', showMainSettings);

  panel.querySelectorAll('[data-rp-settings-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.rpSettingsAction;
      if (action === 'account') openAccount();
      else if (action === 'membership') openMembership();
      else if (action === 'community') showCommunity();
      else if (action === 'logout') logout();
    });
  });

  panel.addEventListener('click', (event) => {
    if (event.target === panel) closeSettings();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !panel.classList.contains('open')) return;
    if (communityPanel && !communityPanel.hidden) showMainSettings();
    else closeSettings();
  });
})();
