(() => {
  const hero = document.querySelector('[data-public-hero-default]');
  if (!hero || hero.querySelector('[data-public-founder-credit]')) return;

  const credit = document.createElement('p');
  credit.className = 'rp-public-founder-credit';
  credit.dataset.publicFounderCredit = 'true';
  credit.setAttribute('aria-label', 'A project by Max Emorej');
  credit.innerHTML = '<span>A PROJECT BY</span><strong>MAX EMOREJ</strong>';

  const more = hero.querySelector('.rp-public-more');
  if (more) more.insertAdjacentElement('afterend', credit);
  else hero.appendChild(credit);
})();
