'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../competition-team-rankings.js'), 'utf8');

function harness(fetcher) {
  const begin = source.indexOf('  function closeRoster(state, restoreFocus = false) {');
  const end = source.indexOf('  function setMode(state, mode) {', begin);
  assert.ok(begin >= 0 && end > begin, 'Roster implementation is present');
  const card = {
    dataset: { teamId: 'conquerors' },
    focus({ preventScroll }) {
      assert.equal(preventScroll, true);
      list.focused = true;
    },
  };
  const list = {
    hidden: false,
    children: [card],
    querySelectorAll: () => [card],
  };
  const title = { textContent: '' };
  let rosterWrites = 0;
  const roster = {
    value: '',
    classList: { add() {}, remove() {} },
    get innerHTML() { return this.value; },
    set innerHTML(value) { this.value = value; rosterWrites++; },
    get textContent() { return this.value; },
    set textContent(value) { this.value = value; rosterWrites++; },
  };
  const detail = {
    hidden: true,
    querySelector: key => key === '[data-rp-team-roster-title]' ? title :
      key === '[data-rp-team-roster-list]' ? roster : null,
  };
  const state = {
    mode: 'teams',
    config: { competitionContext: 'open_ranking', competitionSeasonId: 26 },
    rows: [{ teamId: 'conquerors', name: 'CONQUERORS', rank: 1 }],
    rosterTeamId: null, rosterSerial: 0,
    host: { querySelector: key => key === '[data-rp-team-list]' ? list : detail },
  };
  const functions = vm.runInNewContext('let active = null;\n' +
    source.slice(begin, end) +
    '\n({ openRoster, closeRoster, rosterMarkup, setActive: value => { active = value; } })', {
    API: 'https://api.clarapmc.com',
    fetch: fetcher,
    URLSearchParams,
    localStorage: { getItem: () => 'verified-session-token' },
    esc: value => String(value ?? '').replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  });
  functions.setActive(state);
  return { ...functions, state, list, detail, roster, title, writes: () => rosterWrites };
}

test('team click loads only the exact season roster, displaying names and competition rank', async () => {
  const requests = [];
  const f = harness(async (url, args) => {
    requests.push({ url, args });
    return { ok: true, json: async () => ({ ok: true, players: [
      { identityKey: 'user:7', playerName: 'Player Seven', rank: 7 },
      { identityKey: 'manual:2', playerName: '<Other Player>', rank: null },
    ] }) };
  });
  const card = f.list.querySelectorAll()[0];
  await f.openRoster(f.state, 'conquerors');
  assert.equal(f.list.hidden, true);
  assert.equal(f.detail.hidden, false);
  assert.equal(f.title.textContent, 'CONQUERORS');
  assert.match(f.roster.innerHTML, /#7/);
  assert.match(f.roster.innerHTML, /Player Seven/);
  assert.match(f.roster.innerHTML, /UNRANKED/);
  assert.match(f.roster.innerHTML, /&lt;Other Player&gt;/);
  assert.doesNotMatch(f.roster.innerHTML, /WINS|LOSSES|WIN RATE|OVR|JERSEY/);
  assert.equal(requests.length, 1);
  const requested = new URL(requests[0].url);
  assert.equal(requested.searchParams.get('context'), 'open_ranking');
  assert.equal(requested.searchParams.get('season_id'), '26');
  assert.equal(requested.searchParams.get('team_id'), 'conquerors');
  assert.match(requests[0].args.headers.Authorization, /^Bearer /);
  f.closeRoster(f.state, true);
  assert.equal(f.list.hidden, false);
  assert.equal(f.detail.hidden, true);
  assert.equal(f.list.focused, true);
  assert.strictEqual(f.list.querySelectorAll()[0], card);
});

test('late responses do not reopen closed roster or change the hidden list', async () => {
  let reply;
  const f = harness(() => new Promise(resolve => { reply = resolve; }));
  const pending = f.openRoster(f.state, 'conquerors');
  const writes = f.writes();
  f.closeRoster(f.state);
  reply({ ok: true, json: async () => ({ ok: true, players: [
    { playerName: 'Stale Player', rank: 1 },
  ] }) });
  await pending;
  assert.equal(f.list.hidden, false);
  assert.equal(f.detail.hidden, true);
  assert.equal(f.writes(), writes);
  assert.doesNotMatch(f.roster.innerHTML, /Stale Player/);
});

test('cards provide pointer and keyboard activation without changing player filters', () => {
  assert.match(source, /row\.setAttribute\('role', 'button'\)/);
  assert.match(source, /row\.tabIndex = 0/);
  assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(source, /row\.dataset\.teamId/);
  assert.match(source, /data-rp-team-roster-back/);
  assert.match(source, /closeRoster\(state\)/);
  assert.match(source, /data-world-player-sort/);
  assert.doesNotMatch(source, /scrollTop\s*=/);
});
