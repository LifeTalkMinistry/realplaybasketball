(() => {
  let formOpen = false;
  let lastSessionTitle = '';
  let openedAgainstTitle = null;

  function nextTitle(title) {
    const match = String(title || '').match(/#\s*(\d+)/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `BETA CAREER SESSION #${String(next).padStart(3, '0')}`;
  }

  function shortTitle(title) {
    const match = String(title || '').match(/#\s*(\d+)/);
    return match ? `CAREER #${match[1].padStart(3, '0')}` : 'CAREER SESSION';
  }

  function valueAfterDot(text) {
    const value = String(text || '').trim();
    const index = value.indexOf('·');
    return index >= 0 ? value.slice(index + 1).trim() : value;
  }

  function apply() {
    const root = document.querySelector('.rp-admin-control');
    if (!root) return;

    const setupTab = root.querySelector('[data-admin-tab="session"]');
    if (setupTab && setupTab.textContent !== 'SETUP') setupTab.textContent = 'SETUP';
    if (root.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'session') return;

    const body = root.querySelector('[data-admin-body]');
    if (!body) return;

    const pageTitle = [...body.querySelectorAll('.rp-admin-title')].find((item) => item.querySelector('h1')?.textContent.trim() === 'SESSION CONTROL');
    if (pageTitle) pageTitle.remove();

    const form = body.querySelector('[data-new-session-form]');
    const formCard = form?.closest('.rp-admin-card');
    const sessionCard = [...body.querySelectorAll('.rp-admin-card')].find((card) => card !== formCard && !card.classList.contains('soft'));

    let sessionTitle = '';
    if (sessionCard) {
      const heading = sessionCard.querySelector('.rp-admin-card-head strong');
      sessionTitle = sessionCard.dataset.originalTitle || heading?.textContent.trim() || '';
      sessionCard.dataset.originalTitle = sessionTitle;
      lastSessionTitle = sessionTitle;

      if (!sessionCard.dataset.compact) {
        const meta = [...sessionCard.querySelectorAll('.rp-admin-meta span')];
        let when = valueAfterDot(meta[0]?.textContent);
        let where = valueAfterDot(meta[1]?.textContent);
        const capacity = valueAfterDot(meta[2]?.textContent);
        const confirmed = sessionCard.querySelector('.rp-admin-count strong')?.textContent.trim() || '0';
        if (when === 'TIME TO BE ANNOUNCED') when = 'Not set';
        if (where === 'COURT TO BE ANNOUNCED') where = 'Not set';
        const players = String(capacity).toUpperCase() === 'OPEN' ? `${confirmed} confirmed` : `${confirmed} / ${capacity} confirmed`;

        if (heading) heading.textContent = shortTitle(sessionTitle);
        const metaBox = sessionCard.querySelector('.rp-admin-meta');
        if (metaBox) metaBox.innerHTML = `<span><b>DATE</b><em>${when}</em></span><span><b>COURT</b><em>${where}</em></span><span><b>PLAYERS</b><em>${players}</em></span>`;
        sessionCard.querySelector('.rp-admin-count')?.remove();
        sessionCard.classList.add('rp-admin-session-summary');
        sessionCard.dataset.compact = '1';
      }
    } else {
      lastSessionTitle = '';
    }

    if (formOpen && openedAgainstTitle !== null && sessionTitle !== openedAgainstTitle) {
      formOpen = false;
      openedAgainstTitle = null;
    }

    if (!form || !formCard) return;

    const titleInput = form.querySelector('input[name="title"]');
    if (titleInput) {
      titleInput.value = nextTitle(sessionTitle || lastSessionTitle);
      titleInput.closest('label')?.classList.add('rp-admin-hidden-field');
    }

    const locationInput = form.querySelector('input[name="locationName"]');
    const dateInput = form.querySelector('input[name="startsAt"]');
    const capacityInput = form.querySelector('input[name="capacity"]');
    if (locationInput?.closest('label')?.firstChild) locationInput.closest('label').firstChild.nodeValue = 'Court';
    if (dateInput?.closest('label')?.firstChild) dateInput.closest('label').firstChild.nodeValue = 'Date & time';
    if (capacityInput?.closest('label')?.firstChild) capacityInput.closest('label').firstChild.nodeValue = 'Capacity';

    formCard.classList.add('rp-admin-new-session-card');
    formCard.hidden = !formOpen;
    const formHeading = formCard.querySelector('.rp-admin-card-head strong');
    if (formHeading && formHeading.textContent !== 'NEW SESSION') formHeading.textContent = 'NEW SESSION';

    let toggle = body.querySelector('[data-admin-new-session-toggle]');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'rp-admin-new-session-toggle';
      toggle.dataset.adminNewSessionToggle = '1';
      formCard.before(toggle);
      toggle.onclick = () => {
        formOpen = !formOpen;
        openedAgainstTitle = formOpen ? sessionTitle : null;
        apply();
      };
    }

    const toggleText = formOpen ? '− CLOSE NEW SESSION' : (sessionTitle ? '+ OPEN NEXT SESSION' : '+ OPEN SESSION');
    if (toggle.textContent !== toggleText) toggle.textContent = toggleText;
    toggle.classList.toggle('open', formOpen);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
})();
