const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('score audit stamps keep single-tap seek and add same-stamp double-tap correction', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /data-rp-audit-score-event/);
  assert.match(source, /AUDIT_SCORE_DOUBLE_TAP_MS = 430/);
  assert.match(source, /seekPlayback\(Number\(marker\.dataset\.rpVideoMarker \|\| 0\)\)/);
  assert.match(source, /doubleTap[\s\S]*?openScoreCorrection\(localId\)/);
});

test('score correction sheet exposes remove and player reassignment actions', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /CORRECT SCORE STAMP/);
  assert.match(source, /data-rp-audit-remove-score/);
  assert.match(source, /data-rp-audit-reassign-score/);
  assert.match(source, /ASSIGN TO ANOTHER PLAYER/);
  assert.match(source, /Working copy only/);
});

test('removing a made basket also removes its linked assist when present', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /assistsScoreEventId/);
  assert.match(source, /linkedAssistIndexForScore/);
  assert.match(source, /function removeScoreCorrection[\s\S]*?linkedAssistIndexForScore[\s\S]*?draftEvents\.splice/);
});

test('reassignment drops an assist that becomes self-assist or cross-team', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /const selfAssist =/);
  assert.match(source, /const crossTeamAssist =/);
  assert.match(source, /if \(selfAssist \|\| crossTeamAssist\)/);
});

test('score-stamp correction assets are cache-busted', () => {
  assert.match(read('admin-access-bootstrap.js'), /20261006-declared-team-labels-v66/);
  assert.match(read('index.html'), /20261006-declared-team-labels-v218/);
});
