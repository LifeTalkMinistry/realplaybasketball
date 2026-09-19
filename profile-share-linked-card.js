(() => {
  if (window.__realPlayProfileLinkedShareInstalledV112) return;
  window.__realPlayProfileLinkedShareInstalledV112 = true;

  const PUBLIC_APP_URL = 'https://joinrealplay.com/';
  const PROFILE_SHARE_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share\/[a-f0-9]{40}(?:[?#].*)?$/i;
  const DIRECT_PROFILE_URL = /^https:\/\/joinrealplay\.com\/(?:\?player=\d+)?(?:#.*)?$/i;
  const SNAPSHOT_UPLOAD_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share-snapshots(?:\?|$)/i;
  const PLAYER_MEMORY_MS = 15000;

  let latestSharePlayerId = null;
  let latestSharePlayerAt = 0;

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  function directProfileUrl(playerId) {
    const id = positiveId(playerId);
    if (!id) return PUBLIC_APP_URL;
    const url = new URL(PUBLIC_APP_URL);
    url.searchParams.set('player', String(id));
    return url.toString();
  }

  function rememberSnapshotPlayer(input) {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input?.url || '';
    if (!SNAPSHOT_UPLOAD_URL.test(String(raw))) return;
    try {
      const id = positiveId(new URL(raw, window.location.href).searchParams.get('player'));
      if (!id) return;
      latestSharePlayerId = id;
      latestSharePlayerAt = Date.now();
    } catch (_error) {}
  }

  if (typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function realPlayShareDomainFetch(input, init) {
      rememberSnapshotPlayer(input);
      return nativeFetch(input, init);
    };
  }

  if (typeof navigator.share !== 'function') return;

  const nativeShare = navigator.share.bind(navigator);

  function isProfileImage(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type === 'image/png' && (name.startsWith('real-play-') || name === 'real-play-profile.png');
  }

  function currentPublicPlayerId() {
    const panel = document.querySelector('.rp-profile.open');
    if (!panel) return null;
    const source = panel.__realPlayPublicPlayer || panel.__realPlayProfileState || {};
    const profile = source?.profile || source?.player || source || {};
    return positiveId(
      panel.dataset?.rpPublicPlayerId ??
      source?.playerId ?? source?.player_id ?? source?.publicPlayerId ?? source?.public_player_id ??
      profile?.playerId ?? profile?.player_id
    );
  }

  function rememberedPlayerId() {
    if (latestSharePlayerId && Date.now() - latestSharePlayerAt <= PLAYER_MEMORY_MS) {
      return latestSharePlayerId;
    }
    return currentPublicPlayerId();
  }

  function profileFiles(payload) {
    return Array.isArray(payload?.files) ? payload.files.filter(isProfileImage) : [];
  }

  function shouldRewrite(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!profileFiles(payload).length) return false;
    const url = String(payload.url || '').trim();
    return PROFILE_SHARE_URL.test(url) || DIRECT_PROFILE_URL.test(url);
  }

  function directUrlFor(payload) {
    const suppliedUrl = String(payload?.url || '').trim();
    if (DIRECT_PROFILE_URL.test(suppliedUrl)) return suppliedUrl;
    return directProfileUrl(rememberedPlayerId());
  }

  function copyProfileLink(url) {
    if (!url) return;
    window.__realPlayLastSharedProfileUrl = url;
    try {
      const result = navigator.clipboard?.writeText?.(url);
      result?.catch?.(() => {});
    } catch (_error) {}
  }

  function imageOnlyPayload(payload) {
    const files = profileFiles(payload);
    const url = directUrlFor(payload);

    // A clickable Facebook link preview always renders Facebook-owned link
    // chrome beneath the artwork. To keep the shared post visually identical
    // to the Real Play profile card, hand Facebook only the PNG as post media.
    // Preserve the canonical player destination by copying it to the clipboard
    // at the same moment, ready to paste into a caption/message when desired.
    copyProfileLink(url);
    return { files };
  }

  function share(payload) {
    if (!shouldRewrite(payload)) return nativeShare(payload);
    return nativeShare(imageOnlyPayload(payload));
  }

  let installed = false;
  try {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: share,
    });
    installed = navigator.share === share;
  } catch (_error) {}

  if (!installed && typeof Navigator !== 'undefined') {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'share');
      if (!descriptor || descriptor.configurable) {
        Object.defineProperty(Navigator.prototype, 'share', {
          configurable: true,
          writable: true,
          value: share,
        });
      }
    } catch (_error) {}
  }
})();
