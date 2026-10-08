'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const auth = fs.readFileSync(path.join(__dirname, '../real-play-world-players.js'), 'utf8');
const visitor = fs.readFileSync(path.join(__dirname, '../visitor-world-players.js'), 'utf8');
const hub = fs.readFileSync(path.join(__dirname, '../competition-hub.js'), 'utf8');

function slice(source, begin, end) {
  const start = source.indexOf(begin);
  const stop = source.indexOf(end, start);
  assert.ok(start >= 0 && stop > start, `Missing function: ${begin}`);
  return source.slice(start, stop);
}

function makeRoot() {
  const root = {
    children: [],
    writes: 0,
    querySelectorAll(selector) {
      assert.equal(selector, '.rp-world-player-row');
      return this.children.filter((row) => row.className === 'rp-world-player-row');
    },
    appendChild(row) {
      if (row.parent) row.remove();
      this.children.push(row);
      row.parent = this;
      this.writes++;
      return row;
    },
    get firstElementChild() { return this.children[0] || null; },
    get innerHTML() { return this.children.map((row) => row.markup).join(''); },
    set innerHTML(markup) {
      this.writes++;
      this.children = [makeRow(markup)];
    },
  };
  return root;
}

function makeRow(markup) {
  const id = markup.match(/data-world-player-id="([^"]*)"/)?.[1] || '';
  return {
    className: id ? 'rp-world-player-row' : 'rp-world-player-empty',
    markup,
    dataset: { worldPlayerId: id },
    classList: { contains: (key) => key === 'rp-world-player-empty' && !id },
    remove() {
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    },
    replaceWith(fresh) {
      const root = this.parent;
      const index = root.children.indexOf(this);
      assert.ok(index >= 0);
      root.children[index] = fresh;
      fresh.parent = root;
      this.parent = null;
      root.writes++;
    },
  };
}

function fakeDocument() {
  return {
    createElement(tag) {
      assert.equal(tag, 'template');
      const result = { content: {} };
      Object.defineProperty(result, 'innerHTML', {
        set(markup) { this.content.firstElementChild = makeRow(markup); },
      });
      return result;
    },
  };
}

function setup(source, helper, renderer) {
  const root = makeRoot();
  const count = { textContent: '' };
  const more = { textContent: '', hidden: false, disabled: false };
  const panel = {
    dataset: { rpCompetitionPresentation: 'overall' },
    querySelector(selector) {
      if (selector === '[data-world-player-list]') return root;
      if (selector === '[data-world-player-count]') return count;
      if (selector === '[data-world-player-more]') return more;
      return null;
    },
  };
  const code = slice(source, `  function ${helper}(`, `  function ${renderer}(`)
    + slice(source, `  function ${renderer}(`, helper === 'reconcileDirectoryRows'
      ? '  function setPlayersStatus(' : '  async function loadPlayers(');
  const common = {
    document: fakeDocument(),
    esc: (value) => String(value ?? ''),
    number: (value) => Number(value || 0),
    pick: (...args) => args.find((item) => item !== null && item !== undefined && item !== ''),
  };
  const variables = helper === 'reconcileDirectoryRows'
    ? 'let worldPanel = panel; let players = []; let loadingPlayers = false; let hasMorePlayers = false;'
    : 'let visitorPlayers = []; let loadingPlayers = false; let visitorHasMore = false;';
  const values = helper === 'reconcileDirectoryRows'
    ? { panel }
    : { world: () => panel };
  const api = vm.runInNewContext(
    variables + '\n' + code
    + '\n({ render: ' + renderer
    + ', setPlayers: (next) => { ' + (helper === 'reconcileDirectoryRows' ? 'players' : 'visitorPlayers') + ' = next; } })',
    { ...common, ...values }
  );
  return { root, api, count, more };
}

function player(userId, playerName, ovr) {
  return {
    userId, playerId: userId, playerName, playerNumber: userId,
    ovr, wins: 2, losses: 1, record: { games: 3, wins: 2, losses: 1 }, winRate: 67,
  };
}

