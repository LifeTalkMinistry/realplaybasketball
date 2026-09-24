(() => {
  if (window.__realPlayTakeoverAdminCleanV2Installed) return;
  window.__realPlayTakeoverAdminCleanV2Installed = true;

  const STYLE_ID = 'rp-takeover-admin-clean-v2-styles';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-takeover-admin .rp-takeover-admin-shell{
        width:min(700px,100%);
        min-height:100dvh;
        padding:max(16px,env(safe-area-inset-top)) 16px max(28px,env(safe-area-inset-bottom));
        background:radial-gradient(circle at 88% -8%,rgba(41,178,255,.10),transparent 32%),linear-gradient(180deg,#0a101b 0%,#05080f 56%,#03050a 100%);
      }
      .rp-takeover-admin .rp-takeover-admin-head{gap:12px;margin-bottom:6px}
      .rp-takeover-admin .rp-takeover-admin-back{width:38px;height:38px;flex:0 0 38px;border-color:rgba(255,255,255,.10);background:rgba(10,16,27,.78);font-size:19px}
      .rp-takeover-admin .rp-takeover-admin-head small{color:#45d6ff;font-size:9px;letter-spacing:.14em}
      .rp-takeover-admin .rp-takeover-admin-head h2{margin:2px 0 0;font-size:clamp(1.28rem,4.8vw,1.72rem);line-height:1.08;font-style:normal;font-weight:900;letter-spacing:-.025em;text-transform:none}
      .rp-takeover-admin .rp-takeover-admin-note{margin:0 0 18px 50px;padding:0;border:0;background:transparent;color:#7f90a6;font-size:.78rem;line-height:1.45}
      .rp-takeover-admin .rp-takeover-admin-form{display:grid;gap:12px}
      .rp-takeover-admin .rp-takeover-clean-section{display:grid;gap:12px;padding:15px;border:1px solid rgba(255,255,255,.065);border-radius:18px;background:rgba(10,15,25,.72)}
      .rp-takeover-admin .rp-takeover-clean-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:0 1px 1px}
      .rp-takeover-admin .rp-takeover-clean-section-head strong{color:#f5f8fd;font-size:.86rem;font-weight:900}
      .rp-takeover-admin .rp-takeover-clean-section-head span{color:#6f8197;font-size:.66rem;line-height:1.35;text-align:right}
      .rp-takeover-admin .rp-takeover-field{display:grid;gap:6px}
      .rp-takeover-admin .rp-takeover-field>span{color:#91a0b4;font-size:.68rem;font-weight:750;letter-spacing:.015em;text-transform:none}
      .rp-takeover-admin .rp-takeover-field input[type="text"],
      .rp-takeover-admin .rp-takeover-field input[type="url"],
      .rp-takeover-admin .rp-takeover-field input[type="file"],
      .rp-takeover-admin .rp-takeover-field select{min-height:44px;padding:10px 11px;border:1px solid rgba(255,255,255,.085);border-radius:11px;background:rgba(3,7,13,.72);color:#f7f9fd;outline:none;box-shadow:none}
      .rp-takeover-admin .rp-takeover-field input:focus,.rp-takeover-admin .rp-takeover-field select:focus{border-color:rgba(66,216,255,.46);box-shadow:0 0 0 3px rgba(66,216,255,.07)}
      .rp-takeover-admin .rp-takeover-field input[type="file"]{padding:8px 9px;color:#aab7c7;font-size:.78rem}
      .rp-takeover-admin .rp-takeover-field input[type="file"]::file-selector-button{margin-right:10px;padding:7px 10px;border:0;border-radius:8px;background:#132235;color:#eaf7ff;font:inherit;font-size:.72rem;font-weight:800;cursor:pointer}
      .rp-takeover-admin .rp-takeover-preview-box{min-height:0;aspect-ratio:16/9;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:#03060b}
      .rp-takeover-admin .rp-takeover-preview-empty{color:#56667a;font-size:.66rem;font-weight:750;letter-spacing:.08em}
      .rp-takeover-admin .rp-takeover-clean-details{overflow:hidden;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(8,13,22,.62)}
      .rp-takeover-admin .rp-takeover-clean-details summary{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 14px;list-style:none;cursor:pointer;user-select:none}
      .rp-takeover-admin .rp-takeover-clean-details summary::-webkit-details-marker{display:none}
      .rp-takeover-admin .rp-takeover-clean-details summary span{display:grid;gap:2px}
      .rp-takeover-admin .rp-takeover-clean-details summary strong{color:#dfe8f3;font-size:.78rem;font-weight:850}
      .rp-takeover-admin .rp-takeover-clean-details summary small{color:#65768b;font-size:.62rem;font-weight:600}
      .rp-takeover-admin .rp-takeover-clean-details summary b{color:#7f93aa;font-size:1rem;transition:transform .18s ease}
      .rp-takeover-admin .rp-takeover-clean-details[open] summary b{transform:rotate(180deg)}
      .rp-takeover-admin .rp-takeover-clean-details-body{display:grid;gap:11px;padding:1px 14px 14px}
      .rp-takeover-admin .rp-takeover-clean-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
      .rp-takeover-admin .rp-takeover-toggle{min-height:44px;padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(3,7,13,.50)}
      .rp-takeover-admin .rp-takeover-toggle span{color:#c4cfdd;font-size:.72rem;font-weight:750}
      .rp-takeover-admin .rp-takeover-toggle input[type="checkbox"]{appearance:none;-webkit-appearance:none;position:relative;width:40px;height:23px;flex:0 0 40px;margin:0;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#1a2432;cursor:pointer}
      .rp-takeover-admin .rp-takeover-toggle input[type="checkbox"]::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#dbe4ee;box-shadow:0 2px 6px rgba(0,0,0,.34);transition:transform .16s ease}
      .rp-takeover-admin .rp-takeover-toggle input[type="checkbox"]:checked{border-color:transparent;background:linear-gradient(135deg,#1778ff,#42d8ff)}
      .rp-takeover-admin .rp-takeover-toggle input[type="checkbox"]:checked::after{transform:translateX(17px);background:#04111c}
      .rp-takeover-admin .rp-takeover-actions{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:9px;margin-top:2px}
      .rp-takeover-admin .rp-takeover-actions button{min-height:43px;padding:9px 12px;border-radius:11px;font-size:.72rem;font-weight:850;letter-spacing:.01em;text-transform:none;box-shadow:none}
      .rp-takeover-admin .rp-takeover-preview-btn,.rp-takeover-admin .rp-takeover-actions [data-rp-takeover-test-launch]{grid-column:auto!important;background:#0b1522!important;color:#dfe8f4!important;border-color:rgba(66,216,255,.15)!important}
      .rp-takeover-admin .rp-takeover-publish-btn{grid-column:1/-1!important;min-height:49px!important;border:0!important;background:linear-gradient(135deg,#1778ff,#42d8ff);color:#03101b;font-size:.77rem!important;font-weight:950!important}
      .rp-takeover-admin .rp-takeover-deactivate-btn{grid-column:1/-1!important;justify-self:center;width:auto;min-height:32px!important;margin-top:1px;padding:5px 9px!important;border:0!important;background:transparent!important;color:#ff6d84;font-size:.68rem!important;box-shadow:none!important}
      .rp-takeover-admin .rp-takeover-status{min-height:18px;margin:0;padding:0 3px;color:#7e8ea2;font-size:.68rem;line-height:1.4}
      @media(max-width:560px){
        .rp-takeover-admin .rp-takeover-admin-shell{padding:max(13px,env(safe-area-inset-top)) 13px max(24px,env(safe-area-inset-bottom))}
        .rp-takeover-admin .rp-takeover-admin-note{margin-left:50px}
        .rp-takeover-admin .rp-takeover-clean-section{padding:13px;border-radius:16px}
        .rp-takeover-admin .rp-takeover-clean-section-head{align-items:flex-start;flex-direction:column;gap:2px}
        .rp-takeover-admin .rp-takeover-clean-section-head span{text-align:left}
      }
      @media(max-width:390px){.rp-takeover-admin .rp-takeover-clean-grid{grid-template-columns:1fr!important}.rp-takeover-admin .rp-takeover-admin-note{margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function fieldFor(form, selector) {
    return form.querySelector(selector)?.closest('.rp-takeover-field') || null;
  }

  function renameField(form, selector, text) {
    const label = fieldFor(form, selector)?.querySelector(':scope > span');
    setText(label, text);
  }

  function makeSection(title, helper, className) {
    const section = document.createElement('section');
    section.className = `rp-takeover-clean-section ${className || ''}`.trim();
    const head = document.createElement('div');
    head.className = 'rp-takeover-clean-section-head';
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = title;
    span.textContent = helper;
    head.append(strong, span);
    section.appendChild(head);
    return section;
  }

  function makeDetails(title, helper) {
    const details = document.createElement('details');
    details.className = 'rp-takeover-clean-details';
    const summary = document.createElement('summary');
    const copy = document.createElement('span');
    const strong = document.createElement('strong');
    const small = document.createElement('small');
    const chevron = document.createElement('b');
    strong.textContent = title;
    small.textContent = helper;
    chevron.textContent = '⌄';
    copy.append(strong, small);
    summary.append(copy, chevron);
    const body = document.createElement('div');
    body.className = 'rp-takeover-clean-details-body';
    details.append(summary, body);
    return { details, body };
  }

  function polishActions(form) {
    const actions = form.querySelector('.rp-takeover-actions');
    if (!actions) return false;
    setText(actions.querySelector('[data-rp-takeover-preview]'), 'Preview');
    const test = actions.querySelector('[data-rp-takeover-test-launch]');
    setText(test, 'Test on app open');
    if (test) {
      test.style.removeProperty('grid-column');
      test.style.removeProperty('background');
      test.style.removeProperty('color');
      test.style.removeProperty('border-color');
    }
    setText(actions.querySelector('.rp-takeover-publish-btn'), 'Publish announcement');
    setText(actions.querySelector('[data-rp-takeover-deactivate]'), 'Deactivate current takeover');
    return Boolean(test);
  }

  function transformAdmin() {
    const admin = document.querySelector('[data-rp-takeover-admin]');
    const form = admin?.querySelector('[data-rp-takeover-form]');
    if (!admin || !form) return false;

    setText(admin.querySelector('.rp-takeover-admin-head small'), 'ADMIN');
    setText(admin.querySelector('.rp-takeover-admin-head h2'), 'Takeover Announcement');
    setText(admin.querySelector('.rp-takeover-admin-note'), 'Create a full-screen message shown when players open the app.');
    polishActions(form);

    if (form.dataset.rpTakeoverCleanV2 === 'true') return true;
    form.dataset.rpTakeoverCleanV2 = 'true';

    renameField(form, '[data-rp-takeover-file]', 'Upload photo or video');
    renameField(form, '[data-rp-takeover-url]', 'Media URL (optional)');
    renameField(form, '[data-rp-takeover-label-input]', 'Small label (optional)');
    renameField(form, '[data-rp-takeover-cta-input]', 'Button text');
    renameField(form, '[data-rp-takeover-alt]', 'Accessibility description');
    renameField(form, '[data-rp-takeover-type]', 'Media type');
    renameField(form, '[data-rp-takeover-fit]', 'Screen fit');
    renameField(form, '[data-rp-takeover-id]', 'Campaign / version ID');

    const idField = fieldFor(form, '[data-rp-takeover-id]');
    const typeField = fieldFor(form, '[data-rp-takeover-type]');
    const fitField = fieldFor(form, '[data-rp-takeover-fit]');
    const fileField = fieldFor(form, '[data-rp-takeover-file]');
    const urlField = fieldFor(form, '[data-rp-takeover-url]');
    const labelField = fieldFor(form, '[data-rp-takeover-label-input]');
    const altField = fieldFor(form, '[data-rp-takeover-alt]');
    const ctaField = fieldFor(form, '[data-rp-takeover-cta-input]');
    const activeToggle = form.querySelector('[data-rp-takeover-active]')?.closest('.rp-takeover-toggle') || null;
    const loopToggle = form.querySelector('[data-rp-takeover-loop]')?.closest('.rp-takeover-toggle') || null;
    const previewBox = form.querySelector('[data-rp-takeover-preview-box]');
    const actions = form.querySelector('.rp-takeover-actions');
    const status = form.querySelector('[data-rp-takeover-status]');
    const oldGrids = Array.from(form.querySelectorAll(':scope > .rp-takeover-grid'));

    const creative = makeSection('Creative', 'Upload and check what players will see.', 'rp-takeover-clean-creative');
    if (fileField) creative.appendChild(fileField);
    if (urlField) creative.appendChild(urlField);
    if (previewBox) creative.appendChild(previewBox);

    const message = makeSection('Message', 'Keep the acknowledgement short and clear.', 'rp-takeover-clean-message');
    if (labelField) message.appendChild(labelField);
    if (ctaField) message.appendChild(ctaField);
    if (altField) message.appendChild(altField);

    const display = makeDetails('Display settings', 'Media type, fit and playback');
    const displayGrid = document.createElement('div');
    displayGrid.className = 'rp-takeover-grid rp-takeover-clean-grid';
    if (typeField) displayGrid.appendChild(typeField);
    if (fitField) displayGrid.appendChild(fitField);
    if (displayGrid.children.length) display.body.appendChild(displayGrid);
    const toggleGrid = document.createElement('div');
    toggleGrid.className = 'rp-takeover-grid rp-takeover-clean-grid';
    if (activeToggle) toggleGrid.appendChild(activeToggle);
    if (loopToggle) toggleGrid.appendChild(loopToggle);
    if (toggleGrid.children.length) display.body.appendChild(toggleGrid);

    const advanced = makeDetails('Advanced', 'Campaign and version controls');
    if (idField) advanced.body.appendChild(idField);

    oldGrids.forEach((grid) => { if (!grid.children.length) grid.remove(); });
    const anchor = actions || status || null;
    form.insertBefore(creative, anchor);
    form.insertBefore(message, anchor);
    form.insertBefore(display.details, anchor);
    form.insertBefore(advanced.details, anchor);
    polishActions(form);
    return true;
  }

  installStyles();

  // No document-wide MutationObserver here. The old cleanup used one and could
  // recursively react to its own text updates, starving the main thread.
  [0, 80, 220, 500, 1000, 1800, 3000, 4500].forEach((delay) => {
    window.setTimeout(() => {
      transformAdmin();
    }, delay);
  });
})();
