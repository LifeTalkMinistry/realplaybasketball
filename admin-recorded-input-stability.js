(() => {
  if (window.__realPlayRecordedInputStabilityInstalledV1) return;
  window.__realPlayRecordedInputStabilityInstalledV1 = true;

  // Recorded WATCH & SCORE is a long-lived workspace. A normal stat tap should
  // change only the counters that actually changed; it must not wake every
  // MutationObserver or let the legacy admin renderer tear down the YouTube
  // player and rebuild the whole scoring screen.

  let allowAdminBodyReplaceUntil = 0;

  function inScoringScreen(node) {
    return Boolean(node?.nodeType === 1 && node.closest?.('.rp-video-scoring-screen'));
  }

  function videoTabActive(root) {
    const tab = root?.querySelector('[data-rp-video-tab]');
    return Boolean(tab?.classList.contains('active'));
  }

  function allowExplicitNavigation(event) {
    const tab = event.target?.closest?.('.rp-admin-tab');
    if (!tab || tab.matches('[data-rp-video-tab]')) return;
    // The base admin tab handler renders synchronously from the click. Give it
    // a short allowance so intentional navigation is never blocked.
    allowAdminBodyReplaceUntil = performance.now() + 750;
  }

  document.addEventListener('pointerdown', allowExplicitNavigation, true);
  document.addEventListener('click', allowExplicitNavigation, true);

  // 1) Suppress no-op text writes inside WATCH & SCORE.
  // patchScoringUI() intentionally revisits several counters on each tap. The
  // old behavior still replaced their text nodes even when 0 stayed 0, which
  // generated a cascade of childList mutations and repaint work.
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (textContentDescriptor?.get && textContentDescriptor?.set && textContentDescriptor.configurable) {
    Object.defineProperty(Node.prototype, 'textContent', {
      ...textContentDescriptor,
      set(value) {
        if (inScoringScreen(this)) {
          const next = value == null ? '' : String(value);
          if (textContentDescriptor.get.call(this) === next) return;
        }
        return textContentDescriptor.set.call(this, value);
      },
    });
  }

  // 2) Suppress no-op disabled writes on score-sheet buttons. The draft patch
  // checks every +/- button after an event; setting an already-disabled button
  // again can still create attribute mutation work in Chromium.
  const disabledDescriptor = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  if (disabledDescriptor?.get && disabledDescriptor?.set && disabledDescriptor.configurable) {
    Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {
      ...disabledDescriptor,
      set(value) {
        const next = Boolean(value);
        if (inScoringScreen(this) && disabledDescriptor.get.call(this) === next) return;
        return disabledDescriptor.set.call(this, next);
      },
    });
  }

  // 3) Protect the mounted recorded scorer from the legacy admin body's broad
  // innerHTML renderer. During an active local draft, polling or unrelated
  // admin state changes are not allowed to replace WATCH & SCORE with the old
  // live-game body. Review mode and intentional tab navigation are still
  // allowed, and the guard releases automatically when the draft deactivates.
  const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (innerHtmlDescriptor?.get && innerHtmlDescriptor?.set && innerHtmlDescriptor.configurable) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...innerHtmlDescriptor,
      set(value) {
        const isAdminBody = this.matches?.('[data-admin-body]');
        if (isAdminBody) {
          const adminRoot = this.closest?.('.rp-admin-control');
          const draftActive = Boolean(window.__realPlayRecordedScoringDraftActive);
          const hasMountedScorer = Boolean(this.querySelector?.('.rp-video-scoring-screen'));
          const explicitNavigation = performance.now() < allowAdminBodyReplaceUntil;
          const next = value == null ? '' : String(value);
          const nextIsRecordedScreen = next.includes('rp-video-scoring-screen') || next.includes('rp-video-sheet-review');

          if (adminRoot?.classList.contains('open')
            && draftActive
            && hasMountedScorer
            && videoTabActive(adminRoot)
            && !explicitNavigation
            && !nextIsRecordedScreen) {
            console.debug('[Real Play] Prevented legacy admin-body repaint during recorded scoring.');
            return;
          }
        }

        if (inScoringScreen(this)) {
          const next = value == null ? '' : String(value);
          if (innerHtmlDescriptor.get.call(this) === next) return;
        }
        return innerHtmlDescriptor.set.call(this, value);
      },
    });
  }
})();
