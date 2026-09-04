(() => {
  if (window.__realPlayRankingInfoToggleInstalled) return;
  window.__realPlayRankingInfoToggleInstalled = true;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  const hero = view.querySelector('.rp-ranking-hero');
  const kicker = view.querySelector('[data-rp-ranking-kicker]');
  const copy = view.querySelector('[data-rp-ranking-copy]');
  if (!hero || !kicker || !copy) return;

  const style = document.createElement('style');
  style.dataset.rpRankingInfoStyles = 'true';
  style.textContent = `
    .rp-ranking-kicker-row{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      min-height:22px;
    }
    .rp-ranking-info-toggle{
      appearance:none;
      display:inline-grid;
      place-items:center;
      width:20px;
      height:20px;
      padding:0;
      border:1px solid rgba(32,207,255,.42);
      border-radius:999px;
      background:rgba(7,26,43,.82);
      color:#50ddff;
      font:900 11px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      cursor:pointer;
      box-shadow:0 0 0 1px rgba(32,207,255,.03) inset;
      touch-action:manipulation;
    }
    .rp-ranking-info-toggle:hover,
    .rp-ranking-info-toggle:focus-visible,
    .rp-ranking-info-toggle.active{
      border-color:rgba(32,207,255,.78);
      background:rgba(13,48,70,.94);
      color:#eafbff;
      outline:none;
    }
    .rp-ranking-info-toggle[hidden]{display:none!important}
    .rp-ranking-hero>[data-rp-ranking-copy][hidden]{display:none!important}
  `;
  document.head.appendChild(style);

  const row = document.createElement('div');
  row.className = 'rp-ranking-kicker-row';
  kicker.before(row);
  row.appendChild(kicker);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rp-ranking-info-toggle';
  button.dataset.rpRankingInfoToggle = 'true';
  button.textContent = 'i';
  button.setAttribute('aria-label', 'About your ranked OVR');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'rp-ranking-explanation');
  row.appendChild(button);

  copy.id = 'rp-ranking-explanation';
  let expanded = false;

  function sync() {
    const ranked = view.classList.contains('ranked');
    const opened = view.classList.contains('open');

    if (!ranked || !opened) expanded = false;

    button.hidden = !ranked;
    button.classList.toggle('active', ranked && expanded);
    button.setAttribute('aria-expanded', ranked && expanded ? 'true' : 'false');

    copy.hidden = ranked && !expanded;
    copy.setAttribute('aria-hidden', ranked && !expanded ? 'true' : 'false');
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!view.classList.contains('ranked')) return;
    expanded = !expanded;
    sync();
  });

  document.addEventListener('click', (event) => {
    if (!expanded || !view.classList.contains('open')) return;
    if (event.target.closest('[data-rp-ranking-info-toggle], [data-rp-ranking-copy]')) return;
    expanded = false;
    sync();
  });

  new MutationObserver(sync).observe(view, {
    attributes: true,
    attributeFilter: ['class'],
  });

  sync();
})();
