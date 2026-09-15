const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Open Rank identity remains canonical while result display text may be overridden', () => {
  const identity = read('open-rank-auto-id.js');
  const history = read('public-profile-history.js');

  assert.match(identity, /function positiveOpenRankNumber\(value\)/);
  assert.match(identity, /value === null \|\| value === undefined \|\| value === ''/);
  assert.match(identity, /officialSessionNumber = positiveOpenRankNumber\(rawNumber\)/);
  assert.match(identity, /node\.textContent = 'OPEN RANKING SESSION'/);
  assert.match(identity, /FIRST SUCCESSFUL GAME UPLOAD/i);
  assert.match(identity, /RESULT CARD DISPLAY TEXT CAN BE EDITED SEPARATELY/i);

  // The routed backend result title is presentation authority. This is
  // intentionally unconditional so an admin can display another #xxx text
  // without the frontend snapping it back to canonical identity metadata.
  assert.match(identity, /if \(backendTitle\) return backendTitle/);

  assert.match(history, /function canonicalOpenRankNumber\(game\)/);
  assert.match(history, /return String\(game\?\.label \|\| game\?\.title \|\| 'OPEN RANKING SESSION'\)/);
  assert.doesNotMatch(history, /OFFICIAL GAME #\$\{sessionId\(game\)/);
  assert.doesNotMatch(history, /OPEN RANK #000/i);
  assert.doesNotMatch(history, /OPEN RANKING SESSION #000/i);
});

test('completed result heading is inline editable without exposing root-number mutation', () => {
  const identity = read('open-rank-auto-id.js');
  const admin = read('updates-session-title-admin.js');

  assert.match(admin, /function beginResultTitleEdit\(target\)/);
  assert.match(admin, /dataset\.rpEditResultTitleHeading = String\(sessionId\)/);
  assert.match(admin, /data-rp-result-title-editor/);
  assert.match(admin, /action: 'set-result-display-title'/);
  assert.match(admin, /displayTitle,/);
  assert.match(admin, /heading\.textContent = `\$\{persisted\}\$\{suffix\}`/);
  assert.match(admin, /The result suffix remains automatic/);

  // Result-card UI edits presentation only. The technical Open Rank repair
  // endpoint is not produced or called from this surface anymore.
  assert.doesNotMatch(admin, /set-open-rank-number/);
  assert.doesNotMatch(admin, /function setOpenRankNumber\(/);
  assert.doesNotMatch(admin, /dataset\.rpSetOpenRankNumber/);
  assert.doesNotMatch(admin, /EDIT OPEN RANK NUMBER/);

  // Old cached root-number controls are actively removed from the rendered UI.
  assert.match(identity, /function removeLegacyManualNumberControls\(\)/);
  assert.match(identity, /\[data-rp-set-open-rank-number\], \[data-rp-manual-open-rank-number\]/);
});