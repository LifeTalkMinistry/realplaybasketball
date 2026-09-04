(() => {
  if (window.__realPlayAdminSeasonPlayersInstalled) return;
  window.__realPlayAdminSeasonPlayersInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS' },
    { id: 'valiant', name: 'VALIANT' },
    { id: 'watchmen', name: 'WATCHMEN' },
    { id: 'conquerors', name: 'CONQUERORS' },
  ];

  let season = null;
  let registered = [];
  let profiles = [];
  let loading = false;
  let assigningUserId = null;
  let notice = '';
  let noticeType = '';

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

  function clubName(id) {
    return CLUBS.find((club) => club.id === id)?.name || 'UNASSIGNED';
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
    if (document.querySelector('[data-rp-season-players-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpSeasonPlayersStyles = '1';
    style.textContent = `
      .rp-admin-season-roster{margin:0 0 16px;padding:15px;border:1px solid rgba(47,220,255,.22);border-radius:16px;background:linear-gradient(160deg,rgba(4,21,34,.95),rgba(2,8,15,.98))}
      .rp-admin-season-roster-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      .rp-admin-season-roster-head small{display:block;color:#38dfff;font-size:.55rem;font-weight:950;letter-spacing:.14em}
      .rp-admin-season-roster-head strong{display:block;margin-top:5px;color:#fff;font-family:var(--rp-display);font-size:1.18rem;font-style:italic;line-height:1}
      .rp-admin-season-roster-count{flex:0 0 auto;padding:6px 8px;border:1px solid rgba(47,220,255,.2);border-radius:999px;color:#63e6ff;font-size:.55rem;font-weight:950}
      .rp-admin-season-roster-note{margin:0 0 12px;color:#7f96ad;font-size:.65rem;line-height:1.45}
      .rp-admin-season-player-list{display:grid;gap:10px}
      .rp-admin-season-player{padding:12px;border:1px solid rgba(126,173,232,.13);border-radius:13px;background:#030a12}
      .rp-admin-season-player-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .rp-admin-season-player-name strong{display:block;color:#fff;font-size:.78rem;font-weight:950}
      .rp-admin-season-player-name span{display:block;margin-top:4px;color:#70879f;font-size:.58rem}
      .rp-admin-season-assigned{flex:0 0 auto;color:#63e6ff;font-size:.57rem;font-weight:950;letter-spacing:.06em}
      .rp-admin-season-pref{margin-top:8px;color:#8399af;font-size:.59rem;font-weight:800}
      .rp-admin-season-pref b{color:#dbeeff}
      .rp-admin-season-preferred{width:100%;min-height:40px;margin-top:9px;border:1px solid rgba(47,220,255,.28);border-radius:10px;background:#071623;color:#63e6ff;font-size:.63rem;font-weight:950}
      .rp-admin-season-clubs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      .rp-admin-season-clubs button{min-height:40px;border:1px solid rgba(126,173,232,.14);border-radius:10px;background:#030a12;color:#90a6bb;font-size:.59rem;font-weight:900}
      .rp-admin-season-clubs button.active{border-color:rgba(47,220,255,.42);background:#071824;color:#66e7ff}
      .rp-admin-season-unassign{width:100%;min-height:38px;margin-top:7px;border:1px solid rgba(255,120,145,.2);border-radius:10px;background:#10070b;color:#ff93a8;font-size:.58rem;font-weight:900}
      .rp-admin-season-player button:disabled{opacity:.5}
      .rp-admin-season-roster-message{margin:10px 0 0;color:#ff9aaa;font-size:.62rem;line-height:1.4}
      .rp-admin-season-roster-message.success{color:#65e6ff}
      .rp-admin-season-roster-empty{padding:14px;border:1px dashed rgba(126,173,232,.14);border-radius:12px;color:#71879d;font-size:.64rem;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function mergedSeasonPlayers() {
    const byId = new Map(profiles.map((player) => [Number(player.userId), player]));
    return registered.map((entry) => ({
      ...entry,
      ...(byId.get(Number(entry.userId)) || {}),
      preferredClub: byId.get(Number(entry.userId))?.preferredClub ?? entry.preferredClub ?? null,
      assignedClub: byId.get(Number(entry.userId))?.assignedClub ?? entry.assignedClub ?? null,
    }));
  }

  function markup() {
    if (!season) {
      return `
        <section class="rp-admin-season-roster" data-rp-admin-season-roster>
          <div class="rp-admin-season-roster-head">
            <div><small>SEASON ROSTER</small><strong>TEAM ASSIGNMENTS</strong></div>
            <span class="rp-admin-season-roster-count">NO SEASON</span>
          </div>
          <div class="rp-admin-season-roster-empty">Create and open a 3V3 season from SETUP first.</div>
        </section>`;
    }

    const players = mergedSeasonPlayers();
    const cards = players.length ? players.map((player) => {
      const preferred = clubName(player.preferredClub);
      const assigned = clubName(player.assignedClub);
      const busy = assigningUserId === Number(player.userId);
      const canApprove = Boolean(player.preferredClub && player.preferredClub !== player.assignedClub);
      return `
        <article class="rp-admin-season-player" data-season-player="${Number(player.userId)}">
          <div class="rp-admin-season-player-top">
            <div class="rp-admin-season-player-name">
              <strong>${esc(player.playerName || 'REAL PLAY PLAYER')}</strong>
              <span>${esc(player.email || 'SEASON REGISTRATION')}</span>
            </div>
            <span class="rp-admin-season-assigned">${esc(assigned)}</span>
          </div>
          <div class="rp-admin-season-pref">PREFERRED TEAM: <b>${esc(preferred)}</b></div>
          ${canApprove ? `<button type="button" class="rp-admin-season-preferred" data-season-assign="${esc(player.preferredClub)}" ${busy ? 'disabled' : ''}>APPROVE PREFERRED · ${esc(preferred)}</button>` : ''}
          <div class="rp-admin-season-clubs">
            ${CLUBS.map((club) => `<button type="button" class="${player.assignedClub === club.id ? 'active' : ''}" data-season-assign="${club.id}" ${busy ? 'disabled' : ''}>${club.name}${player.assignedClub === club.id ? ' ✓' : ''}</button>`).join('')}
          </div>
          ${player.assignedClub ? `<button type="button" class="rp-admin-season-unassign" data-season-assign="" ${busy ? 'disabled' : ''}>RETURN TO UNASSIGNED</button>` : ''}
        </article>`;
    }).join('') : '<div class="rp-admin-season-roster-empty">No players have reserved a season spot yet.</div>';

    return `
      <section class="rp-admin-season-roster" data-rp-admin-season-roster>
        <div class="rp-admin-season-roster-head">
          <div><small>SEASON ROSTER</small><strong>TEAM ASSIGNMENTS</strong></div>
          <span class="rp-admin-season-roster-count">${players.length} / ${Number(season.targetPlayers ?? season.target_players ?? 0)}</span>
        </div>
        <p class="rp-admin-season-roster-note">Approve a player’s preferred team or move them to another club. Final team assignment stays under Real Play admin control.</p>
        <div class="rp-admin-season-player-list">${cards}</div>
        ${notice ? `<p class="rp-admin-season-roster-message${noticeType === 'success' ? ' success' : ''}">${esc(notice)}</p>` : ''}
      </section>`;
  }

  function apply() {
    ensureStyles();
    if (!isPlayersTab()) return;
    const adminBody = body();
    if (!adminBody) return;

    let wrap = adminBody.querySelector('[data-rp-admin-season-roster]');
    const html = markup();

    if (wrap) {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      wrap.replaceWith(holder.firstElementChild);
      return;
    }

    const first = adminBody.firstElementChild;
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const node = holder.firstElementChild;
    if (first) first.before(node);
    else adminBody.appendChild(node);
  }

  async function refresh({ quiet = true } = {}) {
    if (loading || !token() || !isPlayersTab()) return;
    loading = true;
    try {
      const [seasonData, playersData] = await Promise.all([
        api('/api/real-play/admin/3v3/season'),
        api('/api/real-play/admin/3v3/players'),
      ]);
      season = seasonData?.season || null;
      registered = Array.isArray(seasonData?.registeredPlayers) ? seasonData.registeredPlayers : [];
      profiles = Array.isArray(playersData?.players) ? playersData.players : [];
      if (!quiet) {
        notice = '';
        noticeType = '';
      }
      apply();
    } catch (error) {
      if (!quiet) {
        notice = error.message || 'Could not load season team assignments.';
        noticeType = 'error';
        apply();
      }
    } finally {
      loading = false;
    }
  }

  async function assign(button) {
    const card = button.closest('[data-season-player]');
    const userId = Number(card?.dataset.seasonPlayer);
    const player = mergedSeasonPlayers().find((item) => Number(item.userId) === userId);
    if (!player || assigningUserId) return;

    const club = button.dataset.seasonAssign || null;
    const destination = club ? clubName(club) : 'UNASSIGNED';
    const actionText = club
      ? `Assign ${player.playerName} to ${destination}?`
      : `Return ${player.playerName} to Unassigned?`;

    if (!window.confirm(actionText)) return;

    assigningUserId = userId;
    notice = '';
    noticeType = '';
    apply();

    try {
      const result = await api('/api/real-play/admin/3v3/assignment', {
        method: 'PUT',
        body: { userId, club },
      });

      const profile = profiles.find((item) => Number(item.userId) === userId);
      if (profile) profile.assignedClub = result.assignedClub || null;
      const reg = registered.find((item) => Number(item.userId) === userId);
      if (reg) reg.assignedClub = result.assignedClub || null;

      notice = result.assignedClub
        ? `${player.playerName} is now assigned to ${clubName(result.assignedClub)}.`
        : `${player.playerName} is now unassigned.`;
      noticeType = 'success';

      window.dispatchEvent(new CustomEvent('realplay:3v3-assignment', {
        detail: { userId, assignedClub: result.assignedClub || null },
      }));
    } catch (error) {
      notice = error.message || 'Team assignment failed.';
      noticeType = 'error';
    } finally {
      assigningUserId = null;
      apply();
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-season-assign]');
    if (!button || !isPlayersTab()) return;
    assign(button);
  });

  window.addEventListener('realplay:admin-render', () => {
    if (!isPlayersTab()) return;
    window.requestAnimationFrame(() => {
      apply();
      refresh();
    });
  });

  window.addEventListener('realplay:3v3-season-changed', () => refresh({ quiet: false }));
  window.addEventListener('realplay:3v3-assignment', () => refresh());

  window.setInterval(() => {
    if (isPlayersTab()) refresh();
  }, 10000);
})();