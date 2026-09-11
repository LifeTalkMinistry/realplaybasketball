(() => {
  if (window.__realPlayRecordedInputStabilityInstalledV2) return;
  window.__realPlayRecordedInputStabilityInstalledV2 = true;

  // WATCH & SCORE is a long-lived workspace. A normal scoring/stat tap should
  // patch only values that changed. It must never tear down the mounted video,
  // scorer layout, or player panel just because another admin layer rendered.

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
    // Base-tab navigation renders synchronously from the click. This short
    // allowance keeps SETUP / PLAYERS / OWNERSHIP / FINALIZE navigation normal.
    allowAdminBodyReplaceUntil = performance.now() + 750;
  }

  document.addEventListener('pointerdown', allowExplicitNavigation, true);
  document.addEventListener('click', allowExplicitNavigation, true);

  // patchScoringUI() revisits many text nodes on every event. Native
  // textContent replaces the underlying text node even if "0" is still "0".
  // Ignore those no-op writes inside the scorer so one stat tap does not create
  // a burst of childList mutations for every document-wide observer to process.
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

  // The draft scorer also re-evaluates every +/- button after each event.
  // Avoid reflecting the disabled attribute when its state is already correct.
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

  // Most importantly, protect [data-admin-body]. The older admin controller
  // still owns a broad innerHTML renderer. While a recorded draft is active,
  // any attempt to replace an already-mounted WATCH & SCORE screen is ignored.
  // The only automatic replacement allowed is the scorer's own REVIEW screen.
  // Initial scorer mount, BACK TO SCORING, submit/finalize, and explicit tab
  // navigation remain unaffected because there is no mounted active scorer at
  // those transition points (or the navigation allowance above is active).
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
          const nextIsReview = next.includes('rp-video-sheet-review');

          if (adminRoot?.classList.contains('open')
            && draftActive
            && hasMountedScorer
            && videoTabActive(adminRoot)
            && !explicitNavigation
            && !nextIsReview) {
            console.debug('[Real Play] Preserved mounted WATCH & SCORE; blocked broad admin repaint.');
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
