const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const lazyAdminScripts = [
  'real-play-world-player-admin.js',
  'real-play-world-player-admin-identity.js',
  'updates-session-title-admin.js',
  'admin-live-stat-stability.js',
  'admin-courtside-live.js',
  'admin-recorded-scoring-winner.js',
  'admin-game-type-switch.js',
  'admin-session-picker-v5-loader.js',
  'career-game-replay-admin-edit.js',
  'admin-game-rotation.js',
];

test('admin-only enhancements are not part of the global app enhancement loop', () => {
  const app = read('app.js');
  for (const script of lazyAdminScripts) {
    assert.doesNotMatch(app, new RegExp(`['"]${script.replaceAll('.', '\\.') }['"]`));
  }
  assert.doesNotMatch(app, /['"]admin-player-schedule\.js['"]/);
});

test('verified-admin loader retains every removed admin feature', () => {
  const admin = read('admin-access-bootstrap.js');
  const sessionPicker = read('admin-session-picker-v5-loader.js');

  for (const script of lazyAdminScripts) {
    assert.match(admin, new RegExp(`['"]${script.replaceAll('.', '\\.') }['"]`));
  }
  assert.match(sessionPicker, /admin-player-schedule\.js/);
});

test('mixed player compatibility layers stay global in Phase 4A', () => {
  const app = read('app.js');

  assert.match(app, /['"]player-admin-probe-guard\.js['"]/);
  assert.match(app, /['"]admin-live-session-expiry\.js['"]/);
  assert.match(app, /['"]admin-live-refresh-fix\.js['"]/);
  assert.match(app, /['"]admin-recorded-stat-controls-fix\.js['"]/);
  assert.match(app, /['"]open-rank-auto-id\.js['"]/);
  assert.match(app, /['"]admin-access-bootstrap\.js['"]/);
});
