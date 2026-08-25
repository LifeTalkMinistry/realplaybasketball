(() => {
  if (document.querySelector('[data-rp-app]')) return;

  const body = document.body;
  body.classList.add('rp-lobby-active');

  const app = document.createElement('div');
  app.className = 'rp-app';
  app.dataset.rpApp = 'true';
  app.innerHTML = `
    <section class="rp-entry" data-rp-entry aria-label="Real Play player access">
      <div class="rp-entry-glow" aria-hidden="true"></div>
      <div class="rp-entry-brand">
        <div class="rp-entry-mark">RP</div>
        <p>REAL PLAY BASKETBALL</p>
      </div>
      <div class="rp-entry-hero">
        <div class="rp-entry-ball" aria-hidden="true"></div>
        <p class="rp-entry-kicker">REAL-WORLD BASKETBALL CAREER</p>
        <h1>LESS SCREEN.<br><span>REAL POINTS.</span></h1>
        <div class="rp-entry-copy" aria-label="Real Play features">
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">◉</span><strong>REAL COURTS.</strong></div>
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">⌁</span><strong>REAL GAMES.</strong></div>
          <div class="rp-entry-feature"><span class="rp-entry-feature-icon" aria-hidden="true">♕</span><strong>REAL HISTORY.</strong></div>
        </div>
      </div>
      <div class="rp-entry-actions">
        <button class="rp-entry-primary" type="button" data-rp-entry-login>LOG IN</button>
        <button class="rp-entry-secondary" type="button" data-rp-entry-create>CREATE PLAYER</button>
      </div>
      <p class="rp-entry-foot">THE GAME HAPPENS ON THE COURT.<br>THE SYSTEM RECORDS IT.</p>
    </section>

    <div class="rp-app-inner" data-rp-lobby>
      <header class="rp-topbar">
        <div class="rp-brandmark" aria-hidden="true">RP</div>
        <div class="rp-brandcopy"><strong>REAL PLAY</strong></div>
        <button class="rp-profile-chip" type="button" data-rp-profile aria-label="Open my Real Play profile">●</button>
      </header>

      <section class="rp-player-strip" aria-label="Player identity">
        <div class="rp-player-id">
          <div class="rp-player-number" data-rp-number>#--</div>
          <div class="rp-player-name"><strong data-rp-name>YOUR PLAYER</strong><span>REAL PLAY PLAYER</span></div>
        </div>
        <div class="rp-player-rating"><strong data-rp-ovr>UNRANKED</strong><span>COMPLETE PLACEMENT</span></div>
      </section>

      <section class="rp-lobby-head" aria-label="Choose game mode">
        <span>PLAY</span>
        <h1>Choose your game.</h1>
      </section>

      <section class="rp-mode-stage" aria-label="Game modes">
        <div class="rp-mode-track" data-rp-mode-track>
          <article class="rp-mode-card rp-mode-career" data-mode="Career Mode"><div class="rp-mode-art" aria-hidden="true"></div><div class="rp-mode-card-content"><div class="rp-mode-type">RANKED</div><h2>Career</h2><p>Build your official Real Play career through verified competitive games.</p><div class="rp-mode-meta">OVR · PTS/AST/REB · W/L · MVP</div><button class="rp-play-button" type="button" data-rp-select-mode="Career Mode">PLAY CAREER <span>→</span></button></div></article>
          <article class="rp-mode-card rp-mode-open" data-mode="Open Game"><div class="rp-mode-art" aria-hidden="true"></div><div class="rp-mode-card-content"><div class="rp-mode-type">CASUAL OFFICIAL PLAY</div><h2>Open</h2><p>Show up and play official Real Play basketball without ranking pressure.</p><div class="rp-mode-meta">PLAY TIME · NO OVR · NO MVP</div><button class="rp-play-button" type="button" data-rp-select-mode="Open Game">PLAY OPEN <span>→</span></button></div></article>
          <article class="rp-mode-card rp-mode-placement" data-mode="Placement"><div class="rp-mode-art" aria-hidden="true"></div><div class="rp-mode-card-content"><div class="rp-mode-type">GET YOUR FIRST OVR</div><h2>Placement</h2><p>Complete official placement games so Real Play can establish your competitive level.</p><div class="rp-mode-meta">UNRANKED → OVR · VERIFIED</div><button class="rp-play-button" type="button" data-rp-select-mode="Placement">START PLACEMENT <span>→</span></button></div></article>
          <article class="rp-mode-card rp-mode-practice" data-mode="Self-Practice"><div class="rp-mode-art" aria-hidden="true"></div><div class="rp-mode-card-content"><div class="rp-mode-type">VERIFIED PLAY TIME</div><h2>Practice</h2><p>Record legitimate basketball participation outside organized competitive games.</p><div class="rp-mode-meta">PLAY TIME ONLY · NO OVR</div><button class="rp-play-button" type="button" data-rp-select-mode="Self-Practice">START PRACTICE <span>→</span></button></div></article>
        </div>
        <div class="rp-mode-tabs" data-rp-dots aria-label="Choose game mode"></div>
      </section>

      <section class="rp-quick-row" aria-label="Quick access">
        <button class="rp-quick" type="button" data-rp-action="career"><strong>MY CAREER</strong><span>Stats, OVR & history</span></button>
        <button class="rp-quick" type="button" data-rp-action="schedule"><strong>SESSIONS</strong><span>Find your next run</span></button>
        <button class="rp-quick" type="button" data-rp-action="profile"><strong>PLAYER</strong><span>Identity & number</span></button>
      </section>
    </div>

    <nav class="rp-bottom-nav" data-rp-bottom-nav aria-label="App navigation">
      <button class="rp-nav-item active" type="button" data-rp-nav="play"><span>◉</span>PLAY</button>
      <button class="rp-nav-item" type="button" data-rp-nav="career"><span>▰</span>CAREER</button>
      <button class="rp-nav-item" type="button" data-rp-nav="player"><span>●</span>PROFILE</button>
      <button class="rp-nav-item" type="button" data-rp-nav="more"><span>•••</span>MORE</button>
    </nav>

    <div class="rp-sheet-backdrop" data-rp-sheet aria-hidden="true"><section class="rp-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-sheet-title"><div class="rp-sheet-handle"></div><small data-rp-sheet-kicker>REAL PLAY</small><h3 id="rp-sheet-title" data-rp-sheet-title>COME PLAY.</h3><p data-rp-sheet-copy>Official locations and sessions will appear here when confirmed.</p><div class="rp-sheet-actions"><button class="rp-sheet-primary" type="button" data-rp-sheet-primary>OPEN PLAYER PROFILE</button><button class="rp-sheet-secondary" type="button" data-rp-sheet-close>CLOSE</button></div></section></div>
  `;

  body.insertBefore(app, body.firstChild);

  const authOpen = document.querySelector('[data-auth-open]');
  const accountView = document.querySelector('[data-auth-view="account"]');
  const authName = document.querySelector('[data-auth-account-name]');
  const authNumber = document.querySelector('[data-auth-player-number]');
  const profileChip = app.querySelector('[data-rp-profile]');
  const playerName = app.querySelector('[data-rp-name]');
  const playerNumber = app.querySelector('[data-rp-number]');
  const bottomNav = app.querySelector('[data-rp-bottom-nav]');
  const track = app.querySelector('[data-rp-mode-track]');
  const cards = [...app.querySelectorAll('.rp-mode-card')];
  const dotsWrap = app.querySelector('[data-rp-dots]');
  const sheet = app.querySelector('[data-rp-sheet]');
  const sheetKicker = app.querySelector('[data-rp-sheet-kicker]');
  const sheetTitle = app.querySelector('[data-rp-sheet-title]');
  const sheetCopy = app.querySelector('[data-rp-sheet-copy]');
  const sheetPrimary = app.querySelector('[data-rp-sheet-primary]');
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  const hasToken = () => Boolean(window.localStorage.getItem(TOKEN_KEY));
  const isLoggedIn = () => hasToken() || Boolean(accountView && !accountView.hidden);

  function applyIdentity(name, number) {
    const cleanName = String(name || '').trim();
    const rawNumber = number === 0 ? '0' : String(number || '').trim().replace(/^#/, '');
    if (cleanName) playerName.textContent = cleanName.toUpperCase();
    if (rawNumber && rawNumber !== '--') playerNumber.textContent = `#${rawNumber}`;
  }

  async function refreshPlayerIdentity() {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const state = await response.json();
      const profile = state?.profile || {};
      const currentNumber = state?.currentNumber?.number ?? profile.player_number ?? profile.playerNumber ?? profile.number;
      applyIdentity(profile.player_name || profile.playerName || profile.name, currentNumber);
    } catch (_error) {
      // Keep the lobby usable if identity refresh is temporarily unavailable.
    }
  }

  function syncPlayer() {
    const loggedIn = isLoggedIn();
    app.classList.toggle('rp-authenticated', loggedIn);
    app.classList.toggle('rp-guest', !loggedIn);
    body.classList.toggle('rp-guest-active', !loggedIn);
    if (bottomNav) bottomNav.style.display = loggedIn ? 'grid' : 'none';
    if (!loggedIn) return;

    const name = (authName?.textContent || '').trim();
    const number = (authNumber?.textContent || '').trim();
    if (name && name !== 'REAL PLAY PLAYER') playerName.textContent = name.toUpperCase();
    if (number && number !== '#--') playerNumber.textContent = number;
    refreshPlayerIdentity();
  }

  function openAuth(view) {
    if (!authOpen) return;
    authOpen.click();
    if (!view) return;
    window.setTimeout(() => {
      const tab = document.querySelector(`[data-auth-tab="${view}"]`);
      if (tab) tab.click();
    }, 20);
  }

  function openProfile() {
    openAuth();
  }

  function openSheet(mode, kind = 'mode') {
    if (kind === 'mode') {
      sheetKicker.textContent = mode.toUpperCase();
      sheetTitle.textContent = mode === 'Self-Practice' ? 'PUT IN REAL TIME.' : 'FIND YOUR NEXT RUN.';
      sheetCopy.textContent = mode === 'Self-Practice' ? 'Self-Practice creates verified Play Time only. Competitive stats and OVR stay separate.' : `${mode} sessions will appear here as soon as official Real Play locations and schedules are published.`;
    } else if (kind === 'career') {
      sheetKicker.textContent = 'MY CAREER'; sheetTitle.textContent = 'THE COURT BUILDS THIS.'; sheetCopy.textContent = 'Your verified games, OVR, stats, W/L, MVP history and highlights will live here.';
    } else if (kind === 'schedule') {
      sheetKicker.textContent = 'UPCOMING SESSIONS'; sheetTitle.textContent = 'YOUR NEXT REAL PLAY.'; sheetCopy.textContent = 'Official court, date, time, mode and available player slots will appear here when confirmed.';
    } else {
      sheetKicker.textContent = 'REAL PLAY'; sheetTitle.textContent = 'MORE IS COMING.'; sheetCopy.textContent = 'Membership, locations, support, transport and additional Real Play systems belong here without distracting from Play.';
    }
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
  }

  function closeSheet(){ sheet.classList.remove('open'); sheet.setAttribute('aria-hidden','true'); }

  const modeLabels = ['CAREER','OPEN','PLACEMENT','PRACTICE'];
  cards.forEach((card,index)=>{
    const tab=document.createElement('button');
    tab.type='button';
    tab.className=`rp-mode-tab${index===0?' active':''}`;
    tab.textContent=modeLabels[index];
    tab.setAttribute('aria-label',`Show ${card.dataset.mode}`);
    tab.addEventListener('click',()=>track?.scrollTo({left:card.offsetLeft-track.offsetLeft,behavior:'smooth'}));
    dotsWrap.appendChild(tab);
  });

  function syncDots(){
    if(!track)return;
    const center=track.scrollLeft+track.clientWidth/2;
    let active=0,best=Infinity;
    cards.forEach((card,index)=>{const d=Math.abs(card.offsetLeft+card.offsetWidth/2-center);if(d<best){best=d;active=index;}});
    [...dotsWrap.children].forEach((dot,index)=>dot.classList.toggle('active',index===active));
  }

  track?.addEventListener('scroll',syncDots,{passive:true});
  app.querySelector('[data-rp-entry-login]')?.addEventListener('click',()=>openAuth('login'));
  app.querySelector('[data-rp-entry-create]')?.addEventListener('click',()=>openAuth('signup'));
  profileChip?.addEventListener('click',openProfile);
  app.querySelectorAll('[data-rp-select-mode]').forEach(button=>button.addEventListener('click',()=>openSheet(button.dataset.rpSelectMode)));
  app.querySelectorAll('[data-rp-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.rpAction;if(action==='profile')openProfile();else openSheet('',action);}));
  app.querySelectorAll('[data-rp-nav]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.rpNav;if(action==='play')track?.scrollTo({left:0,behavior:'smooth'});else if(action==='player')openProfile();else openSheet('',action==='career'?'career':'more');}));
  app.querySelector('[data-rp-sheet-close]')?.addEventListener('click',closeSheet);
  sheet?.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
  sheetPrimary?.addEventListener('click',()=>{closeSheet();openProfile();});

  syncPlayer(); syncDots();
  if(accountView){const observer=new MutationObserver(syncPlayer);observer.observe(accountView,{attributes:true,attributeFilter:['hidden']});}
  [authName,authNumber].forEach(node=>{if(!node)return;const observer=new MutationObserver(syncPlayer);observer.observe(node,{childList:true,characterData:true,subtree:true});});
  window.addEventListener('focus',refreshPlayerIdentity);
})();