(() => {
  if (window.__realPlayAdminSeasonControlInstalled) return;
  window.__realPlayAdminSeasonControlInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let state = { season: null, registeredPlayers: [] };
  let loading = false;
  let busy = false;
  let message = '';
  let messageType = '';
  let lastMarkup = '';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
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

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'START DATE TO BE ANNOUNCED';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'START DATE TO BE ANNOUNCED';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function adminRoot() {
    return document.querySelector('.rp-admin-control');
  }

  function setupTabOpen() {
    const root = adminRoot();
    return root?.classList.contains('open') &&
      root.querySelector('.rp-admin-tab.active')?.dataset.adminTab === 'session';
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-season-admin-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpSeasonAdminStyles = '1';
    style.textContent = `
      .rp-admin-season-wrap{margin:0 0 14px}
      .rp-admin-season-card{padding:16px;border:1px solid rgba(47,220,255,.24);border-radius:16px;background:linear-gradient(160deg,rgba(5,24,38,.92),rgba(3,8,15,.98))}
      .rp-admin-season-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .rp-admin-season-card small{display:block;color:#3edfff;font-size:.56rem;font-weight:950;letter-spacing:.15em}
      .rp-admin-season-card h2{margin:5px 0 0;color:#fff;font-family:var(--rp-display);font-size:1.35rem;font-style:italic;line-height:1}
      .rp-admin-season-card .rp-season-pill{flex:0 0 auto;padding:6px 8px;border:1px solid rgba(47,220,255,.2);border-radius:999px;color:#6ce8ff;font-size:.54rem;font-weight:950;letter-spacing:.1em}
      .rp-admin-season-progress{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:14px;padding-top:12px;border-top:1px solid rgba(126,173,232,.1)}
      .rp-admin-season-progress strong{font-size:1.45rem;color:#fff}.rp-admin-season-progress span{color:#7b91a9;font-size:.62rem;font-weight:800}
      .rp-admin-season-progress b{color:#38dfff;font-family:var(--rp-display);font-size:1rem;font-style:italic}
      .rp-admin-season-note{margin:10px 0 0;color:#7e94aa;font-size:.67rem;line-height:1.5}
      .rp-admin-season-form{display:grid;gap:10px;margin-top:14px}
      .rp-admin-season-form label{display:grid;gap:6px;color:#7189a5;font-size:.57rem;font-weight:900;letter-spacing:.08em}
      .rp-admin-season-form input{width:100%;min-height:48px;padding:0 12px;border:1px solid rgba(126,173,232,.16);border-radius:12px;background:#020812;color:#fff;font:inherit}
      .rp-admin-season-form button{min-height:50px;border:0;border-radius:13px;background:linear-gradient(100deg,#176cff,#1ddcff);color:#fff;font-family:var(--rp-display);font-size:.83rem;font-style:italic;font-weight:950;letter-spacing:.05em}
      .rp-admin-season-form button:disabled{opacity:.55}
      .rp-admin-season-message{margin:9px 0 0;color:#ff9aa7;font-size:.64rem;line-height:1.45}
      .rp-admin-season-message.success{color:#63e6ff}
    `;
    document.head.appendChild(style);
  }

  function seasonMarkup() {
    const season = state.season;
    if (season) {
      const reserved = Number(season.reservedCount ?? season.reserved_count ?? 0) || 0;
      const target = Number(season.targetPlayers ?? season.target_players ?? 0) || 0;
      const remaining = Math.max(0, target - reserved);
      return `
        <section class="rp-admin-season-card">
          <header>
            <div><small>3V3 SEASON AUTHORITY</small><h2>${esc(season.name)}</h2></div>
            <span class="rp-season-pill">${esc(String(season.status || 'registration').toUpperCase())}</span>
          </header>
          <div class="rp-admin-season-progress">
            <div><strong>${reserved} / ${target}</strong><span> PLAYERS RESERVED</span></div>
            <b>${remaining === 0 ? 'ROSTER COMPLETE' : `${remaining} NEEDED`}</b>
          </div>
          <p class="rp-admin-season-note">${esc(formatDate(season.startsAt || season.starts_at))} · This season now owns the public 3V3 reservation roster. Career sessions remain separate game operations.</p>
        </section>`;
    }

    return `
      <section class="rp-admin-season-card">
        <header>
          <div><small>3V3 SEASON AUTHORITY</small><h2>CREATE THE NEXT SEASON.</h2></div>
          <span class="rp-season-pill">NO ACTIVE SEASON</span>
        </header>
        <p class="rp-admin-season-note">Creating a season opens the player-side league reservation roster. It does not create or start a Career game session.</p>
        <form class="rp-admin-season-form" data-rp-season-form>
          <label>SEASON NAME<input name="name" maxlength="120" value="REAL PLAY 3V3 BETA SEASON 1" required></label>
          <label>ROSTER TARGET<input name="targetPlayers" type="number" min="4" max="500" inputmode="numeric" value="20" required></label>
          <label>PLANNED START DATE<input name="startsAt" type="date"></label>
          <button type="submit" ${busy ? 'disabled' : ''}>${busy ? 'CREATING…' : 'CREATE SEASON & OPEN ROSTER'}</button>
        </form>
      </section>`;
  }

  function apply() {
    ensureStyles();
    if (!setupTabOpen()) return;
    const body = adminRoot()?.querySelector('[data-admin-body]');
    if (!body) return;

    let wrap = body.querySelector('[data-rp-admin-season-wrap]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'rp-admin-season-wrap';
      wrap.dataset.rpAdminSeasonWrap = '1';
      const firstCard = body.querySelector('.rp-admin-card,.rp-admin-empty');
      if (firstCard) firstCard.before(wrap);
      else body.prepend(wrap);
    }

    const markup = `
      ${seasonMarkup()}
      ${message ? `<p class="rp-admin-season-message${messageType === 'success' ? ' success' : ''}">${esc(message)}</p>` : ''}
    `;
    if (markup === lastMarkup && wrap.innerHTML) return;
    lastMarkup = markup;
    wrap.innerHTML = markup;
  }

  async function refresh() {
    if (loading || busy || !token() || !setupTabOpen()) return;
    loading = true;
    try {
      const data = await api('/api/real-play/admin/3v3/season');
      state = { season: data?.season || null, registeredPlayers: data?.registeredPlayers || [] };
    } catch (_error) {
      // Base admin remains usable if season service is temporarily unavailable.
    } finally {
      loading = false;
      apply();
    }
  }

  async function createSeason(form) {
    if (busy) return;
    busy = true;
    message = '';
    messageType = '';
    apply();

    const data = new FormData(form);
    const startsAtRaw = String(data.get('startsAt') || '').trim();
    try {
      const result = await api('/api/real-play/admin/3v3/season', {
        method: 'POST',
        body: {
          name: String(data.get('name') || '').trim(),
          targetPlayers: Number(data.get('targetPlayers') || 20),
          startsAt: startsAtRaw ? `${startsAtRaw}T00:00:00+08:00` : null,
        },
      });
      state.season = result?.season || null;
      state.registeredPlayers = [];
      message = 'SEASON CREATED. PLAYER ROSTER REGISTRATION IS NOW OPEN.';
      messageType = 'success';
      window.dispatchEvent(new CustomEvent('realplay:3v3-season-changed'));
    } catch (error) {
      message = error.message || 'Could not create the season.';
    } finally {
      busy = false;
      apply();
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-rp-season-form]');
    if (!form) return;
    event.preventDefault();
    createSeason(form);
  });

  // Admin Game Control already re-renders its body frequently.
  // Do not observe its DOM: a MutationObserver here can feed back into those
  // renders and freeze Admin Mode. Use lightweight scheduled refresh instead.
  window.setInterval(() => {
    if (setupTabOpen()) {
      apply();
      refresh();
    }
  }, 2500);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-admin-tab="session"], .rp-admin-launcher')) {
      window.setTimeout(() => {
        apply();
        refresh();
      }, 60);
    }
  });

  window.addEventListener('focus', refresh);
  window.addEventListener('realplay:3v3-season-changed', refresh);
  refresh();
})();
