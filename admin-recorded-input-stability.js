(() => {
  if (window.__realPlayRecordedInputStabilityInstalledV3) return;
  window.__realPlayRecordedInputStabilityInstalledV3 = true;

  // VIDEO is a long-lived workspace. Normal roster changes, scoring taps and
  // background admin polling must not tear it down and let the legacy renderer
  // briefly replace it with SETUP / PLAYERS / LIVE / FINALIZE markup.

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

  // Protect [data-admin-body] whenever VIDEO owns the workspace. The recorded
  // scoring controller is still free to replace VIDEO with another VIDEO state
  // (loading -> setup -> scoring -> review). What is blocked is a non-VIDEO
  // legacy admin render landing on top of an already mounted VIDEO workspace.
  // Explicit base-tab navigation remains allowed so leaving VIDEO still works.
  const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (innerHtmlDescriptor?.get && innerHtmlDescriptor?.set && innerHtmlDescriptor.configurable) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...innerHtmlDescriptor,
      set(value) {
        const isAdminBody = this.matches?.('[data-admin-body]');
        if (isAdminBody) {
          const adminRoot = this.closest?.('.rp-admin-control');
          const explicitNavigation = performance.now() < allowAdminBodyReplaceUntil;
          const next = value == null ? '' : String(value);
          const hasMountedVideoWorkspace = Boolean(this.querySelector?.('.rp-video-screen'));
          const nextIsVideoWorkspace = next.includes('rp-video-screen');
          const nextIsReview = next.includes('rp-video-sheet-review');

          if (adminRoot?.classList.contains('open')
            && hasMountedVideoWorkspace
            && videoTabActive(adminRoot)
            && !explicitNavigation
            && !nextIsVideoWorkspace
            && !nextIsReview) {
            console.debug('[Real Play] Preserved VIDEO workspace; blocked legacy admin repaint.');
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