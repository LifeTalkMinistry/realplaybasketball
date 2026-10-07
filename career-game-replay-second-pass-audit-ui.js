(() => {
  if (window.__realPlayReplaySecondPassAuditUiInstalled) return;
  window.__realPlayReplaySecondPassAuditUiInstalled = true;

  let queued = false;

  function correctionRoot() {
    return document.querySelector('.rp-admin-control.open [data-rp-replay-correction-mode]');
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function decorateScoring(root) {
    // Do not inject second-pass-only cards here. Re-audit intentionally uses
    // the same scorer chrome/layout as the first audit; only the loaded data
    // and a few status labels differ.
    const banner = root.querySelector('[data-rp-draft-banner], .rp-video-draft-banner');
    setText(banner?.querySelector('strong'), 'RE-AUDIT WORKING COPY');
    setText(
      banner?.querySelector('small'),
      'The previous verified audit is loaded as the starting score sheet. Nothing changes until VERIFY & SUBMIT.'
    );

    setText(root.querySelector('[data-rp-video-undo]'), 'UNDO LAST DRAFT EVENT');
    setText(root.querySelector('[data-rp-video-finish]'), 'REVIEW SCORE SHEET');

    const cancel = root.querySelector('[data-rp-cancel-audit]');
    setText(cancel, 'CANCEL RE-AUDIT');
    if (cancel) {
      cancel.title = 'Discard this re-audit working copy and return to the replay';
      cancel.setAttribute('aria-label', 'Discard this re-audit working copy and return to the replay');
    }

    const undo = root.querySelector('[data-rp-video-undo]');
    if (undo) {
      undo.title = 'Remove the most recent event from the working score sheet';
      undo.setAttribute('aria-label', 'Remove the most recent event from the working score sheet');
    }
  }

  function decorateReview(root) {
    const note = root.querySelector('.rp-video-auto-note');
    setText(note?.querySelector('strong'), 'ONE OFFICIAL WRITE');
    setText(
      note?.querySelector('span'),
      'VERIFY & SUBMIT replaces the current official recorded score sheet in one transaction.'
    );

    setText(root.querySelector('[data-rp-draft-back]'), 'BACK TO SCORING');
    const submit = root.querySelector('[data-rp-draft-submit]');
    if (submit && !submit.disabled) setText(submit, 'VERIFY & SUBMIT');
  }

  function decoratePencil() {
    const pencil = document.querySelector('[data-rp-career-replay].open [data-rp-replay-admin-edit]');
    if (!pencil) return;
    pencil.title = 'Open second-pass audit';
    pencil.setAttribute('aria-label', 'Open second-pass audit');
  }

  function decorate() {
    queued = false;
    decoratePencil();
    const root = correctionRoot();
    if (!root) return;

    if (root.classList.contains('rp-video-sheet-review')) decorateReview(root);
    else decorateScoring(root);
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'disabled'],
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-rp-replay-admin-edit],[data-rp-video-finish],[data-rp-draft-back]')) {
      window.setTimeout(queueDecorate, 40);
    }
  }, true);

  window.addEventListener('realplay:admin-render', queueDecorate);
  queueDecorate();
})();