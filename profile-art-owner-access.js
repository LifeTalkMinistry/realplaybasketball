(() => {
  if (window.__realPlayProfileArtOwnerAccessInstalled) return;
  window.__realPlayProfileArtOwnerAccessInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let access = {
    loaded: false,
    admin: false,
    userId: null,
    canEditProfileArt: false,
  };
  let accessPromise = null;

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  function firstPositiveInteger(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function publicPanelTargetId(panel) {
    if (!panel) return null;
    const source = panel.__realPlayPublicPlayer || {};
    const profile = source?.profile || source?.player || source || {};
    return firstPositiveInteger(
      panel.dataset?.rpPublicPlayerId,
      source?.accountUserId,
      source?.account_user_id,
      source?.userId,
      source?.user_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      profile?.accountUserId,
      profile?.account_user_id,
      profile?.userId,
      profile?.user_id,
      profile?.id,
      source?.id
    );
  }

  function panelTargetId(panel) {
    if (!panel) return null;

    // The regular ME profile is always the authenticated account's own profile.
    // Profile art is keyed by real_play_accounts.id, so use the authenticated
    // account id directly instead of deriving it from basketball/career ids.
    if (!panel.classList.contains('rp-public-player-profile')) {
      return access.loaded ? access.userId : null;
    }

    return publicPanelTargetId(panel);
  }

  function canEditPanel(panel) {
    if (!access.loaded || !access.canEditProfileArt) return false;
    if (access.admin) return true;
    const targetId = panelTargetId(panel);
    return Boolean(targetId && access.userId && targetId === access.userId);
  }

  function stabilizeOwnProfile(panel) {
    if (!panel || panel.classList.contains('rp-public-player-profile')) return false;
    if (!access.loaded || !access.userId || !access.canEditProfileArt) return false;

    // This is the only identity normalization used by Profile Art Studio.
    // Do it before the premium-art renderer/editor sees the profile so its
    // WeakMap state is created once against the account id and never retargeted
    // after the controller has opened.
    panel.dataset.rpProfilePlayerId = String(access.userId);
    return true;
  }

  function decorateEditor(panel) {
    const editor = panel?.querySelector?.('[data-rp-profile-art-editor]');
    if (!editor || access.admin || !canEditPanel(panel)) return;
    const label = editor.querySelector('.rp-profile-art-editor-head small');
    if (label) label.textContent = 'PLAYER · PREMIUM PROFILE';
  }

  function applyPanel(panel) {
    if (!panel) return false;
    if (!panel.classList.contains('rp-public-player-profile')) stabilizeOwnProfile(panel);
    const editable = canEditPanel(panel);
    panel.classList.toggle('rp-profile-art-owner-readonly', !editable);
    panel.classList.toggle('rp-profile-art-owner-editable', editable && !access.admin);
    decorateEditor(panel);
    return editable;
  }

  function applyPanelAccess() {
    document.querySelectorAll('.rp-profile.open').forEach(applyPanel);
  }

  async function loadAccess(force = false) {
    if (!force && access.loaded) return access;
    if (accessPromise) return accessPromise;

    const accessToken = token();
    if (!accessToken) {
      access = { loaded: true, admin: false, userId: null, canEditProfileArt: false };
      applyPanelAccess();
      return access;
    }

    accessPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art/access`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          access = { loaded: true, admin: false, userId: null, canEditProfileArt: false };
        } else {
          access = {
            loaded: true,
            admin: data?.admin === true,
            userId: firstPositiveInteger(data?.userId, data?.adminUserId),
            canEditProfileArt: data?.canEditProfileArt === true,
          };
        }
      } catch (_error) {
        access = { loaded: true, admin: false, userId: null, canEditProfileArt: false };
      } finally {
        accessPromise = null;
      }

      applyPanelAccess();
      try {
        window.dispatchEvent(new CustomEvent('realplay:profile-art-access-ready', {
          detail: { ...access },
        }));
      } catch (_error) {}
      return access;
    })();

    return accessPromise;
  }

  function handleProfileLoaded(event) {
    const panel = event?.target instanceof HTMLElement && event.target.classList.contains('rp-profile')
      ? event.target
      : document.querySelector('.rp-profile.open');

    if (access.loaded) {
      applyPanel(panel);
      return;
    }

    loadAccess(false).then(() => applyPanel(panel));
  }

  const style = document.createElement('style');
  style.dataset.rpProfileArtOwnerAccess = 'true';
  style.textContent = `
    .rp-profile.rp-profile-art-owner-readonly [data-rp-profile-art-edit],
    .rp-profile.rp-profile-art-owner-readonly [data-rp-profile-art-editor]{display:none!important}
  `;
  document.head.appendChild(style);

  window.RealPlayProfileArtAccess = {
    ready: () => loadAccess(false),
    refresh: () => loadAccess(true),
    snapshot: () => ({ ...access }),
    canEditPanel,
    canEditOwnProfile: () => Boolean(
      access.loaded && access.canEditProfileArt && access.userId
    ),
    prepareOwnProfile: (panel) => {
      if (!panel || panel.classList.contains('rp-public-player-profile')) return false;
      stabilizeOwnProfile(panel);
      return applyPanel(panel);
    },
    apply: applyPanelAccess,
  };

  window.addEventListener('realplay:profile-loaded', handleProfileLoaded);
  window.addEventListener('realplay:public-profile-loaded', handleProfileLoaded);
  window.addEventListener('realplay:app-ready', () => loadAccess(false).then(applyPanelAccess));
  window.addEventListener('realplay:profile-art-updated', applyPanelAccess);
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    access = { loaded: false, admin: false, userId: null, canEditProfileArt: false };
    loadAccess(true).then(applyPanelAccess);
  });

  // Start the authority request as soon as this layer loads. Settings explicitly
  // awaits this same promise before reopening ME, guaranteeing that Profile Art
  // Studio and the working admin trigger use one stable account identity.
  loadAccess(false);
})();