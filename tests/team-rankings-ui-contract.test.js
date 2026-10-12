'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
test('team filters keep official ranking authority', () => {
  assert.match(source, /WINS.*WIN RATE.*POINT DIFF.*TEAM NAME/);
  assert.match(source, /a\.rank - b\.rank/);
  assert.match(source, /team\.rank/);
  assert.doesNotMatch(source, /index \+ 1.*rank/);
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
  assert.match(source, /if \(recordNode\.textContent !== record\)/);
  assert.match(source, /if \(rateNode\.textContent !== rate\)/);
  assert.match(source, /cache: 'no-store'/);
});
