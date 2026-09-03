(() => {
  const entry = document.querySelector('[data-rp-entry]');
  if (!entry || entry.dataset.rpPublicLanding === 'true') return;

  entry.dataset.rpPublicLanding = 'true';
  entry.classList.add('rp-public-landing');
  entry.setAttribute('aria-label', 'Real Play Basketball');

  entry.innerHTML = `
    <section class="rp-public-hero" id="real-play-top">
      <div class="rp-public-title" aria-label="Real Play Basketball">
        <span class="rp-public-title-main">REAL PLAY</span>
        <span class="rp-public-title-sub">BASKETBALL</span>
      </div>

      <p class="rp-public-tagline">LESS SCREEN. REAL POINTS.</p>

      <div class="rp-public-price">
        <strong>₱100</strong>
        <span>/ MONTH</span>
        <small>BETA MEMBERSHIP</small>
      </div>

      <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>

      <a class="rp-public-more" href="#what-is-real-play">WANT TO KNOW MORE? <span>↓</span></a>
    </section>

    <div class="rp-public-details" id="what-is-real-play">
      <section class="rp-public-section rp-public-intro">
        <p class="rp-public-eyebrow">WHAT IS REAL PLAY?</p>
        <h2>REAL BASKETBALL.<br><span>ORGANIZED.</span></h2>
        <p>Scheduled games, teams, player profiles, and verified game history — built around what actually happens on the court.</p>
        <blockquote><strong>THE GAME HAPPENS ON THE COURT.</strong><span>THE SYSTEM RECORDS IT.</span></blockquote>
      </section>

      <section class="rp-public-section">
        <p class="rp-public-eyebrow">YOUR ₱100 MEMBERSHIP</p>
        <h2>SHOW UP.<br><span>KEEP PLAYING.</span></h2>
        <div class="rp-public-benefits">
          <article><b>01</b><div><strong>SCHEDULED GAMES</strong><p>Court, date, time, and available player slots.</p></div></article>
          <article><b>02</b><div><strong>4 REAL PLAY TEAMS</strong><p>Compete as part of the starting Beta community.</p></div></article>
          <article><b>03</b><div><strong>YOUR PLAYER PROFILE</strong><p>Your number, games, stats, and Real Play history.</p></div></article>
        </div>
        <p class="rp-public-note">Beta team assignments are handled by Real Play.</p>
      </section>

      <section class="rp-public-section rp-public-how">
        <p class="rp-public-eyebrow">HOW IT WORKS</p>
        <h2>FROM YOUR PHONE<br><span>TO THE COURT.</span></h2>
        <div class="rp-public-steps">
          <article><span>01</span><strong>CREATE YOUR PLAYER</strong></article>
          <article><span>02</span><strong>ACTIVATE ₱100 MEMBERSHIP</strong></article>
          <article><span>03</span><strong>SECURE YOUR SPOT</strong></article>
          <article><span>04</span><strong>SHOW UP & PLAY</strong></article>
        </div>
      </section>

      <section class="rp-public-section rp-public-now">
        <p class="rp-public-eyebrow">BETA SEASON</p>
        <h2>STARTING WITH<br><span>3V3.</span></h2>
        <div class="rp-public-now-grid">
          <article class="active"><small>AVAILABLE NOW</small><strong>3V3</strong><span>4 REAL PLAY TEAMS</span></article>
          <article><small>UNDER CONSTRUCTION</small><strong>5V5</strong><span>COMING LATER</span></article>
        </div>
      </section>

      <section class="rp-public-section rp-public-player">
        <p class="rp-public-eyebrow">YOUR PLAYER. YOUR HISTORY.</p>
        <h2>YOU ARE THE<br><span>PLAYER.</span></h2>
        <p>Your profile follows you across Real Play. Membership gives access; your actual performance earns the record.</p>
        <div class="rp-public-player-card">
          <div><small>REAL PLAY PLAYER</small><strong>YOUR NAME</strong></div>
          <b>#--</b>
          <div class="rp-public-stat-row"><span>GAMES</span><span>PLAY TIME</span><span>STATS</span><span>OVR</span></div>
        </div>
      </section>

      <section class="rp-public-section rp-public-faith">
        <p class="rp-public-eyebrow">OUR COMMUNITY</p>
        <h2>OPEN TO EVERYONE.<br><span>ROOTED IN CHRIST.</span></h2>
        <p>Everyone can join. Real Play is openly Christian, so expect prayer, Biblical encouragement, Gospel sharing, and invitations to Christian community.</p>
      </section>

      <section class="rp-public-section rp-public-standard">
        <p class="rp-public-eyebrow">COMMUNITY STANDARD</p>
        <h2>COMPETE HARD.<br><span>RESPECT PEOPLE.</span></h2>
        <div class="rp-public-rules">
          <article><strong>NO DIRECT TRASH TALK</strong><p>Personal insults, threats, or humiliation are not allowed.</p></article>
          <article><strong>GESTURES ARE ALLOWED</strong><p>Celebrate and react — just don't turn it into disrespect.</p></article>
          <article><strong>CUSSING GETS CALLED OUT</strong><p>Respect the reminder and move forward.</p></article>
          <article><strong>REPEATED DISRESPECT</strong><p>May lead to removal, suspension, or a community ban.</p></article>
        </div>
        <p class="rp-public-standard-close">WE DON'T EXPECT PERFECT PEOPLE. WE EXPECT PEOPLE TO BE <strong>TEACHABLE.</strong></p>
      </section>

      <section class="rp-public-final">
        <div class="rp-public-title rp-public-title-small" aria-hidden="true">
          <span class="rp-public-title-main">REAL PLAY</span>
          <span class="rp-public-title-sub">BASKETBALL</span>
        </div>
        <div class="rp-public-final-price"><strong>₱100</strong><span>/ MONTH · BETA MEMBERSHIP</span></div>
        <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>
        <button class="rp-public-text-button" type="button" data-public-login>ALREADY A PLAYER? LOG IN</button>
      </section>
    </div>
  `;

  const authOpen = document.querySelector('[data-auth-open]');

  function openAuth(view) {
    if (!authOpen) return;
    authOpen.click();
    if (!view) return;
    window.setTimeout(() => {
      const tab = document.querySelector(`[data-auth-tab="${view}"]`);
      if (tab) tab.click();
    }, 30);
  }

  entry.querySelectorAll('[data-public-create]').forEach((button) => {
    button.addEventListener('click', () => openAuth('signup'));
  });

  entry.querySelectorAll('[data-public-login]').forEach((button) => {
    button.addEventListener('click', () => openAuth('login'));
  });
})();
