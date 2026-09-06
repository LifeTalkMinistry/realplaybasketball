(() => {
  if (window.__realPlayWorldPlayerFiltersInstalled) return;
  window.__realPlayWorldPlayerFiltersInstalled = true;

  let panel = null;
  let controls = null;
  let list = null;
  let listObserver = null;
  let sortKey = 'name';
  const directions = { ovr: 'desc', name: 'asc', jersey: 'asc' };
  let scheduled = false;

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-filter-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerFilterStyles = '1';
    style.textContent = `
      .rp-world-player-sort{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:2px 0 1px}
      .rp-world-player-sort button{min-width:0;min-height:36px;padding:0 8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;color:#64758a;background:#060b12;font-family:var(--rp-display,Arial,sans-serif);font-size:.5rem;font-weight:950;letter-spacing:.075em;white-space:nowrap}
      .rp-world-player-sort button.active{color:#dff9ff;border-color:rgba(54,205,255,.25);background:rgba(24,111,164,.11)}
      .rp-world-player-sort button.active b{color:#49d8ff}
      .rp-world-player-sort button:focus-visible{outline:2px solid rgba(72,215,255,.65);outline-offset:2px}
      .rp-world-player-sort b{margin-left:3px;color:#52667b;font-size:.55rem}
      @media(max-width:360px){.rp-world-player-sort{gap:5px}.rp-world-player-sort button{padding-inline:5px;font-size:.46rem;letter-spacing:.055em}}
    `;
    document.head.appendChild(style);
  }

  function rowMeta(row) {
    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || '').trim();
    const jerseyText = String(row.querySelector('.rp-world-player-name b')?.textContent || '').trim();
    const jerseyMatch = jerseyText.match(/#\s*(\d{1,2})/);
    const jersey = jerseyMatch ? Number(jerseyMatch[1]) : null;
    const ovrNode = row.querySelector('.rp-world-player-ovr');
    const ovr = !ovrNode || ovrNode.classList.contains('unranked')
      ? null
      : Number.parseFloat(String(ovrNode.textContent || '').replace(/[^0-9.\-]/g, ''));
    return {
      row,
      name,
      jersey: Number.isFinite(jersey) ? jersey : null,
      ovr: Number.isFinite(ovr) ? ovr : null,
    };
  }

  function compareName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  }

  function compareNullableNumber(a, b, key, direction) {
    const av = a[key];
    const bv = b[key];
    const aMissing = av === null || av === undefined;
    const bMissing = bv === null || bv === undefined;
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (aMissing && bMissing) return compareName(a, b);
    if (av === bv) return compareName(a, b);
    return direction === 'asc' ? av - bv : bv - av;
  }

  function sortedRows() {
    if (!list) return [];
    const rows = [...list.querySelectorAll('.rp-world-player-row')].map(rowMeta);
    const direction = directions[sortKey];
    rows.sort((a, b) => {
      if (sortKey === 'ovr') return compareNullableNumber(a, b, 'ovr', direction);
      if (sortKey === 'jersey') return compareNullableNumber(a, b, 'jersey', direction);
      const result = compareName(a, b);
      return direction === 'asc' ? result : -result;
    });
    return rows.map((item) => item.row);
  }

  function applySort() {
    scheduled = false;
    if (!list) return;
    const next = sortedRows();
    if (!next.length) return;
    const current = [...list.querySelectorAll('.rp-world-player-row')];
    const alreadySorted = current.length === next.length && current.every((row, index) => row === next[index]);
    if (alreadySorted) return;
    const fragment = document.createDocumentFragment();
    next.forEach((row) => fragment.appendChild(row));
    list.appendChild(fragment);
  }

  function scheduleSort() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applySort);
  }

  function directionArrow(key) {
    if (key !== sortKey) return '';
    return directions[key] === 'asc' ? '↑' : '↓';
  }

  function renderControls() {
    if (!controls) return;
    controls.querySelectorAll('[data-player-sort]').forEach((button) => {
      const key = button.dataset.playerSort;
      const active = key === sortKey;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const arrow = button.querySelector('b');
      if (arrow) arrow.textContent = directionArrow(key);
    });
  }

  function selectSort(key) {
    if (!['ovr', 'name', 'jersey'].includes(key)) return;
    if (sortKey === key) {
      directions[key] = directions[key] === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
    }
    renderControls();
    scheduleSort();
  }

  function install() {
    panel = document.querySelector('[data-rp-world]');
    if (!panel) return false;
    const playersView = panel.querySelector('[data-world-view="players"]');
    list = playersView?.querySelector('[data-world-player-list]') || null;
    const status = playersView?.querySelector('[data-world-player-status]') || null;
    if (!playersView || !list || !status) return false;

    controls = playersView.querySelector('[data-world-player-sort]');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'rp-world-player-sort';
      controls.dataset.worldPlayerSort = 'true';
      controls.setAttribute('aria-label', 'Sort players');
      controls.innerHTML = `
        <button type="button" data-player-sort="ovr" aria-pressed="false">OVR / RANK <b></b></button>
        <button type="button" data-player-sort="name" aria-pressed="true">NAME <b></b></button>
        <button type="button" data-player-sort="jersey" aria-pressed="false">JERSEY # <b></b></button>`;
      status.insertAdjacentElement('beforebegin', controls);
      controls.addEventListener('click', (event) => {
        const button = event.target.closest('[data-player-sort]');
        if (!button) return;
        selectSort(button.dataset.playerSort);
      });
    }

    renderControls();
    if (listObserver) listObserver.disconnect();
    listObserver = new MutationObserver(() => scheduleSort());
    listObserver.observe(list, { childList: true });
    scheduleSort();
    return true;
  }

  installStyles();
  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
