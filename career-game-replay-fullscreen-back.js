(() => {
  if (window.__realPlayReplayFullscreenBackInstalled) return;
  window.__realPlayReplayFullscreenBackInstalled = true;

  const BUTTON_ATTR = 'data-rp-career-replay-fullscreen-back';

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
    .rp-career-replay-stage:-webkit-full-screen .rp-career-replay-fullscreen-back{
      display:flex;
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

  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen().catch?.(() => {});
    if (document.webkitExitFullscreen) {
      try { document.webkitExitFullscreen(); } catch (_) {}
    }
    return undefined;
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
    document.querySelectorAll('[data-rp-career-replay-stage]').forEach(ensureBackButton);
    placeReplayClock();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest(`[${BUTTON_ATTR}]`);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    exitFullscreen();
  }, true);

  const onFullscreenChange = () => {
    const full = getFullscreenElement();
    if (full?.matches?.('[data-rp-career-replay-stage]')) ensureBackButton(full);
    else enhance();
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