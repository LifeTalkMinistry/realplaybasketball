(() => {
  if (window.__realPlayThreeVThreeClubArtInstalled) return;
  window.__realPlayThreeVThreeClubArtInstalled = true;

  const ART = {
    LIONS: 'assets/3v3/clubs/lions-logo.png',
    VALIANT: 'assets/3v3/clubs/valiant-logo.png',
    WATCHMEN: 'assets/3v3/clubs/watchmen-logo.png',
    CONQUERORS: 'assets/3v3/clubs/conquerors-logo.png',
  };

  const CLUB_CLASSES = ['club-lions', 'club-valiant', 'club-watchmen', 'club-conquerors'];

  function themeClass(name) {
    return `club-${String(name || '').trim().toLowerCase()}`;
  }

  function applyThemeClass(card, clubName) {
    if (!card) return;
    card.classList.remove(...CLUB_CLASSES);
    if (ART[clubName]) card.classList.add(themeClass(clubName));
  }

  function applyViewTheme(view, clubName) {
    if (!view || !ART[clubName]) return;
    view.dataset.rpActiveClub = clubName.toLowerCase();
  }

  function activeCarouselClub(view) {
    const active = view?.querySelector('[data-rp-three-club].slot-active');
    if (!active) return '';
    return String(active.dataset.rpThreeClub || '').trim().toUpperCase();
  }

  function syncViewTheme(view) {
    if (!view) return;

    const fixed = view.querySelector('[data-rp-team-fixed]');
    const fixedName = view.querySelector('[data-rp-fixed-name]');
    const fixedVisible = fixed && !fixed.hidden;
    const clubName = fixedVisible
      ? String(fixedName?.textContent || '').trim().toUpperCase()
      : activeCarouselClub(view);

    if (ART[clubName]) applyViewTheme(view, clubName);
  }

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
    image.alt = `${clubName} club logo`;
    image.decoding = 'async';
    image.loading = 'eager';
    nameNode?.insertAdjacentElement('beforebegin', image);
    card.classList.add('has-club-art');
    applyThemeClass(card, clubName);
  }

  function syncFixedCard(view) {
    const card = view?.querySelector('[data-rp-team-fixed-card]');
    const nameNode = view?.querySelector('[data-rp-fixed-name]');
    if (!card || !nameNode) return;

    const clubName = String(nameNode.textContent || '').trim().toUpperCase();
    let image = card.querySelector('.rp-team-card-logo');
    const src = ART[clubName];
    applyThemeClass(card, clubName);

    if (!src) {
      if (image) image.remove();
      card.classList.remove('has-club-art');
      syncViewTheme(view);
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
    image.alt = `${clubName} club logo`;
    card.classList.add('has-club-art');
    syncViewTheme(view);
  }

  function install() {
    const view = document.querySelector('.rp-3v3-view');
    if (!view) return false;

    const clubCards = [...view.querySelectorAll('[data-rp-three-club]')];
    clubCards.forEach(addLogoToCard);
    syncFixedCard(view);
    syncViewTheme(view);

    const fixedName = view.querySelector('[data-rp-fixed-name]');
    if (fixedName && !fixedName.__rpClubArtObserved) {
      fixedName.__rpClubArtObserved = true;
      const observer = new MutationObserver(() => syncFixedCard(view));
      observer.observe(fixedName, { childList: true, characterData: true, subtree: true });
    }

    const fixed = view.querySelector('[data-rp-team-fixed]');
    if (fixed && !fixed.__rpClubThemeObserved) {
      fixed.__rpClubThemeObserved = true;
      const observer = new MutationObserver(() => syncViewTheme(view));
      observer.observe(fixed, { attributes: true, attributeFilter: ['hidden'] });
    }

    clubCards.forEach((card) => {
      if (card.__rpClubThemeObserved) return;
      card.__rpClubThemeObserved = true;
      const observer = new MutationObserver(() => {
        if (card.classList.contains('slot-active')) syncViewTheme(view);
      });
      observer.observe(card, { attributes: true, attributeFilter: ['class'] });
    });

    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();