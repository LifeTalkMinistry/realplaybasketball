(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  let formOpen = false;
  let lastSessionTitle = '';
  let openedAgainstTitle = null;
  let playerFormOpen = false;
  let playerFormBusy = false;
  let playerNotice = '';
  let playerNoticeType = '';

  function nextTitle(title) {
    const match = String(title || '').match(/#\s*(\d+)/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `BETA CAREER SESSION #${String(next).padStart(3, '0')}`;
  }

  function shortTitle(title) {
    const match = String(title || '').match(/#\s*(\d+)/);
    return match ? `CAREER #${match[1].padStart(3, '0')}` : 'CAREER SESSION';
  }

  function valueAfterDot(text) {
    const value = String(text || '').trim();
    const index = value.indexOf('·');
    return index >= 0 ? value.slice(index + 1).trim() : value;
  }

  function ensurePlayerStyles() {
    if (document.querySelector('[data-admin-manual-player-styles]')) return;
    const style = document.createElement('style');
    style.dataset.adminManualPlayerStyles = '1';
    style.textContent = `
      .rp-admin-manual-player-wrap{margin:0 0 14px;display:grid;gap:10px}
      .rp-admin-manual-player-toggle{width:100%;min-height:48px;border:1px solid rgba(32,218,255,.42);border-radius:14px;background:rgba(8,34,48,.72);color:#eafbff;font:800 12px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;touch-action:manipulation}
      .rp-admin-manual-player-toggle:disabled{opacity:.5}
      .rp-admin-manual-player-form{display:grid;gap:10px;padding:14px;border:1px solid rgba(118,164,190,.24);border-radius:14px;background:rgba(5,14,24,.86)}
      .rp-admin-manual-player-form[hidden]{display:none}
      .rp-admin-manual-player-form label{display:grid;gap:7px;color:#8fb9cf;font:700 10px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      .rp-admin-manual-player-form input{width:100%;min-height:46px;box-sizing:border-box;border:1px solid rgba(118,164,190,.28);border-radius:12px;background:#07111c;color:#fff;padding:0 13px;font:700 16px/1 system-ui,sans-serif;outline:none;touch-action:manipulation;-webkit-user-select:text;user-select:text}
      .rp-admin-manual-player-form input:focus{border-color:rgba(32,218,255,.72)}
      .rp-admin-manual-player-submit{min-height:46px;border:0;border-radius:12px;background:#16d9f4;color:#011017;font:900 11px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;touch-action:manipulation}
      .rp-admin-manual-player-submit:disabled{opacity:.55}
      .rp-admin-manual-player-note{margin:0;color:#7fa6bb;font:600 11px/1.45 system-ui,sans-serif}
      .rp-admin-manual-player-status{margin:0;color:#93bdd2;font:700 11px/1.4 system-ui,sans-serif}
      .rp-admin-manual-player-status:empty{display:none}
      .rp-admin-manual-player-status.error{color:#ff9b9b}
      .rp-admin-unclaimed-badge{display:inline-flex;align-items:center;width:max-content;margin-top:4px;padding:3px 6px;border:1px solid rgba(32,218,255,.34);border-radius:999px;color:#54e8ff;font:800 8px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
    `;
    document.head.appendChild(style);
  }

  function syncPlayerForm(wrap) {
    if (!wrap) return;
    const toggle = wrap.querySelector('[data-admin-manual-player-toggle]');
    const form = wrap.querySelector('[data-admin-manual-player-form]');
    const input = form?.querySelector('input[name="playerName"]');
    const submit = form?.querySelector('[data-admin-manual-player-submit]');
    const status = form?.querySelector('[data-admin-manual-player-status]');

    if (toggle) {
      toggle.textContent = playerFormOpen ? '− CLOSE' : '+ ADD PLAYER';
      toggle.disabled = playerFormBusy;
    }
    if (form) form.hidden = !playerFormOpen;
    if (input) input.disabled = playerFormBusy;
    if (submit) {
      submit.disabled = playerFormBusy;
      submit.textContent = playerFormBusy ? 'ADDING...' : 'ADD & CHECK IN';
    }
    if (status) {
      status.textContent = playerNotice;
      status.classList.toggle('error', playerNoticeType === 'error');
    }
  }

  function mountPlayerForm(body, list) {
    let wrap = body.querySelector('[data-admin-manual-player-wrap]');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.className = 'rp-admin-manual-player-wrap';
    wrap.dataset.adminManualPlayerWrap = '1';
    wrap.innerHTML = `
      <button type="button" class="rp-admin-manual-player-toggle" data-admin-manual-player-toggle>+ ADD PLAYER</button>
      <form class="rp-admin-manual-player-form" data-admin-manual-player-form hidden>
        <label>Player name
          <input name="playerName" type="text" minlength="2" maxlength="60" autocomplete="name" autocapitalize="words" enterkeyhint="done" inputmode="text" placeholder="Enter player name" required>
        </label>
        <button type="submit" class="rp-admin-manual-player-submit" data-admin-manual-player-submit>ADD & CHECK IN</button>
        <p class="rp-admin-manual-player-note">No account needed. Real Play saves this as an unclaimed player identity so the career can be claimed later.</p>
        <p class="rp-admin-manual-player-status" data-admin-manual-player-status aria-live="polite"></p>
      </form>`;
    list.before(wrap);

    const toggle = wrap.querySelector('[data-admin-manual-player-toggle]');
    const form = wrap.querySelector('[data-admin-manual-player-form]');
    const input = form?.querySelector('input[name="playerName"]');

    toggle?.addEventListener('click', () => {
      playerFormOpen = !playerFormOpen;
      if (playerFormOpen) {
        playerNotice = '';
        playerNoticeType = '';
      }
      syncPlayerForm(wrap);
      if (playerFormOpen) {
        window.requestAnimationFrame(() => input?.focus({ preventScroll: false }));
      }
    });

    input?.addEventListener('pointerdown', () => {
      // Keep the same input node alive. Mobile browsers will only open the
      // software keyboard reliably when focus remains on the tapped element.
      if (!playerFormOpen) {
        playerFormOpen = true;
        syncPlayerForm(wrap);
      }
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const playerName = String(input?.value || '').trim().replace(/\s+/g, ' ');
      if (playerName.length < 2) {
        playerNotice = 'Enter at least 2 characters.';
        playerNoticeType = 'error';
        syncPlayerForm(wrap);
        input?.focus();
        return;
      }
      addPlayer(playerName, wrap);
    });

    syncPlayerForm(wrap);
    return wrap;
  }

  async function addPlayer(playerName, wrap) {
    if (playerFormBusy) return;
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      playerNotice = 'Admin session is not available. Log in again.';
      playerNoticeType = 'error';
      syncPlayerForm(wrap);
      return;
    }

    playerFormBusy = true;
    playerNotice = '';
    playerNoticeType = '';
    syncPlayerForm(wrap);

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'add-player', playerName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);

      playerNotice = `${playerName} added and checked in.`;
      playerNoticeType = 'success';
      playerFormOpen = false;
      const input = wrap?.querySelector('input[name="playerName"]');
      if (input) input.value = '';
    } catch (error) {
      playerNotice = error.message || 'Player could not be added.';
      playerNoticeType = 'error';
      playerFormOpen = true;
    } finally {
      playerFormBusy = false;
      syncPlayerForm(wrap);
    }
  }

  function applyPlayers(root) {
    if (root.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'players') return;
    const body = root.querySelector('[data-admin-body]');
    if (!body) return;

    ensurePlayerStyles();

    const emptyCopy = body.querySelector('.rp-admin-empty p');
    if (emptyCopy?.textContent.includes('As testers tap PLAY')) {
      emptyCopy.textContent = 'Add a player here or wait for registered players to join.';
    }

    body.querySelectorAll('.rp-admin-player').forEach((card) => {
      const id = Number(card.querySelector('[data-user-id]')?.dataset.userId);
      if (!Number.isFinite(id) || id >= 0) return;
      const name = card.querySelector('.rp-admin-player-name');
      if (!name || name.querySelector('.rp-admin-unclaimed-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'rp-admin-unclaimed-badge';
      badge.textContent = 'UNCLAIMED';
      const small = name.querySelector('small');
      if (small) name.insertBefore(badge, small);
      else name.appendChild(badge);
    });

    const list = body.querySelector('.rp-admin-player-list');
    const pageTitle = [...body.querySelectorAll('.rp-admin-title')].find((item) => item.querySelector('h1')?.textContent.trim() === "WHO'S PLAYING?");
    if (!list || !pageTitle) return;

    const locked = body.textContent.includes('Attendance and teams are locked because this game has already started.');
    let wrap = body.querySelector('[data-admin-manual-player-wrap]');
    if (locked) {
      if (wrap) wrap.remove();
      playerFormOpen = false;
      return;
    }

    wrap = mountPlayerForm(body, list);
    syncPlayerForm(wrap);
  }

  function applySession(root) {
    if (root.querySelector('.rp-admin-tab.active')?.dataset.adminTab !== 'session') return;

    const body = root.querySelector('[data-admin-body]');
    if (!body) return;

    const pageTitle = [...body.querySelectorAll('.rp-admin-title')].find((item) => item.querySelector('h1')?.textContent.trim() === 'SESSION CONTROL');
    if (pageTitle) pageTitle.remove();

    const form = body.querySelector('[data-new-session-form]');
    const formCard = form?.closest('.rp-admin-card');
    const sessionCard = [...body.querySelectorAll('.rp-admin-card')].find((card) => card !== formCard && !card.classList.contains('soft'));

    let sessionTitle = '';
    if (sessionCard) {
      const heading = sessionCard.querySelector('.rp-admin-card-head strong');
      sessionTitle = sessionCard.dataset.originalTitle || heading?.textContent.trim() || '';
      sessionCard.dataset.originalTitle = sessionTitle;
      lastSessionTitle = sessionTitle;

      if (!sessionCard.dataset.compact) {
        const meta = [...sessionCard.querySelectorAll('.rp-admin-meta span')];
        let when = valueAfterDot(meta[0]?.textContent);
        let where = valueAfterDot(meta[1]?.textContent);
        const capacity = valueAfterDot(meta[2]?.textContent);
        const confirmed = sessionCard.querySelector('.rp-admin-count strong')?.textContent.trim() || '0';
        if (when === 'TIME TO BE ANNOUNCED') when = 'Not set';
        if (where === 'COURT TO BE ANNOUNCED') where = 'Not set';
        const players = String(capacity).toUpperCase() === 'OPEN' ? `${confirmed} confirmed` : `${confirmed} / ${capacity} confirmed`;

        if (heading) heading.textContent = shortTitle(sessionTitle);
        const metaBox = sessionCard.querySelector('.rp-admin-meta');
        if (metaBox) metaBox.innerHTML = `<span><b>DATE</b><em>${when}</em></span><span><b>COURT</b><em>${where}</em></span><span><b>PLAYERS</b><em>${players}</em></span>`;
        sessionCard.querySelector('.rp-admin-count')?.remove();
        sessionCard.classList.add('rp-admin-session-summary');
        sessionCard.dataset.compact = '1';
      }
    } else {
      lastSessionTitle = '';
    }

    if (formOpen && openedAgainstTitle !== null && sessionTitle !== openedAgainstTitle) {
      formOpen = false;
      openedAgainstTitle = null;
    }

    if (!form || !formCard) return;

    const titleInput = form.querySelector('input[name="title"]');
    if (titleInput) {
      titleInput.value = nextTitle(sessionTitle || lastSessionTitle);
      titleInput.closest('label')?.classList.add('rp-admin-hidden-field');
    }

    const locationInput = form.querySelector('input[name="locationName"]');
    const dateInput = form.querySelector('input[name="startsAt"]');
    const capacityInput = form.querySelector('input[name="capacity"]');
    if (locationInput?.closest('label')?.firstChild) locationInput.closest('label').firstChild.nodeValue = 'Court';
    if (dateInput?.closest('label')?.firstChild) dateInput.closest('label').firstChild.nodeValue = 'Date & time';
    if (capacityInput?.closest('label')?.firstChild) capacityInput.closest('label').firstChild.nodeValue = 'Capacity';

    formCard.classList.add('rp-admin-new-session-card');
    formCard.hidden = !formOpen;
    const formHeading = formCard.querySelector('.rp-admin-card-head strong');
    if (formHeading && formHeading.textContent !== 'NEW SESSION') formHeading.textContent = 'NEW SESSION';

    let toggle = body.querySelector('[data-admin-new-session-toggle]');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'rp-admin-new-session-toggle';
      toggle.dataset.adminNewSessionToggle = '1';
      formCard.before(toggle);
      toggle.onclick = () => {
        formOpen = !formOpen;
        openedAgainstTitle = formOpen ? sessionTitle : null;
        apply();
      };
    }

    const toggleText = formOpen ? '− CLOSE NEW SESSION' : (sessionTitle ? '+ OPEN NEXT SESSION' : '+ OPEN SESSION');
    if (toggle.textContent !== toggleText) toggle.textContent = toggleText;
    toggle.classList.toggle('open', formOpen);
  }

  function apply() {
    const root = document.querySelector('.rp-admin-control');
    if (!root) return;

    const setupTab = root.querySelector('[data-admin-tab="session"]');
    if (setupTab && setupTab.textContent !== 'SETUP') setupTab.textContent = 'SETUP';

    applyPlayers(root);
    applySession(root);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
})();
