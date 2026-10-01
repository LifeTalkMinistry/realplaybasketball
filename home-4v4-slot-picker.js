(() => {
  if (window.__realPlayFourVFourDynamicSlotLoaderInstalled) return;
  window.__realPlayFourVFourDynamicSlotLoaderInstalled = true;

  const compactHomeCardStyles = document.createElement('link');
  compactHomeCardStyles.rel = 'stylesheet';
  compactHomeCardStyles.href = 'home-4v4-card-compact.css?v=20261001-home-card-gap-v1';
  compactHomeCardStyles.dataset.rpFourVFourCompactHomeCard = '1';
  document.head.appendChild(compactHomeCardStyles);

  const loadSlotPicker = () => {
    const script = document.createElement('script');
    script.src = 'home-4v4-slot-picker-dynamic-v2.js?v=20260930-assigned-team-filter-v6';
    script.async = false;
    script.addEventListener('load', () => {
      const headerScript = document.createElement('script');
      headerScript.src = 'home-4v4-slot-header.js?v=20260930-slot-header-v1';
      headerScript.async = false;
      document.head.appendChild(headerScript);
    }, { once: true });
    script.addEventListener('error', () => {
      console.warn('[Real Play] Admin-driven time slot picker did not load.');
    }, { once: true });
    document.head.appendChild(script);
  };

  if (window.__realPlayFourVFourLegacyScheduleFallbackInstalled === true) {
    loadSlotPicker();
    return;
  }

  const fallback = document.createElement('script');
  fallback.src = 'home-4v4-slot-picker-legacy-schedule-fallback.js?v=20260930-admin-slot-hydration-v2';
  fallback.async = false;
  fallback.addEventListener('load', loadSlotPicker, { once: true });
  fallback.addEventListener('error', () => {
    console.warn('[Real Play] Legacy Home schedule fallback did not load.');
    loadSlotPicker();
  }, { once: true });
  document.head.appendChild(fallback);
})();