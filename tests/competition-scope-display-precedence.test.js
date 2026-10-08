'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'competition-hub.js'), 'utf8');
const prefix = 'body.rp-simple-navigation-active .rp-world.rp-competition-scoped-ranking [data-world-player-list] .rp-world-player-row[data-rp-competition-scope-row]';

test('18 verified Tune-Up / League players are not removed by global CSS display rules', () => {
  const visibleRule = prefix + ':not([hidden]){display:grid!important}';
  const hiddenRule = prefix + '[hidden]{display:none!important}';
  assert.ok(source.includes(visibleRule), 'Scoped competition row should win the display cascade when not hidden');
  assert.ok(source.includes(hiddenRule), 'Active leaderboard filter must still be able to hide a row');
  assert.ok(source.includes('data-rp-competition-scope-row="true"'), 'Scoped renderer should mark all competition-owned rows');
  assert.ok(!source.includes(prefix + '{display:grid}'), 'Unprioritized scoped rule must not regress');
});

test('the scoped rank renderer does not make overall status a display requirement', () => {
  const blockStart = source.indexOf('  function normalizeAutomaticCompetitionRanks(');
  const blockEnd = source.indexOf('  function scopedPlayerRow(', blockStart);
  assert.ok(blockStart > 0 && blockEnd > blockStart);
  const block = source.slice(blockStart, blockEnd);
  assert.match(block, /games.*> 0\)/, 'Verified competition games must be required');
  assert.match(block, /ranked: true/, 'Every verified participant receives a scoped rank');
  assert.doesNotMatch(block, /rankingStatus|inactiveRank|globalRank/i, 'Global activity gating is irrelevant in competition standings');
});
