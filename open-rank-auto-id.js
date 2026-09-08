(() => {
  if (window.__realPlayOpenRankAutoIdInstalled) return;
  window.__realPlayOpenRankAutoIdInstalled = true;

  function permanentSessionLabel(value) {
    const match = String(value || '').trim().match(/^(?:CAREER|OPEN\s+RANK(?:ING\s+SESSION)?)\s*#\s*(\d+)$/i);
    if (!match) return null;
    return `OPEN RANKING SESSION #${String(Number(match[1])).padStart(3, '0')}`;
  }

  function cleanLegacySessionIdentityUi() {
    const control = document.querySelector('.rp-admin-control');
    if (control) {
      control.querySelectorAll('.rp-admin-card-head strong, .rp-admin-session-manage-head span').forEach((node) => {
        const label = permanentSessionLabel(node.textContent);
        if (label && node.textContent !== label) node.textContent = label;
      });

      control.querySelectorAll('.rp-admin-empty strong').forEach((node) => {
        if (node.textContent.trim() === 'NO CAREER SESSION OPEN') node.textContent = 'NO OPEN RANKING SESSION';
      });
      control.querySelectorAll('.rp-admin-empty p').forEach((node) => {
        if (node.textContent.includes('Open a Career session first.')) {
          node.textContent = 'Open an Open Ranking session first.';
        } else if (node.textContent.includes('Create the next Beta Career session')) {
          node.textContent = 'Create the next Open Ranking session below.';
        }
      });
    }

    // Session numbers are now permanent historical identities. Remove the old
    // manual renumber control so an admin cannot accidentally rewrite history.
    document.querySelectorAll('[data-rp-set-open-rank-number]').forEach((button) => button.remove());
  }

  function refineSessionForm() {
    const form = document.querySelector('[data-new-session-form]');
    if (form) {
      const titleInput = form.querySelector('input[name="title"]');
      if (titleInput && !titleInput.dataset.openRankAutoIdReady) {
        titleInput.dataset.openRankAutoIdReady = 'true';
        titleInput.required = false;
        titleInput.placeholder = 'OPTIONAL — E.G. AMAZING VS IBC';

        const label = titleInput.closest('label');
        if (label) {
          const firstText = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (firstText) firstText.textContent = 'Optional display name';

          const helper = document.createElement('small');
          helper.textContent = 'SESSION NUMBER IS ASSIGNED AUTOMATICALLY AND STAYS WITH THAT SESSION.';
          helper.style.color = '#61748a';
          helper.style.fontSize = '.48rem';
          helper.style.fontWeight = '900';
          helper.style.letterSpacing = '.07em';
          helper.style.lineHeight = '1.45';
          label.appendChild(helper);
        }
      }

      const card = form.closest('.rp-admin-card');
      if (card) {
        const heading = card.querySelector('.rp-admin-card-head > strong');
        if (heading && (heading.textContent.trim() === 'OPEN NEW SESSION' || heading.textContent.trim() === 'NEW SESSION')) {
          heading.textContent = 'CREATE NEXT OPEN RANKING SESSION';
        }
      }

      const submit = form.querySelector('button[type="submit"]');
      if (submit && !submit.disabled && (submit.textContent.trim() === 'OPEN SESSION' || submit.textContent.trim() === 'OPEN NEXT RANK')) {
        submit.textContent = 'OPEN NEXT SESSION';
      }

      const adminTitle = document.querySelector('.rp-admin-title');
      if (adminTitle) {
        const kicker = adminTitle.querySelector('.rp-admin-kicker');
        if (kicker?.textContent.trim() === 'BETA OPERATIONS') kicker.textContent = 'OPEN RANKING OPERATIONS';
        const copy = adminTitle.querySelector('p');
        if (copy?.textContent.includes('Open the game your testers can join')) {
          copy.textContent = 'Create the next Open Ranking session. Its official session number is assigned automatically and remains permanent.';
        }
      }
    }

    cleanLegacySessionIdentityUi();
  }

  window.addEventListener('realplay:admin-render', refineSessionForm);
  document.addEventListener('DOMContentLoaded', refineSessionForm, { once: true });

  const observer = new MutationObserver(() => refineSessionForm());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refineSessionForm();
})();
