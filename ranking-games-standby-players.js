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
  let lastRosterData = null;
  let summaryNode = null;
  let summaryObserver = null;
  let summarySyncQueued = false;

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

    .rp-ranking-overflow-roster{
      margin-top:14px;
      padding-top:14px;
      border-top:1px solid rgba(188,94,108,.18);
    }
    .rp-ranking-overflow-roster[hidden]{display:none!important}
    .rp-ranking-overflow-roster .rp-ranking-secured-head{margin-bottom:5px}
    .rp-ranking-overflow-roster .rp-ranking-secured-head span{color:#8f6670!important}
    .rp-ranking-overflow-roster .rp-ranking-secured-head strong{color:#d27b89!important}
    .rp-ranking-overflow-note{
      margin:0 0 10px;
      color:#765f67;
      font-family:var(--rp-body,Arial,sans-serif);
      font-size:.43rem;
      font-weight:850;
      letter-spacing:.065em;
      line-height:1.35;
      text-transform:uppercase;
    }
    .rp-ranking-overflow-player{
      border-color:rgba(177,83,98,.17)!important;
      background:linear-gradient(105deg,rgba(24,14,18,.96),rgba(8,11,16,.98) 58%,rgba(23,13,17,.95))!important;
    }
    .rp-ranking-overflow-player::before{
      background:linear-gradient(180deg,rgba(201,91,107,.86),rgba(201,91,107,.04))!important;
      opacity:.68!important;
    }
    .rp-ranking-overflow-player.is-you{
      border-color:rgba(211,105,120,.30)!important;
      background:linear-gradient(105deg,rgba(31,16,21,.98),rgba(9,13,18,.99) 58%,rgba(28,15,19,.97))!important;
    }
    .rp-ranking-overflow-player .rp-ranking-standby-access{
      border-color:rgba(192,97,111,.17);
      background:rgba(151,55,71,.08);
      color:#ba7a85;
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

  function positiveInt(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function countValue(value) {
    const parsed = finiteNumber(value);
    return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
  }

  function pad(value) {
    return String(countValue(value)).padStart(2, '0');
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

  function ensureOverflowRoster() {
    const card = view.querySelector('[data-rp-ranking-session]');
    if (!card) return null;
    let roster = card.querySelector('[data-rp-ranking-overflow-roster]');
    if (roster) return roster;

    roster = document.createElement('section');
    roster.className = 'rp-ranking-secured rp-ranking-overflow-roster';
    roster.dataset.rpRankingOverflowRoster = 'true';
    roster.hidden = true;
    roster.innerHTML = `
      <div class="rp-ranking-secured-head">
        <span>OVERFLOW</span>
        <strong data-rp-ranking-overflow-count>0 OVERFLOW</strong>
      </div>
      <p class="rp-ranking-overflow-note">Waiting after the 16 session spots are filled</p>
      <div class="rp-ranking-secured-list" data-rp-ranking-overflow-list></div>
    `;

    const standbyRoster = ensureRoster();
    if (standbyRoster) standbyRoster.insertAdjacentElement('afterend', roster);
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

  function decorateAdminRemovalTarget(item, player, group) {
    if (!item || !player) return;
    const playerId = positiveInt(player?.playerId);
    const accountUserId = positiveInt(player?.accountUserId ?? player?.profileUserId);
    if (!playerId && !accountUserId) return;
    item.dataset.rpSessionAdminTarget = 'true';
    item.dataset.rpSessionPlayerId = playerId ? String(playerId) : '';
    item.dataset.rpSessionAccountUserId = accountUserId ? String(accountUserId) : '';
    item.dataset.rpSessionPlayerName = String(player?.playerName || 'REAL PLAY PLAYER');
    item.dataset.rpSessionEntryGroup = group;
  }

  function renderPlayer(player, overflow = false) {
    const profileId = finiteNumber(player?.playerId);
    const canOpenProfile = Number.isSafeInteger(profileId) && profileId > 0;
    const item = document.createElement(canOpenProfile ? 'button' : 'div');
    item.className = 'rp-ranking-secured-player rp-ranking-standby-player';
    if (overflow) item.classList.add('rp-ranking-overflow-player');
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
    decorateAdminRemovalTarget(item, player, 'standby');
    return item;
  }

  function splitStandby(data = {}) {
    const players = Array.isArray(data.standbyPlayers) ? data.standbyPlayers : [];
    const capacityNumber = finiteNumber(data.capacity);
    const capacity = capacityNumber !== null && capacityNumber > 0 ? Math.trunc(capacityNumber) : null;
    const confirmed = countValue(data.confirmedCount ?? data.players?.length);
    const normalLimit = capacity === null
      ? players.length
      : Math.max(0, capacity - confirmed);

    return {
      players,
      capacity,
      confirmed,
      normalPlayers: players.slice(0, normalLimit),
      overflowPlayers: players.slice(normalLimit),
    };
  }

  function syncSummary(data = lastRosterData) {
    summarySyncQueued = false;
    if (!data) return;
    const summary = view.querySelector('[data-rp-ranking-access-summary]');
    if (!summary) return;

    const split = splitStandby(data);
    const standbyNode = summary.querySelector('[data-rp-ranking-access-standby]');
    const totalNode = summary.querySelector('[data-rp-ranking-access-total]');
    const normalCount = split.normalPlayers.length;
    const totalStandby = split.players.length;
    const filled = split.capacity === null
      ? split.confirmed + totalStandby
      : Math.min(split.capacity, split.confirmed + totalStandby);

    const nextStandby = String(normalCount);
    if (standbyNode && standbyNode.textContent !== nextStandby) standbyNode.textContent = nextStandby;

    const nextTotal = split.capacity === null
      ? `${pad(filled)} SECURED`
      : `${pad(filled)}/${pad(split.capacity)} SECURED`;
    if (totalNode && totalNode.textContent !== nextTotal) totalNode.textContent = nextTotal;

    summary.dataset.rpOverflowCount = String(split.overflowPlayers.length);
  }

  function queueSummarySync() {
    if (summarySyncQueued) return;
    summarySyncQueued = true;
    window.queueMicrotask(syncSummary);
  }

  function ensureSummaryObserver() {
    const next = view.querySelector('[data-rp-ranking-access-summary]');
    if (!next || next === summaryNode) return;
    summaryObserver?.disconnect();
    summaryNode = next;
    summaryObserver = new MutationObserver(queueSummarySync);
    summaryObserver.observe(summaryNode, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    queueSummarySync();
  }

  function render(data = {}) {
    lastRosterData = data;
    const roster = ensureRoster();
    const overflowRoster = ensureOverflowRoster();
    if (!roster || !overflowRoster) return;

    const split = splitStandby(data);
    const countNode = roster.querySelector('[data-rp-ranking-standby-count]');
    const list = roster.querySelector('[data-rp-ranking-standby-list]');
    const overflowCountNode = overflowRoster.querySelector('[data-rp-ranking-overflow-count]');
    const overflowList = overflowRoster.querySelector('[data-rp-ranking-overflow-list]');

    syncLeaveButton(split.players);

    roster.hidden = split.normalPlayers.length === 0;
    overflowRoster.hidden = split.overflowPlayers.length === 0;

    if (countNode) countNode.textContent = `${split.normalPlayers.length} STANDBY`;
    if (overflowCountNode) overflowCountNode.textContent = `${split.overflowPlayers.length} OVERFLOW`;
    if (list) list.replaceChildren(...split.normalPlayers.map((player) => renderPlayer(player, false)));
    if (overflowList) overflowList.replaceChildren(...split.overflowPlayers.map((player) => renderPlayer(player, true)));

    ensureSummaryObserver();
    syncSummary(data);
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
      // Standby and overflow rosters are enhancements; keep core reservation controls usable.
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
    ensureOverflowRoster();
    ensureSummaryObserver();
    if (lastRosterData) queueSummarySync();
    if (view.classList.contains('open')) refresh();
  });
  observer.observe(view, { attributes: true, attributeFilter: ['class'] });

  const summaryMountObserver = new MutationObserver(() => {
    ensureSummaryObserver();
    if (lastRosterData) queueSummarySync();
  });
  summaryMountObserver.observe(view, { childList: true, subtree: true });

  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(refresh, 80));
  window.addEventListener('realplay:ranking-entry-updated', () => window.setTimeout(refresh, 80));
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  ensureRoster();
  ensureOverflowRoster();
  ensureSummaryObserver();
  refresh();
  pollTimer = window.setInterval(refresh, POLL_MS);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) window.clearInterval(pollTimer);
    summaryObserver?.disconnect();
    summaryMountObserver.disconnect();
  });
})();