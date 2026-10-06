const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Second-Pass Audit resolves declared team names with WEST/EAST fallback', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /function teamDisplayName\(team\)/);
  assert.match(source, /context\?\.session\?\.westTeamName/);
  assert.match(source, /context\?\.session\?\.eastTeamName/);
  assert.match(source, /side === 'east' \? 'EAST' : 'WEST'/);
});

test('audit UI uses declared labels instead of hard-coded scoring-side names', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /teamDisplayName\(player\.team\)/);
  assert.match(source, /teamDisplayName\(team\)/);
  assert.match(source, /teamDisplayName\('west'\)/);
  assert.match(source, /teamDisplayName\('east'\)/);
});

test('final correction confirmation and success notice use declared labels', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /const westName = teamDisplayName\('west'\)/);
  assert.match(source, /const eastName = teamDisplayName\('east'\)/);
  assert.match(source, /Verify and submit this corrected score sheet\? \$\{westName\} \$\{west\} – \$\{east\} \$\{eastName\}\./);
  assert.match(source, /Official score sheet saved\. \$\{teamDisplayName\('west'\)\}/);
  assert.doesNotMatch(source, /Verify and submit this corrected score sheet\? WEST \$\{west\}/);
});

test('declared-team label UI is cache-busted', () => {
  assert.match(read('admin-access-bootstrap.js'), /20261006-declared-team-labels-v66/);
  assert.match(read('index.html'), /20261006-declared-team-labels-v218/);
});
