(() => {
  if (window.__realPlayTeamSupportTiersInstalled) return;
  window.__realPlayTeamSupportTiersInstalled = true;

  const PROMPT_DELAY_MS = 260;
  let baselineReady = false;
  let hadTeam = false;
  let promptTimer = 0;

  function ensureStyle() {
    if (document.getElementById('rp-team-support-tier-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-team-support-tier-style';
    style.textContent = `
      .rp-team-support-sheet{max-width:480px}
      .rp-team-support-copy{margin:0 0 12px;color:#a9bdc9;font-size:.76rem;line-height:1.5}
      .rp-team-support-copy strong{color:#f7fbff}
      .rp-team-support-footnote{margin:11px 0 0;color:#78909d;font-size:.61rem;line-height:1.45;text-align:center}
      .rp-team-support-footnote strong{color:#cfefff}
      .rp-team-support-actions{display:grid;gap:8px;margin-top:14px}
      .rp-team-support-secondary,.rp-team-support-tertiary,.rp-team-support-path,.rp-team-support-role{
        width:100%;border:1px solid rgba(76,214,255,.18);border-radius:12px;background:rgba(4,20,29,.72);color:#f7fbff;text-align:left;cursor:pointer
      }
      .rp-team-support-secondary{padding:12px 13px;font-size:.7rem;font-weight:900;letter-spacing:.05em}
      .rp-team-support-secondary span{display:block;margin-top:4px;color:#8199a7;font-size:.58rem;font-weight:700;letter-spacing:0;line-height:1.35}
      .rp-team-support-tertiary{padding:10px 12px;border-color:transparent;background:transparent;color:#7d96a4;text-align:center;font-size:.61rem;font-weight:900;letter-spacing:.05em}
      .rp-team-support-paths{display:grid;gap:9px;margin:13px 0}
      .rp-team-support-path{padding:14px}
      .rp-team-support-path small{display:block;color:#53dcff;font-size:.55rem;font-weight:950;letter-spacing:.13em}
      .rp-team-support-path strong{display:block;margin:4px 0 5px;font-size:.95rem;letter-spacing:.02em}
      .rp-team-support-path p{margin:0;color:#8299a7;font-size:.64rem;line-height:1.4}
      .rp-team-support-path.money{border-color:rgba(255,211,91,.28);background:rgba(34,27,7,.32)}
      .rp-team-support-path.money small{color:#ffd35b}
      .rp-team-support-roles{display:grid;gap:8px;margin:12px 0}
      .rp-team-support-role{padding:11px 12px}
      .rp-team-support-role span{display:block;color:#53dcff;font-size:.55rem;font-weight:950;letter-spacing:.11em}
      .rp-team-support-role strong{display:block;margin:3px 0;color:#f7fbff;font-size:.82rem}
      .rp-team-support-role p{margin:0;color:#8299a7;font-size:.62rem;line-height:1.4}
      .rp-team-support-grid{display:grid;gap:8px;margin:12px 0}
      .rp-team-support-tier{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding:11px 12px;border:1px solid rgba(76,214,255,.18);border-radius:12px;background:rgba(4,20,29,.72)}
      .rp-team-support-tier span{display:block;color:#53dcff;font-size:.58rem;font-weight:900;letter-spacing:.12em}
      .rp-team-support-tier strong{display:block;margin-top:2px;color:#f7fbff;font-size:.9rem;letter-spacing:.02em}
      .rp-team-support-tier b{color:#f7fbff;font-size:1rem;white-space:nowrap}
      .rp-team-support-tier b small{color:#7994a3;font-size:.48rem;font-weight:900;letter-spacing:.08em}
      .rp-team-support-tier p{grid-column:1/-1;margin:0;color:#8299a7;font-size:.62rem;line-height:1.4}
      .rp-team-support-tier.sponsor{border-color:rgba(255,211,91,.32);background:rgba(34,27,7,.38)}
      .rp-team-support-tier.sponsor span{color:#ffd35b}
      .rp-team-support-rule{margin:10px 0 12px;padding:9px 10px;border-left:2px solid #42d8ff;background:rgba(66,216,255,.055);color:#8199a7;font-size:.61rem;line-height:1.45}
      .rp-team-support-rule strong{color:#dff7ff}
      .rp-team-support-impact{display:grid;gap:7px;margin:12px 0}
      .rp-team-support-impact div{padding:9px 10px;border-left:2px solid rgba(76,214,255,.55);background:rgba(66,216,255,.045)}
      .rp-team-support-impact strong{display:block;color:#eefbff;font-size:.66rem;letter-spacing:.04em}
      .rp-team-support-impact span{display:block;margin-top:2px;color:#8299a7;font-size:.61rem;line-height:1.38}
      .rp-team-support-back{display:inline-flex;align-items:center;gap:5px;margin:0 0 10px;padding:0;border:0;background:transparent;color:#74dfff;font-size:.58rem;font-weight:950;letter-spacing:.08em;cursor:pointer}
      .rp-team-support-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      .rp-team-support-appreciation{display:grid;place-items:center;gap:14px;padding:10px 4px 2px;text-align:center}
      .rp-team-support-appreciation-mark{height:42px;color:#53dcff;font-family:Georgia,serif;font-size:4.5rem;line-height:.78;opacity:.9;text-shadow:0 0 24px rgba(83,220,255,.18)}
      .rp-team-support-appreciation blockquote{max-width:390px;margin:0;color:#eef8ff;font-size:clamp(.9rem,3.4vw,1.08rem);font-weight:800;line-height:1.58;letter-spacing:.005em}
      .rp-team-support-appreciation blockquote strong{color:#fff;font-weight:950}
      .rp-team-support-appreciation cite{margin-top:2px;color:#53dcff;font-size:.55rem;font-style:normal;font-weight:950;letter-spacing:.15em}
      .rp-team-support-appreciation .rp-team-sheet-submit{width:100%;margin-top:10px}
      .rp-team-support-volunteer-menu{display:grid;gap:12px;text-align:center}
      .rp-team-support-volunteer-menu h3{margin:0 0 6px;color:#f3f8ff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;letter-spacing:.018em;text-transform:uppercase}
      .rp-team-support-volunteer-menu .rp-team-support-paths{grid-template-columns:1fr!important;margin:8px 0 0}
      .rp-team-support-volunteer-menu .rp-team-support-path{min-height:50px;display:grid;place-items:center;text-align:center}
      .rp-team-support-volunteer-menu .rp-team-support-path strong{margin:0;font-size:.82rem;letter-spacing:.06em}
      .rp-team-support-role-detail{text-align:center}
      .rp-team-support-role-detail .rp-team-support-copy{max-width:390px;margin:0 auto 14px;text-align:center}
      @media (min-width:560px){
        .rp-team-support-grid{grid-template-columns:1fr 1fr}
        .rp-team-support-tier{grid-template-columns:1fr}
        .rp-team-support-tier b{text-align:left}
        .rp-team-support-tier p{grid-column:auto}
        .rp-team-support-paths{grid-template-columns:1fr 1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function closePrompt() {
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function shell(kicker, title, body) {
    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><small>${kicker}</small><h3 id="rp-team-support-title">${title}</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Close support options" data-rp-team-support-close>×</button>
      </div>
      ${body}
    `;
  }

  function mainScreen() {
    return shell('REAL PLAY COMMUNITY', 'YOUR TEAM IS SET.', `
      <p class="rp-team-support-copy"><strong>Before you go:</strong> is Real Play helping you stay physically active, enjoy real competition, and build friendships through a healthy basketball community?</p>
      <p class="rp-team-support-copy">If yes, there are different ways you can help keep Real Play going. <strong>Money is only one of them.</strong></p>
      <div class="rp-team-support-actions">
        <button class="rp-team-sheet-submit" type="button" data-rp-team-support-screen="help">SEE HOW I CAN HELP</button>
        <button class="rp-team-support-secondary" type="button" data-rp-team-support-screen="playing">FOR NOW, I'LL SUPPORT BY PLAYING<span>Showing up, competing well, and being part of the community already matters.</span></button>
        <button class="rp-team-support-tertiary" type="button" data-rp-team-support-close>NOT NOW — TAKE ME TO MY TEAM</button>
      </div>
      <p class="rp-team-support-footnote"><strong>Your team and session spot are already secured.</strong> Helping Real Play is completely optional.</p>
    `);
  }

  function helpScreen() {
    return shell('HELP REAL PLAY CONTINUE', 'HOW WOULD YOU LIKE TO HELP?', `
      <button class="rp-team-support-back" type="button" data-rp-team-support-screen="main">← BACK</button>
      <p class="rp-team-support-copy">Every player can contribute differently. Choose the kind of support that fits you right now.</p>
      <div class="rp-team-support-paths">
        <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer">
          <small>NON-MONETARY SUPPORT</small>
          <strong>GIVE TIME / RESOURCES</strong>
          <p>Volunteer during games, help with operations, record footage, or lend equipment temporarily.</p>
        </button>
        <button class="rp-team-support-path money" type="button" data-rp-team-support-screen="money">
          <small>MONETARY SUPPORT</small>
          <strong>HELP FUND REAL PLAY</strong>
          <p>Help support courts, equipment, media, operations, and future sessions.</p>
        </button>
      </div>
      <button class="rp-team-support-tertiary" type="button" data-rp-team-support-close>TAKE ME TO MY TEAM</button>
    `);
  }

  function volunteerScreen() {
    return `
      <div class="rp-team-support-volunteer-menu">
        <h3 id="rp-team-support-title">HELP WITHOUT SPENDING.</h3>
        <div class="rp-team-support-paths" aria-label="Non-monetary support options">
          <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer-game"><strong>GAME OPERATIONS</strong></button>
          <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer-media"><strong>MEDIA CREW</strong></button>
          <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer-camera"><strong>EXTRA CAMERA ANGLE</strong></button>
          <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer-session"><strong>SESSION SUPPORT</strong></button>
        </div>
      </div>
    `;
  }

  function volunteerRoleScreen(title, explanation) {
    return shell('NON-MONETARY SUPPORT', title, `
      <div class="rp-team-support-role-detail">
        <button class="rp-team-support-back" type="button" data-rp-team-support-screen="volunteer">← BACK</button>
        <p class="rp-team-support-copy">${explanation}</p>
        <p class="rp-team-support-rule"><strong>INTERESTED?</strong> Tell a Real Play organizer during the session that you want to help with this role so we can coordinate it before the game starts.</p>
        <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>I'D LIKE TO HELP — TAKE ME TO MY TEAM</button>
      </div>
    `);
  }

  function moneyScreen() {
    return shell('OPTIONAL MONTHLY SUPPORT', 'HELP FUND REAL PLAY.', `
      <button class="rp-team-support-back" type="button" data-rp-team-support-screen="help">← BACK</button>
      <p class="rp-team-support-copy"><strong>Your team and session spot are already secured.</strong> Choose financial support only if it fits you and you want to help sustain the platform.</p>
      <div class="rp-team-support-grid" aria-label="Real Play monthly support levels">
        <article class="rp-team-support-tier">
          <div><span>SUPPORTER</span><strong>LEVEL 1</strong></div><b>₱99 <small>/ MONTH</small></b>
          <p>Supporter recognition · Basic profile customization</p>
        </article>
        <article class="rp-team-support-tier">
          <div><span>BUILDER</span><strong>LEVEL 2</strong></div><b>₱199 <small>/ MONTH</small></b>
          <p>More customization · Stronger jersey-number and legitimate booking priority</p>
        </article>
        <article class="rp-team-support-tier">
          <div><span>FOUNDING SUPPORTER</span><strong>LEVEL 3</strong></div><b>₱499 <small>/ MONTH</small></b>
          <p>Full available customization · Highest player-level support priority</p>
        </article>
        <article class="rp-team-support-tier sponsor">
          <div><span>SPONSOR</span><strong>LEVEL 4</strong></div><b>₱999 <small>/ MONTH</small></b>
          <p>Support recognition · Eligible business / brand visibility inside Real Play</p>
        </article>
      </div>
      <p class="rp-team-support-rule"><strong>SUPPORT NEVER BUYS BASKETBALL.</strong> It cannot change OVR, stats, MVP, matchmaking, or remove a spot another player already secured.</p>
      <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>CONTINUE TO MY TEAM</button>
    `);
  }

  function playingScreen() {
    return `
      <div class="rp-team-support-appreciation">
        <h3 id="rp-team-support-title" class="rp-team-support-sr-only">REAL PLAY APPRECIATION</h3>
        <div class="rp-team-support-appreciation-mark" aria-hidden="true">“</div>
        <blockquote>
          “Every time you choose the court, bring your effort, and play with respect, you give Real Play a reason to exist. You are not <strong>just playing</strong> — you are helping build this community. Thank you for showing up and making Real Play real.”
        </blockquote>
        <cite>— REAL PLAY BASKETBALL</cite>
        <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>CONTINUE TO MY TEAM</button>
      </div>
    `;
  }

  function renderScreen(overlay, screenName) {
    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (!panel) return;

    const screens = {
      main: mainScreen,
      help: helpScreen,
      volunteer: volunteerScreen,
      'volunteer-game': () => volunteerRoleScreen('GAME OPERATIONS', 'Volunteer as a game auditor or scorer. Help verify what happens on the court and support accurate game records.'),
      'volunteer-media': () => volunteerRoleScreen('MEDIA CREW', 'Volunteer as a cameraman. Help capture games, highlights, and moments players can look back on.'),
      'volunteer-camera': () => volunteerRoleScreen('EXTRA CAMERA ANGLE', 'Lend your phone as a game camera. Your phone stays yours; Real Play only borrows it during the game so we can record from more than one angle.'),
      'volunteer-session': () => volunteerRoleScreen('SESSION SUPPORT', 'Help with setup and game operations by organizing players, preparing the court flow, and keeping the session moving.'),
      money: moneyScreen,
      playing: playingScreen,
    };
    panel.innerHTML = (screens[screenName] || mainScreen)();

    panel.querySelectorAll('[data-rp-team-support-close]').forEach((button) => button.addEventListener('click', closePrompt));
    panel.querySelectorAll('[data-rp-team-support-screen]').forEach((button) => button.addEventListener('click', () => {
      renderScreen(overlay, button.dataset.rpTeamSupportScreen || 'main');
    }));

    window.setTimeout(() => {
      const preferred = panel.querySelector('.rp-team-sheet-submit, [data-rp-team-support-screen], [data-rp-team-support-close]');
      preferred?.focus();
    }, 50);
  }

  function openPrompt() {
    if (document.querySelector('[data-rp-team-support-overlay]')) return;
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'rp-team-sheet-overlay';
    overlay.dataset.rpTeamSupportOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<section class="rp-team-sheet rp-team-support-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-team-support-title" data-rp-team-support-panel></section>';

    document.body.appendChild(overlay);
    renderScreen(overlay, 'main');
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closePrompt(); });
    window.requestAnimationFrame(() => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
    });
  }

  function queuePrompt() {
    if (promptTimer) window.clearTimeout(promptTimer);
    promptTimer = window.setTimeout(() => {
      promptTimer = 0;
      openPrompt();
    }, PROMPT_DELAY_MS);
  }

  function scanTeamState() {
    const board = document.querySelector('[data-rp-session-teams]');
    if (!board || !board.isConnected || board.hidden || !board.innerHTML.trim()) return;

    const hasTeam = Boolean(board.querySelector('.rp-session-team-card.is-yours'));
    if (!baselineReady) {
      baselineReady = true;
      hadTeam = hasTeam;
      return;
    }

    if (!hadTeam && hasTeam) queuePrompt();
    hadTeam = hasTeam;
  }

  const observer = new MutationObserver(scanTeamState);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });

  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(scanTeamState, 80));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePrompt(); });

  scanTeamState();
})();