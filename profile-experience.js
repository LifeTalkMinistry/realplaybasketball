(() => {
  const accountView = document.querySelector('[data-auth-view="account"]');
  if (!accountView || accountView.dataset.missionRefined === 'true') return;
  accountView.dataset.missionRefined = 'true';

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

  if (!accountCard) return;

  const identityLabel = accountCard.querySelector('.auth-account-label');
  if (identityLabel) identityLabel.textContent = 'YOUR PLAYER IDENTITY';

  const welcome = document.createElement('section');
  welcome.className = 'auth-mission-welcome';
  welcome.innerHTML = `
    <span class="auth-account-label">YOU'RE PART OF THE MOVEMENT</span>
    <h3><span data-auth-welcome-name>PLAYER</span>, NOW MAKE IT REAL.</h3>
    <p>Real Play exists to get kids and adults moving, competing, connecting, and playing basketball in real life. Your account is only the record. <strong>The court is the point.</strong></p>
    <div class="auth-mission-footer">
      <span>LESS SCREEN. REAL POINTS.</span>
      <button type="button" class="auth-court-cta" data-auth-go-play>COME PLAY</button>
    </div>
  `;
  accountView.insertBefore(welcome, accountCard);

  const record = document.createElement('section');
  record.className = 'auth-record-card';
  record.innerHTML = `
    <span class="auth-account-label">YOUR REAL PLAY RECORD</span>
    <strong>GAMES CREATE STATS.</strong>
    <p>Confirmed games will build your wins, points, assists, rebounds, and MVP history here. What happens on the court becomes your record.</p>
  `;
  accountCard.insertAdjacentElement('afterend', record);

  const numberManager = document.createElement('details');
  numberManager.className = 'auth-number-manager';
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
  record.insertAdjacentElement('afterend', numberManager);

  [...accountView.children].forEach((child) => {
    if (child.classList?.contains('auth-divider') || child.classList?.contains('auth-note')) {
      child.remove();
    }
  });

  if (logoutButton) {
    const footer = document.createElement('div');
    footer.className = 'auth-account-footer';
    footer.appendChild(logoutButton);
    accountView.appendChild(footer);
  }

  const welcomeName = welcome.querySelector('[data-auth-welcome-name]');
  const numberSummary = numberManager.querySelector('[data-auth-number-summary]');

  function playerName() {
    return (accountName?.textContent || 'PLAYER').trim().toUpperCase();
  }

  function syncIdentity() {
    const name = playerName();
    if (welcomeName) welcomeName.textContent = name;

    const number = (accountNumber?.textContent || '#--').trim();
    if (numberSummary) {
      numberSummary.textContent = number === '#--'
        ? 'NOT ASSIGNED'
        : `${number} · SECURED THIS MONTH`;
    }
  }

  function syncHeader() {
    const showingAccount = !accountView.hidden;
    if (panelTitle) {
      panelTitle.textContent = showingAccount ? 'WELCOME TO REAL PLAY.' : 'YOUR COURT ID.';
    }
    if (panelSubtitle) {
      panelSubtitle.textContent = showingAccount
        ? 'Less screen. Real points. Your profile is here to record what you actually do on the court.'
        : 'Log in to your Real Play account or create the player identity that will hold your official on-court history.';
    }
  }

  function refocusSuccessMessage() {
    if (!status || accountView.hidden || !status.classList.contains('success')) return;
    const message = status.textContent || '';
    const numberFocused = /account created|player profile created|is yours for this month/i.test(message);
    if (!numberFocused) return;
    status.textContent = `WELCOME TO REAL PLAY, ${playerName()}. Your player profile is ready. Now get on the court and make it real.`;
  }

  syncIdentity();
  syncHeader();

  const identityObserver = new MutationObserver(() => {
    syncIdentity();
    refocusSuccessMessage();
  });
  [accountName, accountNumber, accountNumberLock].forEach((node) => {
    if (node) identityObserver.observe(node, { childList: true, characterData: true, subtree: true });
  });

  const viewObserver = new MutationObserver(() => {
    syncHeader();
    window.setTimeout(refocusSuccessMessage, 0);
  });
  viewObserver.observe(accountView, { attributes: true, attributeFilter: ['hidden'] });

  if (status) {
    const statusObserver = new MutationObserver(refocusSuccessMessage);
    statusObserver.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  const notificationsObserver = new MutationObserver(() => {
    const hasUnread = Boolean(notificationsWrap?.querySelector('.auth-notification.unread'));
    numberManager.classList.toggle('has-notice', hasUnread);
  });
  if (notificationsWrap) {
    notificationsObserver.observe(notificationsWrap, {
      attributes: true,
      attributeFilter: ['hidden'],
      childList: true,
      subtree: true,
    });
  }

  const playButton = welcome.querySelector('[data-auth-go-play]');
  if (playButton) {
    playButton.addEventListener('click', () => {
      if (closeButton) closeButton.click();
      window.setTimeout(() => {
        window.location.hash = 'play';
      }, 30);
    });
  }
})();