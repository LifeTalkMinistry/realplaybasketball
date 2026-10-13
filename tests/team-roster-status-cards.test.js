'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../competition-team-rankings.js'), 'utf8');
const ART = Object.fromEntries(['lions', 'valiant', 'watchmen', 'conquerors', 'chosen', 'eagles', 'steadfast', 'warriors'].map(id => [id, id + '.png']));
const start = source.indexOf('  const CLUB_CATALOG =');
const end = source.indexOf('  const signature =', start);
assert.ok(start >= 0 && end > start, 'club catalog and roster reconciliation are present');
const { combineRows, sortedRows } = vm.runInNewContext(
  source.slice(start, end) + '\n({ combineRows, sortedRows })', { ART }
);

test('all eight official teams are shown without fabricating game ranks', () => {
  const original = [{ teamId: 'conquerors', clubId: 'conquerors', name: 'CONQUERORS', rank: 1, wins: 3, losses: 2, gamesPlayed: 5 }];
  const states = [
    { club: 'conquerors', status: 'secured', memberCount: 6, capacity: 6 },
    { club: 'lions', status: 'held', memberCount: 2, capacity: 6 },
    { club: 'eagles', status: 'available', memberCount: 0, capacity: 6 },
    { club: 'valiant', status: 'secured', memberCount: 6, capacity: 6 },
  ];
  const merged = combineRows(original, states);
  assert.equal(merged.length, 8);
  const byId = Object.fromEntries(Array.from(merged, item => [item.teamId, item]));
  assert.equal(byId.conquerors.rank, 1);
  assert.equal(byId.conquerors.wins, 3);
  assert.equal(byId.conquerors.losses, 2);
  assert.equal(byId.conquerors.rosterStatus, 'active');
  assert.equal(byId.lions.rank, null);
  assert.equal(byId.lions.rosterStatus, 'needs-players');
  assert.equal(byId.lions.memberCount, 2);
  assert.equal(byId.eagles.rosterStatus, 'unclaimed');
  assert.equal(byId.valiant.rosterStatus, 'ready');
  assert.equal(byId.watchmen.rosterStatus, 'unknown');
  assert.deepEqual(Array.from(sortedRows(merged), x => x.teamId)[0], 'conquerors');
  assert.equal(original[0].rosterStatus, undefined, 'backend results must not be mutated');
});

test('verified Season 1 teams never turn gray because 4v4 signup is incomplete', () => {
  const official = [
    { teamId: 'valiant', clubId: 'valiant', name: 'VALIANT', rank: 2, wins: 3, losses: 2, gamesPlayed: 5 },
    { teamId: 'watchmen', clubId: 'watchmen', name: 'WATCHMEN', rank: 4, wins: 1, losses: 2, gamesPlayed: 3 },
    { teamId: 'chosen', clubId: 'chosen', name: 'CHOSEN', rank: 5, wins: 0, losses: 2, gamesPlayed: 2 },
    { teamId: 'lions', clubId: 'lions', name: 'LIONS', rank: 3, wins: 2, losses: 1, gamesPlayed: 3 },
  ];
  const currentSignup = [
    { club: 'valiant', status: 'held', memberCount: 2, capacity: 6 },
    { club: 'watchmen', status: 'available', memberCount: 0, capacity: 6 },
    { club: 'chosen', status: 'held', memberCount: 1, capacity: 6 },
    // lions has no signup row at all: it still has verified season games
  ];
  const merged = combineRows(official, currentSignup);
  const teams = Object.fromEntries(Array.from(merged, team => [team.teamId, team]));
  for (const id of ['valiant', 'watchmen', 'chosen', 'lions']) {
    assert.equal(teams[id].rosterStatus, 'active', id + ' should retain full color');
  }
  assert.equal(teams.chosen.wins, 0, 'a loss-only team remains active');
  assert.equal(teams.chosen.losses, 2);
  assert.equal(teams.valiant.rank, 2, 'verified season rank survives signup differences');
  assert.equal(teams.eagles.rosterStatus, 'unknown', 'other clubs are not fabricated');
});

test('a roster fetch failure never invents claimed or unclaimed ownership', () => {
  const merged = combineRows([], null);
  assert.equal(merged.length, 8);
  assert.ok(merged.every(item => item.rosterStatus === 'unknown' && item.rank === null));
});

test('the pending treatment is metallic grayscale while cards remain clickable', () => {
  assert.match(source, /data-roster-status="needs-players"/);
  assert.match(source, /data-roster-status="unclaimed"/);
  assert.match(source, /filter:grayscale\(1\)/);
  assert.match(source, /NEEDS PLAYERS/);
  assert.match(source, /UNCLAIMED/);
  assert.match(source, /role', 'button'/);
  assert.match(source, /\/api\/real-play\/4v4\/public/);
});
