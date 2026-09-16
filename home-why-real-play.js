(() => {
  if (window.__realPlayHomeWhyRealPlayInstalled) return;
  window.__realPlayHomeWhyRealPlayInstalled = true;

  const TRIGGER_ATTR = 'data-rp-home-why-real-play';
  const OVERLAY_ATTR = 'data-rp-doctrine-overlay';
  let overlay = null;
  let lastTrigger = null;
  let positionFrame = 0;

  const CHAPTERS = [
    {
      id: 'why',
      number: '01',
      title: 'WHY REAL PLAY?',
      subtitle: 'THE BIG PICTURE',
      description: 'What Real Play is, who it is for, and why an ordinary local player should be able to build a real basketball identity over time.',
      points: [
        'Real basketball happens on the court. The system records what actually happened.',
        'You do not need to be a professional athlete to have a persistent basketball career.',
        'Players can enter individually, keep one identity, and build history through verified play.',
        'Less Screen. Real Points. is the public invitation to return technology back to real-world activity.'
      ]
    },
    {
      id: 'mission',
      number: '02',
      title: 'MISSION & THE PROBLEM',
      subtitle: 'WHAT WE ARE TRYING TO SOLVE',
      description: 'Why Real Play exists as more than another local league or pickup group.',
      points: [
        'Busy students, workers, parents and business owners can lose a dependable reason to move and play.',
        'Local players are often scattered by schedule, location and availability even when they want to play.',
        'Great local performances usually disappear after the game because there is no lasting record.',
        'Real Play organizes recurring demand into actual physical basketball and preserves what players earn.'
      ]
    },
    {
      id: 'philosophy',
      number: '03',
      title: 'PHILOSOPHY',
      subtitle: 'BASKETBALL THAT FITS REAL LIFE',
      description: 'The beliefs that shape how Real Play is designed and why the system should serve real life instead of taking it over.',
      points: [
        'Basketball should have a dependable place in real life without needing to become your profession.',
        'A recurring weekly rhythm can create anticipation without demanding everyday organized play.',
        'Technology should organize, preserve and motivate activity that happens in the physical world.',
        'The player is permanent. Sessions, teams and seasons can change while the player career continues.'
      ]
    },
    {
      id: 'player',
      number: '04',
      title: 'THE REAL PLAY PLAYER',
      subtitle: 'ONE PLAYER. ONE CAREER.',
      description: 'How Real Play treats the player as the permanent identity across games, teams, courts and seasons.',
      points: [
        'One profile carries your name, jersey identity, OVR, Rank, stats, Play Time, recognitions and history.',
        'Your player exists before any League team and continues after a season ends.',
        'Changing teams or playing at another accredited Hub does not create a second basketball identity.',
        'Video, highlights and verified records can become part of the same long-term player history.'
      ]
    },
    {
      id: 'mechanics',
      number: '05',
      title: 'COMPETITION & GAME MECHANICS',
      subtitle: 'HOW THE BASKETBALL WORKS',
      description: 'The competition contexts, formats and rules that determine what counts inside Real Play.',
      points: [
        'Open Ranking develops the individual player before permanent League teams become the focus.',
        'Player formats can include 3V3, 4V4, 5V5 and other approved formats without changing the core identity system.',
        'A ruleset defines how a game is played; the competition context defines why the game exists and what it affects.',
        'Official competitive records come from completed, verified Real Play games.'
      ]
    },
    {
      id: 'rank',
      number: '06',
      title: 'OVR, RANK & FAIRNESS',
      subtitle: 'THE COMPETITIVE TRUTH',
      description: 'Why OVR and Rank are different, how eligibility works, and why commercial or personal influence cannot manufacture competitive position.',
      points: [
        'OVR is a player attribute. Rank is an official ordinal position among eligible players.',
        'Unranked players can still have an OVR while they complete the required verified-game gate.',
        'Ranking authority must be canonical and deterministic rather than derived independently by different screens.',
        'Money, sponsors, friendships and branding cannot buy Rank, MVP, stats or competitive results.'
      ]
    },
    {
      id: 'teams',
      number: '07',
      title: 'TEAMS, CAPTAINS & LEAGUE',
      subtitle: 'FROM PLAYER TO TEAM',
      description: 'How individual careers become balanced League teams without replacing the authority of the player ranking system.',
      points: [
        'Open Ranking builds the player; Team Formation builds the roster; League builds the team history.',
        'Captain opportunity follows the authoritative ranking rules defined for team formation.',
        'Team OVR legality protects competitive balance even when friends prefer to play together.',
        'A sponsor may fund or name a team, but Real Play remains the competitive authority.'
      ]
    },
    {
      id: 'operations',
      number: '08',
      title: 'HOW REAL PLAY OPERATES',
      subtitle: 'FROM SCHEDULE TO VERIFIED HISTORY',
      description: 'What happens operationally before, during and after an official Real Play session.',
      points: [
        'A Hub contains accredited Locations; a Session reserves a real time and place; a Game exists inside that session.',
        'Players book or secure a slot, check in, and enter an official roster before verified competition begins.',
        'Facilitators and scorers support the game while the system records official results and player events.',
        'Finalized games become the source for career stats, rankings, recognitions and history.'
      ]
    },
    {
      id: 'culture',
      number: '09',
      title: 'COMMUNITY, CULTURE & CONDUCT',
      subtitle: 'HOW WE COMPETE',
      description: 'The behavioral standards that protect Real Play as a competitive but respectful community.',
      points: [
        'Compete hard without direct disrespect, intimidation or toxic behavior.',
        'Sportsmanship, teachability and accountability matter alongside performance.',
        'Reports and moderation should rely on evidence and due process instead of rumor or popularity.',
        'The community should protect legitimate players while preventing malicious reporting and repeated misconduct.'
      ]
    },
    {
      id: 'faith',
      number: '10',
      title: 'FAITH & BELIEFS',
      subtitle: 'THE CHRISTIAN FOUNDATION',
      description: 'How the Christian identity of Real Play shapes its values while participation remains open to people who want to play respectfully.',
      points: [
        'Real Play is openly rooted in Christian belief and values rather than hiding that identity.',
        'Prayer, Biblical encouragement, Gospel sharing and invitations to Christian community may be part of the experience.',
        'Christian conviction must never be used as a shortcut around fairness, evidence or equal competitive standards.',
        'Players are expected to respect the community standards even when they do not personally share the same beliefs.'
      ]
    },
    {
      id: 'access',
      number: '11',
      title: 'ACCESSIBILITY & SPONSORSHIP',
      subtitle: 'FUND THE EXPERIENCE. NEVER THE RESULT.',
      description: 'How Real Play can become easier to access while keeping money completely separate from competitive advantage.',
      points: [
        'Sponsors can support courts, participation, jerseys, media, prizes, transportation and community programs.',
        'Team naming rights can give local businesses a meaningful identity inside a League season.',
        'Sponsor support can reduce how much ordinary players need to pay to participate.',
        'Sponsors fund the experience. Players earn the results.'
      ]
    },
    {
      id: 'network',
      number: '12',
      title: 'HUBS & THE FUTURE NETWORK',
      subtitle: 'LOCAL FIRST. ONE CONNECTED CAREER.',
      description: 'How Real Play can expand to more courts and communities without losing its local-player identity.',
      points: [
        'Players should normally be able to play near home while keeping one career across the network.',
        'Expansion follows real player demand and accredited locations rather than opening schedules simply to look bigger.',
        'Hubs can connect upward into city, regional and eventually national comparison while local play remains the foundation.',
        'Decentralize the games. Centralize the system.'
      ]
    }
  ];

  function homeRoot() {
    return document.querySelector('.rp-simple-home.rp-home-command-center');
  }

  function chapterCard(chapter) {
    return `
      <button class="rp-doctrine-chapter" type="button" data-rp-doctrine-chapter="${chapter.id}">
        <span class="rp-doctrine-chapter-number">${chapter.number}</span>
        <span class="rp-doctrine-chapter-copy">
          <small>${chapter.subtitle}</small>
          <strong>${chapter.title}</strong>
          <em>${chapter.description}</em>
        </span>
        <b aria-hidden="true">→</b>
      </button>`;
  }

  function buildOverlay() {
    if (overlay?.isConnected) return overlay;

    overlay = document.createElement('section');
    overlay.className = 'rp-doctrine-overlay';
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-label', 'Real Play doctrine');
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="rp-doctrine-shell">
        <header class="rp-doctrine-topbar">
          <button class="rp-doctrine-home" type="button" data-rp-doctrine-home>← HOME</button>
          <div class="rp-doctrine-brand"><strong>REAL PLAY</strong><span>DOCTRINE</span></div>
          <span class="rp-doctrine-count">12 CHAPTERS</span>
        </header>

        <main class="rp-doctrine-index" data-rp-doctrine-index>
          <section class="rp-doctrine-intro">
            <small>WHY REAL PLAY?</small>
            <h1>UNDERSTAND THE<br><span>SYSTEM BEHIND THE GAME.</span></h1>
            <p>Real Play is more than a schedule or a League. Explore the mission, philosophy, competitive system, culture and beliefs that define how it works.</p>
          </section>
          <nav class="rp-doctrine-list" aria-label="Real Play doctrine chapters">
            ${CHAPTERS.map(chapterCard).join('')}
          </nav>
        </main>

        <main class="rp-doctrine-detail" data-rp-doctrine-detail hidden>
          <button class="rp-doctrine-back" type="button" data-rp-doctrine-back>← ALL CHAPTERS</button>
          <section class="rp-doctrine-detail-hero">
            <small data-rp-doctrine-detail-number>01 · THE BIG PICTURE</small>
            <h1 data-rp-doctrine-detail-title>WHY REAL PLAY?</h1>
            <p data-rp-doctrine-detail-description></p>
          </section>
          <div class="rp-doctrine-points" data-rp-doctrine-points></div>
          <div class="rp-doctrine-detail-foot">
            <span>REAL PLAY BASKETBALL</span>
            <strong>LESS SCREEN. REAL POINTS.</strong>
          </div>
        </main>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('[data-rp-doctrine-home]')?.addEventListener('click', close);
    overlay.querySelector('[data-rp-doctrine-back]')?.addEventListener('click', showIndex);
    overlay.querySelectorAll('[data-rp-doctrine-chapter]').forEach((button) => {
      button.addEventListener('click', () => showChapter(button.dataset.rpDoctrineChapter));
    });

    return overlay;
  }

  function showIndex() {
    const panel = buildOverlay();
    if (!panel) return;
    const index = panel.querySelector('[data-rp-doctrine-index]');
    const detail = panel.querySelector('[data-rp-doctrine-detail]');
    if (index) index.hidden = false;
    if (detail) detail.hidden = true;
    panel.querySelector('.rp-doctrine-shell')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showChapter(id) {
    const panel = buildOverlay();
    const chapter = CHAPTERS.find((item) => item.id === id);
    if (!panel || !chapter) return;

    const index = panel.querySelector('[data-rp-doctrine-index]');
    const detail = panel.querySelector('[data-rp-doctrine-detail]');
    if (index) index.hidden = true;
    if (detail) detail.hidden = false;

    const number = panel.querySelector('[data-rp-doctrine-detail-number]');
    const title = panel.querySelector('[data-rp-doctrine-detail-title]');
    const description = panel.querySelector('[data-rp-doctrine-detail-description]');
    const points = panel.querySelector('[data-rp-doctrine-points]');

    if (number) number.textContent = `${chapter.number} · ${chapter.subtitle}`;
    if (title) title.textContent = chapter.title;
    if (description) description.textContent = chapter.description;
    if (points) {
      points.innerHTML = chapter.points.map((point, index) => `
        <article class="rp-doctrine-point">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <p>${point}</p>
        </article>`).join('');
    }

    panel.querySelector('.rp-doctrine-shell')?.scrollTo({ top: 0, behavior: 'instant' });
    window.setTimeout(() => {
      try { panel.querySelector('[data-rp-doctrine-back]')?.focus({ preventScroll: true }); } catch (_error) {}
    }, 0);
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-home-story-open');
    showIndex();
    try { lastTrigger?.focus({ preventScroll: true }); } catch (_error) {}
  }

  function open(trigger) {
    lastTrigger = trigger || document.querySelector(`[${TRIGGER_ATTR}]`);
    const panel = buildOverlay();
    if (!panel) return false;

    showIndex();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-home-story-open');
    window.setTimeout(() => {
      try { panel.querySelector('[data-rp-doctrine-home]')?.focus({ preventScroll: true }); } catch (_error) {}
    }, 0);
    return true;
  }

  function positionTrigger(trigger) {
    const root = homeRoot();
    const lockup = root?.querySelector('.rp-home-brand-lockup');
    const tagline = lockup?.querySelector('small');
    const session = root?.querySelector('[data-rp-home-open-rank]');
    if (!root || !tagline || !trigger) return;

    const rootRect = root.getBoundingClientRect();
    const taglineRect = tagline.getBoundingClientRect();
    const sessionRect = session?.getBoundingClientRect();
    let top = taglineRect.bottom - rootRect.top + 11;

    if (sessionRect) {
      const sessionTop = sessionRect.top - rootRect.top;
      top = Math.min(top, sessionTop - 36);
    }

    trigger.style.top = `${Math.max(0, Math.round(top))}px`;
  }

  function queuePosition(trigger) {
    if (!trigger) return;
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionTrigger(trigger);
    });
  }

  function ensureTrigger() {
    const root = homeRoot();
    const lockup = root?.querySelector('.rp-home-brand-lockup');
    if (!root || !lockup) return false;

    let trigger = root.querySelector(`[${TRIGGER_ATTR}]`);
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rp-home-why-real-play';
      trigger.setAttribute(TRIGGER_ATTR, 'true');
      trigger.setAttribute('aria-label', 'Why Real Play? Open the Real Play doctrine');
      trigger.innerHTML = 'WHY REAL PLAY? <span aria-hidden="true">i</span>';
      trigger.addEventListener('click', () => open(trigger));
    }

    if (trigger.parentElement !== root) root.appendChild(trigger);
    queuePosition(trigger);
    window.setTimeout(() => queuePosition(trigger), 250);
    window.setTimeout(() => queuePosition(trigger), 900);
    return true;
  }

  function install(attempt = 0) {
    if (ensureTrigger()) return;
    if (attempt >= 30) return;
    window.setTimeout(() => install(attempt + 1), 120);
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') {
      const detail = overlay.querySelector('[data-rp-doctrine-detail]');
      if (detail && !detail.hidden) showIndex();
      else close();
    }
  });

  window.addEventListener('resize', () => queuePosition(document.querySelector(`[${TRIGGER_ATTR}]`)));
  window.addEventListener('orientationchange', () => window.setTimeout(() => queuePosition(document.querySelector(`[${TRIGGER_ATTR}]`)), 120));

  window.RealPlayWhyRealPlay = { open: () => open(), close, showChapter };
  install();
})();
