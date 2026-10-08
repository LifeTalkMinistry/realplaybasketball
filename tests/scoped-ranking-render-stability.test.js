'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scopedSource = fs.readFileSync(path.join(__dirname, '..', 'competition-hub.js'), 'utf8');
const filterSource = fs.readFileSync(path.join(__dirname, '..', 'real-play-world-player-filters.js'), 'utf8');

function sourceSection(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source section: ${start}`);
  return source.slice(first, last);
}

test('a scoped ranking reuses the original player nodes on clicks and refocus', () => {
  const code = sourceSection(scopedSource, '  function renderScopedCompetitionRows(', '  async function loadScopedCompetition(');
  const renderer = vm.runInNewContext(code + '\nrenderScopedCompetitionRows', {
    esc: String,
    scopedPlayerRow: (player) => `<button data-rp-competition-scope-row="true">${player.playerName}</button>`,
  });
  let writes = 0;
  let html = '';
  const list = {
    children: [],
    querySelectorAll(selector) {
      assert.equal(selector, '[data-rp-competition-scope-row]');
      return this.children.filter((row) => row.scoped);
    },
    get innerHTML() { return html; },
    set innerHTML(value) {
      writes += 1;
      html = value;
      this.children = [...value.matchAll(/<button data-rp-competition-scope-row="true">/g)]
        .map(() => ({ scoped: true }));
    },
  };

  const config = {
    loading: false, error: '',
    players: [{ playerName: 'PLAYER ONE', rank: 1 }, { playerName: 'PLAYER TWO', rank: 2 }],
  };
  renderer(list, config);
  assert.equal(writes, 1);
  const firstRow = list.children[0];
  const secondRow = list.children[1];

  // Sorting changes DOM order but should preserve all row and badge nodes.
  list.children.reverse();
  renderer(list, config);
  renderer(list, config);
  assert.equal(writes, 1);
  assert.equal(list.children[1], firstRow);
  assert.equal(list.children[0], secondRow);
  assert.equal(firstRow.__rpCompetitionScopedPlayer.playerName, 'PLAYER ONE');

  // A fresh verified response should repaint exactly once.
  config.players = [{ playerName: 'UPDATED PLAYER', rank: 1 }];
  renderer(list, config);
  assert.equal(writes, 2);
  assert.equal(list.children.length, 1);

  // Recover if the shared World directory overwrites the scoped list.
  list.innerHTML = '<button>GENERAL PLAYER</button>';
  renderer(list, config);
  assert.equal(writes, 4);
  assert.equal(list.children.length, 1);
});

test('click/refocus rendering does not reset leaderboard scroll or mutate the heading', () => {
  const code = sourceSection(scopedSource, '  function applyScopedRanking(', '  function openScopedRanking(');
  const config = {
    id: 'tune-up', title: 'TUNE-UP', playerCount: 18, players: [{rank: 1}],
    loading: false, error: '', filterInitialized: true, readyAnnounced: true,
  };

  let titleWrites = 0;
  let countWrites = 0;
  const title = {
    value: '',
    get textContent() { return this.value; },
    set textContent(value) { this.value = value; titleWrites += 1; },
  };
  const count = {
    value: '',
    get textContent() { return this.value; },
    set textContent(value) { this.value = value; countWrites += 1; },
  };
  const header = {
    querySelector(selector) {
      if (selector === '[data-rp-competition-scope-top-title]') return title;
      if (selector === '[data-rp-competition-scope-player-count]') return count;
      return null;
    },
  };
  const list = { children: [] };
  const more = { hidden: false };
  const controls = {};
  const directory = { querySelector: () => header };
  const playersView = {
    hidden: false,
    querySelector(selector) {
      if (selector === '.rp-world-player-directory') return directory;
      if (selector === '[data-world-player-list]') return list;
      if (selector === '[data-world-player-sort]') return controls;
      if (selector === '[data-world-player-more]') return more;
      return null;
    },
  };
  let scrollWrites = 0;
  let scrollValue = 100;
  const world = {
    classList: { add: () => {} },
    dataset: {},
    get scrollTop() { return scrollValue; },
    set scrollTop(value) { scrollValue = value; scrollWrites += 1; },
    querySelector: () => playersView,
  };
  let rowRenderCalls = 0;
  const apply = vm.runInNewContext(
    'let scopedRanking = config; let playerPresentation = "scoped";\n'
      + code + '\napplyScopedRanking',
    {
      config,
      document: { querySelector: () => world },
      renderScopedCompetitionRows: () => { rowRenderCalls += 1; },
    },
  );
  apply(0);
  assert.equal(world.scrollTop, 0);
  assert.equal(scrollWrites, 1);
  world.scrollTop = 280;
  apply(0);
  assert.equal(world.scrollTop, 280);
  assert.equal(scrollWrites, 2);
  assert.equal(titleWrites, 1);
  assert.equal(countWrites, 1);
  assert.equal(rowRenderCalls, 2);
  assert.equal(more.hidden, true);
});

test('unchanged ranking badges and metric markup do not trigger mutation observers', () => {
  const badgeCode = sourceSection(filterSource, '  function renderRowRank(', '  function metricPresentation(');
  const metricCode = sourceSection(filterSource, '  function renderRowMetric(', '  function compareName(');
  let badgeWrites = 0;
  const dataset = {};
  Object.defineProperty(dataset, 'officialRank', {
    configurable: true,
    get() { return this.value; },
    set(value) { this.value = value; badgeWrites += 1; },
  });
  const badge = { textContent: '', classList: { toggle: () => {} } };
  const nameNode = { querySelector: () => badge };
  const row = { dataset, querySelector: () => nameNode };
  const renderBadge = vm.runInNewContext(
    'let filterMode = "ranked";\n' + badgeCode + '\nrenderRowRank',
  );
  renderBadge({ row, rank: 1 });
  renderBadge({ row, rank: 1 });
  assert.equal(badgeWrites, 1);
  assert.equal(badge.textContent, '#1');

  let markupWrites = 0;
  let markup = '';
  const metricNode = {
    dataset: {},
    get innerHTML() { return markup; },
    set innerHTML(next) { markup = next; markupWrites += 1; },
  };
  const metricParent = { querySelector: () => metricNode };
  const meta = { row: { querySelector: () => metricParent } };
  const metricRenderer = vm.runInNewContext(
    'let sortKey = "scoring";\n' + metricCode
      + '\n({ renderRowMetric, switchToAssists: () => { sortKey = "assists"; } })',
    { metricPresentation: () => [12, 'PPG'] },
  );
  metricRenderer.renderRowMetric(meta);
  metricRenderer.renderRowMetric(meta);
  assert.equal(markupWrites, 1);
  metricRenderer.switchToAssists();
  metricRenderer.renderRowMetric(meta);
  assert.equal(markupWrites, 2);
});
