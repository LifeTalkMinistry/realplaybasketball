(() => {
  if (window.__realPlayBetaLeaderboardInstalled) return;
  window.__realPlayBetaLeaderboardInstalled = true;

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
    const root = panel();
    if (!root) return;
    const host = root.querySelector('[data-career-board]');
    const rankNode = root.querySelector('[data-career-rank]');
    if (!host) return;

    const config = categories.find((item) => item.key === activeKey) || categories[0];
    const rows = normalizeRows(leaderboards[activeKey], activeKey);
    const me = currentName(root);

    root.querySelectorAll('.rp-board-tab').forEach((tab) => {
      const key = tab.dataset.boardStat;
      tab.classList.toggle('active', key === activeKey);
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

  function setupTabs() {
    const root = panel();
    if (!root) return false;
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
    const root = panel();
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!root || !token || refreshing) return;
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
      // Career screen remains usable even if a leaderboard refresh fails.
    } finally {
      refreshing = false;
    }
  }

  function mount() {
    if (!setupTabs()) return false;
    render();
    refresh();
    return true;
  }

  const observer = new MutationObserver(() => {
    const root = panel();
    if (!root) return;
    mount();
    if (root.classList.contains('open')) refresh();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-select-mode="Career Mode"], [data-rp-nav="career"]')) {
      window.setTimeout(refresh, 100);
    }
  }, true);

  window.addEventListener('focus', refresh);
  window.setInterval(() => {
    const root = panel();
    if (root?.classList.contains('open')) refresh();
  }, 5000);

  mount();
})();
