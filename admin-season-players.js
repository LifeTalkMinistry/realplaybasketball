(() => {
  if (window.__realPlayAdminMembershipDirectoryInstalled) return;
  window.__realPlayAdminMembershipDirectoryInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const EXPIRING_SOON_DAYS = 7;

  let players = [];
  let slotCap = 16;
  let activeMembers = 0;
  let availableSlots = 16;
  let loading = false;
  let loaded = false;
  let errorMessage = '';
  let activeFilter = 'all';
  let searchQuery = '';

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

  function membershipOf(player) {
    return player?.membership && typeof player.membership === 'object'
      ? player.membership
      : { status: 'free', active: false, startedAt: null, endsAt: null };
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
    if (membership.active) return isExpiringSoon(player) ? 'expiring' : 'active';
    if (membership.status === 'pending') return 'pending';
    if (membership.status === 'expired') return 'expired';
    if (membership.status === 'suspended') return 'suspended';
    return 'free';
  }

  function statusLabel(status) {
    if (status === 'active') return 'ACTIVE';
    if (status === 'expiring') return 'EXPIRING';
    if (status === 'pending') return 'PENDING';
    if (status === 'expired') return 'EXPIRED';
    if (status === 'suspended') return 'SUSPENDED';
    return 'FREE';
  }

  function memberLabel(player) {
    const status = displayStatus(player);
    if (status === 'active' || status === 'expiring') return 'MONTHLY MEMBER';
    if (status === 'pending') return 'PAYMENT PENDING';
    if (status === 'expired') return 'FORMER MONTHLY MEMBER';
    if (status === 'suspended') return 'MEMBERSHIP SUSPENDED';
    return 'FREE PLAYER';
  }

  function filteredPlayers() {
    const query = searchQuery.trim().toLowerCase();
    return players.filter((player) => {
      const status = displayStatus(player);
      const membership = membershipOf(player);
      const filterMatch = activeFilter === 'all'
        || (activeFilter === 'active' && membership.active)
        || (activeFilter === 'free' && status === 'free')
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

  function counts() {
    return players.reduce((result, player) => {
      const status = displayStatus(player);
      result.all += 1;
      if (membershipOf(player).active) result.active += 1;
      if (status === 'free') result.free += 1;
      if (status === 'expiring') result.expiring += 1;
      if (status === 'expired') result.expired += 1;
      return result;
    }, { all: 0, active: 0, free: 0, expiring: 0, expired: 0 });
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
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-membership-directory-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpMembershipDirectoryStyles = '1';
    style.textContent = `
      .rp-member-directory{display:grid;gap:12px;padding-bottom:24px}
      .rp-member-directory-head{margin:10px 0 0}
      .rp-member-directory-kicker{display:block;color:#43e8ff;font-size:.52rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
      .rp-member-directory-head h1{margin:5px 0 0;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.72rem;font-style:italic;font-weight:950;line-height:.95;text-transform:uppercase}
      .rp-member-directory-head p{margin:8px 0 0;color:#7f91a6;font-size:.7rem;line-height:1.45}
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
      .rp-member-status{align-self:start;padding:6px 8px;border:1px solid rgba(126,173,232,.15);border-radius:999px;background:rgba(255,255,255,.02);color:#8297aa;font-size:.46rem;font-weight:950;letter-spacing:.07em}
      .rp-member-status.active{border-color:rgba(72,234,255,.28);background:rgba(38,211,236,.07);color:#5cecff}
      .rp-member-status.expiring{border-color:rgba(255,197,79,.3);background:rgba(255,197,79,.07);color:#ffd36b}
      .rp-member-status.pending{border-color:rgba(143,175,255,.25);background:rgba(96,126,255,.08);color:#9fb8ff}
      .rp-member-status.expired,.rp-member-status.suspended{border-color:rgba(255,107,132,.22);background:rgba(255,75,106,.06);color:#ff9aad}
      .rp-member-dates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(126,173,232,.09)}
      .rp-member-date{min-width:0}
      .rp-member-date small{display:block;color:#5f7489;font-size:.46rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .rp-member-date strong{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cfe0ee;font-size:.61rem;font-weight:850}
      .rp-member-empty{padding:26px 16px;border:1px dashed rgba(126,173,232,.16);border-radius:16px;color:#71879b;text-align:center;font-size:.66rem;line-height:1.45}
      .rp-member-empty strong{display:block;margin-bottom:5px;color:#dceaf5;font-family:var(--rp-display,Arial,sans-serif);font-size:.85rem;font-style:italic}
      .rp-member-loading{padding:28px 16px;border:1px solid rgba(126,173,232,.1);border-radius:16px;background:#050c15;color:#7790a6;text-align:center;font-size:.65rem;font-weight:800;letter-spacing:.07em}
      .rp-member-refresh{width:100%;min-height:42px;border:1px solid rgba(67,232,255,.22);border-radius:11px;background:#071723;color:#69eaff;font:900 .57rem var(--rp-display,Arial,sans-serif);letter-spacing:.08em}
      .rp-member-error{padding:11px 13px;border:1px solid rgba(255,80,107,.22);border-radius:12px;background:rgba(255,56,92,.07);color:#ff9bac;font-size:.65rem;line-height:1.4}
      @media(min-width:620px){.rp-member-list{grid-template-columns:1fr 1fr}.rp-member-tools{grid-template-columns:minmax(220px,1fr) auto;align-items:center}.rp-member-filters{justify-content:flex-end}}
    `;
    document.head.appendChild(style);
  }

  function playerMarkup(player) {
    const membership = membershipOf(player);
    const status = displayStatus(player);
    const number = player.playerNumber === null || player.playerNumber === undefined
      ? '--'
      : player.playerNumber;
    return `
      <article class="rp-member-row" data-member-player="${Number(player.userId)}">
        <div class="rp-member-row-top">
          <div class="rp-member-number">${esc(number)}</div>
          <div class="rp-member-identity">
            <strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong>
            <small>${esc(memberLabel(player))}</small>
          </div>
          <span class="rp-member-status ${esc(status)}">${esc(statusLabel(status))}</span>
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
    const slotText = full
      ? 'MONTHLY GROUP FULL'
      : `${availableSlots} SLOT${availableSlots === 1 ? '' : 'S'} OPEN`;

    const listMarkup = visible.length
      ? visible.map(playerMarkup).join('')
      : `<div class="rp-member-empty"><strong>NO PLAYERS FOUND</strong>Try another filter or player search.</div>`;

    return `
      <section class="rp-member-directory" data-rp-member-directory>
        <header class="rp-member-directory-head">
          <span class="rp-member-directory-kicker">MEMBERSHIP DIRECTORY</span>
          <h1>PLAYERS</h1>
          <p>Track who has a protected monthly membership and exactly when each membership starts and ends.</p>
        </header>

        <div class="rp-member-summary${full ? ' full' : ''}">
          <div>
            <small>Protected monthly rotation</small>
            <strong>${full ? 'MEMBERSHIP FULL' : 'MONTHLY MEMBERS'}</strong>
          </div>
          <div class="rp-member-summary-count">
            <b>${activeMembers} / ${slotCap}</b>
            <span>${esc(slotText)}</span>
          </div>
        </div>

        <div class="rp-member-tools">
          <input class="rp-member-search" data-member-search type="search" autocomplete="off" placeholder="Search player or jersey #" value="${esc(searchQuery)}" aria-label="Search players">
          <div class="rp-member-filters" aria-label="Membership filters">
            <button type="button" class="rp-member-filter${activeFilter === 'all' ? ' active' : ''}" data-member-filter="all">ALL · ${c.all}</button>
            <button type="button" class="rp-member-filter${activeFilter === 'active' ? ' active' : ''}" data-member-filter="active">ACTIVE · ${c.active}</button>
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

  function render({ preserveSearchFocus = false } = {}) {
    if (!isPlayersTab()) return;
    ensureStyles();
    const adminBody = body();
    if (!adminBody) return;

    const hadFocus = preserveSearchFocus && document.activeElement?.matches?.('[data-member-search]');
    const selection = hadFocus ? document.activeElement.selectionStart : null;

    if (!loaded && loading) {
      adminBody.innerHTML = `
        <section class="rp-member-directory" data-rp-member-directory>
          <header class="rp-member-directory-head"><span class="rp-member-directory-kicker">MEMBERSHIP DIRECTORY</span><h1>PLAYERS</h1></header>
          <div class="rp-member-loading">LOADING PLAYER MEMBERSHIPS…</div>
        </section>`;
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
      const data = await api('/api/real-play/admin/player', {
        method: 'POST',
        body: { action: 'membership_directory' },
      });
      players = Array.isArray(data?.players) ? data.players : [];
      slotCap = Number.isFinite(Number(data?.membershipSlotCap)) ? Number(data.membershipSlotCap) : 16;
      activeMembers = Number.isFinite(Number(data?.activeMembers))
        ? Number(data.activeMembers)
        : players.filter((player) => membershipOf(player).active).length;
      availableSlots = Number.isFinite(Number(data?.availableMembershipSlots))
        ? Number(data.availableMembershipSlots)
        : Math.max(0, slotCap - activeMembers);
      loaded = true;
      errorMessage = '';
    } catch (error) {
      loaded = true;
      errorMessage = error.message || 'Unable to load the membership directory.';
    } finally {
      loading = false;
      render();
    }
  }

  document.addEventListener('click', (event) => {
    if (!isPlayersTab()) return;

    const filter = event.target.closest?.('[data-member-filter]');
    if (filter) {
      activeFilter = String(filter.dataset.memberFilter || 'all');
      render();
      return;
    }

    const refreshButton = event.target.closest?.('[data-member-refresh]');
    if (refreshButton) {
      refresh();
    }
  });

  document.addEventListener('input', (event) => {
    if (!isPlayersTab() || !event.target.matches?.('[data-member-search]')) return;
    searchQuery = event.target.value || '';
    render({ preserveSearchFocus: true });
  });

  window.addEventListener('realplay:admin-render', () => {
    if (!isPlayersTab()) return;
    window.requestAnimationFrame(() => {
      render();
      if (!loaded && !loading) refresh();
    });
  });

  window.addEventListener('focus', () => {
    if (isPlayersTab() && loaded) refresh({ quiet: true });
  });

  window.setInterval(() => {
    if (isPlayersTab() && loaded) refresh({ quiet: true });
  }, 30000);
})();
