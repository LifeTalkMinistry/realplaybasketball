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
      margin-bottom:10px;
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
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .rp-ranking-secured-player{
      position:relative;
      width:100%;
      min-width:0;
      display:block;
      overflow:hidden;
      padding:0;
      border:1px solid rgba(93,151,191,.16);
      border-radius:13px;
      box-sizing:border-box;
      background:
        linear-gradient(105deg,rgba(7,20,31,.96),rgba(3,12,20,.96) 58%,rgba(6,21,30,.94));
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.018),
        0 8px 24px rgba(0,0,0,.14);
      color:inherit;
      font:inherit;
      text-align:left;
    }
    .rp-ranking-secured-player::before{
      content:"";
      position:absolute;
      inset:0 auto 0 0;
      width:2px;
      background:linear-gradient(180deg,rgba(70,218,255,.9),rgba(70,218,255,.05));
      opacity:.58;
    }
    .rp-ranking-secured-player.is-clickable{
      cursor:pointer;
      appearance:none;
      -webkit-appearance:none;
      transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease;
    }
    .rp-ranking-secured-player.is-clickable:hover{
      border-color:rgba(80,220,255,.30);
      background:
        linear-gradient(105deg,rgba(8,25,38,.98),rgba(4,15,24,.98) 58%,rgba(7,25,34,.96));
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.025),
        0 10px 28px rgba(0,0,0,.18);
    }
    .rp-ranking-secured-player.is-clickable:active{transform:scale(.995)}
    .rp-ranking-secured-player.is-clickable:focus-visible{
      outline:2px solid rgba(80,220,255,.62);
      outline-offset:2px;
    }
    .rp-ranking-secured-player.is-you{
      border-color:rgba(74,237,191,.24);
      background:
        linear-gradient(105deg,rgba(7,30,30,.96),rgba(3,16,22,.97) 58%,rgba(5,27,30,.94));
    }
    .rp-ranking-secured-player.is-you::before{
      background:linear-gradient(180deg,rgba(89,239,198,.96),rgba(70,218,255,.08));
      opacity:.8;
    }

    .rp-ranking-secured-identity{
      min-width:0;
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:stretch;
      border-bottom:1px solid rgba(108,151,190,.10);
    }
    .rp-ranking-secured-name-cell,
    .rp-ranking-secured-rank-cell{
      min-width:0;
      padding:10px 11px 9px;
    }
    .rp-ranking-secured-name-cell{
      padding-left:13px;
    }
    .rp-ranking-secured-rank-cell{
      min-width:64px;
      border-left:1px solid rgba(108,151,190,.10);
      text-align:center;
    }
    .rp-ranking-secured-label{
      display:block;
      margin-bottom:4px;
      color:#607a91;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.36rem;
      font-weight:950;
      letter-spacing:.13em;
      line-height:1;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-ranking-secured-name-line{
      min-width:0;
      display:flex;
      align-items:center;
      gap:7px;
    }
    .rp-ranking-secured-name{
      min-width:0;
      overflow:hidden;
      color:#eef7ff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.68rem;
      font-weight:950;
      letter-spacing:.035em;
      line-height:1.08;
      text-overflow:ellipsis;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-ranking-secured-you{
      flex:0 0 auto;
      padding:3px 5px;
      border:1px solid rgba(89,239,198,.16);
      border-radius:999px;
      background:rgba(58,218,172,.08);
      color:#72efc4;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.31rem;
      font-style:normal;
      font-weight:950;
      letter-spacing:.09em;
      line-height:1;
      text-transform:uppercase;
    }
    .rp-ranking-secured-rank{
      display:block;
      color:#55ddff;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.72rem;
      font-weight:950;
      letter-spacing:.02em;
      line-height:1;
      white-space:nowrap;
    }
    .rp-ranking-secured-rank.is-unranked{
      color:#8397aa;
      font-size:.45rem;
      letter-spacing:.06em;
    }

    .rp-ranking-secured-performance{
      min-width:0;
      display:grid;
      grid-template-columns:56px 68px 76px minmax(0,1fr);
      align-items:stretch;
    }
    .rp-ranking-secured-stat{
      min-width:0;
      padding:9px 8px 10px;
      border-right:1px solid rgba(108,151,190,.09);
    }
    .rp-ranking-secured-stat:first-child{padding-left:13px}
    .rp-ranking-secured-stat:last-child{
      padding-right:11px;
      border-right:0;
    }
    .rp-ranking-secured-value{
      display:block;
      min-width:0;
      overflow:hidden;
      color:#c8d8e5;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.56rem;
      font-weight:950;
      letter-spacing:.025em;
      line-height:1.1;
      text-overflow:ellipsis;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-ranking-secured-stat.is-ovr .rp-ranking-secured-value{
      color:#f2f8fc;
      font-size:.64rem;
    }
    .rp-ranking-secured-stat.is-winrate .rp-ranking-secured-value{color:#72efc4}
    .rp-ranking-secured-stat.is-top-stats .rp-ranking-secured-value{
      color:#8fdcf3;
      font-size:.49rem;
      letter-spacing:.015em;
    }
    .rp-ranking-secured-empty{
      margin:0;
      padding:10px 2px 2px;
      color:#60758c;
      font-size:.58rem;
      font-weight:700;
      letter-spacing:.04em;
      text-align:center;
      text-transform:uppercase;
    }

    @media(max-width:390px){
      .rp-ranking-secured-performance{
        grid-template-columns:52px 62px 70px minmax(0,1fr);
      }
      .rp-ranking-secured-stat{
        padding-left:6px;
        padding-right:6px;
      }
      .rp-ranking-secured-stat:first-child{padding-left:10px}
      .rp-ranking-secured-stat:last-child{padding-right:8px}
      .rp-ranking-secured-label{font-size:.33rem}
      .rp-ranking-secured-value{font-size:.51rem}
      .rp-ranking-secured-stat.is-top-stats .rp-ranking-secured-value{font-size:.44rem}
    }
  `;
  document.head.appendChild(style);

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function displayNumber(value, digits = 1) {
    const number = finiteNumber(value);
    if (number === null) return '—';
    if (Number.isInteger(number)) return String(number);
    return number.toFixed(digits).replace(/\.0$/, '');
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
    if (winRate === null) return '—';
    return `${displayNumber(winRate)}%`;
  }

  function topStatsLabel(topStats) {
    if (!Array.isArray(topStats) || !topStats.length) return '—';
    const labels = topStats
      .slice(0, 2)
      .map((stat) => {
        if (typeof stat === 'string') return stat.trim().toUpperCase();
        const key = String(stat?.key || stat?.label || '').trim().toUpperCase();
        if (!key) return '';
        const value = finiteNumber(stat?.value);
        return value === null ? key : `${key} ${displayNumber(value)}`;
      })
      .filter(Boolean);
    return labels.length ? labels.join(' · ') : '—';
  }

  function createStatCell(labelText, valueText, className = '') {
    const cell = document.createElement('div');
    cell.className = `rp-ranking-secured-stat${className ? ` ${className}` : ''}`;

    const label = document.createElement('span');
    label.className = 'rp-ranking-secured-label';
    label.textContent = labelText;

    const value = document.createElement('strong');
    value.className = 'rp-ranking-secured-value';
    value.textContent = valueText;
    value.title = valueText;

    cell.append(label, value);
    return cell;
  }

  function openPlayerProfile(player) {
    const playerId = Number(player?.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return;

    if (player?.isYou && window.RealPlayProfile?.open) {
      window.RealPlayProfile.open();
      return;
    }

    if (window.RealPlayPlayers?.openProfile) {
      window.RealPlayPlayers.openProfile(playerId);
    }
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
        <span>TOKEN USERS</span>
        <strong data-rp-ranking-secured-count>0 TOKEN USERS</strong>
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
        ? `${count} / ${capacity} TOKEN USERS`
        : `${count} TOKEN USERS`;
    }
    if (!list) return;

    list.replaceChildren();
    if (!players.length) {
      const empty = document.createElement('p');
      empty.className = 'rp-ranking-secured-empty';
      empty.textContent = 'NO TOKEN USERS YET';
      list.appendChild(empty);
      return;
    }

    players.forEach((player) => {
      const profileId = finiteNumber(player?.playerId);
      const canOpenProfile = Number.isSafeInteger(profileId) && profileId > 0;
      const item = document.createElement(canOpenProfile ? 'button' : 'div');
      item.className = 'rp-ranking-secured-player';
      if (player?.isYou) item.classList.add('is-you');
      if (canOpenProfile) {
        item.type = 'button';
        item.classList.add('is-clickable');
        item.dataset.rpSecuredPlayerId = String(profileId);
        item.setAttribute('aria-label', `Open ${String(player?.playerName || 'Real Play player')} profile`);
        item.addEventListener('click', () => openPlayerProfile(player));
      }

      const identity = document.createElement('div');
      identity.className = 'rp-ranking-secured-identity';

      const nameCell = document.createElement('div');
      nameCell.className = 'rp-ranking-secured-name-cell';

      const nameLabel = document.createElement('span');
      nameLabel.className = 'rp-ranking-secured-label';
      nameLabel.textContent = 'NAME';

      const nameLine = document.createElement('div');
      nameLine.className = 'rp-ranking-secured-name-line';

      const name = document.createElement('strong');
      name.className = 'rp-ranking-secured-name';
      name.textContent = String(player?.playerName || 'REAL PLAY PLAYER');
      name.title = name.textContent;
      nameLine.appendChild(name);

      if (player?.isYou) {
        const you = document.createElement('em');
        you.className = 'rp-ranking-secured-you';
        you.textContent = 'YOU';
        nameLine.appendChild(you);
      }

      nameCell.append(nameLabel, nameLine);

      const rankCell = document.createElement('div');
      rankCell.className = 'rp-ranking-secured-rank-cell';

      const rankLabel = document.createElement('span');
      rankLabel.className = 'rp-ranking-secured-label';
      rankLabel.textContent = 'RANK';

      const rank = finiteNumber(player?.rank);
      const rankValue = document.createElement('strong');
      rankValue.className = 'rp-ranking-secured-rank';
      if (rank !== null && Number.isSafeInteger(rank) && rank > 0) {
        rankValue.textContent = `#${rank}`;
      } else {
        rankValue.textContent = 'UNRANKED';
        rankValue.classList.add('is-unranked');
      }
      rankCell.append(rankLabel, rankValue);
      identity.append(nameCell, rankCell);

      const performance = document.createElement('div');
      performance.className = 'rp-ranking-secured-performance';

      const ovr = finiteNumber(player?.ovr);
      performance.append(
        createStatCell('OVR', ovr === null ? '—' : String(Math.round(ovr)), 'is-ovr'),
        createStatCell('RECORD', recordLabel(player?.record), 'is-record'),
        createStatCell('WINRATE', winRateLabel(player?.winRate), 'is-winrate'),
        createStatCell('TOP STATS', topStatsLabel(player?.topStats), 'is-top-stats')
      );

      item.append(identity, performance);
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
