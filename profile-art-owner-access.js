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
  let refreshTimer = 0;
  let syntheticStorageRefresh = false;

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

  function normalizeOwnProfileArtAuthority(panel) {
    if (!panel || panel.classList.contains('rp-public-player-profile')) return;
    if (!access.loaded || !access.userId) return;

    // The ME profile can expose the permanent basketball Player ID here, but
    // profile art is stored and authorized by the logged-in Real Play account.
    // Force the art studio to target the authenticated account ID so owner
    // access, uploads, saves and removals all use the same authority key.
    const accountId = String(access.userId);
    if (panel.dataset.rpProfilePlayerId !== accountId) {
      panel.dataset.rpProfilePlayerId = accountId;
    }
  }

  function panelTargetId(panel) {
    if (!panel) return null;
    const isPublic = panel.classList.contains('rp-public-player-profile');
    const source = isPublic
      ? (panel.__realPlayPublicPlayer || {})
      : (panel.__realPlayProfileState || {});
    const profile = source?.profile || source?.player || source || {};

    // Public profiles expose their owning account ID through
    // data-rp-public-player-id. The signed-in ME profile is normalized above to
    // the authenticated account ID before this function is used.
    return firstPositiveInteger(
      isPublic ? panel.dataset?.rpPublicPlayerId : panel.dataset?.rpProfilePlayerId,
      source?.accountUserId,
      source?.account_user_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      profile?.accountUserId,
      profile?.account_user_id,
      profile?.userId,
      profile?.user_id,
      profile?.id,
      source?.userId,
      source?.id,
      source?.playerId
    );
  }

  function canEditPanel(panel) {
    if (!access.loaded || !access.canEditProfileArt) return false;
    if (access.admin) return true;
    const targetId = panelTargetId(panel);
    return Boolean(targetId && access.userId && targetId === access.userId);
  }

  function decorateEditor(panel) {
    const editor = panel?.querySelector?.('[data-rp-profile-art-editor]');
    if (!editor || access.admin || !canEditPanel(panel)) return;
    const label = editor.querySelector('.rp-profile-art-editor-head small');
    if (label && label.textContent !== 'PLAYER · PREMIUM PROFILE') {
      label.textContent = 'PLAYER · PREMIUM PROFILE';
    }
  }

  function applyPanelAccess() {
    document.querySelectorAll('.rp-profile.open').forEach((panel) => {
      normalizeOwnProfileArtAuthority(panel);
      const editable = canEditPanel(panel);
      panel.classList.toggle('rp-profile-art-owner-readonly', !editable);
      panel.classList.toggle('rp-profile-art-owner-editable', editable && !access.admin);
      decorateEditor(panel);
    });
  }

  function scheduleApply(delay = 0) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      applyPanelAccess();
    }, delay);
  }

  function refreshLegacyProfileArtGate() {
    // real-play-profile-intro.js historically cached a boolean "adminAccess".
    // Re-fire only that listener so it rechecks the now owner-aware backend
    // access endpoint instead of keeping an old 403 result for the whole tab.
    syntheticStorageRefresh = true;
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: TOKEN_KEY,
        newValue: token(),
        storageArea: window.localStorage,
      }));
    } catch (_error) {
      try {
        const event = new Event('storage');
        Object.defineProperty(event, 'key', { value: TOKEN_KEY });
        window.dispatchEvent(event);
      } catch (_ignored) {}
    } finally {
      syntheticStorageRefresh = false;
    }
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
            canEditProfileArt: data?.canEditProfileArt !== false,
          };
        }
      } catch (_error) {
        access = { loaded: true, admin: false, userId: null, canEditProfileArt: false };
      } finally {
        accessPromise = null;
      }

      refreshLegacyProfileArtGate();
      scheduleApply(80);
      return access;
    })();

    return accessPromise;
  }

  function refreshForProfile() {
    loadAccess(true).finally(() => scheduleApply(120));
  }

  const style = document.createElement('style');
  style.dataset.rpProfileArtOwnerAccess = 'true';
  style.textContent = `
    .rp-profile.rp-profile-art-owner-readonly [data-rp-profile-art-edit],
    .rp-profile.rp-profile-art-owner-readonly [data-rp-profile-art-editor]{display:none!important}
  `;
  document.head.appendChild(style);

  window.addEventListener('realplay:profile-loaded', refreshForProfile);
  window.addEventListener('realplay:public-profile-loaded', refreshForProfile);
  window.addEventListener('realplay:app-ready', refreshForProfile);
  window.addEventListener('realplay:profile-art-updated', () => scheduleApply(30));
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY || syntheticStorageRefresh) return;
    access.loaded = false;
    loadAccess(true).finally(() => scheduleApply(50));
  });

  const observer = new MutationObserver(() => scheduleApply(20));
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-rp-profile-player-id', 'data-rp-public-player-id'],
  });

  loadAccess(true).finally(() => scheduleApply(40));
})();
