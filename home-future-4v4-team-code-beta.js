(() => {
  if (window.__realPlay4v4TeamCodeBetaInstalled) return;
  window.__realPlay4v4TeamCodeBetaInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-4v4-team-code-beta-style';
  const CLUB_NAMES = {
    lions: 'LIONS',
    valiant: 'VALIANT',
    watchmen: 'WATCHMEN',
    conquerors: 'CONQUERORS',
  };

  let state = null;
  let loading = false;
  let lastSelectedClub = '';
  let panelObserver = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Real Play could not complete that request.');
      error.status = response.status;
      error.code = data?.code || '';
      throw error;
    }
    return data;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-4v4-preference-actions .rp-4v4-team-code-admin{
        flex:0 0 48px;min-width:48px;min-height:46px;margin:0;padding:0;display:grid;place-items:center;
        cursor:pointer;border:1px solid rgba(84,219,255,.22);border-radius:14px;color:#8cecff;
        background:linear-gradient(180deg,rgba(11,30,47,.98),rgba(5,17,29,.98));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.04);font-size:1rem;line-height:1;
        transition:transform .16s ease,border-color .16s ease,background .16s ease;
      }
      .rp-4v4-preference-actions .rp-4v4-team-code-admin:hover{border-color:rgba(84,219,255,.58);background:#0c2034}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin:active{transform:scale(.96)}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin[hidden]{display:none!important}
      .rp-4v4-preference-action.rp-team-code-secured{color:#75f1c5!important;border-color:rgba(80,238,184,.34)!important;background:rgba(9,45,38,.88)!important}
      .rp-4v4-preference-action.rp-team-code-held{border-color:rgba(255,199,93,.28)!important}
      .rp-4v4-team-code-dialog{
        position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;
        background:rgba(0,4,9,.82);backdrop-filter:blur(10px);
      }
      .rp-4v4-team-code-dialog[hidden]{display:none!important}
      .rp-4v4-team-code-card{
        width:min(100%,390px);padding:20px;border:1px solid rgba(83,220,255,.23);border-radius:22px;
        background:linear-gradient(180deg,#071521,#030a11);box-shadow:0 26px 80px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.045);
        color:#eefaff;font-family:Arial,sans-serif;
      }
      .rp-4v4-team-code-kicker{margin:0 0 7px;color:#53dfff;font-size:.58rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
      .rp-4v4-team-code-card h3{margin:0;color:#f7fbff;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.55rem;font-style:italic;letter-spacing:.03em;text-transform:uppercase}
      .rp-4v4-team-code-copy{margin:9px 0 15px;color:#8fa6b8;font-size:.72rem;font-weight:700;line-height:1.5}
      .rp-4v4-team-code-input{
        width:100%;height:52px;box-sizing:border-box;padding:0 14px;border:1px solid rgba(92,221,255,.25);border-radius:14px;
        outline:none;background:#020a12;color:#f5fbff;font-size:1rem;font-weight:950;letter-spacing:.16em;text-align:center;text-transform:uppercase;
      }
      .rp-4v4-team-code-input:focus{border-color:rgba(92,221,255,.72);box-shadow:0 0 0 3px rgba(70,218,255,.08)}
      .rp-4v4-team-code-display{
        margin:14px 0;padding:15px;border:1px dashed rgba(85,225,255,.34);border-radius:14px;background:rgba(42,185,226,.055);
        color:#85ebff;font-size:1.35rem;font-weight:1000;letter-spacing:.12em;text-align:center;
      }
      .rp-4v4-team-code-expiry{display:block;margin-top:8px;color:#8197a9;font-size:.57rem;font-weight:850;letter-spacing:.055em;text-align:center;text-transform:uppercase}
      .rp-4v4-team-code-error{min-height:18px;margin:9px 0 0;color:#ff929e;font-size:.64rem;font-weight:800;line-height:1.4;text-align:center}
      .rp-4v4-team-code-buttons{display:flex;gap:9px;margin-top:14px}
      .rp-4v4-team-code-buttons button{
        min-height:45px;border-radius:13px;font-size:.67rem;font-weight:950;letter-spacing:.055em;text-transform:uppercase;cursor:pointer;
      }
      .rp-4v4-team-code-primary{flex:1;border:1px solid rgba(77,220,255,.38);background:#0b2a3d;color:#9cefff}
      .rp-4v4-team-code-secondary{flex:0 0 96px;border:1px solid rgba(255,255,255,.1);background:#07101a;color:#9aabba}
      .rp-4v4-team-code-primary:disabled{opacity:.6;cursor:default}
      .rp-4v4-team-code-toast{
        position:fixed;left:50%;bottom:26px;z-index:2147483001;max-width:min(88vw,420px);transform:translateX(-50%);
        padding:11px 14px;border:1px solid rgba(83,220,255,.24);border-radius:999px;background:rgba(4,17,28,.97);
        color:#dff8ff;font-size:.65rem;font-weight:900;letter-spacing:.035em;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.42);
      }
    `;
    document.head.appendChild(style);
  }

  function selectedClub() {
    const label = String(document.querySelector('[data-rp-4v4-preference-team]')?.textContent || '').trim().toLowerCase();
    const direct = Object.keys(CLUB_NAMES).find((club) => CLUB_NAMES[club].toLowerCase() === label);
    if (direct) return direct;

    const buttonText = String(document.querySelector('[data-rp-4v4-preference-action]')?.textContent || '').toLowerCase();
    return Object.keys(CLUB_NAMES).find((club) => buttonText.includes(club)) || lastSelectedClub || 'lions';
  }

  function teamState(club) {
    return Array.isArray(state?.teamStates)
      ? state.teamStates.find((item) => item?.club === club) || null
      : null;
  }

  function teamPlayers(club) {
    return (Array.isArray(state?.preferencePlayers) ? state.preferencePlayers : [])
      .filter((player) => player?.preferredClub === club);
  }

  function isAdmin() {
    return window.__realPlayAdminVerified === true;
  }

  function formatExpiry(value) {
    if (!value) return '24-hour hold';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '24-hour hold';
    try {
      return `Expires ${date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    } catch (_error) {
      return '24-hour hold';
    }
  }

  function renderPlayerList(club) {
    const list = document.querySelector('[data-rp-4v4-preference-list]');
    if (!list || !state) return;
    const players = teamPlayers(club);
    if (!players.length) {
      list.innerHTML = '<p class="rp-4v4-preference-empty">NO CONFIRMED PLAYERS YET · TEAM CODE REQUIRED</p>';
      return;
    }

    list.innerHTML = players.map((player) => {
      const rank = Number(player.rank);
      const number = Number(player.playerNumber);
      const ovr = Number(player.ovr);
      const record = player.record || {};
      const recordText = Number(record.games) > 0 ? `${Number(record.wins) || 0}-${Number(record.losses) || 0}` : '—';
      const winRate = Number.isFinite(Number(player.winRate)) ? `${Number(player.winRate).toFixed(Number.isInteger(Number(player.winRate)) ? 0 : 1)}%` : '—';
      const topStats = Array.isArray(player.topStats) && player.topStats.length
        ? player.topStats.slice(0, 2).map((stat) => `${escapeHtml(String(stat.key || ''))} ${escapeHtml(String(stat.value ?? ''))}`.trim()).join(' · ')
        : '—';
      return `
        <article class="rp-4v4-player-card">
          <div class="rp-4v4-player-identity">
            <div class="rp-4v4-player-name-cell"><span class="rp-4v4-player-label">NAME</span><div class="rp-4v4-player-name-line"><strong class="rp-4v4-player-name">${escapeHtml(player.playerName || 'REAL PLAY PLAYER')}</strong>${Number.isSafeInteger(number) && number >= 0 ? `<span class="rp-4v4-player-number">#${number}</span>` : ''}</div></div>
            <div class="rp-4v4-player-rank-cell"><span class="rp-4v4-player-label">RANK</span><strong class="rp-4v4-player-rank${Number.isSafeInteger(rank) && rank > 0 ? '' : ' is-unranked'}">${Number.isSafeInteger(rank) && rank > 0 ? `#${rank}` : 'UNRANKED'}</strong></div>
          </div>
          <div class="rp-4v4-player-performance">
            <div class="rp-4v4-player-stat is-ovr"><span class="rp-4v4-player-label">OVR</span><strong class="rp-4v4-player-value">${Number.isFinite(ovr) ? Math.round(ovr) : '—'}</strong></div>
            <div class="rp-4v4-player-stat"><span class="rp-4v4-player-label">RECORD</span><strong class="rp-4v4-player-value">${escapeHtml(recordText)}</strong></div>
            <div class="rp-4v4-player-stat is-winrate"><span class="rp-4v4-player-label">WINRATE</span><strong class="rp-4v4-player-value">${escapeHtml(winRate)}</strong></div>
            <div class="rp-4v4-player-stat is-top-stats"><span class="rp-4v4-player-label">TOP STATS</span><strong class="rp-4v4-player-value">${topStats}</strong></div>
          </div>
        </article>`;
    }).join('');
  }

  function ensureAdminButton(actions) {
    let button = actions?.querySelector('[data-rp-4v4-team-code-admin]');
    if (!button && actions) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-4v4-team-code-admin';
      button.dataset.rp4v4TeamCodeAdmin = '';
      button.setAttribute('aria-label', 'Create or view team code');
      button.title = 'Admin: Create or view team code';
      button.innerHTML = '<span aria-hidden="true">🔒</span>';
      const cancel = actions.querySelector('[data-rp-4v4-preference-cancel]');
      actions.insertBefore(button, cancel || null);
      button.addEventListener('click', handleAdminCode);
    }
    if (button) button.hidden = !isAdmin();
    return button;
  }

  function render() {
    const panel = document.querySelector('.rp-4v4-preference-panel');
    if (!panel) return false;
    const actions = panel.querySelector('.rp-4v4-preference-actions');
    const action = panel.querySelector('[data-rp-4v4-preference-action]');
    const cancel = panel.querySelector('[data-rp-4v4-preference-cancel]');
    const note = panel.querySelector('.rp-4v4-preference-note');
    const teamLabel = panel.querySelector('[data-rp-4v4-preference-team]');
    const count = panel.querySelector('[data-rp-4v4-preference-count]');
    if (!actions || !action || !note) return false;

    ensureAdminButton(actions);
    const club = selectedClub();
    lastSelectedClub = club;
    const current = teamState(club) || { status: 'available', memberCount: 0, capacity: 4 };
    const joinedHere = state?.joinedClub === club;
    const joinedElsewhere = Boolean(state?.joinedClub && !joinedHere);

    action.classList.remove('is-selected', 'rp-team-code-secured', 'rp-team-code-held');
    action.disabled = false;

    if (current.status === 'secured') {
      action.textContent = joinedHere ? 'MY TEAM · SECURED ✓' : 'TEAM SECURED 🔒';
      action.classList.add('rp-team-code-secured');
      action.disabled = true;
    } else if (joinedHere) {
      action.textContent = `JOINED · ${current.memberCount || 0}/4 ✓`;
      action.classList.add('is-selected', 'rp-team-code-held');
      action.disabled = true;
    } else if (joinedElsewhere) {
      action.textContent = `JOINED ${CLUB_NAMES[state.joinedClub] || 'ANOTHER TEAM'}`;
    } else {
      action.textContent = 'JOIN MY TEAM';
      if (current.status === 'held') action.classList.add('rp-team-code-held');
    }

    if (current.status === 'secured') {
      note.textContent = 'LINEUP LOCKED · 4/4 CONFIRMED';
    } else if (current.status === 'held') {
      note.textContent = `24-HOUR HOLD ACTIVE · ${current.memberCount || 0}/4 CONFIRMED`;
    } else {
      note.textContent = 'TEAM CODE REQUIRED · COMPLETE GROUPS GET FIRST PRIORITY';
    }

    if (teamLabel) teamLabel.textContent = `${CLUB_NAMES[club] || club.toUpperCase()} LINEUP`;
    const headerSmall = panel.querySelector('.rp-4v4-preference-board-head small');
    if (headerSmall) headerSmall.innerHTML = `<span>${CLUB_NAMES[club] || club.toUpperCase()} LINEUP</span>`;
    if (count) count.textContent = `${current.memberCount || 0}/4`;

    if (cancel) {
      cancel.textContent = 'LEAVE';
      cancel.hidden = !joinedHere || current.status === 'secured';
    }

    renderPlayerList(club);
    return true;
  }

  function showToast(message) {
    document.querySelector('.rp-4v4-team-code-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'rp-4v4-team-code-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function ensureDialog() {
    let dialog = document.querySelector('[data-rp-4v4-team-code-dialog]');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'rp-4v4-team-code-dialog';
    dialog.dataset.rp4v4TeamCodeDialog = '';
    dialog.hidden = true;
    document.body.appendChild(dialog);
    return dialog;
  }

  function closeDialog() {
    const dialog = ensureDialog();
    dialog.hidden = true;
    dialog.innerHTML = '';
  }

  function openJoinDialog(club) {
    const dialog = ensureDialog();
    dialog.hidden = false;
    dialog.innerHTML = `
      <section class="rp-4v4-team-code-card" role="dialog" aria-modal="true" aria-labelledby="rp-team-code-title">
        <p class="rp-4v4-team-code-kicker">${escapeHtml(CLUB_NAMES[club] || club.toUpperCase())} · TUNE-UP TEAM</p>
        <h3 id="rp-team-code-title">JOIN MY TEAM</h3>
        <p class="rp-4v4-team-code-copy">Enter the unique code Real Play gave your organizer. Four players using the same active code will secure this team.</p>
        <input class="rp-4v4-team-code-input" data-rp-4v4-code-input autocomplete="one-time-code" inputmode="text" maxlength="12" placeholder="RP-XXXXX" aria-label="Team code" />
        <p class="rp-4v4-team-code-error" data-rp-4v4-code-error></p>
        <div class="rp-4v4-team-code-buttons"><button class="rp-4v4-team-code-primary" type="button" data-rp-4v4-code-submit>JOIN TEAM</button><button class="rp-4v4-team-code-secondary" type="button" data-rp-4v4-code-close>CANCEL</button></div>
      </section>`;

    const input = dialog.querySelector('[data-rp-4v4-code-input]');
    const submit = dialog.querySelector('[data-rp-4v4-code-submit]');
    const error = dialog.querySelector('[data-rp-4v4-code-error]');
    dialog.querySelector('[data-rp-4v4-code-close]')?.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); }, { once: true });

    const join = async () => {
      const code = String(input?.value || '').trim();
      if (!code) {
        if (error) error.textContent = 'Enter your team code.';
        input?.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = 'JOINING…';
      if (error) error.textContent = '';
      try {
        state = await api('/api/real-play/4v4/join', { method: 'POST', body: { club, code } });
        closeDialog();
        render();
        showToast(state?.message || `You joined ${CLUB_NAMES[club]}.`);
        window.dispatchEvent(new CustomEvent('realplay:4v4-team-code-updated', { detail: state }));
      } catch (joinError) {
        if (error) error.textContent = joinError.message;
        submit.disabled = false;
        submit.textContent = 'JOIN TEAM';
      }
    };
    submit?.addEventListener('click', join);
    input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') join(); });
    window.setTimeout(() => input?.focus(), 30);
  }

  function openAdminResult(club, result) {
    const dialog = ensureDialog();
    dialog.hidden = false;
    dialog.innerHTML = `
      <section class="rp-4v4-team-code-card" role="dialog" aria-modal="true" aria-labelledby="rp-admin-team-code-title">
        <p class="rp-4v4-team-code-kicker">ADMIN · ${escapeHtml(CLUB_NAMES[club] || club.toUpperCase())}</p>
        <h3 id="rp-admin-team-code-title">${result?.status === 'secured' ? 'TEAM SECURED' : '24-HOUR HOLD'}</h3>
        <p class="rp-4v4-team-code-copy">Send this code only to the organizer of the approved 4-player lineup. All four players must use the same code.</p>
        <div class="rp-4v4-team-code-display" data-rp-4v4-code-display>${escapeHtml(result?.code || '—')}</div>
        <span class="rp-4v4-team-code-expiry">${escapeHtml(result?.securedAt ? '4/4 lineup locked' : formatExpiry(result?.expiresAt))}</span>
        <p class="rp-4v4-team-code-error" data-rp-4v4-code-copy-status></p>
        <div class="rp-4v4-team-code-buttons"><button class="rp-4v4-team-code-primary" type="button" data-rp-4v4-code-copy>COPY CODE</button><button class="rp-4v4-team-code-secondary" type="button" data-rp-4v4-code-close>CLOSE</button></div>
      </section>`;
    dialog.querySelector('[data-rp-4v4-code-close]')?.addEventListener('click', closeDialog);
    dialog.querySelector('[data-rp-4v4-code-copy]')?.addEventListener('click', async () => {
      const status = dialog.querySelector('[data-rp-4v4-code-copy-status]');
      try {
        await navigator.clipboard.writeText(String(result?.code || ''));
        if (status) status.textContent = 'Code copied.';
      } catch (_error) {
        if (status) status.textContent = 'Press and hold the code to copy it.';
      }
    });
  }

  async function handleAdminCode(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAdmin()) return;
    const club = selectedClub();
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await api('/api/real-play/4v4/admin/code', { method: 'POST', body: { club } });
      await loadState();
      openAdminResult(club, result);
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function handleJoinAction(event) {
    const action = event.target.closest?.('[data-rp-4v4-preference-action]');
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const club = selectedClub();
    const current = teamState(club);
    if (current?.status === 'secured') {
      showToast('This team is already secured by four players.');
      return;
    }
    if (state?.joinedClub === club) {
      showToast(`You are already confirmed on ${CLUB_NAMES[club]}.`);
      return;
    }
    if (state?.joinedClub) {
      showToast(`You are already on ${CLUB_NAMES[state.joinedClub] || 'another team'}. Leave it first.`);
      return;
    }
    openJoinDialog(club);
  }

  async function handleLeaveAction(event) {
    const cancel = event.target.closest?.('[data-rp-4v4-preference-cancel]');
    if (!cancel) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel.disabled = true;
    try {
      state = await api('/api/real-play/4v4/preference', { method: 'DELETE' });
      render();
      showToast(state?.message || 'You left the forming team.');
      window.dispatchEvent(new CustomEvent('realplay:4v4-team-code-updated', { detail: state }));
    } catch (error) {
      showToast(error.message);
    } finally {
      cancel.disabled = false;
    }
  }

  function bindPanel() {
    const panel = document.querySelector('.rp-4v4-preference-panel');
    if (!panel || panel.dataset.rpTeamCodeBound === '1') return Boolean(panel);
    panel.dataset.rpTeamCodeBound = '1';
    panel.addEventListener('click', handleJoinAction, true);
    panel.addEventListener('click', handleLeaveAction, true);

    const teamLabel = panel.querySelector('[data-rp-4v4-preference-team]');
    if (teamLabel) {
      panelObserver?.disconnect();
      panelObserver = new MutationObserver(() => {
        const current = selectedClub();
        if (current !== lastSelectedClub) {
          lastSelectedClub = current;
          window.setTimeout(render, 0);
        }
      });
      panelObserver.observe(teamLabel, { childList: true, characterData: true, subtree: true });
    }
    render();
    return true;
  }

  async function loadState() {
    if (loading || !token()) return;
    loading = true;
    try {
      state = await api('/api/real-play/4v4/me');
      render();
    } catch (error) {
      console.warn('[Real Play] 4v4 team-code state unavailable.', error);
    } finally {
      loading = false;
    }
  }

  function sync() {
    installStyle();
    if (bindPanel()) loadState();
  }

  const rootObserver = new MutationObserver(() => {
    if (document.querySelector('.rp-4v4-preference-panel')) sync();
  });
  rootObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', render);
  window.addEventListener('realplay:app-ready', sync);
  window.addEventListener('storage', (event) => { if (event.key === TOKEN_KEY) loadState(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
