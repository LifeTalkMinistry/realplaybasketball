(() => {
  function loadScript(src, onload) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    if (onload) script.onload = onload;
    document.head.appendChild(script);
  }

  if (!document.querySelector('link[href^="profile-ownership.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'profile-ownership.css?v=20260910-choice-clean-v1';
    document.head.appendChild(link);
  }

  loadScript('auth-account-name-bridge.js?v=20260907-ownership-disputes-v1', () => {
    loadScript('auth-ownership-core.js?v=20260924-surgical-stability-v1', () => {
      loadScript('auth-ownership-disputes.js?v=20260907-ownership-disputes-v1', () => {
        // Player identity manager is owned by app.js after the core shell reveal.
        // Keeping a single loader avoids requesting the same module under two versions.
        loadScript('profile-experience.js');
      });
    });
  });
})();
