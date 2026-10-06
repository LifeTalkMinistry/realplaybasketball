const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('base Admin polling yields ownership to replay correction mode', () => {
  const source = read('admin-game-control.js');

  assert.match(
    source,
    /function replayCorrectionOwnsWorkspace\(\)[\s\S]*?body\.querySelector\('\[data-rp-replay-correction-mode\]'\)/
  );
  assert.match(
    source,
    /async function refresh\(options = \{\}\)[\s\S]*?if \(options\.silent && replayCorrectionOwnsWorkspace\(\)\) return;/
  );
  assert.match(
    source,
    /function startPolling\(\)[\s\S]*?if \(replayCorrectionOwnsWorkspace\(\)\) return;[\s\S]*?refresh\(\{ silent: true \}\)/
  );
  assert.match(
    source,
    /window\.addEventListener\('focus',[\s\S]*?!replayCorrectionOwnsWorkspace\(\)[\s\S]*?refresh\(\{ silent: true \}\)/
  );
});

test('replay correction still closes replay only after correction DOM mounts', () => {
  const source = read('career-game-replay-admin-edit.js');
  const mounted = source.indexOf("const scoring = body.querySelector('[data-rp-replay-correction-mode]');");
  const verified = source.indexOf("if (!scoring) throw new Error('Second-Pass Audit could not mount.');");
  const close = source.indexOf("closeReplay?.click();");

  assert.ok(mounted >= 0, 'correction mount check must exist');
  assert.ok(verified > mounted, 'correction mount must be verified');
  assert.ok(close > verified, 'replay must close only after correction DOM is verified');
});

test('replay correction Admin assets use the new ownership cache version', () => {
  const admin = read('admin-access-bootstrap.js');
  const index = read('index.html');

  assert.match(admin, /20261006-replay-submit-owner-v65/);
  assert.match(index, /20261006-replay-admin-hash-v217/);
});

test('replay runtime does not revive the retired admin edit bridge', () => {
  const mvp = read('career-game-replay-official-mvp.js');
  const admin = read('admin-access-bootstrap.js');

  assert.doesNotMatch(mvp, /career-game-replay-admin-edit-bridge\.js/);
  assert.match(mvp, /career-game-replay-admin-root\.js/);
  assert.match(admin, /20261006-replay-correction-owner-v2/);
});
