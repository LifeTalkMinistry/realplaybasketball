(() => {
  if (window.__realPlayReplayMarkerCleanupInstalled) return;
  window.__realPlayReplayMarkerCleanupInstalled = true;

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-score-pop{
      left:auto!important;
      right:10px!important;
      bottom:10px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:0!important;
      width:auto!important;
      max-width:calc(100% - 20px)!important;
      min-height:30px;
      padding:6px 9px!important;
      border:1px solid rgba(94,226,247,.28)!important;
      border-radius:9px!important;
      background:linear-gradient(105deg,rgba(3,18,27,.9),rgba(5,35,47,.86))!important;
      box-shadow:0 8px 24px rgba(0,0,0,.3)!important;
      backdrop-filter:blur(9px)!important;
      -webkit-backdrop-filter:blur(9px)!important;
      transform:translateY(6px)!important;
      box-sizing:border-box;
    }
    .rp-career-replay-score-pop.show{
      transform:translateY(0)!important;
    }
    .rp-career-replay-score-pop>small{
      display:none!important;
    }
    .rp-career-replay-score-pop>div{
      display:contents!important;
    }
    .rp-career-replay-score-pop [data-rp-career-score-detail]{
      order:1;
      margin:0!important;
      color:#70dfee!important;
      font-size:.5rem!important;
      font-weight:950!important;
      line-height:1!important;
      letter-spacing:.08em!important;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-score-pop [data-rp-career-score-detail]::after{
      content:' · ';
      margin:0 .28rem;
      color:#6f8f9c;
    }
    .rp-career-replay-score-pop [data-rp-career-score-name]{
      order:2;
      min-width:0;
      max-width:190px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:#f4fbff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.72rem!important;
      font-style:italic!important;
      font-weight:950!important;
      line-height:1!important;
    }
    .rp-career-replay-score-pop [data-rp-career-score-name]::after{
      content:' · ';
      margin:0 .28rem;
      color:#6f8f9c;
      font-style:normal;
    }
    .rp-career-replay-score-pop [data-rp-career-score-value]{
      order:3;
      grid-column:auto!important;
      grid-row:auto!important;
      color:#7cf2d0!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.82rem!important;
      font-style:italic!important;
      font-weight:950!important;
      line-height:1!important;
      white-space:nowrap;
    }
    @media(max-width:620px){
      .rp-career-replay-score-pop{
        right:8px!important;
        bottom:8px!important;
        max-width:calc(100% - 16px)!important;
        min-height:28px;
        padding:5px 8px!important;
        border-radius:8px!important;
      }
      .rp-career-replay-score-pop [data-rp-career-score-detail]{font-size:.46rem!important}
      .rp-career-replay-score-pop [data-rp-career-score-name]{max-width:165px;font-size:.66rem!important}
      .rp-career-replay-score-pop [data-rp-career-score-value]{font-size:.76rem!important}
    }
  `;
  document.head.appendChild(style);

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function cleanMarker(marker) {
    if (!marker) return;
    const timestamp = marker.querySelector('small');
    if (!timestamp) return;
    const clean = formatTime(Number(marker.dataset.rpCareerReplayMarker || 0));
    if (timestamp.textContent !== clean) timestamp.textContent = clean;
  }

  function cleanMarkers(root = document) {
    root.querySelectorAll?.('[data-rp-career-replay-marker]').forEach(cleanMarker);
  }

  function cleanScorePop(pop) {
    if (!pop) return;
    const detail = pop.querySelector('[data-rp-career-score-detail]');
    if (!detail) return;
    const team = String(detail.textContent || '').split('·')[0].trim().toUpperCase();
    if (team && detail.textContent !== team) detail.textContent = team;
  }

  function cleanScorePops(root = document) {
    if (root.matches?.('[data-rp-career-score-pop]')) cleanScorePop(root);
    root.querySelectorAll?.('[data-rp-career-score-pop]').forEach(cleanScorePop);
  }

  function cleanReplayUi(root = document) {
    cleanMarkers(root);
    cleanScorePops(root);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) cleanReplayUi(mutation.target);
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        cleanReplayUi(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanReplayUi(), { once: true });
  } else {
    cleanReplayUi();
  }
})();
