(() => {
  if (window.__realPlayReplayFullscreenBackInstalled) return;
  window.__realPlayReplayFullscreenBackInstalled = true;

  const BUTTON_ATTR = 'data-rp-career-replay-fullscreen-back';
  const MARKER_RAIL_ATTR = 'data-rp-career-replay-fullscreen-marker-rail';
  const FULLSCREEN_MARKER_ATTR = 'data-rp-career-replay-fullscreen-marker';
  const FULLSCREEN_FILTER_ATTR = 'data-rp-career-replay-fullscreen-filter';
  const PSEUDO_FULLSCREEN_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const PSEUDO_OPEN_CLASS = 'rp-career-replay-pseudo-fullscreen-open';
  const HUD_VISIBLE_CLASS = 'rp-career-replay-fullscreen-hud-visible';
  const HUD_MANAGED_ATTR = 'data-rp-career-replay-fullscreen-hud-managed';
  const HUD_FADE_MS = 4000;
  const FULLSCREEN_TRIGGER_SELECTOR = '[data-rp-career-replay-fullscreen],[data-rp-career-replay-expand-fixed]';

  let markerSyncTimer = null;
  let pseudoFullscreenStage = null;
  let pseudoHome = null;
  let hudFadeTimer = null;
  let pseudoLayoutTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-fullscreen-back{
      position:absolute;
      z-index:14;
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

    .rp-career-replay-fullscreen-marker-rail{
      position:absolute;
      z-index:13;
      left:50%;
      bottom:max(12px,env(safe-area-inset-bottom));
      display:none;
      width:min(68vw,760px);
      height:92px;
      transform:translateX(-50%);
      pointer-events:none;
      opacity:1;
      transition:opacity .16s ease,transform .16s ease;
    }
    .rp-career-replay-fullscreen-filter-wrap{
      position:absolute;
      top:0;
      left:50%;
      z-index:4;
      transform:translateX(-50%);
      pointer-events:auto;
    }
    .rp-career-replay-fullscreen-filter{
      min-width:150px;
      height:32px;
      box-sizing:border-box;
      padding:0 30px 0 11px;
      border:1px solid rgba(55,199,232,.44);
      border-radius:10px;
      background:rgba(4,20,30,.90);
      color:#e9fbff;
      box-shadow:0 7px 22px rgba(0,0,0,.32);
      backdrop-filter:blur(9px);
      -webkit-backdrop-filter:blur(9px);
      font:950 .58rem/1 system-ui,sans-serif;
      letter-spacing:.065em;
      text-transform:uppercase;
      outline:none;
      cursor:pointer;
      touch-action:manipulation;
    }
    .rp-career-replay-fullscreen-filter:focus-visible{
      border-color:rgba(80,226,251,.82);
      box-shadow:0 0 0 2px rgba(48,205,235,.14),0 7px 22px rgba(0,0,0,.32);
    }
    .rp-career-replay-fullscreen-filter option{
      background:#071824;
      color:#eefcff;
    }
    .rp-career-replay-fullscreen-marker-track{
      position:absolute;
      left:10px;
      right:10px;
      bottom:0;
      height:44px;
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
      background:rgba(215,236,244,.30);
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
      border:1px solid rgba(122,221,241,.30);
      border-radius:50%;
      background:rgba(2,12,19,.80);
      color:#fff;
      box-shadow:0 6px 16px rgba(0,0,0,.3);
      transform:translate(-50%,-50%);
      font:950 9px/1 system-ui,sans-serif;
      letter-spacing:-.03em;
      cursor:pointer;
      pointer-events:auto;
      touch-action:manipulation;
      transition:transform .14s ease,filter .14s ease,border-color .14s ease;
    }
    .rp-career-replay-fullscreen-marker[data-rp-career-audit-kind="score"]{font-size:20px}
    .rp-career-replay-fullscreen-marker[data-rp-career-audit-kind="miss"]{font-size:17px;color:#ffb2b8}
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

    .rp-career-replay-stage[${HUD_MANAGED_ATTR}="1"] .rp-career-replay-fullscreen-marker-rail{
      opacity:0;
      transform:translate(-50%,8px);
      pointer-events:none;
    }
    .rp-career-replay-stage[${HUD_MANAGED_ATTR}="1"].${HUD_VISIBLE_CLASS} .rp-career-replay-fullscreen-marker-rail{
      opacity:1;
      transform:translate(-50%,0);
      pointer-events:auto;
    }

    html.${PSEUDO_OPEN_CLASS},
    body.${PSEUDO_OPEN_CLASS}{
      width:100%!important;
      height:100%!important;
      overflow:hidden!important;
      overscroll-behavior:none!important;
      touch-action:none!important;
      background:#000!important;
    }

    /* Pseudo fullscreen is fallback-only. It is attached directly to body so
       transformed/contained app ancestors cannot trap position:fixed. */
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS}{
      position:fixed!important;
      left:0!important;
      top:0!important;
      right:auto!important;
      bottom:auto!important;
      z-index:2147483646!important;
      width:100vw!important;
      max-width:none!important;
      min-width:100vw!important;
      height:100vh!important;
      height:100dvh!important;
      max-height:none!important;
      min-height:100vh!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      aspect-ratio:auto!important;
      transform:none!important;
      background:#000!important;
      box-shadow:none!important;
      overflow:hidden!important;
      contain:none!important;
    }
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} [data-rp-career-replay-media],
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} .rp-career-replay-yt-host,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} [data-rp-career-replay-media] > div,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} iframe,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} video{
      position:absolute!important;
      inset:0!important;
      display:block!important;
      width:100%!important;
      max-width:none!important;
      min-width:100%!important;
      height:100%!important;
      max-height:none!important;
      min-height:100%!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      transform:none!important;
      box-sizing:border-box!important;
      background:#000!important;
    }
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} video{
      object-fit:contain!important;
    }

    .rp-career-replay-stage[${HUD_MANAGED_ATTR}="1"].${HUD_VISIBLE_CLASS} .rp-career-replay-stat-pop,
    .rp-career-replay-stage[${HUD_MANAGED_ATTR}="1"].${HUD_VISIBLE_CLASS} [data-rp-career-score-pop]{
      bottom:max(112px,calc(env(safe-area-inset-bottom) + 100px))!important;
    }

    .rp-career-replay-gamehead{gap:4px!important}
    .rp-career-replay-gamehead .rp-career-replay-clock{
      display:block;
      width:100%;
      margin:0;
      text-align:center;
    }
    .rp-career-replay-controls{grid-template-columns:42px minmax(0,1fr) 42px 42px!important}

    @media(max-width:620px){
      .rp-career-replay-fullscreen-back{
        min-height:40px;
        padding:0 12px 0 10px;
        font-size:.62rem;
      }
      .rp-career-replay-fullscreen-marker-rail{
        width:min(78vw,560px);
        height:84px;
        bottom:max(8px,env(safe-area-inset-bottom));
      }
      .rp-career-replay-fullscreen-filter{
        min-width:132px;
        height:29px;
        font-size:.50rem;
        border-radius:9px;
      }
      .rp-career-replay-fullscreen-marker-track{height:40px}
      .rp-career-replay-fullscreen-marker{
        width:30px;
        height:30px;
      }
      .rp-career-replay-fullscreen-marker[data-rp-career-audit-kind="score"]{font-size:18px}
      .rp-career-replay-controls{grid-template-columns:38px minmax(0,1fr) 38px 38px!important}
      .rp-career-replay-gamehead .rp-career-replay-clock{
        grid-column:1/-1;
        grid-row:2;
      }
    }
    @media(prefers-reduced-motion:reduce){
      .rp-career-replay-fullscreen-marker,
      .rp-career-replay-fullscreen-marker-rail{transition:none}
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

  function isAndroidBrowser() {
    const ua = String(navigator.userAgent || '');
    return /Android/i.test(ua);
  }

  function hasNativeFullscreen(stage) {
    return Boolean(stage?.requestFullscreen || stage?.webkitRequestFullscreen);
  }

  function unlockOrientation() {
    if (!isAndroidBrowser()) return;
    try { screen.orientation?.unlock?.(); } catch (_) {}
  }

  async function lockLandscape() {
    if (!isAndroidBrowser()) return;
    try {
      const result = screen.orientation?.lock?.('landscape');
      if (result?.catch) await result.catch(() => {});
    } catch (_) {}
  }

  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen().catch?.(() => {});
    if (document.webkitExitFullscreen) {
      try { document.webkitExitFullscreen(); } catch (_) {}
    }
    return undefined;
  }

  async function enterNativeFullscreen(stage) {
    if (!stage || !hasNativeFullscreen(stage)) return false;
    try {
      ensureBackButton(stage);
      ensureMarkerRail(stage);
      if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else {
        stage.webkitRequestFullscreen();
      }
      await lockLandscape();
      return true;
    } catch (_) {
      return false;
    }
  }

  function stageIsFullscreen(stage) {
    return getFullscreenElement() === stage || stage?.classList?.contains(PSEUDO_FULLSCREEN_CLASS);
  }

  function clearHudFade() {
    if (!hudFadeTimer) return;
    clearTimeout(hudFadeTimer);
    hudFadeTimer = null;
  }

  function hideFullscreenHud(stage) {
    if (!stage?.isConnected || stage.getAttribute(HUD_MANAGED_ATTR) !== '1') return;
    stage.classList.remove(HUD_VISIBLE_CLASS);
  }

  function showFullscreenHud(stage, delay = HUD_FADE_MS) {
    if (!stage?.isConnected || !stageIsFullscreen(stage) || isIPhoneBrowser()) return;
    stage.setAttribute(HUD_MANAGED_ATTR, '1');
    stage.classList.add(HUD_VISIBLE_CLASS);
    clearHudFade();
    hudFadeTimer = setTimeout(() => {
      hudFadeTimer = null;
      hideFullscreenHud(stage);
    }, delay);
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

  function replayRoot(stage) {
    if (stage === pseudoFullscreenStage && pseudoHome?.root?.isConnected) return pseudoHome.root;
    return stage?.closest?.('.rp-career-replay') || null;
  }

  function allSourceMarkers(stage) {
    const root = replayRoot(stage);
    if (!root) return [];
    return [...root.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]')];
  }

  function sourceMarkers(stage) {
    return allSourceMarkers(stage).filter((marker) => !marker.hasAttribute('data-rp-career-audit-filter-hidden'));
  }

  function sourceFilter(stage) {
    return replayRoot(stage)?.querySelector('[data-rp-career-audit-filter]') || null;
  }

  function syncFullscreenFilter(stage, rail) {
    const select = rail?.querySelector(`[${FULLSCREEN_FILTER_ATTR}]`);
    if (!select) return;
    const source = sourceFilter(stage);

    if (!source) {
      if (!select.options.length) {
        const option = document.createElement('option');
        option.value = 'score';
        option.textContent = '🏀 SCORE';
        select.appendChild(option);
      }
      select.value = 'score';
      return;
    }

    const signature = [...source.options].map((option) => `${option.value}:${option.textContent}`).join('|');
    if (select.dataset.rpFilterSignature !== signature) {
      select.replaceChildren(...[...source.options].map((option) => {
        const clone = document.createElement('option');
        clone.value = option.value;
        clone.textContent = option.textContent;
        return clone;
      }));
      select.dataset.rpFilterSignature = signature;
    }
    select.value = source.value || 'score';
  }

  function ensureMarkerRail(stage) {
    if (!stage) return null;
    const allSources = allSourceMarkers(stage);
    let rail = stage.querySelector(`[${MARKER_RAIL_ATTR}]`);

    if (!allSources.length) {
      rail?.remove();
      return null;
    }

    if (!rail) {
      rail = document.createElement('div');
      rail.className = 'rp-career-replay-fullscreen-marker-rail';
      rail.setAttribute(MARKER_RAIL_ATTR, '1');
      rail.setAttribute('aria-label', 'Replay stamp timeline');
      rail.innerHTML = `
        <div class="rp-career-replay-fullscreen-filter-wrap">
          <select class="rp-career-replay-fullscreen-filter" ${FULLSCREEN_FILTER_ATTR}="1" aria-label="Choose which replay stamps are visible"></select>
        </div>
        <div class="rp-career-replay-fullscreen-marker-track"></div>`;
      stage.appendChild(rail);
    }

    syncFullscreenFilter(stage, rail);
    const track = rail.querySelector('.rp-career-replay-fullscreen-marker-track');
    if (!track) return rail;

    const visibleSources = sourceMarkers(stage);
    const wanted = new Set();
    visibleSources.forEach((source, visibleIndex) => {
      const replayStart = String(source.dataset.rpCareerReplayMarker || '0');
      const stamp = String(source.dataset.rpCareerMarkerStamp || '0');
      const kind = String(source.dataset.rpCareerAuditKind || 'score');
      const originalIndex = allSources.indexOf(source);
      const key = `${replayStart}:${stamp}:${kind}:${originalIndex >= 0 ? originalIndex : visibleIndex}`;
      wanted.add(key);

      let button = [...track.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)]
        .find((node) => node.dataset.rpFullscreenMarkerKey === key);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'rp-career-replay-fullscreen-marker';
        button.setAttribute(FULLSCREEN_MARKER_ATTR, '1');
        button.dataset.rpFullscreenMarkerKey = key;
        track.appendChild(button);
      }

      button.dataset.rpCareerReplayMarker = replayStart;
      button.dataset.rpCareerMarkerStamp = stamp;
      button.dataset.rpCareerAuditKind = kind;
      button.textContent = source.textContent || '•';
      button.setAttribute('aria-label', source.getAttribute('aria-label') || 'Jump to replay stamp');
      button.title = source.title || 'Jump to replay stamp';
      if (source.style.left) button.style.left = source.style.left;
      button.classList.toggle('active', source.classList.contains('active'));
    });

    [...track.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)].forEach((button) => {
      if (!wanted.has(button.dataset.rpFullscreenMarkerKey || '')) button.remove();
    });

    return rail;
  }

  function syncMarkerRail(stage) {
    if (!stage) return;
    const rail = ensureMarkerRail(stage);
    if (!rail) return;
    syncFullscreenFilter(stage, rail);

    const sources = sourceMarkers(stage);
    const clones = [...rail.querySelectorAll(`[${FULLSCREEN_MARKER_ATTR}]`)];
    clones.forEach((clone) => {
      const replayStart = String(clone.dataset.rpCareerReplayMarker || '0');
      const stamp = String(clone.dataset.rpCareerMarkerStamp || '0');
      const kind = String(clone.dataset.rpCareerAuditKind || 'score');
      const source = sources.find((candidate) =>
        String(candidate.dataset.rpCareerReplayMarker || '0') === replayStart
        && String(candidate.dataset.rpCareerMarkerStamp || '0') === stamp
        && String(candidate.dataset.rpCareerAuditKind || 'score') === kind
      );
      if (!source) return;
      if (source.style.left) clone.style.left = source.style.left;
      clone.textContent = source.textContent || clone.textContent || '•';
      clone.classList.toggle('active', source.classList.contains('active'));
    });
  }

  function stopMarkerSync() {
    if (markerSyncTimer) {
      clearInterval(markerSyncTimer);
      markerSyncTimer = null;
    }
    clearHudFade();
  }

  function startMarkerSync(stage) {
    stopMarkerSync();
    if (!stage) return;
    syncMarkerRail(stage);
    markerSyncTimer = setInterval(() => {
      if (!stageIsFullscreen(stage)) {
        stopMarkerSync();
        return;
      }
      syncMarkerRail(stage);
    }, 120);
  }

  function viewportSize() {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    return { width, height };
  }

  function mountPseudoStageAtBody(stage) {
    if (!stage || pseudoHome) return;
    const parent = stage.parentNode;
    if (!parent) return;
    const placeholder = document.createComment('real-play-pseudo-fullscreen-stage');
    const root = stage.closest('.rp-career-replay');
    parent.insertBefore(placeholder, stage);
    pseudoHome = { parent, placeholder, root };
    document.body.appendChild(stage);
  }

  function restorePseudoStage(stage) {
    const home = pseudoHome;
    if (!stage || !home) return;
    if (home.placeholder?.parentNode) {
      home.placeholder.parentNode.insertBefore(stage, home.placeholder);
      home.placeholder.remove();
    } else if (home.parent?.isConnected) {
      home.parent.appendChild(stage);
    }
    pseudoHome = null;
  }

  function clearForcedPseudoLayout(stage) {
    if (!stage) return;
    [
      'position','left','top','right','bottom','width','height','min-width','min-height',
      'max-width','max-height','margin','padding','transform'
    ].forEach((property) => stage.style.removeProperty(property));

    const media = stage.querySelector('[data-rp-career-replay-media]');
    const nodes = new Set([
      media,
      media?.firstElementChild,
      stage.querySelector('.rp-career-replay-yt-host'),
      ...stage.querySelectorAll('iframe,video'),
    ].filter(Boolean));
    nodes.forEach((node) => {
      [
        'position','inset','left','top','right','bottom','width','height','min-width','min-height',
        'max-width','max-height','margin','padding','border','transform','box-sizing','background'
      ].forEach((property) => node.style.removeProperty(property));
    });
  }

  function forcePseudoFullscreenLayout(stage) {
    if (!stage?.isConnected || !stage.classList.contains(PSEUDO_FULLSCREEN_CLASS)) return;
    const { width, height } = viewportSize();

    stage.style.setProperty('position', 'fixed', 'important');
    stage.style.setProperty('left', '0px', 'important');
    stage.style.setProperty('top', '0px', 'important');
    stage.style.setProperty('right', 'auto', 'important');
    stage.style.setProperty('bottom', 'auto', 'important');
    stage.style.setProperty('width', `${width}px`, 'important');
    stage.style.setProperty('height', `${height}px`, 'important');
    stage.style.setProperty('min-width', `${width}px`, 'important');
    stage.style.setProperty('min-height', `${height}px`, 'important');
    stage.style.setProperty('max-width', 'none', 'important');
    stage.style.setProperty('max-height', 'none', 'important');
    stage.style.setProperty('margin', '0', 'important');
    stage.style.setProperty('padding', '0', 'important');
    stage.style.setProperty('transform', 'none', 'important');

    const media = stage.querySelector('[data-rp-career-replay-media]');
    const nodes = new Set([
      media,
      media?.firstElementChild,
      stage.querySelector('.rp-career-replay-yt-host'),
      ...stage.querySelectorAll('iframe,video'),
    ].filter(Boolean));

    nodes.forEach((node) => {
      node.style.setProperty('position', 'absolute', 'important');
      node.style.setProperty('inset', '0', 'important');
      node.style.setProperty('left', '0', 'important');
      node.style.setProperty('top', '0', 'important');
      node.style.setProperty('right', '0', 'important');
      node.style.setProperty('bottom', '0', 'important');
      node.style.setProperty('width', '100%', 'important');
      node.style.setProperty('height', '100%', 'important');
      node.style.setProperty('min-width', '100%', 'important');
      node.style.setProperty('min-height', '100%', 'important');
      node.style.setProperty('max-width', 'none', 'important');
      node.style.setProperty('max-height', 'none', 'important');
      node.style.setProperty('margin', '0', 'important');
      node.style.setProperty('padding', '0', 'important');
      node.style.setProperty('border', '0', 'important');
      node.style.setProperty('transform', 'none', 'important');
      node.style.setProperty('box-sizing', 'border-box', 'important');
      node.style.setProperty('background', '#000', 'important');
    });

    stage.querySelectorAll('iframe').forEach((iframe) => {
      iframe.setAttribute('width', String(width));
      iframe.setAttribute('height', String(height));
    });
  }

  function schedulePseudoLayout(stage) {
    if (pseudoLayoutTimer) clearTimeout(pseudoLayoutTimer);
    window.requestAnimationFrame(() => {
      forcePseudoFullscreenLayout(stage);
      window.requestAnimationFrame(() => forcePseudoFullscreenLayout(stage));
    });
    pseudoLayoutTimer = setTimeout(() => {
      pseudoLayoutTimer = null;
      forcePseudoFullscreenLayout(stage);
    }, 180);
  }

  function enterPseudoFullscreen(stage) {
    if (!stage) return;
    if (pseudoFullscreenStage && pseudoFullscreenStage !== stage) exitPseudoFullscreen();

    pseudoFullscreenStage = stage;
    ensureBackButton(stage);
    mountPseudoStageAtBody(stage);
    stage.classList.add(PSEUDO_FULLSCREEN_CLASS);
    stage.setAttribute('data-rp-career-replay-pseudo-fullscreen', '1');
    if (!isIPhoneBrowser()) stage.setAttribute(HUD_MANAGED_ATTR, '1');
    document.documentElement.classList.add(PSEUDO_OPEN_CLASS);
    document.body.classList.add(PSEUDO_OPEN_CLASS);

    forcePseudoFullscreenLayout(stage);
    ensureMarkerRail(stage);
    startMarkerSync(stage);
    showFullscreenHud(stage);
    schedulePseudoLayout(stage);
  }

  function exitPseudoFullscreen() {
    const stage = pseudoFullscreenStage || document.querySelector(`.${PSEUDO_FULLSCREEN_CLASS}`);
    if (!stage) return;

    if (pseudoLayoutTimer) {
      clearTimeout(pseudoLayoutTimer);
      pseudoLayoutTimer = null;
    }
    stopMarkerSync();
    stage.classList.remove(PSEUDO_FULLSCREEN_CLASS, HUD_VISIBLE_CLASS);
    stage.removeAttribute('data-rp-career-replay-pseudo-fullscreen');
    stage.removeAttribute(HUD_MANAGED_ATTR);
    clearForcedPseudoLayout(stage);
    document.documentElement.classList.remove(PSEUDO_OPEN_CLASS);
    document.body.classList.remove(PSEUDO_OPEN_CLASS);
    restorePseudoStage(stage);
    pseudoFullscreenStage = null;
  }

  function shouldUsePseudoFullscreen(stage) {
    if (isIPhoneBrowser()) return false;
    return !hasNativeFullscreen(stage);
  }

  function placeReplayClock() {
    document.querySelectorAll('.rp-career-replay-gamehead').forEach((gamehead) => {
      const score = gamehead.querySelector('.rp-career-replay-score');
      const root = gamehead.closest('.rp-career-replay');
      const clock = root?.querySelector('[data-rp-career-replay-clock]');
      if (!score || !clock || clock.parentElement === gamehead) return;
      score.insertAdjacentElement('afterend', clock);
    });
  }

  function enhance() {
    if (pseudoFullscreenStage && !pseudoFullscreenStage.isConnected) {
      pseudoFullscreenStage = null;
      pseudoHome = null;
      stopMarkerSync();
    }
    document.querySelectorAll('[data-rp-career-replay-stage]').forEach(ensureBackButton);
    placeReplayClock();
  }

  document.addEventListener('click', async (event) => {
    const trigger = event.target?.closest?.(FULLSCREEN_TRIGGER_SELECTOR);
    if (!trigger) return;
    const stage = trigger.closest('[data-rp-career-replay-stage]');
    if (!stage || isIPhoneBrowser()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (stage.classList.contains(PSEUDO_FULLSCREEN_CLASS)) {
      exitPseudoFullscreen();
      return;
    }

    if (getFullscreenElement() === stage) {
      exitFullscreen();
      return;
    }

    if (!shouldUsePseudoFullscreen(stage)) {
      const entered = await enterNativeFullscreen(stage);
      if (entered) return;
    }

    enterPseudoFullscreen(stage);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    const stage = event.target?.closest?.('[data-rp-career-replay-stage]');
    if (!stage || !stageIsFullscreen(stage) || isIPhoneBrowser()) return;
    showFullscreenHud(stage);
  }, true);

  document.addEventListener('touchstart', (event) => {
    const stage = event.target?.closest?.('[data-rp-career-replay-stage]');
    if (!stage || !stageIsFullscreen(stage) || isIPhoneBrowser()) return;
    showFullscreenHud(stage);
  }, { capture: true, passive: true });

  document.addEventListener('change', (event) => {
    const select = event.target?.closest?.(`[${FULLSCREEN_FILTER_ATTR}]`);
    if (!select) return;
    const stage = select.closest('[data-rp-career-replay-stage]');
    const source = sourceFilter(stage);
    if (source) {
      source.value = select.value;
      source.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncMarkerRail(stage);
    showFullscreenHud(stage);
  }, true);

  document.addEventListener('focusin', (event) => {
    const select = event.target?.closest?.(`[${FULLSCREEN_FILTER_ATTR}]`);
    if (!select) return;
    const stage = select.closest('[data-rp-career-replay-stage]');
    if (!stage || isIPhoneBrowser()) return;
    clearHudFade();
    stage.setAttribute(HUD_MANAGED_ATTR, '1');
    stage.classList.add(HUD_VISIBLE_CLASS);
  }, true);

  document.addEventListener('focusout', (event) => {
    const select = event.target?.closest?.(`[${FULLSCREEN_FILTER_ATTR}]`);
    if (!select) return;
    const stage = select.closest('[data-rp-career-replay-stage]');
    showFullscreenHud(stage);
  }, true);

  document.addEventListener('click', (event) => {
    const marker = event.target?.closest?.(`[${FULLSCREEN_MARKER_ATTR}]`);
    if (!marker) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const stage = marker.closest('[data-rp-career-replay-stage]');
    const root = replayRoot(stage);
    if (!root) return;

    const replayStart = String(marker.dataset.rpCareerReplayMarker || '0');
    const stamp = String(marker.dataset.rpCareerMarkerStamp || '0');
    const kind = String(marker.dataset.rpCareerAuditKind || 'score');
    const original = [...root.querySelectorAll('[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker]')]
      .find((node) =>
        String(node.dataset.rpCareerReplayMarker || '0') === replayStart
        && String(node.dataset.rpCareerMarkerStamp || '0') === stamp
        && String(node.dataset.rpCareerAuditKind || 'score') === kind
      )
      || root.querySelector(`[data-rp-career-replay-timeline-markers] [data-rp-career-replay-marker="${replayStart}"]`);

    original?.click();
    showFullscreenHud(stage);
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
      if (!isIPhoneBrowser()) full.setAttribute(HUD_MANAGED_ATTR, '1');
      startMarkerSync(full);
      showFullscreenHud(full);
      lockLandscape();
    } else if (!pseudoFullscreenStage) {
      unlockOrientation();
      stopMarkerSync();
      document.querySelectorAll(`[${HUD_MANAGED_ATTR}]`).forEach((stage) => {
        stage.removeAttribute(HUD_MANAGED_ATTR);
        stage.classList.remove(HUD_VISIBLE_CLASS);
      });
      enhance();
    }
  };

  function refreshPseudoLayout() {
    if (!pseudoFullscreenStage?.classList?.contains(PSEUDO_FULLSCREEN_CLASS)) return;
    schedulePseudoLayout(pseudoFullscreenStage);
  }

  window.addEventListener('resize', refreshPseudoLayout, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(refreshPseudoLayout, 120), { passive: true });
  window.visualViewport?.addEventListener?.('resize', refreshPseudoLayout, { passive: true });

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