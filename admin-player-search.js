(() => {
  if (window.__realPlayAdminPlayerSearchInstalled) return;
  window.__realPlayAdminPlayerSearchInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const MIN_QUERY = 2;
  const MAX_RESULTS = 6;
  const DIRECTORY_TTL_MS = 30_000;

  let directory = [];
  let directoryLoadedAt = 0;
  let directoryPromise = null;
  const states = new WeakMap();

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]).join('') || 'RP').toUpperCase();
  }

  async function api(path, options = {}) {
    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) throw new Error('Admin session is not available. Log in again.');
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

  async function loadDirectory(force = false) {
    if (!force && directory.length && Date.now() - directoryLoadedAt < DIRECTORY_TTL_MS) return directory;
    if (directoryPromise) return directoryPromise;

    directoryPromise = api('/api/real-play/admin/3v3/players')
      .then((data) => {
        directory = (Array.isArray(data?.players) ? data.players : [])
          .map((player) => ({
            userId: Number(player?.userId),
            playerName: String(player?.playerName || '').trim(),
            email: String(player?.email || '').trim(),
          }))
          .filter((player) => Number.isSafeInteger(player.userId) && player.userId > 0 && player.playerName);
        directoryLoadedAt = Date.now();
        return directory;
      })
      .finally(() => { directoryPromise = null; });

    return directoryPromise;
  }

  function rankMatch(player, query) {
    const q = query.toLowerCase();
    const name = player.playerName.toLowerCase();
    const email = player.email.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (email === q) return 2;
    if (email.startsWith(q)) return 3;
    if (name.includes(q)) return 4;
    if (email.includes(q)) return 5;
    return 99;
  }

  function matchesFor(query) {
    const clean = String(query || '').trim();
    if (clean.length < MIN_QUERY) return [];
    return directory
      .map((player) => ({ player, score: rankMatch(player, clean) }))
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.player.playerName.localeCompare(b.player.playerName))
      .slice(0, MAX_RESULTS)
      .map((item) => item.player);
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-admin-player-search-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpAdminPlayerSearchStyles = '1';
    style.textContent = `
      .rp-admin-player-search-help{margin:0;color:#6f9bb2;font:600 10px/1.4 system-ui,sans-serif;text-transform:none;letter-spacing:0}
      .rp-admin-player-suggestions{display:grid;gap:7px}.rp-admin-player-suggestions[hidden]{display:none}
      .rp-admin-player-suggestion,.rp-admin-player-selected{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid rgba(118,164,190,.24);border-radius:12px;background:#081723;color:#eafcff;text-align:left}
      .rp-admin-player-suggestion:hover,.rp-admin-player-suggestion:focus{border-color:rgba(32,218,255,.62);outline:none;background:#0a2130}
      .rp-admin-player-selected{border-color:rgba(32,218,255,.52);background:rgba(5,34,46,.82)}.rp-admin-player-selected[hidden]{display:none}
      .rp-admin-player-avatar{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(32,218,255,.11);border:1px solid rgba(32,218,255,.22);color:#52e8ff;font:900 11px/1 system-ui,sans-serif}
      .rp-admin-player-copy{min-width:0;display:grid;gap:3px}.rp-admin-player-copy strong,.rp-admin-player-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rp-admin-player-copy strong{color:#fff;font:900 12px/1.1 system-ui,sans-serif}.rp-admin-player-copy small{color:#7fa6bb;font:650 9px/1.2 system-ui,sans-serif;text-transform:none;letter-spacing:0}
      .rp-admin-player-tag{color:#49e6ff;font:900 8px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
      .rp-admin-player-change{min-height:30px;padding:0 9px;border:1px solid rgba(118,164,190,.24);border-radius:9px;background:#07131e;color:#9fc0d0;font:850 8px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      .rp-admin-player-search-empty{padding:9px 10px;border:1px dashed rgba(118,164,190,.24);border-radius:11px;color:#7fa6bb;font:650 10px/1.4 system-ui,sans-serif}.rp-admin-player-search-empty strong{color:#dff8ff}
      .rp-admin-player-search-loading{color:#67dff1;font:800 9px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
    `;
    document.head.appendChild(style);
  }

  function stateFor(form) {
    if (!states.has(form)) {
      states.set(form, {
        selected: null,
        matches: [],
        loading: false,
        searched: false,
        error: '',
        sessionStarted: null,
        timer: null,
      });
    }
    return states.get(form);
  }

  function refs(form) {
    return {
      input: form.querySelector('input[name="playerName"]'),
      submit: form.querySelector('[data-admin-manual-player-submit]'),
      note: form.querySelector('.rp-admin-manual-player-note'),
      status: form.querySelector('[data-admin-manual-player-status]'),
      suggestions: form.querySelector('[data-rp-admin-player-suggestions]'),
      selectedBox: form.querySelector('[data-rp-admin-player-selected]'),
      help: form.querySelector('[data-rp-admin-player-search-help]'),
    };
  }

  function render(form) {
    const state = stateFor(form);
    const { input, submit, note, suggestions, selectedBox, help } = refs(form);
    if (!input || !submit || !note || !suggestions || !selectedBox) return;
    const query = input.value.trim();

    if (help) help.textContent = state.selected
      ? 'Existing Real Play account selected.'
      : 'Type a player name or email. Matching accounts appear automatically.';

    if (state.selected) {
      suggestions.hidden = true;
      selectedBox.hidden = false;
      selectedBox.innerHTML = `
        <span class="rp-admin-player-avatar">${esc(initials(state.selected.playerName))}</span>
        <span class="rp-admin-player-copy"><strong>${esc(state.selected.playerName)}</strong><small>${esc(state.selected.email || 'REAL PLAY ACCOUNT')}</small></span>
        <button type="button" class="rp-admin-player-change" data-rp-admin-player-clear>CHANGE</button>`;
      note.textContent = 'This check-in attaches directly to the selected Real Play account and its official history.';
      submit.textContent = state.sessionStarted === false ? 'START SESSION FIRST' : 'ADD & CHECK IN';
      submit.disabled = state.sessionStarted === false;
      return;
    }

    selectedBox.hidden = true;
    selectedBox.innerHTML = '';

    if (query.length < MIN_QUERY) {
      suggestions.hidden = true;
      suggestions.innerHTML = '';
      note.textContent = 'Search existing Real Play accounts first. If no account is found, you can add an unclaimed player.';
      submit.textContent = 'SEARCH PLAYER';
      submit.disabled = true;
      return;
    }

    suggestions.hidden = false;
    if (state.loading) {
      suggestions.innerHTML = '<div class="rp-admin-player-search-loading">SEARCHING REAL PLAY…</div>';
      submit.textContent = 'SEARCHING…';
      submit.disabled = true;
      return;
    }

    if (state.error) {
      suggestions.innerHTML = `<div class="rp-admin-player-search-empty">${esc(state.error)}</div>`;
      note.textContent = 'Player search is temporarily unavailable. Try again before creating an unclaimed player.';
      submit.textContent = 'SEARCH PLAYER';
      submit.disabled = true;
      return;
    }

    if (state.matches.length) {
      suggestions.innerHTML = state.matches.map((player) => `
        <button type="button" class="rp-admin-player-suggestion" data-rp-admin-player-result="${player.userId}">
          <span class="rp-admin-player-avatar">${esc(initials(player.playerName))}</span>
          <span class="rp-admin-player-copy"><strong>${esc(player.playerName)}</strong><small>${esc(player.email || 'REAL PLAY ACCOUNT')}</small></span>
          <span class="rp-admin-player-tag">SELECT</span>
        </button>`).join('');
      note.textContent = 'Select the correct account below. The selected account ID is used for check-in, so duplicate names are safe.';
      submit.textContent = 'SELECT A PLAYER';
      submit.disabled = true;
      return;
    }

    if (state.searched) {
      suggestions.innerHTML = `<div class="rp-admin-player-search-empty"><strong>NO ACCOUNT FOUND.</strong><br>You can add “${esc(query)}” as an unclaimed player.</div>`;
      note.textContent = 'No matching Real Play account was found. This fallback creates an unclaimed identity that can be claimed later.';
      submit.textContent = state.sessionStarted === false ? 'START SESSION FIRST' : 'ADD AS UNCLAIMED & CHECK IN';
      submit.disabled = state.sessionStarted === false;
      return;
    }

    submit.textContent = 'SEARCH PLAYER';
    submit.disabled = true;
  }

  async function refreshSession(form) {
    const state = stateFor(form);
    try {
      const data = await api('/api/real-play/admin/career/control');
      state.sessionStarted = Boolean(data?.control?.session?.sessionStarted);
    } catch (_error) {
      state.sessionStarted = null;
    }
    render(form);
  }

  async function search(form) {
    const state = stateFor(form);
    const { input } = refs(form);
    if (!input) return;
    const query = input.value.trim();

    state.selected = null;
    state.matches = [];
    state.searched = false;
    state.error = '';

    if (query.length < MIN_QUERY) {
      state.loading = false;
      render(form);
      return;
    }

    state.loading = true;
    render(form);
    try {
      await loadDirectory();
      if (!input.isConnected || input.value.trim() !== query) return;
      state.matches = matchesFor(query);
      state.searched = true;
    } catch (error) {
      state.error = error.message || 'Unable to search Real Play accounts.';
    } finally {
      state.loading = false;
      if (input.isConnected && input.value.trim() === query) render(form);
    }
  }

  function scheduleSearch(form) {
    const state = stateFor(form);
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => search(form), 160);
  }

  async function submitPlayer(form) {
    const state = stateFor(form);
    const { input, submit, status } = refs(form);
    const playerName = String(state.selected?.playerName || input?.value || '').trim().replace(/\s+/g, ' ');
    if (playerName.length < MIN_QUERY) return;

    if (!state.selected && state.matches.length) {
      if (status) {
        status.textContent = 'Select the correct existing Real Play account first.';
        status.classList.add('error');
      }
      return;
    }
    if (state.sessionStarted === false) {
      if (status) {
        status.textContent = 'Start the session first, then check this player in.';
        status.classList.add('error');
      }
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'ADDING…';
    }
    if (input) input.disabled = true;
    if (status) {
      status.textContent = '';
      status.classList.remove('error');
    }

    try {
      await api('/api/real-play/admin/career/control', {
        method: 'POST',
        body: state.selected
          ? { action: 'add-player', userId: state.selected.userId, playerName: state.selected.playerName }
          : { action: 'add-player', playerName },
      });

      directory = [];
      directoryLoadedAt = 0;
      if (status) {
        status.textContent = state.selected
          ? `${playerName} checked in using the existing Real Play account.`
          : `${playerName} added as an unclaimed player and checked in.`;
        status.classList.remove('error');
      }

      state.selected = null;
      state.matches = [];
      state.searched = false;
      if (input) input.value = '';
      await window.__realPlayRefreshAdminGameControl?.();
      window.dispatchEvent(new Event('focus'));
    } catch (error) {
      if (status) {
        status.textContent = error.message || 'Player could not be checked in.';
        status.classList.add('error');
      }
      if (input) input.disabled = false;
      render(form);
    }
  }

  function upgrade(form) {
    if (!form || form.dataset.rpPlayerSearchReady === '1') return;
    const input = form.querySelector('input[name="playerName"]');
    const label = input?.closest('label');
    if (!input || !label) return;

    ensureStyles();
    form.dataset.rpPlayerSearchReady = '1';
    if (label.firstChild) label.firstChild.nodeValue = 'Search Real Play player ';
    input.placeholder = 'Type player name or email';
    input.autocomplete = 'off';
    input.enterKeyHint = 'search';

    const help = document.createElement('p');
    help.className = 'rp-admin-player-search-help';
    help.dataset.rpAdminPlayerSearchHelp = '1';
    label.appendChild(help);

    const selectedBox = document.createElement('div');
    selectedBox.className = 'rp-admin-player-selected';
    selectedBox.dataset.rpAdminPlayerSelected = '1';
    selectedBox.hidden = true;
    label.after(selectedBox);

    const suggestions = document.createElement('div');
    suggestions.className = 'rp-admin-player-suggestions';
    suggestions.dataset.rpAdminPlayerSuggestions = '1';
    suggestions.hidden = true;
    selectedBox.after(suggestions);

    input.addEventListener('input', () => {
      const state = stateFor(form);
      state.selected = null;
      state.error = '';
      scheduleSearch(form);
      render(form);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= MIN_QUERY) scheduleSearch(form);
      else loadDirectory().catch(() => {});
    });

    form.addEventListener('click', (event) => {
      const result = event.target.closest('[data-rp-admin-player-result]');
      if (result) {
        const state = stateFor(form);
        const player = state.matches.find((item) => item.userId === Number(result.dataset.rpAdminPlayerResult));
        if (!player) return;
        state.selected = player;
        input.value = player.playerName;
        render(form);
        return;
      }

      if (event.target.closest('[data-rp-admin-player-clear]')) {
        const state = stateFor(form);
        state.selected = null;
        input.focus();
        scheduleSearch(form);
        render(form);
      }
    });

    render(form);
    refreshSession(form);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-admin-manual-player-form]');
    if (!form || form.dataset.rpPlayerSearchReady !== '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitPlayer(form);
  }, true);

  function scan() {
    document.querySelectorAll('[data-admin-manual-player-form]').forEach(upgrade);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