for (const [label, source, helper, renderer] of [
  ['authenticated', auth, 'reconcileDirectoryRows', 'renderPlayers'],
  ['visitor', visitor, 'reconcileVisitorRows', 'renderVisitorPlayers'],
]) {
  test(`${label} Overall Ranking preserves premium bars on identical redraws and pagination`, () => {
    const { root, api } = setup(source, helper, renderer);
    const original = [player(1, 'FIRST', 77), player(2, 'SECOND', 75)];
    api.setPlayers(original);
    api.render();
    assert.equal(root.children.length, 2);
    const preserved = root.children[0];
    preserved.premiumBadgeNode = { image: 'captain.png' };
    const initialWrites = root.writes;

    // Successful request/finally/focus events are all render calls.
    api.setPlayers(original.map((item) => ({ ...item })));
    api.render();
    api.render();
    api.render();
    assert.strictEqual(root.children[0], preserved);
    assert.deepEqual(root.children[0].premiumBadgeNode, { image: 'captain.png' });
    assert.equal(root.writes, initialWrites, 'no new row nodes for unchanged player data');

    // Filtering may sort existing rows; a reload must not undo the user's order.
    root.children.reverse();
    api.render();
    assert.equal(root.children[1], preserved);
    assert.equal(root.writes, initialWrites);

    // Append a player without reconstructing existing rows/badges.
    api.setPlayers([...original, player(3, 'THIRD', 72)]);
    api.render();
    assert.equal(root.children.length, 3);
    assert.strictEqual(root.children[1], preserved);
    assert.equal(root.writes, initialWrites + 1);

    // A genuine rating edit updates only the changed player's card.
    const stableOther = root.children.find((row) => row.dataset.worldPlayerId === '2');
    api.setPlayers([player(1, 'FIRST', 78), player(2, 'SECOND', 75), player(3, 'THIRD', 72)]);
    api.render();
    assert.equal(root.children.length, 3);
    assert.notStrictEqual(root.children.find((row) => row.dataset.worldPlayerId === '1'), preserved);
    assert.strictEqual(root.children.find((row) => row.dataset.worldPlayerId === '2'), stableOther);

    api.setPlayers([player(2, 'SECOND', 75)]);
    api.render();
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0], stableOther);
  });
}

test('Overall Rankings reuses its Back button and writes static heading once', () => {
  const body = slice(hub, '  function decoratePlayerRankings(', '  function queueOverallPlayerPage(');
  const textNode = () => ({
    value: '',
    writes: 0,
    get textContent() { return this.value; },
    set textContent(next) { this.value = next; this.writes++; },
  });
  const nodes = Array.from({ length: 5 }, textNode);
  const [title, subtitle, badge, kicker, heading] = nodes;
  badge.style = {
    getPropertyValue: () => '',
    removeProperty: () => { throw Error('unnecessary visibility rewrite'); },
  };
  const directoryHead = {
    button: null,
    querySelector: () => directoryHead.button,
    appendChild(button) { this.button = button; },
  };
  const playersView = {
    hidden: false,
    querySelector(selector) {
      if (selector === '.rp-world-player-directory-head small') return kicker;
      if (selector === '.rp-world-player-directory-head strong') return heading;
      if (selector === '.rp-world-player-directory-head') return directoryHead;
      return null;
    },
  };
  const world = {
    dataset: { rpCompetitionPresentation: 'overall' },
    classList: { contains: () => false },
    querySelector(selector) {
      if (selector === '[data-world-view="players"]') return playersView;
      if (selector === '.rp-world-title strong') return title;
      if (selector === '.rp-world-title span') return subtitle;
      if (selector === '.rp-world-online') return badge;
      return null;
    },
  };
  let removals = 0;
  let created = 0;
  const decorate = vm.runInNewContext(
    'let playerPresentation = "overall";\n' + body + '\ndecoratePlayerRankings',
    {
      document: {
        querySelector: () => world,
        createElement: () => {
          created++;
          return {
            dataset: {},
            setAttribute: () => {},
            addEventListener: () => {},
          };
        },
      },
      removeScopedArtifacts: () => { removals++; },
      hideStatsLoading: () => {},
      returnFromOverallRanking: () => {},
    }
  );
  decorate();
  decorate();
  assert.equal(created, 1);
  assert.equal(removals, 0);
  for (const node of nodes) assert.equal(node.writes, 1);
});
