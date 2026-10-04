const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const replayScripts = [
  'visitor-replay-access.js',
  'career-game-replay.js',
  'career-game-replay-marker-cleanup.js',
  'career-game-replay-assist-authority.js',
  'career-game-replay-positive-events.js',
  'career-game-replay-fullscreen-back.js',
  'career-game-replay-stats.js',
  'career-game-replay-official-mvp.js',
  'career-game-replay-comments-viewport.js',
  'career-game-replay-winner.js',
];

test('heavy replay family is removed from the global app enhancement loop', () => {
  const app = read('app.js');

  assert.match(app, /['"]career-game-replay-loader\.js['"]/);
  for (const script of replayScripts) {
    assert.doesNotMatch(app, new RegExp(`['"]${script.replaceAll('.', '\\.') }['"]`));
  }
});

test('replay loader is part of the initial interaction boundary', () => {
  const app = read('app.js');
  const initial = app.slice(app.indexOf('const initialInteractionScripts'));

  assert.match(initial, /['"]career-game-replay-loader\.js['"]/);
});

test('replay loader owns the full previous replay script order', () => {
  const loader = read('career-game-replay-loader.js');

  let previous = -1;
  for (const script of replayScripts) {
    const index = loader.indexOf(`'${script}'`);
    assert.ok(index > previous, `${script} must remain in replay dependency order`);
    previous = index;
  }
});

test('first replay click waits for full runtime and then replays canonical session click', () => {
  const loader = read('career-game-replay-loader.js');

  assert.match(loader, /let runtimeReady = false/);
  assert.match(loader, /if \(runtimeReady\) return true/);
  assert.match(loader, /runtimeReady = true/);
  assert.match(loader, /\[data-rp-career-replay-session\]/);
  assert.match(loader, /event\.stopImmediatePropagation\(\)/);
  assert.match(loader, /ensureReplayRuntime\(\)/);
  assert.match(loader, /reopenSession\(sessionId\)/);
});

test('Career and profile/history interactions can prewarm replay before the actual session click', () => {
  const loader = read('career-game-replay-loader.js');

  assert.match(loader, /data-rp-select-mode="Career Mode"/);
  assert.match(loader, /data-rp-nav="career"/);
  assert.match(loader, /\.rp-profile-history \.rp-profile-game/);
  assert.match(loader, /data-rp-public-history-more/);
  assert.match(loader, /pointerdown/);
  assert.match(loader, /prewarmFromTarget\(event\.target\)/);
});

test('replay admin root remains global while admin edit body stays admin-lazy', () => {
  const app = read('app.js');
  const admin = read('admin-access-bootstrap.js');

  assert.match(app, /['"]career-game-replay-admin-root\.js['"]/);
  assert.doesNotMatch(app, /['"]career-game-replay-admin-edit\.js['"]/);
  assert.match(admin, /['"]career-game-replay-admin-edit\.js['"]/);
});
