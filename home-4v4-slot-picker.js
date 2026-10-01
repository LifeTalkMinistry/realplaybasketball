(() => {
  if (window.__realPlayFourVFourDynamicSlotLoaderInstalled) return;
  window.__realPlayFourVFourDynamicSlotLoaderInstalled = true;

  // Force the latest Player Management identity metadata to load before the
  // shell enhancement chain can reuse an older cached copy. The identity
  // module protects itself with its own install guard, so the normal loader
  // can safely encounter it again later without double-installing it.
  if (!window.__realPlayWorldPlayerAdminIdentityInstalled
      && !document.querySelector('script[data-rp-player-admin-identity-fresh-loader]')) {
    const identity = document.createElement('script');
    identity.dataset.rpPlayerAdminIdentityFreshLoader = '1';
    identity.src = 'real-play-world-player-admin-identity.js?v=20261001-inactivity-meta-v2';
    identity.async = false;
    identity.addEventListener('error', () => {
      console.warn('[Real Play] Fresh Player Management identity metadata did not load.');
    }, { once: true });
    document.head.appendChild(identity);
  }

  const compactHomeCardStyles = document.createElement('link');
  compactHomeCardStyles.rel = 'stylesheet';
  compactHomeCardStyles.href = 'home-4v4-card-compact.css?v=20261001-hide-home-meta-v2';
  compactHomeCardStyles.dataset.rpFourVFourCompactHomeCard = '1';
  document.head.appendChild(compactHomeCardStyles);

  // Put the selected schedule exactly where SELECT YOUR TEAM used to be,
  // with the same strong centered treatment. The old schedule banner may
  // still be maintained by the rotation runtime, so hide it globally rather
  // than removing/recreating DOM nodes in a loop.
  const installScheduleHeader = () => {
    if (window.__realPlayFourVFourScheduleHeaderInstalled) return;
    window.__realPlayFourVFourScheduleHeaderInstalled = true;

    const STYLE_ID = 'rp-4v4-selected-schedule-header-style';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        [data-rp-4v4-team-slot],
        .rp-4v4-team-slot{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
        .rp-4v4-static-view .rp-3v3-brand[data-rp-team-schedule-header="1"]{
          width:100%!important;min-width:0!important;max-width:none!important;justify-self:stretch!important;
          padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;
          text-align:center!important;
        }
        .rp-4v4-static-view .rp-3v3-brand[data-rp-team-schedule-header="1"] strong{
          display:block!important;width:100%!important;margin:0!important;
          color:#f5f9ff!important;font-family:var(--rp-display,Arial,sans-serif)!important;
          font-size:1.05rem!important;font-weight:1000!important;letter-spacing:.09em!important;
          line-height:1!important;text-align:center!important;text-transform:uppercase!important;white-space:nowrap!important;
        }
        .rp-4v4-static-view .rp-3v3-brand[data-rp-team-schedule-header="1"] span{display:none!important}
      `;
      document.head.appendChild(style);
    }

    let queued = false;
    const selectedSlot = () => {
      if (window.__realPlay4v4SelectedSlot?.label) return window.__realPlay4v4SelectedSlot;
      try {
        const saved = JSON.parse(sessionStorage.getItem('real_play_4v4_time_slot') || 'null');
        return saved?.label ? saved : null;
      } catch (_error) {
        return null;
      }
    };

    const sync = () => {
      queued = false;
      const view = document.querySelector('[data-rp-4v4-static-view], .rp-4v4-static-view');
      if (!view) return;

      const slot = selectedSlot();
      if (!slot?.label) return;

      const brand = view.querySelector('.rp-3v3-topbar .rp-3v3-brand');
      const title = brand?.querySelector('strong');
      const subtitle = brand?.querySelector('span');
      if (!brand || !title) return;

      if (brand.dataset.rpTeamScheduleHeader !== '1') brand.dataset.rpTeamScheduleHeader = '1';
      if (title.textContent.trim() !== slot.label) title.textContent = slot.label;
      if (subtitle && subtitle.textContent !== '') subtitle.textContent = '';
    };

    const queueSync = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    };

    window.addEventListener('realplay:4v4-slot-context', queueSync);
    window.addEventListener('realplay:home-schedule-changed', queueSync);
    new MutationObserver(queueSync).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rp-active-club', 'class'],
    });
    queueSync();
  };

  installScheduleHeader();

  const loadCleanRotationUi = () => {
    if (document.querySelector('script[data-rp-rotation-clean-ui-loader]')) return;
    const cleanUi = document.createElement('script');
    cleanUi.dataset.rpRotationCleanUiLoader = '1';
    cleanUi.src = 'home-4v4-rotation-clean-ui.js?v=20261001-rotation-clean-ui-v4';
    cleanUi.async = false;
    cleanUi.addEventListener('error', () => console.warn('[Real Play] 4v4 rotation clean UI guard did not load.'), { once: true });
    document.head.appendChild(cleanUi);
  };

  const loadLateBindBridge = () => {
    if (document.querySelector('script[data-rp-team-code-late-bind-loader]')) return;
    const bridge = document.createElement('script');
    bridge.dataset.rpTeamCodeLateBindLoader = '1';
    bridge.src = 'home-4v4-team-code-late-bind.js?v=20261001-team-code-late-bind-v3';
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
    script.src = 'home-4v4-team-schedule-rotation-v2.js?v=20261001-team-schedule-rotation-v5';
    script.async = false;
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
