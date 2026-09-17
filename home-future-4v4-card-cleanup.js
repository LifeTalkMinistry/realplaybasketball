(() => {
  if (window.__realPlayFuture4v4CardCleanupInstalled) return;
  window.__realPlayFuture4v4CardCleanupInstalled = true;

  const STYLE_ID = 'rp-home-future-4v4-card-cleanup-style';
  const VIEW_ATTR = 'data-rp-4v4-static-view';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS', verse: 'Proverbs 28:1', art: 'assets/3v3/clubs/lions-logo.png' },
    { id: 'valiant', name: 'VALIANT', verse: 'Joshua 1:9', art: 'assets/3v3/clubs/valiant-logo.png' },
    { id: 'watchmen', name: 'WATCHMEN', verse: 'Isaiah 62:6', art: 'assets/3v3/clubs/watchmen-logo.png' },
    { id: 'conquerors', name: 'CONQUERORS', verse: 'Romans 8:37', art: 'assets/3v3/clubs/conquerors-logo.png' },
  ];

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Real Play could not complete that request.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function displayNumber(value, digits = 1) {
    const number = finiteNumber(value);
    if (number === null) return '—';
    if (Number.isInteger(number)) return String(number);
    return number.toFixed(digits).replace(/\.0$/, '');
  }

  function validRank(value) {
    const rank = Number(value);
    return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
  }

  function validNumber(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  function recordLabel(record) {
    const wins = finiteNumber(record?.wins);
    const losses = finiteNumber(record?.losses);
    const games = finiteNumber(record?.games);
    if (wins === null || losses === null || games === null || games <= 0) return '—';
    return `${Math.max(0, Math.trunc(wins))}-${Math.max(0, Math.trunc(losses))}`;
  }

  function winRateLabel(value) {
    const winRate = finiteNumber(value);
    return winRate === null ? '—' : `${displayNumber(winRate)}%`;
  }

  function topStatsLabel(topStats) {
    if (!Array.isArray(topStats) || !topStats.length) return '—';
    const labels = topStats.slice(0, 2).map((stat) => {
      if (typeof stat === 'string') return stat.trim().toUpperCase();
      const key = String(stat?.key || stat?.label || '').trim().toUpperCase();
      if (!key) return '';
      const value = finiteNumber(stat?.value);
      return value === null ? key : `${key} ${displayNumber(value)}`;
    }).filter(Boolean);
    return labels.length ? labels.join(' · ') : '—';
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4{
        min-height:108px!important;padding:18px!important;display:flex!important;
        flex-direction:column!important;justify-content:center!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4>strong{
        display:block!important;margin:0!important;font-size:1.08rem!important;line-height:1.05!important;
      }
      body.rp-simple-navigation-active .rp-home-coming-card.is-4v4 .rp-home-4v4-explore{margin-top:16px!important}
      body.rp-4v4-static-open{overflow:hidden!important}
      body.rp-4v4-static-open .rp-bottom-nav,body.rp-4v4-static-open .rp-simple-nav{display:none!important}
      .rp-4v4-static-view{z-index:760!important}
      .rp-4v4-static-view .rp-3v3-brand span{color:var(--rp-cyan)}
      .rp-4v4-static-view .rp-3v3-status{min-height:18px}

      .rp-4v4-preference-panel{
        margin-bottom:28px!important;padding:12px 12px 14px!important;
        border:1px solid rgba(79,218,255,.12)!important;border-radius:20px!important;
        background:linear-gradient(180deg,rgba(4,12,21,.92),rgba(3,8,14,.96))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035)!important;
      }
      .rp-4v4-preference-actions{display:flex;align-items:stretch;gap:8px;width:100%}
      .rp-4v4-preference-action{
        flex:1 1 auto!important;width:auto!important;min-width:0!important;min-height:46px!important;margin:0!important;padding:0 14px!important;
        cursor:pointer!important;border:1px solid rgba(84,219,255,.2)!important;border-radius:14px!important;
        color:#eefaff!important;background:#091727!important;font-family:var(--rp-display,Arial,sans-serif)!important;
        font-size:.72rem!important;font-style:italic!important;font-weight:1000!important;letter-spacing:.035em!important;
        line-height:1!important;text-transform:uppercase!important;transition:transform .16s ease,border-color .16s ease,background .16s ease!important;
      }
      .rp-4v4-preference-action::before,.rp-4v4-preference-action::after{display:none!important;content:none!important}
      .rp-4v4-preference-action:hover:not(:disabled){border-color:rgba(84,219,255,.52)!important;background:#0b1d31!important}
      .rp-4v4-preference-action:active:not(:disabled){transform:scale(.985)}
      .rp-4v4-preference-action.is-selected{
        color:#7ce8ff!important;border-color:rgba(84,219,255,.4)!important;
        background:linear-gradient(180deg,rgba(17,53,75,.96),rgba(8,29,44,.98))!important;
      }
      .rp-4v4-preference-action:disabled{cursor:default!important;opacity:.78!important}
      .rp-4v4-preference-cancel{
        flex:0 0 88px;min-height:46px;margin:0;padding:0 10px;cursor:pointer;border:1px solid rgba(255,117,132,.3);
        border-radius:14px;color:#ff9eaa;background:rgba(61,15,24,.34);font-family:var(--rp-display,Arial,sans-serif);
        font-size:.6rem;font-style:italic;font-weight:1000;letter-spacing:.04em;line-height:1;text-transform:uppercase;
        transition:transform .16s ease,border-color .16s ease,background .16s ease;
      }
      .rp-4v4-preference-cancel[hidden]{display:none!important}
      .rp-4v4-preference-cancel:hover:not(:disabled){border-color:rgba(255,117,132,.62);background:rgba(81,18,29,.5)}
      .rp-4v4-preference-cancel:active:not(:disabled){transform:scale(.985)}
      .rp-4v4-preference-cancel:disabled{cursor:default;opacity:.66}
      .rp-4v4-preference-note{
        margin:8px 2px 12px;color:#637a8d;font-size:.46rem;font-weight:900;letter-spacing:.085em;
        line-height:1.35;text-align:center;text-transform:uppercase;
      }
      .rp-4v4-preference-board{
        overflow:hidden;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(1,7,12,.72);
      }
      .rp-4v4-preference-board-head{
        display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px 9px;
        border-bottom:1px solid rgba(255,255,255,.065);
      }
      .rp-4v4-preference-board-head small{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b9bac;
        font-size:.48rem;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;
      }
      .rp-4v4-preference-board-head b{
        flex:none;min-width:24px;height:22px;display:grid;place-items:center;padding:0 7px;border-radius:999px;
        color:#6ce4ff;background:rgba(75,218,255,.09);font-family:var(--rp-display,Arial,sans-serif);
        font-size:.55rem;font-style:italic;font-weight:1000;
      }
      .rp-4v4-preference-list{display:flex;flex-direction:column;gap:8px;padding:10px}
      .rp-4v4-player-card{
        position:relative;width:100%;min-width:0;display:block;overflow:hidden;padding:0;
        border:1px solid rgba(93,151,191,.16);border-radius:13px;box-sizing:border-box;
        background:linear-gradient(105deg,rgba(7,20,31,.96),rgba(3,12,20,.96) 58%,rgba(6,21,30,.94));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.018),0 8px 24px rgba(0,0,0,.14);
      }
      .rp-4v4-player-card::before{
        content:"";position:absolute;inset:0 auto 0 0;width:2px;
        background:linear-gradient(180deg,rgba(70,218,255,.9),rgba(70,218,255,.05));opacity:.58;
      }
      .rp-4v4-player-identity{
        min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;
        border-bottom:1px solid rgba(108,151,190,.10);
      }
      .rp-4v4-player-name-cell,.rp-4v4-player-rank-cell{min-width:0;padding:10px 11px 9px}
      .rp-4v4-player-name-cell{padding-left:13px}
      .rp-4v4-player-rank-cell{min-width:64px;border-left:1px solid rgba(108,151,190,.10);text-align:center}
      .rp-4v4-player-label{
        display:block;margin-bottom:4px;color:#607a91;font-family:var(--rp-display,Arial,sans-serif);
        font-size:.36rem;font-weight:950;letter-spacing:.13em;line-height:1;text-transform:uppercase;white-space:nowrap;
      }
      .rp-4v4-player-name-line{min-width:0;display:flex;align-items:center;gap:7px}
      .rp-4v4-player-name{
        min-width:0;overflow:hidden;color:#eef7ff;font-family:var(--rp-display,Arial,sans-serif);
        font-size:.68rem;font-weight:950;letter-spacing:.035em;line-height:1.08;text-overflow:ellipsis;
        text-transform:uppercase;white-space:nowrap;
      }
      .rp-4v4-player-number{
        flex:none;padding:3px 5px;border:1px solid rgba(89,239,198,.16);border-radius:999px;
        background:rgba(58,218,172,.08);color:#72efc4;font-family:var(--rp-display,Arial,sans-serif);
        font-size:.31rem;font-weight:950;letter-spacing:.07em;line-height:1;
      }
      .rp-4v4-player-rank{
        display:block;color:#55ddff;font-family:var(--rp-display,Arial,sans-serif);font-size:.72rem;
        font-weight:950;letter-spacing:.02em;line-height:1;white-space:nowrap;
      }
      .rp-4v4-player-rank.is-unranked{color:#8397aa;font-size:.45rem;letter-spacing:.06em}
      .rp-4v4-player-performance{
        min-width:0;display:grid;grid-template-columns:56px 68px 76px minmax(0,1fr);align-items:stretch;
      }
      .rp-4v4-player-stat{min-width:0;padding:9px 8px 10px;border-right:1px solid rgba(108,151,190,.09)}
      .rp-4v4-player-stat:first-child{padding-left:13px}
      .rp-4v4-player-stat:last-child{padding-right:11px;border-right:0}
      .rp-4v4-player-value{
        display:block;min-width:0;overflow:hidden;color:#c8d8e5;font-family:var(--rp-display,Arial,sans-serif);
        font-size:.56rem;font-weight:950;letter-spacing:.025em;line-height:1.1;text-overflow:ellipsis;
        text-transform:uppercase;white-space:nowrap;
      }
      .rp-4v4-player-stat.is-ovr .rp-4v4-player-value{color:#f2f8fc;font-size:.64rem}
      .rp-4v4-player-stat.is-winrate .rp-4v4-player-value{color:#72efc4}
      .rp-4v4-player-stat.is-top-stats .rp-4v4-player-value{color:#8fdcf3;font-size:.49rem;letter-spacing:.015em}
      .rp-4v4-preference-empty,.rp-4v4-preference-loading{
        margin:0;padding:12px 8px;color:#65788a;font-size:.54rem;font-weight:850;letter-spacing:.045em;
        line-height:1.45;text-align:center;text-transform:uppercase;
      }
      .rp-4v4-preference-loading{color:#86a8bd}
      .rp-4v4-preference-error{color:#ff8e9a!important}
      @media(max-width:420px){
        .rp-4v4-preference-panel{margin-left:10px!important;margin-right:10px!important;padding:10px 10px 12px!important;border-radius:18px!important}
        .rp-4v4-preference-cancel{flex-basis:80px;font-size:.55rem;padding:0 8px}
        .rp-4v4-preference-list{padding:8px}
        .rp-4v4-player-performance{grid-template-columns:52px 62px 70px minmax(0,1fr)}
        .rp-4v4-player-stat{padding-left:6px;padding-right:6px}
        .rp-4v4-player-stat:first-child{padding-left:10px}
        .rp-4v4-player-stat:last-child{padding-right:8px}
        .rp-4v4-player-label{font-size:.33rem}
        .rp-4v4-player-value{font-size:.51rem}
        .rp-4v4-player-stat.is-top-stats .rp-4v4-player-value{font-size:.44rem}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCard() {
    installStyle();
    const card = document.querySelector('[data-rp-home-future-4v4="true"]') || document.querySelector('.rp-home-coming-card.is-4v4');
    if (!card) return false;
    card.querySelector(':scope > small')?.remove();
    card.querySelector(':scope > p')?.remove();
    card.querySelector(':scope > .rp-home-4v4-path')?.remove();
    const title = card.querySelector(':scope > strong');
    if (title && title.textContent.trim() !== '4V4 LEAGUE') title.textContent = '4V4 LEAGUE';
    const action = card.querySelector('.rp-home-4v4-explore');
    if (action) {
      if (action.textContent.trim() !== 'JOIN A TEAM NOW') action.textContent = 'JOIN A TEAM NOW';
      if (action.getAttribute('aria-label') !== 'Join a team now') action.setAttribute('aria-label', 'Join a team now');
    }
    return Boolean(title && action);
  }

  function closeRoadmap() {
    const roadmap = document.querySelector('[data-rp-home-coming-backdrop]');
    if (roadmap) roadmap.hidden = true;
    document.body.classList.remove('rp-home-coming-open');
    const oldPreview = document.querySelector('[data-rp-home-future-4v4-preview]');
    if (oldPreview) oldPreview.hidden = true;
    document.body.classList.remove('rp-home-team-preview-open');
  }

  function playerCard(player) {
    const number = validNumber(player?.playerNumber);
    const rank = validRank(player?.rank);
    const ovr = finiteNumber(player?.ovr);
    const record = recordLabel(player?.record);
    const winRate = winRateLabel(player?.winRate);
    const topStats = topStatsLabel(player?.topStats);
    const playerName = escapeHtml(player?.playerName || 'REAL PLAY PLAYER');

    return `
      <article class="rp-4v4-player-card">
        <div class="rp-4v4-player-identity">
          <div class="rp-4v4-player-name-cell">
            <span class="rp-4v4-player-label">NAME</span>
            <div class="rp-4v4-player-name-line">
              <strong class="rp-4v4-player-name" title="${playerName}">${playerName}</strong>
              ${number === null ? '' : `<span class="rp-4v4-player-number">#${number}</span>`}
            </div>
          </div>
          <div class="rp-4v4-player-rank-cell">
            <span class="rp-4v4-player-label">RANK</span>
            <strong class="rp-4v4-player-rank${rank ? '' : ' is-unranked'}">${rank ? `#${rank}` : 'UNRANKED'}</strong>
          </div>
        </div>
        <div class="rp-4v4-player-performance">
          <div class="rp-4v4-player-stat is-ovr">
            <span class="rp-4v4-player-label">OVR</span>
            <strong class="rp-4v4-player-value">${ovr === null ? '—' : Math.round(ovr)}</strong>
          </div>
          <div class="rp-4v4-player-stat is-record">
            <span class="rp-4v4-player-label">RECORD</span>
            <strong class="rp-4v4-player-value">${escapeHtml(record)}</strong>
          </div>
          <div class="rp-4v4-player-stat is-winrate">
            <span class="rp-4v4-player-label">WINRATE</span>
            <strong class="rp-4v4-player-value">${escapeHtml(winRate)}</strong>
          </div>
          <div class="rp-4v4-player-stat is-top-stats">
            <span class="rp-4v4-player-label">TOP STATS</span>
            <strong class="rp-4v4-player-value" title="${escapeHtml(topStats)}">${escapeHtml(topStats)}</strong>
          </div>
        </div>
      </article>`;
  }

  function ensureView() {
    let view = document.querySelector(`[${VIEW_ATTR}]`);
    if (view) return view;

    view = document.createElement('section');
    view.className = 'rp-3v3-view rp-4v4-static-view';
    view.setAttribute(VIEW_ATTR, 'true');
    view.setAttribute('aria-hidden', 'true');
    view.innerHTML = `
      <div class="rp-3v3-shell">
        <header class="rp-3v3-topbar">
          <button class="rp-3v3-back" type="button" aria-label="Back to Home" data-rp-4v4-static-back>←</button>
          <div class="rp-3v3-brand"><strong>REAL PLAY 4V4</strong><span>TEAM FORMATION</span></div>
          <div class="rp-3v3-topmark">4V4</div>
        </header>
        <section class="rp-3v3-select-head"><h1>SELECT YOUR TEAM.</h1></section>
        <div data-rp-4v4-browse>
          <section class="rp-3v3-team-picker" aria-label="Choose a Real Play team">
            <button class="rp-team-arrow rp-team-arrow-left" type="button" aria-label="Previous team" data-rp-4v4-prev>‹</button>
            <div class="rp-team-carousel" data-rp-4v4-carousel tabindex="0" aria-live="polite">
              ${CLUBS.map((club, index) => `
                <button class="rp-team-card has-club-art club-${club.id}" id="rp-4v4-team-${club.id}" type="button" data-rp-4v4-card="${index}" data-rp-three-club="${club.id}">
                  <small>REAL PLAY CLUB</small>
                  <img class="rp-team-card-logo" src="${club.art}" alt="${club.name} club logo" decoding="async" loading="eager" />
                  <strong>${club.name}</strong>
                  <span>${club.verse}</span>
                </button>
              `).join('')}
            </div>
            <button class="rp-team-arrow rp-team-arrow-right" type="button" aria-label="Next team" data-rp-4v4-next>›</button>
          </section>
          <div class="rp-team-dots" data-rp-4v4-dots aria-hidden="true">${CLUBS.map(() => '<i></i>').join('')}</div>
        </div>
        <p class="rp-3v3-status" data-rp-4v4-status></p>
        <section class="rp-3v3-session rp-4v4-preference-panel">
          <div class="rp-4v4-preference-actions">
            <button class="rp-4v4-preference-action" type="button" data-rp-4v4-preference-action>I PREFER THIS TEAM</button>
            <button class="rp-4v4-preference-cancel" type="button" data-rp-4v4-preference-cancel hidden>CANCEL</button>
          </div>
          <p class="rp-4v4-preference-note">EARLY PREFERENCE · NOT AN OFFICIAL ROSTER</p>
          <div class="rp-4v4-preference-board">
            <div class="rp-4v4-preference-board-head">
              <small>WHO PREFERS <span data-rp-4v4-preference-team>LIONS</span></small>
              <b data-rp-4v4-preference-count>0</b>
            </div>
            <div class="rp-4v4-preference-list" data-rp-4v4-preference-list>
              <p class="rp-4v4-preference-loading">LOADING PLAYER PREFERENCES…</p>
            </div>
          </div>
        </section>
      </div>`;

    document.body.appendChild(view);

    const cards = [...view.querySelectorAll('[data-rp-4v4-card]')];
    const dots = [...view.querySelectorAll('[data-rp-4v4-dots] i')];
    const carousel = view.querySelector('[data-rp-4v4-carousel]');
    const status = view.querySelector('[data-rp-4v4-status]');
    const preferenceAction = view.querySelector('[data-rp-4v4-preference-action]');
    const preferenceCancel = view.querySelector('[data-rp-4v4-preference-cancel]');
    const preferenceTeam = view.querySelector('[data-rp-4v4-preference-team]');
    const preferenceCount = view.querySelector('[data-rp-4v4-preference-count]');
    const preferenceList = view.querySelector('[data-rp-4v4-preference-list]');
    let activeIndex = 0;
    let pointerStartX = null;
    let preferredClub = null;
    let preferencePlayers = [];
    let preferenceLoading = false;
    let preferenceLoaded = false;
    let preferenceSaving = false;
    let preferenceCancelling = false;
    let preferenceError = '';
    const normalize = (index) => (index + cards.length) % cards.length;

    function setStatus(message = '', type = '') {
      status.textContent = message;
      status.classList.toggle('success', type === 'success');
      status.classList.toggle('error', type === 'error');
    }

    function sortedClubPlayers(clubId) {
      return preferencePlayers
        .filter((player) => String(player?.preferredClub || '').toLowerCase() === clubId)
        .sort((left, right) => {
          const leftRank = validRank(left?.rank);
          const rightRank = validRank(right?.rank);
          if (leftRank && rightRank) return leftRank - rightRank;
          if (leftRank) return -1;
          if (rightRank) return 1;
          const leftOvr = finiteNumber(left?.ovr) ?? -Infinity;
          const rightOvr = finiteNumber(right?.ovr) ?? -Infinity;
          if (leftOvr !== rightOvr) return rightOvr - leftOvr;
          const gamesDiff = (Number(right?.verifiedGames ?? right?.games ?? 0) || 0) - (Number(left?.verifiedGames ?? left?.games ?? 0) || 0);
          if (gamesDiff) return gamesDiff;
          return String(left?.playerName || '').localeCompare(String(right?.playerName || ''));
        });
    }

    function renderPreferenceBoard() {
      const club = CLUBS[activeIndex];
      const players = sortedClubPlayers(club.id);
      preferenceTeam.textContent = club.name;
      preferenceCount.textContent = String(players.length);

      const selected = preferredClub === club.id;
      preferenceAction.classList.toggle('is-selected', selected);
      preferenceAction.disabled = preferenceSaving || preferenceCancelling || selected;
      if (preferenceSaving) preferenceAction.textContent = 'SAVING…';
      else if (selected) preferenceAction.textContent = `${club.name} PREFERRED ✓`;
      else if (preferredClub) preferenceAction.textContent = `MAKE ${club.name} MY PREFERENCE`;
      else preferenceAction.textContent = `I PREFER ${club.name}`;

      preferenceCancel.hidden = !selected;
      preferenceCancel.disabled = preferenceSaving || preferenceCancelling;
      preferenceCancel.textContent = preferenceCancelling ? 'CANCELLING…' : 'CANCEL';

      if (preferenceLoading && !preferenceLoaded) {
        preferenceList.innerHTML = '<p class="rp-4v4-preference-loading">LOADING PLAYER PREFERENCES…</p>';
        return;
      }
      if (preferenceError && !preferenceLoaded) {
        preferenceList.innerHTML = `<p class="rp-4v4-preference-empty rp-4v4-preference-error">${escapeHtml(preferenceError)}</p>`;
        return;
      }
      if (!players.length) {
        preferenceList.innerHTML = '<p class="rp-4v4-preference-empty">NO PLAYER PREFERENCES YET · BE THE FIRST</p>';
        return;
      }

      preferenceList.innerHTML = players.map(playerCard).join('');
    }

    async function loadPreferences({ silent = false } = {}) {
      if (!token()) {
        preferenceLoaded = true;
        preferenceLoading = false;
        preferenceError = '';
        preferencePlayers = [];
        renderPreferenceBoard();
        return;
      }
      if (preferenceLoading) return;
      preferenceLoading = true;
      if (!silent) preferenceError = '';
      renderPreferenceBoard();
      try {
        const data = await api('/api/real-play/4v4/me');
        preferredClub = String(data?.preferredClub || '').toLowerCase() || null;
        preferencePlayers = Array.isArray(data?.preferencePlayers) ? data.preferencePlayers : [];
        preferenceLoaded = true;
        preferenceError = '';
      } catch (error) {
        preferenceError = error?.status === 404
          ? 'TEAM PREFERENCE SERVICE IS UPDATING · TRY AGAIN SHORTLY'
          : (error?.message || 'Could not load team preferences.');
      } finally {
        preferenceLoading = false;
        renderPreferenceBoard();
      }
    }

    async function savePreference() {
      const club = CLUBS[activeIndex];
      if (!token()) {
        setStatus('SIGN IN TO SAVE YOUR TEAM PREFERENCE.', 'error');
        return;
      }
      if (preferenceSaving || preferenceCancelling || preferredClub === club.id) return;
      preferenceSaving = true;
      setStatus('');
      renderPreferenceBoard();
      try {
        const data = await api('/api/real-play/4v4/preference', { method: 'PUT', body: { club: club.id } });
        preferredClub = String(data?.preferredClub || club.id).toLowerCase();
        setStatus(`${club.name} SAVED AS YOUR EARLY TEAM PREFERENCE.`, 'success');
        await loadPreferences({ silent: true });
      } catch (error) {
        setStatus(error?.status === 404
          ? 'TEAM PREFERENCE SERVICE IS UPDATING · TRY AGAIN SHORTLY.'
          : (error?.message || 'Could not save your team preference.'), 'error');
      } finally {
        preferenceSaving = false;
        renderPreferenceBoard();
      }
    }

    async function clearPreference() {
      const club = CLUBS[activeIndex];
      if (!token()) {
        setStatus('SIGN IN TO CHANGE YOUR TEAM PREFERENCE.', 'error');
        return;
      }
      if (preferenceSaving || preferenceCancelling || preferredClub !== club.id) return;
      preferenceCancelling = true;
      setStatus('');
      renderPreferenceBoard();
      try {
        await api('/api/real-play/4v4/preference', { method: 'DELETE' });
        preferredClub = null;
        setStatus(`${club.name} REMOVED AS YOUR EARLY TEAM PREFERENCE.`, 'success');
        await loadPreferences({ silent: true });
      } catch (error) {
        setStatus(error?.status === 404
          ? 'TEAM PREFERENCE SERVICE IS UPDATING · TRY AGAIN SHORTLY.'
          : (error?.message || 'Could not remove your team preference.'), 'error');
      } finally {
        preferenceCancelling = false;
        renderPreferenceBoard();
      }
    }

    function render(index = activeIndex) {
      activeIndex = normalize(index);
      const previous = normalize(activeIndex - 1);
      const next = normalize(activeIndex + 1);
      cards.forEach((card, cardIndex) => {
        const active = cardIndex === activeIndex;
        const prev = cardIndex === previous;
        const nextCard = cardIndex === next;
        const hidden = !active && !prev && !nextCard;
        card.classList.toggle('slot-active', active);
        card.classList.toggle('slot-prev', prev);
        card.classList.toggle('slot-next', nextCard);
        card.classList.toggle('slot-hidden', hidden);
        card.setAttribute('aria-current', active ? 'true' : 'false');
        card.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        card.tabIndex = hidden ? -1 : 0;
      });
      dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === activeIndex));
      carousel?.setAttribute('aria-activedescendant', cards[activeIndex]?.id || '');
      const club = CLUBS[activeIndex];
      view.dataset.rpActiveClub = club.id;
      setStatus(`${club.name} · ${club.verse}`);
      renderPreferenceBoard();
    }

    view.querySelector('[data-rp-4v4-prev]')?.addEventListener('click', () => render(activeIndex - 1));
    view.querySelector('[data-rp-4v4-next]')?.addEventListener('click', () => render(activeIndex + 1));
    cards.forEach((card, index) => card.addEventListener('click', () => { if (index !== activeIndex) render(index); }));
    preferenceAction?.addEventListener('click', savePreference);
    preferenceCancel?.addEventListener('click', clearPreference);
    carousel?.addEventListener('pointerdown', (event) => {
      if (!(event.pointerType === 'mouse' && event.button !== 0)) pointerStartX = event.clientX;
    });
    carousel?.addEventListener('pointerup', (event) => {
      if (pointerStartX === null) return;
      const delta = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(delta) >= 34) render(activeIndex + (delta < 0 ? 1 : -1));
    });
    carousel?.addEventListener('pointercancel', () => { pointerStartX = null; });
    carousel?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); render(activeIndex - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); render(activeIndex + 1); }
    });
    view.querySelector('[data-rp-4v4-static-back]')?.addEventListener('click', closeView);
    view.__rpLoad4v4Preferences = loadPreferences;
    render(0);
    return view;
  }

  function openView() {
    closeRoadmap();
    const view = ensureView();
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-4v4-static-open');
    view.scrollTop = 0;
    view.__rpLoad4v4Preferences?.();
    window.setTimeout(() => view.querySelector('[data-rp-4v4-static-back]')?.focus({ preventScroll: true }), 0);
  }

  function closeView() {
    const view = document.querySelector(`[${VIEW_ATTR}]`);
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-4v4-static-open');
  }

  document.addEventListener('click', (event) => {
    const action = event.target?.closest?.('.rp-home-4v4-explore');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openView();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const view = document.querySelector(`[${VIEW_ATTR}].open`);
    if (!view) return;
    event.preventDefault();
    closeView();
  });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (cleanCard() || attempts >= 60) window.clearInterval(timer);
  }, 100);
})();