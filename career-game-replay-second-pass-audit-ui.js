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

  function ensureAuditBanner(root) {
    if (!root || root.querySelector('[data-rp-replay-second-pass-banner]')) return;
    const anchor = root.querySelector('.rp-admin-title') || root.firstElementChild;
    const banner = document.createElement('section');
    banner.className = 'rp-replay-second-pass-banner';
    banner.dataset.rpReplaySecondPassBanner = '1';
    banner.innerHTML = [
      '<div class="rp-replay-second-pass-head">',
      '<span>SECOND-PASS AUDIT</span>',
      '<strong>WORKING COPY · NOT RE-CERTIFIED YET</strong>',
      '</div>',
      '<p>The previous audit is only the starting record. Check the footage again and correct the scorer, made/missed shots, assists, rebounds, turnovers, steals, blocks or fouls whenever the video shows something different.</p>',
      '<div class="rp-replay-second-pass-rule"><b>WORKING SCORE</b><span>Team totals are recalculated from the event list below. Do not treat the loaded  score as unquestionable truth.</span></div>'
    ].join('');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(banner, anchor.nextSibling);
    else root.prepend(banner);
  }

  function decorateScoring(root) {
    const title = root.querySelector('.rp-admin-title');
    setText(title?.querySelector('.rp-admin-kicker'), 'SECOND-PASS AUDIT');
    setText(title?.querySelector('h1'), 'RE-AUDIT GAME');
    setText(title?.querySelector('p'), 'Double-check the recorded audit against the footage before re-certifying anything.');

    ensureAuditBanner(root);

    root.querySelectorAll('.rp-video-player-panel-head small').forEach((node) => {
      const team = String(node.textContent || '').split('·')[0].trim();
      setText(node, team ? team + ' · WORKING AUDIT COPY' : 'WORKING AUDIT COPY');
    });

    const banner = root.querySelector('.rp-video-draft-banner');
    setText(banner?.querySelector('strong'), 'RECORDED AUDIT · EDITABLE WORKING COPY');
    setText(
      banner?.querySelector('small'),
      'Add or remove events while checking the video. Changes remain provisional until the audit is certified.'
    );

    const finish = root.querySelector('[data-rp-video-finish]');
    setText(finish, 'REVIEW RE-AUDIT');

    const undo = root.querySelector('[data-rp-video-undo]');
    if (undo) {
      undo.title = 'Remove the most recent event from the working audit copy';
      undo.setAttribute('aria-label', 'Remove the most recent event from the working audit copy');
    }
  }

  function ensureReviewWarning(root) {
    if (!root || root.querySelector('[data-rp-replay-second-pass-review-warning]')) return;
    const scoreboard = root.querySelector('.rp-video-scoreboard');
    const warning = document.createElement('div');
    warning.className = 'rp-replay-second-pass-review-warning';
    warning.dataset.rpReplaySecondPassReviewWarning = '1';
    warning.innerHTML = '<strong>SENSITIVE RE-CERTIFICATION</strong><span>This screen is the proposed replacement record. Go back if any score, scorer or stat still needs verification.</span>';
    if (scoreboard?.parentNode) scoreboard.parentNode.insertBefore(warning, scoreboard);
  }

  function decorateReview(root) {
    const title = root.querySelector('.rp-admin-title');
    setText(title?.querySelector('.rp-admin-kicker'), 'SECOND-PASS AUDIT');
    setText(title?.querySelector('h1'), 'VERIFY RE-AUDIT');
    setText(title?.querySelector('p'), 'Review the recalculated working record before replacing the current official game data.');

    ensureReviewWarning(root);

    const note = root.querySelector('.rp-video-auto-note');
    setText(note?.querySelector('strong'), 'ONE SENSITIVE OFFICIAL WRITE');
    setText(
      note?.querySelector('span'),
      'Certifying this audit replaces the current official recorded score sheet in one transaction.'
    );

    setText(root.querySelector('[data-rp-draft-back]'), 'BACK TO RE-AUDIT');
    const submit = root.querySelector('[data-rp-draft-submit]');
    if (submit && !submit.disabled) setText(submit, 'CERTIFY AUDIT');
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

  const style = document.createElement('style');
  style.textContent = [
    '.rp-replay-second-pass-banner{display:grid;gap:8px;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(255,177,61,.30);border-radius:12px;background:linear-gradient(145deg,rgba(54,35,6,.40),rgba(4,14,22,.94));box-shadow:inset 3px 0 0 rgba(255,177,61,.72)}',
    '.rp-replay-second-pass-head{display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '.rp-replay-second-pass-head span{color:#ffbc59;font-size:.50rem;font-weight:950;letter-spacing:.12em}',
    '.rp-replay-second-pass-head strong{color:#f5fbff;font-size:.52rem;font-weight:950;letter-spacing:.06em;text-align:right}',
    '.rp-replay-second-pass-banner p{margin:0;color:#9eb1bf;font-size:.57rem;font-weight:760;line-height:1.48}',
    '.rp-replay-second-pass-rule{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding-top:7px;border-top:1px solid rgba(255,255,255,.06)}',
    '.rp-replay-second-pass-rule b{color:#66e6ff;font-size:.48rem;letter-spacing:.08em;white-space:nowrap}',
    '.rp-replay-second-pass-rule span{color:#7f96a6;font-size:.51rem;font-weight:760;line-height:1.4}',
    '.rp-replay-second-pass-review-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:10px 12px;border:1px solid rgba(255,177,61,.28);border-radius:11px;background:rgba(57,36,7,.30)}',
    '.rp-replay-second-pass-review-warning strong{color:#ffc56f;font-size:.52rem;letter-spacing:.08em}',
    '.rp-replay-second-pass-review-warning span{max-width:68%;color:#9fb0bd;font-size:.54rem;font-weight:760;line-height:1.4;text-align:right}',
    '@media(max-width:620px){.rp-replay-second-pass-head,.rp-replay-second-pass-review-warning{align-items:flex-start;flex-direction:column}.rp-replay-second-pass-head strong,.rp-replay-second-pass-review-warning span{max-width:none;text-align:left}.rp-replay-second-pass-rule{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(style);

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled'] });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-rp-replay-admin-edit],[data-rp-video-finish],[data-rp-draft-back]')) {
      window.setTimeout(queueDecorate, 40);
    }
  }, true);

  window.addEventListener('realplay:admin-render', queueDecorate);
  queueDecorate();
})();