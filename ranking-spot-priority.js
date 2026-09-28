(() => {
  if (window.__realPlayRankingSpotPriorityInstalled) return;
  window.__realPlayRankingSpotPriorityInstalled = true;

  const STYLE_ID = 'rp-ranking-spot-priority-style';

  const GUIDE_TOPICS = {
    priority: [
      {
        id:'secure-spot',
        title:'Secure Your Session Spot',
        eyebrow:'Reservation',
        points:[
          'Reserve while session capacity is still available.',
          'Once your spot is secured, another player joining later does not take it away.',
          'Your teammates still need to secure their own session spots.',
          'If the session is full, new players wait in Standby.'
        ]
      },
      {
        id:'create-join-team',
        title:'Create or Join a Team',
        eyebrow:'Reservation',
        points:[
          'Create a team or join one already listed for the current session.',
          'Team Reservation organizes the session; it does not replace your individual Open Rank identity.',
          'A team can hold up to 4 players for the current 4v4 setup.',
          'Joining a team does not reserve a session spot for the rest of that team.'
        ]
      },
      {
        id:'open-private-random',
        title:'Open, Private or Random',
        eyebrow:'Reservation',
        points:[
          'Open teams can be joined by any eligible player with a secured spot.',
          'Private teams use a 4-digit code shared by the team creator.',
          'Random Team first looks for an open team that still needs a player.',
          'If no suitable open team is available, Random Team can create a new open team.'
        ]
      },
      {
        id:'full-session-standby',
        title:'Full Session = Standby',
        eyebrow:'Reservation',
        points:[
          'When secured capacity is full, new entries wait in Standby.',
          'A Standby player does not remove someone who already has a secured spot.',
          'If capacity opens, the waiting list is checked again.',
          'Promotion from Standby follows the current session priority rules.'
        ]
      }
    ],
    setup: [
      {
        id:'team-reservation-flow',
        title:'Team Reservation Organizes the Session',
        eyebrow:'Game Flow',
        points:[
          'The team board is used to organize scheduling and court rotation.',
          'Open Rank ranking, OVR and player identity still belong to each individual player.',
          'Teams are useful for organizing the session without locking players into permanent team identity.',
          'Players may still shuffle when the session needs it.'
        ]
      },
      {
        id:'winner-stays',
        title:'Winner Stays · Loser Rests',
        eyebrow:'Game Flow',
        points:[
          'After a completed game, the losing team rotates out to rest.',
          'The winning team stays on court to face the next challenger.',
          'If the challenger wins, that challenger becomes the team that stays.',
          'The rotation keeps games moving without rebuilding the whole queue after every result.'
        ]
      },
      {
        id:'two-win-limit',
        title:'Maximum 2 Straight Wins',
        eyebrow:'Game Flow',
        points:[
          'A team can stay on court for up to 2 consecutive wins.',
          'After the second straight win, that team must rotate out.',
          'The mandatory rest opens the court for the next available teams.',
          'The rule prevents one team from controlling the court for the whole session.'
        ]
      },
      {
        id:'present-team-priority',
        title:'Present Teams Get Rotation Priority',
        eyebrow:'Game Flow',
        points:[
          'Teams with their needed players present are easier to place into the next game.',
          'A team missing players may have to wait until it can field a playable lineup.',
          'Players may shuffle or join another available team when needed.',
          'The goal is to keep the session moving rather than leave the court waiting for missing players.'
        ]
      },
      {
        id:'rules-per-game',
        title:'Game Rules Are Confirmed Per Game',
        eyebrow:'Game Flow',
        points:[
          'The game card and selected ruleset define the format for that specific game.',
          'Race To targets can vary instead of being permanently fixed to one score.',
          'A Race To game uses a shot clock only when the selected rules include one.',
          'Always follow the confirmed game setup shown for the game being played.'
        ]
      }
    ]
  };

  let view = null;
  let trigger = null;
  let overlay = null;
  let detailReturnFocus = null;
  let activeTab = 'priority';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-ranking-next .rp-spot-priority-trigger{
        position:static;flex:0 0 auto;align-self:center;width:34px;height:34px;margin:0 0 0 auto;padding:0;
        display:grid;place-items:center;border:1px solid rgba(68,207,242,.28);border-radius:11px;
        background:linear-gradient(180deg,rgba(7,25,37,.96),rgba(4,13,21,.98));color:#76dff6;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 6px 16px rgba(0,0,0,.20);
        transform:none;visibility:hidden;appearance:none;-webkit-appearance:none;cursor:pointer;
      }
      .rp-ranking-next.rp-team-reservation-enabled .rp-spot-priority-trigger{visibility:visible}
      .rp-ranking-next .rp-ranking-section-head>div:first-child{min-width:0}
      .rp-ranking-next .rp-spot-priority-trigger:hover,
      .rp-ranking-next .rp-spot-priority-trigger:focus-visible{
        border-color:rgba(75,218,250,.48);background:linear-gradient(180deg,rgba(8,31,45,.98),rgba(5,17,27,.99));outline:none;
      }
      .rp-ranking-next .rp-spot-priority-trigger svg{width:17px;height:17px;display:block}

      .rp-spot-priority-overlay{
        position:fixed;inset:0;z-index:2450;display:flex;align-items:flex-end;justify-content:center;
        padding:18px 12px max(18px,env(safe-area-inset-bottom));box-sizing:border-box;background:rgba(0,3,7,.70);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .18s ease,visibility .18s ease;
      }
      .rp-spot-priority-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .rp-spot-priority-sheet{
        width:min(100%,430px);max-height:min(84dvh,720px);overflow:auto;box-sizing:border-box;padding:10px 14px 14px;
        border:1px solid rgba(65,200,238,.28);border-radius:24px 24px 18px 18px;
        background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -18px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
        transform:translateY(18px);transition:transform .18s ease;scrollbar-width:none;
      }
      .rp-spot-priority-sheet::-webkit-scrollbar{display:none}
      .rp-spot-priority-overlay.is-open .rp-spot-priority-sheet{transform:translateY(0)}
      .rp-spot-priority-grab{width:52px;height:4px;margin:1px auto 8px;border-radius:999px;background:rgba(146,171,190,.34)}
      .rp-spot-priority-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 1px 11px}
      .rp-spot-priority-head>div:first-child{min-width:0;flex:1 1 auto}
      .rp-spot-priority-head small{display:block;margin-bottom:4px;color:#60d9f2;font:950 .46rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-spot-priority-head h2{margin:0;color:#f7fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.32rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1;text-transform:uppercase}
      .rp-spot-priority-close{
        flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);
        border-radius:50%;background:rgba(255,255,255,.035);color:#aebdca;font:700 1rem/1 Arial,sans-serif;cursor:pointer;
      }

      .rp-session-guide-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 9px;padding:4px;border:1px solid rgba(88,151,185,.14);border-radius:12px;background:rgba(2,10,17,.52)}
      .rp-session-guide-tab{min-height:36px;padding:0 8px;border:1px solid transparent;border-radius:9px;background:transparent;color:#72879a;font:950 .55rem/1 Arial,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer;appearance:none;-webkit-appearance:none}
      .rp-session-guide-tab:hover,.rp-session-guide-tab:focus-visible{color:#c7d8e4;outline:none}
      .rp-session-guide-tab.is-active{border-color:rgba(73,216,249,.50);background:linear-gradient(180deg,rgba(14,78,101,.46),rgba(8,43,60,.55));color:#68e1f9;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 0 18px rgba(50,203,241,.08)}
      .rp-session-guide-panel[hidden]{display:none!important}
      .rp-session-guide-hint{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 0 9px;color:#6f8498;font:800 .49rem/1 Arial,sans-serif;letter-spacing:.035em}
      .rp-session-guide-hint::before{content:'i';width:17px;height:17px;display:grid;place-items:center;border:1px solid rgba(81,211,244,.38);border-radius:50%;color:#64dbf4;font:950 .54rem/1 Arial,sans-serif}

      .rp-spot-priority-list{display:grid;gap:7px}
      .rp-spot-priority-row{
        width:100%;min-height:54px;display:grid;grid-template-columns:31px minmax(0,1fr) 18px;gap:10px;align-items:center;
        padding:9px 11px;border:1px solid rgba(90,161,196,.17);border-radius:13px;
        background:linear-gradient(115deg,rgba(5,18,28,.84),rgba(3,12,20,.90));color:inherit;text-align:left;
        appearance:none;-webkit-appearance:none;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.02);
        transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease;
      }
      .rp-spot-priority-row:hover,.rp-spot-priority-row:focus-visible{
        border-color:rgba(73,216,249,.42);background:linear-gradient(115deg,rgba(7,31,44,.94),rgba(4,16,25,.96));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 20px rgba(0,0,0,.18);outline:none;
      }
      .rp-spot-priority-row:active{transform:scale(.992)}
      .rp-spot-priority-number{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(74,207,242,.24);border-radius:9px;color:#65dff7;font:950 .67rem/1 Arial,sans-serif;background:rgba(16,69,86,.12)}
      .rp-spot-priority-copy{min-width:0}
      .rp-spot-priority-copy strong{display:block;margin:0;color:#eef7fc;font:950 .67rem/1.16 Arial,sans-serif;letter-spacing:.03em;text-transform:uppercase}
      .rp-session-guide-chevron{color:#58d6f2;font:900 1.05rem/1 Arial,sans-serif;text-align:right;opacity:.85}
      .rp-session-guide-footer{margin:10px 2px 0;padding-top:9px;border-top:1px solid rgba(95,143,170,.13);color:#617589;font:850 .46rem/1.25 Arial,sans-serif;letter-spacing:.075em;text-align:center;text-transform:uppercase}
      .rp-session-guide-footer b{color:#91a9bb;font-weight:950}

      .rp-session-guide-detail-overlay{
        position:fixed;inset:0;z-index:2465;display:flex;align-items:flex-end;justify-content:center;
        padding:18px 12px max(18px,env(safe-area-inset-bottom));box-sizing:border-box;background:rgba(0,4,8,.74);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .16s ease,visibility .16s ease;
      }
      .rp-session-guide-detail-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .rp-session-guide-detail{
        width:min(100%,406px);max-height:min(76dvh,620px);overflow:auto;box-sizing:border-box;padding:13px 14px 14px;
        border:1px solid rgba(73,216,249,.38);border-radius:22px 22px 17px 17px;
        background:radial-gradient(circle at 86% 0%,rgba(26,122,157,.17),transparent 35%),linear-gradient(180deg,#071b28 0%,#040b12 100%);
        box-shadow:0 -18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.045);
        transform:translateY(18px) scale(.99);transition:transform .16s ease;scrollbar-width:none;
      }
      .rp-session-guide-detail-overlay.is-open .rp-session-guide-detail{transform:translateY(0) scale(1)}
      .rp-session-guide-detail::-webkit-scrollbar{display:none}
      .rp-session-guide-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:1px 0 12px;border-bottom:1px solid rgba(87,155,187,.16)}
      .rp-session-guide-detail-head>div{min-width:0}
      .rp-session-guide-detail-head small{display:block;margin:0 0 5px;color:#5ddcf6;font:950 .45rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-session-guide-detail-head h3{margin:0;color:#f5fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.14rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1.08;text-transform:uppercase}
      .rp-session-guide-detail-close{flex:0 0 auto;width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.04);color:#b9c9d4;font:800 .95rem/1 Arial,sans-serif;cursor:pointer}
      .rp-session-guide-detail-points{display:grid;margin:3px 0 0}
      .rp-session-guide-detail-point{display:grid;grid-template-columns:27px minmax(0,1fr);gap:10px;align-items:start;padding:12px 1px;border-bottom:1px solid rgba(85,141,169,.13)}
      .rp-session-guide-detail-point:last-child{border-bottom:0}
      .rp-session-guide-detail-check{width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(74,207,242,.22);border-radius:8px;background:rgba(17,76,95,.14);color:#65dff7;font:950 .66rem/1 Arial,sans-serif}
      .rp-session-guide-detail-point p{margin:1px 0 0;color:#a8bac8;font:720 .64rem/1.48 Arial,sans-serif}
      .rp-session-guide-detail-done{width:100%;min-height:42px;margin-top:7px;border:1px solid rgba(73,216,249,.45);border-radius:12px;background:linear-gradient(180deg,rgba(12,77,100,.72),rgba(6,38,53,.84));color:#7ce7fb;font:950 .59rem/1 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;appearance:none;-webkit-appearance:none}
      .rp-session-guide-detail-done:hover,.rp-session-guide-detail-done:focus-visible{border-color:rgba(88,228,255,.7);background:linear-gradient(180deg,rgba(14,94,121,.82),rgba(7,48,66,.91));outline:none}

      @media(max-width:390px){
        .rp-ranking-next .rp-spot-priority-trigger{width:32px;height:32px;border-radius:10px}
        .rp-spot-priority-sheet{padding-left:12px;padding-right:12px}
        .rp-spot-priority-head{gap:8px}
        .rp-spot-priority-head h2{font-size:1.2rem}
        .rp-spot-priority-close{width:34px;height:34px}
        .rp-session-guide-tab{font-size:.50rem;letter-spacing:.04em}
        .rp-spot-priority-row{min-height:51px;padding:8px 10px;gap:9px}
        .rp-spot-priority-copy strong{font-size:.62rem}
        .rp-session-guide-detail{padding-left:12px;padding-right:12px}
        .rp-session-guide-detail-head h3{font-size:1.04rem}
      }
    `;
    document.head.appendChild(style);
  }

  function sessionCapacity() {
    const total = view?.querySelector('[data-rp-ranking-access-total]');
    const text = String(total?.textContent || '').trim();
    const match = text.match(/\d+\s*\/\s*(\d+)/);
    return match ? Number(match[1]) : 16;
  }

  function renderTopics(tab) {
    return GUIDE_TOPICS[tab].map((topic, index) => `
      <button class="rp-spot-priority-row" type="button" data-rp-guide-topic="${topic.id}" data-rp-guide-tab-group="${tab}">
        <span class="rp-spot-priority-number">${index + 1}</span>
        <span class="rp-spot-priority-copy"><strong>${topic.title}</strong></span>
        <span class="rp-session-guide-chevron" aria-hidden="true">›</span>
      </button>`).join('');
  }

  function topicById(tab, id) {
    return GUIDE_TOPICS[tab]?.find((topic) => topic.id === id) || null;
  }

  function syncTab(nextTab = activeTab) {
    if (!overlay) return;
    closeDetail(false);
    activeTab = nextTab === 'setup' ? 'setup' : 'priority';

    overlay.querySelectorAll('[data-rp-session-guide-tab]').forEach((button) => {
      const selected = button.dataset.rpSessionGuideTab === activeTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    });

    overlay.querySelectorAll('[data-rp-session-guide-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.rpSessionGuidePanel !== activeTab;
    });
  }

  function detailNode() {
    return overlay?.querySelector('[data-rp-session-guide-detail-overlay]') || null;
  }

  function openDetail(event) {
    const button = event?.currentTarget;
    const tab = button?.dataset.rpGuideTabGroup;
    const topic = topicById(tab, button?.dataset.rpGuideTopic);
    const detail = detailNode();
    if (!topic || !detail) return;

    detailReturnFocus = button;
    const eyebrow = detail.querySelector('[data-rp-guide-detail-eyebrow]');
    const title = detail.querySelector('[data-rp-guide-detail-title]');
    const points = detail.querySelector('[data-rp-guide-detail-points]');
    if (eyebrow) eyebrow.textContent = `${topic.eyebrow} Guide`;
    if (title) title.textContent = topic.title;
    if (points) {
      points.innerHTML = topic.points.map((point, index) => `
        <div class="rp-session-guide-detail-point">
          <span class="rp-session-guide-detail-check">${index + 1}</span>
          <p>${point}</p>
        </div>`).join('');
    }

    detail.classList.add('is-open');
    detail.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => detail.querySelector('.rp-session-guide-detail-close')?.focus({ preventScroll:true }), 20);
  }

  function closeDetail(restoreFocus = true) {
    const detail = detailNode();
    if (!detail?.classList.contains('is-open')) return false;
    detail.classList.remove('is-open');
    detail.setAttribute('aria-hidden', 'true');
    if (restoreFocus) {
      try { detailReturnFocus?.focus({ preventScroll:true }); } catch (_error) {}
    }
    detailReturnFocus = null;
    return true;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rp-spot-priority-overlay';
    overlay.dataset.rpSpotPriorityOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-spot-priority-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-session-guide-title">
        <div class="rp-spot-priority-grab" aria-hidden="true"></div>
        <header class="rp-spot-priority-head">
          <div><small>HOW REAL PLAY WORKS</small><h2 id="rp-session-guide-title">SESSION GUIDE</h2></div>
          <button class="rp-spot-priority-close" type="button" aria-label="Close session guide">×</button>
        </header>

        <div class="rp-session-guide-tabs" role="tablist" aria-label="Session guide sections">
          <button class="rp-session-guide-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="rp-session-guide-priority" data-rp-session-guide-tab="priority">RESERVATION</button>
          <button class="rp-session-guide-tab" type="button" role="tab" aria-selected="false" aria-controls="rp-session-guide-setup" data-rp-session-guide-tab="setup" tabindex="-1">GAME FLOW</button>
        </div>
        <div class="rp-session-guide-hint">Tap a topic to learn more</div>

        <div class="rp-session-guide-panel" id="rp-session-guide-priority" role="tabpanel" data-rp-session-guide-panel="priority">
          <div class="rp-spot-priority-list">${renderTopics('priority')}</div>
          <div class="rp-session-guide-footer"><b data-rp-spot-priority-capacity>Session Capacity</b></div>
        </div>

        <div class="rp-session-guide-panel" id="rp-session-guide-setup" role="tabpanel" data-rp-session-guide-panel="setup" hidden>
          <div class="rp-spot-priority-list">${renderTopics('setup')}</div>
          <div class="rp-session-guide-footer"><b data-rp-game-setup-capacity>Session Flow</b></div>
        </div>
      </section>

      <div class="rp-session-guide-detail-overlay" data-rp-session-guide-detail-overlay aria-hidden="true">
        <section class="rp-session-guide-detail" role="dialog" aria-modal="true" aria-labelledby="rp-session-guide-detail-title">
          <header class="rp-session-guide-detail-head">
            <div>
              <small data-rp-guide-detail-eyebrow>Guide</small>
              <h3 id="rp-session-guide-detail-title" data-rp-guide-detail-title>Topic</h3>
            </div>
            <button class="rp-session-guide-detail-close" type="button" aria-label="Close topic explanation">×</button>
          </header>
          <div class="rp-session-guide-detail-points" data-rp-guide-detail-points></div>
          <button class="rp-session-guide-detail-done" type="button">Got It</button>
        </section>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('.rp-spot-priority-close')?.addEventListener('click', close);
    overlay.querySelectorAll('[data-rp-session-guide-tab]').forEach((button) => {
      button.addEventListener('click', () => syncTab(button.dataset.rpSessionGuideTab));
    });
    overlay.querySelectorAll('[data-rp-guide-topic]').forEach((button) => {
      button.addEventListener('click', openDetail);
    });
    overlay.querySelector('.rp-session-guide-detail-close')?.addEventListener('click', () => closeDetail(true));
    overlay.querySelector('.rp-session-guide-detail-done')?.addEventListener('click', () => closeDetail(true));
    overlay.querySelector('[data-rp-session-guide-detail-overlay]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeDetail(true);
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    syncTab(activeTab);
    return overlay;
  }

  function open() {
    const node = ensureOverlay();
    const cap = node.querySelector('[data-rp-spot-priority-capacity]');
    if (cap) cap.textContent = `SESSION CAPACITY · ${sessionCapacity()} PLAYERS`;
    const setupCap = node.querySelector('[data-rp-game-setup-capacity]');
    if (setupCap) setupCap.textContent = `SESSION FLOW · ${sessionCapacity()} PLAYERS · 4V4`;
    syncTab(activeTab);
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => node.querySelector('.rp-session-guide-tab.is-active')?.focus({ preventScroll:true }), 20);
  }

  function close() {
    if (!overlay) return;
    closeDetail(false);
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    try { trigger?.focus({ preventScroll:true }); } catch (_error) {}
  }

  function mount() {
    view = document.querySelector('[data-rp-ranking-games]');
    const head = view?.querySelector('.rp-ranking-next .rp-ranking-section-head');
    if (!view || !head) return false;
    installStyles();

    trigger = head.querySelector('[data-rp-spot-priority]');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rp-spot-priority-trigger';
      trigger.dataset.rpSpotPriority = 'true';
      trigger.setAttribute('aria-label', 'Open session guide');
      trigger.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6h9M5 12h12M5 18h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M17.5 5.5v5m0 0-2-2m2 2 2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      trigger.addEventListener('click', open);
      head.appendChild(trigger);
    }
    return true;
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!closeDetail(true)) close();
      return;
    }
    if (detailNode()?.classList.contains('is-open')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = activeTab === 'priority' ? 'setup' : 'priority';
    syncTab(next);
    overlay.querySelector('.rp-session-guide-tab.is-active')?.focus({ preventScroll:true });
  });

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }
})();
