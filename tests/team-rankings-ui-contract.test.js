'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'competition-team-rankings.js'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'competition-hub.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'simple-navigation.js'), 'utf8');
const originalPlayerTests = fs.readFileSync(path.join(root, 'tests/tune-up-scoped-player-render-contract.test.js'), 'utf8');

test('team component is lazy loaded after existing Stats feature', () => {
  assert.match(navigation, /loadFeatureScript\(\s*'competition-team-rankings.js'/);
  assert.match(hub, /RealPlayTeamRankings\?\.attach/);
  assert.match(hub, /RealPlayTeamRankings\?\.reset/);
  assert.match(source, /data-mode="teams" aria-selected="true">TEAM<\/button>.*data-mode="players" aria-selected="false">PLAYERS<\/button>/);
  assert.match(source, /const state = \{ world, config, switcher, host, mode: 'teams'/);
  assert.match(source, /setMode\(state, 'teams'\)/);
});
test('team view hides players without rebuilding player list or changing scroll', () => {
  assert.match(source, /data-rp-competition-team-view="teams"/);
  assert.match(source, /data-world-player-list/);
  assert.match(source, /if \(list\.children\[index\] !== row\)/);
  assert.doesNotMatch(source, /scrollTop\s*=/);
  assert.match(originalPlayerTests, /scoped rows must survive/);
});
test('Teams removes the filter strip and always uses official ranking order', () => {
  assert.doesNotMatch(source, /data-rp-team-filter|rp-team-standings-filters|Sort team statistics/);
  assert.doesNotMatch(source, /state\.filter|const MODES/);
  assert.match(source, /Number\(a\.rank\) - Number\(b\.rank\)/);
  assert.match(source, /sortedRows\(state\.rows\)/);
  assert.match(source, /team\.rank/);
  assert.doesNotMatch(source, /index \+ 1.*rank/);
  assert.match(source, /host\.innerHTML = `<div class="rp-team-standings-list" data-rp-team-list><\/div>/);
  assert.match(source, /data-rp-team-roster-detail hidden/);
  assert.match(source, /data-rp-team-roster-back/);
  assert.match(source, /data-world-player-sort/);
});
test('logos link to the eight official team images, not generated replacements', () => {
  for (const club of ['lions','valiant','watchmen','conquerors','chosen','eagles','steadfast','warriors']) {
    assert.ok(source.includes(`assets/3v3/clubs/${club}-logo.png`));
  }
  assert.match(source, /object-fit:contain/);
  assert.match(source, /loading="lazy"/);
});
test('team evidence refresh does not recreate unchanged rows', () => {
  assert.match(source, /nextSignature !== state\.lastSignature/);
  assert.match(source, /if \(winsNode\.textContent !== wins\)/);
  assert.match(source, /if \(lossesNode\.textContent !== losses\)/);
  assert.doesNotMatch(source, /data-win-rate|rp-team-standings-win-rate|rateNode/);
  assert.match(source, /cache: 'no-store'/);
});

test('Team ordering remains official rank even when win rates or names differ', () => {
  const begin = source.indexOf('  function sortedRows(rows) {');
  const end = source.indexOf('  const signature = rows =>', begin);
  assert.ok(begin >= 0 && end > begin);
  const sortedRows = vm.runInNewContext(
    source.slice(begin, end) + '\n sortedRows',
    { Number, String }
  );
  const teams = [
    { teamId: 'chosen', rank: 4, wins: 0, winRate: 100, name: 'CHOSEN' },
    { teamId: 'conquerors', rank: 1, wins: 3, winRate: 75, name: 'CONQUERORS' },
    { teamId: 'valiant', rank: 2, wins: 3, winRate: 60, name: 'VALIANT' },
  ];
  assert.deepEqual(Array.from(sortedRows(teams), x => x.teamId),
    ['conquerors', 'valiant', 'chosen']);
  assert.equal(teams[0].teamId, 'chosen', 'input team records remain untouched');
});

test('TEAM defaults to visible standings and PLAYERS restores the original leaderboard', () => {
  const start = source.indexOf('  function setMode(state, mode) {');
  const end = source.indexOf('  function makeRow(team) {', start);
  assert.ok(start >= 0 && end > start, 'standings switcher function exists');

  const teamTab = {
    dataset: { mode: 'teams' },
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
  };
  const playersTab = {
    dataset: { mode: 'players' },
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
  };
  const state = {
    mode: 'teams',
    world: { dataset: {} },
    host: { hidden: true },
    switcher: { querySelectorAll: () => [teamTab, playersTab] },
    loaded: true,
  };
  let renders = 0;
  const setMode = vm.runInNewContext(
    source.slice(start, end) + '\nsetMode', {
      render: () => { renders += 1; },
      closeRoster: () => {},
      load: () => { throw Error('Loaded tabs must not reload on switch'); },
    }
  );
  setMode(state, 'teams');
  assert.equal(state.world.dataset.rpCompetitionTeamView, 'teams');
  assert.equal(state.host.hidden, false);
  assert.equal(teamTab.attributes['aria-selected'], 'true');
  assert.equal(playersTab.attributes['aria-selected'], 'false');

  setMode(state, 'players');
  assert.equal(state.world.dataset.rpCompetitionTeamView, 'players');
  assert.equal(state.host.hidden, true);
  assert.equal(teamTab.attributes['aria-selected'], 'false');
  assert.equal(playersTab.attributes['aria-selected'], 'true');
  assert.equal(renders, 1);
  assert.match(source, /data-world-player-sort/);
});
