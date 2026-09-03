(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('admin') !== '1') return;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS' },
    { id: 'valiant', name: 'VALIANT' },
    { id: 'watchmen', name: 'WATCHMEN' },
    { id: 'conquerors', name: 'CONQUERORS' },
  ];
  let players = [];

  const root = document.createElement('div');
  root.className = 'rp-3v3-admin';
  root.hidden = true;
  root.innerHTML = `
    <button class="rp-3v3-admin-launch" type="button" data-rp-3v3-admin-launch>3V3 CLUBS <b data-rp-3v3-admin-count>0</b></button>
    <div class="rp-3v3-admin-backdrop" data-rp-3v3-admin-backdrop aria-hidden="true">
      <section class="rp-3v3-admin-panel" role="dialog" aria-modal="true" aria-labelledby="rp-3v3-admin-title">
        <header><div><small>REAL PLAY OPERATIONS</small><h2 id="rp-3v3-admin-title">BETA CLUB DESIGNATION</h2></div><button type="button" data-rp-3v3-admin-close>×</button></header>
        <p class="rp-3v3-admin-lede">Players may choose a preferred club, but Beta Season team designation stays under Real Play control.</p>
        <div class="rp-3v3-admin-summary" data-rp-3v3-admin-summary></div>
        <div data-rp-3v3-admin-list></div>
      </section>
    </div>
  `;
  document.body.appendChild(root);

  const launch = root.querySelector('[data-rp-3v3-admin-launch]');
  const count = root.querySelector('[data-rp-3v3-admin-count]');
  const backdrop = root.querySelector('[data-rp-3v3-admin-backdrop]');
  const summary = root.querySelector('[data-rp-3v3-admin-summary]');
  const list = root.querySelector('[data-rp-3v3-admin-list]');

  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }
  function clubName(id) { return CLUBS.find((club) => club.id === id)?.name || 'UNASSIGNED'; }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token()}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || '3v3 operation failed.');
    return data;
  }

  function renderSummary() {
    summary.innerHTML = CLUBS.map((club) => {
      const total = players.filter((player) => player.assignedClub === club.id).length;
      return `<div><strong>${total}</strong><span>${club.name}</span></div>`;
    }).join('');
  }

  function render() {
    count.textContent = String(players.filter((player) => !player.assignedClub).length);
    renderSummary();

    if (!players.length) {
      list.innerHTML = '<div class="rp-3v3-admin-empty">NO REAL PLAY PLAYER PROFILES YET</div>';
      return;
    }

    list.innerHTML = players.map((player) => {
      const preferredName = clubName(player.preferredClub);
      const assignedName = clubName(player.assignedClub);
      const canAssignPreferred = Boolean(player.preferredClub && player.assignedClub !== player.preferredClub);
      return `
        <article class="rp-3v3-admin-player" data-rp-three-player="${player.userId}">
          <div class="rp-3v3-admin-player-head">
            <div><strong>${escapeHtml(player.playerName)}</strong><span>${escapeHtml(player.email)}</span></div>
            <span class="rp-3v3-admin-current">${assignedName}</span>
          </div>
          <div class="rp-3v3-admin-pref">PREFERRED: <b>${preferredName}</b></div>
          ${canAssignPreferred ? `<button class="rp-3v3-admin-preferred-action" type="button" data-rp-three-assign="${player.preferredClub}">ASSIGN PREFERRED · ${preferredName}</button>` : ''}
          <div class="rp-3v3-admin-actions">
            ${CLUBS.map((club) => `<button type="button" class="${player.assignedClub === club.id ? 'active' : ''}" data-rp-three-assign="${club.id}">${player.assignedClub === club.id ? `${club.name} ✓` : club.name}</button>`).join('')}
          </div>
          ${player.assignedClub ? '<button class="rp-3v3-admin-clear" type="button" data-rp-three-assign="">RETURN TO UNASSIGNED</button>' : ''}
          <p class="rp-3v3-admin-status" data-rp-3v3-admin-status></p>
        </article>
      `;
    }).join('');

    list.querySelectorAll('[data-rp-three-assign]').forEach((button) => {
      button.addEventListener('click', () => assign(button));
    });
  }

  async function refresh() {
    if (!token()) return;
    try {
      const data = await api('/api/real-play/admin/3v3/players');
      players = Array.isArray(data.players) ? data.players : [];
      render();
      root.hidden = false;
    } catch (_error) {
      root.hidden = true;
    }
  }

  function showAssignmentResult(userId, message) {
    const updatedCard = list.querySelector(`[data-rp-three-player="${userId}"]`);
    const updatedStatus = updatedCard?.querySelector('[data-rp-3v3-admin-status]');
    if (!updatedStatus) return;
    updatedStatus.textContent = message;
    updatedStatus.classList.add('success');
  }

  async function assign(button) {
    const card = button.closest('[data-rp-three-player]');
    const userId = Number(card?.dataset.rpThreePlayer);
    const player = players.find((item) => Number(item.userId) === userId);
    if (!player) return;
    const club = button.dataset.rpThreeAssign || null;
    const wording = club ? `${player.playerName} to ${clubName(club)}` : `${player.playerName} back to Unassigned`;
    if (!window.confirm(`Confirm ${wording}?`)) return;

    const status = card.querySelector('[data-rp-3v3-admin-status]');
    card.querySelectorAll('button').forEach((control) => { control.disabled = true; });
    if (status) status.textContent = club ? 'CONFIRMING FINAL CLUB…' : 'RETURNING TO UNASSIGNED…';
    try {
      const result = await api('/api/real-play/admin/3v3/assignment', {
        method: 'PUT',
        body: { userId, club },
      });
      player.assignedClub = result.assignedClub || null;
      player.assignedAt = result.assignedAt || null;
      render();
      showAssignmentResult(
        userId,
        result.assignedClub
          ? `FINAL CLUB CONFIRMED: ${clubName(result.assignedClub)} ✓`
          : 'PLAYER RETURNED TO UNASSIGNED.'
      );
      window.dispatchEvent(new CustomEvent('realplay:3v3-assignment', {
        detail: { userId, assignedClub: result.assignedClub || null },
      }));
    } catch (error) {
      if (status) status.textContent = error.message || 'Assignment failed.';
      card.querySelectorAll('button').forEach((control) => { control.disabled = false; });
    }
  }

  function open() {
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    refresh();
  }
  function close() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  launch.addEventListener('click', open);
  root.querySelector('[data-rp-3v3-admin-close]')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  refresh();
  window.setInterval(refresh, 15000);
})();
