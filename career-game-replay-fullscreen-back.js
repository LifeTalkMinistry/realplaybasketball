(() => {
  if (window.__realPlayReplayFullscreenBackInstalled) return;
  window.__realPlayReplayFullscreenBackInstalled = true;

  const BUTTON_ATTR = 'data-rp-career-replay-fullscreen-back';
  const TIMESTAMP_ATTR = 'data-rp-career-replay-fullscreen-timestamp';
  const TIMESTAMP_VALUE_ATTR = 'data-rp-career-replay-fullscreen-timestamp-value';
  const PSEUDO_FULLSCREEN_CLASS = 'rp-career-replay-pseudo-fullscreen';
  const PSEUDO_OPEN_CLASS = 'rp-career-replay-pseudo-fullscreen-open';
  const FULLSCREEN_TRIGGER_SELECTOR = '[data-rp-career-replay-fullscreen],[data-rp-career-replay-expand-fixed]';
  let timestampTimer = null;
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

    .rp-career-replay-fullscreen-timestamp{
      position:absolute;
      z-index:12;
      left:50%;
      bottom:max(14px,env(safe-area-inset-bottom));
      display:none;
      align-items:center;
      justify-content:center;
      gap:8px;
      min-height:42px;
      padding:0 16px;
      border:1px solid rgba(122,221,241,.34);
      border-radius:999px;
      background:rgba(2,12,19,.82);
      color:#f4fbff;
      box-shadow:0 8px 24px rgba(0,0,0,.32);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      transform:translateX(-50%);
      pointer-events:none;
      font-family:var(--rp-body,Arial,sans-serif);
      white-space:nowrap;
      font-variant-numeric:tabular-nums;
    }
    .rp-career-replay-fullscreen-timestamp .rp-fs-ball-icon{
      font-size:1rem;
      line-height:1;
    }
    .rp-career-replay-fullscreen-timestamp .rp-fs-ball-label{
      color:#a8c8d3;
      font-size:.58rem;
      font-weight:900;
      letter-spacing:.1em;
    }
    .rp-career-replay-fullscreen-timestamp strong{
      color:#fff;
      font-size:.82rem;
      font-weight:950;
      letter-spacing:.04em;
    }
    .rp-career-replay-stage:fullscreen .rp-career-replay-fullscreen-timestamp,
    .rp-career-replay-stage:-webkit-full-screen .rp-career-replay-fullscreen-timestamp,
    .rp-career-replay-stage.${PSEUDO_FULLSCREEN_CLASS} .rp-career-replay-fullscreen-timestamp{
      display:flex;
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

    /* Keep the live playback timestamp directly beneath the official score. */
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
      .rp-career-replay-fullscreen-timestamp{
        min-height:40px;
        padding:0 12px;
        gap:6px;
      }
      .rp-career-replay-fullscreen-timestamp .rp-fs-ball-label{
        font-size:.52rem;
      }
      .rp-career-replay-fullscreen-timestamp strong{
        font-size:.75rem;
      }
      .rp-career-replay-controls{
        grid-template-columns:38px minmax(0,1fr) 38px 38px!important;
      }
      .rp-career-replay-gamehead .rp-career-replay-clock{
        grid-column:1/-1;
        grid-row:2;
      }
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

  function currentPlaybackText(stage) {
    const replayRoot = stage?.closest?.('.rp-career-replay');
    const clock = replayRoot?.querySelector('[data-rp-career-replay-clock]');
    const raw = String(clock?.textContent || '').trim();
    if (!raw) return '0:00';
    return raw.split('/')[0].trim() || '0:00';
  }

  function syncFullscreenTimestamp(stage) {
    if (!stage) return;
    const value = stage.querySelector(`[${TIMESTAMP_VALUE_ATTR}]`);
    if (value) value.textContent = currentPlaybackText(stage);
  }

  function ensureFullscreenTimestamp(stage) {
    if (!stage) return;
    let timestamp = stage.querySelector(`[${TIMESTAMP_ATTR}]`);
    if (!timestamp) {
      timestamp = document.createElement('div');
      timestamp.className = 'rp-career-replay-fullscreen-timestamp';
      timestamp.setAttribute(TIMESTAMP_ATTR, '1');
      timestamp.setAttribute('aria-live', 'off');
      timestamp.innerHTML = `<span class="rp-fs-ball-icon" aria-hidden="true">🏀</span><span class="rp-fs-ball-label">BALL TIMESTAMP</span><strong ${TIMESTAMP_VALUE_ATTR}>0:00</strong>`;
      stage.appendChild(timestamp);
    }
    syncFullscreenTimestamp(stage);
  }

  function stopTimestampSync() {
    if (!timestampTimer) return;
    clearInterval(timestampTimer);
    timestampTimer = null;
  }

  function stageIsFullscreen(stage) {
    return getFullscreenElement() === stage || stage?.classList?.contains(PSEUDO_FULLSCREEN_CLASS);
  }

  function startTimestampSync(stage) {
    stopTimestampSync();
    if (!stage) return;
    ensureFullscreenTimestamp(stage);
    syncFullscreenTimestamp(stage);
    timestampTimer = setInterval(() => {
      if (!stageIsFullscreen(stage)) {
        stopTimestampSync();
        return;
      }
      syncFullscreenTimestamp(stage);
    }, 100);
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

  function enterPseudoFullscreen(stage) {
    if (!stage) return;
    if (pseudoFullscreenStage && pseudoFullscreenStage !== stage) exitPseudoFullscreen();
    pseudoFullscreenStage = stage;
    ensureBackButton(stage);
    ensureFullscreenTimestamp(stage);
    stage.classList.add(PSEUDO_FULLSCREEN_CLASS);
    stage.setAttribute('data-rp-career-replay-pseudo-fullscreen', '1');
    document.documentElement.classList.add(PSEUDO_OPEN_CLASS);
    document.body.classList.add(PSEUDO_OPEN_CLASS);
    startTimestampSync(stage);
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
    stopTimestampSync();
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
    document.querySelectorAll('[data-rp-career-replay-stage]').forEach((stage) => {
      ensureBackButton(stage);
      ensureFullscreenTimestamp(stage);
    });
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
      startTimestampSync(full);
    } else if (!pseudoFullscreenStage) {
      stopTimestampSync();
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