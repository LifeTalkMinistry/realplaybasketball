(() => {
  if (window.__realPlayFourVFourDynamicSlotLoaderInstalled) return;
  window.__realPlayFourVFourDynamicSlotLoaderInstalled = true;

  const compactHomeCardStyles = document.createElement('link');
  compactHomeCardStyles.rel = 'stylesheet';
  compactHomeCardStyles.href = 'home-4v4-card-compact.css?v=20261001-home-card-gap-v1';
  compactHomeCardStyles.dataset.rpFourVFourCompactHomeCard = '1';
  document.head.appendChild(compactHomeCardStyles);

  const loadRotationPicker = () => {
    if (document.querySelector('script[data-rp-team-rotation-picker-loader]')) return;
    const script = document.createElement('script');
    script.dataset.rpTeamRotationPickerLoader = '1';
    script.src = 'home-4v4-team-schedule-rotation-v2.js?v=20261001-team-schedule-rotation-v3';
    script.async = false;
    script.addEventListener('load', () => {
      if (document.querySelector('script[data-rp-4v4-slot-header-loader]')) return;
      const headerScript = document.createElement('script');
      headerScript.dataset.rp4v4SlotHeaderLoader = '1';
      headerScript.src = 'home-4v4-slot-header.js?v=20260930-slot-header-v1';
      headerScript.async = false;
      document.head.appendChild(headerScript);
    }, { once: true });
    script.addEventListener('error', () => console.warn('[Real Play] Team schedule rotation picker did not load.'), { once: true });
    document.head.appendChild(script);
  };

  if (window.__realPlayFourVFourLegacyScheduleFallbackInstalled === true) {
    loadRotationPicker();
    return;
  }

  const fallback = document.createElement('script');
  fallback.src = 'home-4v4-slot-picker-legacy-schedule-fallback.js?v=20260930-admin-slot-hydration-v2';
  fallback.async = false;
  fallback.addEventListener('load', loadRotationPicker, { once: true });
  fallback.addEventListener('error', () => {
    console.warn('[Real Play] Legacy Home schedule fallback did not load.');
    loadRotationPicker();
  }, { once: true });
  document.head.appendChild(fallback);
})();
