(() => {
  if (window.__realPlayThreeVThreeRefinementInstalled) return;
  window.__realPlayThreeVThreeRefinementInstalled = true;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function normalizeBetaSeasonName(value = '') {
    return String(value)
      .replace(/\bBETA\s+SEASON\s*#?\s*1\b/gi, 'BETA SEASON')
      .replace(/\bBETA\s+SEASON\s+ONE\b/gi, 'BETA SEASON');
  }

  function closeBetaInfo(view) {
    const sheet = view?.querySelector('[data-rp-beta-season-info]');
    const trigger = view?.querySelector('[data-rp-beta-season-info-open]');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function ensureBetaInfo(view) {
    const session = view.querySelector('[data-rp-3v3-session]');
    if (!session) return;

    let summary = session.querySelector('[data-rp-beta-session-summary]');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'rp-3v3-session-summary';
      summary.dataset.rpBetaSessionSummary = '1';
      summary.innerHTML = `
        <strong>REAL PLAY 3V3 BETA SEASON</strong>
        <button type="button" aria-label="About the Real Play 3v3 Beta Season" aria-expanded="false" data-rp-beta-season-info-open>i</button>
      `;
      session.prepend(summary);
    }

    let sheet = view.querySelector('[data-rp-beta-season-info]');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'rp-3v3-beta-info';
      sheet.dataset.rpBetaSeasonInfo = '1';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = `
        <section class="rp-3v3-beta-info-card" role="dialog" aria-modal="true" aria-labelledby="rp-3v3-beta-info-title">
          <header>
            <div>
              <small>FIRST OFFICIAL 3V3 LEAGUE</small>
              <h2 id="rp-3v3-beta-info-title">REAL PLAY 3V3 BETA SEASON</h2>
            </div>
            <button type="button" aria-label="Close Beta Season information" data-rp-beta-season-info-close>×</button>
          </header>
          <div class="rp-3v3-beta-info-status">
            <span data-rp-beta-info-meta>ROSTER REGISTRATION</span>
            <b data-rp-beta-info-count>—</b>
          </div>
          <p class="rp-3v3-beta-info-roster" data-rp-beta-info-roster>Checking the launch roster.</p>
          <p class="rp-3v3-beta-info-note">This is the Beta Season. Real Play Season 1 begins after the Beta Season ends.</p>
        </section>
      `;
      view.appendChild(sheet);

      const trigger = summary.querySelector('[data-rp-beta-season-info-open]');
      const close = sheet.querySelector('[data-rp-beta-season-info-close]');
      trigger?.addEventListener('click', () => {
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        trigger.setAttribute('aria-expanded', 'true');
        close?.focus({ preventScroll: true });
      });
      close?.addEventListener('click', () => {
        closeBetaInfo(view);
        trigger?.focus({ preventScroll: true });
      });
      sheet.addEventListener('click', (event) => {
        if (event.target === sheet) closeBetaInfo(view);
      });
      view.querySelector('[data-rp-3v3-back]')?.addEventListener('click', () => closeBetaInfo(view));
    }

    const sessionTitle = view.querySelector('[data-rp-session-title]');
    const sessionMeta = view.querySelector('[data-rp-session-meta]');
    const sessionCount = view.querySelector('[data-rp-session-count]');
    const rosterNeeded = view.querySelector('[data-rp-roster-needed]');

    if (sessionTitle) {
      const safeTitle = normalizeBetaSeasonName(sessionTitle.textContent.trim());
      setText(sessionTitle, safeTitle);
    }

    setText(sheet.querySelector('[data-rp-beta-info-meta]'), sessionMeta?.textContent.trim() || 'ROSTER REGISTRATION');
    setText(sheet.querySelector('[data-rp-beta-info-count]'), sessionCount?.textContent.trim() || '—');
    setText(sheet.querySelector('[data-rp-beta-info-roster]'), rosterNeeded?.textContent.trim() || 'Checking the launch roster.');
  }

  function refine() {
    const view = document.querySelector('.rp-3v3-view');
    if (!view) return false;

    const fixedCard = view.querySelector('[data-rp-team-fixed-card]');
    const kicker = view.querySelector('[data-rp-fixed-kicker]');
    const badge = view.querySelector('[data-rp-fixed-badge]');
    const change = view.querySelector('[data-rp-team-change]');
    const action = view.querySelector('[data-rp-session-action]');

    if (fixedCard) {
      const official = fixedCard.classList.contains('official');
      setText(kicker, official ? 'YOUR OFFICIAL TEAM' : 'PREFERRED TEAM');
      setText(badge, official ? 'OFFICIAL TEAM' : 'FINAL TEAM ASSIGNMENT PENDING');
      if (!official) setText(change, 'CHANGE PREFERENCE');
    }

    if (action && action.textContent.trim() === 'SECURE SPOT') {
      setText(action, 'SECURE MY SPOT');
    }

    ensureBetaInfo(view);
    return true;
  }

  let queued = false;
  function queueRefine() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      refine();
    });
  }

  if (!refine()) {
    const mountObserver = new MutationObserver(() => {
      if (refine()) mountObserver.disconnect();
    });
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const viewObserver = new MutationObserver(queueRefine);
  const attachObserver = () => {
    const view = document.querySelector('.rp-3v3-view');
    if (!view || view.dataset.rpRefinementObserved === 'true') return false;
    view.dataset.rpRefinementObserved = 'true';
    viewObserver.observe(view, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'disabled'],
    });
    refine();
    return true;
  };

  if (!attachObserver()) {
    const observer = new MutationObserver(() => {
      if (attachObserver()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const view = document.querySelector('.rp-3v3-view');
    if (view?.querySelector('[data-rp-beta-season-info].open')) closeBetaInfo(view);
  });
})();
