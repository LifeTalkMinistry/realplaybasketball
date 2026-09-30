(() => {
  if (window.__realPlay4v4TeamCodeBetaInstalled) return;
  window.__realPlay4v4TeamCodeBetaInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STYLE_ID = 'rp-4v4-team-code-beta-style';
  const CLUB_NAMES = Object.freeze({
    lions: 'LIONS',
    valiant: 'VALIANT',
    watchmen: 'WATCHMEN',
    conquerors: 'CONQUERORS',
  });

  let state = null;
  let loading = false;
  let boundPanel = null;
  let viewObserver = null;
  let textObserver = null;
  let renderQueued = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
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
      .rp-4v4-preference-actions .rp-4v4-team-code-admin{flex:0 0 48px;min-width:48px;min-height:46px;margin:0;padding:0;display:grid;place-items:center;cursor:pointer;border:1px solid rgba(84,219,255,.22);border-radius:14px;color:#8cecff;background:linear-gradient(180deg,rgba(11,30,47,.98),rgba(5,17,29,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.04);font-size:1rem;line-height:1;transition:transform .16s ease,border-color .16s ease,background .16s ease}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin:hover:not(:disabled){border-color:rgba(84,219,255,.58);background:#0c2034}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin:active:not(:disabled){transform:scale(.96)}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin[hidden]{display:none!important}
      .rp-4v4-preference-actions .rp-4v4-team-code-admin:disabled{opacity:.58;cursor:default}
      .rp-4v4-preference-action.rp-team-code-secured{color:#75f1c5!important;border-color:rgba(80,238,184,.34)!important;background:rgba(9,45,38,.88)!important}
      .rp-4v4-preference-action.rp-team-code-held{border-color:rgba(255,199,93,.30)!important}
      .rp-4v4-team-code-dialog{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(0,4,9,.84);backdrop-filter:blur(10px)}
      .rp-4v4-team-code-dialog[hidden]{display:none!important}
      .rp-4v4-team-code-card{width:min(100%,390px);box-sizing:border-box;padding:20px;border:1px solid rgba(83,220,255,.23);border-radius:22px;background:linear-gradient(180deg,#071521,#030a11);box-shadow:0 26px 80px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.045);color:#eefaff;font-family:Arial,sans-serif}
      .rp-4v4-team-code-kicker{margin:0 0 7px;color:#53dfff;font-size:.58rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
      .rp-4v4-team-code-card h3{margin:0;color:#f7fbff;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.55rem;font-style:italic;letter-spacing:.03em;text-transform:uppercase}
      .rp-4v4-team-code-copy{margin:9px 0 15px;color:#8fa6b8;font-size:.72rem;font-weight:700;line-height:1.5}
      .rp-4v4-team-code-input{width:100%;height:52px;box-sizing:border-box;padding:0 14px;border:1px solid rgba(92,221,255,.25);border-radius:14px;outline:none;background:#020a12;color:#f5fbff;font-size:1rem;font-weight:950;letter-spacing:.16em;text-align:center;text-transform:uppercase}
      .rp-4v4-team-code-input:focus{border-color:rgba(92,221,255,.72);box-shadow:0 0 0 3px rgba(70,218,255,.08)}
      .rp-4v4-team-code-display{margin:14px 0;padding:15px;border:1px dashed rgba(85,225,255,.34);border-radius:14px;background:rgba(42,185,226,.055);color:#85ebff;font-size:1.35rem;font-weight:1000;letter-spacing:.12em;text-align:center;user-select:all}
      .rp-4v4-team-code-expiry{display:block;margin-top:8px;color:#8197a9;font-size:.57rem;font-weight:850;letter-spacing:.055em;text-align:center;text-transform:uppercase}
      .rp-4v4-team-code-error{min-height:18px;margin:9px 0 0;color:#ff929e;font-size:.64rem;font-weight:800;line-height:1.4;text-align:center}
      .rp-4v4-team-code-buttons{display:flex;gap:9px;margin-top:14px}
      .rp-4v4-team-code-buttons button{min-height:45px;border-radius:13px;font-size:.67rem;font-weight:950;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}
      .rp-4v4-team-code-primary{flex:1;border:1px solid rgba(77,220,255,.38);background:#0b2a3d;color:#9cefff}
      .rp-4v4-team-code-secondary{flex:0 0 96px;border:1px solid rgba(255,255,255,.1);background:#07101a;color:#9aabba}
      .rp-4v4-team-code-primary:disabled{opacity:.6;cursor:default}
      .rp-4v4-team-code-toast{position:fixed;left:50%;bottom:26px;z-index:2147483001;max-width:min(88vw,420px);transform:translateX(-50%);padding:11px 14px;border:1px solid rgba(83,220,255,.24);border-radius:999px;background:rgba(4,17,28,.97);color:#dff8ff;font-size:.65rem;font-weight:900;letter-spacing:.035em;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.42)}
    `;
    document.head.appendChild(style);
  }

  function activeClub() {
    const fromView = String(document.querySelector('[data-rp-4v4-static-view]')?.dataset?.rpActiveClub || '').trim().toLowerCase();
    if (CLUB_NAMES[fromView]) return fromView;
    const label = String(document.querySelector('[data-rp-4v4-preference-team]')?.textContent || '').trim().toLowerCase();
    return Object.keys(CLUB_NAMES).find((club) => CLUB_NAMES[club].toLowerCase() === label) || 'lions';
  }

  function getTeamState(club) {
    return Array.isArray(state?.teamStates) ? state.teamStates.find((item) => item?.club === club) || null : null;
  }

  function isAdmin() {
    return window.__realPlayAdminVerified === true;
  }

  function syncLegacyPreferenceList() {
    if (!boundPanel) return;
    const view = boundPanel.closest('[data-rp-4v4-static-view]');
    if (typeof view?.__rpApply4v4PreferenceState === 'function') {
      view.__rpApply4v4PreferenceState(state || { preferredClub: null, joinedClub: null, preferencePlayers: [] });
    }
  }

  function expectedUi(club) {
    const team = getTeamState(club) || { status: 'available', memberCount: 0, capacity: 4 };
    const joinedHere = state?.joinedClub === club;
    const joinedElsewhere = Boolean(state?.joinedClub && !joinedHere);
    let actionText = 'JOIN MY TEAM';
    let actionDisabled = false;
    let note = token() ? 'TEAM CODE REQUIRED · COMPLETE GROUPS GET FIRST PRIORITY' : 'SIGN IN · ENTER YOUR TEAM CODE TO JOIN';
    let actionClass = '';

    if (team.status === 'secured') {
      actionText = joinedHere ? 'MY TEAM · SECURED ✓' : 'TEAM SECURED 🔒';
      actionDisabled = true;
      actionClass = 'secured';
      note = 'LINEUP LOCKED · 4/4 CONFIRMED';
    } else if (joinedHere) {
      actionText = `JOINED · ${team.memberCount || 0}/4 ✓`;
      actionDisabled = true;
      actionClass = 'held';
      note = `24-HOUR HOLD ACTIVE · ${team.memberCount || 0}/4 CONFIRMED`;
    } else if (joinedElsewhere) {
      actionText = `JOINED ${CLUB_NAMES[state.joinedClub] || 'ANOTHER TEAM'}`;
      note = 'LEAVE YOUR CURRENT FORMING TEAM BEFORE JOINING ANOTHER';
    } else if (team.status === 'held') {
      actionClass = 'held';
      note = `24-HOUR HOLD ACTIVE · ${team.memberCount || 0}/4 CONFIRMED`;
    }

    return { team, joinedHere, actionText, actionDisabled, note, actionClass };
  }

  function ensureAdminButton(panel) {
    const actions = panel?.querySelector('.rp-4v4-preference-actions');
    if (!actions) return null;
    let button = actions.querySelector('[data-rp-4v4-team-code-admin]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-4v4-team-code-admin';
      button.dataset.rp4v4TeamCodeAdmin = '';
      button.setAttribute('aria-label', 'Admin team code');
      button.title = 'Admin: Create or view team code';
      button.innerHTML = '<span aria-hidden="true">🔒</span>';
      const cancel = actions.querySelector('[data-rp-4v4-preference-cancel]');
      actions.insertBefore(button, cancel || null);
    }
    button.hidden = !isAdmin();
    return button;
  }

  function renderPanel() {
    const panel = boundPanel || document.querySelector('.rp-4v4-preference-panel');
    if (!panel) return false;
    const action = panel.querySelector('[data-rp-4v4-preference-action]');
    const cancel = panel.querySelector('[data-rp-4v4-preference-cancel]');
    const note = panel.querySelector('.rp-4v4-preference-note');
    const count = panel.querySelector('[data-rp-4v4-preference-count]');
    const heading = panel.querySelector('.rp-4v4-preference-board-head small');
    if (!action || !note) return false;

    const club = activeClub();
    const ui = expectedUi(club);
    const adminButton = ensureAdminButton(panel);

    if (action.textContent !== ui.actionText) action.textContent = ui.actionText;
    if (action.disabled !== ui.actionDisabled) action.disabled = ui.actionDisabled;
    action.classList.toggle('is-selected', ui.joinedHere);
    action.classList.toggle('rp-team-code-held', ui.actionClass === 'held');
    action.classList.toggle('rp-team-code-secured', ui.actionClass === 'secured');
    if (note.textContent !== ui.note) note.textContent = ui.note;

    const countText = `${ui.team.memberCount || 0}/4`;
    if (count && count.textContent !== countText) count.textContent = countText;
    if (heading?.firstChild?.nodeType === Node.TEXT_NODE && heading.firstChild.nodeValue !== 'LINEUP · ') heading.firstChild.nodeValue = 'LINEUP · ';

    if (cancel) {
      cancel.hidden = !(ui.joinedHere && ui.team.status !== 'secured');
      if (cancel.textContent !== 'LEAVE') cancel.textContent = 'LEAVE';
    }
    if (adminButton) adminButton.hidden = !isAdmin();
    return true;
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      renderPanel();
    });
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

  function formatExpiry(value) {
    if (!value) return '24-HOUR HOLD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '24-HOUR HOLD';
    try {
      return `EXPIRES ${date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    } catch (_error) {
      return '24-HOUR HOLD';
    }
  }

  function openJoinDialog(club) {
    const dialog = ensureDialog();
    dialog.hidden = false;
    dialog.innerHTML = `<section class="rp-4v4-team-code-card" role="dialog" aria-modal="true" aria-labelledby="rp-team-code-title"><p class="rp-4v4-team-code-kicker">${CLUB_NAMES[club]} · TUNE-UP TEAM</p><h3 id="rp-team-code-title">JOIN MY TEAM</h3><p class="rp-4v4-team-code-copy">Enter the unique code Real Play gave your organizer. Four players using the same active code will secure this team.</p><input class="rp-4v4-team-code-input" data-rp-4v4-code-input autocomplete="one-time-code" maxlength="12" placeholder="RP-XXXXX" aria-label="Team code" /><p class="rp-4v4-team-code-error" data-rp-4v4-code-error></p><div class="rp-4v4-team-code-buttons"><button class="rp-4v4-team-code-primary" type="button" data-rp-4v4-code-submit>JOIN TEAM</button><button class="rp-4v4-team-code-secondary" type="button" data-rp-4v4-code-close>CANCEL</button></div></section>`;
    const input = dialog.querySelector('[data-rp-4v4-code-input]');
    const submit = dialog.querySelector('[data-rp-4v4-code-submit]');
    const error = dialog.querySelector('[data-rp-4v4-code-error]');
    dialog.querySelector('[data-rp-4v4-code-close]')?.addEventListener('click', closeDialog);

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
        syncLegacyPreferenceList();
        closeDialog();
        renderPanel();
        showToast(state?.message || `You joined ${CLUB_NAMES[club]}.`);
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

  function openAdminCode(club, result) {
    const dialog = ensureDialog();
    dialog.hidden = false;
    dialog.innerHTML = `<section class="rp-4v4-team-code-card" role="dialog" aria-modal="true" aria-labelledby="rp-admin-code-title"><p class="rp-4v4-team-code-kicker">ADMIN · ${CLUB_NAMES[club]}</p><h3 id="rp-admin-code-title">${result?.status === 'secured' ? 'TEAM SECURED' : '24-HOUR HOLD'}</h3><p class="rp-4v4-team-code-copy">Send this code only to the approved organizer. Their four players must use this same code on ${CLUB_NAMES[club]}.</p><div class="rp-4v4-team-code-display">${String(result?.code || '—')}</div><span class="rp-4v4-team-code-expiry">${result?.securedAt ? '4/4 LINEUP LOCKED' : formatExpiry(result?.expiresAt)}</span><p class="rp-4v4-team-code-error" data-rp-4v4-copy-status></p><div class="rp-4v4-team-code-buttons"><button class="rp-4v4-team-code-primary" type="button" data-rp-4v4-code-copy>COPY CODE</button><button class="rp-4v4-team-code-secondary" type="button" data-rp-4v4-code-close>CLOSE</button></div></section>`;
    dialog.querySelector('[data-rp-4v4-code-close]')?.addEventListener('click', closeDialog);
    dialog.querySelector('[data-rp-4v4-code-copy]')?.addEventListener('click', async () => {
      const status = dialog.querySelector('[data-rp-4v4-copy-status]');
      try {
        await navigator.clipboard.writeText(String(result?.code || ''));
        if (status) status.textContent = 'CODE COPIED.';
      } catch (_error) {
        if (status) status.textContent = 'PRESS AND HOLD THE CODE TO COPY.';
      }
    });
  }

  async function loadState({ silent = false } = {}) {
    if (loading || !boundPanel) {
      renderPanel();
      return;
    }
    if (!token()) {
      state = null;
      syncLegacyPreferenceList();
      renderPanel();
      return;
    }
    loading = true;
    try {
      state = await api('/api/real-play/4v4/me');
      syncLegacyPreferenceList();
    } catch (error) {
      if (!silent) console.warn('[Real Play] Could not load 4v4 team-code state.', error);
    } finally {
      loading = false;
      renderPanel();
    }
  }

  async function handlePanelClick(event) {
    const action = event.target.closest?.('[data-rp-4v4-preference-action]');
    const cancel = event.target.closest?.('[data-rp-4v4-preference-cancel]');
    const admin = event.target.closest?.('[data-rp-4v4-team-code-admin]');
    if (!action && !cancel && !admin) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const club = activeClub();

    if (admin) {
      if (!isAdmin()) return;
      admin.disabled = true;
      try {
        const result = await api('/api/real-play/4v4/admin/code', { method: 'POST', body: { club } });
        await loadState({ silent: true });
        openAdminCode(club, result);
      } catch (error) {
        showToast(error.message);
      } finally {
        admin.disabled = false;
      }
      return;
    }

    if (cancel) {
      cancel.disabled = true;
      try {
        state = await api('/api/real-play/4v4/preference', { method: 'DELETE' });
        syncLegacyPreferenceList();
        renderPanel();
        showToast(state?.message || 'You left the forming team.');
      } catch (error) {
        showToast(error.message);
      } finally {
        cancel.disabled = false;
      }
      return;
    }

    if (!token()) {
      showToast('Sign in first, then enter your team code.');
      return;
    }
    const team = getTeamState(club);
    if (team?.status === 'secured') return showToast('This team is already secured by four players.');
    if (state?.joinedClub === club) return showToast(`You are already confirmed on ${CLUB_NAMES[club]}.`);
    if (state?.joinedClub) return showToast(`You are already on ${CLUB_NAMES[state.joinedClub] || 'another team'}. Leave it first.`);
    openJoinDialog(club);
  }

  function panelNeedsRepair(panel) {
    if (!panel) return false;
    const club = activeClub();
    const ui = expectedUi(club);
    return Boolean(
      panel.querySelector('[data-rp-4v4-preference-action]')?.textContent !== ui.actionText ||
      panel.querySelector('.rp-4v4-preference-note')?.textContent !== ui.note ||
      panel.querySelector('[data-rp-4v4-preference-count]')?.textContent !== `${ui.team.memberCount || 0}/4` ||
      (isAdmin() && !panel.querySelector('[data-rp-4v4-team-code-admin]'))
    );
  }

  function bindPanel(panel) {
    if (!panel) return false;
    if (panel === boundPanel) return true;

    viewObserver?.disconnect();
    textObserver?.disconnect();
    if (boundPanel) boundPanel.removeEventListener('click', handlePanelClick, true);

    boundPanel = panel;
    panel.addEventListener('click', handlePanelClick, true);

    const view = panel.closest('[data-rp-4v4-static-view]');
    if (view) {
      viewObserver = new MutationObserver(queueRender);
      viewObserver.observe(view, { attributes: true, attributeFilter: ['data-rp-active-club'] });
    }

    const watched = [
      panel.querySelector('[data-rp-4v4-preference-action]'),
      panel.querySelector('.rp-4v4-preference-note'),
      panel.querySelector('[data-rp-4v4-preference-count]'),
    ].filter(Boolean);
    textObserver = new MutationObserver(() => {
      if (panelNeedsRepair(panel)) queueRender();
    });
    watched.forEach((node) => textObserver.observe(node, { childList: true, characterData: true, subtree: true }));

    renderPanel();
    loadState();
    return true;
  }

  function discoverPanel({ refresh = false } = {}) {
    const panel = document.querySelector('.rp-4v4-preference-panel');
    if (!panel) return false;
    if (panel !== boundPanel) return bindPanel(panel);

    queueRender();
    if (refresh) loadState({ silent: true });
    return true;
  }

  function boot() {
    installStyle();
    discoverPanel();

    // The 4v4 view is created only after the roadmap action is clicked.
    // Listen at window capture (before the existing document capture handler),
    // then bind or refresh after that handler has synchronously opened the view.
    window.addEventListener('click', (event) => {
      if (!event.target?.closest?.('.rp-home-4v4-explore')) return;
      window.setTimeout(() => discoverPanel({ refresh: true }), 0);
    }, true);
  }

  window.addEventListener('realplay:admin-render', queueRender);
  window.addEventListener('focus', () => {
    const view = document.querySelector('[data-rp-4v4-static-view].open');
    if (view && boundPanel) loadState({ silent: true });
  });
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY && boundPanel) loadState({ silent: true });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();