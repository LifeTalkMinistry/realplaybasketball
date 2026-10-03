const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('startup player identity and OVR use the lightweight me summary endpoint', () => {
  const lobby = read('mobile-lobby.js');
  const menu = read('main-menu.js');

  assert.match(lobby, /\/api\/real-play\/me\/summary/);
  assert.match(menu, /\/api\/real-play\/me\/summary/);
  assert.doesNotMatch(lobby, /\/api\/real-play\/me`/);
  assert.doesNotMatch(menu, /\/api\/real-play\/me`/);
});

test('shared player summary store coalesces startup requests and caches briefly', () => {
  const store = read('player-summary-store.js');

  assert.match(store, /const CACHE_MS = 15_000/);
  assert.match(store, /if \(inFlight\) return inFlight/);
  assert.match(store, /cachedState && cachedToken === token && now - cachedAt < CACHE_MS/);
  assert.match(store, /realplay:profile-loaded/);
});

test('player summary store loads before lobby and main menu', () => {
  const app = read('app.js');
  const storeIndex = app.indexOf("loadScript('player-summary-store.js'");
  const lobbyIndex = app.indexOf("loadScript('mobile-lobby.js'");
  const menuIndex = app.indexOf("loadScript('main-menu.js'");

  assert.ok(storeIndex >= 0, 'summary store must load');
  assert.ok(lobbyIndex > storeIndex, 'summary store must load before lobby');
  assert.ok(menuIndex > storeIndex, 'summary store must load before main menu');
});

test('full profile continues to use the complete me endpoint', () => {
  const profile = read('real-play-profile.js');
  const history = read('profile-load-guard.js');

  assert.match(profile, /api\('\/api\/real-play\/me'\)/);
  assert.match(history, /\/api\/real-play\/me`/);
});


test('summary store keeps a deployment-safe legacy fallback only for missing summary routes', () => {
  const store = read('player-summary-store.js');

  assert.match(store, /const LEGACY_ME_URL = 'https:\/\/api\.clarapmc\.com\/api\/real-play\/me'/);
  assert.match(store, /response\.status === 404 \|\| response\.status === 405/);
  assert.match(store, /fetch\(LEGACY_ME_URL, requestOptions\)/);
});
