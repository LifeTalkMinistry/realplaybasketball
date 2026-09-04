(() => {
  if (window.__realPlayThreeVThreeClubArtInstalled) return;
  window.__realPlayThreeVThreeClubArtInstalled = true;

  const ART = {
    LIONS: 'assets/3v3/clubs/lions-logo.png',
  };

  function addLogoToCard(card) {
    if (!card || card.querySelector('.rp-team-card-logo')) return;
    const clubId = String(card.dataset.rpThreeClub || '').toUpperCase();
    const nameNode = card.querySelector('strong');
    const clubName = String(nameNode?.textContent || clubId).trim().toUpperCase();
    const src = ART[clubName];
    if (!src) return;

    const image = document.createElement('img');
    image.className = 'rp-team-card-logo';
    image.src = src;
    image.alt = clubName;
    image.decoding = 'async';
    image.loading = 'eager';
    nameNode?.insertAdjacentElement('beforebegin', image);
    card.classList.add('has-club-art');
  }

  function syncFixedCard(view) {
    const card = view?.querySelector('[data-rp-team-fixed-card]');
    const nameNode = view?.querySelector('[data-rp-fixed-name]');
    if (!card || !nameNode) return;

    const clubName = String(nameNode.textContent || '').trim().toUpperCase();
    let image = card.querySelector('.rp-team-card-logo');
    const src = ART[clubName];

    if (!src) {
      if (image) image.remove();
      card.classList.remove('has-club-art');
      return;
    }

    if (!image) {
      image = document.createElement('img');
      image.className = 'rp-team-card-logo';
      image.decoding = 'async';
      image.loading = 'eager';
      nameNode.insertAdjacentElement('beforebegin', image);
    }

    image.src = src;
    image.alt = clubName;
    card.classList.add('has-club-art');
  }

  function install() {
    const view = document.querySelector('.rp-3v3-view');
    if (!view) return false;

    view.querySelectorAll('[data-rp-three-club]').forEach(addLogoToCard);
    syncFixedCard(view);

    const fixedName = view.querySelector('[data-rp-fixed-name]');
    if (fixedName && !fixedName.__rpClubArtObserved) {
      fixedName.__rpClubArtObserved = true;
      const observer = new MutationObserver(() => syncFixedCard(view));
      observer.observe(fixedName, { childList: true, characterData: true, subtree: true });
    }

    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
