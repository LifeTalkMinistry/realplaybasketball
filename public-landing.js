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
        <p>Real Play turns scheduled basketball into a real player and team history. You show up, play on the court, and the system records what actually happened.</p>
        <blockquote><strong>THE GAME HAPPENS ON THE COURT.</strong><span>THE SYSTEM RECORDS IT.</span></blockquote>
      </section>

      <div class="rp-public-story" aria-label="The Real Play journey">
        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>01</strong> · START AS A PLAYER</p>
            <h2>CREATE YOUR PLAYER.<br><span>FIND YOUR LEVEL.</span></h2>
            <p class="rp-public-story-copy">Your Real Play identity starts Unranked. Play at least 5 official Placement Games so Real Play can establish your first OVR from verified basketball.</p>
            <div class="rp-public-story-facts">
              <span>5 Placement Games</span>
              <span>Initial OVR</span>
            </div>
            <p class="rp-public-story-bridge">YOUR LEVEL HELPS REAL PLAY KNOW WHERE YOU BELONG.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>02</strong> · JOIN A TEAM</p>
            <h2>YOUR SEASON STARTS<br><span>WITH A TEAM.</span></h2>
            <div class="rp-public-team-list" aria-label="Real Play teams">
              <span>Lions</span>
              <span>Valiant</span>
              <span>Watchmen</span>
              <span>Conquerors</span>
            </div>
            <p class="rp-public-story-copy">Real Play uses available player data to build balanced teams before the season begins. Once the season starts, your team stays together.</p>
            <p class="rp-public-story-note">Current Beta competition starts with 3V3 across four Real Play teams.</p>
            <p class="rp-public-story-bridge">NOW YOU HAVE SOMETHING TO PLAY FOR.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>03</strong> · PLAY THE SEASON</p>
            <h2>EVERY GAME BUILDS<br><span>THE STANDINGS.</span></h2>
            <p class="rp-public-story-copy">Every scheduled Real Play session gives each team 3 games. Wins and losses keep building your team's record throughout the season.</p>
            <div class="rp-public-story-facts">
              <span>3 Games Per Schedule</span>
              <span>36 Regular-Season Games</span>
            </div>
            <div class="rp-public-standing-line" aria-label="Season standings"><span>#1</span><span>#2</span><span>#3</span><span>#4</span></div>
            <p class="rp-public-story-bridge">WHERE YOU FINISH DECIDES WHAT HAPPENS NEXT.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>04</strong> · PLAYOFFS</p>
            <h2>THE SEASON EARNS<br><span>YOUR POSITION.</span></h2>
            <p class="rp-public-story-copy">When the regular season ends, the standings set the playoff matchups.</p>
            <div class="rp-public-playoff-pair" aria-label="Playoff matchups">
              <article><small>PLAYOFF 1</small><strong>#1 vs #4</strong></article>
              <article><small>PLAYOFF 2</small><strong>#2 vs #3</strong></article>
            </div>
            <p class="rp-public-story-copy">Two winners move forward.</p>
            <p class="rp-public-story-bridge">THEN THERE ARE ONLY TWO.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter rp-public-story-final">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>05</strong> · THE FINAL</p>
            <h2>ONE GAME.<br><span>ONE TITLE.</span></h2>
            <p class="rp-public-story-copy">The two playoff winners meet in the Final. The winner becomes the one official champion of the season.</p>
            <div class="rp-public-champion-mark">
              <small>THE TITLE</small>
              <strong>REAL PLAY <span>CHAMPION</span></strong>
            </div>
            <p class="rp-public-story-bridge">THE SEASON ENDS. YOUR CAREER DOESN'T.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>06</strong> · YOUR CAREER CONTINUES</p>
            <h2>TEAMS COMPETE.<br><span>YOUR HISTORY STAYS YOURS.</span></h2>
            <p class="rp-public-story-copy">Your OVR, verified stats, games, Play Time, achievements, and Real Play history stay connected to you as a player. A season can end. Your Real Play career keeps going.</p>
            <div class="rp-public-player-card rp-public-story-player-card">
              <div><small>REAL PLAY PLAYER</small><strong>YOUR NAME</strong></div>
              <b>#--</b>
              <div class="rp-public-stat-row"><span>OVR</span><span>GAMES</span><span>STATS</span><span>HISTORY</span></div>
            </div>
          </div>
        </section>
      </div>

      <section class="rp-public-section rp-public-membership-story">
        <p class="rp-public-eyebrow">WHAT YOUR MEMBERSHIP SUPPORTS</p>
        <h2>SHOW UP.<br><span>KEEP PLAYING.</span></h2>
        <p>Your ₱100 Beta Membership helps Real Play build the repeatable basketball experience you just saw.</p>
        <div class="rp-public-benefits">
          <article><b>01</b><div><strong>SCHEDULED GAMES</strong><p>Court, date, time, and player spots organized around real play.</p></div></article>
          <article><b>02</b><div><strong>REAL PLAY OPERATIONS</strong><p>Team organization, check-in, verified games, and official records.</p></div></article>
          <article><b>03</b><div><strong>YOUR PLAYER HISTORY</strong><p>Your identity, OVR, stats, games, and career remain yours.</p></div></article>
        </div>
      </section>

      <section class="rp-public-section rp-public-community-story">
        <p class="rp-public-eyebrow">THE COMMUNITY YOU'RE JOINING</p>
        <h2>OPEN TO EVERYONE.<br><span>ROOTED IN CHRIST.</span></h2>
        <p>Everyone can join. Real Play is openly Christian, so expect prayer, Biblical encouragement, Gospel sharing, and invitations to Christian community.</p>
        <div class="rp-public-community-divider"></div>
        <h3>COMPETE HARD. <span>RESPECT PEOPLE.</span></h3>
        <div class="rp-public-rules">
          <article><strong>NO DIRECT TRASH TALK</strong><p>Personal insults, threats, or humiliation are not allowed.</p></article>
          <article><strong>CELEBRATE WITHOUT DISRESPECT</strong><p>React, compete, and enjoy the game without turning it personal.</p></article>
          <article><strong>BE TEACHABLE</strong><p>If Real Play calls something out, respect the reminder and move forward.</p></article>
        </div>
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
