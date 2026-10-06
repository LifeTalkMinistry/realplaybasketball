const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('replay admin hash recovers session identity from the open replay root', () => {
  const source = read('career-game-replay-marker-cleanup.js');
  const sync = source.indexOf('function syncReplayNumberEditor()');
  const active = source.indexOf('root.dataset.rpCareerReplayActiveSession', sync);
  const assign = source.indexOf('replaySessionId = activeSessionId;', sync);
  const visibility = source.indexOf('window.__realPlayAdminVerified === true && replaySessionId > 0', sync);

  assert.ok(sync >= 0, 'hash sync function must exist');
  assert.ok(active > sync, 'hash sync must read authoritative active replay session identity');
  assert.ok(assign > active, 'valid active session must recover replaySessionId');
  assert.ok(visibility > assign, 'visibility decision must run after session recovery');
});

test('replay admin hash re-syncs immediately when admin verification completes', () => {
  const source = read('career-game-replay-marker-cleanup.js');
  assert.match(source, /window\.addEventListener\('realplay:admin-render', syncReplayNumberEditor\)/);
});

test('admin hash recovery is cache-busted', () => {
  assert.match(read('index.html'), /20261006-replay-admin-hash-v217/);
});
