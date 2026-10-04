const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('World and Profile base CSS are interaction-critical before shell reveal', () => {
  const app = read('app.js');
  const critical = app.slice(
    app.indexOf('const criticalStylesheetHrefs'),
    app.indexOf('(async () => {')
  );

  assert.match(critical, /['"]real-play-world\.css['"]/);
  assert.match(critical, /['"]real-play-profile\.css['"]/);
});

test('primary nav retries World runtime instead of silently activating a dead tab', () => {
  const nav = read('simple-navigation.js');

  assert.match(nav, /loadFeatureScript\('real-play-world\.js'/);
  assert.match(nav, /Boolean\(window\.RealPlayWorld\?\.open\)/);
  assert.match(nav, /if \(!ready \|\| !window\.RealPlayWorld\?\.open\)/);
  assert.match(nav, /window\.RealPlayWorld\.open\(\)/);
  assert.match(nav, /setNavBusy\(target, true\)/);
});

test('Players can recover its own directory runtime on an early tap', () => {
  const nav = read('simple-navigation.js');

  assert.match(nav, /real-play-world-players\.js/);
  assert.match(nav, /Boolean\(window\.RealPlayPlayers\?\.refresh\)/);
  assert.match(nav, /visitor-world-players\.js/);
});

test('ME can recover Profile runtime on an early tap', () => {
  const nav = read('simple-navigation.js');

  assert.match(nav, /profile-load-guard\.js/);
  assert.match(nav, /Boolean\(window\.__rpProfileLoadGuard\)/);
  assert.match(nav, /real-play-profile\.js/);
  assert.match(nav, /Boolean\(window\.RealPlayProfile\?\.open\)/);
  assert.match(nav, /window\.RealPlayProfile\.open\(\)/);
});
