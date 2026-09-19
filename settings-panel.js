(() => {
  if (window.__realPlaySettingsPanelInstalled) return;
  window.__realPlaySettingsPanelInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  const menu = document.querySelector('[data-rp-main-menu]');
  const settingsChoice = document.querySelector('[data-rp-main-action="settings"]');
  const menuList = document.querySelector('[data-rp-main-menu-list]');
  if (!menu || !settingsChoice) return;

  const relocationStyle = document.createElement('style');
  relocationStyle.dataset.rpProfileSettingsRelocation = 'true';
  relocationStyle.textContent = `
    .rp-profile-actions [data-rp-profile-manage-number]{display:none!important}
    .rp-profile-actions{grid-template-columns:minmax(0,1fr)!important}
    .rp-profile-art-edit-button{display:none!important}
  `;
  document.head.appendChild(relocationStyle);

  const settingsSummary = settingsChoice.querySelector('span');
  if (settingsSummary) settingsSummary.textContent = 'IDENTITY · MEMBERSHIP · COMMUNITY · ACCOUNT';

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
        <div class="rp-settings-identity-copy">
          <strong data-rp-settings-name>REAL PLAY PLAYER</strong>
          <span data-rp-settings-email></span>
        </div>
        <button class="rp-settings-player-id" type="button" data-rp-settings-player-id aria-label="Copy Real Play player ID" disabled>
          <small>PLAYER ID</small>
          <strong data-rp-settings-player-id-value>—</strong>
          <span data-rp-settings-player-id-copy>COPY</span>
        </button>
      </div>

      <div class="rp-settings-list">
        <button type="button" class="rp-settings-row" data-rp-settings-action="identity">
          <span><strong>IDENTITY & NUMBER MANAGEMENT</strong><small>Manage your Real Play player name and number</small></span><b>→</b>
        </button>
        <button type="button" class="rp-settings-row" data-rp-settings-action="profile-art" data-rp-settings-profile-art hidden>
          <span><strong>PROFILE ART STUDIO</strong><small>Upload or adjust premium player artwork</small></span><b>→</b>
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

  const mainPanel = panel.querySelector('[data-rp-settings-main]');
  const communityPanel = panel.querySelector('[data-rp-settings-community]');
  const nameNode = panel.querySelector('[data-rp-settings-name]');
  const emailNode = panel.querySelector('[data-rp-settings-email]');
  const playerIdButton = panel.querySelector('[data-rp-settings-player-id]');
  const playerIdNode = panel.querySelector('[data-rp-settings-player-id-value]');
  const playerIdCopyNode = panel.querySelector('[data-rp-settings-player-id-copy]');
  const profileArtRow = panel.querySelector('[data-rp-settings-profile-art]');
  let currentPlayerId = null;
  let identityRequest = 0;
  let copyResetTimer = 0;

  function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function playerIdFromProfileData(data) {
    const candidates = [
      data?.playerId,
      data?.userId,
      data?.profile?.playerId,
      data?.profile?.player_id,
      data?.profile?.userId,
      data?.profile?.user_id,
      data?.profile?.id,
    ];
    for (const value of candidates) {
      const id = positiveInteger(value);
      if (id !== null) return id;
    }
    return null;
  }

  function setPlayerId(value) {
    const id = positiveInteger(value);
    currentPlayerId = id;
    if (playerIdNode) playerIdNode.textContent = id === null ? '—' : String(id);
    if (playerIdButton) {
      playerIdButton.disabled = id === null;
      playerIdButton.setAttribute('aria-label', id === null
        ? 'Real Play player ID unavailable'
        : `Copy Real Play player ID ${id}`);
    }
    if (playerIdCopyNode) playerIdCopyNode.textContent = id === null ? 'ID' : 'COPY';
  }

  async function refreshPlayerId() {
    const requestId = ++identityRequest;
    const existingId = positiveInteger(
      document.querySelector('[data-rp-profile-player-id]')?.dataset?.rpProfilePlayerId
    );
    if (existingId !== null) setPlayerId(existingId);
    else setPlayerId(null);

    const accessToken = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!response.ok || requestId !== identityRequest) return;
      const data = await response.json().catch(() => ({}));
      if (requestId !== identityRequest) return;
      setPlayerId(playerIdFromProfileData(data));
    } catch (_error) {
      // Settings stays usable even when the identity request is temporarily unavailable.
    }
  }

  function syncIdentity() {
    const lobby = document.querySelector('[data-rp-lobby]');
    const playerName = String(
      lobby?.querySelector('[data-rp-name]')?.textContent ||
      document.querySelector('[data-auth-account-name]')?.textContent ||
      'REAL PLAY PLAYER'
    ).trim();
    const email = String(document.querySelector('[data-auth-account-email]')?.textContent || '').trim();

    if (nameNode) nameNode.textContent = playerName || 'REAL PLAY PLAYER';
    if (emailNode) {
      emailNode.textContent = email;
      emailNode.hidden = !email;
    }
    refreshPlayerId();
  }

  function syncProfileArtAccess() {
    if (!profileArtRow) return;
    profileArtRow.hidden = !document.querySelector('[data-rp-profile-art-edit]');
  }

  async function copyPlayerId() {
    if (currentPlayerId === null) return;
    const text = String(currentPlayerId);
    let copied = false;

    try {
      await navigator.clipboard?.writeText?.(text);
      copied = true;
    } catch (_error) {}

    if (!copied) {
      try {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        copied = document.execCommand('copy');
        input.remove();
      } catch (_error) {}
    }

    if (!playerIdCopyNode) return;
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    playerIdCopyNode.textContent = copied ? 'COPIED' : 'ID';
    copyResetTimer = window.setTimeout(() => {
      if (playerIdCopyNode) playerIdCopyNode.textContent = currentPlayerId === null ? 'ID' : 'COPY';
    }, 1400);
  }

  function showMainSettings() {
    syncIdentity();
    syncProfileArtAccess();
    if (mainPanel) mainPanel.hidden = false;
    if (communityPanel) communityPanel.hidden = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-settings-open');

    window.setTimeout(syncProfileArtAccess, 120);
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

    if (restoreFocus) {
      window.setTimeout(() => settingsChoice.focus({ preventScroll: true }), 30);
    }
  }

  function showCommunity() {
    if (mainPanel) mainPanel.hidden = true;
    if (communityPanel) communityPanel.hidden = false;
    communityPanel?.querySelector('[data-rp-community-back]')?.focus();
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

  function openIdentityManagement() {
    closeSettings({ restoreFocus: false });
    window.setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 30);
  }

  function openProfileArtStudio() {
    closeSettings({ restoreFocus: false });
    window.RealPlayProfile?.open?.();

    let attempts = 0;
    const tryOpen = () => {
      const profile = document.querySelector('[data-rp-profile].open');
      const studio = window.RealPlayPremiumProfileArt;
      if (profile && typeof studio?.editOpenProfile === 'function') {
        studio.editOpenProfile();
        if (profile.querySelector('[data-rp-profile-art-editor]')) return;
      }
      attempts += 1;
      if (attempts < 40) window.setTimeout(tryOpen, 75);
    };
    window.setTimeout(tryOpen, 90);
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
    if ((event.key === 'Enter' || event.key === ' ') && settingsChoice.classList.contains('slot-active')) {
      interceptSettingsSelection(event);
    }
  }, true);

  playerIdButton?.addEventListener('click', copyPlayerId);
  panel.querySelector('[data-rp-settings-back]')?.addEventListener('click', closeSettings);
  panel.querySelector('[data-rp-community-back]')?.addEventListener('click', showMainSettings);

  panel.querySelectorAll('[data-rp-settings-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.rpSettingsAction;
      if (action === 'identity') openIdentityManagement();
      else if (action === 'profile-art') openProfileArtStudio();
      else if (action === 'membership') openMembership();
      else if (action === 'community') showCommunity();
      else if (action === 'logout') logout();
    });
  });

  panel.addEventListener('click', (event) => {
    if (event.target === panel) closeSettings();
  });

  const profileArtObserver = new MutationObserver(syncProfileArtAccess);
  profileArtObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !panel.classList.contains('open')) return;
    if (communityPanel && !communityPanel.hidden) showMainSettings();
    else closeSettings();
  });
})();