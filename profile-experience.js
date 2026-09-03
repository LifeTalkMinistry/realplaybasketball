(() => {
  const accountView = document.querySelector('[data-auth-view="account"]');
  if (!accountView || accountView.dataset.profileExperienceV2 === 'true') return;
  accountView.dataset.profileExperienceV2 = 'true';

  if (!document.querySelector('link[href="profile-experience.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'profile-experience.css';
    document.head.appendChild(link);
  }

  const overlay = document.querySelector('[data-auth-overlay]');
  const panel = document.querySelector('.auth-panel');
  const panelTitle = document.querySelector('#real-play-auth-title');
  const panelSubtitle = document.querySelector('.auth-panel > .auth-subtitle');
  const closeButton = document.querySelector('[data-auth-close]');
  const status = document.querySelector('[data-auth-status]');
  const accountCard = accountView.querySelector('.auth-account-card');
  const accountName = accountView.querySelector('[data-auth-account-name]');
  const accountNumber = accountView.querySelector('[data-auth-player-number]');
  const accountNumberLock = accountView.querySelector('[data-auth-number-lock]');
  const nextCard = accountView.querySelector('[data-auth-next-card]');
  const numberRequestForm = accountView.querySelector('[data-auth-number-request-form]');
  const notificationsWrap = accountView.querySelector('[data-auth-notifications-wrap]');
  const logoutButton = accountView.querySelector('[data-auth-logout]');

  if (!panel || !accountCard) return;

  if (accountNumberLock) accountNumberLock.remove();

  const identityLabel = accountCard.querySelector('.auth-account-label');
  if (identityLabel) identityLabel.textContent = 'REAL PLAY PLAYER';

  const welcome = document.createElement('section');
  welcome.className = 'auth-welcome-screen';
  welcome.hidden = true;
  welcome.innerHTML = `
    <span class="auth-welcome-kicker">YOU'RE IN</span>
    <h3>WELCOME TO REAL PLAY,<br><span data-auth-welcome-name>PLAYER</span>.</h3>
    <p>You just joined a community built to get people off the sidelines and back into real play — moving, competing, connecting, and playing basketball in real life.</p>
    <strong class="auth-welcome-tagline">LESS SCREEN. REAL POINTS.</strong>
    <div class="auth-welcome-actions">
      <button type="button" class="auth-welcome-primary" data-auth-enter-profile>VIEW MY PROFILE</button>
      <button type="button" class="auth-welcome-secondary" data-auth-go-play>COME PLAY</button>
    </div>
  `;

  const accountShell = document.createElement('div');
  accountShell.className = 'auth-profile-shell';

  const accountIntro = document.createElement('div');
  accountIntro.className = 'auth-profile-intro';
  accountIntro.innerHTML = `
    <span>PLAYER ACCOUNT</span>
    <strong>IDENTITY & NUMBER MANAGEMENT.</strong>
  `;

  const numberManager = document.createElement('details');
  numberManager.className = 'auth-number-manager auth-number-manager-v2';
  numberManager.innerHTML = `
    <summary>
      <span>
        <small>PLAYER NUMBER</small>
        <strong data-auth-number-summary>NUMBER DETAILS</strong>
      </span>
      <b>MANAGE</b>
    </summary>
    <div class="auth-number-manager-body" data-auth-number-manager-body></div>
  `;

  const managerBody = numberManager.querySelector('[data-auth-number-manager-body]');
  [nextCard, numberRequestForm, notificationsWrap].forEach((node) => {
    if (node) managerBody.appendChild(node);
  });

  accountView.insertBefore(welcome, accountCard);
  accountView.insertBefore(accountShell, accountCard);
  accountShell.append(accountIntro, accountCard, numberManager);

  [...accountView.children].forEach((child) => {
    if (child === welcome || child === accountShell) return;
    if (child.classList?.contains('auth-divider') || child.classList?.contains('auth-note')) child.remove();
  });

  if (logoutButton) {
    const footer = document.createElement('div');
    footer.className = 'auth-account-footer auth-account-footer-v2';
    footer.appendChild(logoutButton);
    accountShell.appendChild(footer);
  }

  const welcomeName = welcome.querySelector('[data-auth-welcome-name]');
  const numberSummary = numberManager.querySelector('[data-auth-number-summary]');
  const enterProfileButton = welcome.querySelector('[data-auth-enter-profile]');
  const playButton = welcome.querySelector('[data-auth-go-play]');

  let welcomeActive = false;

  function playerName() {
    return (accountName?.textContent || 'PLAYER').trim().toUpperCase();
  }

  function syncIdentity() {
    if (welcomeName) welcomeName.textContent = playerName();
    const number = (accountNumber?.textContent || '#--').trim();
    if (numberSummary) numberSummary.textContent = number === '#--' ? 'NOT ASSIGNED' : `${number} · SECURED THIS MONTH`;
  }

  function restoreAccessHeader() {
    if (panelTitle) panelTitle.textContent = 'YOUR COURT ID.';
    if (panelSubtitle) panelSubtitle.textContent = 'Log in to your Real Play account or create the player identity that will hold your official on-court history.';
  }

  function showAccount() {
    welcomeActive = false;
    welcome.hidden = true;
    accountShell.hidden = false;
    panel.classList.remove('welcome-mode');
    panel.classList.add('profile-mode');
    if (panelTitle) panelTitle.textContent = 'PLAYER ACCOUNT.';
    if (panelSubtitle) panelSubtitle.textContent = 'Manage your Real Play identity and player number. Your full player Profile lives in the main menu.';
  }

  function showWelcome() {
    if (accountView.hidden) return;
    welcomeActive = true;
    welcome.hidden = false;
    accountShell.hidden = true;
    panel.classList.remove('profile-mode');
    panel.classList.add('welcome-mode');
    if (panelTitle) panelTitle.textContent = 'WELCOME TO REAL PLAY.';
    if (panelSubtitle) panelSubtitle.textContent = 'Less screen. Real points. You are officially part of the movement.';
  }

  function retireWelcome() {
    if (!welcomeActive) return;
    welcomeActive = false;
    welcome.hidden = true;
    accountShell.hidden = false;
  }

  function syncPanelMode() {
    if (accountView.hidden) {
      panel.classList.remove('profile-mode', 'welcome-mode');
      restoreAccessHeader();
      return;
    }
    if (welcomeActive) showWelcome();
    else showAccount();
  }

  function maybeTriggerWelcome() {
    if (!status || accountView.hidden || !status.classList.contains('success')) return;
    const message = status.textContent || '';
    if (!/real play account created|player profile created/i.test(message)) return;
    syncIdentity();
    showWelcome();
    status.textContent = '';
    status.className = 'auth-status';
  }

  function markNumberNotice() {
    const hasUnread = Boolean(notificationsWrap?.querySelector('.auth-notification.unread'));
    numberManager.classList.toggle('has-notice', hasUnread);
  }

  syncIdentity();
  syncPanelMode();
  markNumberNotice();

  const identityObserver = new MutationObserver(syncIdentity);
  [accountName, accountNumber].forEach((node) => {
    if (node) identityObserver.observe(node, { childList: true, characterData: true, subtree: true });
  });

  const viewObserver = new MutationObserver(syncPanelMode);
  viewObserver.observe(accountView, { attributes: true, attributeFilter: ['hidden'] });

  if (status) {
    const statusObserver = new MutationObserver(() => window.setTimeout(maybeTriggerWelcome, 0));
    statusObserver.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  if (notificationsWrap) {
    const notificationsObserver = new MutationObserver(markNumberNotice);
    notificationsObserver.observe(notificationsWrap, {
      attributes: true,
      attributeFilter: ['hidden'],
      childList: true,
      subtree: true,
    });
  }

  if (overlay) {
    const overlayObserver = new MutationObserver(() => {
      if (!overlay.classList.contains('open')) retireWelcome();
    });
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  if (enterProfileButton) {
    enterProfileButton.addEventListener('click', () => {
      retireWelcome();
      closeButton?.click();
      window.setTimeout(() => {
        if (window.RealPlayProfile?.open) window.RealPlayProfile.open();
        else showAccount();
      }, 40);
    });
  }

  if (playButton) {
    playButton.addEventListener('click', () => {
      retireWelcome();
      closeButton?.click();
      window.setTimeout(() => { window.location.hash = 'play'; }, 30);
    });
  }
})();