const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Audit designated-team selector persists the selected club on the game record', () => {
  const designation = read('admin-audit-team-designation.js');

  assert.match(designation, /action: 'set-team-designation'/);
  assert.match(designation, /teamName: club/);
  assert.match(designation, /westTeamName/);
  assert.match(designation, /eastTeamName/);
  assert.doesNotMatch(designation, /designationState\(mountedSessionId\)\[side\] = ''/);
});

test('World story renderer uses public team names while retaining WEST/EAST as internal sides', () => {
  const world = read('world-results.js');

  assert.match(world, /metadata\.westTeamName/);
  assert.match(world, /metadata\.eastTeamName/);
  assert.match(world, /winnerSide/);
  assert.match(world, /\$\{winner\} HOLDS OFF \$\{loser\}/);
  assert.match(world, /String\(mvp\.team \|\| ''\)\.toUpperCase\(\) === winnerSide/);
});


test('Results score boxes show persisted public team names instead of hardcoded WEST/EAST', () => {
  const updates = read('real-play-updates.js');
  const start = updates.indexOf('function resultBlock(update)');
  const end = updates.indexOf('function scheduleMeta', start);
  const block = updates.slice(start, end);

  assert.match(block, /metadata\.westTeamName/);
  assert.match(block, /metadata\.eastTeamName/);
  assert.match(block, /esc\(westName\)/);
  assert.match(block, /esc\(eastName\)/);
  assert.doesNotMatch(block, /<span>WEST<\/span>/);
  assert.doesNotMatch(block, /<span>EAST<\/span>/);
});
