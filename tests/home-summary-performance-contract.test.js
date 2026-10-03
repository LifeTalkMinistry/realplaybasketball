const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Home navigation reads the compact public Home summary endpoint', () => {
  const simple = read('simple-navigation.js');
  const authority = read('simple-navigation-state-authority.js');
  const boot = read('public-first-entry.js');

  assert.match(simple, /\/api\/real-play\/public\/home-summary/);
  assert.match(authority, /\/api\/real-play\/public\/home-summary/);
  assert.match(boot, /HOME_PUBLIC_SUMMARY_PATH = '\/api\/real-play\/public\/home-summary'/);

  assert.doesNotMatch(simple, /PUBLIC_UPDATES_URL/);
  assert.doesNotMatch(authority, /PUBLIC_UPDATES_URL/);
});

test('official Updates and World results still retain the complete public updates feed', () => {
  const updates = read('real-play-updates.js');
  const results = read('world-results.js');

  assert.match(updates, /\/api\/real-play\/public\/updates/);
  assert.match(results, /\/api\/real-play\/public\/updates/);
});

test('initial Home boot gate can observe authority requests that start before app-ready', () => {
  const boot = read('public-first-entry.js');

  assert.match(boot, /if \(!window\.__realPlaySimpleNavigationStateAuthorityInstalled\) return request;/);
  assert.doesNotMatch(boot, /if \(!state\.appReady \|\| !window\.__realPlaySimpleNavigationStateAuthorityInstalled\) return request;/);
  assert.match(boot, /if \(state\.released \|\| !state\.appReady \|\| !homeInstalled\(\)\) return;/);
});
