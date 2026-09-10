(() => {
  if (window.__realPlayWorldResultsInstalled) return;
  window.__realPlayWorldResultsInstalled = true;

  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  let panel = null;
  let timer = null;
  let loading = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function timeAgo(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    const diff = Math.max(0, Date.now() - date.getTime());
    if (diff < 60_000) return 'NOW';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}M AGO`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}H AGO`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}D AGO`;
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function resultMvpName(update) {
    const metadata = update?.metadata || {};
    const nested = [metadata.mvp, metadata.gameMvp, metadata.game_mvp, update?.mvp, update?.gameMvp, update?.game_mvp];
    const candidates = [
      metadata.mvpName,
      metadata.mvp_name,
      metadata.gameMvpName,
      metadata.game_mvp_name,
      metadata.mvpPlayerName,
      metadata.mvp_player_name,
      update?.mvpName,
      update?.mvp_name,
      ...nested.flatMap((value) => {
        if (typeof value === 'string') return [value];
        if (!value || typeof value !== 'object') return [];
        const player = value.player && typeof value.player === 'object' ? value.player : {};
        return [value.playerName, value.player_name, value.displayName, value.display_name, value.name, player.displayName, player.display_name, player.name];
      }),
    ];
    const match = candidates.find((value) => typeof value === 'string' && value.trim());
    return match ? match.trim() : '';
  }

  function sessionId(update) {
    const match = String(update?.id || '').match(/^career-(\d+)-result$/);
    const value = Number(match?.[1] || 0);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  }

  function openReplay(id) {
    if (!id) return;
    const bridge = document.createElement('button');
    bridge.type = 'button';
    bridge.hidden = true;
    bridge.dataset.rpCareerReplaySession = String(id);
    document.body.appendChild(bridge);
    bridge.click();
    setTimeout(() => bridge.remove(), 0);
  }

  function scoreBlock(update) {
    const west = Number(update?.metadata?.westScore);
    const east = Number(update?.metadata?.eastScore);
    if (!Number.isFinite(west) || !Number.isFinite(east)) return '';
    const westWinner = west > east;
    const eastWinner = east > west;
    return `
      <div class="rp-world-result-score">
        <div class="${westWinner ? 'winner' : ''}"><span>WEST</span><strong>${west}</strong></div>
        <i aria-hidden="true">—</i>
        <div class="${eastWinner ? 'winner' : ''}"><span>EAST</span><strong>${east}</strong></div>
      </div>`;
  }

  function renderResult(update) {
    const mvpName = resultMvpName(update);
    const location = String(update?.location_name || update?.locationName || '').trim();
    const publishedAt = update?.published_at || update?.publishedAt;
    const detail = [timeAgo(publishedAt), location ? location.toUpperCase() : ''].filter(Boolean).join(' · ');
    const replaySessionId = sessionId(update);
    const replayAttrs = replaySessionId
      ? ` role="button" tabindex="0" data-world-result-session="${replaySessionId}"`
      : '';
    return `
      <article class="rp-world-result-card${replaySessionId ? ' replay-ready' : ''}"${replayAttrs}>
        <header class="rp-world-result-head">
          <small>OFFICIAL RESULT</small>
          <span>${esc(detail || 'REAL PLAY BASKETBALL')}</span>
        </header>
        <h2>${esc(update?.title || 'REAL PLAY GAME')}</h2>
        ${scoreBlock(update)}
        ${mvpName ? `<div class="rp-world-result-mvp"><span>GAME MVP</span><strong>${esc(mvpName)}</strong></div>` : ''}
        <footer class="rp-world-result-footer">
          <span>FINALIZED GAME</span>
          <strong>${replaySessionId ? 'WATCH GAME →' : 'FINAL RESULT'}</strong>
        </footer>
      </article>`;
  }

  function ensurePanel() {
    panel = document.querySelector('[data-rp-world]');
    if (!panel) return false;
    const view = panel.querySelector('[data-world-view="world"]');
    if (!view) return false;

    if (!view.querySelector('[data-rp-world-results]')) {
      view.innerHTML = `
        <section class="rp-world-results" data-rp-world-results>
          <header class="rp-world-results-heading">
            <div><small>REAL PLAY BASKETBALL</small><h1>GAME RESULTS</h1></div>
            <span>FINALIZED GAMES</span>
          </header>
          <p class="rp-world-status" data-world-results-status aria-live="polite"></p>
          <div class="rp-world-results-list" data-world-results-list></div>
        </section>`;
    }
    return true;
  }

  function setStatus(message = '', error = false) {
    const node = panel?.querySelector('[data-world-results-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  async function refresh({ quiet = false } = {}) {
    if (loading || !ensurePanel()) return;
    loading = true;
    if (!quiet) setStatus('LOADING OFFICIAL RESULTS...');
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Could not load game results.');
      const results = (Array.isArray(data?.updates) ? data.updates : [])
        .filter((update) => update?.category === 'result')
        .sort((a, b) => Date.parse(b?.published_at || b?.publishedAt || 0) - Date.parse(a?.published_at || a?.publishedAt || 0));
      const root = panel.querySelector('[data-world-results-list]');
      if (root) {
        root.innerHTML = results.length
          ? results.map(renderResult).join('')
          : '<div class="rp-world-empty"><strong>NO FINALIZED GAMES YET.</strong><p>Official results will appear here automatically after games are finalized.</p></div>';
      }
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'Could not load game results.', true);
    } finally {
      loading = false;
    }
  }

  function activeWorldView() {
    const view = document.querySelector('[data-rp-world] [data-world-view="world"]');
    return Boolean(document.querySelector('[data-rp-world].open') && view && !view.hidden);
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!document.hidden && activeWorldView()) refresh({ quiet: true });
    }, 15000);
  }

  function install() {
    if (!ensurePanel()) return false;
    refresh();
    startTimer();

    panel.addEventListener('click', (event) => {
      const card = event.target.closest('[data-world-result-session]');
      if (!card || !panel.contains(card)) return;
      openReplay(Number(card.dataset.worldResultSession || 0));
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-world-result-session]');
      if (!card || !panel.contains(card)) return;
      event.preventDefault();
      openReplay(Number(card.dataset.worldResultSession || 0));
    });

    const observer = new MutationObserver(() => {
      if (!ensurePanel()) return;
      if (activeWorldView()) refresh({ quiet: true });
    });
    observer.observe(panel, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class'] });

    window.addEventListener('focus', () => { if (activeWorldView()) refresh({ quiet: true }); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && activeWorldView()) refresh({ quiet: true }); });
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RealPlayWorldResults = { refresh };
})();