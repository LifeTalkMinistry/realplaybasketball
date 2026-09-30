(() => {
  if (window.__realPlayAdminReviewFocusInstalled) return;
  window.__realPlayAdminReviewFocusInstalled = true;

  const FOCUS_CLASS = 'rp-admin-review-focus';
  const STYLE_ATTR = 'data-rp-review-focus-styles';
  const RETURN_ATTR = 'data-rp-review-focus-return';
  const BACK_ATTR = 'data-rp-review-focus-back';

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function eventTarget(event) {
    return event.target instanceof Element ? event.target : null;
  }

  function insertBeforeBody(button) {
    const adminRoot = root();
    const adminBody = body();
    if (!adminRoot || !button) return;
    if (adminBody?.parentElement) adminBody.parentElement.insertBefore(button, adminBody);
    else adminRoot.querySelector('.rp-admin-shell')?.appendChild(button);
  }

  function ensureReviewBackControl() {
    const adminRoot = root();
    if (!adminRoot) return null;

    let button = adminRoot.querySelector(`[${BACK_ATTR}]`);
    if (button) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-admin-review-focus-back';
    button.setAttribute(BACK_ATTR, '1');
    button.textContent = '←';
    button.setAttribute('aria-label', 'Back to video scoring');
    button.setAttribute('title', 'Back to video');
    insertBeforeBody(button);
    return button;
  }

  function ensureReturnControl() {
    const adminRoot = root();
    if (!adminRoot) return null;

    let button = adminRoot.querySelector(`[${RETURN_ATTR}]`);
    if (button) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-admin-review-focus-return';
    button.setAttribute(RETURN_ATTR, '1');
    button.textContent = '←';
    button.setAttribute('aria-label', 'Return to Game Control');
    button.setAttribute('title', 'Return to Game Control');
    insertBeforeBody(button);
    return button;
  }

  function setFocus(active) {
    const adminRoot = root();
    if (!adminRoot) return;
    adminRoot.classList.toggle(FOCUS_CLASS, Boolean(active));
    if (active) {
      ensureReviewBackControl();
      ensureReturnControl();
    }
  }

  function returnToVideo() {
    const adminRoot = root();
    if (!adminRoot) return;
    const existingBack = adminRoot.querySelector('[data-rp-draft-back]');
    if (!existingBack) return;
    setFocus(false);
    existingBack.click();
  }

  function returnToGameControl() {
    const adminRoot = root();
    if (!adminRoot) return;

    setFocus(false);

    // Return through the existing Audit/LIVE navigation so recap state is
    // cleared by its normal owner. This performs no scoring/backend action.
    const auditTab = adminRoot.querySelector('[data-admin-tab="live"]')
      || adminRoot.querySelector('[data-admin-tab="audit"]')
      || adminRoot.querySelector('[data-rp-video-tab]');
    auditTab?.click();
  }

  function syncFromPointer(event) {
    const target = eventTarget(event);
    if (!target || !root()?.contains(target)) return;

    if (target.closest('[data-rp-video-finish]')) {
      // The scorer consumes the later click. Enter presentation focus early,
      // then let the scorer keep full ownership of review business state.
      setFocus(true);
      return;
    }

    if (target.closest('[data-rp-draft-back]')) {
      setFocus(false);
      return;
    }

    if (target.closest('[data-admin-exit]')) setFocus(false);
  }

  function syncFromKeyboard(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = eventTarget(event);
    if (!target || !root()?.contains(target)) return;
    if (target.closest('[data-rp-video-finish]')) setFocus(true);
    else if (target.closest('[data-rp-draft-back]')) setFocus(false);
  }

  function handleClick(event) {
    const target = eventTarget(event);
    const adminRoot = root();
    if (!target || !adminRoot?.contains(target)) return;

    if (target.closest(`[${BACK_ATTR}]`)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      returnToVideo();
      return;
    }

    if (target.closest(`[${RETURN_ATTR}]`)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      returnToGameControl();
      return;
    }

    const tab = target.closest('[data-admin-tab]');
    if (tab && String(tab.dataset.adminTab || '') !== 'finalize') {
      setFocus(false);
    }
  }

  function installStyles() {
    if (document.querySelector(`[${STYLE_ATTR}]`)) return;
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, '1');
    style.textContent = `
      .rp-admin-control.${FOCUS_CLASS} .rp-admin-topbar,
      .rp-admin-control.${FOCUS_CLASS} .rp-admin-livebar,
      .rp-admin-control.${FOCUS_CLASS} .rp-admin-tabs {
        display: none !important;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-admin-body {
        padding-top: 0 !important;
      }

      /* Pure stat-view presentation: remove draft/admin chrome and duplicated
         audit metadata while leaving all actual game/player data untouched. */
      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review > .rp-admin-title,
      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) > .rp-video-scoreboard,
      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) > .rp-video-sheet-meta,
      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) > .rp-video-auto-note,
      .rp-admin-control.${FOCUS_CLASS} .rp-recap-event-summary,
      .rp-admin-control.${FOCUS_CLASS} .rp-recap-original-label {
        display: none !important;
      }

      /* Remove the large action bar. Keep the real submit button itself as a
         tiny check control so the existing Verify & Submit workflow is not broken. */
      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) > .rp-video-sheet-actions {
        display: flex !important;
        justify-content: flex-end !important;
        gap: 0 !important;
        margin: 12px 0 0 !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) [data-rp-draft-back] {
        display: none !important;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) [data-rp-draft-submit] {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        padding: 0 !important;
        border: 1px solid rgba(73, 211, 255, .34) !important;
        border-radius: 12px !important;
        background: #07131d !important;
        color: #48d7ff !important;
        font-size: 0 !important;
        line-height: 1 !important;
        box-shadow: none !important;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) [data-rp-draft-submit]::before {
        content: '✓';
        display: block;
        font-size: 18px;
        font-weight: 950;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) [data-rp-draft-submit]:disabled {
        opacity: .45;
        cursor: wait;
      }

      .rp-admin-review-focus-back,
      .rp-admin-review-focus-return {
        display: none;
        width: 42px;
        height: 42px;
        padding: 0;
        border: 1px solid rgba(73, 211, 255, .24);
        border-radius: 12px;
        background: #07111b;
        color: #dff7ff;
        font: inherit;
        font-size: 20px;
        font-weight: 950;
        line-height: 1;
        cursor: pointer;
      }

      .rp-admin-control.${FOCUS_CLASS}:has(.rp-video-sheet-review:not(.rp-recap-official-screen)) .rp-admin-review-focus-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 12px 0 8px 12px;
      }

      .rp-admin-control.${FOCUS_CLASS}:not(:has(.rp-video-sheet-review:not(.rp-recap-official-screen))):not(:has(.rp-video-scoring-screen)) .rp-admin-review-focus-return {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 12px 0 8px 12px;
      }

      @media (max-width: 640px) {
        .rp-admin-control.${FOCUS_CLASS}:has(.rp-video-sheet-review:not(.rp-recap-official-screen)) .rp-admin-review-focus-back,
        .rp-admin-control.${FOCUS_CLASS}:not(:has(.rp-video-sheet-review:not(.rp-recap-official-screen))):not(:has(.rp-video-scoring-screen)) .rp-admin-review-focus-return {
          margin-top: 8px;
          margin-left: 8px;
        }

        .rp-admin-control.${FOCUS_CLASS} .rp-video-sheet-review:not(.rp-recap-official-screen) [data-rp-draft-submit] {
          width: 40px !important;
          min-width: 40px !important;
          height: 40px !important;
          min-height: 40px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  ensureReviewBackControl();
  ensureReturnControl();

  // Presentation-only listeners. No observer and no scoring-state duplication.
  document.addEventListener('pointerdown', syncFromPointer, true);
  document.addEventListener('keydown', syncFromKeyboard, true);
  document.addEventListener('click', handleClick, true);

  window.addEventListener('pagehide', () => setFocus(false), { once: true });
})();
