(() => {
  if (window.__realPlayProfileLinkedShareInstalled) return;
  window.__realPlayProfileLinkedShareInstalled = true;

  if (typeof navigator.share !== 'function') return;

  const nativeShare = navigator.share.bind(navigator);
  const PROFILE_SHARE_URL = /^https:\/\/api\.clarapmc\.com\/api\/real-play\/profile-share\/[a-f0-9]{40}(?:[?#].*)?$/i;
  const DIRECT_PROFILE_URL = /^https:\/\/joinrealplay\.com\/(?:\?player=\d+)?(?:#.*)?$/i;

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

  function linkedPayload(payload) {
    const url = String(payload.url || '').trim();
    const baseText = String(payload.text || '').trim();
    const text = baseText.includes(url)
      ? baseText
      : [baseText, 'Open this player on Real Play:', url].filter(Boolean).join('\n');

    // Sharing a file and a URL together is not portable across native share
    // targets. In particular, some iPhone/social targets keep only the PNG.
    // Share the URL instead: the Real Play social-share endpoint serves the
    // exact captured profile hero as Open Graph artwork to crawlers, while a
    // real person who taps the card is redirected to the player profile.
    return {
      title: payload.title || 'Real Play Basketball',
      text,
      url,
    };
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