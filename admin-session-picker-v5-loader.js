(() => {
  if (window.__realPlayAdminSessionPickerV5LoaderInstalled) return;
  window.__realPlayAdminSessionPickerV5LoaderInstalled = true;

  // Prevent a cached V4 picker from reintroducing the retired SESSION PURPOSE
  // selector when Admin tools are opened later in this page session.
  window.__realPlayAdminSessionPickerInstalledV4 = true;

  if (window.__realPlayAdminSessionPickerInstalledV5) return;

  const script = document.createElement('script');
  script.src = 'admin-session-picker.js?v=20260908-single-game-type-v5';
  script.async = false;
  document.head.appendChild(script);
})();
