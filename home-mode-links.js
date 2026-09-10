(() => {
  if (window.__realPlayHomeModeLinksInstalled) return;
  window.__realPlayHomeModeLinksInstalled = true;

  function openThreeVThree(attempt = 0) {
    const trigger = document.querySelector('[data-rp-enter-3v3]');
    if (trigger) {
      trigger.click();
      return;
    }
    if (attempt < 10) {
      window.setTimeout(() => openThreeVThree(attempt + 1), 80);
      return;
    }
    window.RealPlayUpdates?.open?.();
  }

  function openOpenRank(attempt = 0) {
    if (window.RealPlayRankingGames?.open) {
      window.RealPlayRankingGames.open();
      return;
    }
    if (attempt < 10) {
      window.setTimeout(() => openOpenRank(attempt + 1), 80);
      return;
    }
    window.RealPlayUpdates?.open?.();
  }

  function closeThreeVThreeIfOpen() {
    const view = document.querySelector('.rp-3v3-view.open');
    if (!view) return false;

    const back = view.querySelector('[data-rp-3v3-back]') || document.querySelector('[data-rp-3v3-back]');
    if (back) {
      back.click();
    } else {
      view.classList.remove('open');
      view.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-3v3-open');
    }
    return true;
  }

  function closeOpenRankIfOpen() {
    const view = document.querySelector('[data-rp-ranking-games].open, .rp-ranking-view.open');
    if (!view) return false;

    if (window.RealPlayRankingGames?.close) {
      window.RealPlayRankingGames.close();
    } else {
      view.classList.remove('open');
      view.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-ranking-open');
    }
    return true;
  }

  function closeModeLayersForNavigation() {
    closeThreeVThreeIfOpen();
    closeOpenRankIfOpen();
  }

  function activateCard(card) {
    if (!card) return;
    if (card.matches('[data-rp-home-3v3]')) {
      openThreeVThree();
      return;
    }
    if (card.matches('[data-rp-home-open-rank]')) {
      openOpenRank();
    }
  }

  function makeCardsAccessible() {
    const threeVThree = document.querySelector('[data-rp-home-3v3]');
    const openRank = document.querySelector('[data-rp-home-open-rank]');
    [
      [threeVThree, 'Open the existing Real Play 3v3 League setup'],
      [openRank, 'Open the existing Real Play Open Rank setup'],
    ].forEach(([card, label]) => {
      if (!card) return;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', label);
    });
  }

  document.addEventListener('click', (event) => {
    const navItem = event.target.closest('[data-rp-simple-nav-item]');
    if (!navItem) return;
    closeModeLayersForNavigation();
  }, true);

  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-rp-home-3v3], [data-rp-home-open-rank]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    activateCard(card);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest?.('[data-rp-home-3v3], [data-rp-home-open-rank]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    activateCard(card);
  }, true);

  const observer = new MutationObserver(makeCardsAccessible);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  makeCardsAccessible();
})();
