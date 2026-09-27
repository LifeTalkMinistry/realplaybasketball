const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('public career metrics use the canonical selected player identity, not the profile-art account identity', () => {
  const world = read('real-play-world-players.js');
  const metrics = read('real-play-profile-metrics.js');

  assert.match(world, /data-world-player-id="\$\{esc\(player\.userId\)\}"/);
  assert.match(world, /detail: \{ playerId: Number\(player\?\.playerId \|\| 0\) \|\| null, player \}/);
  assert.match(metrics, /expectedPublicId = publicProfile \? Number\(profile\.__realPlayPublicPlayer\?\.playerId \|\| 0\) : null/);
  assert.doesNotMatch(metrics, /expectedPublicId[^\n]*rpPublicPlayerId/);
});

test('public profile switching is latest-request-wins and closing invalidates in-flight work', () => {
  const world = read('real-play-world-players.js');

  assert.match(world, /let publicProfileRequestId = 0/);
  assert.match(world, /const requestId = \+\+publicProfileRequestId/);
  assert.match(world, /requestId !== publicProfileRequestId/);
  assert.match(world, /returnedPlayerId !== requestedPlayerId/);
  assert.match(world, /function closePublicProfile\(\)[\s\S]*publicProfileRequestId \+= 1/);
  assert.doesNotMatch(world, /async function openPublicProfile\(playerId\) \{\s*if \(loadingProfile\) return;/);
});

test('public career metrics have explicit success, empty, and unavailable terminal states', () => {
  const metrics = read('real-play-profile-metrics.js');

  assert.match(metrics, /Array\.isArray\(metricGames\?\.games\)/);
  assert.match(metrics, /metricGames\.games\.length === 0/);
  assert.match(metrics, /No career metrics yet\./);
  assert.match(metrics, /Career metrics unavailable\./);
  assert.match(metrics, /role="status"/);
});

test('own-profile career metrics retain parallel profile and metrics requests', () => {
  const metrics = read('real-play-profile-metrics.js');

  assert.match(metrics, /Promise\.all\(\[\s*api\('\/api\/real-play\/me'\),\s*api\('\/api\/real-play\/career\/metrics'\),\s*\]\)/);
});
