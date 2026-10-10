/* Real Play static-deployment freshness check.
 * GitHub Pages/CDN browsers may cache index.html separately from versioned assets.
 * On navigation, compare the loaded document with a cache-busted copy of the
 * deployed HTML and refresh once if the deployment manifest has changed.
 * No polling or forced reload while users are actively playing.
 */
(() => {
  const VERSION_PARAM = '_rpv';
  const CHECK_PARAM = '_rp_check';
  const getSignature = (doc) => {
    const deploy = doc.documentElement.getAttribute('data-rp-deploy') || '';
    const assets = [...doc.querySelectorAll('script[src],link[rel="stylesheet"][href]')]
      .map((node) => node.getAttribute('src') || node.getAttribute('href') || '')
      .filter(Boolean);
    return JSON.stringify([deploy, assets]);
  };
  const shortHash = (value) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };
  // Capture only the initial HTML assets, before other scripts add dynamic tags.
  const currentSignature = getSignature(document);
  const checkLatest = async () => {
    try {
      const checkUrl = new URL('index.html', document.baseURI);
      checkUrl.searchParams.set(CHECK_PARAM, String(Date.now()));
      const response = await fetch(checkUrl.href, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) return;
      const html = await response.text();
      if (!html.includes('data-rp-deploy=')) return;
      const latest = new DOMParser().parseFromString(html, 'text/html');
      const latestSignature = getSignature(latest);
      if (currentSignature === latestSignature) return;
      const version = shortHash(latestSignature);
      const target = new URL(window.location.href);
      // A repeated mismatch for the same target should not cause a reload loop.
      if (target.searchParams.get(VERSION_PARAM) === version) return;
      target.searchParams.set(VERSION_PARAM, version);
      window.location.replace(target.href);
    } catch (error) {
      // Offline or temporary network issues should never block normal play.
      console.debug('[Real Play] Update check unavailable.', error);
    }
  };
  void checkLatest();
})();
