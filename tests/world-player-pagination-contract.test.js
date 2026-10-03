const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('authenticated Players requests bounded paginated pages', () => {
  const source = read('real-play-world-players.js');

  assert.match(source, /const PLAYER_PAGE_SIZE = 25/);
  assert.match(source, /paginated: true/);
  assert.match(source, /limit: PLAYER_PAGE_SIZE/);
  assert.match(source, /cursor: append \? playerCursor : null/);
  assert.match(source, /data-world-player-more/);
  assert.match(source, /LOAD MORE PLAYERS/);
  assert.match(source, /mergePlayers/);
});

test('visitor Players uses the same paginated transport', () => {
  const source = read('visitor-world-players.js');

  assert.match(source, /const PLAYER_PAGE_SIZE = 25/);
  assert.match(source, /paginated: true/);
  assert.match(source, /cursor: append \? visitorCursor : null/);
  assert.match(source, /visitorHasMore/);
  assert.match(source, /data-world-player-more/);
  assert.match(source, /loadPlayers\(\{ append: true \}\)/);
});

test('pagination keeps individual profile loading separate', () => {
  const auth = read('real-play-world-players.js');
  const visitor = read('visitor-world-players.js');

  assert.match(auth, /community\('player_profile'/);
  assert.match(visitor, /community\?\.\('player_profile'/);
});
