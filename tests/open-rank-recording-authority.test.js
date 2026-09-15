const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Open Rank display consumes canonical backend identity and preserves NULL as unnumbered', () => {
  const identity = read('open-rank-auto-id.js');
  const history = read('public-profile-history.js');

  assert.match(identity, /function positiveOpenRankNumber\(value\)/);
  assert.match(identity, /value === null \|\| value === undefined \|\| value === ''/);
  assert.match(identity, /officialSessionNumber = positiveOpenRankNumber\(rawNumber\)/);
  assert.match(identity, /node\.textContent = 'OPEN RANKING SESSION'/);
  assert.match(identity, /FIRST SUCCESSFUL GAME UPLOAD/i);
  assert.match(identity, /SET # IS REPAIR-ONLY/i);

  assert.match(history, /function canonicalOpenRankNumber\(game\)/);
  assert.match(history, /return String\(game\?\.label \|\| game\?\.title \|\| 'OPEN RANKING SESSION'\)/);
  assert.doesNotMatch(history, /OFFICIAL GAME #\$\{sessionId\(game\)/);
  assert.doesNotMatch(history, /OPEN RANK #000/i);
  assert.doesNotMatch(history, /OPEN RANKING SESSION #000/i);
});

test('manual Open Rank correction is produced only as repair for recorded result cards', () => {
  const identity = read('open-rank-auto-id.js');
  const admin = read('updates-session-title-admin.js');

  assert.match(identity, /sessionIdFromResultCard\(card\)/);
  assert.match(identity, /const repairable = Number\.isSafeInteger\(number\) && number > 0/);
  assert.match(identity, /button\.hidden = !repairable/);
  assert.match(identity, /button\.disabled = !repairable/);

  assert.match(admin, /function isResultCard\(card\)/);
  assert.match(admin, /if \(!isResultCard\(card\)\)/);
  assert.match(admin, /const repairable = Number\.isSafeInteger\(canonical\) && canonical > 0/);
  assert.match(admin, /button\.hidden = !repairable/);
  assert.match(admin, /button\.disabled = !repairable/);
  assert.match(admin, /Repair the official Open Rank number for this recorded game/);

  // The old active-session producer caused a MutationObserver append/remove loop.
  assert.doesNotMatch(admin, /function decorateGameControlManage\(/);
  assert.doesNotMatch(admin, /function setActiveOpenRankNumber\(/);
  assert.doesNotMatch(admin, /dataset\.rpManualOpenRankNumber/);
  assert.doesNotMatch(admin, /EDIT OPEN RANK NUMBER/);
});
