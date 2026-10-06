const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('open replay stores active session identity separately from replay launch triggers', () => {
  const source = read('career-game-replay.js');

  assert.match(source, /ensureViewer\(\)\.dataset\.rpCareerReplayActiveSession = String\(id\);/);
  assert.match(source, /delete root\.dataset\.rpCareerReplayActiveSession;/);
  assert.doesNotMatch(source, /ensureViewer\(\)\.dataset\.rpCareerReplaySession = String\(id\);/);
});

test('canonical replay opener accepts only actual replay trigger buttons', () => {
  const source = read('career-game-replay.js');

  assert.match(
    source,
    /event\.target\.closest\('button\[data-rp-career-replay-session\]'\)/
  );
  assert.match(source, /button\.dataset\.rpCareerReplaySession = String\(sessionId\);/);
});

test('admin replay handoff reads active replay identity instead of launch-trigger identity', () => {
  const rotation = read('admin-game-rotation.js');
  const editor = read('career-game-replay-admin-edit.js');

  assert.match(rotation, /rpCareerReplayActiveSession/);
  assert.match(editor, /root\.dataset\.rpCareerReplayActiveSession/);
  assert.doesNotMatch(rotation, /replayRoot\?\.dataset\?\.rpCareerReplaySession/);
  assert.doesNotMatch(editor, /root\.dataset\.rpCareerReplaySession/);
});

test('session identity repair is cache-busted for replay and admin assets', () => {
  const index = read('index.html');
  const admin = read('admin-access-bootstrap.js');

  assert.match(index, /20261006-score-stamp-correction-v215/);
  assert.match(admin, /20261006-score-stamp-correction-v64/);
});
