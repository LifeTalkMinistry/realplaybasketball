(() => {
  const entry = document.querySelector('[data-rp-entry]');
  if (!entry || entry.dataset.rpPublicLanding === 'true') return;

  entry.dataset.rpPublicLanding = 'true';
  entry.classList.add('rp-public-landing');
  entry.setAttribute('aria-label', 'Real Play Basketball');

  entry.innerHTML = `
    <section class="rp-public-hero" id="real-play-top" data-public-hero>
      <div class="rp-public-hero-default" data-public-hero-default>
        <div class="rp-public-title" aria-label="Real Play Basketball">
          <span class="rp-public-title-main">REAL PLAY</span>
          <span class="rp-public-title-sub">BASKETBALL</span>
        </div>

        <p class="rp-public-tagline">LESS SCREEN. REAL POINTS.</p>

        <div class="rp-public-price">
          <strong>₱599</strong>
          <span>/ MONTH</span>
          <small>BETA MEMBERSHIP</small>
        </div>

        <button class="rp-public-value-trigger" type="button" data-public-value-open aria-controls="rp-public-value-experience">
          <span>SEE WHAT ₱599 INCLUDES</span>
          <b aria-hidden="true">+</b>
        </button>

        <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>

        <a class="rp-public-more" href="#what-is-real-play">WANT TO KNOW MORE? <span>↓</span></a>
      </div>

      <div class="rp-public-value-experience" id="rp-public-value-experience" data-public-value-experience hidden aria-label="What the Real Play membership includes">
        <header class="rp-public-value-carousel-head">
          <button class="rp-public-value-exit" type="button" data-public-value-close>← BACK</button>
          <div class="rp-public-value-mini-brand" aria-hidden="true"><strong>REAL PLAY</strong><span>BASKETBALL</span></div>
          <span class="rp-public-value-count" data-public-value-count>01 / 08</span>
        </header>

        <div class="rp-public-value-viewport" data-public-value-viewport tabindex="0" aria-roledescription="carousel">
          <div class="rp-public-value-track" data-public-value-track>
            <article class="rp-public-value-slide is-active" data-public-value-slide>
              <p class="rp-public-value-slide-label">THE REAL VALUE</p>
              <h2>₱599<br><span>GOES FURTHER.</span></h2>
              <p class="rp-public-value-slide-copy">Break the monthly membership down and the price becomes simple.</p>
              <div class="rp-public-value-math">
                <div><strong>≈ ₱150</strong><span>PER WEEK</span></div>
                <div><strong>≈ ₱50</strong><span>PER GAME</span></div>
              </div>
              <p class="rp-public-value-footnote">Based on roughly 4 weekly schedules per month and 3 games per scheduled Real Play session.</p>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">COURT + SCHEDULED PLAY</p>
              <h2>JUST SHOW UP.<br><span>WE BUILD THE RUN.</span></h2>
              <p class="rp-public-value-slide-copy">You are not arranging the court, date, time, player slots, and the whole basketball run by yourself. Real Play organizes the structure so your job is to show up and play.</p>
              <div class="rp-public-value-highlight"><strong>ORGANIZED ACCESS</strong><span>Court · Schedule · Player spots</span></div>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">OFFICIAL SCORING + VERIFICATION</p>
              <h2>YOUR GAME<br><span>ACTUALLY COUNTS.</span></h2>
              <p class="rp-public-value-slide-copy">Results, verified stats, OVR movement, and official game history come from what happened on the court — not from self-reported numbers.</p>
              <div class="rp-public-value-highlight"><strong>VERIFIED BASKETBALL</strong><span>Results · Stats · OVR · Records</span></div>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">CAMERA + GAME DOCUMENTATION</p>
              <h2>DON'T JUST PLAY IT.<br><span>KEEP IT.</span></h2>
              <p class="rp-public-value-slide-copy">Real games can become footage, highlights, and a basketball history you can actually look back on instead of disappearing when the final whistle ends.</p>
              <div class="rp-public-value-highlight"><strong>YOUR REAL MOMENTS</strong><span>Footage · Highlights · Game history</span></div>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">TEAM + SEASON SYSTEM</p>
              <h2>PLAY FOR<br><span>SOMETHING.</span></h2>
              <p class="rp-public-value-slide-copy">You join a team, build a season record, climb the standings, reach the playoffs, and compete for one Real Play Champion title.</p>
              <div class="rp-public-value-highlight"><strong>A REAL SEASON</strong><span>Team · Standings · Playoffs · Final</span></div>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">YOUR PLAYER CAREER</p>
              <h2>THE SEASON ENDS.<br><span>YOUR HISTORY DOESN'T.</span></h2>
              <p class="rp-public-value-slide-copy">Your identity, OVR, verified stats, games, achievements, and Real Play history stay connected to you as your basketball career continues.</p>
              <div class="rp-public-value-player-line"><span>OVR</span><span>GAMES</span><span>STATS</span><span>HISTORY</span></div>
            </article>

            <article class="rp-public-value-slide" data-public-value-slide>
              <p class="rp-public-value-slide-label">THE COMMUNITY BEHIND IT</p>
              <h2>MORE THAN<br><span>PEOPLE TO PLAY WITH.</span></h2>
              <p class="rp-public-value-slide-copy">Real Play gives you a recurring place to compete, people to build basketball relationships with, and a community that keeps real play happening consistently.</p>
              <div class="rp-public-value-highlight"><strong>KEEP SHOWING UP</strong><span>Competition · Belonging · Community</span></div>
            </article>

            <article class="rp-public-value-slide rp-public-value-slide-final" data-public-value-slide>
              <p class="rp-public-value-slide-label">REAL PLAY MEMBERSHIP</p>
              <h2>PAY FOR THE EXPERIENCE.<br><span>EARN THE BASKETBALL.</span></h2>
              <p class="rp-public-value-slide-copy">₱599 is not just a court fee. It supports an organized basketball system designed to keep you playing and give your real games meaning.</p>
              <div class="rp-public-value-final-price"><strong>₱599</strong><span>/ MONTH</span></div>
              <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>
            </article>
          </div>
        </div>

        <footer class="rp-public-value-carousel-foot">
          <button class="rp-public-value-nav" type="button" data-public-value-prev aria-label="Previous benefit">←</button>
          <div class="rp-public-value-dots" data-public-value-dots aria-label="Membership benefit slides"></div>
          <button class="rp-public-value-nav" type="button" data-public-value-next aria-label="Next benefit">→</button>
        </footer>
      </div>
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
            <div class="rp-public-story-facts"><span>5 Placement Games</span><span>Initial OVR</span></div>
            <p class="rp-public-story-bridge">YOUR LEVEL HELPS REAL PLAY KNOW WHERE YOU BELONG.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>02</strong> · JOIN A TEAM</p>
            <h2>YOUR SEASON STARTS<br><span>WITH A TEAM.</span></h2>
            <div class="rp-public-team-list" aria-label="Real Play teams"><span>Lions</span><span>Valiant</span><span>Watchmen</span><span>Conquerors</span></div>
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
            <div class="rp-public-story-facts"><span>3 Games Per Schedule</span><span>36 Regular-Season Games</span></div>
            <div class="rp-public-standing-line" aria-label="Season standings"><span>#1</span><span>#2</span><span>#3</span><span>#4</span></div>
            <p class="rp-public-story-bridge">WHERE YOU FINISH DECIDES WHAT HAPPENS NEXT.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>04</strong> · PLAYOFFS</p>
            <h2>THE SEASON EARNS<br><span>YOUR POSITION.</span></h2>
            <p class="rp-public-story-copy">When the regular season ends, the standings set the playoff matchups.</p>
            <div class="rp-public-playoff-pair" aria-label="Playoff matchups"><article><small>PLAYOFF 1</small><strong>#1 vs #4</strong></article><article><small>PLAYOFF 2</small><strong>#2 vs #3</strong></article></div>
            <p class="rp-public-story-copy">Two winners move forward.</p>
            <p class="rp-public-story-bridge">THEN THERE ARE ONLY TWO.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter rp-public-story-final">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>05</strong> · THE FINAL</p>
            <h2>ONE GAME.<br><span>ONE TITLE.</span></h2>
            <p class="rp-public-story-copy">The two playoff winners meet in the Final. The winner becomes the one official champion of the season.</p>
            <div class="rp-public-champion-mark"><small>THE TITLE</small><strong>REAL PLAY <span>CHAMPION</span></strong></div>
            <p class="rp-public-story-bridge">THE SEASON ENDS. YOUR CAREER DOESN'T.<span>↓</span></p>
          </div>
        </section>

        <section class="rp-public-story-chapter">
          <div class="rp-public-story-inner">
            <p class="rp-public-story-step"><strong>06</strong> · YOUR CAREER CONTINUES</p>
            <h2>TEAMS COMPETE.<br><span>YOUR HISTORY STAYS YOURS.</span></h2>
            <p class="rp-public-story-copy">Your OVR, verified stats, games, Play Time, achievements, and Real Play history stay connected to you as a player. A season can end. Your Real Play career keeps going.</p>
            <div class="rp-public-player-card rp-public-story-player-card"><div><small>REAL PLAY PLAYER</small><strong>YOUR NAME</strong></div><b>#--</b><div class="rp-public-stat-row"><span>OVR</span><span>GAMES</span><span>STATS</span><span>HISTORY</span></div></div>
          </div>
        </section>
      </div>

      <section class="rp-public-section rp-public-membership-story">
        <p class="rp-public-eyebrow">WHAT YOUR MEMBERSHIP SUPPORTS</p>
        <h2>SHOW UP.<br><span>KEEP PLAYING.</span></h2>
        <p>Your ₱599 monthly membership helps Real Play build the repeatable basketball experience you just saw.</p>
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
        <div class="rp-public-title rp-public-title-small" aria-hidden="true"><span class="rp-public-title-main">REAL PLAY</span><span class="rp-public-title-sub">BASKETBALL</span></div>
        <div class="rp-public-final-price"><strong>₱599</strong><span>/ MONTH · BETA MEMBERSHIP</span></div>
        <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>
        <button class="rp-public-text-button" type="button" data-public-login>ALREADY A PLAYER? LOG IN</button>
      </section>
    </div>
  `;

  const authOpen = document.querySelector('[data-auth-open]');
  const hero = entry.querySelector('[data-public-hero]');
  const heroDefault = entry.querySelector('[data-public-hero-default]');
  const valueOpen = entry.querySelector('[data-public-value-open]');
  const valueExperience = entry.querySelector('[data-public-value-experience]');
  const valueClose = entry.querySelector('[data-public-value-close]');
  const valueTrack = entry.querySelector('[data-public-value-track]');
  const valueViewport = entry.querySelector('[data-public-value-viewport]');
  const valuePrev = entry.querySelector('[data-public-value-prev]');
  const valueNext = entry.querySelector('[data-public-value-next]');
  const valueCount = entry.querySelector('[data-public-value-count]');
  const valueDots = entry.querySelector('[data-public-value-dots]');
  const valueSlides = Array.from(entry.querySelectorAll('[data-public-value-slide]'));
  let valueIndex = 0;
  let pointerStart = null;

  function openAuth(view) {
    if (!authOpen) return;
    authOpen.click();
    if (!view) return;
    window.setTimeout(() => {
      const tab = document.querySelector(`[data-auth-tab="${view}"]`);
      if (tab) tab.click();
    }, 30);
  }

  function renderValueSlide(index) {
    if (!valueTrack || !valueSlides.length) return;
    valueIndex = Math.max(0, Math.min(index, valueSlides.length - 1));
    valueTrack.style.transform = `translateX(-${valueIndex * 100}%)`;
    valueSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle('is-active', slideIndex === valueIndex);
      slide.setAttribute('aria-hidden', slideIndex === valueIndex ? 'false' : 'true');
    });
    valueDots?.querySelectorAll('button').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === valueIndex);
      dot.setAttribute('aria-current', dotIndex === valueIndex ? 'true' : 'false');
    });
    if (valueCount) valueCount.textContent = `${String(valueIndex + 1).padStart(2, '0')} / ${String(valueSlides.length).padStart(2, '0')}`;
    if (valuePrev) valuePrev.disabled = valueIndex === 0;
    if (valueNext) valueNext.disabled = valueIndex === valueSlides.length - 1;
  }

  function openValueExperience() {
    if (!hero || !heroDefault || !valueExperience) return;
    hero.classList.add('rp-public-value-mode');
    heroDefault.hidden = true;
    valueExperience.hidden = false;
    renderValueSlide(0);
    window.setTimeout(() => valueViewport?.focus(), 0);
  }

  function closeValueExperience() {
    if (!hero || !heroDefault || !valueExperience || valueExperience.hidden) return;
    hero.classList.remove('rp-public-value-mode');
    valueExperience.hidden = true;
    heroDefault.hidden = false;
    valueIndex = 0;
    window.setTimeout(() => valueOpen?.focus(), 0);
  }

  valueSlides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to membership benefit ${index + 1}`);
    dot.addEventListener('click', () => renderValueSlide(index));
    valueDots?.appendChild(dot);
  });

  valueOpen?.addEventListener('click', openValueExperience);
  valueClose?.addEventListener('click', closeValueExperience);
  valuePrev?.addEventListener('click', () => renderValueSlide(valueIndex - 1));
  valueNext?.addEventListener('click', () => renderValueSlide(valueIndex + 1));

  valueViewport?.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  valueViewport?.addEventListener('pointerup', (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    renderValueSlide(valueIndex + (dx < 0 ? 1 : -1));
  });
  valueViewport?.addEventListener('pointercancel', () => { pointerStart = null; });

  document.addEventListener('keydown', (event) => {
    if (!valueExperience || valueExperience.hidden) return;
    if (event.key === 'Escape') closeValueExperience();
    if (event.key === 'ArrowLeft') renderValueSlide(valueIndex - 1);
    if (event.key === 'ArrowRight') renderValueSlide(valueIndex + 1);
  });

  entry.querySelectorAll('[data-public-create]').forEach((button) => {
    button.addEventListener('click', () => {
      if (valueExperience && !valueExperience.hidden) closeValueExperience();
      openAuth('signup');
    });
  });

  entry.querySelectorAll('[data-public-login]').forEach((button) => {
    button.addEventListener('click', () => openAuth('login'));
  });

  renderValueSlide(0);
})();
