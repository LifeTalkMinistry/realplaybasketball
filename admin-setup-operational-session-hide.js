(() => {
  if (window.__realPlayOperationalSessionSetupHiddenInstalled) return;
  window.__realPlayOperationalSessionSetupHiddenInstalled = true;

  const HIDDEN_ATTR = 'data-rp-legacy-operational-session-hidden';
  let queued = false;

  function ensureStyle() {
    if (document.querySelector('[data-rp-operational-session-hide-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpOperationalSessionHideStyle = '1';
    style.textContent = `
      [${HIDDEN_ATTR}]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function markHidden(node) {
    if (!node || node.hasAttribute(HIDDEN_ATTR)) return;
    node.setAttribute(HIDDEN_ATTR, '1');
    node.setAttribute('aria-hidden', 'true');
  }

  function isLegacyOperationalSessionCard(card, formCard) {
    if (!card || card === formCard || card.classList.contains('soft')) return false;
    if (card.querySelector('[data-admin-session-manage-toggle]')) return true;

    const heading = String(card.querySelector('.rp-admin-card-head strong')?.textContent || '')
      .trim()
      .toUpperCase();
    if (/^(?:BETA\s+)?CAREER\s+SESSION(?:\s+#\d+)?$/.test(heading)) return true;
    if (/^CAREER\s+#\d+$/.test(heading)) return true;

    const labels = [...card.querySelectorAll('.rp-admin-meta b')]
      .map((node) => String(node.textContent || '').trim().toUpperCase());
    return labels.includes('DATE') && labels.includes('COURT') && labels.includes('PLAYERS');
  }

  function cleanupSetup() {
    queued = false;
    ensureStyle();

    const root = document.querySelector('.rp-admin-control');
    if (!root) return;
    if (root.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'session') return;

    const body = root.querySelector('[data-admin-body]');
    if (!body) return;

    // Keep the operational session DOM/data alive for backend/game workflows,
    // but remove it from the Setup surface. The Home pencil owns the public
    // schedule confirmation now.
    const form = body.querySelector('[data-new-session-form]');
    const formCard = form?.closest('.rp-admin-card');
    if (formCard) markHidden(formCard);
    body.querySelectorAll('[data-admin-new-session-toggle]').forEach(markHidden);

    [...body.querySelectorAll('.rp-admin-card')]
      .filter((card) => isLegacyOperationalSessionCard(card, formCard))
      .forEach(markHidden);
  }

  function queueCleanup() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(cleanupSetup);
  }

  const observer = new MutationObserver(queueCleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', queueCleanup);
  window.addEventListener('realplay:app-ready', queueCleanup);
  window.addEventListener('focus', queueCleanup);
  document.addEventListener('click', queueCleanup, true);

  queueCleanup();
})();
