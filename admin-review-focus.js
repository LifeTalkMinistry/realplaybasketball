(() => {
  if (window.__realPlayAdminReviewFocusInstalled) return;
  window.__realPlayAdminReviewFocusInstalled = true;

  const FOCUS_CLASS = 'rp-admin-review-focus';
  const STYLE_ATTR = 'data-rp-review-focus-styles';
  const RETURN_ATTR = 'data-rp-review-focus-return';

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function eventTarget(event) {
    return event.target instanceof Element ? event.target : null;
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
    button.textContent = 'RETURN TO GAME CONTROL';
    button.setAttribute('aria-label', 'Return to Game Control');

    const adminBody = adminRoot.querySelector('[data-admin-body]');
    if (adminBody?.parentElement) adminBody.parentElement.insertBefore(button, adminBody);
    else adminRoot.querySelector('.rp-admin-shell')?.appendChild(button);
    return button;
  }

  function setFocus(active) {
    const adminRoot = root();
    if (!adminRoot) return;
    adminRoot.classList.toggle(FOCUS_CLASS, Boolean(active));
    if (active) ensureReturnControl();
  }

  function returnToGameControl() {
    const adminRoot = root();
    if (!adminRoot) return;

    setFocus(false);

    // Return through the existing Audit/LIVE navigation so current recap state
    // is cleared by its normal owner. No scoring or backend action is performed.
    const auditTab = adminRoot.querySelector('[data-admin-tab="live"]')
      || adminRoot.querySelector('[data-admin-tab="audit"]')
      || adminRoot.querySelector('[data-rp-video-tab]');
    auditTab?.click();
  }

  function syncFromPointer(event) {
    const target = eventTarget(event);
    if (!target || !root()?.contains(target)) return;

    if (target.closest('[data-rp-video-finish]')) {
      // The draft scorer stops the later click event immediately, so enter the
      // presentation state at pointerdown without competing with its logic.
      setFocus(true);
      return;
    }

    if (target.closest('[data-rp-draft-back]')) {
      // BACK TO SCORING already owns the real state transition. We only restore
      // presentation chrome before that existing action runs.
      setFocus(false);
      return;
    }

    if (target.closest('[data-admin-exit]')) {
      setFocus(false);
    }
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

    const returnButton = target.closest(`[${RETURN_ATTR}]`);
    if (returnButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      returnToGameControl();
      return;
    }

    const tab = target.closest('[data-admin-tab]');
    if (tab && String(tab.dataset.adminTab || '') !== 'finalize') {
      // Explicit normal navigation is a legitimate focused-sequence exit.
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

      .rp-admin-review-focus-return {
        display: none;
        width: max-content;
        max-width: calc(100% - 24px);
        margin: 12px 12px 4px auto;
        padding: 9px 12px;
        border: 1px solid rgba(73, 211, 255, .28);
        border-radius: 10px;
        background: #07111b;
        color: #dff7ff;
        font: inherit;
        font-size: .55rem;
        font-weight: 950;
        letter-spacing: .06em;
        cursor: pointer;
      }

      .rp-admin-control.${FOCUS_CLASS} .rp-admin-review-focus-return {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Review already owns BACK TO SCORING, and the live scorer already owns
         its own exit. Show this return control only once that local exit is gone. */
      .rp-admin-control.${FOCUS_CLASS}:has(.rp-video-scoring-screen) .rp-admin-review-focus-return,
      .rp-admin-control.${FOCUS_CLASS}:has(.rp-video-sheet-review:not(.rp-recap-official-screen)) .rp-admin-review-focus-return {
        display: none;
      }

      @media (max-width: 640px) {
        .rp-admin-review-focus-return {
          margin-top: 8px;
          margin-right: 8px;
          max-width: calc(100% - 16px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  ensureReturnControl();

  // Pointer/key events are presentation-only and deliberately separate from
  // scoring/review business state. No MutationObserver is added.
  document.addEventListener('pointerdown', syncFromPointer, true);
  document.addEventListener('keydown', syncFromKeyboard, true);
  document.addEventListener('click', handleClick, true);

  // Defensive cleanup on full page departure. Normal in-page Review -> Finalize
  // transitions intentionally keep the class untouched.
  window.addEventListener('pagehide', () => setFocus(false), { once: true });
})();
