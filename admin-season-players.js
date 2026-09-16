(() => {
  if (window.__realPlayAdminMembershipDirectoryInstalled) return;
  window.__realPlayAdminMembershipDirectoryInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SLOT_CAP = 16;
  const EXPIRING_SOON_DAYS = 7;

  let players = [];
  let slotCap = SLOT_CAP;
  let activeMembers = 0;
  let availableSlots = SLOT_CAP;
  let loading = false;
  let loaded = false;
  let errorMessage = '';
  let activeFilter = 'all';
  let searchQuery = '';
  let editorPlayer = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function body() {
    return root()?.querySelector('[data-admin-body]') || null;
  }

  function isPlayersTab() {
    return Boolean(
      root()?.classList.contains('open') &&
      root()?.querySelector('.rp-admin-tab.active')?.dataset.adminTab === 'players'
    );
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function canonicalPlayerId(player) {
    const id = Number(player?.playerId ?? player?.userId ?? player?.manualPlayerId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function accessTypeOf(player) {
    const raw = String(
      player?.access?.type ??
      player?.membership?.accessType ??
      player?.membership?.access_type ??
      ''
    ).trim().toLowerCase();
    if (['monthly', 'pay_to_play', 'standby', 'free'].includes(raw)) return raw;

    const status = String(player?.membership?.status || 'free').toLowerCase();
    if (['active', 'pending', 'expired', 'suspended'].includes(status)) return 'monthly';
    return 'free';
  }

  function membershipOf(player) {
    const raw = player?.membership && typeof player.membership === 'object'
      ? player.membership
      : {};
    const status = String(raw.status || 'free').toLowerCase();
    const accessType = accessTypeOf(player);
    const endsAt = raw.endsAt || raw.validUntil || raw.valid_until || player?.access?.endsAt || null;
    const startedAt = raw.startedAt || raw.validFrom || raw.valid_from || player?.access?.startedAt || null;
    const end = endsAt ? new Date(endsAt) : null;
    const expiredByDate = end && !Number.isNaN(end.getTime()) && end.getTime() <= Date.now();
    const active = accessType === 'monthly'
      && Boolean(raw.active ?? status === 'active')
      && !expiredByDate;

    return {
      status: expiredByDate && accessType === 'monthly' ? 'expired' : status,
      accessType,
      active,
      amountPhp: raw.amountPhp ?? raw.amount_php ?? player?.access?.amountPhp ?? null,
      startedAt,
      endsAt,
    };
  }

  function normalizePlayer(player) {
    return {
      ...player,
      membership: membershipOf(player),
    };
  }

  function dateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = dateValue(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date).toUpperCase();
  }

  function inputDate(value) {
    const date = dateValue(value);
    if (!date) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type) => parts.find((entry) => entry.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function todayInput() {
    return inputDate(new Date());
  }

  function oneMonthAfter(dateString) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))
      ? new Date(`${dateString}T12:00:00+08:00`)
      : new Date();
    const next = new Date(base.getTime());
    next.setMonth(next.getMonth() + 1);
    return inputDate(next);
  }

  function isExpiringSoon(player) {
    const membership = membershipOf(player);
    if (!membership.active) return false;
    const end = dateValue(membership.endsAt);
    if (!end) return false;
    const remaining = end.getTime() - Date.now();
    return remaining >= 0 && remaining <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  }

  function displayStatus(player) {
    const membership = membershipOf(player);
    if (membership.accessType === 'pay_to_play') return 'pay_to_play';
    if (membership.accessType === 'standby') return 'standby';
    if (membership.accessType === 'free') return 'free';
    if (membership.active) return isExpiringSoon(player) ? 'expiring' : 'active';
    if (membership.status === 'pending') return 'pending';
    if (membership.status === 'expired') return 'expired';
    if (membership.status === 'suspended') return 'suspended';
    return 'free';
  }

  function statusLabel(status) {
    if (status === 'active') return 'MEMBER';
    if (status === 'expiring') return 'EXPIRING';
    if (status === 'pay_to_play') return 'PAY TO PLAY';
    if (status === 'standby') return 'STANDBY';
    if (status === 'pending') return 'PENDING';
    if (status === 'expired') return 'EXPIRED';
    if (status === 'suspended') return 'SUSPENDED';
    return 'FREE';
  }

  function memberLabel(player) {
    const status = displayStatus(player);
    if (status === 'active' || status === 'expiring') return 'MONTHLY MEMBER';
    if (status === 'pay_to_play') return 'PAY TO PLAY';
    if (status === 'standby') return 'STANDBY PLAYER';
    if (status === 'pending') return 'PAYMENT PENDING';
    if (status === 'expired') return 'FORMER MONTHLY MEMBER';
    if (status === 'suspended') return 'MEMBERSHIP SUSPENDED';
    return 'FREE PLAYER';
  }

  function counts() {
    return players.reduce((result, player) => {
      const status = displayStatus(player);
      result.all += 1;
      if (membershipOf(player).active) result.active += 1;
      if (status === 'free') result.free += 1;
      if (status === 'pay_to_play') result.payToPlay += 1;
      if (status === 'standby') result.standby += 1;
      if (status === 'expiring') result.expiring += 1;
      if (status === 'expired') result.expired += 1;
      return result;
    }, { all: 0, active: 0, free: 0, payToPlay: 0, standby: 0, expiring: 0, expired: 0 });
  }

  function filteredPlayers() {
    const query = searchQuery.trim().toLowerCase();
    return players.filter((player) => {
      const membership = membershipOf(player);
      const status = displayStatus(player);
      const filterMatch = activeFilter === 'all'
        || (activeFilter === 'active' && membership.active)
        || (activeFilter === 'free' && status === 'free')
        || (activeFilter === 'pay_to_play' && status === 'pay_to_play')
        || (activeFilter === 'standby' && status === 'standby')
        || (activeFilter === 'expiring' && status === 'expiring')
        || (activeFilter === 'expired' && status === 'expired');
      if (!filterMatch) return false;
      if (!query) return true;
      const number = player.playerNumber === null || player.playerNumber === undefined
        ? ''
        : String(player.playerNumber);
      return String(player.playerName || '').toLowerCase().includes(query)
        || number.includes(query)
        || `#${number}`.includes(query);
    });
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || '';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadDirectoryData() {
    try {
      return await api('/api/real-play/admin/player', {
        method: 'POST',
        body: { action: 'membership_directory' },
      });
    } catch (error) {
      const unknownAction = error?.code === 'UNKNOWN_PLAYER_ADMIN_ACTION'
        || /unknown player admin action/i.test(String(error?.message || ''));
      if (!unknownAction) throw error;

      const fallback = await api('/api/real-play/admin/player', {
        method: 'POST',
        body: { action: 'list' },
      });
      return {
        ...fallback,
        membershipSlotCap: SLOT_CAP,
        activeMembers: 0,
        availableMembershipSlots: SLOT_CAP,
        players: (Array.isArray(fallback?.players) ? fallback.players : []).map((player) => ({
          ...player,
          access: { type: 'free', amountPhp: null, startedAt: null, endsAt: null },
          membership: {
            status: 'free',
            accessType: 'free',
            active: false,
            amountPhp: null,
            startedAt: null,
            endsAt: null,
          },
        })),
      };
    }
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-membership-directory-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpMembershipDirectoryStyles = '1';
    style.textContent = `
      .rp-member-directory{display:grid;gap:12px;padding:10px 0 24px}
      .rp-member-summary{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;padding:15px 16px;border:1px solid rgba(67,232,255,.22);border-radius:17px;background:linear-gradient(145deg,rgba(5,23,36,.98),rgba(2,9,16,.98))}
      .rp-member-summary small{display:block;color:#6f8ca3;font-size:.5rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
      .rp-member-summary strong{display:block;margin-top:4px;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.25rem;font-style:italic;font-weight:950}
      .rp-member-summary-count{text-align:right}
      .rp-member-summary-count b{display:block;color:#5cecff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.55rem;font-style:italic;line-height:.9}
      .rp-member-summary-count span{display:block;margin-top:5px;color:#7692aa;font-size:.48rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      .rp-member-summary.full{border-color:rgba(255,108,132,.28)}
      .rp-member-summary.full .rp-member-summary-count b{color:#ff8398}
      .rp-member-tools{display:grid;gap:9px}
      .rp-member-search{width:100%;min-height:45px;box-sizing:border-box;padding:0 13px;border:1px solid rgba(126,173,232,.16);border-radius:12px;outline:0;color:#fff;background:#050d17;font:700 .75rem var(--rp-body,Arial,sans-serif)}
      .rp-member-search:focus{border-color:rgba(67,232,255,.45);box-shadow:0 0 0 3px rgba(67,232,255,.05)}
      .rp-member-filters{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
      .rp-member-filters::-webkit-scrollbar{display:none}
      .rp-member-filter{flex:0 0 auto;min-height:34px;padding:0 10px;border:1px solid rgba(126,173,232,.13);border-radius:999px;background:#07111d;color:#71869c;font:900 .51rem var(--rp-display,Arial,sans-serif);letter-spacing:.06em;white-space:nowrap}
      .rp-member-filter.active{border-color:rgba(67,232,255,.38);background:rgba(23,117,155,.16);color:#64eaff}
      .rp-member-list{display:grid;gap:8px}
      .rp-member-row{padding:13px;border:1px solid rgba(126,173,232,.12);border-radius:15px;background:#07111d}
      .rp-member-row-top{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px}
      .rp-member-number{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#10243c;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:.9rem;font-weight:950}
      .rp-member-identity{min-width:0}
      .rp-member-identity strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:.88rem;font-weight:950}
      .rp-member-identity small{display:block;margin-top:4px;color:#6e849a;font-size:.5rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
      .rp-member-status-controls{display:flex;align-items:flex-start;gap:6px}
      .rp-member-status{align-self:start;padding:6px 8px;border:1px solid rgba(126,173,232,.15);border-radius:999px;background:rgba(255,255,255,.02);color:#8297aa;font-size:.46rem;font-weight:950;letter-spacing:.07em;white-space:nowrap}
      .rp-member-status.active{border-color:rgba(72,234,255,.28);background:rgba(38,211,236,.07);color:#5cecff}
      .rp-member-status.expiring{border-color:rgba(255,197,79,.3);background:rgba(255,197,79,.07);color:#ffd36b}
      .rp-member-status.pay_to_play{border-color:rgba(133,170,255,.28);background:rgba(91,124,255,.08);color:#a8bdff}
      .rp-member-status.standby{border-color:rgba(190,154,255,.28);background:rgba(145,94,255,.08);color:#ccb6ff}
      .rp-member-status.pending{border-color:rgba(143,175,255,.25);background:rgba(96,126,255,.08);color:#9fb8ff}
      .rp-member-status.expired,.rp-member-status.suspended{border-color:rgba(255,107,132,.22);background:rgba(255,75,106,.06);color:#ff9aad}
      .rp-member-edit{width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid rgba(67,232,255,.2);border-radius:9px;background:#081724;color:#70eaff;cursor:pointer}
      .rp-member-edit:hover,.rp-member-edit:focus-visible{border-color:rgba(67,232,255,.48);background:rgba(26,154,190,.12);outline:0}
      .rp-member-edit svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .rp-member-dates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(126,173,232,.09)}
      .rp-member-date small{display:block;color:#5f7489;font-size:.46rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .rp-member-date strong{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cfe0ee;font-size:.61rem;font-weight:850}
      .rp-member-empty{padding:26px 16px;border:1px dashed rgba(126,173,232,.16);border-radius:16px;color:#71879b;text-align:center;font-size:.66rem;line-height:1.45}
      .rp-member-empty strong{display:block;margin-bottom:5px;color:#dceaf5;font-family:var(--rp-display,Arial,sans-serif);font-size:.85rem;font-style:italic}
      .rp-member-loading{padding:28px 16px;border:1px solid rgba(126,173,232,.1);border-radius:16px;background:#050c15;color:#7790a6;text-align:center;font-size:.65rem;font-weight:800;letter-spacing:.07em}
      .rp-member-refresh{width:100%;min-height:42px;border:1px solid rgba(67,232,255,.22);border-radius:11px;background:#071723;color:#69eaff;font:900 .57rem var(--rp-display,Arial,sans-serif);letter-spacing:.08em}
      .rp-member-error{padding:11px 13px;border:1px solid rgba(255,80,107,.22);border-radius:12px;background:rgba(255,56,92,.07);color:#ff9bac;font-size:.65rem;line-height:1.4}
      .rp-member-editor-backdrop{position:fixed;inset:0;z-index:100000;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(0,4,10,.78);backdrop-filter:blur(8px)}
      .rp-member-editor-backdrop.open{display:flex}
      .rp-member-editor{width:min(440px,100%);box-sizing:border-box;padding:18px;border:1px solid rgba(67,232,255,.24);border-radius:20px;background:linear-gradient(160deg,#07131f,#02070d);box-shadow:0 22px 70px rgba(0,0,0,.55)}
      .rp-member-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .rp-member-editor-head small{display:block;color:#53dff4;font-size:.52rem;font-weight:950;letter-spacing:.1em}
      .rp-member-editor-head h3{margin:4px 0 0;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.25rem;font-style:italic}
      .rp-member-editor-close{width:34px;height:34px;border:1px solid rgba(126,173,232,.18);border-radius:10px;background:#07111d;color:#9eb1c1;font-size:1.1rem}
      .rp-member-editor-fields{display:grid;gap:12px;margin-top:18px}
      .rp-member-editor-field{display:grid;gap:6px}
      .rp-member-editor-field>span{color:#6f879d;font-size:.52rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .rp-member-editor-field select,.rp-member-editor-field input{width:100%;min-height:45px;box-sizing:border-box;padding:0 12px;border:1px solid rgba(126,173,232,.18);border-radius:11px;outline:0;background:#050d17;color:#fff;font:800 .72rem var(--rp-body,Arial,sans-serif)}
      .rp-member-editor-field select:focus,.rp-member-editor-field input:focus{border-color:rgba(67,232,255,.5)}
      .rp-member-editor-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .rp-member-editor-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:16px}
      .rp-member-editor-actions button{min-height:43px;border-radius:11px;font:900 .62rem var(--rp-display,Arial,sans-serif);letter-spacing:.06em}
      .rp-member-editor-cancel{border:1px solid rgba(126,173,232,.16);background:#07111d;color:#91a5b6}
      .rp-member-editor-save{border:1px solid rgba(67,232,255,.35);background:#082230;color:#67eaff}
      .rp-member-editor-message{min-height:18px;margin:10px 0 0;color:#ff9aac;font-size:.62rem;line-height:1.4}
      .rp-member-editor-note{margin:0;color:#73889a;font-size:.59rem;line-height:1.45}
      @media(min-width:620px){.rp-member-list{grid-template-columns:1fr 1fr}.rp-member-tools{grid-template-columns:minmax(220px,1fr) auto;align-items:center}.rp-member-filters{justify-content:flex-end}.rp-member-editor-backdrop{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function playerMarkup(player) {
    const membership = membershipOf(player);
    const status = displayStatus(player);
    const number = player.playerNumber === null || player.playerNumber === undefined ? '--' : player.playerNumber;
    const playerId = canonicalPlayerId(player);
    return `
      <article class="rp-member-row" data-member-player="${playerId || ''}">
        <div class="rp-member-row-top">
          <div class="rp-member-number">${esc(number)}</div>
          <div class="rp-member-identity">
            <strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong>
            <small>${esc(memberLabel(player))}</small>
          </div>
          <div class="rp-member-status-controls">
            <span class="rp-member-status ${esc(status)}">${esc(statusLabel(status))}</span>
            <button class="rp-member-edit" type="button" data-member-edit="${playerId || ''}" aria-label="Edit ${esc(player.playerName || 'player')} access" title="Edit player access">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
            </button>
          </div>
        </div>
        <div class="rp-member-dates">
          <div class="rp-member-date"><small>Started</small><strong>${esc(formatDate(membership.startedAt))}</strong></div>
          <div class="rp-member-date"><small>Ends</small><strong>${esc(formatDate(membership.endsAt))}</strong></div>
        </div>
      </article>`;
  }

  function directoryMarkup() {
    const c = counts();
    const visible = filteredPlayers();
    const full = activeMembers >= slotCap;
    const slotText = full ? 'MONTHLY GROUP FULL' : `${availableSlots} SLOT${availableSlots === 1 ? '' : 'S'} OPEN`;
    const listMarkup = visible.length
      ? visible.map(playerMarkup).join('')
      : `<div class="rp-member-empty"><strong>NO PLAYERS FOUND</strong>Try another filter or player search.</div>`;

    return `
      <section class="rp-member-directory" data-rp-member-directory>
        <div class="rp-member-summary${full ? ' full' : ''}">
          <div><small>Protected monthly rotation</small><strong>${full ? 'MEMBERSHIP FULL' : 'MONTHLY MEMBERS'}</strong></div>
          <div class="rp-member-summary-count"><b>${activeMembers} / ${slotCap}</b><span>${esc(slotText)}</span></div>
        </div>
        <div class="rp-member-tools">
          <input class="rp-member-search" data-member-search type="search" autocomplete="off" placeholder="Search player or jersey #" value="${esc(searchQuery)}" aria-label="Search players">
          <div class="rp-member-filters" aria-label="Membership filters">
            <button type="button" class="rp-member-filter${activeFilter === 'all' ? ' active' : ''}" data-member-filter="all">ALL · ${c.all}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'active' ? ' active' : ''}" data-member-filter="active">MEMBER · ${c.active}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'pay_to_play' ? ' active' : ''}" data-member-filter="pay_to_play">PAY TO PLAY · ${c.payToPlay}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'standby' ? ' active' : ''}" data-member-filter="standby">STANDBY · ${c.standby}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'free' ? ' active' : ''}" data-member-filter="free">FREE · ${c.free}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'expiring' ? ' active' : ''}" data-member-filter="expiring">EXPIRING · ${c.expiring}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'expired' ? ' active' : ''}" data-member-filter="expired">EXPIRED · ${c.expired}</button>
          </div>
        </div>
        ${errorMessage ? `<div class="rp-member-error">${esc(errorMessage)}</div>` : ''}
        <div class="rp-member-list" data-member-list>${listMarkup}</div>
        <button type="button" class="rp-member-refresh" data-member-refresh>${loading ? 'REFRESHING…' : 'REFRESH MEMBERSHIP LIST'}</button>
      </section>`;
  }

  function ensureEditor() {
    ensureStyles();
    let backdrop = document.querySelector('[data-member-editor-backdrop]');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'rp-member-editor-backdrop';
    backdrop.dataset.memberEditorBackdrop = '1';
    backdrop.innerHTML = `
      <section class="rp-member-editor" role="dialog" aria-modal="true" aria-labelledby="rp-member-editor-title">
        <div class="rp-member-editor-head">
          <div><small>PLAYER ACCESS</small><h3 id="rp-member-editor-title" data-member-editor-name>PLAYER</h3></div>
          <button class="rp-member-editor-close" type="button" data-member-editor-close aria-label="Close">×</button>
        </div>
        <div class="rp-member-editor-fields">
          <label class="rp-member-editor-field"><span>Access type</span>
            <select data-member-editor-type>
              <option value="monthly">Monthly Member</option>
              <option value="pay_to_play">Pay to Play</option>
              <option value="standby">Standby</option>
              <option value="free">Free</option>
            </select>
          </label>
          <div class="rp-member-editor-dates" data-member-editor-dates>
            <label class="rp-member-editor-field"><span>Started</span><input type="date" data-member-editor-start></label>
            <label class="rp-member-editor-field"><span>Ends</span><input type="date" data-member-editor-end></label>
          </div>
          <label class="rp-member-editor-field" data-member-editor-amount-wrap><span>Amount (PHP)</span><input type="number" min="0" step="1" inputmode="decimal" data-member-editor-amount></label>
          <p class="rp-member-editor-note" data-member-editor-note></p>
        </div>
        <p class="rp-member-editor-message" data-member-editor-message></p>
        <div class="rp-member-editor-actions">
          <button class="rp-member-editor-cancel" type="button" data-member-editor-close>CANCEL</button>
          <button class="rp-member-editor-save" type="button" data-member-editor-save>SAVE ACCESS</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function syncEditorFields() {
    const backdrop = ensureEditor();
    const type = backdrop.querySelector('[data-member-editor-type]')?.value || 'free';
    const dates = backdrop.querySelector('[data-member-editor-dates]');
    const amountWrap = backdrop.querySelector('[data-member-editor-amount-wrap]');
    const amount = backdrop.querySelector('[data-member-editor-amount]');
    const note = backdrop.querySelector('[data-member-editor-note]');
    const monthly = type === 'monthly';
    const payToPlay = type === 'pay_to_play';
    if (dates) dates.hidden = !monthly;
    if (amountWrap) amountWrap.hidden = !(monthly || payToPlay);
    if (amount && !amount.value) amount.value = monthly ? '99' : payToPlay ? '50' : '';
    if (note) {
      note.textContent = monthly
        ? 'Monthly members occupy one of the 16 protected rotation slots.'
        : payToPlay
          ? 'Pay to Play is session access and does not occupy a monthly slot.'
          : type === 'standby'
            ? 'Standby players may play when protected rotation space becomes available.'
            : 'Free players have no protected paid access.';
    }
  }

  function openEditor(player) {
    editorPlayer = player;
    const backdrop = ensureEditor();
    const membership = membershipOf(player);
    const type = membership.accessType || 'free';
    const start = inputDate(membership.startedAt) || todayInput();
    const end = inputDate(membership.endsAt) || oneMonthAfter(start);
    backdrop.querySelector('[data-member-editor-name]').textContent = player.playerName || 'REAL PLAY PLAYER';
    backdrop.querySelector('[data-member-editor-type]').value = type;
    backdrop.querySelector('[data-member-editor-start]').value = start;
    backdrop.querySelector('[data-member-editor-end]').value = end;
    backdrop.querySelector('[data-member-editor-amount]').value = membership.amountPhp ?? (type === 'monthly' ? 99 : type === 'pay_to_play' ? 50 : '');
    backdrop.querySelector('[data-member-editor-message]').textContent = '';
    syncEditorFields();
    backdrop.classList.add('open');
    window.requestAnimationFrame(() => backdrop.querySelector('[data-member-editor-type]')?.focus());
  }

  function closeEditor() {
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    backdrop?.classList.remove('open');
    editorPlayer = null;
  }

  function applyDirectoryData(data) {
    players = (Array.isArray(data?.players) ? data.players : []).map(normalizePlayer);
    slotCap = Number.isFinite(Number(data?.membershipSlotCap)) ? Number(data.membershipSlotCap) : SLOT_CAP;
    activeMembers = players.filter((player) => membershipOf(player).active).length;
    availableSlots = Math.max(0, slotCap - activeMembers);
  }

  async function saveEditor() {
    const player = editorPlayer;
    const playerId = canonicalPlayerId(player);
    const backdrop = ensureEditor();
    if (!player || !playerId) return;

    const saveButton = backdrop.querySelector('[data-member-editor-save]');
    const message = backdrop.querySelector('[data-member-editor-message]');
    const accessType = backdrop.querySelector('[data-member-editor-type]').value;
    const amountRaw = backdrop.querySelector('[data-member-editor-amount]').value;
    const startedAt = backdrop.querySelector('[data-member-editor-start]').value;
    const endsAt = backdrop.querySelector('[data-member-editor-end]').value;

    if (accessType === 'monthly' && (!startedAt || !endsAt)) {
      message.textContent = 'Choose the membership start and end dates.';
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'SAVING…';
    message.textContent = '';
    try {
      const data = await api('/api/real-play/admin/player', {
        method: 'POST',
        body: {
          action: 'membership_access_update',
          playerId,
          accessType,
          amountPhp: amountRaw === '' ? null : Number(amountRaw),
          startedAt: accessType === 'monthly' ? startedAt : null,
          endsAt: accessType === 'monthly' ? endsAt : null,
        },
      });
      applyDirectoryData(data);
      loaded = true;
      errorMessage = '';
      closeEditor();
      render();
    } catch (error) {
      message.textContent = error.message || 'Could not save player access.';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'SAVE ACCESS';
    }
  }

  function render({ preserveSearchFocus = false } = {}) {
    if (!isPlayersTab()) return;
    ensureStyles();
    const adminBody = body();
    if (!adminBody) return;

    const hadFocus = preserveSearchFocus && document.activeElement?.matches?.('[data-member-search]');
    const selection = hadFocus ? document.activeElement.selectionStart : null;

    if (!loaded && loading) {
      adminBody.innerHTML = '<section class="rp-member-directory"><div class="rp-member-loading">LOADING PLAYERS…</div></section>';
      return;
    }

    adminBody.innerHTML = directoryMarkup();
    if (hadFocus) {
      const input = adminBody.querySelector('[data-member-search]');
      input?.focus({ preventScroll: true });
      if (selection !== null && input?.setSelectionRange) input.setSelectionRange(selection, selection);
    }
  }

  async function refresh({ quiet = false } = {}) {
    if (loading || !token() || !isPlayersTab()) return;
    loading = true;
    if (!quiet) errorMessage = '';
    render();

    try {
      const data = await loadDirectoryData();
      applyDirectoryData(data);
      loaded = true;
      errorMessage = '';
    } catch (error) {
      loaded = true;
      errorMessage = error.message || 'Unable to load players.';
    } finally {
      loading = false;
      render();
    }
  }

  document.addEventListener('click', (event) => {
    const close = event.target.closest?.('[data-member-editor-close]');
    if (close) {
      closeEditor();
      return;
    }
    const backdrop = event.target.closest?.('[data-member-editor-backdrop]');
    if (backdrop && event.target === backdrop) {
      closeEditor();
      return;
    }
    if (event.target.closest?.('[data-member-editor-save]')) {
      saveEditor();
      return;
    }

    if (!isPlayersTab()) return;
    const edit = event.target.closest?.('[data-member-edit]');
    if (edit) {
      const playerId = Number(edit.dataset.memberEdit);
      const player = players.find((entry) => canonicalPlayerId(entry) === playerId);
      if (player) openEditor(player);
      return;
    }
    const filter = event.target.closest?.('[data-member-filter]');
    if (filter) {
      activeFilter = String(filter.dataset.memberFilter || 'all');
      render();
      return;
    }
    if (event.target.closest?.('[data-member-refresh]')) refresh();
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches?.('[data-member-editor-type]')) {
      const amount = document.querySelector('[data-member-editor-amount]');
      const type = event.target.value;
      if (amount) amount.value = type === 'monthly' ? '99' : type === 'pay_to_play' ? '50' : '';
      syncEditorFields();
    }
  });

  document.addEventListener('input', (event) => {
    if (!isPlayersTab() || !event.target.matches?.('[data-member-search]')) return;
    searchQuery = event.target.value || '';
    render({ preserveSearchFocus: true });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-member-editor-backdrop].open')) closeEditor();
  });

  window.addEventListener('realplay:admin-render', () => {
    if (!isPlayersTab()) return;
    window.requestAnimationFrame(() => {
      render();
      if (!loaded && !loading) refresh();
    });
  });

  window.addEventListener('focus', () => {
    if (isPlayersTab() && loaded && !document.querySelector('[data-member-editor-backdrop].open')) refresh({ quiet: true });
  });

  window.setInterval(() => {
    if (isPlayersTab() && loaded && !document.querySelector('[data-member-editor-backdrop].open')) refresh({ quiet: true });
  }, 30000);
})();