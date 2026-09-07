(() => {
  if (window.__realPlayRecordedAssistLinkInstalled) return;
  window.__realPlayRecordedAssistLinkInstalled = true;

  const MAX_PLAYHEAD_DRIFT_MS = 2500;
  let pendingMadeBasket = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function screen() {
    return root()?.querySelector('[data-admin-body] .rp-video-scoring-screen') || null;
  }

  function activePlayer() {
    const button = screen()?.querySelector('.rp-video-score-player.active[data-rp-video-select-player]');
    if (!button) return null;
    const playerId = Number(button.dataset.rpVideoSelectPlayer || 0);
    if (!Number.isSafeInteger(playerId) || playerId === 0) return null;
    const team = String(button.closest('.rp-video-score-team')?.querySelector('.rp-video-score-team-head strong')?.textContent || '')
      .trim().toLowerCase();
    return { playerId, team: ['west', 'east'].includes(team) ? team : null };
  }

  function media() {
    return screen()?.querySelector('[data-rp-recorded-video]') || null;
  }

  function timestampMs() {
    const player = media();
    const seconds = Number(player?.currentTime);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

    const value = String(screen()?.querySelector('[data-rp-video-time]')?.textContent || '').trim();
    const parts = value.split(':').map(Number);
    if (!value || parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
    return Math.round(parts[0] * 1000);
  }

  function clearPending() {
    pendingMadeBasket = null;
  }

  function rememberMadeBasket() {
    const player = activePlayer();
    const stamp = timestampMs();
    pendingMadeBasket = player && stamp !== null
      ? { ...player, videoTimestampMs: stamp }
      : null;
  }

  function lockAssistTimestamp() {
    const pending = pendingMadeBasket;
    const assister = activePlayer();
    const player = media();
    const now = timestampMs();
    clearPending();

    if (!pending || !assister || !player || now === null) return;
    if (assister.playerId === pending.playerId) return;
    if (pending.team && assister.team && pending.team !== assister.team) return;
    if (Math.abs(now - pending.videoTimestampMs) > MAX_PLAYHEAD_DRIFT_MS) return;

    const liveSeconds = Number(player.currentTime);
    const restoreSeconds = Number.isFinite(liveSeconds) ? liveSeconds : null;
    const wasPaused = Boolean(player.paused);

    // This listener is registered before the draft scorer. Move the playback
    // proxy to the basket moment for this one synchronous click so the draft's
    // normal videoTimestamp() records AST at the exact same timestamp as MAKE.
    // Restore the viewer immediately after the event dispatch completes.
    try {
      player.currentTime = pending.videoTimestampMs / 1000;
    } catch (_) {
      return;
    }

    queueMicrotask(() => {
      if (!player.isConnected || restoreSeconds === null) return;
      try { player.currentTime = restoreSeconds; } catch (_) {}
      if (!wasPaused) {
        try { player.play?.().catch?.(() => {}); } catch (_) {}
      }
    });
  }

  document.addEventListener('click', (event) => {
    const scoring = screen();
    if (!scoring || scoring.hasAttribute('data-rp-replay-correction-mode') || !scoring.contains(event.target)) return;

    const shot = event.target.closest('[data-rp-video-shot]');
    if (shot) {
      const result = String(shot.dataset.result || '').toLowerCase();
      if (result === 'make') rememberMadeBasket();
      else clearPending();
      return;
    }

    const stat = event.target.closest('[data-rp-video-stat]');
    if (stat) {
      const key = String(stat.dataset.rpVideoStat || '').toLowerCase();
      if (['ast', 'assist', 'assists'].includes(key)) lockAssistTimestamp();
      else clearPending();
      return;
    }

    if (event.target.closest('[data-rp-video-undo], [data-rp-draft-remove-shot], [data-rp-draft-remove-stat], [data-rp-video-finish]')) {
      clearPending();
    }
  }, true);

  window.addEventListener('realplay:admin-render', () => {
    if (!screen()) clearPending();
  });
})();
