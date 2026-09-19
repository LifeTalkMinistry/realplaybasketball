(() => {
  if (window.__realPlayProfileShareArtBridgeInstalled) return;
  window.__realPlayProfileShareArtBridgeInstalled = true;

  const blobUrls = new WeakMap();
  const inFlight = new WeakMap();

  function isProfileArtImage(node) {
    return node instanceof HTMLImageElement && Boolean(node.closest('.rp-premium-profile-art'));
  }

  function sourceOf(image) {
    return String(image?.currentSrc || image?.src || '').trim();
  }

  function isSafeLocalSource(src) {
    return /^blob:|^data:/i.test(String(src || ''));
  }

  function notifyReady() {
    try {
      window.dispatchEvent(new CustomEvent('realplay:profile-art-updated', {
        detail: { shareCanvasBridge: true },
      }));
    } catch (_error) {}
    window.setTimeout(() => window.RealPlayProfileShare?.prepare?.(), 0);
  }

  async function bridgeImage(image) {
    if (!isProfileArtImage(image)) return;
    const src = sourceOf(image);
    if (!src || isSafeLocalSource(src)) return;
    if (inFlight.get(image) === src) return;

    inFlight.set(image, src);
    try {
      const response = await fetch(src, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'image/png,image/webp,image/*,*/*' },
      });
      if (!response.ok) throw new Error(`Profile art returned ${response.status}.`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Profile art response is not an image.');

      // Do not replace a newer portrait if the profile changed while the fetch was running.
      if (sourceOf(image) !== src) return;

      const previousBlobUrl = blobUrls.get(image);
      const blobUrl = URL.createObjectURL(blob);
      blobUrls.set(image, blobUrl);
      image.dataset.rpShareOriginalArtSrc = src;
      image.dataset.rpShareCanvasReady = 'true';

      const reveal = () => {
        image.removeEventListener('load', reveal);
        if (previousBlobUrl && previousBlobUrl !== blobUrl) {
          try { URL.revokeObjectURL(previousBlobUrl); } catch (_error) {}
        }
        notifyReady();
      };
      image.addEventListener('load', reveal, { once: true });
      image.src = blobUrl;
      if (image.complete && image.naturalWidth > 0) reveal();
    } catch (error) {
      // Keep the visible profile untouched. Sharing still works without the bridge,
      // but the card generator may omit the portrait on browsers with an opaque
      // cross-origin image cache.
      console.warn('[Real Play] Share-card profile art bridge could not prepare this portrait.', error);
    } finally {
      if (inFlight.get(image) === src) inFlight.delete(image);
    }
  }

  function scan(root = document) {
    if (isProfileArtImage(root)) bridgeImage(root);
    root.querySelectorAll?.('.rp-premium-profile-art img').forEach(bridgeImage);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && isProfileArtImage(mutation.target)) {
        bridgeImage(mutation.target);
        continue;
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  window.addEventListener('realplay:profile-loaded', () => setTimeout(scan, 40));
  window.addEventListener('realplay:public-profile-loaded', () => setTimeout(scan, 40));
  window.addEventListener('realplay:profile-art-updated', (event) => {
    if (event?.detail?.shareCanvasBridge) return;
    setTimeout(scan, 40);
  });

  scan();
})();
