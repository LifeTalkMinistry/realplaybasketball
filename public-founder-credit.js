(() => {
  function buildCredit({ home = false } = {}) {
    const credit = document.createElement('p');
    credit.className = home
      ? 'rp-public-founder-credit rp-home-project-credit'
      : 'rp-public-founder-credit';
    if (home) credit.dataset.rpHomeProjectCredit = 'true';
    else credit.dataset.publicFounderCredit = 'true';
    credit.setAttribute('aria-label', 'Project by Max Emorej');
    credit.innerHTML = '<span>PROJECT BY:</span><strong>MAX EMOREJ</strong>';
    return credit;
  }

  const hero = document.querySelector('[data-public-hero-default]');
  if (hero && !hero.querySelector('[data-public-founder-credit]')) {
    const credit = buildCredit();
    const more = hero.querySelector('.rp-public-more');
    if (more) more.insertAdjacentElement('afterend', credit);
    else hero.appendChild(credit);
  }

  const home = document.querySelector('[data-rp-simple-home]');
  if (home && !home.querySelector('[data-rp-home-project-credit]')) {
    const credit = buildCredit({ home: true });
    const whatsComing = home.querySelector('[data-rp-home-whats-coming]');
    if (whatsComing) whatsComing.insertAdjacentElement('afterend', credit);
    else home.appendChild(credit);
  }
})();
