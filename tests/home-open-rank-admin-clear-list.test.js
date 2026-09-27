const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Missing ${start}`);
  assert.notEqual(to, -1, `Missing ${end}`);
  return source.slice(from, to);
}

test('Clear List still reaches clear_schedule when the open session has zero roster players', () => {
  const source = read('home-open-rank-admin-clear-list.js');
  const openConfirm = between(source, 'async function openConfirm', 'function ensureUi');
  const clearSchedule = between(source, 'async function clearSchedule', 'function editorStatus');

  assert.match(openConfirm, /if \(!Number\(roster\?\.sessionId\)\)[\s\S]*return;/);
  assert.doesNotMatch(openConfirm, /if \(total <= 0\)/);
  assert.doesNotMatch(openConfirm, /player list is already empty/i);
  assert.match(openConfirm, /'CLEAR CURRENT SESSION\?'/);
  assert.match(openConfirm, /'CLEAR CURRENT SESSION'/);

  assert.match(clearSchedule, /method: 'POST'/);
  assert.match(clearSchedule, /JSON\.stringify\(\{ action: 'clear_schedule' \}\)/);
});

test('Clear List verifies both roster and team state before reporting success', () => {
  const source = read('home-open-rank-admin-clear-list.js');
  const performClear = between(source, 'async function performClear', 'async function openConfirm');

  assert.match(source, /\/api\/real-play\/career\/session-teams/);
  assert.match(source, /async function fetchTeamSnapshot\(\)/);
  assert.match(performClear, /const result = await clearSchedule\(\)/);
  assert.match(performClear, /Promise\.all\(\[\s*fetchRoster\(\),\s*fetchTeamSnapshot\(\),\s*\]\)/);
  assert.match(performClear, /if \(remaining > 0\)/);
  assert.match(performClear, /Array\.isArray\(teamSnapshot\?\.teams\) \? teamSnapshot\.teams\.length : 0/);
  assert.match(performClear, /if \(remainingTeams > 0\)/);
  assert.match(performClear, /result\?\.session\?\.id/);
  assert.match(performClear, /roster\?\.sessionId/);
  assert.match(performClear, /teamSnapshot\?\.session\?\.id/);
  assert.match(performClear, /current session IDs do not match/);
  assert.match(performClear, /realplay:ranking-session-changed/);
  assert.match(performClear, /realplay:ranking-entry-updated/);
});
