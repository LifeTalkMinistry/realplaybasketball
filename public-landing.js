(() => {
  const entry = document.querySelector('[data-rp-entry]');
  if (!entry || entry.dataset.rpPublicLanding === 'true') return;

  entry.dataset.rpPublicLanding = 'true';
  entry.classList.add('rp-public-landing');
  entry.setAttribute('aria-label', 'Real Play Basketball');

  entry.innerHTML = `
    <div class="rp-public-nav">
      <div class="rp-public-brand" aria-label="Real Play Basketball">
        <img class="rp-public-brand-logo" src="assets/real-play-brand.webp" alt="Real Play Basketball" />
      </div>
      <button class="rp-public-login" type="button" data-public-login>LOG IN</button>
    </div>

    <section class="rp-public-hero" id="real-play-top">
      <div class="rp-public-hero-glow" aria-hidden="true"></div>
      <h1>LESS SCREEN.<br><span>REAL POINTS.</span></h1>
      <p class="rp-public-lede">Organized basketball. Real teams. Real games.</p>

      <div class="rp-public-status"><span></span>BETA SEASON · 3V3</div>

      <div class="rp-public-price">
        <strong>₱100</strong>
        <span>/ MONTH</span>
        <small>FOUNDING BETA MEMBERSHIP</small>
      </div>

      <button class="rp-public-cta" type="button" data-public-create>JOIN REAL PLAY <span>→</span></button>
      <button class="rp-public-existing" type="button" data-public-login>ALREADY A PLAYER? <strong>LOG IN</strong></button>
      <a class="rp-public-discover" href="#what-is-real-play" aria-label="Discover Real Play">↓</a>
    </section>

    <section class="rp-public-section rp-public-intro" id="what-is-real-play">
      <p class="rp-public-eyebrow">WHAT IS REAL PLAY?</p>
      <h2>WE USE THE APP TO GET YOU <span>OFF THE APP.</span></h2>
      <p>Real Play organizes actual basketball: the court, schedule, player slots, teams, check-in, games, and your history afterward.</p>
      <blockquote><strong>THE GAME HAPPENS ON THE COURT.</strong><span>THE SYSTEM RECORDS IT.</span></blockquote>
    </section>

    <section class="rp-public-section">
      <p class="rp-public-eyebrow">YOUR ₱100 MEMBERSHIP</p>
      <h2>ONE MONTH. MORE REASONS TO <span>ACTUALLY PLAY.</span></h2>
      <div class="rp-public-benefits">
        <article><b>01</b><div><strong>SCHEDULED GAMES</strong><p>Know where and when the next Real Play session happens.</p></div></article>
        <article><b>02</b><div><strong>4 REAL PLAY TEAMS</strong><p>Represent a team and become part of the starting community.</p></div></article>
        <article><b>03</b><div><strong>YOUR PLAYER IDENTITY</strong><p>Your name, number, games, participation, and future competitive history stay with you.</p></div></article>
        <article><b>04</b><div><strong>REAL GAME HISTORY</strong><p>Real participation becomes a record because you actually showed up and played.</p></div></article>
      </div>
      <p class="rp-public-note">During Beta, Real Play manages final team assignments to keep games organized and balanced.</p>
    </section>

    <section class="rp-public-section rp-public-how">
      <p class="rp-public-eyebrow">HOW IT WORKS</p>
      <h2>FROM YOUR PHONE TO <span>THE COURT.</span></h2>
      <div class="rp-public-steps">
        <article><span>01</span><strong>CREATE YOUR PLAYER</strong><p>Make your free Real Play account and player identity.</p></article>
        <article><span>02</span><strong>ACTIVATE MEMBERSHIP</strong><p>₱100 monthly Beta Membership unlocks eligible Real Play participation.</p></article>
        <article><span>03</span><strong>SECURE YOUR SPOT</strong><p>Choose an available scheduled session before player slots fill up.</p></article>
        <article><span>04</span><strong>SHOW UP & CHECK IN</strong><p>Your reservation becomes real participation only when you arrive.</p></article>
        <article><span>05</span><strong>PLAY</strong><p>Put the phone down and compete on the actual court.</p></article>
        <article><span>06</span><strong>BUILD YOUR HISTORY</strong><p>Verified games and participation become part of your Real Play player record.</p></article>
      </div>
    </section>

    <section class="rp-public-section rp-public-now">
      <p class="rp-public-eyebrow">BETA SEASON</p>
      <h2>STARTING SIMPLE. <span>STARTING REAL.</span></h2>
      <div class="rp-public-now-grid">
        <article class="active"><small>AVAILABLE NOW</small><strong>3V3</strong><span>4 REAL PLAY TEAMS</span></article>
        <article><small>UNDER CONSTRUCTION</small><strong>5V5</strong><span>COMING LATER</span></article>
      </div>
    </section>

    <section class="rp-public-section rp-public-player">
      <p class="rp-public-eyebrow">YOUR PLAYER. YOUR HISTORY.</p>
      <h2>YOU ARE THE <span>PLAYER.</span></h2>
      <p>Real Play is not a fantasy character builder. Your profile represents the real person who stepped onto the court.</p>
      <div class="rp-public-player-card">
        <div><small>REAL PLAY PLAYER</small><strong>YOUR NAME</strong></div>
        <b>#--</b>
        <div class="rp-public-stat-row"><span>GAMES</span><span>PLAY TIME</span><span>STATS</span><span>OVR</span></div>
      </div>
      <p class="rp-public-note">Membership never buys basketball ability, stats, easier opponents, or a higher rating. Pay for the experience. Earn the basketball.</p>
    </section>

    <section class="rp-public-section rp-public-faith">
      <p class="rp-public-eyebrow">OUR COMMUNITY</p>
      <h2>OPEN TO EVERYONE.<br><span>ROOTED IN CHRIST.</span></h2>
      <p>Real Play Basketball is a Christian basketball community, but you do not need to be a Christian to join or play.</p>
      <p>Because this community is openly Christian, expect opportunities to hear the <strong>Gospel of Jesus Christ</strong>, prayer, Biblical encouragement, and invitations to Christian community activities.</p>
      <div class="rp-public-faith-line">EVERYONE IS WELCOME. OUR CHRISTIAN IDENTITY IS NOT HIDDEN.</div>
    </section>

    <section class="rp-public-section rp-public-standard">
      <p class="rp-public-eyebrow">COMMUNITY STANDARD</p>
      <h2>COMPETE HARD.<br><span>RESPECT PEOPLE.</span></h2>
      <p>We want real competition, emotion, celebrations, and intensity. We do not want hostility.</p>
      <div class="rp-public-rules">
        <article><strong>NO DIRECT TRASH TALK</strong><p>Do not personally insult, degrade, threaten, or intentionally humiliate another player.</p></article>
        <article><strong>GESTURES ARE ALLOWED</strong><p>Competitive gestures, reactions, and celebrations are part of basketball as long as they are not threatening or degrading.</p></article>
        <article><strong>CUSSING GETS CALLED OUT</strong><p>If profanity happens, expect a reminder. Respect the correction and move forward.</p></article>
        <article><strong>REPEATED DISRESPECT HAS CONSEQUENCES</strong><p>Repeated hostility, fighting, direct trash talk, or refusing correction can lead to removal, suspension, or a community ban.</p></article>
      </div>
      <p class="rp-public-standard-close">WE DON'T EXPECT PERFECT PEOPLE. WE EXPECT PEOPLE TO BE <strong>TEACHABLE.</strong></p>
    </section>

    <section class="rp-public-final">
      <p class="rp-public-eyebrow">READY TO PLAY?</p>
      <h2>COME BUILD THE FIRST<br><span>REAL PLAY COMMUNITY.</span></h2>
      <div class="rp-public-final-price"><strong>₱100</strong><span>/ MONTH · BETA MEMBERSHIP</span></div>
      <button class="rp-public-cta" type="button" data-public-create>JOIN REAL PLAY <span>→</span></button>
      <button class="rp-public-text-button" type="button" data-public-login>ALREADY A PLAYER? LOG IN</button>
      <p>LESS SCREEN. REAL POINTS.</p>
    </section>
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
