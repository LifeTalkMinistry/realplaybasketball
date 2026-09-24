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

    // The first prompt is intentionally only a two-way choice. Remove the
    // explanatory paragraphs, footnote, third option, and header close button.
    panel.querySelectorAll('.rp-team-support-copy, .rp-team-support-footnote, .rp-team-support-tertiary')
      .forEach((node) => node.remove());
    panel.querySelector('.rp-team-sheet-close')?.remove();

    if (helpButton.textContent !== 'SEE HOW I CAN HELP') {
      helpButton.textContent = 'SEE HOW I CAN HELP';
    }

    const existingExit = actions.querySelector('[data-rp-team-support-play-exit]');
    const playingButton = actions.querySelector('[data-rp-team-support-screen="playing"]');
    if (!existingExit && playingButton) {
      // Replace the old button node so its previous "open playing screen"
      // listener is discarded. This choice now exits directly to the team.
      const exitButton = playingButton.cloneNode(false);
      exitButton.removeAttribute('data-rp-team-support-screen');
      exitButton.dataset.rpTeamSupportPlayExit = 'true';
      exitButton.textContent = "I'LL SUPPORT BY PLAYING";
      exitButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSupportOverlay(overlay);
      });
      playingButton.replaceWith(exitButton);
    } else if (existingExit && existingExit.textContent !== "I'LL SUPPORT BY PLAYING") {
      existingExit.textContent = "I'LL SUPPORT BY PLAYING";
    }
  }

  function normalizeOverlay(root = document) {
    const overlay = getSupportOverlay(root);
    if (!overlay) return;

    // Detach this flow from the shared bottom-sheet classes. Those classes are
    // intentionally anchored to the bottom for team creation/join sheets and
    // were overriding the support funnel even when its CSS requested centering.
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

  // The initial prompt is mandatory: the player must choose either to see how
  // they can help or to support simply by playing. Backdrop/Escape must not act
  // as a hidden third "not now" path. After choosing the help path, normal
  // close controls on the deeper support screens remain available.
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
