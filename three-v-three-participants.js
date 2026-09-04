(() => {
  if (window.__realPlayThreeVThreeParticipantsInstalled) return;
  window.__realPlayThreeVThreeParticipantsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CLUBS = [
    { id: 'lions', name: 'LIONS' },
    { id: 'valiant', name: 'VALIANT' },
    { id: 'watchmen', name: 'WATCHMEN' },
    { id: 'conquerors', name: 'CONQUERORS' },
  ];

  let section = null;
  let pollTimer = null;
  let loading = false;
  let lastSignature = '';

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function initials(name) {
    const parts = String(name || 'RP').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]).join('') || 'RP').toUpperCase();
  }

  function viewIsOpen() {
    return Boolean(document.querySelector('.rp-3v3-view.open'));
  }

  function mount() {
    const view = document.querySelector('.rp-3v3-view');
    const session = view?.querySelector('[data-rp-3v3-session]');
    if (!view || !session) return false;

    section = view.querySelector('[data-rp-secured-players]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'rp-3v3-players';
      section.setAttribute('data-rp-secured-players', '');
      section.innerHTML = `
        <header class="rp-3v3-players-head">
          <div>
            <small>LEAGUE RESERVATIONS</small>
            <strong>WHO'S IN.</strong>
          </div>
          <b data-rp-secured-count>0</b>
        </header>
        <p class="rp-3v3-players-mode" data-rp-secured-mode>FIRST 3V3 ROSTER · PREFERRED CLUBS · FINAL ASSIGNMENT PENDING</p>
        <div class="rp-3v3-club-roster" data-rp-club-roster></div>
        <div class="rp-3v3-unassigned" data-rp-unassigned hidden></div>
      `;
      session.insertAdjacentElement('afterend', section);
    }

    return true;
  }

  function renderEmpty() {
    if (!section) return;
    const count = section.querySelector('[data-rp-secured-count]');
    const mode = section.querySelector('[data-rp-secured-mode]');
    const roster = section.querySelector('[data-rp-club-roster]');
    const unassigned = section.querySelector('[data-rp-unassigned]');
    if (count) count.textContent = '0';
    if (mode) mode.textContent = 'FIRST 3V3 ROSTER · PREFERRED CLUBS · FINAL ASSIGNMENT PENDING';
    if (roster) {
      roster.innerHTML = `
        <div class="rp-3v3-players-empty">
          <strong>NO LEAGUE RESERVATIONS YET.</strong>
          <span>Reserve your league spot to appear on the launch roster.</span>
        </div>`;
    }
    if (unassigned) unassigned.hidden = true;
  }

  function playerMarkup(player, currentUserId) {
    const mine = Number(player.userId) === Number(currentUserId);
    return `
      <div class="rp-3v3-player-chip${mine ? ' mine' : ''}">
        <i>${esc(initials(player.playerName))}</i>
        <span title="${esc(player.playerName)}">${esc(player.playerName)}</span>
        ${mine ? '<em>YOU</em>' : ''}
      </div>`;
  }

  function render(data) {
    if (!section) return;
    const players = Array.isArray(data?.securedPlayers) ? data.securedPlayers : [];
    const currentUserId = Number(data?.userId || 0);

    if (!players.length) {
      renderEmpty();
      return;
    }

    const playersWithClub = players.filter((player) => player.assignedClub || player.preferredClub);
    const allAssigned = playersWithClub.length > 0 && playersWithClub.every((player) => Boolean(player.assignedClub));
    const modeLabel = allAssigned
      ? 'OFFICIAL TEAMS'
      : 'FIRST 3V3 ROSTER · PREFERRED CLUBS · FINAL ASSIGNMENT PENDING';

    const count = section.querySelector('[data-rp-secured-count]');
    const mode = section.querySelector('[data-rp-secured-mode]');
    const roster = section.querySelector('[data-rp-club-roster]');
    const unassigned = section.querySelector('[data-rp-unassigned]');

    if (count) count.textContent = String(players.length);
    if (mode) mode.textContent = modeLabel;

    const grouped = new Map(CLUBS.map((club) => [club.id, []]));
    const waiting = [];

    players.forEach((player) => {
      const club = player.assignedClub || player.preferredClub || null;
      if (club && grouped.has(club)) grouped.get(club).push(player);
      else waiting.push(player);
    });

    if (roster) {
      roster.innerHTML = CLUBS.map((club) => {
        const clubPlayers = grouped.get(club) || [];
        return `
          <article class="rp-3v3-club-group${clubPlayers.length ? ' has-players' : ''}">
            <header>
              <strong>${club.name}</strong>
              <span>${clubPlayers.length}</span>
            </header>
            <div class="rp-3v3-club-players">
              ${clubPlayers.length
                ? clubPlayers.map((player) => playerMarkup(player, currentUserId)).join('')
                : '<small>NO ONE YET</small>'}
            </div>
          </article>`;
      }).join('');
    }

    if (unassigned) {
      if (waiting.length) {
        unassigned.hidden = false;
        unassigned.innerHTML = `
          <strong>WAITING FOR CLUB</strong>
          <div>${waiting.map((player) => playerMarkup(player, currentUserId)).join('')}</div>`;
      } else {
        unassigned.hidden = true;
        unassigned.innerHTML = '';
      }
    }
  }

  async function refresh({ quiet = true } = {}) {
    if (loading || !token() || !viewIsOpen()) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/3v3/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      const signature = JSON.stringify({
        userId: data.userId,
        securedPlayers: data.securedPlayers || [],
      });
      if (!quiet || signature !== lastSignature) {
        lastSignature = signature;
        render(data);
      }
    } catch (_error) {
      // Keep the last known roster visible if a refresh briefly fails.
    } finally {
      loading = false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refresh({ quiet: true }), 5000);
  }

  function install() {
    if (!mount()) return false;
    renderEmpty();

    const view = document.querySelector('.rp-3v3-view');
    const action = view?.querySelector('[data-rp-session-action]');
    const cancel = view?.querySelector('[data-rp-session-cancel]');

    action?.addEventListener('click', () => setTimeout(() => refresh({ quiet: false }), 900));
    cancel?.addEventListener('click', () => setTimeout(() => refresh({ quiet: false }), 900));

    const classObserver = new MutationObserver(() => {
      if (viewIsOpen()) refresh({ quiet: false });
    });
    if (view) classObserver.observe(view, { attributes: true, attributeFilter: ['class'] });

    startPolling();
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('focus', () => refresh({ quiet: true }));
  window.addEventListener('pageshow', () => refresh({ quiet: true }));
  window.addEventListener('realplay:3v3-assignment', () => refresh({ quiet: false }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh({ quiet: true });
  });
})();
