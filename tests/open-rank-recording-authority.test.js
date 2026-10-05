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

test('recorded replay renderer gives competition-season identity priority and falls back to Open Rank', () => {
  const replay = read('career-game-replay.js');

  assert.match(replay, /function positiveReplaySeasonNumber\(value\)/);
  assert.match(replay, /function competitionReplayTitle\(game\)/);
  assert.match(replay, /game\?\.seasonNumber \?\? game\?\.season_number/);
  assert.match(replay, /game\?\.seasonGameNumber \?\? game\?\.season_game_number/);
  assert.match(replay, /game\?\.competitionContext \?\? game\?\.competition_context/);
  assert.match(replay, /TUNE-UP/);
  assert.match(replay, /LEAGUE/);
  assert.match(replay, /SEASON \$\{seasonNumber\} #\$\{String\(seasonGameNumber\)\.padStart\(2, '0'\)\}/);
  assert.match(replay, /if \(competitionTitle\) return competitionTitle/);

  assert.match(replay, /function positiveReplayOpenRankNumber\(value\)/);
  assert.match(replay, /function canonicalReplayTitle\(number\)/);
  assert.match(replay, /OPEN RANKING SESSION #\$\{String\(number\)\.padStart\(3, '0'\)\}/);
  assert.match(replay, /game\?\.openRankNumber \?\? game\?\.open_rank_number/);
  assert.match(replay, /RealPlayOpenRankIdentity\?\.numberForSession\?\.\(sessionId\)/);
  assert.match(replay, /return number \? canonicalReplayTitle\(number\) : String\(game\?\.title \|\| 'REAL PLAY GAME'\)/);

  assert.match(replay, /const replayTitle = replayDisplayTitle\(game\)/);
  assert.match(replay, /<h2>\$\{esc\(replayTitle\)\}<\/h2>/);
  assert.match(replay, /data-rp-career-replay-brand-session>\$\{esc\(replayTitle\)\}<\/div>/);
  assert.match(replay, /titleNode\.textContent = replayTitle/);
  assert.doesNotMatch(replay, /openRankNumber:\s*Number\(game\?\.sessionId/);
});

test('recorded replay renumber verifies save response and fresh replay GET before rendering', () => {
  const replayRepair = read('career-game-replay-marker-cleanup.js');

  assert.match(replayRepair, /function canonicalReplayNumber\(\)/);
  assert.match(replayRepair, /RealPlayOpenRankIdentity\?\.numberForSession\?\.\(replaySessionId\)/);
  assert.match(replayRepair, /RealPlayOpenRankIdentity\?\.refresh\?\.\(\)/);
  assert.match(replayRepair, /data\?\.control\?\.renumberedSession\?\.openRankNumber/);
  assert.doesNotMatch(replayRepair, /renumberedSession\?\.openRankNumber \?\? value/);
  assert.match(replayRepair, /function replayNumberFromBackend\(sessionId, auth\)/);
  assert.match(replayRepair, /career\/games\/\$\{encodeURIComponent\(sessionId\)\}\/replay/);
  assert.match(replayRepair, /data\?\.game\?\.openRankNumber \?\? data\?\.game\?\.open_rank_number/);
  assert.match(replayRepair, /if \(refetched !== saved\)/);
  assert.match(replayRepair, /applyReplayTitle\(refetched\)/);
});


test('Audit START delegates roster-count validation to the standalone server authority', () => {
  const startFix = read('admin-recorded-start-submit-fix.js');
  const auditBridge = read('admin-courtside-live.js');

  assert.match(auditBridge, /CAREER_CONTROL_PATH = '\/api\/real-play\/admin\/career\/control'/);
  assert.match(auditBridge, /AUDIT_CONTROL_PATH = '\/api\/real-play\/admin\/audit\/control'/);
  assert.match(auditBridge, /url\.pathname === CAREER_CONTROL_PATH/);
  assert.match(auditBridge, /url\.pathname = AUDIT_CONTROL_PATH/);

  assert.match(startFix, /json: \{ action: 'start-video-review' \}/);
  assert.match(startFix, /standalone Audit start endpoint owns the canonical roster validation/);
  assert.doesNotMatch(startFix, /counts\.west !== expected \|\| counts\.east !== expected/);
  assert.doesNotMatch(startFix, /needs exactly \$\{expected\} West and \$\{expected\} East players/);
});
