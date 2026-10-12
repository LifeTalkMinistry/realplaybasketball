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
  assert.match(source, /PLAYERS<\/button>.*TEAMS<\/button>/);
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
  assert.match(source, /host\.innerHTML = '<div class="rp-team-standings-list" data-rp-team-list><\/div>'/);
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
  assert.match(source, /if \(rateNode\.textContent !== rate\)/);
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
