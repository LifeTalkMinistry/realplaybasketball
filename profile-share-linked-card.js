(() => {
  if (window.__realPlayProfileLinkedShareInstalledV110) return;
  window.__realPlayProfileLinkedShareInstalledV110 = true;

  if (typeof navigator.share !== 'function') return;

  const nativeShare = navigator.share.bind(navigator);
  const PROFILE_SHARE_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share\/[a-f0-9]{40}(?:[?#].*)?$/i;
  const DIRECT_PROFILE_URL = /^https:\/\/joinrealplay\.com\/(?:\?player=\d+)?(?:#.*)?$/i;
  const PREVIEW_VERSION = '20260920-image-only-v110';

  function isProfileImage(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type === 'image/png' && (name.startsWith('real-play-') || name === 'real-play-profile.png');
  }

  function shouldConvertToLinkedCard(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const url = String(payload.url || '').trim();
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (!url || !files.some(isProfileImage)) return false;
    return PROFILE_SHARE_URL.test(url) || DIRECT_PROFILE_URL.test(url);
  }

  function versionedPreviewUrl(value) {
    const raw = String(value || '').trim();
    if (!PROFILE_SHARE_URL.test(raw)) return raw;
    try {
      const url = new URL(raw);
      url.searchParams.set('rp_preview', PREVIEW_VERSION);
      return url.toString();
    } catch (_error) {
      return raw;
    }
  }

  function linkedPayload(payload) {
    const url = versionedPreviewUrl(payload.url);

    // Native share targets are inconsistent when a PNG and URL are supplied
    // together. Share only the social URL here so Facebook can keep the exact
    // captured hero clickable. The social document itself now owns the image,
    // canonical joinrealplay.com destination, and deliberately minimal metadata.
    return { url };
  }

  function share(payload) {
    if (!shouldConvertToLinkedCard(payload)) return nativeShare(payload);
    return nativeShare(linkedPayload(payload));
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
