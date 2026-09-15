(() => {
  if (window.__realPlayWorldPlayerBarVectorInstalled) return;
  window.__realPlayWorldPlayerBarVectorInstalled = true;

  const FILTER_ATTRIBUTE = 'data-rp-player-bar-filter';

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[char]));

  function dataUrl(svg) {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function makeBar({ accent, accent2, edge, core, deep, glow }) {
    const a = esc(accent);
    const b = esc(accent2);
    const e = esc(edge);
    const c = esc(core);
    const d = esc(deep);
    const g = esc(glow || accent);

    return dataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${d}"/>
            <stop offset=".18" stop-color="${c}"/>
            <stop offset=".52" stop-color="${b}" stop-opacity=".36"/>
            <stop offset=".82" stop-color="${c}"/>
            <stop offset="1" stop-color="${d}"/>
          </linearGradient>
          <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${e}" stop-opacity=".22"/>
            <stop offset=".16" stop-color="${a}"/>
            <stop offset=".56" stop-color="${e}" stop-opacity=".86"/>
            <stop offset=".86" stop-color="${a}"/>
            <stop offset="1" stop-color="${e}" stop-opacity=".22"/>
          </linearGradient>
          <radialGradient id="badge" cx="50%" cy="50%" r="55%">
            <stop offset="0" stop-color="${g}" stop-opacity=".20"/>
            <stop offset="1" stop-color="${g}" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <path d="M18 70 43 28 128 17 160 24 835 24 930 18 982 40 969 70 982 100 930 122 835 116 160 116 128 123 43 112Z"
          fill="url(#body)" stroke="${a}" stroke-opacity=".68" stroke-width="3"/>
        <path d="M31 70 53 38 137 28 166 34 831 34 928 29 967 45 957 70 967 95 928 111 831 106 166 106 137 112 53 102Z"
          fill="none" stroke="url(#rail)" stroke-width="2.4"/>

        <path d="M22 70 46 31 118 21 151 31 134 70 151 109 118 119 46 109Z"
          fill="${b}" fill-opacity=".42" stroke="${e}" stroke-opacity=".55" stroke-width="2.2"/>
        <path d="M43 70 58 43 112 35 132 42 120 70 132 98 112 105 58 97Z"
          fill="${d}" fill-opacity=".92" stroke="${a}" stroke-opacity=".82" stroke-width="2"/>
        <path d="M26 70 45 43 52 70 45 97Z" fill="${e}" fill-opacity=".32"/>

        <rect x="167" y="38" width="722" height="64" rx="11" fill="${d}" fill-opacity=".26"/>
        <path d="M171 50H872" stroke="url(#rail)" stroke-width="2.4"/>
        <path d="M171 91H885" stroke="${a}" stroke-opacity=".62" stroke-width="1.8"/>
        <path d="M194 69H815" stroke="${e}" stroke-opacity=".14" stroke-width="1"/>

        <ellipse cx="748" cy="70" rx="132" ry="44" fill="url(#badge)"/>
        <path d="M635 41 654 34H826L852 45" fill="none" stroke="${e}" stroke-opacity=".17" stroke-width="1.4"/>
        <path d="M635 99 654 106H826L852 95" fill="none" stroke="${a}" stroke-opacity=".20" stroke-width="1.4"/>

        <path d="M928 29 968 45 957 70 968 95 928 111 944 83 937 70 944 57Z"
          fill="${b}" fill-opacity=".38" stroke="${e}" stroke-opacity=".35" stroke-width="1.5"/>
        <path d="M948 48 968 57 962 70 968 83 948 92 955 70Z" fill="${e}" fill-opacity=".24"/>
      </svg>
    `);
  }

  const bars = Object.freeze({
    most_overall_mvp: makeBar({ accent:'#f3ab00', accent2:'#7f4a00', edge:'#fff0a0', core:'#241704', deep:'#050401', glow:'#ffc53a' }),
    most_team_mvp: makeBar({ accent:'#4fbfff', accent2:'#164f9d', edge:'#d8f3ff', core:'#081522', deep:'#01050a', glow:'#6dbdff' }),
    best_shooting: makeBar({ accent:'#45e9ff', accent2:'#087b9c', edge:'#d8fcff', core:'#061923', deep:'#010609', glow:'#44e8ff' }),
    best_rebounder: makeBar({ accent:'#4b91ff', accent2:'#1e4a9b', edge:'#d8e8ff', core:'#071225', deep:'#01050b', glow:'#5b8dff' }),
    captain_eligible: makeBar({ accent:'#20c7ff', accent2:'#064da6', edge:'#c9f3ff', core:'#061522', deep:'#01050a', glow:'#2aa9ff' }),
  });

  window.RealPlayWorldPlayerBarVector = Object.freeze({
    bars,
    get(type) {
      return bars[String(type || '').trim().toLowerCase()] || '';
    },
  });

  function activeFilterKey() {
    const active = document.querySelector('.rp-world-player-sort [data-player-sort].active');
    return String(active?.dataset?.playerSort || 'ranked').trim().toLowerCase();
  }

  function syncFilter() {
    document.documentElement.setAttribute(FILTER_ATTRIBUTE, activeFilterKey());
  }

  function vectorForRow(row) {
    return bars[String(row?.dataset?.recognitionType || '').trim().toLowerCase()] || '';
  }

  function applyVectorAuthority(root = document) {
    const rows = [];
    if (root instanceof HTMLElement && root.matches('.rp-world-player-row[data-recognition-type]')) rows.push(root);
    root.querySelectorAll?.('.rp-world-player-row[data-recognition-type]').forEach((row) => rows.push(row));

    rows.forEach((row) => {
      const vector = vectorForRow(row);
      if (!vector) return;
      const value = `url("${vector}")`;
      if (row.style.getPropertyValue('--rp-recognition-bar') === value && row.style.getPropertyPriority('--rp-recognition-bar') === 'important') return;
      row.style.setProperty('--rp-recognition-bar', value, 'important');
    });
  }

  const style = document.createElement('style');
  style.dataset.rpWorldPlayerBarVector = '1';
  style.textContent = `
    .rp-world-player-row[data-recognition-type="most_overall_mvp"]{--rp-recognition-bar:url("${bars.most_overall_mvp}")!important}
    .rp-world-player-row[data-recognition-type="most_team_mvp"]{--rp-recognition-bar:url("${bars.most_team_mvp}")!important}
    .rp-world-player-row[data-recognition-type="best_shooting"]{--rp-recognition-bar:url("${bars.best_shooting}")!important}
    .rp-world-player-row[data-recognition-type="best_rebounder"]{--rp-recognition-bar:url("${bars.best_rebounder}")!important}
    .rp-world-player-row[data-recognition-type="captain_eligible"]{--rp-recognition-bar:url("${bars.captain_eligible}")!important}

    .rp-world-player-row.rp-recognition-themed{
      --rp-featured-badge-x:75%;
      --rp-featured-badge-y:42%;
      --rp-featured-badge-width:23.5%;
    }
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge{
      left:var(--rp-featured-badge-x)!important;
      right:auto!important;
      top:var(--rp-featured-badge-y)!important;
      width:var(--rp-featured-badge-width)!important;
      height:auto!important;
      aspect-ratio:9/4;
      transform:translate(-50%,-50%)!important;
      transform-origin:center center!important;
    }
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:hover{transform:translate(-50%,-50%) scale(1.055)!important}
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:active{transform:translate(-50%,-50%) scale(.97)!important}
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-count{right:4px!important;top:-8px!important;bottom:auto!important}
    @media(max-width:420px){.rp-world-player-row.rp-recognition-themed .rp-player-featured-count{right:3px!important;top:-7px!important;bottom:auto!important}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-player-sort]')) requestAnimationFrame(() => {
      syncFilter();
      applyVectorAuthority();
    });
  });

  const observer = new MutationObserver((mutations) => {
    let shouldSync = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) applyVectorAuthority(node);
        });
      } else if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        if (mutation.target.matches('.rp-world-player-row')) applyVectorAuthority(mutation.target);
        if (mutation.target.matches('[data-player-sort]')) shouldSync = true;
      }
    });
    if (shouldSync) syncFilter();
  });

  observer.observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-recognition-type','class','style'],
  });

  syncFilter();
  applyVectorAuthority();
})();
