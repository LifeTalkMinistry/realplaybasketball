(() => {
  'use strict';
  if (window.__realPlayTeamRankingsInstalled) return;
  window.__realPlayTeamRankingsInstalled = true;

  const API = 'https://api.clarapmc.com';
  const ART = Object.freeze({
    lions: 'assets/3v3/clubs/lions-logo.png',
    valiant: 'assets/3v3/clubs/valiant-logo.png',
    watchmen: 'assets/3v3/clubs/watchmen-logo.png',
    conquerors: 'assets/3v3/clubs/conquerors-logo.png',
    chosen: 'assets/3v3/clubs/chosen-logo.png',
    eagles: 'assets/3v3/clubs/eagles-logo.png',
    steadfast: 'assets/3v3/clubs/steadfast-logo.png',
    warriors: 'assets/3v3/clubs/warriors-logo.png',
  });
  const esc = value => String(value ?? '').replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const logoFor = team => ART[team?.clubId] || null;
  // Rank is determined by verified wins and tie-breakers on the backend.
  // The teams view intentionally has no alternate filters or sort modes.
  function sortedRows(rows) {
    return [...rows].sort((a, b) =>
      Number(a.rank) - Number(b.rank)
      || String(a.teamId).localeCompare(String(b.teamId)));
  }
  const signature = rows => JSON.stringify(rows.map(row => [
    row.teamId, row.name, row.rank, row.wins, row.losses,
    row.gamesPlayed, row.winRate, row.pointDiff, row.pointsFor, row.pointsAgainst
  ]));

  // Export pure logic for Node regression tests without a browser.
  if (typeof module !== 'undefined') module.exports = { sortedRows, logoFor, signature, ART };

  let active = null;
  function ensureStyle() {
    if (document.querySelector('[data-rp-team-standings-css]')) return;
    const element = document.createElement('style');
    element.dataset.rpTeamStandingsCss = 'true';
    element.textContent = `
      .rp-competition-team-toggle{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:12px 0 4px;padding:3px;border:1px solid rgba(84,219,255,.21);border-radius:11px;background:rgba(4,12,21,.85)}
      .rp-competition-team-toggle button{border:0;border-radius:8px;padding:11px 12px;background:transparent;color:#7e99ae;font:900 .7rem Arial,sans-serif;letter-spacing:.13em;cursor:pointer;transition:background .14s,color .14s}
      .rp-competition-team-toggle button[aria-selected="true"]{background:linear-gradient(125deg,#39c9ee,#168eb8);color:#03131e;box-shadow:0 2px 13px rgba(51,211,255,.17)}
      .rp-competition-team-toggle button:focus-visible{outline:2px solid #79e7ff;outline-offset:2px}
      .rp-world[data-rp-competition-team-view="teams"] [data-world-player-sort],
      .rp-world[data-rp-competition-team-view="teams"] [data-world-player-list],
      .rp-world[data-rp-competition-team-view="teams"] [data-world-player-more]{display:none!important}
      .rp-team-standings[hidden]{display:none!important}
      .rp-team-standings{display:grid;gap:10px;min-width:0;padding-top:10px}
      .rp-team-standings-list{display:grid;gap:8px;min-width:0}
      .rp-team-standings-row{--team-glow:80,181,220;display:grid;grid-template-columns:27px 50px minmax(0,1fr) 126px;gap:8px;align-items:center;box-sizing:border-box;min-height:88px;padding:11px 10px;border:1px solid rgba(var(--team-glow),.20);border-radius:13px;background:linear-gradient(105deg,rgba(var(--team-glow),.095),rgba(4,12,23,.97) 40%,rgba(5,12,22,.97));contain:layout style}
      .rp-team-standings-row[data-rank="1"]{border-color:rgba(90,223,255,.5);box-shadow:inset 3px 0 0 #5adfff,0 3px 17px rgba(26,140,180,.08)}
      .rp-team-standings-row[data-rank="2"]{border-color:rgba(164,194,226,.35)}
      .rp-team-standings-row[data-rank="3"]{border-color:rgba(193,151,108,.31)}
      .rp-team-standings-row[data-club="lions"]{--team-glow:223,155,75}
      .rp-team-standings-row[data-club="valiant"]{--team-glow:77,167,246}
      .rp-team-standings-row[data-club="watchmen"]{--team-glow:151,164,226}
      .rp-team-standings-row[data-club="conquerors"]{--team-glow:226,94,99}
      .rp-team-standings-row[data-club="chosen"]{--team-glow:194,160,92}
      .rp-team-standings-row[data-club="eagles"]{--team-glow:99,177,215}
      .rp-team-standings-row[data-club="steadfast"]{--team-glow:95,191,160}
      .rp-team-standings-row[data-club="warriors"]{--team-glow:183,131,224}
      .rp-team-standings-rank{font:italic 950 1rem Impact,'Arial Narrow',Arial,sans-serif;color:#c0d7e7}
      .rp-team-standings-logo{width:50px;height:50px;display:grid;place-items:center;flex-shrink:0}
      .rp-team-standings-logo img{width:100%;height:100%;object-fit:contain;display:block}
      .rp-team-standings-logo b{display:grid;place-items:center;width:45px;height:45px;border-radius:50%;border:1px solid rgba(99,212,245,.4);background:rgba(30,66,86,.35);font:950 1.1rem Arial;color:#b6e8ff}
      .rp-team-standings-name{min-width:0;overflow-wrap:anywhere;color:#f2f8ff;font:italic 950 clamp(.82rem,3.4vw,1.03rem)/1.2 Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:.035em}
      .rp-team-standings-record{display:block;min-width:0;width:126px;justify-self:end;text-align:center}
      .rp-team-standings-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}
      .rp-team-standings-stat{display:grid;justify-items:center;align-content:center;gap:4px;min-width:0;min-height:49px;padding:5px 2px;border:1px solid rgba(109,181,216,.14);border-radius:9px;background:rgba(5,14,26,.7)}
      .rp-team-standings-stat strong{color:#ebf7ff;font:950 1.06rem/1 Arial,sans-serif;font-variant-numeric:tabular-nums}
      .rp-team-standings-stat small{color:#7398af;font:850 .53rem/1 Arial,sans-serif;letter-spacing:.045em}
      .rp-team-standings-stat[data-result="wins"] strong{color:#8ce9ff}
      .rp-team-standings-stat[data-result="losses"] strong{color:#e8bbba}
      .rp-team-standings-message{padding:35px 12px;text-align:center;color:#8499aa;font:800 .7rem/1.5 Arial,sans-serif}
      @media(max-width:390px){.rp-team-standings-row{grid-template-columns:24px 43px minmax(0,1fr) 110px;gap:6px;min-height:84px;padding:9px 8px}.rp-team-standings-logo{width:43px;height:43px}.rp-team-standings-record{width:110px;gap:6px}.rp-team-standings-record-grid{gap:6px}.rp-team-standings-stat{min-height:44px}.rp-team-standings-stat small{font-size:.49rem}.rp-team-standings-name{font-size:.82rem}}
      @media(max-width:340px){.rp-team-standings-row{grid-template-columns:22px 39px minmax(0,1fr) 104px;gap:5px;padding:8px 6px}.rp-team-standings-logo{width:39px;height:39px}.rp-team-standings-record{width:104px}.rp-team-standings-record-grid{gap:5px}.rp-team-standings-name{font-size:.76rem}}
      @media(prefers-reduced-motion:reduce){.rp-competition-team-toggle button{transition:none}}
    `;
    document.head.appendChild(element);
  }

  function setMode(state, mode) {
    state.mode = mode;
    state.switcher.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.mode === mode));
    });
    const teamsVisible = mode === 'teams';
    state.world.dataset.rpCompetitionTeamView = mode;
    state.host.hidden = !teamsVisible;
    if (teamsVisible) {
      render(state);
      if (!state.loaded) load(state);
    }
  }

  function makeRow(team) {
    const row = document.createElement('article');
    row.className = 'rp-team-standings-row';
    row.dataset.teamId = team.teamId;
    row.dataset.rank = String(team.rank);
    row.dataset.club = team.clubId || '';
    const image = logoFor(team);
    row.innerHTML = `<span class="rp-team-standings-rank">#${esc(team.rank)}</span>
      <span class="rp-team-standings-logo">${image
        ? `<img src="${esc(image)}" alt="${esc(team.name)} team logo" loading="lazy" decoding="async">`
        : `<b aria-label="Team logo unavailable">${esc(String(team.name).charAt(0))}</b>`}</span>
      <strong class="rp-team-standings-name">${esc(team.name)}</strong>
      <span class="rp-team-standings-record" aria-label="Team win and loss record">
        <span class="rp-team-standings-record-grid">
          <span class="rp-team-standings-stat" data-result="wins"><strong data-wins></strong><small>WINS</small></span>
          <span class="rp-team-standings-stat" data-result="losses"><strong data-losses></strong><small>LOSSES</small></span>
        </span>
      </span>`;
    return row;
  }

  function render(state) {
    if (!state.host || state.mode !== 'teams') return;
    const list = state.host.querySelector('[data-rp-team-list]');
    if (!state.loaded) {
      if (!list.children.length) list.textContent = 'LOADING VERIFIED TEAM STANDINGS...';
      list.classList.add('rp-team-standings-message');
      return;
    }
    if (state.error) {
      if (list.textContent !== state.error) list.textContent = state.error;
      list.classList.add('rp-team-standings-message');
      return;
    }
    if (!state.rows.length) {
      if (list.textContent !== 'NO VERIFIED TEAM RESULTS YET.') list.textContent = 'NO VERIFIED TEAM RESULTS YET.';
      list.classList.add('rp-team-standings-message');
      return;
    }
    list.classList.remove('rp-team-standings-message');
    // Remove a loading or empty text node once, but retain all real team rows.
    if (!list.querySelector('[data-team-id]')) list.textContent = '';
    const ordered = sortedRows(state.rows);
    const identifiers = new Set(ordered.map(item => String(item.teamId)));
    list.querySelectorAll('[data-team-id]').forEach(node => {
      if (!identifiers.has(node.dataset.teamId)) node.remove();
    });
    // Preserve existing row + logo nodes on unchanged data and sorting.
    ordered.forEach((team, index) => {
      let row = [...list.children].find(node => node.dataset.teamId === String(team.teamId));
      if (!row) row = makeRow(team);
      if (row.dataset.rank !== String(team.rank) || row.dataset.club !== String(team.clubId || '')) {
        // A team's official rank or identity changed; update only its row.
        const next = makeRow(team);
        row.replaceWith(next);
        row = next;
      }
      const wins = String(number(team.wins));
      const losses = String(number(team.losses));
      const winsNode = row.querySelector('[data-wins]');
      const lossesNode = row.querySelector('[data-losses]');
      if (winsNode.textContent !== wins) winsNode.textContent = wins;
      if (lossesNode.textContent !== losses) lossesNode.textContent = losses;
      if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
    });
  }

  async function load(state) {
    if (state.loading) return;
    state.loading = true;
    const serial = ++state.serial;
    const params = new URLSearchParams({ context: state.config.competitionContext });
    if (state.config.competitionSeasonId) params.set('season_id', String(state.config.competitionSeasonId));
    try {
      const token = localStorage.getItem('real_play_access_token') || '';
      if (!token) throw new Error('Log in to view verified team standings.');
      const response = await fetch(`${API}/api/real-play/competition/team-standings?${params}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Team standings are unavailable.');
      if (active !== state || serial !== state.serial) return;
      const next = Array.isArray(payload.teams) ? payload.teams : [];
      const nextSignature = signature(next);
      if (nextSignature !== state.lastSignature) {
        state.rows = next;
        state.lastSignature = nextSignature;
      }
      state.error = '';
    } catch (error) {
      if (active !== state || serial !== state.serial) return;
      if (!state.loaded) state.error = error.message || 'Unable to load team standings.';
      // A temporary refresh failure should not erase previously verified standings.
    } finally {
      if (active === state && serial === state.serial) {
        state.loaded = true;
        state.loading = false;
        render(state);
      }
    }
  }

  function attach({ world, directory, header, controls, config }) {
    if (!['tune-up', 'league'].some(key => config.id === key || config.id.startsWith('league-season-'))) return;
    ensureStyle();
    if (active?.config !== config) reset();
    if (!active) {
      const switcher = document.createElement('div');
      switcher.className = 'rp-competition-team-toggle';
      switcher.setAttribute('role', 'tablist');
      switcher.setAttribute('aria-label', 'Competition leaderboard type');
      switcher.innerHTML = '<button type="button" role="tab" data-mode="teams" aria-selected="true">TEAM</button><button type="button" role="tab" data-mode="players" aria-selected="false">PLAYERS</button>';
      const host = document.createElement('section');
      host.className = 'rp-team-standings';
      host.hidden = true;
      host.setAttribute('aria-label', 'Official competition team rankings');
      host.innerHTML = '<div class="rp-team-standings-list" data-rp-team-list></div>';
      header.appendChild(switcher);
      directory.insertBefore(host, controls.nextSibling);
      const state = { world, config, switcher, host, mode: 'teams',
        rows: [], loaded: false, loading: false, error: '',
        lastSignature: '', serial: 0, seasonKey: String(config.competitionSeasonId || '') };
      active = state;
      switcher.addEventListener('click', event => {
        const button = event.target.closest('button[data-mode]');
        if (button && active === state) setMode(state, button.dataset.mode);
      });
      setMode(state, 'teams');
    }
    const seasonKey = String(config.competitionSeasonId || '');
    if (active.seasonKey !== seasonKey) {
      active.seasonKey = seasonKey;
      active.loaded = false;
      active.lastSignature = '';
      if (active.mode === 'teams') load(active);
    }
  }

  function reset() {
    if (!active) return;
    active.serial++;
    delete active.world.dataset.rpCompetitionTeamView;
    active.switcher.remove();
    active.host.remove();
    active = null;
  }
  // Refresh on window focus and while the standings are visible. It makes
  // officially finalized score corrections visible without a manual action.
  window.addEventListener('focus', () => {
    if (active?.mode === 'teams') load(active);
  });
  window.setInterval(() => {
    if (active?.mode === 'teams' && !document.hidden) load(active);
  }, 30000);
  window.RealPlayTeamRankings = { attach, reset, refresh: () => active && load(active) };
})();
