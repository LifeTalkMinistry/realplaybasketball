(() => {
  if (window.__realPlayOpenRankAutoIdInstalled) return;
  window.__realPlayOpenRankAutoIdInstalled = true;

  function refineSessionForm() {
    const form = document.querySelector('[data-new-session-form]');
    if (!form) return;

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
        helper.textContent = 'OPEN RANK NUMBER IS ASSIGNED AUTOMATICALLY BY DEFAULT · ADMIN CAN CORRECT IT LATER.';
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
      if (heading && heading.textContent.trim() === 'OPEN NEW SESSION') {
        heading.textContent = 'CREATE NEXT OPEN RANK';
      }
    }

    const submit = form.querySelector('button[type="submit"]');
    if (submit && !submit.disabled && submit.textContent.trim() === 'OPEN SESSION') {
      submit.textContent = 'OPEN NEXT RANK';
    }

    const adminTitle = document.querySelector('.rp-admin-title');
    if (adminTitle) {
      const kicker = adminTitle.querySelector('.rp-admin-kicker');
      if (kicker?.textContent.trim() === 'BETA OPERATIONS') kicker.textContent = 'OPEN RANK OPERATIONS';
      const copy = adminTitle.querySelector('p');
      if (copy?.textContent.includes('Open the game your testers can join')) {
        copy.textContent = 'Create the next official Open Rank. A number is assigned automatically by default and can be corrected by Admin.';
      }
    }

    document.querySelectorAll('.rp-admin-empty p').forEach((copy) => {
      if (copy.textContent.includes('Create the next Beta Career session')) {
        copy.textContent = 'Create the next Open Rank below. Admin can correct its public Open Rank number later.';
      }
    });
  }

  window.addEventListener('realplay:admin-render', refineSessionForm);
  document.addEventListener('DOMContentLoaded', refineSessionForm, { once: true });

  const observer = new MutationObserver(() => refineSessionForm());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refineSessionForm();
})();
