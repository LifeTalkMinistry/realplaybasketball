const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('re-audit stamp positioning falls back to live media duration', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /function effectiveMediaDurationMs\(\)[\s\S]*?context\?\.recording\?\.durationMs[\s\S]*?mediaDurationMs/);
  assert.match(source, /function markerButtons\(\) \{[\s\S]*?const duration = effectiveMediaDurationMs\(\);/);
});

test('YouTube re-audit adopts player duration and repaints stamp rail', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /onReady: \(event\) => \{[\s\S]*?getDuration\?\.\(\)[\s\S]*?adoptMediaDuration\(durationSeconds \* 1000\)/);
  assert.match(source, /function adoptMediaDuration\(value\)[\s\S]*?patchScoringUI\(\)/);
});

test('uploaded-video re-audit also adopts metadata duration when needed', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /const duration = Number\.isFinite\(video\.duration\)[\s\S]*?adoptMediaDuration\(duration \* 1000\)/);
});

test('audit-stamp duration repair is cache-busted', () => {
  assert.match(read('admin-access-bootstrap.js'), /20261006-replay-submit-owner-v65/);
  assert.match(read('index.html'), /20261006-replay-submit-owner-v216/);
});
