(() => {
  if (window.__realPlayPlayerNumberRecoveryInstalled) return;
  window.__realPlayPlayerNumberRecoveryInstalled = true;

  function openAccount() {
    document.querySelector('[data-auth-open]')?.click();
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function setNodeValue(node, value) {
    if (node && node.nodeValue !== value) node.nodeValue = value;
  }

  function ensureStyle() {
    if (document.querySelector('[data-rp-number-recovery-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpNumberRecoveryStyle = '1';
    style.textContent = '[data-rp-number].rp-number-missing{cursor:pointer;border-color:rgba(55,225,255,.68)!important;color:#55e8ff!important;box-shadow:0 0 18px rgba(35,185,255,.12)}[data-rp-number].rp-number-missing:focus{outline:2px solid rgba(55,225,255,.75);outline-offset:2px}';
    document.head.appendChild(style);
  }

  function sync() {
    const accountNumber = document.querySelector('[data-auth-player-number]');
    const numberBox = document.querySelector('[data-rp-number]');
    const form = document.querySelector('[data-auth-number-request-form]');
    if (!accountNumber || !numberBox || !form) return;

    const missing = ['#--', '#—', '#?'].includes(accountNumber.textContent.trim());
    ensureStyle();
    numberBox.classList.toggle('rp-number-missing', missing);

    const label = form.querySelector('label');
    const submit = form.querySelector('button[type="submit"]');
    const note = form.querySelector('.auth-note');
    const lock = document.querySelector('[data-auth-number-lock]');
    const nextNumber = document.querySelector('[data-auth-next-number]');
    const nextStatus = document.querySelector('[data-auth-next-status]');

    if (missing) {
      setText(numberBox, '#?');
      numberBox.setAttribute('role', 'button');
      numberBox.setAttribute('tabindex', '0');
      numberBox.setAttribute('aria-label', 'Choose your Real Play player number');
      form.dataset.currentNumberRecovery = '1';
      setNodeValue(label?.firstChild, 'Choose your player number ');
      if (submit && !submit.disabled) setText(submit, 'CLAIM NUMBER');
      setText(note, 'Your profile has no current player number. Choose any available number from 0–99. If it is free, it becomes yours immediately for the rest of this month.');
      setText(lock, 'PLAYER NUMBER REQUIRED');
      setText(nextNumber, 'Choose your current number first.');
      setText(nextStatus, 'After your current number is secured, next-month options work normally.');
    } else {
      numberBox.removeAttribute('role');
      numberBox.removeAttribute('tabindex');
      numberBox.removeAttribute('aria-label');
      if (form.dataset.currentNumberRecovery === '1') {
        delete form.dataset.currentNumberRecovery;
        setNodeValue(label?.firstChild, 'Want a different number next month? ');
        if (submit && !submit.disabled) setText(submit, 'CHECK / REQUEST');
      }
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-rp-number].rp-number-missing')) return;
    event.preventDefault();
    openAccount();
    setTimeout(sync, 50);
  });

  document.addEventListener('keydown', (event) => {
    if (!event.target.closest?.('[data-rp-number].rp-number-missing')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openAccount();
    setTimeout(sync, 50);
  });

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }).observe(document.body, { childList: true, characterData: true, subtree: true });

  sync();
  setTimeout(sync, 600);
})();
