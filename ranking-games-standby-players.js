(() => {
  if (window.__realPlayRankingStandbyPlayersInstalled) return;
  window.__realPlayRankingStandbyPlayersInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const POLL_MS = 4500;
  const view = document.querySelector('[data-rp-ranking-games]');
  if (!view) return;

  let loading = false;
  let cancelling = false;
  let pollTimer = 0;

  const style = document.createElement('style');
  style.dataset.rpRankingStandbyPlayers = 'true';
  style.textContent = `
    .rp-ranking-standby-roster{
      margin-top:12px;
      padding-top:13px;
      border-top:1px solid rgba(186,166,119,.13);
    }
    .rp-ranking-standby-roster[hidden]{display:none!important}
    .rp-ranking-standby-roster .rp-ranking-secured-head strong{color:#c8ae76!important}
    .rp-ranking-standby-player{
      border-color:rgba(190,166,106,.17)!important;
      background:linear-gradient(105deg,rgba(22,20,15,.96),rgba(8,12,16,.98) 58%,rgba(21,18,12,.95))!important;
    }
    .rp-ranking-standby-player::before{
      background:linear-gradient(180deg,rgba(213,181,108,.88),rgba(213,181,108,.05))!important;
      opacity:.68!important;
    }
    .rp-ranking-standby-player.is-you{
      border-color:rgba(222,190,116,.34)!important;
      background:linear-gradient(105deg,rgba(32,28,17,.98),rgba(9,15,18,.99) 58%,rgba(28,23,14,.97))!important;
    }
    .rp-ranking-standby-player.is-you::before{
      background:linear-gradient(180deg,rgba(241,205,120,.96),rgba(205,176,109,.08))!important;
    }
    .rp-ranking-standby-access{
      flex:0 0 auto;
      padding:3px 5px;
      border:1px solid rgba(211,181,111,.16);
      border-radius:999px;
      background:rgba(200,171,100,.07);
      color:#cbb27c;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.31rem;
      font-style:normal;
      font-weight:950;
      letter-spacing:.08em;
      line-height:1;
      text-transform:uppercase;
    }
    .rp-ranking-session button.rp-ranking-leave-standby,
    .rp-ranking-session button.rp-ranking-leave-standby:not(:disabled){
      width:100%;
      min-height:36px;
      margin:9px 0 0;
      padding:8px 12px;
      border:1px solid rgba(224,150,118,.18);
      border-radius:11px;
      background:rgba(105,37,28,.08);
      color:#c99c8b;
      box-shadow:none;
      font-family:var(--rp-display,Arial,sans-serif);
      font-size:.48rem;
      font-weight:950;
      letter-spacing:.09em;
      text-transform:uppercase;
      text-shadow:none;
      cursor:pointer;
      transition:border-color .16s ease,background .16s ease,color .16s ease;
    }
    .rp-ranking-session button.rp-ranking-leave-standby:not(:disabled):hover{
      border-color:rgba(235,164,132,.32);
      background:rgba(128,48,37,.13);
      color:#e0b2a1;
      box-shadow:none;
    }
    .rp-ranking-session button.rp-ranking-leave-standby:disabled{
      border-color:rgba(224,150,118,.12);
      background:rgba(105,37,28,.06);
      color:#9a796d;
      box-shadow:none;
      opacity:.55;
      cursor:wait;
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
    window.RealPlayPlayers?.openProfile?.(playerId);
  }

  function ensureRoster() {
    const card = view.querySelector('[data-rp-ranking-session]');
    if (!card) return null;
    let roster = card.querySelector('[data-rp-ranking-standby-roster]');
    if (roster) return roster;

    roster = document.createElement('section');
    roster.className = 'rp-ranking-secured rp-ranking-standby-roster';
    roster.dataset.rpRankingStandbyRoster = 'true';
    roster.hidden = true;
    roster.innerHTML = `
      <div class="rp-ranking-secured-head">
        <span>STANDBY PLAYERS</span>
        <strong data-rp-ranking-standby-count>0 STANDBY</strong>
      </div>
      <div class="rp-ranking-secured-list" data-rp-ranking-standby-list></div>
    `;

    const securedRoster = card.querySelector('[data-rp-ranking-secured]');
    if (securedRoster) securedRoster.insertAdjacentElement('afterend', roster);
    else card.appendChild(roster);
    return roster;
  }

  function syncLeaveButton(standbyPlayers) {
    const card = view.querySelector('[data-rp-ranking-session]');
    const action = card?.querySelector('[data-rp-ranking-session-action]');
    if (!card || !action) return;

    const ownFreeStandby = standbyPlayers.find((player) => player?.isYou && player?.entryType === 'standby');
    let button = card.querySelector('[data-rp-leave-standby]');

    if (!ownFreeStandby) {
      button?.remove();
      if (/^STANDBY\s*·\s*FREE/i.test(String(action.textContent || ''))) {
        action.textContent = 'JOIN RANKING GAME';
        action.disabled = false;
      }
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-ranking-leave-standby';
      button.dataset.rpLeaveStandby = 'true';
      button.textContent = 'LEAVE STANDBY';
      action.insertAdjacentElement('afterend', button);
    }
  }

  function renderPlayer(player) {
    const profileId = finiteNumber(player?.playerId);
    const canOpenProfile = Number.isSafeInteger(profileId) && profileId > 0;
    const item = document.createElement(canOpenProfile ? 'button' : 'div');
    item.className = 'rp-ranking-secured-player rp-ranking-standby-player';
    if (player?.isYou) item.classList.add('is-you');
    if (canOpenProfile) {
      item.type = 'button';
      item.classList.add('is-clickable');
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

    const access = document.createElement('em');
    access.className = 'rp-ranking-standby-access';
    access.textContent = `${String(player?.accessType || 'FREE').toUpperCase()} STANDBY`;
    nameLine.appendChild(access);
    nameCell.append(nameLabel, nameLine);

    const rankCell = document.createElement('div');
    rankCell.className = 'rp-ranking-secured-rank-cell';
    const rankLabel = document.createElement('span');
    rankLabel.className = 'rp-ranking-secured-label';
    rankLabel.textContent = 'RANK';
    const rank = finiteNumber(player?.rank);
    const rankValue = document.createElement('strong');
    rankValue.className = 'rp-ranking-secured-rank';
    if (rank !== null && Number.isSafeInteger(rank) && rank > 0) rankValue.textContent = `#${rank}`;
    else {
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
    return item;
  }

  function render(data = {}) {
    const roster = ensureRoster();
    if (!roster) return;
    const players = Array.isArray(data.standbyPlayers) ? data.standbyPlayers : [];
    const count = Number.isFinite(Number(data.standbyCount)) ? Number(data.standbyCount) : players.length;
    const countNode = roster.querySelector('[data-rp-ranking-standby-count]');
    const list = roster.querySelector('[data-rp-ranking-standby-list]');

    syncLeaveButton(players);
    roster.hidden = players.length === 0;
    if (countNode) countNode.textContent = `${count} STANDBY`;
    if (!list) return;
    list.replaceChildren(...players.map(renderPlayer));
  }

  async function refresh() {
    if (loading || !view.classList.contains('open')) return;
    const auth = token();
    if (!auth) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/session-roster`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      render(await response.json().catch(() => ({})));
    } catch (_error) {
      // Standby roster is an enhancement; keep the core Open Rank screen usable.
    } finally {
      loading = false;
    }
  }

  async function leaveStandby(button) {
    if (cancelling || !token()) return;
    cancelling = true;
    button.disabled = true;
    button.textContent = 'LEAVING STANDBY…';
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/career/access`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || 'Unable to leave standby.');

      button.remove();
      const action = view.querySelector('[data-rp-ranking-session-action]');
      if (action) {
        action.textContent = 'JOIN RANKING GAME';
        action.disabled = false;
      }
      window.dispatchEvent(new CustomEvent('realplay:ranking-entry-updated', { detail: result }));
      window.setTimeout(refresh, 80);
    } catch (error) {
      button.disabled = false;
      button.textContent = error?.message ? 'TRY LEAVE STANDBY AGAIN' : 'LEAVE STANDBY';
    } finally {
      cancelling = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-rp-leave-standby]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    leaveStandby(button);
  });

  const observer = new MutationObserver(() => {
    ensureRoster();
    if (view.classList.contains('open')) refresh();
  });
  observer.observe(view, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(refresh, 80));
  window.addEventListener('realplay:ranking-entry-updated', () => window.setTimeout(refresh, 80));
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  ensureRoster();
  refresh();
  pollTimer = window.setInterval(refresh, POLL_MS);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
})();
