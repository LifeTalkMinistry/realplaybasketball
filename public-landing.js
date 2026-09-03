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

        <button class="rp-public-value-trigger" type="button" data-public-open="value" aria-controls="rp-public-value-experience">
          <span>SEE WHAT ₱599 INCLUDES</span>
          <b aria-hidden="true">+</b>
        </button>

        <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>

        <button class="rp-public-more" type="button" data-public-open="story">WANT TO KNOW MORE? <span>↓</span></button>
      </div>

      <div class="rp-public-value-experience" id="rp-public-value-experience" data-public-experience="value" hidden aria-label="What the Real Play membership includes">
        <header class="rp-public-value-carousel-head">
          <button class="rp-public-value-exit" type="button" data-carousel-close>← BACK</button>
          <div class="rp-public-value-mini-brand" aria-hidden="true"><strong>REAL PLAY</strong><span>BASKETBALL</span></div>
          <span class="rp-public-value-count" data-carousel-count>01 / 08</span>
        </header>

        <div class="rp-public-value-viewport" data-carousel-viewport tabindex="0" aria-roledescription="carousel">
          <div class="rp-public-value-track" data-carousel-track>
            <article class="rp-public-value-slide is-active" data-carousel-slide>
              <p class="rp-public-value-slide-label">THE REAL VALUE</p>
              <h2>₱599<br><span>GOES FURTHER.</span></h2>
              <p class="rp-public-value-slide-copy">Break the monthly membership down and the price becomes simple.</p>
              <div class="rp-public-value-math">
                <div><strong>≈ ₱150</strong><span>PER WEEK</span></div>
                <div><strong>≈ ₱50</strong><span>PER GAME</span></div>
              </div>
              <p class="rp-public-value-footnote">Based on roughly 4 weekly schedules per month and 3 games per scheduled Real Play session.</p>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">COURT + SCHEDULED PLAY</p>
              <h2>JUST SHOW UP.<br><span>WE BUILD THE RUN.</span></h2>
              <p class="rp-public-value-slide-copy">You are not arranging the court, date, time, player slots, and the whole basketball run by yourself. Real Play organizes the structure so your job is to show up and play.</p>
              <div class="rp-public-value-highlight"><strong>ORGANIZED ACCESS</strong><span>Court · Schedule · Player spots</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">OFFICIAL SCORING + VERIFICATION</p>
              <h2>YOUR GAME<br><span>ACTUALLY COUNTS.</span></h2>
              <p class="rp-public-value-slide-copy">Results, verified stats, OVR movement, and official game history come from what happened on the court — not from self-reported numbers.</p>
              <div class="rp-public-value-highlight"><strong>VERIFIED BASKETBALL</strong><span>Results · Stats · OVR · Records</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">CAMERA + GAME DOCUMENTATION</p>
              <h2>DON'T JUST PLAY IT.<br><span>KEEP IT.</span></h2>
              <p class="rp-public-value-slide-copy">Real games can become footage, highlights, and a basketball history you can actually look back on instead of disappearing when the final whistle ends.</p>
              <div class="rp-public-value-highlight"><strong>YOUR REAL MOMENTS</strong><span>Footage · Highlights · Game history</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">TEAM + SEASON SYSTEM</p>
              <h2>PLAY FOR<br><span>SOMETHING.</span></h2>
              <p class="rp-public-value-slide-copy">You join a team, build a season record, climb the standings, reach the playoffs, and compete for one Real Play Champion title.</p>
              <div class="rp-public-value-highlight"><strong>A REAL SEASON</strong><span>Team · Standings · Playoffs · Final</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">YOUR PLAYER CAREER</p>
              <h2>THE SEASON ENDS.<br><span>YOUR HISTORY DOESN'T.</span></h2>
              <p class="rp-public-value-slide-copy">Your identity, OVR, verified stats, games, achievements, and Real Play history stay connected to you as your basketball career continues.</p>
              <div class="rp-public-value-player-line"><span>OVR</span><span>GAMES</span><span>STATS</span><span>HISTORY</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">THE COMMUNITY BEHIND IT</p>
              <h2>MORE THAN<br><span>PEOPLE TO PLAY WITH.</span></h2>
              <p class="rp-public-value-slide-copy">Real Play gives you a recurring place to compete, people to build basketball relationships with, and a community that keeps real play happening consistently.</p>
              <div class="rp-public-value-highlight"><strong>KEEP SHOWING UP</strong><span>Competition · Belonging · Community</span></div>
            </article>

            <article class="rp-public-value-slide rp-public-value-slide-final" data-carousel-slide>
              <p class="rp-public-value-slide-label">REAL PLAY MEMBERSHIP</p>
              <h2>PAY FOR THE EXPERIENCE.<br><span>EARN THE BASKETBALL.</span></h2>
              <p class="rp-public-value-slide-copy">₱599 is not just a court fee. It supports an organized basketball system designed to keep you playing and give your real games meaning.</p>
              <div class="rp-public-value-final-price"><strong>₱599</strong><span>/ MONTH</span></div>
              <button class="rp-public-cta" type="button" data-public-create>CREATE MY PLAYER</button>
            </article>
          </div>
        </div>

        <footer class="rp-public-value-carousel-foot">
          <button class="rp-public-value-nav" type="button" data-carousel-prev aria-label="Previous benefit">←</button>
          <div class="rp-public-value-dots" data-carousel-dots aria-label="Membership benefit slides"></div>
          <button class="rp-public-value-nav" type="button" data-carousel-next aria-label="Next benefit">→</button>
        </footer>
      </div>

      <div class="rp-public-value-experience rp-public-story-experience" id="rp-public-story-experience" data-public-experience="story" hidden aria-label="How Real Play works">
        <header class="rp-public-value-carousel-head">
          <button class="rp-public-value-exit" type="button" data-carousel-close>← BACK</button>
          <div class="rp-public-value-mini-brand" aria-hidden="true"><strong>REAL PLAY</strong><span>BASKETBALL</span></div>
          <span class="rp-public-value-count" data-carousel-count>01 / 08</span>
        </header>

        <div class="rp-public-value-viewport" data-carousel-viewport tabindex="0" aria-roledescription="carousel">
          <div class="rp-public-value-track" data-carousel-track>
            <article class="rp-public-value-slide is-active" data-carousel-slide>
              <p class="rp-public-value-slide-label">01 · WHAT IS REAL PLAY?</p>
              <h2>REAL BASKETBALL.<br><span>ORGANIZED.</span></h2>
              <p class="rp-public-value-slide-copy">Real Play turns scheduled basketball into a real player and team history. You show up, play on the court, and the system records what actually happened.</p>
              <div class="rp-public-value-highlight"><strong>THE GAME HAPPENS ON THE COURT.</strong><span>THE SYSTEM RECORDS IT.</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">02 · START AS A PLAYER</p>
              <h2>CREATE YOUR PLAYER.<br><span>FIND YOUR LEVEL.</span></h2>
              <p class="rp-public-value-slide-copy">Your Real Play identity starts Unranked. Play at least 5 official Placement Games so Real Play can establish your first OVR from verified basketball.</p>
              <div class="rp-public-value-math">
                <div><strong>5</strong><span>PLACEMENT GAMES</span></div>
                <div><strong>OVR</strong><span>INITIAL LEVEL</span></div>
              </div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">03 · JOIN A TEAM</p>
              <h2>YOUR SEASON STARTS<br><span>WITH A TEAM.</span></h2>
              <p class="rp-public-value-slide-copy">Real Play uses available player data to build balanced teams before the season begins. Once the season starts, your team stays together.</p>
              <div class="rp-public-carousel-team-grid" aria-label="Real Play teams"><span>LIONS</span><span>VALIANT</span><span>WATCHMEN</span><span>CONQUERORS</span></div>
              <p class="rp-public-value-footnote">Current Beta competition starts with 3V3 across four Real Play teams.</p>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">04 · PLAY THE SEASON</p>
              <h2>EVERY GAME BUILDS<br><span>THE STANDINGS.</span></h2>
              <p class="rp-public-value-slide-copy">Every scheduled Real Play session gives each team 3 games. Wins and losses keep building your team's record throughout the season.</p>
              <div class="rp-public-value-math">
                <div><strong>3</strong><span>GAMES PER SCHEDULE</span></div>
                <div><strong>36</strong><span>REGULAR-SEASON GAMES</span></div>
              </div>
              <div class="rp-public-carousel-standing"><span>#1</span><span>#2</span><span>#3</span><span>#4</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">05 · PLAYOFFS</p>
              <h2>THE SEASON EARNS<br><span>YOUR POSITION.</span></h2>
              <p class="rp-public-value-slide-copy">When the regular season ends, the standings set the playoff matchups. Two winners move forward.</p>
              <div class="rp-public-carousel-playoffs"><div><small>PLAYOFF 1</small><strong>#1 VS #4</strong></div><div><small>PLAYOFF 2</small><strong>#2 VS #3</strong></div></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">06 · THE FINAL</p>
              <h2>ONE GAME.<br><span>ONE TITLE.</span></h2>
              <p class="rp-public-value-slide-copy">The two playoff winners meet in the Final. The winner becomes the one official champion of the season.</p>
              <div class="rp-public-value-highlight rp-public-carousel-champion"><strong>REAL PLAY CHAMPION</strong><span>Only the Final winner earns the title.</span></div>
            </article>

            <article class="rp-public-value-slide" data-carousel-slide>
              <p class="rp-public-value-slide-label">07 · YOUR CAREER CONTINUES</p>
              <h2>TEAMS COMPETE.<br><span>YOUR HISTORY STAYS YOURS.</span></h2>
              <p class="rp-public-value-slide-copy">Your OVR, verified stats, games, Play Time, achievements, and Real Play history stay connected to you as a player. A season can end. Your Real Play career keeps going.</p>
              <div class="rp-public-value-player-line"><span>OVR</span><span>GAMES</span><span>STATS</span><span>HISTORY</span></div>
            </article>

            <article class="rp-public-value-slide rp-public-value-slide-final" data-carousel-slide>
              <p class="rp-public-value-slide-label">08 · THE COMMUNITY</p>
              <h2>OPEN TO EVERYONE.<br><span>ROOTED IN CHRIST.</span></h2>
              <p class="rp-public-value-slide-copy">Everyone can join. Real Play is openly Christian, with prayer, Biblical encouragement, Gospel sharing, and invitations to Christian community.</p>
              <div class="rp-public-value-highlight"><strong>COMPETE HARD. RESPECT PEOPLE.</strong><span>No direct trash talk · Celebrate without disrespect · Be teachable</span></div>
              <button class="rp-public-cta rp-public-story-cta" type="button" data-public-create>CREATE MY PLAYER</button>
            </article>
          </div>
        </div>

        <footer class="rp-public-value-carousel-foot">
          <button class="rp-public-value-nav" type="button" data-carousel-prev aria-label="Previous explanation">←</button>
          <div class="rp-public-value-dots" data-carousel-dots aria-label="Real Play explanation slides"></div>
          <button class="rp-public-value-nav" type="button" data-carousel-next aria-label="Next explanation">→</button>
        </footer>
      </div>
    </section>
  `;

  const authOpen = document.querySelector('[data-auth-open]');
  const hero = entry.querySelector('[data-public-hero]');
  const heroDefault = entry.querySelector('[data-public-hero-default]');
  const experiences = Array.from(entry.querySelectorAll('[data-public-experience]'));
  let activeCarousel = null;

  function openAuth(view) {
    if (!authOpen) return;
    authOpen.click();
    if (!view) return;
    window.setTimeout(() => {
      const tab = document.querySelector(`[data-auth-tab="${view}"]`);
      if (tab) tab.click();
    }, 30);
  }

  function setupCarousel(experience) {
    const track = experience.querySelector('[data-carousel-track]');
    const viewport = experience.querySelector('[data-carousel-viewport]');
    const prev = experience.querySelector('[data-carousel-prev]');
    const next = experience.querySelector('[data-carousel-next]');
    const count = experience.querySelector('[data-carousel-count]');
    const dots = experience.querySelector('[data-carousel-dots]');
    const close = experience.querySelector('[data-carousel-close]');
    const slides = Array.from(experience.querySelectorAll('[data-carousel-slide]'));
    let index = 0;
    let pointerStart = null;

    function render(nextIndex) {
      if (!track || !slides.length) return;
      index = Math.max(0, Math.min(nextIndex, slides.length - 1));
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots?.querySelectorAll('button').forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      if (count) count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
    }

    slides.forEach((_, dotIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to slide ${dotIndex + 1}`);
      dot.addEventListener('click', () => render(dotIndex));
      dots?.appendChild(dot);
    });

    prev?.addEventListener('click', () => render(index - 1));
    next?.addEventListener('click', () => render(index + 1));
    close?.addEventListener('click', closeExperience);

    viewport?.addEventListener('pointerdown', (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    });
    viewport?.addEventListener('pointerup', (event) => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
      render(index + (dx < 0 ? 1 : -1));
    });
    viewport?.addEventListener('pointercancel', () => { pointerStart = null; });

    render(0);
    return { experience, viewport, render, getIndex: () => index, length: slides.length };
  }

  const carousels = experiences.map(setupCarousel).filter(Boolean);

  function openExperience(name) {
    if (!hero || !heroDefault) return;
    const carousel = carousels.find((item) => item.experience.dataset.publicExperience === name);
    if (!carousel) return;
    heroDefault.hidden = true;
    experiences.forEach((experience) => { experience.hidden = experience !== carousel.experience; });
    hero.classList.add('rp-public-value-mode');
    carousel.render(0);
    activeCarousel = carousel;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => carousel.viewport?.focus(), 0);
  }

  function closeExperience() {
    if (!hero || !heroDefault) return;
    experiences.forEach((experience) => { experience.hidden = true; });
    hero.classList.remove('rp-public-value-mode');
    heroDefault.hidden = false;
    activeCarousel = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  entry.querySelectorAll('[data-public-open]').forEach((button) => {
    button.addEventListener('click', () => openExperience(button.dataset.publicOpen));
  });

  document.addEventListener('keydown', (event) => {
    if (!activeCarousel) return;
    if (event.key === 'Escape') closeExperience();
    if (event.key === 'ArrowLeft') activeCarousel.render(activeCarousel.getIndex() - 1);
    if (event.key === 'ArrowRight') activeCarousel.render(activeCarousel.getIndex() + 1);
  });

  entry.querySelectorAll('[data-public-create]').forEach((button) => {
    button.addEventListener('click', () => {
      if (activeCarousel) closeExperience();
      openAuth('signup');
    });
  });
})();
