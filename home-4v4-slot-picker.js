(() => {
  if (window.__realPlayFourVFourDynamicSlotLoaderInstalled) return;
  window.__realPlayFourVFourDynamicSlotLoaderInstalled = true;

  const script = document.createElement('script');
  script.src = 'home-4v4-slot-picker-dynamic-v2.js?v=20260930-admin-time-blocks-v2';
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
})();