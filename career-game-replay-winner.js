(() => {
  if (window.__realPlayCareerReplayWinnerInstalled) return;
  window.__realPlayCareerReplayWinnerInstalled = true;

  let wasFinalScore = false;
  let showUntil = 0;

  function scoreNumbers(viewer) {
    const values = [...viewer.querySelectorAll('.rp-career-replay-score b')]
      .slice(0, 2)
      .map((node) => Number(String(node.textContent || '').trim()));
    return {
      west: Number.isFinite(values[0]) ? values[0] : 0,
      east: Number.isFinite(values[1]) ? values[1] : 0,
    };
  }

  function winnerFor(viewer) {
    const { west, east } = scoreNumbers(viewer);
    if (west === east) return null;
    return {
      team: west > east ? 'WEST' : 'EAST',
      west,
      east,
    };
  }

  function finalMarkerTime(viewer) {
    const markers = viewer.querySelectorAll('[data-rp-career-replay-marker]');
    const last = markers[markers.length - 1];
    const text = String(last?.querySelector('small')?.textContent || '').trim();
    return text.split('·')[0]?.trim() || '';
  }

  function activeScoreTime(pop) {
    const text = String(pop?.querySelector('[data-rp-career-score-detail]')?.textContent || '').trim();
    const parts = text.split('·');
    return parts.length ? parts[parts.length - 1].trim() : '';
  }

  function ensureBanner(stage) {
    let banner = stage.querySelector('[data-rp-career-final-winner]');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'rp-career-final-winner';
    banner.dataset.rpCareerFinalWinner = '1';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <small>FINAL SCORE</small>
      <strong data-rp-career-final-winner-team>WEST WINS</strong>
      <span data-rp-career-final-winner-score>0 — 0</span>`;
    stage.appendChild(banner);
    return banner;
  }

  function hideAll() {
    document.querySelectorAll('.rp-career-replay-score-pop.rp-career-final-score-suppressed')
      .forEach((node) => node.classList.remove('rp-career-final-score-suppressed'));
    document.querySelectorAll('[data-rp-career-final-winner].show')
      .forEach((node) => node.classList.remove('show'));
    wasFinalScore = false;
    showUntil = 0;
  }

  function sync() {
    const viewer = document.querySelector('[data-rp-career-replay].open');
    if (!viewer) {
      hideAll();
      return;
    }

    const stage = viewer.querySelector('[data-rp-career-replay-stage]');
    const pop = viewer.querySelector('[data-rp-career-score-pop]');
    if (!stage || !pop) return;

    const markerTime = finalMarkerTime(viewer);
    const scoreTime = activeScoreTime(pop);
    const isFinalScore = pop.classList.contains('show') && markerTime && scoreTime === markerTime;
    const winner = winnerFor(viewer);
    const banner = ensureBanner(stage);

    if (isFinalScore && winner) {
      pop.classList.add('rp-career-final-score-suppressed');
      const team = banner.querySelector('[data-rp-career-final-winner-team]');
      const score = banner.querySelector('[data-rp-career-final-winner-score]');
      if (team) team.textContent = `${winner.team} WINS`;
      if (score) score.textContent = `${winner.west} — ${winner.east}`;

      if (!wasFinalScore) showUntil = Date.now() + 3200;
      wasFinalScore = true;
    } else {
      pop.classList.remove('rp-career-final-score-suppressed');
      wasFinalScore = false;
    }

    if (winner && (isFinalScore || Date.now() < showUntil)) banner.classList.add('show');
    else banner.classList.remove('show');
  }

  const heartbeat = window.setInterval(sync, 100);
  window.addEventListener('pagehide', () => window.clearInterval(heartbeat), { once: true });
  document.addEventListener('fullscreenchange', sync);
  sync();
})();
