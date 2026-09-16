(() => {
  if (window.__realPlayReplayFullscreenBackInstalled) return;
  window.__realPlayReplayFullscreenBackInstalled = true;

  const BUTTON_ATTR = 'data-rp-career-replay-fullscreen-back';
  const MARKER_RAIL_ATTR = 'data-rp-career-replay-fullscreen-marker-rail';
  const FULLSCREEN_MARKER_ATTR = 'data-rp-career-replay-fullscreen-marker';
  const PSEUDO_FULLSCREEN_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const PSEUDO_OPEN_CLASS = 'rp-career-replay-pseudo-fullscreen-open';
  const FULLSCREEN_TRIGGER_SELECTOR = '[data-rp-career-replay-fullscreen],[data-rp-career-replay-expand-fixed]';
  let markerSyncTimer = null;
  let pseudoFullscreenStage = null;

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-fullscreen-back{
      position:absolute;
      z-index:12;
      top:max(14px,env(safe-area-inset-top));
      left:max(14px,env(safe-area-inset-left));
      display:none;
      align-items:center;
      gap:8px;
      min-height:42px;
      padding:0 14px 0 11px;
      border:1px solid rgba(122,221,241,.34);
      border-radius:999px;
      background:rgba(2,12,19,.78);
      color:#f4fbff;
      box-shadow:0 8px 24px rgba(0,0,0,.32);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      font-family:var(--rp-body,Arial,sans-serif);
      font-size:.68rem;
      font-weight:900;
      letter-spacing:.08em;
      cursor:pointer;
      touch-action:manipulation;
    }
    .rp-career-replay-fullscreen-back .rp-fs-back-arrow{
      font-size:1.2rem;
      line-height:1;
      transform:translateY(-1px);
    }
    .rp-career-replay-stage:fullscreen .rp-career-replay-fullscreen-back,
    .rp-career-replay-stage:-webkit-full-screen .rp-career-replay-fullscreen-back,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} .rp-career-replay-fullscreen-back{
      display:flex;
    }

    /* Fullscreen uses the SAME made-basket skip system as the normal replay.
       Each ball is a real jump target with the existing seven-second lead-in. */
    .rp-career-replay-fullscreen-marker-rail{
      position:absolute;
      z-index:13;
      left:50%;
      bottom:max(16px,env(safe-area-inset-bottom));
      display:none;
      width:min(56vw,720px);
      height:44px;
      transform:translateX(-50%);
      pointer-events:none;
    }
    .rp-career-replay-fullscreen-marker-track{
      position:absolute;
      inset:0 10px;
      pointer-events:none;
    }
    .rp-career-replay-fullscreen-marker-track::before{
      content:'';
      position:absolute;
      left:0;
      right:0;
      top:50%;
      height:3px;
      border-radius:999px;
      background:rgba(215,236,244,.28);
      box-shadow:0 1px 8px rgba(0,0,0,.28);
      transform:translateY(-50%);
    }
    .rp-career-replay-fullscreen-marker{
      position:absolute;
      z-index:2;
      top:50%;
      width:32px;
      height:32px;
      padding:0;
      display:grid;
      place-items:center;
      border:1px solid rgba(122,221,241,.24);
      border-radius:50%;
      background:rgba(2,12,19,.76);
      color:#fff;
      box-shadow:0 6px 16px rgba(0,0,0,.3);
      transform:translate(-50%,-50%);
      font-size:20px;
      line-height:1;
      cursor:pointer;
      pointer-events:auto;
      touch-action:manipulation;
      transition:transform .14s ease,filter .14s ease,border-color .14s ease;
    }
    .rp-career-replay-fullscreen-marker.active{
      transform:translate(-50%,-50%) scale(1.22);
      filter:drop-shadow(0 0 6px rgba(47,213,238,.9));
      border-color:rgba(122,221,241,.72);
    }
    .rp-career-replay-stage:fullscreen .rp-career-replay-fullscreen-marker-rail,
    .rp-career-replay-stage:-webkit-full-screen .rp-career-replay-fullscreen-marker-rail,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} .rp-career-replay-fullscreen-marker-rail{
      display:block;
    }

    html.${PSEUDO_OPEN_CLASS},
    body.${PSEUDO_OPEN_CLASS}{
      overflow:hidden!important;
      overscroll-behavior:none!important;
      touch-action:none!important;
    }
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS}{
      position:fixed!important;
      inset:0!important;
      z-index:2147483646!important;
      width:100vw!important;
      max-width:none!important;
      height:100vh!important;
      height:100dvh!important;
      max-height:none!important;
      margin:0!important;
      border:0!important;
      border-radius:0!important;
      aspect-ratio:auto!important;
      transform:none!important;
      background:#000!important;
      box-shadow:none!important;
      overflow:hidden!important;
    }
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} [data-rp-career-replay-media],
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} [data-rp-career-replay-media] > div,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} iframe,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} video{
      width:100%!important;
      height:100%!important;
      max-width:none!important;
      max-height:none!important;
    }
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} video{
      object-fit:contain!important;
      background:#000!important;
    }

    /* Keep the regular replay clock beneath the official score outside fullscreen. */
    .rp-career-replay-gamehead{
      gap:4px!important;
    }
    .rp-career-replay-gamehead .rp-career-replay-clock{
      display:block;
      width:100%;
      margin:0;
      text-align:center;
    }
    .rp-career-replay-controls{
      grid-template-columns:42px minmax(0,1fr) 42px 42px!important;
    }

    @media(max-width:620px){
      .rp-career-replay-fullscreen-back{
        min-height:40px;
        padding:0 12px 0 10px;
        font-size:.62rem;
      }
      .rp-career-replay-fullscreen-marker-rail{
        width:min(52vw,520px);
        height:40px;
        bottom:max(12px,env(safe-area-inset-bottom));
      }
      .rp-career-replay-fullscreen-marker{
        width:30px;
        height:30px;
        font-size:18px;
      }
      .rp-career-replay-controls{
        grid-template-columns:38px minmax(0,1fr) 38px 38px!important;
      }
      .rp-career-replay-gamehead .rp-career-replay-clock{
        grid-column:1/-1;
        grid-row:2;
      }
    }
    @media(prefers-reduced-motion:reduce){
      .rp-career-replay-fullscreen-marker{transition:none}
    }
  `;
  document.head.appendChild(style);

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isIPhoneBrowser() {
    const ua = String(navigator.userAgent || '');
    return /iPhone|iPod/i.test(ua);
  }

  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen().catch?.(() => {});
    if (document.webkitExitFullscreen) {
      try { document.webkitExitFullscreen(); } catch (_) {}
    }
    return undefined;
  }

  function stageIsFullscreen(stage) {
    return getFullscreenElement() === stage || stage?.classList?.contains(PSEUDO_FULLSCREEN_CLASS);
  }

  function ensureBackButton(stage) {
    if (!stage || stage.querySelector(`[${BUTTON_ATTR}]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-career-replay-fullscreen-back';
    button.setAttribute(BUTTON_ATTR, '1');
    button.setAttribute('aria-label', 'Back to game details');
    button.innerHTML = '<span class="rp-fs-back-arrow" aria-hidden="true">←</span><span>BACK</span>';
    stage.appendChild(button);
  }

  function sourceMarkers(stage) {
    const replayRoot = stage?.closest?.('.rp-career-replay');
    if (!replayRoot) return [];
    return [...replayRoot.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]')];
  }

  function ensureMarkerRail(stage) {
    if (!stage) return null;
    const sources = sourceMarkers(stage);
    let rail = stage.querySelector(`[${MARKER_RAIL_ATTR}]`);

    if (!sources.length) {
      rail?.remove();
      return null;
    }

    if (!rail) {
      rail = document.createElement('div');
      rail.className = 'rp-career-replay-fullscreen-marker-rail';
      rail.setAttribute(MARKER_RAIL_ATTR, '1');
      rail.setAttribute('aria-label', 'Made basket skip markers');
      rail.innerHTML = '<div class="rp-career-replay-fullscreen-marker-track"></div>';
      stage.appendChild(rail);
    }

    const track = rail.querySelector('.rp-career-replay-fullscreen-marker-track');
    if (!track) return rail;

    const wanted = new Set();
    sources.forEach((source, index) => {
      const replayStart = String(source.dataset.rpCareerReplayMarker || '0');
      const stamp = String(source.dataset.rpCareerMarkerStamp || '0');
      const key = `${replayStart}:${stamp}:${index}`;
      wanted.add(key);

      let button = [...track.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)]
        .find((node) => node.dataset.rpFullscreenMarkerKey === key);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'rp-career-replay-fullscreen-marker';
        button.setAttribute(FULLSCREEN_MARKER_ATTR, '1');
        button.dataset.rpFullscreenMarkerKey = key;
        button.dataset.rpCareerReplayMarker = replayStart;
        button.dataset.rpCareerMarkerStamp = stamp;
        button.textContent = '🏀';
        button.setAttribute('aria-label', source.getAttribute('aria-label') || 'Jump to made basket');
        button.title = source.title || 'Jump to made basket';
        track.appendChild(button);
      }
    });

    [...track.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)].forEach((button) => {
      if (!wanted.has(button.dataset.rpFullscreenMarkerKey || '')) button.remove();
    });

    syncMarkerRail(stage);
    return rail;
  }

  function syncMarkerRail(stage) {
    if (!stage) return;
    const sources = sourceMarkers(stage);
    const rail = stage.querySelector(`[${MARKER_RAIL_ATTR}]`);
    const track = rail?.querySelector('.rp-career-replay-fullscreen-marker-track');
    if (!track || !sources.length) return;

    const clones = [...track.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)];
    sources.forEach((source, index) => {
      const clone = clones[index];
      if (!clone) return;
      if (source.style.left) clone.style.left = source.style.left;
      clone.classList.toggle('active', source.classList.contains('active'));
    });
  }

  function stopMarkerSync() {
    if (!markerSyncTimer) return;
    clearInterval(markerSyncTimer);
    markerSyncTimer = null;
  }

  function startMarkerSync(stage) {
    stopMarkerSync();
    if (!stage) return;
    ensureMarkerRail(stage);
    syncMarkerRail(stage);
    markerSyncTimer = setInterval(() => {
      if (!stageIsFullscreen(stage)) {
        stopMarkerSync();
        return;
      }
      ensureMarkerRail(stage);
      syncMarkerRail(stage);
    }, 120);
  }

  function enterPseudoFullscreen(stage) {
    if (!stage) return;
    if (pseudoFullscreenStage && pseudoFullscreenStage !== stage) exitPseudoFullscreen();
    pseudoFullscreenStage = stage;
    ensureBackButton(stage);
    ensureMarkerRail(stage);
    stage.classList.add(PSEUDO_FULLSCREEN_CLASS);
    stage.setAttribute('data-rp-career-replay-pseudo-fullscreen', '1');
    document.documentElement.classList.add(PSEUDO_OPEN_CLASS);
    document.body.classList.add(PSEUDO_OPEN_CLASS);
    startMarkerSync(stage);
  }

  function exitPseudoFullscreen() {
    const stage = pseudoFullscreenStage || document.querySelector(`.${PSEUDO_FULLSCREEN_CLASS}`);
    if (stage) {
      stage.classList.remove(PSEUDO_FULLSCREEN_CLASS);
      stage.removeAttribute('data-rp-career-replay-pseudo-fullscreen');
    }
    pseudoFullscreenStage = null;
    document.documentElement.classList.remove(PSEUDO_OPEN_CLASS);
    document.body.classList.remove(PSEUDO_OPEN_CLASS);
    stopMarkerSync();
  }

  function shouldUsePseudoFullscreen(stage) {
    if (isIPhoneBrowser()) return true;
    return !(stage?.requestFullscreen || stage?.webkitRequestFullscreen);
  }

  function placeReplayClock() {
    document.querySelectorAll('.rp-career-replay-gamehead').forEach((gamehead) => {
      const score = gamehead.querySelector('.rp-career-replay-score');
      const replayRoot = gamehead.closest('.rp-career-replay');
      const clock = replayRoot?.querySelector('[data-rp-career-replay-clock]');
      if (!score || !clock || clock.parentElement === gamehead) return;
      score.insertAdjacentElement('afterend', clock);
    });
  }

  function enhance() {
    if (pseudoFullscreenStage && !pseudoFullscreenStage.isConnected) exitPseudoFullscreen();
    document.querySelectorAll('[data-rp-career-replay-stage]').forEach(ensureBackButton);
    placeReplayClock();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.(FULLSCREEN_TRIGGER_SELECTOR);
    if (!trigger) return;
    const stage = trigger.closest('[data-rp-career-replay-stage]');
    if (!stage || !shouldUsePseudoFullscreen(stage)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (stage.classList.contains(PSEUDO_FULLSCREEN_CLASS)) exitPseudoFullscreen();
    else enterPseudoFullscreen(stage);
  }, true);

  document.addEventListener('click', (event) => {
    const marker = event.target?.closest?.(`[${FULLSCREEN_MARKER_ATTR}]`);
    if (!marker) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const stage = marker.closest('[data-rp-career-replay-stage]');
    const replayRoot = stage?.closest?.('.rp-career-replay');
    if (!replayRoot) return;

    const replayStart = String(marker.dataset.rpCareerReplayMarker || '0');
    const stamp = String(marker.dataset.rpCareerMarkerStamp || '0');
    const original = [...replayRoot.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]')]
      .find((node) => String(node.dataset.rpCareerReplayMarker || '0') === replayStart
        && String(node.dataset.rpCareerMarkerStamp || '0') === stamp)
      || replayRoot.querySelector(`[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker="${replayStart}"]`);

    original?.click();
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.(`[${BUTTON_ATTR}]`);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = button.closest('[data-rp-career-replay-stage]');
    if (stage?.classList?.contains(PSEUDO_FULLSCREEN_CLASS)) {
      exitPseudoFullscreen();
      return;
    }
    exitFullscreen();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pseudoFullscreenStage) exitPseudoFullscreen();
  });

  const onFullscreenChange = () => {
    const full = getFullscreenElement();
    if (full?.matches?.('[data-rp-career-replay-stage]')) {
      ensureBackButton(full);
      ensureMarkerRail(full);
      startMarkerSync(full);
    } else if (!pseudoFullscreenStage) {
      stopMarkerSync();
      enhance();
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }
})();