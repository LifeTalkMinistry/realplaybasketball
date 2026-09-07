(() => {
  if (window.__realPlayVisitorModeInstalled) return;
  window.__realPlayVisitorModeInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';

  const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));
  const isActive = () => !hasToken() && localStorage.getItem(VISITOR_KEY) === '1';

  function emit(active) {
    window.dispatchEvent(new CustomEvent('realplay:visitorchange', { detail: { visitor: Boolean(active) } }));
  }

  function enter() {
    if (hasToken()) return false;
    localStorage.setItem(VISITOR_KEY, '1');
    document.body.classList.add('rp-visitor-active');
    document.body.classList.remove('rp-guest-active');
    document.querySelector('[data-rp-app]')?.classList.add('rp-visitor');
    document.querySelector('[data-rp-app]')?.classList.remove('rp-guest');
    emit(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }

  function exit() {
    localStorage.removeItem(VISITOR_KEY);
    document.body.classList.remove('rp-visitor-active');
    document.querySelector('[data-rp-app]')?.classList.remove('rp-visitor');
    emit(false);
  }

  function openAuth(view = 'signup') {
    document.querySelector('[data-auth-open]')?.click();
    window.setTimeout(() => document.querySelector(`[data-auth-tab="${view}"]`)?.click(), 30);
  }

  const gate = document.createElement('div');
  gate.className = 'rp-visitor-gate';
  gate.dataset.rpVisitorGate = 'true';
  gate.setAttribute('aria-hidden', 'true');
  gate.innerHTML = `
    <section class="rp-visitor-gate-card" role="dialog" aria-modal="true" aria-labelledby="rp-visitor-gate-title">
      <button type="button" class="rp-visitor-gate-close" data-rp-visitor-gate-close aria-label="Close">×</button>
      <small>REAL PLAY VISITOR MODE</small>
      <h2 id="rp-visitor-gate-title" data-rp-visitor-gate-title>READY TO JOIN IN?</h2>
      <p data-rp-visitor-gate-copy>Create your Real Play player to interact with the community and build your basketball record.</p>
      <button type="button" class="rp-visitor-gate-primary" data-rp-visitor-create>CREATE MY PLAYER</button>
      <button type="button" class="rp-visitor-gate-login" data-rp-visitor-login>I ALREADY HAVE AN ACCOUNT</button>
      <button type="button" class="rp-visitor-gate-later" data-rp-visitor-gate-close>KEEP BROWSING</button>
    </section>`;
  document.body.appendChild(gate);

  function closeGate() {
    gate.classList.remove('open');
    gate.setAttribute('aria-hidden', 'true');
  }

  function requireAccount(options = {}) {
    if (hasToken()) return true;
    const title = String(options.title || 'READY TO JOIN IN?').trim();
    const copy = String(options.copy || 'Create your Real Play player to interact with the community and build your basketball record.').trim();
    const titleNode = gate.querySelector('[data-rp-visitor-gate-title]');
    const copyNode = gate.querySelector('[data-rp-visitor-gate-copy]');
    if (titleNode) titleNode.textContent = title;
    if (copyNode) copyNode.textContent = copy;
    gate.classList.add('open');
    gate.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => gate.querySelector('[data-rp-visitor-create]')?.focus(), 20);
    return false;
  }

  gate.querySelectorAll('[data-rp-visitor-gate-close]').forEach((button) => button.addEventListener('click', closeGate));
  gate.addEventListener('click', (event) => { if (event.target === gate) closeGate(); });
  gate.querySelector('[data-rp-visitor-create]')?.addEventListener('click', () => { closeGate(); openAuth('signup'); });
  gate.querySelector('[data-rp-visitor-login]')?.addEventListener('click', () => { closeGate(); openAuth('login'); });

  function installLandingButton() {
    const hero = document.querySelector('[data-public-hero-default]');
    const cta = hero?.querySelector('[data-public-create]');
    if (!hero || !cta || hero.querySelector('[data-public-visitor]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-public-visitor';
    button.dataset.publicVisitor = 'true';
    button.innerHTML = '<span>CONTINUE AS A VISITOR</span><b aria-hidden="true">→</b>';
    cta.insertAdjacentElement('beforebegin', button);
    button.addEventListener('click', enter);
  }

  document.addEventListener('click', (event) => {
    if (!isActive()) return;
    const mainAction = event.target.closest('[data-rp-main-action]');
    if (!mainAction) return;
    const action = mainAction.dataset.rpMainAction;
    if (action === 'updates' || action === 'world' || action === '5v5') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (action === 'profile') {
      requireAccount({ copy: 'Create your Real Play player to unlock your own player card, stats and career history.' });
    } else if (action === 'settings') {
      requireAccount({ copy: 'Create an account or log in to manage membership, identity and account settings.' });
    } else if (action === '3v3' || action === 'ranking') {
      requireAccount({ title: 'READY TO PLAY?', copy: 'Create your Real Play player before joining, reserving or competing in an official game.' });
    } else {
      requireAccount();
    }
  }, true);

  function syncTokenState() {
    if (!hasToken()) return;
    if (localStorage.getItem(VISITOR_KEY) === '1') exit();
  }

  installLandingButton();
  const landingObserver = new MutationObserver(installLandingButton);
  landingObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('focus', syncTokenState);
  window.addEventListener('storage', syncTokenState);

  window.RealPlayVisitor = {
    enter,
    exit,
    isActive,
    requireAccount,
    openAuth,
  };
})();
