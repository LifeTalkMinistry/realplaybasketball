(() => {
  if (window.__realPlayBetaSeasonInfoInstalled) return;
  window.__realPlayBetaSeasonInfoInstalled = true;

  const lobby = document.querySelector('[data-rp-lobby]');
  const ratingWrap = lobby?.querySelector('.rp-player-rating');
  const seasonLabel = ratingWrap?.querySelector('span');
  if (!lobby || !ratingWrap || !seasonLabel) return;

  const overlay = document.createElement('div');
  overlay.className = 'rp-season-info-overlay';
  overlay.dataset.rpSeasonInfoOverlay = 'true';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <section class="rp-season-info-card" role="dialog" aria-modal="true" aria-labelledby="rp-season-info-title">
      <small>REAL PLAY 3V3</small>
      <h2 id="rp-season-info-title">BETA SEASON</h2>
      <p>This is Real Play's Beta Season — not Season 1.</p>
      <p>Beta Season is where Real Play tests the live system, gathers real game data, and refines the player experience before the official season launch.</p>
      <strong>SEASON 1 STARTS AFTER BETA SEASON ENDS.</strong>
      <button type="button" data-rp-season-info-close>GOT IT</button>
    </section>
  `;
  document.body.appendChild(overlay);

  function ensureInfoButton() {
    if (seasonLabel.querySelector('[data-rp-season-info]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-season-info-button';
    button.dataset.rpSeasonInfo = 'true';
    button.setAttribute('aria-label', 'About the Real Play Beta Season');
    button.textContent = 'i';
    seasonLabel.appendChild(button);
  }

  function openInfo() {
    ensureInfoButton();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-season-info-open');
    window.setTimeout(() => overlay.querySelector('[data-rp-season-info-close]')?.focus(), 20);
  }

  function closeInfo() {
    const active = document.activeElement;
    if (active && overlay.contains(active) && typeof active.blur === 'function') active.blur();
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-season-info-open');
    window.setTimeout(() => seasonLabel.querySelector('[data-rp-season-info]')?.focus({ preventScroll: true }), 20);
  }

  ensureInfoButton();

  // main-menu.js refreshes the season label when OVR changes/focus returns.
  // Restore the real info control if that refresh replaces the label contents.
  const observer = new MutationObserver(() => ensureInfoButton());
  observer.observe(seasonLabel, { childList: true, subtree: false });

  seasonLabel.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-rp-season-info]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openInfo();
  });

  overlay.querySelector('[data-rp-season-info-close]')?.addEventListener('click', closeInfo);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeInfo();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeInfo();
  });
})();
