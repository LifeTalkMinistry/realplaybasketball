(() => {
  if (window.__realPlayRankingSecuredPlayersInstalled) return;
  window.__realPlayRankingSecuredPlayersInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const POLL_MS = 5000;

  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  let loading = false;
  let pollTimer = 0;

  const style = document.createElement('style');
  style.dataset.rpRankingSecuredPlayers = 'true';
  style.textContent = `
    .rp-ranking-secured{
      margin-top:14px;
      padding-top:14px;
      border-top:1px solid rgba(108,151,190,.12);
    }
    .rp-ranking-secured[hidden]{display:none!important}
    .rp-ranking-secured-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:9px;
    }
    .rp-ranking-secured-head span,
    .rp-ranking-secured-head strong{
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.47rem;
      font-weight:950;
      letter-spacing:.12em;
      text-transform:uppercase;
    }
    .rp-ranking-secured-head span{color:#74889f}
    .rp-ranking-secured-head strong{color:#50dcff;text-align:right}
    .rp-ranking-session.joined .rp-ranking-secured-head strong{color:#72efc4}
    .rp-ranking-secured-list{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px;
    }
    .rp-ranking-secured-player{
      min-width:0;
      display:flex;
      align-items:center;
      gap:8px;
      min-height:34px;
      padding:7px 9px;
      border:1px solid rgba(120,160,199,.10);
      border-radius:10px;
      background:rgba(4,12,21,.72);
    }
    .rp-ranking-secured-player b{
      flex:0 0 auto;
      color:#54718e;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.44rem;
      font-weight:950;
      letter-spacing:.04em;
    }
    .rp-ranking-secured-player span{
      min-width:0;
      overflow:hidden;
      color:#d9e5ef;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.55rem;
      font-weight:900;
      letter-spacing:.035em;
      text-overflow:ellipsis;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-ranking-secured-player em{
      flex:0 0 auto;
      margin-left:auto;
      padding:3px 5px;
      border-radius:999px;
      background:rgba(58,218,172,.10);
      color:#72efc4;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.36rem;
      font-style:normal;
      font-weight:950;
      letter-spacing:.08em;
    }
    .rp-ranking-secured-player.is-you{
      border-color:rgba(74,237,191,.22);
      background:rgba(11,40,35,.52);
    }
    .rp-ranking-secured-empty{
      grid-column:1/-1;
      margin:0;
      padding:8px 2px 1px;
      color:#60758c;
      font-size:.58rem;
      font-weight:700;
      letter-spacing:.04em;
      text-align:center;
      text-transform:uppercase;
    }
    @media(max-width:390px){
      .rp-ranking-secured-list{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function ensureRoster() {
    const card = view.querySelector('[data-rp-ranking-session]');
    if (!card) return null;

    let roster = card.querySelector('[data-rp-ranking-secured]');
    if (roster) return roster;

    roster = document.createElement('section');
    roster.className = 'rp-ranking-secured';
    roster.dataset.rpRankingSecured = 'true';
    roster.hidden = true;
    roster.innerHTML = `
      <div class="rp-ranking-secured-head">
        <span>SECURED PLAYERS</span>
        <strong data-rp-ranking-secured-count>0 SECURED</strong>
      </div>
      <div class="rp-ranking-secured-list" data-rp-ranking-secured-list></div>
    `;

    const action = card.querySelector('[data-rp-ranking-session-action]');
    if (action) action.insertAdjacentElement('afterend', roster);
    else card.appendChild(roster);
    return roster;
  }

  function renderRoster(data = {}) {
    const roster = ensureRoster();
    if (!roster) return;

    const sessionId = Number(data.sessionId);
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
      roster.hidden = true;
      return;
    }

    const players = Array.isArray(data.players) ? data.players : [];
    const capacity = data.capacity === null || data.capacity === undefined ? null : Number(data.capacity);
    const count = Number.isFinite(Number(data.confirmedCount)) ? Number(data.confirmedCount) : players.length;
    const countNode = roster.querySelector('[data-rp-ranking-secured-count]');
    const list = roster.querySelector('[data-rp-ranking-secured-list]');

    roster.hidden = false;
    if (countNode) {
      countNode.textContent = Number.isFinite(capacity) && capacity > 0
        ? `${count} / ${capacity} SECURED`
        : `${count} SECURED`;
    }
    if (!list) return;

    list.replaceChildren();
    if (!players.length) {
      const empty = document.createElement('p');
      empty.className = 'rp-ranking-secured-empty';
      empty.textContent = 'NO PLAYERS SECURED YET';
      list.appendChild(empty);
      return;
    }

    players.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'rp-ranking-secured-player';
      if (player?.isYou) item.classList.add('is-you');

      const number = document.createElement('b');
      number.textContent = String(index + 1).padStart(2, '0');

      const name = document.createElement('span');
      name.textContent = String(player?.playerName || 'REAL PLAY PLAYER');
      name.title = name.textContent;

      item.append(number, name);

      if (player?.isYou) {
        const you = document.createElement('em');
        you.textContent = 'YOU';
        item.appendChild(you);
      }

      list.appendChild(item);
    });
  }

  async function refreshRoster() {
    if (loading || !view.classList.contains('open')) return;
    const auth = token();
    if (!auth) return;

    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/session-roster`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      renderRoster(data || {});
    } catch (_error) {
      // Keep the core reservation controls usable even if the optional roster read fails.
    } finally {
      loading = false;
    }
  }

  const viewObserver = new MutationObserver(() => {
    ensureRoster();
    if (view.classList.contains('open')) refreshRoster();
  });
  viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('realplay:ranking-session-changed', () => {
    window.setTimeout(refreshRoster, 80);
  });
  window.addEventListener('focus', refreshRoster);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshRoster();
  });

  ensureRoster();
  pollTimer = window.setInterval(refreshRoster, POLL_MS);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
})();
