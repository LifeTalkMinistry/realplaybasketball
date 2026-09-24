const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('startup preload contains only Home/core modules', () => {
  const source = read('startup-preload.js');
  for (const forbidden of [
    'real-play-world.js',
    'real-play-world-players.js',
    'real-play-profile.js',
    'ranking-games.js',
    'career-game-replay.js',
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not be preloaded at startup`);
  }
  assert.match(source, /simple-navigation\.js/);
  assert.match(source, /simple-navigation-state-authority\.js/);
});

test('core app readiness is Home/Nav only', () => {
  const source = read('app.js');
  assert.match(source, /data-rp-simple-home/);
  assert.match(source, /data-rp-home-save-slot/);
  assert.equal(source.includes('window.RealPlayWorld?.open'), false);
  assert.equal(source.includes('window.RealPlayProfile?.open'), false);
  assert.equal(source.includes('window.RealPlayRankingGames?.open'), false);
  assert.equal(source.includes('deferredEnhancements'), false);
  assert.equal(source.includes('real-play-world.css'), false);
  assert.equal(source.includes('real-play-profile.css'), false);
  assert.equal(source.includes('ranking-games.css'), false);
  assert.equal(source.includes('career-game-replay.css'), false);
});

test('deep features are explicitly on-demand', () => {
  const source = read('lazy-feature-loader.js');
  for (const feature of ['updates', 'world', 'players', 'profile', 'ranking', 'replay']) {
    assert.match(source, new RegExp(`${feature}:\\s*\\{`));
  }
  assert.match(source, /worldStub\.openTab/);
  assert.match(source, /data-rp-career-replay-session/);
});

test('index installs lazy loader before app boot and drops eager ranking script', () => {
  const source = read('index.html');
  const lazyAt = source.indexOf('lazy-feature-loader.js');
  const appAt = source.indexOf('app.js?v=20260924-lazy-start-v1');
  assert.ok(lazyAt >= 0 && appAt > lazyAt);
  assert.equal(source.includes('ranking-reservation-snapshot-standby-fit.js'), false);
});

test('preloaded core URLs use the same cache key as app loader', () => {
  const preload = read('startup-preload.js');
  const app = read('app.js');
  assert.match(preload, /20260924-lazy-start-v1/);
  assert.match(app, /20260924-lazy-start-v1/);
});

test('defensive close calls do not download unopened features', () => {
  const source = read('lazy-feature-loader.js');
  assert.match(source, /method === 'close' && !featurePromises\.has\(name\)/);
});

test('standby/profile-art compatibility loads lazily with profile or ranking', () => {
  const source = read('lazy-feature-loader.js');
  assert.ok((source.match(/ranking-reservation-snapshot-standby-fit\.js/g) || []).length >= 2);
});
