'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authenticatedSource = fs.readFileSync(path.join(__dirname, '../real-play-world-players.js'), 'utf8');
const visitorSource = fs.readFileSync(path.join(__dirname, '../visitor-world-players.js'), 'utf8');

function sourceSection(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing player renderer section: ${start}`);
  return source.slice(first, last);
}

function fixture(scoped) {
  const list = { innerHTML: '<button data-rp-competition-scope-row="true">TUNE-UP PLAYER</button>' };
  const count = { textContent: '' };
  const more = { hidden: false, disabled: false, textContent: '' };
  const panel = {
    dataset: { rpCompetitionPresentation: scoped ? 'scoped' : '' },
    querySelector(selector) {
      if (selector === '[data-world-player-list]') return list;
      if (selector === '[data-world-player-count]') return count;
      if (selector === '[data-world-player-more]') return more;
      return null;
    },
  };
  return { list, count, more, panel };
}

test('auth directory refresh finally cannot erase a loaded Tune-Up leaderboard', async () => {
  const view = fixture(true);
  const events = [];
  const sandbox = {
    worldPanel: view.panel,
    players: [],
    hasMorePlayers: false,
    loadingPlayers: false,
    playerCursor: null,
    meUserId: null,
    PLAYER_PAGE_SIZE: 20,
    setPlayersStatus: () => {},
    community: async () => ({ players: [], page: { hasMore: false, nextCursor: null } }),
    window: {
      dispatchEvent(event) {
        events.push(event.type);
        if (event.type === 'realplay:players-loaded') {
          view.list.innerHTML = '<button data-rp-competition-scope-row="true">18 TUNE-UP PLAYERS</button>';
        }
      },
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options?.detail; }
    },
  };
  const source = [
    sourceSection(authenticatedSource, '  function renderPlayers() {', '  function setPlayersStatus('),
    sourceSection(authenticatedSource, '  async function refreshPlayers(', '  function activatePlayers()'),
    '({ renderPlayers, refreshPlayers })',
  ].join('\n');
  const { refreshPlayers } = vm.runInNewContext(source, sandbox);

  await refreshPlayers();

  assert.ok(events.includes('realplay:players-loaded'), 'directory should still emit loading events');
  assert.match(view.list.innerHTML, /18 TUNE-UP PLAYERS/, 'scoped rows must survive the trailing finally renderer');
});

test('auth directory resumes normal rendering after leaving the competition scope', () => {
  const view = fixture(false);
  const renderPlayers = vm.runInNewContext(
    sourceSection(authenticatedSource, '  function renderPlayers() {', '  function setPlayersStatus(')
      + '\nrenderPlayers',
    {
      worldPanel: view.panel,
      players: [],
      hasMorePlayers: false,
      loadingPlayers: false,
    }
  );
  renderPlayers();
  assert.match(view.list.innerHTML, /NO REAL PLAY PLAYER PROFILES YET/);
});

test('visitor directory also respects competition scope ownership', () => {
  const source = sourceSection(visitorSource, '  function renderVisitorPlayers() {', '  async function loadPlayers(')
    + '\nrenderVisitorPlayers';
  const view = fixture(true);
  const renderVisitorPlayers = vm.runInNewContext(source, {
    world: () => view.panel,
    visitorPlayers: [],
    visitorHasMore: false,
    loadingPlayers: false,
  });
  renderVisitorPlayers();
  assert.match(view.list.innerHTML, /TUNE-UP PLAYER/);
  view.panel.dataset.rpCompetitionPresentation = '';
  renderVisitorPlayers();
  assert.match(view.list.innerHTML, /NO REAL PLAY PLAYER PROFILES YET/);
});
