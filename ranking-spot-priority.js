(() => {
  if (window.__realPlayRankingSpotPriorityInstalled) return;
  window.__realPlayRankingSpotPriorityInstalled = true;

  const STYLE_ID = 'rp-ranking-spot-priority-style';

  let view = null;
  let trigger = null;
  let overlay = null;
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
        width:min(100%,430px);max-height:min(84dvh,720px);overflow:auto;box-sizing:border-box;padding:10px 14px 16px;
        border:1px solid rgba(65,200,238,.28);border-radius:24px 24px 18px 18px;
        background:linear-gradient(180deg,#071722 0%,#040b12 100%);
        box-shadow:0 -18px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
        transform:translateY(18px);transition:transform .18s ease;scrollbar-width:none;
      }
      .rp-spot-priority-sheet::-webkit-scrollbar{display:none}
      .rp-spot-priority-overlay.is-open .rp-spot-priority-sheet{transform:translateY(0)}
      .rp-spot-priority-grab{width:52px;height:4px;margin:1px auto 8px;border-radius:999px;background:rgba(146,171,190,.34)}
      .rp-spot-priority-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 1px 11px}
      .rp-spot-priority-head > div:first-child{min-width:0;flex:1 1 auto}
      .rp-spot-priority-head small{display:block;margin-bottom:4px;color:#60d9f2;font:950 .46rem/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-spot-priority-head h2{margin:0;color:#f7fbff;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.32rem;font-style:italic;font-weight:950;letter-spacing:.025em;line-height:1;text-transform:uppercase}
      .rp-spot-priority-close{
        flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);
        border-radius:50%;background:rgba(255,255,255,.035);color:#aebdca;font:700 1rem/1 Arial,sans-serif;cursor:pointer;
      }

      .rp-session-guide-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 11px;padding:4px;border:1px solid rgba(88,151,185,.14);border-radius:12px;background:rgba(2,10,17,.52)}
      .rp-session-guide-tab{min-height:36px;padding:0 8px;border:1px solid transparent;border-radius:9px;background:transparent;color:#72879a;font:950 .55rem/1 Arial,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer;appearance:none;-webkit-appearance:none}
      .rp-session-guide-tab:hover,.rp-session-guide-tab:focus-visible{color:#c7d8e4;outline:none}
      .rp-session-guide-tab.is-active{border-color:rgba(73,216,249,.50);background:linear-gradient(180deg,rgba(14,78,101,.46),rgba(8,43,60,.55));color:#68e1f9;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 0 18px rgba(50,203,241,.08)}
      .rp-session-guide-panel[hidden]{display:none!important}

      .rp-spot-priority-list{display:grid;gap:8px}
      .rp-spot-priority-row{display:grid;grid-template-columns:31px minmax(0,1fr);gap:11px;align-items:start;padding:11px 12px;border:1px solid rgba(102,153,184,.13);border-radius:13px;background:rgba(4,13,21,.72)}
      .rp-session-guide-panel[data-rp-session-guide-panel="priority"] .rp-spot-priority-row:first-child{border-color:rgba(83,224,189,.20);background:rgba(16,54,49,.24)}
      .rp-session-guide-panel[data-rp-session-guide-panel="setup"] .rp-spot-priority-row{border-color:rgba(73,205,239,.14);background:linear-gradient(180deg,rgba(5,18,28,.76),rgba(3,12,20,.78))}
      .rp-spot-priority-number{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(74,207,242,.22);border-radius:9px;color:#65dff7;font:950 .67rem/1 Arial,sans-serif}
      .rp-session-guide-panel[data-rp-session-guide-panel="priority"] .rp-spot-priority-row:first-child .rp-spot-priority-number{border-color:rgba(94,231,196,.24);color:#7aebca}
      .rp-spot-priority-copy strong{display:block;margin:1px 0 4px;color:#eef7fc;font:900 .68rem/1.15 Arial,sans-serif;letter-spacing:.035em;text-transform:uppercase}
      .rp-spot-priority-copy p{margin:0;color:#8192a5;font:650 .61rem/1.42 Arial,sans-serif}
      .rp-spot-priority-cap{margin-top:11px;padding:11px 12px;border:1px solid rgba(73,205,239,.18);border-radius:13px;background:rgba(24,115,144,.08);text-align:center}
      .rp-spot-priority-cap span{display:block;color:#72879a;font:900 .43rem/1 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-spot-priority-cap strong{display:block;margin-top:5px;color:#eef8fc;font:950 .76rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);letter-spacing:.035em;text-transform:uppercase}
      .rp-spot-priority-chain{margin:11px 0 1px;color:#65798c;font:900 .47rem/1.35 Arial,sans-serif;letter-spacing:.055em;text-align:center;text-transform:uppercase}
      .rp-spot-priority-chain b{color:#69dff7;font-weight:950}
      .rp-game-setup-note{margin:10px 2px 0;color:#65798c;font:750 .50rem/1.45 Arial,sans-serif;text-align:center}

      @media(max-width:390px){
        .rp-ranking-next .rp-spot-priority-trigger{width:32px;height:32px;border-radius:10px}
        .rp-spot-priority-sheet{padding-left:12px;padding-right:12px}
        .rp-spot-priority-head{gap:8px}
        .rp-spot-priority-head h2{font-size:1.2rem}
        .rp-spot-priority-close{width:34px;height:34px}
        .rp-session-guide-tab{font-size:.50rem;letter-spacing:.04em}
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

  function capacityLabel() {
    return `SESSION CAPACITY · ${sessionCapacity()} PLAYERS`;
  }

  function setupCapacityLabel() {
    return `${sessionCapacity()} PLAYERS · 4V4 TEAM ROTATION`;
  }

  function syncTab(nextTab = activeTab) {
    if (!overlay) return;
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

        <div class="rp-session-guide-panel" id="rp-session-guide-priority" role="tabpanel" data-rp-session-guide-panel="priority">
          <div class="rp-spot-priority-list">
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">1</span><div class="rp-spot-priority-copy"><strong>Secure Your Session Spot</strong><p>Reserve while session capacity is available. Once your spot is secured, another player joining later does not take it away.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">2</span><div class="rp-spot-priority-copy"><strong>Create or Join a Team</strong><p>Create a team or join one already listed. Team Reservation organizes the current 4v4 session, and every teammate still needs their own secured session spot.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">3</span><div class="rp-spot-priority-copy"><strong>Open, Private or Random</strong><p>Open teams can be joined by anyone. Private teams use a 4-digit code. Random Team fills an incomplete open team first, then creates a new open team when needed.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">4</span><div class="rp-spot-priority-copy"><strong>Full Session = Standby</strong><p>When secured capacity is full, new players wait in Standby. If a spot opens, the waiting list is re-evaluated using the current standby priority rules.</p></div></article>
          </div>
          <div class="rp-spot-priority-cap"><span>SESSION LIMIT</span><strong data-rp-spot-priority-capacity>SESSION CAPACITY</strong></div>
          <p class="rp-spot-priority-chain"><b>SECURE SPOT</b> → BUILD / JOIN TEAM → ROTATION → GAME</p>
        </div>

        <div class="rp-session-guide-panel" id="rp-session-guide-setup" role="tabpanel" data-rp-session-guide-panel="setup" hidden>
          <div class="rp-spot-priority-list">
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">1</span><div class="rp-spot-priority-copy"><strong>Team Reservation Organizes the Session</strong><p>The team board is for scheduling and rotation. Open Rank ranking and player identity still belong to each individual player.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">2</span><div class="rp-spot-priority-copy"><strong>Winner Stays · Loser Rests</strong><p>After a completed game, the losing team rotates out. The winning team stays to face the next challenger.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">3</span><div class="rp-spot-priority-copy"><strong>Maximum 2 Straight Wins</strong><p>A team can stay on the court for up to 2 consecutive wins. After that, a mandatory rotation opens the court for the next teams.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">4</span><div class="rp-spot-priority-copy"><strong>Present Teams Get Rotation Priority</strong><p>Teams with their players present are organized first. If teammates are missing, players may shuffle or join another available team when needed.</p></div></article>
            <article class="rp-spot-priority-row"><span class="rp-spot-priority-number">5</span><div class="rp-spot-priority-copy"><strong>Game Rules Are Confirmed Per Game</strong><p>The game card and ruleset decide the format and Race To target for that game. A Race To game uses a shot clock only when that game’s rules include one.</p></div></article>
          </div>
          <div class="rp-spot-priority-cap"><span>SESSION FLOW</span><strong data-rp-game-setup-capacity>16 PLAYERS · 4V4 TEAM ROTATION</strong></div>
          <p class="rp-game-setup-note">OPEN RANK · TEAM-BASED SCHEDULING · INDIVIDUAL RANKING</p>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    overlay.querySelector('.rp-spot-priority-close')?.addEventListener('click', close);
    overlay.querySelectorAll('[data-rp-session-guide-tab]').forEach((button) => {
      button.addEventListener('click', () => syncTab(button.dataset.rpSessionGuideTab));
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
    if (cap) cap.textContent = capacityLabel();
    const setupCap = node.querySelector('[data-rp-game-setup-capacity]');
    if (setupCap) setupCap.textContent = setupCapacityLabel();
    syncTab(activeTab);
    node.classList.add('is-open');
    node.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => node.querySelector('.rp-session-guide-tab.is-active')?.focus({ preventScroll:true }), 20);
  }

  function close() {
    if (!overlay) return;
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
      close();
      return;
    }
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
