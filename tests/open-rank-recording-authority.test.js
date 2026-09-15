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

test('normal setup/schedule flow cannot expose manual SET # as a numbering engine', () => {
  const identity = read('open-rank-auto-id.js');

  assert.match(identity, /sessionIdFromResultCard\(card\)/);
  assert.match(identity, /const repairable = Number\.isSafeInteger\(number\) && number > 0/);
  assert.match(identity, /button\.hidden = !repairable/);
  assert.match(identity, /button\.disabled = !repairable/);
  assert.match(identity, /\[data-rp-manual-open-rank-number\]/);
  assert.match(identity, /button\.remove\(\)/);
});
