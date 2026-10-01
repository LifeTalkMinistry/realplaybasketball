(() => {
  if (window.__realPlayFourVFourDynamicSlotLoaderInstalled) return;
  window.__realPlayFourVFourDynamicSlotLoaderInstalled = true;

  const compactHomeCardStyles = document.createElement('link');
  compactHomeCardStyles.rel = 'stylesheet';
  compactHomeCardStyles.href = 'home-4v4-card-compact.css?v=20261001-rotation-clean-ui-v1';
  compactHomeCardStyles.dataset.rpFourVFourCompactHomeCard = '1';
  document.head.appendChild(compactHomeCardStyles);

  const loadCleanRotationUi = () => {
    if (document.querySelector('script[data-rp-rotation-clean-ui-loader]')) return;
    const cleanUi = document.createElement('script');
    cleanUi.dataset.rpRotationCleanUiLoader = '1';
    cleanUi.src = 'home-4v4-rotation-clean-ui.js?v=20261001-rotation-clean-ui-v1';
    cleanUi.async = false;
    cleanUi.addEventListener('error', () => console.warn('[Real Play] 4v4 rotation clean UI guard did not load.'), { once: true });
    document.head.appendChild(cleanUi);
  };

  const loadLateBindBridge = () => {
    if (document.querySelector('script[data-rp-team-code-late-bind-loader]')) return;
    const bridge = document.createElement('script');
    bridge.dataset.rpTeamCodeLateBindLoader = '1';
    bridge.src = 'home-4v4-team-code-late-bind.js?v=20261001-team-code-late-bind-v2';
    bridge.async = false;
    bridge.addEventListener('error', () => console.warn('[Real Play] 4v4 team-code late-bind bridge did not load.'), { once: true });
    document.head.appendChild(bridge);
  };

  const loadRotationPicker = () => {
    if (document.querySelector('script[data-rp-team-rotation-picker-loader]')) return;
    loadCleanRotationUi();
    loadLateBindBridge();
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
