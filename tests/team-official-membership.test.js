'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../competition-team-rankings.js'), 'utf8');
const start = source.indexOf('  function rosterMarkup(');
const end = source.indexOf('  async function openRoster(', start);
assert.ok(start >= 0 && end > start, 'roster section renderer exists');
const rosterMarkup = vm.runInNewContext(source.slice(start, end) + '\nrosterMarkup', {
  Number, Array, String,
  esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"','&quot;'),
});

test('borrowed appearances are separate from approved official roster members', () => {
  const html = rosterMarkup([
    { identityKey: 'user:17', playerName: 'Official Member', rank: 3, rosterStatus: 'official' },
    { identityKey: 'user:19', playerName: 'Borrowed Player', rank: 6, rosterStatus: 'borrowed' },
    { identityKey: 'user:20', playerName: 'Unconfirmed Player', rank: 7, rosterStatus: 'unverified' },
  ]);
  assert.match(html, /OFFICIAL ROSTER/);
  assert.match(html, /BORROWED PLAYERS/);
  assert.match(html, /GAME APPEARANCES · UNVERIFIED/);
  assert.ok(html.indexOf('Official Member') < html.indexOf('Borrowed Player'));
  assert.ok(html.indexOf('Borrowed Player') < html.indexOf('Unconfirmed Player'));
  assert.doesNotMatch(html, /data-rp-roster-classify/, 'public viewer cannot edit rosters');
});

test('new game appearances do not become official members until approved', () => {
  const html = rosterMarkup([
    { identityKey: 'manual:32', playerName: 'Temporary Player', rank: null },
  ]);
  assert.match(html, /NO OFFICIAL MEMBERS CONFIRMED YET/);
  assert.match(html, /GAME APPEARANCES · UNVERIFIED/);
  assert.doesNotMatch(html, /BORROWED PLAYERS/, 'only admin may label as borrowed');
});

test('admin sees explicit status choices; displayed names stay escaped', () => {
  const html = rosterMarkup([
    { identityKey: 'manual:22', playerName: '<Player>', rank: null, rosterStatus: 'unverified' },
  ], true);
  assert.match(html, /data-rp-roster-classify/);
  assert.match(html, /value="official"/);
  assert.match(html, /value="borrowed"/);
  assert.match(html, /&lt;Player&gt;/);
  assert.doesNotMatch(html, /<Player>/);
  assert.ok(source.includes('/api/real-play/competition/team-roster/classification'));
});
