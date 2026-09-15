(() => {
  if (window.__realPlayStandaloneAuditInstalled) return;
  window.__realPlayStandaloneAuditInstalled = true;

  // FUTURE/LIVE courtside scoring remains retired. This legacy-loaded file now
  // owns only the standalone recorded-game Audit bridge so Audit can operate
  // without a public Open Session.
  const CAREER_CONTROL_PATH = '/api/real-play/admin/career/control';
  const AUDIT_CONTROL_PATH = '/api/real-play/admin/audit/control';
  const RECORDED_SUBMIT_PATH = '/api/real-play/admin/recorded-scoring/submit-draft';
  const AUDIT_SUBMIT_PATH = '/api/real-play/admin/audit/submit-draft';
  const nativeFetch = window.fetch.bind(window);
  let auditAuthorityActive = false;

  function isAuditTab(button) {
    return Boolean(button?.matches?.('[data-rp-video-tab]'))
      || String(button?.textContent || '').trim().toUpperCase() === 'AUDIT';
  }

  function isFinalizeTab(button) {
    return String(button?.dataset?.adminTab || '').toLowerCase() === 'finalize'
      || String(button?.textContent || '').trim().toUpperCase() === 'FINALIZE';
  }

  function isNonAuditAdminTab(button) {
    if (!button?.matches?.('.rp-admin-tab, [data-rp-video-tab]')) return false;
    return !isAuditTab(button) && !isFinalizeTab(button);
  }

  function routeAuditRequest(input) {
    if (!auditAuthorityActive) return input;
    if (typeof input !== 'string' && !(input instanceof URL)) return input;
    const raw = String(input);
    try {
      const url = new URL(raw, window.location.origin);
      if (url.pathname === CAREER_CONTROL_PATH) url.pathname = AUDIT_CONTROL_PATH;
      else if (url.pathname === RECORDED_SUBMIT_PATH) url.pathname = AUDIT_SUBMIT_PATH;
      else return input;
      if (/^https?:/i.test(raw)) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_error) {
      return input;
    }
  }

  window.fetch = function realPlayAuditFetch(input, init) {
    return nativeFetch(routeAuditRequest(input), init);
  };

  function unlockAndRenameAuditTab() {
    const tab = document.querySelector('[data-rp-video-tab]');
    if (!tab) return;

    if (tab.hidden) tab.hidden = false;
    if (tab.hasAttribute('hidden')) tab.removeAttribute('hidden');
    if (tab.getAttribute('aria-hidden') !== 'false') tab.setAttribute('aria-hidden', 'false');
    if (tab.tabIndex !== 0) tab.tabIndex = 0;
    if (String(tab.textContent || '').trim().toUpperCase() !== 'AUDIT') {
      tab.textContent = 'AUDIT';
    }
  }

  function retitleAuditWorkspace() {
    if (!auditAuthorityActive) return;
    const body = document.querySelector('[data-admin-body]');
    if (!body) return;
    const title = body.querySelector('.rp-admin-title h1');
    const kicker = body.querySelector('.rp-admin-title .rp-admin-kicker');
    const paragraph = body.querySelector('.rp-admin-title p');
    const current = String(title?.textContent || '').trim().toUpperCase();
    if (title && ['VIDEO REVIEW', 'RECORDED SCORING'].includes(current)) {
      title.textContent = 'GAME AUDIT';
    }
    if (kicker && /RECORDED SCORING|POST-GAME WORKFLOW/i.test(kicker.textContent || '')) {
      kicker.textContent = 'OFFICIAL GAME VERIFICATION';
    }
    if (paragraph && /Upload the full game|Loading the current Real Play game/i.test(paragraph.textContent || '')) {
      paragraph.textContent = 'Paste the recorded game link, set the roster and rules, then verify the official stats.';
    }
  }

  function sync() {
    unlockAndRenameAuditTab();
    retitleAuditWorkspace();
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.rp-admin-tab, [data-rp-video-tab]');
    if (!button) return;
    if (isAuditTab(button) || isFinalizeTab(button)) {
      auditAuthorityActive = true;
    } else if (isNonAuditAdminTab(button)) {
      auditAuthorityActive = false;
    }
    window.__realPlayAuditAuthorityActive = auditAuthorityActive;
    queueMicrotask(sync);
  }, true);

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'aria-hidden'],
  });

  window.__realPlayOpenStandaloneAudit = () => {
    unlockAndRenameAuditTab();
    const tab = document.querySelector('[data-rp-video-tab]');
    if (!tab) return false;
    auditAuthorityActive = true;
    window.__realPlayAuditAuthorityActive = true;
    tab.click();
    return true;
  };

  sync();
})();
