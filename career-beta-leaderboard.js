(() => {
  if (window.__realPlayBetaLeaderboardInstalledV2) return;
  window.__realPlayBetaLeaderboardInstalledV2 = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const categories = [
    { key: 'pts', label: 'PTS' },
    { key: 'ast', label: 'AST' },
    { key: 'reb', label: 'REB' },
    { key: 'wins', label: 'WINS' },
  ];

  let activeKey = 'pts';
  let leaderboards = { pts: [], ast: [], reb: [], wins: [] };
  let refreshing = false;
  let mountedRoot = null;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function panel() {
    return document.querySelector('[data-rp-career-beta]');
  }

  function currentName(root) {
    return String(root.querySelector('[data-career-name]')?.textContent || '').trim().toLowerCase();
  }

  function normalizeRows(rows, key) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({
      ...row,
      rank: Number(row.rank || index + 1),
      value: Number(row.value ?? row[key] ?? row.points ?? 0),
      playerName: row.playerName || row.player_name || row.name || 'PLAYER',
    }));
  }

  function render() {
    const root = mountedRoot || panel();
    if (!root) return;
    const host = root.querySelector('[data-career-board]');
    const rankNode = root.querySelector('[data-career-rank]');
    if (!host) return;

    const config = categories.find((item) => item.key === activeKey) || categories[0];
    const rows = normalizeRows(leaderboards[activeKey], activeKey);
    const me = currentName(root);

    root.querySelectorAll('.rp-board-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.boardStat === activeKey);
      tab.disabled = false;
    });

    if (!rows.length) {
      host.innerHTML = '<div class="rp-empty-career"><strong>THE BOARD STARTS WITH THE FIRST FINAL GAME.</strong><p>Finalized Career results will automatically build this Beta leaderboard.</p></div>';
      if (rankNode) rankNode.textContent = `${config.label} RANK —`;
      return;
    }

    host.innerHTML = rows.slice(0, 10).map((row) => {
      const mine = String(row.playerName).trim().toLowerCase() === me;
      return `<article class="rp-board-row"><em>#${esc(row.rank)}</em><strong>${esc(row.playerName)}${mine ? ' · YOU' : ''}</strong><span>${esc(row.value)} ${esc(config.label)}</span></article>`;
    }).join('');

    const mine = rows.find((row) => String(row.playerName).trim().toLowerCase() === me);
    if (rankNode) rankNode.textContent = mine ? `${config.label} RANK #${mine.rank}` : `${config.label} RANK —`;
  }

  function setupTabs(root) {
    const tabs = [...root.querySelectorAll('.rp-board-tab')];
    if (tabs.length < 4) return false;

    tabs.slice(0, 4).forEach((tab, index) => {
      const config = categories[index];
      tab.textContent = config.label;
      tab.dataset.boardStat = config.key;
      tab.disabled = false;
      tab.classList.toggle('active', config.key === activeKey);
      if (tab.dataset.boardReady === 'true') return;
      tab.dataset.boardReady = 'true';
      tab.addEventListener('click', () => {
        activeKey = config.key;
        render();
      });
    });
    return true;
  }

  async function refresh() {
    const root = mountedRoot || panel();
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!root || !root.classList.contains('open') || !token || refreshing) return;

    refreshing = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const state = await response.json().catch(() => ({}));
      const next = state?.leaderboards || {};
      leaderboards = {
        pts: Array.isArray(next.pts) ? next.pts : (Array.isArray(state?.leaderboard) ? state.leaderboard : []),
        ast: Array.isArray(next.ast) ? next.ast : [],
        reb: Array.isArray(next.reb) ? next.reb : [],
        wins: Array.isArray(next.wins) ? next.wins : [],
      };
      render();
    } catch (_error) {
      // Keep Career responsive if the leaderboard request fails.
    } finally {
      refreshing = false;
    }
  }

  function mount(root) {
    if (!root || mountedRoot === root) return Boolean(root);
    if (!setupTabs(root)) return false;
    mountedRoot = root;
    render();

    // Watch ONLY the Career panel's own open/closed state. Do not observe the
    // whole document or descendant class changes; that created a render/fetch loop.
    const stateObserver = new MutationObserver(() => {
      if (root.classList.contains('open')) refresh();
    });
    stateObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

    if (root.classList.contains('open')) refresh();
    return true;
  }

  function boot() {
    const existing = panel();
    if (existing && mount(existing)) return;

    // Observe only until Career is inserted, then disconnect permanently.
    const mountObserver = new MutationObserver(() => {
      const root = panel();
      if (!root || !mount(root)) return;
      mountObserver.disconnect();
    });
    mountObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-select-mode="Career Mode"], [data-rp-nav="career"]')) return;
    window.setTimeout(refresh, 80);
  }, true);

  window.addEventListener('focus', () => {
    if (mountedRoot?.classList.contains('open')) refresh();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
