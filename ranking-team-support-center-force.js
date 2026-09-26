(() => {
  if (window.__realPlayTeamSupportCenterForceInstalled) return;
  window.__realPlayTeamSupportCenterForceInstalled = true;

  function closeSupportOverlay(overlay) {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function getSupportOverlay(root = document) {
    if (root?.matches?.('[data-rp-team-support-overlay]')) return root;
    const ancestor = root?.closest?.('[data-rp-team-support-overlay]');
    if (ancestor) return ancestor;
    return root?.querySelector?.('[data-rp-team-support-overlay]') || null;
  }

  function syncMainChoice(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    const actions = panel.querySelector('.rp-team-support-actions');
    const helpButton = actions?.querySelector('[data-rp-team-support-screen="help"]');
    const isMainChoice = Boolean(actions && helpButton);

    overlay.dataset.rpTeamSupportMainChoice = isMainChoice ? 'true' : 'false';
    if (!isMainChoice) return;

    const title = panel.querySelector('#rp-team-support-title');
    if (title && title.textContent !== 'WOULD YOU LIKE TO HELP US?') {
      title.textContent = 'WOULD YOU LIKE TO HELP US?';
    }

    panel.querySelectorAll('.rp-team-support-copy, .rp-team-support-footnote, .rp-team-support-tertiary')
      .forEach((node) => node.remove());
    panel.querySelector('.rp-team-sheet-close')?.remove();

    if (helpButton.textContent !== 'SEE HOW I CAN HELP') {
      helpButton.textContent = 'SEE HOW I CAN HELP';
    }

    const playingButton = actions.querySelector('[data-rp-team-support-screen="playing"]');
    if (playingButton && playingButton.textContent !== "I'LL SUPPORT BY PLAYING") {
      playingButton.textContent = "I'LL SUPPORT BY PLAYING";
    }
  }

  function syncHelpChoice(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    const paths = panel.querySelector('.rp-team-support-paths');
    const volunteer = paths?.querySelector('[data-rp-team-support-screen="volunteer"]');
    const money = paths?.querySelector('[data-rp-team-support-screen="money"]');
    const isHelpChoice = Boolean(paths && volunteer && money);

    overlay.dataset.rpTeamSupportHelpChoice = isHelpChoice ? 'true' : 'false';
    if (!isHelpChoice) return;

    const title = panel.querySelector('#rp-team-support-title');
    if (title && title.textContent !== 'HOW WOULD YOU LIKE TO HELP?') {
      title.textContent = 'HOW WOULD YOU LIKE TO HELP?';
    }

    panel.querySelector('.rp-team-sheet-head small')?.remove();
    panel.querySelector('.rp-team-sheet-close:not(.rp-team-support-header-back)')?.remove();
    panel.querySelector('.rp-team-support-back')?.remove();
    panel.querySelectorAll('.rp-team-support-copy, .rp-team-support-tertiary')
      .forEach((node) => node.remove());
    paths.querySelectorAll('p').forEach((node) => node.remove());
  }

  function syncTierBenefitCopy(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    panel.querySelectorAll('.rp-team-support-benefit').forEach((benefit) => {
      const title = benefit.querySelector('strong');
      const description = benefit.querySelector('p');
      const currentTitle = String(title?.textContent || '').trim();
      if (!title || !['Earlier Booking Access', 'Play Token Protection', '4 Play Tokens'].includes(currentTitle)) return;

      const wantedTitle = '4 Play Tokens';
      const wantedDescription = 'Get 4 Play Tokens each month to secure protected session reservations.';

      if (currentTitle !== wantedTitle) title.textContent = wantedTitle;
      if (description && String(description.textContent || '').trim() !== wantedDescription) {
        description.textContent = wantedDescription;
      }
    });
  }

  function syncDigitalPaymentChrome(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    panel.querySelectorAll(
      '[data-rp-support-payment-pane="gcash"], [data-rp-support-payment-pane="maya"]'
    ).forEach((pane) => {
      const heading = pane.querySelector(':scope > strong');
      const copy = pane.querySelector(':scope > p');
      const headingText = String(heading?.textContent || '').trim();

      // Keep the unavailable-state message because it is actionable.
      // When payment details are available, the QR/account details already make
      // the selected method obvious, so the extra heading and instruction copy
      // are intentionally removed.
      if (!headingText.includes('DETAILS UNAVAILABLE')) {
        heading?.remove();
        copy?.remove();
      }
    });
  }

  function normalizeOverlay(root = document) {
    const overlay = getSupportOverlay(root);
    if (!overlay) return;

    if (overlay.classList.contains('rp-team-sheet-overlay')) {
      overlay.classList.remove('rp-team-sheet-overlay');
    }
    if (!overlay.classList.contains('rp-team-support-overlay')) {
      overlay.classList.add('rp-team-support-overlay');
    }

    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (panel) {
      if (panel.classList.contains('rp-team-sheet')) panel.classList.remove('rp-team-sheet');
      if (!panel.classList.contains('rp-team-support-card')) panel.classList.add('rp-team-support-card');
    }

    syncMainChoice(overlay);
    syncHelpChoice(overlay);
    syncTierBenefitCopy(overlay);
    syncDigitalPaymentChrome(overlay);
  }

  const observer = new MutationObserver((mutations) => {
    const overlays = new Set();

    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        const owner = mutation.target.closest('[data-rp-team-support-overlay]');
        if (owner) overlays.add(owner);
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-rp-team-support-overlay]')) overlays.add(node);
        const nested = node.querySelector?.('[data-rp-team-support-overlay]');
        if (nested) overlays.add(nested);
      }
    }

    overlays.forEach((overlay) => normalizeOverlay(overlay));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay || overlay.dataset.rpTeamSupportMainChoice !== 'true') return;
    if (event.target !== overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay || overlay.dataset.rpTeamSupportMainChoice !== 'true') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  normalizeOverlay(document);
})();