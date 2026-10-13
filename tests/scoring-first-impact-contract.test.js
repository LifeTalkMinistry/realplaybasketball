const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (filename) => fs.readFileSync(path.join(root, filename), 'utf8');

test('replay and admin recaps both use Real Play scoring-first game impact v1', () => {
  const replay = read('career-game-replay-stats.js');
  const admin = read('admin-game-recap-recognitions.js');
  const values = [
    ['reb', '0.4'],
    ['ast', '0.7'],
    ['stl', '0.8'],
    ['blk', '0.6'],
    ['tov', '0.8'],
    ['foul', '0.15'],
  ];
  const escape = (value) => value.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');

  for (const [stat, weight] of values) {
    assert.match(replay, new RegExp(`num\\(player\\?\\.${stat}\\) \\* ${escape(weight)}\\)`));
    assert.match(admin, new RegExp(`st\\.${stat} \\* ${escape(weight)}\\)`));
  }
  assert.match(replay, /shots\\.misses \\* 0\\.15/);
  assert.match(admin, /s\\.misses \\* 0\\.15/);
  assert.match(replay, /const score = num\\(player\\?\\.pts\\)/);
  assert.match(admin, /const score = st\\.pts/);
  assert.doesNotMatch(replay, /0\\.5 per missed shot, 1\\.5 per turnover/);
});

test('new impact assets receive a fresh browser cache version', () => {
  assert.match(read('index.html'), /20261013-scoring-first-impact-v257/);
  assert.match(read('admin-access-bootstrap.js'), /20261013-scoring-first-impact-v79/);
});
